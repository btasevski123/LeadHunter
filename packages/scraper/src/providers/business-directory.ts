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
  maxCompanies,
  resolveIndustryFilter,
  shouldStop,
} from '../provider-utils';
import { YELLOW_PAGES_CATEGORIES } from './yellow-pages';
import { loadMkCities } from '../industries';

/**
 * Broad business directory discovery across targeted MK categories.
 * Complements YellowPagesProvider with city-scoped category crawls for scale.
 */
export class BusinessDirectoryProvider extends BaseLeadProvider {
  readonly id = 'business-directory';
  readonly name = 'BusinessDirectory';
  readonly industries = Object.values(Industry);
  enabled = true;

  getCategories(): string[] {
    return Object.values(INDUSTRY_LABELS);
  }

  async scrape(ctx: ScrapeContext): Promise<RawCompany[]> {
    const industries = new Set(resolveIndustryFilter(ctx.config));
    const categories = YELLOW_PAGES_CATEGORIES.filter((c) => industries.has(c.industry));
    const http = this.http(ctx);
    const throttle = this.throttle(ctx);
    const results: RawCompany[] = [];
    const seen = new Set<string>();
    const limit = maxCompanies(ctx, 5000);
    const base = 'https://yellowpages.com.mk';
    const cityFilter =
      typeof ctx.config.city === 'string' ? ctx.config.city.trim() : '';

    for (const category of categories.length ? categories : YELLOW_PAGES_CATEGORIES) {
      if (shouldStop(ctx, results.length)) break;
      await throttle.wait();

      const url = `${base}/kategorija/${encodeURIComponent(category.slug)}`;
      ctx.logger.info('Business directory category', { category: category.label, url });

      let html: string;
      try {
        html = await http.get<string>(url);
      } catch (err) {
        ctx.logger.warn('Business directory fetch failed', {
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

        const city = cells[3] || null;
        if (cityFilter && city && !city.toLowerCase().includes(cityFilter.toLowerCase())) {
          return;
        }

        const rowHtml = $.html(row);
        const firmaMatch = rowHtml.match(/\/firma\/(\d+)\/([^"'\\\s]+)/);
        const sourceUrl = firmaMatch
          ? `${base}/firma/${firmaMatch[1]}/${firmaMatch[2]}`
          : null;
        const key = sourceUrl || `${name}|${cells[1] || ''}`;
        if (seen.has(key)) return;
        seen.add(key);

        const websiteRaw = cells[5] || null;
        results.push({
          name,
          industry: category.industry,
          category: category.label,
          phone: cells[1] || null,
          address: cells[2] || null,
          city,
          email: cells[4]?.includes('@') ? cells[4] : null,
          website: websiteRaw?.startsWith('www.') ? `https://${websiteRaw}` : websiteRaw,
          sourceUrl,
          sourceName: COMPANY_SOURCES.BUSINESS_DIRECTORY,
        });
      });
    }

    // Soft cap awareness for city list size (future city-page expansion)
    void loadMkCities;

    return results.slice(0, limit);
  }
}
