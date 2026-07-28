import {
  Industry,
  INDUSTRY_LABELS,
  canonicalizeCity,
  cityFilterVariants,
  findCityInText,
  parseIndustry,
  type Industry as IndustryType,
} from '@leadhunter/shared';
import type { ProviderConfig, ScrapeContext } from './types';
import { keywordsForIndustries, resolveIndustriesFromConfig } from './industries';

export function resolveIndustryFilter(config: ProviderConfig): IndustryType[] {
  const fromConfig = config.industries?.filter(Boolean) as IndustryType[] | undefined;
  return resolveIndustriesFromConfig(
    typeof config.industry === 'string' ? config.industry : null,
    fromConfig,
  );
}

export function industryLabels(industries: IndustryType[]): string[] {
  return industries.map((i) => INDUSTRY_LABELS[i] || String(i));
}

export function searchTermsFor(industries: IndustryType[]): string[] {
  const fromFile = keywordsForIndustries(industries);
  if (fromFile.length) return fromFile;
  // Fallback if config missing
  return industries.map((i) => INDUSTRY_LABELS[i] || String(i));
}

export function maxCompanies(ctx: ScrapeContext, fallback = 200): number {
  return Number(ctx.config.maxCompaniesPerProvider || fallback);
}

export function shouldStop(ctx: ScrapeContext, collected: number): boolean {
  return ctx.signal.aborted || collected >= maxCompanies(ctx);
}

export function resolveCity(config: ProviderConfig): string | undefined {
  return typeof config.city === 'string' && config.city.trim()
    ? config.city.trim()
    : undefined;
}

/** Canonical target city for scrapers (null = nationwide). */
export function resolveTargetCity(config: ProviderConfig): string | null {
  const raw = resolveCity(config);
  if (!raw) return null;
  return canonicalizeCity(raw) || raw;
}

/** True if place belongs to the requested city (Cyrillic/Latin aliases). */
export function matchesCityFilter(
  placeCity: string | null | undefined,
  address: string | null | undefined,
  targetCity: string,
): boolean {
  const variants = cityFilterVariants(targetCity).map((v) => v.toLowerCase());
  const variantSet = new Set(variants);

  if (placeCity) {
    const canonical = canonicalizeCity(placeCity);
    if (canonical && variantSet.has(canonical.toLowerCase())) return true;
    if (variantSet.has(placeCity.toLowerCase())) return true;
  }

  if (address) {
    const fromAddress = findCityInText(address);
    if (fromAddress && variantSet.has(fromAddress.toLowerCase())) return true;
    const lower = address.toLowerCase();
    if (variants.some((v) => lower.includes(v))) return true;
  }

  return false;
}

export { Industry, parseIndustry };
