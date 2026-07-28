import * as cheerio from 'cheerio';
import {
  COMPANY_SOURCES,
  Industry,
  INDUSTRY_LABELS,
  type RawCompany,
} from '@leadhunter/shared';
import { BaseLeadProvider } from '../base-provider';
import type { ScrapeContext } from '../types';
import {
  matchesCityFilter,
  maxCompanies,
  resolveIndustryFilter,
  resolveTargetCity,
  shouldStop,
} from '../provider-utils';
import { YELLOW_PAGES_CATEGORIES } from './yellow-pages';

/**
 * Industry-focused directory provider.
 * Targets production / professional industry category pages for denser industry coverage.
 */
export class IndustryDirectoryProvider extends BaseLeadProvider {
  readonly id = 'industry-directory';
  readonly name = 'IndustryDirectory';
  readonly industries = [
    Industry.PRINTING,
    Industry.MANUFACTURING,
    Industry.FACTORIES,
    Industry.CONSTRUCTION,
    Industry.FURNITURE,
    Industry.METAL_INDUSTRY,
    Industry.AUTOMOTIVE,
  ];
  enabled = true;

  getCategories(): string[] {
    return this.industries.map((i) => INDUSTRY_LABELS[i]);
  }

  async scrape(ctx: ScrapeContext): Promise<RawCompany[]> {
    const wanted = new Set(resolveIndustryFilter(ctx.config));
    const targetCity = resolveTargetCity(ctx.config);
    const categories = YELLOW_PAGES_CATEGORIES.filter(
      (c) => this.industries.includes(c.industry) && wanted.has(c.industry),
    );
    const http = this.http(ctx);
    const throttle = this.throttle(ctx);
    const results: RawCompany[] = [];
    const seen = new Set<string>();
    const limit = maxCompanies(ctx, 400);
    const base = 'https://yellowpages.com.mk';

    for (const category of categories) {
      if (shouldStop(ctx, results.length)) break;
      await throttle.wait();
      const url = `${base}/kategorija/${encodeURIComponent(category.slug)}`;
      ctx.logger.info('Industry directory category', { category: category.label, url });

      let html: string;
      try {
        html = await http.get<string>(url);
      } catch (err) {
        ctx.logger.warn('Industry directory category failed', {
          category: category.slug,
          error: err instanceof Error ? err.message : String(err),
        });
        continue;
      }

      const $ = cheerio.load(html);
      $('#table-data2 tbody tr, table.display tbody tr').each((_, row) => {
        const cells = $(row)
          .find('td')
          .map((__, td) => $(td).text().replace(/\s+/g, ' ').trim())
          .get();
        if (cells.length < 4) return;
        const name = cells[0];
        if (!name) return;

        const rowHtml = $.html(row);
        const firmaMatch = rowHtml.match(/\/firma\/(\d+)\/([^"'\\\s]+)/);
        const sourceUrl = firmaMatch
          ? `${base}/firma/${firmaMatch[1]}/${firmaMatch[2]}`
          : null;
        const key = sourceUrl || `${name}|${cells[1] || ''}`;
        if (seen.has(key)) return;
        seen.add(key);

        const websiteRaw = cells[5] || null;
        const city = cells[3] || null;
        const address = cells[2] || null;
        if (targetCity && !matchesCityFilter(city, address, targetCity)) return;

        results.push({
          name,
          industry: category.industry,
          category: category.label,
          phone: cells[1] || null,
          address,
          city,
          email: cells[4]?.includes('@') ? cells[4] : null,
          website: websiteRaw?.startsWith('www.') ? `https://${websiteRaw}` : websiteRaw,
          sourceUrl,
          sourceName: COMPANY_SOURCES.INDUSTRY_DIRECTORY,
        });
      });
    }

    return results.slice(0, limit);
  }
}
