import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import {
  extractDomain,
  normalizeEmail,
  normalizeName,
  normalizePhoneMk,
  normalizeRegistrationNumber,
  normalizeUrl,
  nameSimilarity,
  companyFiltersSchema,
  cityFilterVariants,
  canonicalizeCity,
  addressSimilarity,
  isDedupableWebsiteDomain,
  normalizeAddress,
  IDENTITY_THRESHOLDS,
  HIGH_VALUE_SCORE_THRESHOLD,
} from '@leadhunter/shared';
import type { Prisma } from '@leadhunter/database';
import {
  auditWebsite,
  captureScreenshots,
  discoverContacts,
  discoverWebsitePresence,
  enrichFromGooglePlaces,
  generateAiAudit,
} from '@leadhunter/audit-engine';
import { companyNormalizer, computeSourceQualityScore } from '@leadhunter/scraper';
import { createStorage } from '../storage/local-storage';
import { PrismaService } from '../prisma/prisma.service';
import { LeadClassificationService } from '../classification/classification.service';

@Injectable()
export class CompaniesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LeadClassificationService)
    private readonly classification: LeadClassificationService,
  ) {}

  async list(rawQuery: Record<string, string>) {
    const filters = companyFiltersSchema.parse(rawQuery);
    const where = this.buildWhere(filters);
    const page = filters.page;
    const pageSize = filters.pageSize;
    const sortBy = filters.sortBy;
    const sortDir = filters.sortDir;

    // Postgres puts NULL first on DESC by default, so an unscored majority
    // would bury every real lead score under pages of dashes. Always park
    // null scores after scored rows when sorting by latestLeadScore.
    const orderBy =
      sortBy === 'latestLeadScore'
        ? { latestLeadScore: { sort: sortDir, nulls: 'last' as const } }
        : { [sortBy]: sortDir };

    const [total, data] = await this.prisma.$transaction([
      this.prisma.company.count({ where }),
      this.prisma.company.findMany({
        where,
        include: {
          outreach: true,
          screenshot: true,
          audits: { where: { isLatest: true }, take: 1 },
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async getById(id: string) {
    return this.prisma.company.findUnique({
      where: { id },
      include: {
        outreach: { include: { history: { orderBy: { createdAt: 'desc' } } } },
        screenshot: true,
        contacts: { orderBy: { confidence: 'desc' } },
        discoveries: { orderBy: { createdAt: 'desc' } },
        emailTemplates: { orderBy: { createdAt: 'desc' } },
        sources: { orderBy: { scrapedAt: 'desc' } },
        classification: true,
        audits: {
          orderBy: { auditedAt: 'desc' },
          include: { issues: true },
        },
      },
    });
  }

  async update(id: string, body: Record<string, unknown>) {
    const website = body.website !== undefined ? normalizeUrl(String(body.website || '')) : undefined;
    const email = body.email !== undefined ? normalizeEmail(String(body.email || '')) : undefined;
    const phone = body.phone !== undefined ? String(body.phone || '') : undefined;

    return this.prisma.company.update({
      where: { id },
      data: {
        name: body.name !== undefined ? String(body.name) : undefined,
        industry: body.industry !== undefined ? String(body.industry || '') || null : undefined,
        city: body.city !== undefined ? canonicalizeCity(String(body.city || '')) : undefined,
        address: body.address !== undefined ? String(body.address || '') || null : undefined,
        phone,
        phoneNormalized: phone !== undefined ? normalizePhoneMk(phone) : undefined,
        email,
        website,
        websiteDomain: website !== undefined ? extractDomain(website) : undefined,
        hasWebsite: website !== undefined ? Boolean(website) : undefined,
        facebookUrl:
          body.facebookUrl !== undefined ? normalizeUrl(String(body.facebookUrl || '')) : undefined,
        linkedinUrl:
          body.linkedinUrl !== undefined ? normalizeUrl(String(body.linkedinUrl || '')) : undefined,
        instagramUrl:
          body.instagramUrl !== undefined ? normalizeUrl(String(body.instagramUrl || '')) : undefined,
        nameNormalized: body.name !== undefined ? normalizeName(String(body.name)) : undefined,
      },
    });
  }

  async remove(id: string) {
    await this.prisma.company.delete({ where: { id } });
    return { ok: true };
  }

  async upsertFromRaw(raw: {
    name: string;
    registrationNumber?: string | null;
    industry?: string | null;
    city?: string | null;
    municipality?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
    facebookUrl?: string | null;
    linkedinUrl?: string | null;
    instagramUrl?: string | null;
    googleMapsUrl?: string | null;
    googlePlaceId?: string | null;
    googleRating?: number | null;
    googleReviewsCount?: number | null;
    googleCategory?: string | null;
    googleBusinessStatus?: string | null;
    googleOpeningHours?: unknown;
    googlePhotos?: unknown;
    sourceUrl?: string | null;
    sourceName?: string | null;
  }) {
    const normalized = companyNormalizer.normalize(raw);
    const website = normalized.website;
    const email = normalized.email;
    const phoneNormalized = normalizePhoneMk(normalized.phone);
    const websiteDomain = extractDomain(website);
    const nameNormalized = normalizeName(normalized.name);
    const addressNormalized = normalizeAddress(normalized.address);
    const registrationNumber = normalizeRegistrationNumber(normalized.registrationNumber);
    const sourceName = normalized.sourceName || null;
    const googlePlaceId = normalized.googlePlaceId || null;
    const now = new Date();

    const existing = await this.findDuplicate({
      registrationNumber,
      googlePlaceId,
      websiteDomain,
      phoneNormalized,
      email: email ?? null,
      nameNormalized,
      addressNormalized,
      address: normalized.address,
      city: normalized.city,
      name: normalized.name,
    });

    if (existing) {
      const sourceReferences = Array.from(
        new Set([...(existing.sourceReferences || []), sourceName].filter(Boolean) as string[]),
      );
      const mergedWebsite = existing.website || website;
      const mergedEmail = existing.email || email;
      const mergedPhone = existing.phone || normalized.phone;
      const mergedPlaceId = existing.googlePlaceId || googlePlaceId;
      const sourceQualityScore = computeSourceQualityScore({
        sourceReferences,
        sourceName: existing.sourceName || sourceName,
        hasWebsite: Boolean(mergedWebsite),
        email: mergedEmail,
        phone: mergedPhone,
        googlePlaceId: mergedPlaceId,
      });

      const updated = await this.prisma.company.update({
        where: { id: existing.id },
        data: {
          name: companyNormalizer.merge(
            { name: existing.name },
            { name: normalized.name },
          ).name,
          nameNormalized: normalizeName(
            companyNormalizer.merge(
              { name: existing.name },
              { name: normalized.name },
            ).name || normalized.name,
          ),
          registrationNumber: existing.registrationNumber || registrationNumber,
          industry: existing.industry || normalized.industry,
          city: existing.city || normalized.city,
          municipality: existing.municipality || normalized.municipality,
          address: existing.address || normalized.address,
          addressNormalized: existing.addressNormalized || addressNormalized,
          phone: mergedPhone,
          phoneNormalized: existing.phoneNormalized || phoneNormalized,
          email: mergedEmail,
          website: mergedWebsite,
          websiteDomain: existing.websiteDomain || websiteDomain,
          hasWebsite: Boolean(mergedWebsite),
          facebookUrl: existing.facebookUrl || normalizeUrl(normalized.facebookUrl),
          linkedinUrl: existing.linkedinUrl || normalizeUrl(normalized.linkedinUrl),
          instagramUrl: existing.instagramUrl || normalizeUrl(normalized.instagramUrl),
          googleMapsUrl: existing.googleMapsUrl || normalizeUrl(normalized.googleMapsUrl),
          googlePlaceId: mergedPlaceId,
          googleRating: existing.googleRating ?? normalized.googleRating ?? null,
          googleReviewsCount:
            existing.googleReviewsCount ?? normalized.googleReviewsCount ?? null,
          googleCategory: existing.googleCategory || normalized.googleCategory,
          googleBusinessStatus:
            existing.googleBusinessStatus || normalized.googleBusinessStatus,
          googleOpeningHours:
            (existing.googleOpeningHours as object) ||
            (normalized.googleOpeningHours as object) ||
            undefined,
          googlePhotos:
            (existing.googlePhotos as object) ||
            (normalized.googlePhotos as object) ||
            undefined,
          googleLastUpdated: googlePlaceId ? now : existing.googleLastUpdated,
          sourceUrl: existing.sourceUrl || normalized.sourceUrl,
          sourceName: existing.sourceName || sourceName,
          sourceReferences,
          sourceQualityScore,
          lastScrapedAt: now,
        },
      });

      if (sourceName) {
        await this.recordCompanySource(
          updated.id,
          sourceName,
          normalized.sourceUrl || normalized.googleMapsUrl,
        );
      }
      return { created: false, id: updated.id, duplicate: true };
    }

    const sourceReferences = sourceName ? [sourceName] : [];
    const sourceQualityScore = computeSourceQualityScore({
      sourceReferences,
      sourceName,
      hasWebsite: Boolean(website),
      email,
      phone: normalized.phone,
      googlePlaceId,
    });

    const created = await this.prisma.company.create({
      data: {
        name: normalized.name.trim(),
        registrationNumber,
        industry: normalized.industry || null,
        city: normalized.city || null,
        municipality: normalized.municipality || null,
        address: normalized.address || null,
        addressNormalized,
        phone: normalized.phone || null,
        phoneNormalized,
        email,
        website,
        websiteDomain,
        hasWebsite: Boolean(website),
        facebookUrl: normalizeUrl(normalized.facebookUrl),
        linkedinUrl: normalizeUrl(normalized.linkedinUrl),
        instagramUrl: normalizeUrl(normalized.instagramUrl),
        googleMapsUrl: normalizeUrl(normalized.googleMapsUrl),
        googlePlaceId,
        googleRating: normalized.googleRating ?? null,
        googleReviewsCount: normalized.googleReviewsCount ?? null,
        googleCategory: normalized.googleCategory || null,
        googleBusinessStatus: normalized.googleBusinessStatus || null,
        googleOpeningHours: (normalized.googleOpeningHours as object) || undefined,
        googlePhotos: (normalized.googlePhotos as object) || undefined,
        googleLastUpdated: googlePlaceId ? now : null,
        sourceUrl: normalized.sourceUrl || null,
        sourceName,
        sourceReferences,
        sourceQualityScore,
        nameNormalized,
        lastScrapedAt: now,
        outreach: { create: { status: 'NOT_CONTACTED' } },
      },
    });

    if (sourceName) {
      await this.recordCompanySource(
        created.id,
        sourceName,
        normalized.sourceUrl || normalized.googleMapsUrl,
      );
    }
    return { created: true, id: created.id, duplicate: false };
  }

  /** Batch persist for large discovery runs (50k+ scale). */
  async upsertBatch(
    companies: Parameters<CompaniesService['upsertFromRaw']>[0][],
    batchSize = 50,
  ) {
    let created = 0;
    let updated = 0;
    for (let i = 0; i < companies.length; i += batchSize) {
      const chunk = companies.slice(i, i + batchSize);
      for (const company of chunk) {
        const result = await this.upsertFromRaw(company);
        if (result.created) created += 1;
        else updated += 1;
      }
    }
    return { created, updated };
  }

  private async recordCompanySource(
    companyId: string,
    sourceName: string,
    sourceUrl?: string | null,
  ) {
    await this.prisma.companySource.upsert({
      where: {
        companyId_sourceName: { companyId, sourceName },
      },
      create: {
        companyId,
        sourceName,
        sourceUrl: sourceUrl || null,
      },
      update: {
        sourceUrl: sourceUrl || undefined,
        scrapedAt: new Date(),
      },
    });
  }

  async auditOne(companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found');

    // Google Places enrichment — fills website/Maps IDs missing from directory scrapes
    if (!company.website || !company.googlePlaceId) {
      await this.applyPlacesEnrichment(company);
    }

    // Domain-guess discovery if still no website
    if (!company.website) {
      const discoveries = await discoverWebsitePresence(company);
      for (const d of discoveries) {
        await this.prisma.websiteDiscovery.create({
          data: {
            companyId,
            discoveredUrl: d.discoveredUrl,
            kind: d.kind,
            confidence: d.confidence,
            method: d.method,
          },
        });
        if (d.kind === 'WEBSITE' && d.confidence >= 0.7) {
          await this.prisma.company.update({
            where: { id: companyId },
            data: {
              website: d.discoveredUrl,
              websiteDomain: extractDomain(d.discoveredUrl),
              hasWebsite: true,
            },
          });
          company.website = d.discoveredUrl;
          company.hasWebsite = true;
        }
        if (d.kind === 'FACEBOOK' && !company.facebookUrl && d.confidence >= 0.9) {
          await this.prisma.company.update({
            where: { id: companyId },
            data: { facebookUrl: d.discoveredUrl },
          });
        }
      }
    }

    const lightweight =
      process.env.AUDIT_LIGHTWEIGHT === 'true' ||
      (await this.getSettingFlag('audit', 'lightweight'));

    const result = await auditWebsite(company.website, {
      lightweight,
      hasEmail: Boolean(company.email),
      hasPhone: Boolean(company.phone),
      hasGooglePresence: Boolean(company.googlePlaceId || company.googleMapsUrl),
      industry: company.industry,
      sourceQualityScore: company.sourceQualityScore,
    });

    const aiRecommendations = await generateAiAudit({
      companyName: company.name,
      industry: company.industry,
      city: company.city,
      website: company.website,
      score: result.score,
      issues: result.issues,
      designAgeEstimate: result.designAgeEstimate,
    });

    await this.prisma.websiteAudit.updateMany({
      where: { companyId, isLatest: true },
      data: { isLatest: false },
    });

    const audit = await this.prisma.websiteAudit.create({
      data: {
        companyId,
        websiteExists: result.websiteExists,
        websiteAccessible: result.websiteAccessible,
        sslEnabled: result.sslEnabled,
        mobileFriendly: result.mobileFriendly,
        lighthousePerformance: result.lighthousePerformance,
        lighthouseSeo: result.lighthouseSeo,
        lighthouseAccessibility: result.lighthouseAccessibility,
        lighthouseBestPractices: result.lighthouseBestPractices,
        hasContactForm: result.hasContactForm,
        hasGoogleMaps: result.hasGoogleMaps,
        hasSocialLinks: result.hasSocialLinks,
        hasPrivacyPolicy: result.hasPrivacyPolicy,
        hasCookieNotice: result.hasCookieNotice,
        designAgeEstimate: result.designAgeEstimate,
        isPlaceholderSite: result.isPlaceholderSite,
        placeholderSignals: result.placeholderSignals,
        leadScore: result.score.score,
        scoreReasons: result.score.reasons,
        auditSummary: result.auditSummary,
        aiRecommendations,
        outreachAnalysis: result.outreachAnalysis,
        issuesCount: result.issues.length,
        isLatest: true,
        issues: {
          create: result.issues.map((i) => ({
            code: i.code,
            severity: i.severity,
            title: i.title,
            description: i.description,
          })),
        },
      },
      include: { issues: true },
    });

    await this.prisma.company.update({
      where: { id: companyId },
      data: { latestLeadScore: result.score.score },
    });

    const storage = createStorage();
    if (company.website && process.env.SKIP_SCREENSHOTS !== 'true') {
      const shots = await captureScreenshots(companyId, company.website, storage);
      await this.prisma.screenshot.upsert({
        where: { companyId },
        create: {
          companyId,
          desktopPath: shots.desktopPath,
          mobilePath: shots.mobilePath,
        },
        update: {
          desktopPath: shots.desktopPath,
          mobilePath: shots.mobilePath,
          capturedAt: new Date(),
        },
      });
    }

    await this.classification.classifyAndStore(companyId);

    return audit;
  }

  async classifyOne(companyId: string) {
    return this.classification.classifyAndStore(companyId);
  }

  async discoverContactsForCompany(companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found');

    const contacts = await discoverContacts(company);
    for (const c of contacts) {
      await this.prisma.contactCandidate.upsert({
        where: {
          companyId_type_value: {
            companyId,
            type: c.type,
            value: c.value,
          },
        },
        create: {
          companyId,
          type: c.type,
          value: c.value,
          sourceUrl: c.sourceUrl,
          confidence: c.confidence,
          isPrimary: c.isPrimary,
        },
        update: {
          sourceUrl: c.sourceUrl,
          confidence: c.confidence,
          isPrimary: c.isPrimary,
        },
      });

      if (c.type === 'EMAIL' && c.isPrimary && !company.email) {
        await this.prisma.company.update({
          where: { id: companyId },
          data: { email: c.value },
        });
      }
      if (c.type === 'FACEBOOK' && !company.facebookUrl) {
        await this.prisma.company.update({
          where: { id: companyId },
          data: { facebookUrl: c.value },
        });
      }
      if (c.type === 'LINKEDIN' && !company.linkedinUrl) {
        await this.prisma.company.update({
          where: { id: companyId },
          data: { linkedinUrl: c.value },
        });
      }
      if (c.type === 'INSTAGRAM' && !company.instagramUrl) {
        await this.prisma.company.update({
          where: { id: companyId },
          data: { instagramUrl: c.value },
        });
      }
    }

    return contacts;
  }

  async topLeads(limit = 50) {
    return this.prisma.company.findMany({
      where: {
        latestLeadScore: { gte: HIGH_VALUE_SCORE_THRESHOLD },
      },
      include: {
        outreach: true,
        audits: { where: { isLatest: true }, take: 1 },
      },
      orderBy: { latestLeadScore: 'desc' },
      take: limit,
    });
  }

  private buildWhere(filters: ReturnType<typeof companyFiltersSchema.parse>): Prisma.CompanyWhereInput {
    const where: Prisma.CompanyWhereInput = {};
    const and: Prisma.CompanyWhereInput[] = [];

    if (filters.search) {
      and.push({
        OR: [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { email: { contains: filters.search, mode: 'insensitive' } },
          { website: { contains: filters.search, mode: 'insensitive' } },
          { phone: { contains: filters.search, mode: 'insensitive' } },
        ],
      });
    }
    if (filters.industry) {
      // Accept enum (PRINTING) and legacy display labels
      const upper = filters.industry.replace(/\s+/g, '_').toUpperCase();
      const industryVariants = Array.from(
        new Set([
          filters.industry,
          filters.industry.toUpperCase(),
          upper,
          // Legacy HOSPITALITY ↔ split food/lodging
          ...(upper === 'FOOD_BEVERAGE' || upper === 'LODGING' ? ['HOSPITALITY'] : []),
          ...(upper === 'HOSPITALITY' ? ['FOOD_BEVERAGE', 'LODGING'] : []),
        ]),
      );
      and.push({
        OR: industryVariants.map((v) => ({
          industry: { equals: v, mode: 'insensitive' as const },
        })),
      });
    }
    if (filters.city) {
      const variants = cityFilterVariants(filters.city);
      and.push({
        OR: variants.map((v) => ({
          city: { equals: v, mode: 'insensitive' as const },
        })),
      });
    }
    if (filters.hasWebsite !== undefined) where.hasWebsite = filters.hasWebsite;
    if (filters.hasEmail === true) where.email = { not: null };
    if (filters.hasEmail === false) where.email = null;
    if (filters.minScore !== undefined || filters.maxScore !== undefined) {
      where.latestLeadScore = {
        gte: filters.minScore,
        lte: filters.maxScore,
      };
    }
    if (filters.outreachStatus) {
      where.outreach = { status: filters.outreachStatus };
    }
    if (and.length) where.AND = and;
    return where;
  }

  /**
   * Backfill website / Google Maps fields for companies that came from directories
   * without a site (e.g. Yellow Pages) but have a listing on Google Places.
   */
  async enrichMissingFromPlaces(limit = 100) {
    const companies = await this.prisma.company.findMany({
      where: {
        OR: [{ website: null }, { hasWebsite: false }, { googlePlaceId: null }],
      },
      orderBy: [{ updatedAt: 'desc' }],
      take: Math.min(Math.max(limit, 1), 500),
    });

    let enriched = 0;
    let withWebsite = 0;
    let failed = 0;

    for (const company of companies) {
      try {
        const before = company.website;
        const ok = await this.applyPlacesEnrichment(company);
        if (ok) {
          enriched += 1;
          if (!before && company.website) withWebsite += 1;
        }
        // Light throttle to respect Places API quotas
        await new Promise((r) => setTimeout(r, 350));
      } catch {
        failed += 1;
      }
    }

    return { scanned: companies.length, enriched, withWebsite, failed };
  }

  private async applyPlacesEnrichment(company: {
    id: string;
    name: string;
    city: string | null;
    phone: string | null;
    address: string | null;
    website: string | null;
    hasWebsite: boolean;
    googlePlaceId: string | null;
    googleMapsUrl: string | null;
    googleRating: number | null;
    googleReviewsCount: number | null;
    googleCategory: string | null;
    phoneNormalized: string | null;
  }): Promise<boolean> {
    const places = await enrichFromGooglePlaces({
      name: company.name,
      city: company.city,
      phone: company.phone,
      address: company.address,
    });
    if (!places || places.confidence < 0.72) return false;

    const website = company.website || places.website;
    const phoneNormalized =
      company.phoneNormalized || normalizePhoneMk(places.phone) || null;

    await this.prisma.company.update({
      where: { id: company.id },
      data: {
        website: website || undefined,
        websiteDomain: website ? extractDomain(website) : undefined,
        hasWebsite: Boolean(website),
        googlePlaceId: company.googlePlaceId || places.googlePlaceId || undefined,
        googleMapsUrl: company.googleMapsUrl || places.googleMapsUrl || undefined,
        googleRating: company.googleRating ?? places.googleRating ?? undefined,
        googleReviewsCount:
          company.googleReviewsCount ?? places.googleReviewsCount ?? undefined,
        googleCategory: company.googleCategory || places.googleCategory || undefined,
        googleLastUpdated: places.googlePlaceId ? new Date() : undefined,
        phone: company.phone || places.phone || undefined,
        phoneNormalized: phoneNormalized || undefined,
      },
    });

    company.website = website;
    company.hasWebsite = Boolean(website);
    if (!company.googlePlaceId && places.googlePlaceId) {
      company.googlePlaceId = places.googlePlaceId;
    }
    if (!company.googleMapsUrl && places.googleMapsUrl) {
      company.googleMapsUrl = places.googleMapsUrl;
    }

    if (places.website) {
      await this.prisma.websiteDiscovery.create({
        data: {
          companyId: company.id,
          discoveredUrl: places.website,
          kind: 'WEBSITE',
          confidence: places.confidence,
          method: places.method,
        },
      });
    }

    if (places.googlePlaceId) {
      await this.recordCompanySource(company.id, 'GOOGLE_MAPS', places.googleMapsUrl);
    }

    return true;
  }

  private async findDuplicate(input: {
    registrationNumber: string | null;
    googlePlaceId: string | null;
    websiteDomain: string | null;
    phoneNormalized: string | null;
    email: string | null;
    nameNormalized: string;
    addressNormalized: string | null;
    address?: string | null;
    name: string;
    city?: string | null;
  }) {
    if (input.registrationNumber) {
      const byReg = await this.prisma.company.findFirst({
        where: { registrationNumber: input.registrationNumber },
      });
      if (byReg) return byReg;
    }
    if (input.googlePlaceId) {
      const byPlace = await this.prisma.company.findFirst({
        where: { googlePlaceId: input.googlePlaceId },
      });
      if (byPlace) return byPlace;
    }

    // Domain / phone / email alone are weak — gate them on name similarity using
    // the same thresholds the scraper's in-batch matcher applies.
    if (isDedupableWebsiteDomain(input.websiteDomain)) {
      const byDomain = await this.prisma.company.findMany({
        where: { websiteDomain: input.websiteDomain! },
        take: 15,
      });
      const domainHit = byDomain.find(
        (c) => nameSimilarity(c.name, input.name) >= IDENTITY_THRESHOLDS.domainNameGate,
      );
      if (domainHit) return domainHit;
    }
    if (input.phoneNormalized) {
      const byPhone = await this.prisma.company.findMany({
        where: { phoneNormalized: input.phoneNormalized },
        take: 15,
      });
      const phoneHit = byPhone.find(
        (c) => nameSimilarity(c.name, input.name) >= IDENTITY_THRESHOLDS.phoneNameGate,
      );
      if (phoneHit) return phoneHit;

      if (input.phoneNormalized.length >= 8) {
        const softCandidates = await this.prisma.company.findMany({
          where: {
            phoneNormalized: { endsWith: input.phoneNormalized.slice(-7) },
          },
          take: 20,
        });
        const softHit = softCandidates.find(
          (c) =>
            c.phoneNormalized &&
            c.phoneNormalized !== input.phoneNormalized &&
            nameSimilarity(c.name, input.name) >= IDENTITY_THRESHOLDS.phoneNameGate,
        );
        if (softHit) return softHit;
      }
    }
    if (input.email) {
      const byEmail = await this.prisma.company.findFirst({
        where: { email: input.email },
      });
      if (byEmail && nameSimilarity(byEmail.name, input.name) >= IDENTITY_THRESHOLDS.emailNameGate) {
        return byEmail;
      }
    }

    const cityVariants = input.city ? cityFilterVariants(input.city) : [];

    if (input.addressNormalized) {
      const byAddress = await this.prisma.company.findMany({
        where: {
          addressNormalized: input.addressNormalized,
          ...(cityVariants.length ? { city: { in: cityVariants } } : {}),
        },
        take: 10,
      });
      const addressHit = byAddress.find(
        (c) =>
          nameSimilarity(c.name, input.name) >= IDENTITY_THRESHOLDS.addressWithTokenOverlap ||
          addressSimilarity(c.address, input.address) >= IDENTITY_THRESHOLDS.addressStrong,
      );
      if (addressHit) return addressHit;
    }

    if (input.nameNormalized) {
      const sameName = await this.prisma.company.findFirst({
        where: {
          nameNormalized: input.nameNormalized,
          ...(cityVariants.length ? { city: { in: cityVariants } } : {}),
        },
      });
      if (sameName) return sameName;
    }

    const candidates = await this.prisma.company.findMany({
      where: cityVariants.length
        ? { city: { in: cityVariants } }
        : { OR: [{ city: input.city || undefined }, { city: null }] },
      take: 80,
      orderBy: { updatedAt: 'desc' },
    });
    return (
      candidates.find(
        (c) => nameSimilarity(c.name, input.name) >= IDENTITY_THRESHOLDS.nameFallbackInCity,
      ) || null
    );
  }

  /**
   * Merge near-duplicate companies already in the DB (same name+city, etc.).
   * Also rewrites nameNormalized so future scrapes match correctly.
   */
  async dedupeExistingCompanies(): Promise<{
    scanned: number;
    nameNormalizedFixed: number;
    merged: number;
    deleted: number;
  }> {
    const all = await this.prisma.company.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        nameNormalized: true,
        city: true,
        industry: true,
        phoneNormalized: true,
        websiteDomain: true,
        googlePlaceId: true,
        website: true,
        email: true,
        phone: true,
        sourceQualityScore: true,
        sourceReferences: true,
        sourceName: true,
        hasWebsite: true,
        createdAt: true,
      },
    });

    let nameNormalizedFixed = 0;
    for (const company of all) {
      const expected = normalizeName(company.name);
      if (expected && expected !== company.nameNormalized) {
        await this.prisma.company.update({
          where: { id: company.id },
          data: { nameNormalized: expected },
        });
        company.nameNormalized = expected;
        nameNormalizedFixed += 1;
      }
    }

    const mergedIds = new Set<string>();
    let merged = 0;
    let deleted = 0;

    const groups = new Map<string, typeof all>();
    for (const company of all) {
      if (mergedIds.has(company.id)) continue;
      const key = `${company.nameNormalized}|${(company.city || '').toLowerCase()}`;
      const list = groups.get(key) || [];
      list.push(company);
      groups.set(key, list);
    }

    for (const group of groups.values()) {
      if (group.length < 2) continue;
      const keeper = this.pickKeeper(group);
      for (const loser of group) {
        if (loser.id === keeper.id || mergedIds.has(loser.id)) continue;
        await this.mergeCompanyRecord(keeper.id, loser.id);
        mergedIds.add(loser.id);
        merged += 1;
        deleted += 1;
      }
    }

    const remaining = all.filter((c) => !mergedIds.has(c.id));
    for (let i = 0; i < remaining.length; i++) {
      const a = remaining[i]!;
      if (mergedIds.has(a.id)) continue;
      for (let j = i + 1; j < remaining.length; j++) {
        const b = remaining[j]!;
        if (mergedIds.has(b.id)) continue;
        if (!a.city || !b.city) continue;
        const sameCity = cityFilterVariants(a.city).some((v) =>
          cityFilterVariants(b.city!).includes(v),
        );
        if (!sameCity) continue;
        if (nameSimilarity(a.name, b.name) < 0.88) continue;
        const keeper = this.pickKeeper([a, b]);
        const loser = keeper.id === a.id ? b : a;
        await this.mergeCompanyRecord(keeper.id, loser.id);
        mergedIds.add(loser.id);
        merged += 1;
        deleted += 1;
      }
    }

    return {
      scanned: all.length,
      nameNormalizedFixed,
      merged,
      deleted,
    };
  }

  private pickKeeper<
    T extends {
      id: string;
      googlePlaceId: string | null;
      website: string | null;
      email: string | null;
      phone: string | null;
      sourceQualityScore: number;
      createdAt: Date;
    },
  >(group: T[]): T {
    return [...group].sort((a, b) => {
      const score = (c: T) =>
        (c.googlePlaceId ? 8 : 0) +
        (c.website ? 4 : 0) +
        (c.email ? 2 : 0) +
        (c.phone ? 1 : 0) +
        c.sourceQualityScore / 100;
      const diff = score(b) - score(a);
      if (diff !== 0) return diff;
      return a.createdAt.getTime() - b.createdAt.getTime();
    })[0]!;
  }

  private async mergeCompanyRecord(keeperId: string, loserId: string) {
    const [keeper, loser] = await Promise.all([
      this.prisma.company.findUnique({ where: { id: keeperId } }),
      this.prisma.company.findUnique({ where: { id: loserId } }),
    ]);
    if (!keeper || !loser) return;

    const sourceReferences = Array.from(
      new Set([...(keeper.sourceReferences || []), ...(loser.sourceReferences || [])]),
    );

    const loserSources = await this.prisma.companySource.findMany({
      where: { companyId: loserId },
    });
    for (const src of loserSources) {
      await this.prisma.companySource.upsert({
        where: {
          companyId_sourceName: {
            companyId: keeperId,
            sourceName: src.sourceName,
          },
        },
        create: {
          companyId: keeperId,
          sourceName: src.sourceName,
          sourceUrl: src.sourceUrl,
          scrapedAt: src.scrapedAt,
        },
        update: {
          sourceUrl: src.sourceUrl || undefined,
        },
      });
    }

    // Clear loser's unique googlePlaceId before delete so keeper can inherit it
    if (!keeper.googlePlaceId && loser.googlePlaceId) {
      await this.prisma.company.update({
        where: { id: loserId },
        data: { googlePlaceId: null },
      });
    }

    await this.prisma.company.update({
      where: { id: keeperId },
      data: {
        registrationNumber: keeper.registrationNumber || loser.registrationNumber,
        industry: keeper.industry || loser.industry,
        city: keeper.city || loser.city,
        municipality: keeper.municipality || loser.municipality,
        address: keeper.address || loser.address,
        addressNormalized: keeper.addressNormalized || loser.addressNormalized,
        phone: keeper.phone || loser.phone,
        phoneNormalized: keeper.phoneNormalized || loser.phoneNormalized,
        email: keeper.email || loser.email,
        website: keeper.website || loser.website,
        websiteDomain: keeper.websiteDomain || loser.websiteDomain,
        hasWebsite: Boolean(keeper.website || loser.website),
        facebookUrl: keeper.facebookUrl || loser.facebookUrl,
        linkedinUrl: keeper.linkedinUrl || loser.linkedinUrl,
        instagramUrl: keeper.instagramUrl || loser.instagramUrl,
        googleMapsUrl: keeper.googleMapsUrl || loser.googleMapsUrl,
        googlePlaceId: keeper.googlePlaceId || loser.googlePlaceId,
        googleRating: keeper.googleRating ?? loser.googleRating,
        googleReviewsCount: keeper.googleReviewsCount ?? loser.googleReviewsCount,
        googleCategory: keeper.googleCategory || loser.googleCategory,
        googleBusinessStatus: keeper.googleBusinessStatus || loser.googleBusinessStatus,
        nameNormalized: normalizeName(keeper.name),
        sourceReferences,
        sourceQualityScore: Math.max(keeper.sourceQualityScore, loser.sourceQualityScore),
        latestLeadScore:
          keeper.latestLeadScore != null && loser.latestLeadScore != null
            ? Math.max(keeper.latestLeadScore, loser.latestLeadScore)
            : (keeper.latestLeadScore ?? loser.latestLeadScore),
      },
    });

    await this.prisma.company.delete({ where: { id: loserId } });
  }

  private async getSettingFlag(group: string, key: string): Promise<boolean> {
    const row = await this.prisma.appSetting.findUnique({ where: { key: group } });
    const value = row?.value as Record<string, unknown> | null;
    return Boolean(value?.[key]);
  }
}
