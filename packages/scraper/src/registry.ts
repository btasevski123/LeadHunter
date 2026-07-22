import { IndustryCatalogProvider } from './providers/industry-catalog';
import { MockMkDirectoryProvider } from './providers/mock-mk-directory';
import { GenericHtmlDirectoryProvider } from './providers/generic-html-directory';
import { CompanyWallProvider } from './providers/companywall';
import { BiznisMrezaProvider } from './providers/biznismreza';
import { YellowPagesProvider } from './providers/yellow-pages';
import { GoogleBusinessProvider } from './providers/google-business';
import { IndustryDirectoryProvider } from './providers/industry-directory';
import { GoogleMapsProvider } from './providers/google-maps';
import { CentralRegistryProvider } from './providers/central-registry';
import { BusinessDirectoryProvider } from './providers/business-directory';
import type { LeadProvider } from './types';

const builtIn: LeadProvider[] = [
  new GoogleMapsProvider(),
  new CompanyWallProvider(),
  new CentralRegistryProvider(),
  new YellowPagesProvider(),
  new BusinessDirectoryProvider(),
  new BiznisMrezaProvider(),
  new GoogleBusinessProvider(),
  new IndustryDirectoryProvider(),
  // Legacy / optional providers — disabled by default
  Object.assign(new MockMkDirectoryProvider(), { enabled: false }),
  Object.assign(new IndustryCatalogProvider(), { enabled: false }),
  new GenericHtmlDirectoryProvider({
    id: 'generic-html-directory',
    name: 'Generic HTML Directory',
    industries: ['Services'],
    enabled: false,
  }),
];

const DEFAULT_REAL_IDS = [
  'google-maps',
  'companywall',
  'yellow-pages',
  'business-directory',
  'biznismreza',
  'google-business',
  'industry-directory',
];

export function listProviders(): LeadProvider[] {
  return [...builtIn];
}

export function getProvider(id: string): LeadProvider | undefined {
  return builtIn.find((p) => p.id === id);
}

export function resolveProviders(enabledIds?: string[]): LeadProvider[] {
  const ids = enabledIds?.length ? enabledIds : DEFAULT_REAL_IDS;
  const selected = ids
    .map((id) => getProvider(id))
    .filter((p): p is LeadProvider => p != null && p.enabled !== false);

  if (selected.length === 0) {
    return DEFAULT_REAL_IDS.map((id) => getProvider(id)).filter(
      (p): p is LeadProvider => Boolean(p),
    );
  }
  return selected;
}

export function registerProvider(provider: LeadProvider): void {
  const idx = builtIn.findIndex((p) => p.id === provider.id);
  if (idx >= 0) builtIn[idx] = provider;
  else builtIn.push(provider);
}

export { DEFAULT_REAL_IDS };
