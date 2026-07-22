import {
  extractDomain,
  nameSimilarity,
  normalizeEmail,
  normalizeName,
  normalizePhoneMk,
  normalizeRegistrationNumber,
  normalizeUrl,
  type RawCompany,
} from '@leadhunter/shared';

/** Normalize free-text MK addresses for fuzzy matching. */
export function normalizeAddress(input?: string | null): string | null {
  if (!input) return null;
  const value = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(ul\.?|ulica|бул\.?|bulevar|бр\.?|br\.?|no\.?|number)\b/gi, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return value || null;
}

export function addressSimilarity(a?: string | null, b?: string | null): number {
  const na = normalizeAddress(a);
  const nb = normalizeAddress(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const ta = new Set(na.split(' ').filter((t) => t.length > 1));
  const tb = new Set(nb.split(' ').filter((t) => t.length > 1));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  const jaccard = inter / (ta.size + tb.size - inter);

  // Boost when street numbers match
  const numsA: string[] = na.match(/\d+/g) || [];
  const numsB: string[] = nb.match(/\d+/g) || [];
  const numHit = numsA.some((n) => numsB.includes(n));
  return Math.min(1, jaccard + (numHit ? 0.25 : 0));
}

function significantTokenOverlap(a: string, b: string): boolean {
  const stop = new Set(['doo', 'dooel', 'ltd', 'llc', 'mk', 'skopje', 'bitola']);
  const ta = new Set(
    normalizeName(a)
      .split(' ')
      .filter((t) => t.length >= 3 && !stop.has(t)),
  );
  const tb = new Set(
    normalizeName(b)
      .split(' ')
      .filter((t) => t.length >= 3 && !stop.has(t)),
  );
  for (const t of ta) if (tb.has(t)) return true;
  return false;
}

export function preferCanonicalName(a: string, b: string): string {
  // Prefer legal-form heavy names (DOO/DOOEL) when merging Google short names
  const legal = /\b(dooel|doo|дооел|доо|ад)\b/i;
  if (legal.test(a) && !legal.test(b)) return a;
  if (legal.test(b) && !legal.test(a)) return b;
  // Prefer longer informative name
  return a.length >= b.length ? a : b;
}

export interface MatchCandidate {
  id?: string;
  name: string;
  registrationNumber?: string | null;
  website?: string | null;
  websiteDomain?: string | null;
  phone?: string | null;
  phoneNormalized?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  googlePlaceId?: string | null;
}

export type MatchReason =
  | 'registrationNumber'
  | 'googlePlaceId'
  | 'websiteDomain'
  | 'phone'
  | 'email'
  | 'address'
  | 'name';

export interface MatchResult {
  matched: boolean;
  reason?: MatchReason;
  score: number;
}

/**
 * Central company normalization + cross-source identity matching.
 * Priority: registration → place id → domain → phone → email → address → name.
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
      facebookUrl: normalizeUrl(raw.facebookUrl),
      linkedinUrl: normalizeUrl(raw.linkedinUrl),
      instagramUrl: normalizeUrl(raw.instagramUrl),
      googleMapsUrl: normalizeUrl(raw.googleMapsUrl) ?? raw.googleMapsUrl ?? null,
      sourceUrl: normalizeUrl(raw.sourceUrl) ?? raw.sourceUrl ?? null,
      googlePlaceId: raw.googlePlaceId?.trim() || null,
    };
  }

  match(a: MatchCandidate, b: MatchCandidate): MatchResult {
    const regA = normalizeRegistrationNumber(a.registrationNumber);
    const regB = normalizeRegistrationNumber(b.registrationNumber);
    if (regA && regB && regA === regB) {
      return { matched: true, reason: 'registrationNumber', score: 1 };
    }

    if (a.googlePlaceId && b.googlePlaceId && a.googlePlaceId === b.googlePlaceId) {
      return { matched: true, reason: 'googlePlaceId', score: 1 };
    }

    const domainA = a.websiteDomain || extractDomain(a.website);
    const domainB = b.websiteDomain || extractDomain(b.website);
    if (domainA && domainB && domainA === domainB) {
      return { matched: true, reason: 'websiteDomain', score: 0.98 };
    }

    const phoneA = a.phoneNormalized || normalizePhoneMk(a.phone);
    const phoneB = b.phoneNormalized || normalizePhoneMk(b.phone);
    if (phoneA && phoneB && phoneA === phoneB) {
      return { matched: true, reason: 'phone', score: 0.95 };
    }

    const emailA = normalizeEmail(a.email);
    const emailB = normalizeEmail(b.email);
    if (emailA && emailB && emailA === emailB) {
      return { matched: true, reason: 'email', score: 0.95 };
    }

    const addrScore = addressSimilarity(a.address, b.address);
    const nameScore = nameSimilarity(a.name, b.name);
    const citiesOk =
      !a.city || !b.city || a.city.trim().toLowerCase() === b.city.trim().toLowerCase();
    const tokenOverlap = significantTokenOverlap(a.name, b.name);

    if (addrScore >= 0.55 && tokenOverlap && citiesOk) {
      return { matched: true, reason: 'address', score: Math.max(addrScore, nameScore) };
    }

    if (addrScore >= 0.72 && nameScore >= 0.45 && citiesOk) {
      return { matched: true, reason: 'address', score: addrScore };
    }

    if (nameScore >= 0.86 && citiesOk) {
      return { matched: true, reason: 'name', score: nameScore };
    }

    // Shared distinctive token (e.g. ABC DOOEL ↔ ABC Printing) in same city
    if (tokenOverlap && citiesOk && nameScore >= 0.35) {
      return { matched: true, reason: 'name', score: Math.max(nameScore, 0.7) };
    }

    return { matched: false, score: Math.max(addrScore, nameScore) };
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
