import { dedupeRawCompanies } from './dedupe';
import type { OrchestratorOptions, OrchestratorResult } from './types';

export class ScraperOrchestrator {
  constructor(private readonly options: OrchestratorOptions) {}

  async run(): Promise<OrchestratorResult[]> {
    const results: OrchestratorResult[] = [];
    const signal = this.options.signal ?? new AbortController().signal;

    for (const provider of this.options.providers) {
      if (signal.aborted) break;
      if (provider.enabled === false) {
        this.options.logger.info('Provider disabled, skipping', { providerId: provider.id });
        continue;
      }

      const result: OrchestratorResult = {
        providerId: provider.id,
        providerName: provider.name,
        scraped: 0,
        created: 0,
        updated: 0,
        duplicatesRemoved: 0,
        errors: [],
      };

      this.options.logger.info('Starting provider scrape', {
        providerId: provider.id,
        name: provider.name,
      });

      try {
        const raw = await provider.scrape({
          logger: this.options.logger,
          signal,
          config: this.options.config,
        });
        const { companies, duplicatesRemoved } = dedupeRawCompanies(raw);
        result.scraped = companies.length;
        result.duplicatesRemoved = duplicatesRemoved;
        this.options.onProgress?.(0, companies.length);

        for (let i = 0; i < companies.length; i++) {
          if (signal.aborted) break;
          const company = companies[i]!;
          try {
            const persisted = await this.options.persist({
              ...company,
              sourceName: company.sourceName || provider.id,
            });
            if (persisted.created) result.created += 1;
            else result.updated += 1;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            result.errors.push(`${company.name}: ${msg}`);
            this.options.logger.error('Failed to persist company', {
              name: company.name,
              error: msg,
            });
          }
          this.options.onProgress?.(i + 1, companies.length);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(msg);
        this.options.logger.error('Provider scrape failed', {
          providerId: provider.id,
          error: msg,
        });
      }

      results.push(result);
      this.options.logger.info('Provider scrape finished', result as unknown as Record<string, unknown>);
    }

    return results;
  }
}
