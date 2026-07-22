import type { Industry, RawCompany } from '@leadhunter/shared';

export interface Logger {
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
  debug(msg: string, meta?: Record<string, unknown>): void;
}

export interface ProviderConfig {
  requestDelayMs: number;
  maxRetries: number;
  timeoutMs: number;
  userAgent: string;
  maxCompaniesPerProvider?: number;
  industries?: Industry[];
  industry?: string;
  city?: string;
  googlePlacesApiKey?: string;
  centralRegistryDatasetPath?: string;
  [key: string]: unknown;
}

export interface ScrapeContext {
  logger: Logger;
  signal: AbortSignal;
  config: ProviderConfig;
}

/**
 * Canonical provider interface for Macedonian company discovery sources.
 * Alias: CompanyProvider (product terminology).
 */
export interface LeadProvider {
  readonly id: string;
  readonly name: string;
  readonly industries: string[];
  scrape(ctx: ScrapeContext): Promise<RawCompany[]>;
  getCategories?(): string[];
  enabled?: boolean;
}

export type CompanyProvider = LeadProvider;

export interface PersistCompanyFn {
  (company: RawCompany): Promise<{ created: boolean; id: string; duplicate?: boolean }>;
}

export interface OrchestratorOptions {
  providers: LeadProvider[];
  config: ProviderConfig;
  logger: Logger;
  persist: PersistCompanyFn;
  signal?: AbortSignal;
  onProgress?: (processed: number, totalHint: number) => void;
}

export interface OrchestratorResult {
  providerId: string;
  providerName: string;
  scraped: number;
  created: number;
  updated: number;
  duplicatesRemoved: number;
  errors: string[];
}
