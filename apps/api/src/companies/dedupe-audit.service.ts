import { Inject, Injectable } from '@nestjs/common';
import {
  addressSimilarity,
  canonicalizeCity,
  distinctiveNameTokens,
  extractDomain,
  isDedupableWebsiteDomain,
  matchCompanyIdentity,
  nameSimilarity,
  normalizeAddress,
  normalizeName,
  type MatchReason,
} from '@leadhunter/shared';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Read-only health check on the company table's deduplication state.
 *
 * Exists because two historical bugs left the data in an unknown state: the
 * scraper's in-batch matcher used to treat a shared website domain as proof of
 * identity (merging unrelated businesses that both listed a Facebook page), and
 * the database matcher's last-resort scan only ever examined the 80 most
 * recently updated companies in a city (missing duplicates once a city filled
 * up). This service quantifies the damage from both without changing anything.
 */

const AUDIT_SELECT = {
  id: true,
  name: true,
  nameNormalized: true,
  city: true,
  industry: true,
  address: true,
  addressNormalized: true,
  phone: true,
  phoneNormalized: true,
  email: true,
  website: true,
  websiteDomain: true,
  registrationNumber: true,
  googlePlaceId: true,
  sourceName: true,
  sourceReferences: true,
  latestLeadScore: true,
  createdAt: true,
} as const;

type AuditRow = {
  id: string;
  name: string;
  nameNormalized: string;
  city: string | null;
  industry: string | null;
  address: string | null;
  addressNormalized: string | null;
  phone: string | null;
  phoneNormalized: string | null;
  email: string | null;
  website: string | null;
  websiteDomain: string | null;
  registrationNumber: string | null;
  googlePlaceId: string | null;
  sourceName: string | null;
  sourceReferences: string[];
  latestLeadScore: number | null;
  createdAt: Date;
};

export interface GenericDomainGroup {
  domain: string;
  companies: number;
  /** Companies on this domain that carry more than one source reference. */
  multiSource: number;
  examples: Array<{ id: string; name: string; city: string | null; sources: string[] }>;
}

export interface BlendSuspect {
  id: string;
  name: string;
  city: string | null;
  websiteDomain: string | null;
  reason: string;
  contactEmailDomains: string[];
  contactPhones: string[];
}

export interface DuplicatePair {
  reason: MatchReason;
  score: number;
  a: { id: string; name: string; city: string | null; sourceName: string | null; score: number | null };
  b: { id: string; name: string; city: string | null; sourceName: string | null; score: number | null };
  /** Component scores, so a surprising match can be traced to the rule that fired. */
  signals: {
    nameScore: number;
    addressScore: number;
    sharedTokens: string[];
    addressA: string | null;
    addressB: string | null;
  };
}

export interface CityConsistency {
  /** Rows whose stored city is not the canonical form. */
  nonCanonical: number;
  /** Rows whose city value cannot be a city name at all. */
  invalid: number;
  distinctStoredValues: number;
  distinctCanonicalValues: number;
  rewrites: Array<{ from: string; to: string | null; companies: number }>;
}

export interface DedupeAuditReport {
  totalCompanies: number;
  genericDomains: {
    affectedCompanies: number;
    groups: GenericDomainGroup[];
  };
  blendSuspects: BlendSuspect[];
  cityConsistency: CityConsistency;
  missedDuplicates: {
    pairs: number;
    blocksCompared: number;
    pairsCompared: number;
    byReason: Record<string, number>;
    samples: DuplicatePair[];
  };
}

@Injectable()
export class DedupeAuditService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async run(options: { sampleSize?: number } = {}): Promise<DedupeAuditReport> {
    const sampleSize = options.sampleSize ?? 25;

    const companies = (await this.prisma.company.findMany({
      select: AUDIT_SELECT,
      orderBy: { createdAt: 'asc' },
    })) as AuditRow[];

    return {
      totalCompanies: companies.length,
      genericDomains: this.auditGenericDomains(companies, sampleSize),
      blendSuspects: await this.findBlendSuspects(companies, sampleSize),
      cityConsistency: this.auditCityConsistency(companies),
      missedDuplicates: this.findMissedDuplicates(companies, sampleSize),
    };
  }

  /**
   * How far the stored city values drift from canonical form. This matters
   * beyond tidiness: the matcher compares cities, so two spellings of one city
   * prevent duplicates in that city from ever being merged.
   */
  private auditCityConsistency(companies: AuditRow[]): CityConsistency {
    const stored = new Map<string, number>();
    const canonical = new Set<string>();
    let nonCanonical = 0;
    let invalid = 0;

    const rewrites = new Map<string, { to: string | null; companies: number }>();

    for (const company of companies) {
      if (!company.city) continue;
      stored.set(company.city, (stored.get(company.city) || 0) + 1);
      const folded = canonicalizeCity(company.city);
      if (folded) canonical.add(folded);
      if (folded === company.city) continue;

      nonCanonical += 1;
      if (!folded) invalid += 1;
      const entry = rewrites.get(company.city) || { to: folded, companies: 0 };
      entry.companies += 1;
      rewrites.set(company.city, entry);
    }

    return {
      nonCanonical,
      invalid,
      distinctStoredValues: stored.size,
      distinctCanonicalValues: canonical.size,
      rewrites: [...rewrites.entries()]
        .map(([from, entry]) => ({ from, to: entry.to, companies: entry.companies }))
        .sort((a, b) => b.companies - a.companies),
    };
  }

  /**
   * Companies whose stored website is a domain shared by many businesses. These
   * are the population that the old domain-only matcher could have merged
   * incorrectly — a company here with several source references is the most
   * likely to have absorbed a different business.
   */
  private auditGenericDomains(companies: AuditRow[], sampleSize: number) {
    const byDomain = new Map<string, AuditRow[]>();

    for (const company of companies) {
      const domain = company.websiteDomain || extractDomain(company.website);
      if (!domain || isDedupableWebsiteDomain(domain)) continue;
      const list = byDomain.get(domain) || [];
      list.push(company);
      byDomain.set(domain, list);
    }

    const groups: GenericDomainGroup[] = [...byDomain.entries()]
      .map(([domain, list]) => ({
        domain,
        companies: list.length,
        multiSource: list.filter((c) => (c.sourceReferences?.length ?? 0) > 1).length,
        examples: list.slice(0, sampleSize).map((c) => ({
          id: c.id,
          name: c.name,
          city: c.city,
          sources: c.sourceReferences ?? [],
        })),
      }))
      .sort((a, b) => b.companies - a.companies);

    return {
      affectedCompanies: groups.reduce((sum, g) => sum + g.companies, 0),
      groups,
    };
  }

  /**
   * Records that look like two businesses fused into one: a generic domain or
   * multiple source references, combined with discovered contacts pointing at
   * more than one mail domain or phone number.
   */
  private async findBlendSuspects(
    companies: AuditRow[],
    sampleSize: number,
  ): Promise<BlendSuspect[]> {
    const atRisk = companies.filter((c) => {
      const domain = c.websiteDomain || extractDomain(c.website);
      const genericDomain = domain ? !isDedupableWebsiteDomain(domain) : false;
      return genericDomain || (c.sourceReferences?.length ?? 0) > 1;
    });
    if (!atRisk.length) return [];

    const contacts = await this.prisma.contactCandidate.findMany({
      where: { companyId: { in: atRisk.map((c) => c.id) } },
      select: { companyId: true, type: true, value: true },
    });

    const byCompany = new Map<string, { emailDomains: Set<string>; phones: Set<string> }>();
    for (const contact of contacts) {
      const entry =
        byCompany.get(contact.companyId) ||
        { emailDomains: new Set<string>(), phones: new Set<string>() };
      if (contact.type === 'EMAIL') {
        const domain = contact.value.split('@')[1]?.toLowerCase();
        if (domain) entry.emailDomains.add(domain);
      } else if (contact.type === 'PHONE') {
        entry.phones.add(contact.value);
      }
      byCompany.set(contact.companyId, entry);
    }

    const suspects: BlendSuspect[] = [];
    for (const company of atRisk) {
      const entry = byCompany.get(company.id);
      if (!entry) continue;
      const reasons: string[] = [];
      if (entry.emailDomains.size > 1) {
        reasons.push(`${entry.emailDomains.size} distinct contact email domains`);
      }
      if (entry.phones.size > 2) {
        reasons.push(`${entry.phones.size} distinct contact phone numbers`);
      }
      if (!reasons.length) continue;
      suspects.push({
        id: company.id,
        name: company.name,
        city: company.city,
        websiteDomain: company.websiteDomain,
        reason: reasons.join('; '),
        contactEmailDomains: [...entry.emailDomains],
        contactPhones: [...entry.phones],
      });
    }

    return suspects
      .sort((a, b) => b.contactEmailDomains.length - a.contactEmailDomains.length)
      .slice(0, sampleSize);
  }

  /**
   * Pairs of separate rows that the current matcher considers the same company.
   *
   * Uses blocking rather than an all-pairs scan: two companies can only match on
   * a strong signal (registration number, place id, domain, phone) or on a name
   * or address heuristic, and every one of those requires either an exact shared
   * value or a shared distinctive name token. Grouping on those keys first keeps
   * this linear-ish instead of quadratic.
   */
  private findMissedDuplicates(companies: AuditRow[], sampleSize: number) {
    const blocks = new Map<string, AuditRow[]>();
    const addToBlock = (key: string, row: AuditRow) => {
      const list = blocks.get(key) || [];
      list.push(row);
      blocks.set(key, list);
    };

    for (const company of companies) {
      if (company.registrationNumber) addToBlock(`reg:${company.registrationNumber}`, company);
      if (company.googlePlaceId) addToBlock(`place:${company.googlePlaceId}`, company);

      const domain = company.websiteDomain || extractDomain(company.website);
      if (domain && isDedupableWebsiteDomain(domain)) addToBlock(`domain:${domain}`, company);

      if (company.phoneNormalized) addToBlock(`phone:${company.phoneNormalized}`, company);
      if (company.email) addToBlock(`email:${company.email.toLowerCase()}`, company);

      // Name/address heuristics are city-scoped, so block on city + each
      // distinctive token rather than on the whole name.
      const city = (canonicalizeCity(company.city) || company.city || '').toLowerCase();
      for (const token of distinctiveNameTokens(company.name)) {
        addToBlock(`city:${city}|token:${token}`, company);
      }

      // Names built entirely from generic words ("Studio B - Print & Design")
      // yield no distinctive tokens, so block on the whole folded name too —
      // otherwise two identical names would never even be compared.
      const foldedName = normalizeName(company.name);
      if (foldedName) addToBlock(`city:${city}|name:${foldedName}`, company);
    }

    const seenPairs = new Set<string>();
    const pairs: DuplicatePair[] = [];
    const byReason: Record<string, number> = {};
    let blocksCompared = 0;
    let pairsCompared = 0;

    for (const block of blocks.values()) {
      if (block.length < 2) continue;
      blocksCompared += 1;
      for (let i = 0; i < block.length; i += 1) {
        for (let j = i + 1; j < block.length; j += 1) {
          const a = block[i]!;
          const b = block[j]!;
          const pairKey = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
          if (seenPairs.has(pairKey)) continue;
          seenPairs.add(pairKey);
          pairsCompared += 1;

          const result = matchCompanyIdentity(a, b);
          if (!result.matched || !result.reason) continue;

          byReason[result.reason] = (byReason[result.reason] || 0) + 1;
          const tokensA = distinctiveNameTokens(a.name);
          const tokensB = distinctiveNameTokens(b.name);
          pairs.push({
            reason: result.reason,
            score: result.score,
            a: {
              id: a.id,
              name: a.name,
              city: a.city,
              sourceName: a.sourceName,
              score: a.latestLeadScore,
            },
            b: {
              id: b.id,
              name: b.name,
              city: b.city,
              sourceName: b.sourceName,
              score: b.latestLeadScore,
            },
            signals: {
              nameScore: nameSimilarity(a.name, b.name),
              addressScore: addressSimilarity(a.address, b.address),
              sharedTokens: [...tokensA].filter((t) => tokensB.has(t)),
              addressA: normalizeAddress(a.address),
              addressB: normalizeAddress(b.address),
            },
          });
        }
      }
    }

    pairs.sort((x, y) => y.score - x.score);

    return {
      pairs: pairs.length,
      blocksCompared,
      pairsCompared,
      byReason,
      samples: pairs.slice(0, sampleSize),
    };
  }
}

/** Human-readable rendering of the audit report for CLI output. */
export function formatDedupeAuditReport(report: DedupeAuditReport): string {
  const lines: string[] = [];
  const pct = (n: number) =>
    report.totalCompanies ? `${((n / report.totalCompanies) * 100).toFixed(1)}%` : '0%';

  lines.push('');
  lines.push('Dedupe audit (read-only — nothing was modified)');
  lines.push('='.repeat(60));
  lines.push(`Companies in database: ${report.totalCompanies}`);

  lines.push('');
  lines.push('1. Generic-domain exposure');
  lines.push('-'.repeat(60));
  if (!report.genericDomains.affectedCompanies) {
    lines.push('None. No company stores a website on a shared/generic domain.');
  } else {
    lines.push(
      `${report.genericDomains.affectedCompanies} companies (${pct(
        report.genericDomains.affectedCompanies,
      )}) store a generic domain as their website.`,
    );
    lines.push('These were the records at risk from the old domain-only matcher.');
    lines.push('');
    for (const group of report.genericDomains.groups) {
      lines.push(
        `  ${group.domain}: ${group.companies} companies (${group.multiSource} with multiple sources)`,
      );
      for (const example of group.examples.slice(0, 5)) {
        const sources = example.sources.length ? example.sources.join(', ') : 'unknown';
        lines.push(`      - ${example.name} [${example.city || 'no city'}] via ${sources}`);
      }
    }
  }

  lines.push('');
  lines.push('2. Blend suspects (possibly two businesses fused into one row)');
  lines.push('-'.repeat(60));
  if (!report.blendSuspects.length) {
    lines.push('None found.');
  } else {
    lines.push(`${report.blendSuspects.length} suspicious records:`);
    for (const suspect of report.blendSuspects) {
      lines.push(`  - ${suspect.name} [${suspect.city || 'no city'}] (${suspect.id})`);
      lines.push(`      ${suspect.reason}`);
      if (suspect.contactEmailDomains.length) {
        lines.push(`      email domains: ${suspect.contactEmailDomains.join(', ')}`);
      }
    }
  }

  lines.push('');
  lines.push('3. City consistency');
  lines.push('-'.repeat(60));
  const city = report.cityConsistency;
  lines.push(
    `${city.distinctStoredValues} distinct city values stored, ` +
      `${city.distinctCanonicalValues} after canonicalization.`,
  );
  if (!city.nonCanonical) {
    lines.push('All city values are already canonical.');
  } else {
    lines.push(
      `${city.nonCanonical} companies (${pct(city.nonCanonical)}) hold a non-canonical city` +
        `${city.invalid ? `, of which ${city.invalid} are not city names at all` : ''}.`,
    );
    lines.push('Duplicates cannot merge across two spellings of one city.');
    lines.push('');
    for (const rewrite of city.rewrites) {
      lines.push(
        `  "${rewrite.from}" -> ${rewrite.to ? `"${rewrite.to}"` : '(cleared)'}` +
          ` — ${rewrite.companies} companies`,
      );
    }
    lines.push('');
    lines.push('  Run `npm run normalize` to apply these rewrites.');
  }

  lines.push('');
  lines.push('4. Missed duplicates (separate rows the current matcher would merge)');
  lines.push('-'.repeat(60));
  lines.push(
    `Compared ${report.missedDuplicates.pairsCompared} candidate pairs across ` +
      `${report.missedDuplicates.blocksCompared} blocks.`,
  );
  if (!report.missedDuplicates.pairs) {
    lines.push('No missed duplicates found.');
  } else {
    lines.push(`Found ${report.missedDuplicates.pairs} duplicate pairs.`);
    lines.push('');
    lines.push('  By match reason:');
    for (const [reason, count] of Object.entries(report.missedDuplicates.byReason).sort(
      (a, b) => b[1] - a[1],
    )) {
      lines.push(`    ${reason}: ${count}`);
    }
    lines.push('');
    lines.push(`  Highest-confidence examples (showing ${report.missedDuplicates.samples.length}):`);
    for (const pair of report.missedDuplicates.samples) {
      lines.push(
        `    [${pair.reason} ${pair.score.toFixed(2)}] "${pair.a.name}" (${pair.a.sourceName || '?'})` +
          ` <-> "${pair.b.name}" (${pair.b.sourceName || '?'})` +
          ` in ${pair.a.city || pair.b.city || 'unknown city'}`,
      );
      lines.push(
        `        name=${pair.signals.nameScore.toFixed(2)} addr=${pair.signals.addressScore.toFixed(2)}` +
          ` shared=[${pair.signals.sharedTokens.join(',') || 'none'}]`,
      );
      if (pair.signals.addressScore > 0) {
        lines.push(`        addrA="${pair.signals.addressA}"`);
        lines.push(`        addrB="${pair.signals.addressB}"`);
      }
    }
    lines.push('');
    lines.push('  Review these before merging — `npm run dedupe` is destructive.');
  }

  lines.push('');
  return lines.join('\n');
}
