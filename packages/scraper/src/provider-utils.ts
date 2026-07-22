import {
  Industry,
  INDUSTRY_LABELS,
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

export { Industry, parseIndustry };
