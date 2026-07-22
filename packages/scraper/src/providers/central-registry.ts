import { COMPANY_SOURCES, Industry, type RawCompany } from '@leadhunter/shared';
import { BaseLeadProvider } from '../base-provider';
import type { ScrapeContext } from '../types';

/**
 * Placeholder for official Central Registry (Централен регистар) access.
 *
 * Does NOT scrape illegally. Enable when you have:
 * - official API credentials
 * - licensed bulk export
 * - purchased/authorized datasets
 *
 * Set CENTRAL_REGISTRY_DATASET_PATH to a JSON/JSONL file of authorized records.
 */
export class CentralRegistryProvider extends BaseLeadProvider {
  readonly id = 'central-registry';
  readonly name = 'CentralRegistry';
  readonly industries = Object.values(Industry);
  enabled = true;

  getCategories(): string[] {
    return ['Official registry (licensed/API)'];
  }

  async scrape(ctx: ScrapeContext): Promise<RawCompany[]> {
    const datasetPath =
      (typeof ctx.config.centralRegistryDatasetPath === 'string'
        ? ctx.config.centralRegistryDatasetPath
        : undefined) || process.env.CENTRAL_REGISTRY_DATASET_PATH;

    if (!datasetPath) {
      ctx.logger.info(
        'CentralRegistryProvider idle — set CENTRAL_REGISTRY_DATASET_PATH or official API credentials to ingest licensed data',
      );
      return [];
    }

    try {
      const { readFileSync } = await import('node:fs');
      const raw = readFileSync(datasetPath, 'utf8');
      const rows = datasetPath.endsWith('.jsonl')
        ? raw
            .split('\n')
            .filter(Boolean)
            .map((line) => JSON.parse(line) as Record<string, unknown>)
        : (JSON.parse(raw) as Record<string, unknown>[]);

      return rows
        .map((row) => this.mapRow(row))
        .filter((c): c is RawCompany => Boolean(c?.name));
    } catch (err) {
      ctx.logger.error('Central registry dataset load failed', {
        datasetPath,
        error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
  }

  private mapRow(row: Record<string, unknown>): RawCompany | null {
    const name = String(
      row.companyName || row.name || row.назив || row.CompanyName || '',
    ).trim();
    if (!name) return null;

    return {
      name,
      registrationNumber: String(
        row.registrationNumber || row.embs || row.ЕМБС || row.edb || '',
      ) || null,
      industry: (row.activityCode || row.industry || null) as string | null,
      address: (row.address || row.адреса || null) as string | null,
      municipality: (row.municipality || row.општина || null) as string | null,
      city: (row.city || row.град || null) as string | null,
      category: (row.legalForm || row.activityCode || null) as string | null,
      sourceName: COMPANY_SOURCES.CENTRAL_REGISTRY,
      sourceUrl: (row.sourceUrl as string) || null,
    };
  }
}
