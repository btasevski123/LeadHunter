import {
  canonicalizeCity,
  matchCompanyIdentity,
  normalizeEmail,
  normalizeRegistrationNumber,
  normalizeUrl,
  type CompanyIdentity,
  type MatchResult,
  type RawCompany,
} from '@leadhunter/shared';

export {
  addressSimilarity,
  normalizeAddress,
  significantTokenOverlap,
  type CompanyIdentity,
  type MatchReason,
  type MatchResult,
} from '@leadhunter/shared';

/** @deprecated Use `CompanyIdentity` from `@leadhunter/shared`. */
export type MatchCandidate = CompanyIdentity;

export function preferCanonicalName(a: string, b: string): string {
  // Prefer legal-form heavy names (DOO/DOOEL) when merging Google short names
  const legal = /\b(dooel|doo|дооел|доо|ад)\b/i;
  if (legal.test(a) && !legal.test(b)) return a;
  if (legal.test(b) && !legal.test(a)) return b;
  // Prefer longer informative name
  return a.length >= b.length ? a : b;
}

/**
 * Company normalization for raw scraped records. Identity matching itself is
 * delegated to `matchCompanyIdentity` in `@leadhunter/shared` so the in-batch
 * dedupe here and the database upsert in the API apply identical rules.
 */
export class CompanyNormalizer {
  normalize(raw: RawCompany): RawCompany {
    return {
      ...raw,
      name: raw.name.trim(),
      registrationNumber: normalizeRegistrationNumber(raw.registrationNumber),
      website: normalizeUrl(raw.website),
      email: normalizeEmail(raw.email),
      phone: raw.phone?.trim() || null,
      address: raw.address?.trim() || null,
      city: canonicalizeCity(raw.city),
      facebookUrl: normalizeUrl(raw.facebookUrl),
      linkedinUrl: normalizeUrl(raw.linkedinUrl),
      instagramUrl: normalizeUrl(raw.instagramUrl),
      googleMapsUrl: normalizeUrl(raw.googleMapsUrl) ?? raw.googleMapsUrl ?? null,
      sourceUrl: normalizeUrl(raw.sourceUrl) ?? raw.sourceUrl ?? null,
      googlePlaceId: raw.googlePlaceId?.trim() || null,
    };
  }

  match(a: CompanyIdentity, b: CompanyIdentity): MatchResult {
    return matchCompanyIdentity(a, b);
  }

  merge(a: RawCompany, b: RawCompany): RawCompany {
    return {
      name: preferCanonicalName(a.name || '', b.name || ''),
      registrationNumber: a.registrationNumber || b.registrationNumber,
      industry: a.industry || b.industry,
      city: a.city || b.city,
      municipality: a.municipality || b.municipality,
      address: (a.address?.length || 0) >= (b.address?.length || 0) ? a.address : b.address,
      phone: a.phone || b.phone,
      email: a.email || b.email,
      website: a.website || b.website,
      facebookUrl: a.facebookUrl || b.facebookUrl,
      linkedinUrl: a.linkedinUrl || b.linkedinUrl,
      instagramUrl: a.instagramUrl || b.instagramUrl,
      googleMapsUrl: a.googleMapsUrl || b.googleMapsUrl,
      googlePlaceId: a.googlePlaceId || b.googlePlaceId,
      googleRating: a.googleRating ?? b.googleRating,
      googleReviewsCount: a.googleReviewsCount ?? b.googleReviewsCount,
      googleCategory: a.googleCategory || b.googleCategory,
      googleBusinessStatus: a.googleBusinessStatus || b.googleBusinessStatus,
      googleOpeningHours: a.googleOpeningHours || b.googleOpeningHours,
      googlePhotos: a.googlePhotos || b.googlePhotos,
      sourceUrl: a.sourceUrl || b.sourceUrl,
      sourceName: a.sourceName || b.sourceName,
      category: a.category || b.category,
    };
  }

  dedupe(companies: RawCompany[]): { companies: RawCompany[]; duplicatesRemoved: number } {
    const list: RawCompany[] = [];
    let duplicatesRemoved = 0;

    for (const raw of companies) {
      const normalized = this.normalize(raw);
      if (!normalized.name) continue;

      const idx = list.findIndex((c) => this.match(c, normalized).matched);
      if (idx >= 0) {
        list[idx] = this.merge(list[idx]!, normalized);
        duplicatesRemoved += 1;
      } else {
        list.push(normalized);
      }
    }

    return { companies: list, duplicatesRemoved };
  }
}

export const companyNormalizer = new CompanyNormalizer();
