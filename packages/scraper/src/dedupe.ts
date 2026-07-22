import { companyNormalizer } from './normalizer';
import type { RawCompany } from '@leadhunter/shared';

export { normalizeAddress, addressSimilarity, CompanyNormalizer, companyNormalizer } from './normalizer';

/** @deprecated Prefer companyNormalizer.normalize / companyDedupe via CompanyNormalizer */
export function companyDedupeKey(company: RawCompany): string {
  const n = companyNormalizer.normalize(company);
  if (n.registrationNumber) return `reg:${n.registrationNumber}`;
  if (n.googlePlaceId) return `place:${n.googlePlaceId}`;
  if (n.website) return `domain:${n.website}`;
  if (n.phone) return `phone:${n.phone}`;
  if (n.email) return `email:${n.email}`;
  return `namecity:${n.name}|${(n.city || '').toLowerCase()}`;
}

export function normalizeRawCompany(raw: RawCompany): RawCompany {
  return companyNormalizer.normalize(raw);
}

export function dedupeRawCompanies(companies: RawCompany[]): {
  companies: RawCompany[];
  duplicatesRemoved: number;
} {
  return companyNormalizer.dedupe(companies);
}
