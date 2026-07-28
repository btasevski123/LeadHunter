import * as cheerio from 'cheerio';
import {
  COMPANY_SOURCES,
  Industry,
  canonicalizeCity,
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

const BASE = 'https://yellowpages.com.mk';

/** Yellow Pages category slug → Industry */
export const YELLOW_PAGES_CATEGORIES: { slug: string; label: string; industry: Industry }[] = [
  { slug: 'ГРАФИЧКА_ДЕЈНОСТ-ПЕЧАТЕЊЕ-ДИЗАЈН', label: 'Печатење / дизајн', industry: Industry.PRINTING },
  { slug: 'ПРОИЗВОДСТВО', label: 'Производство', industry: Industry.MANUFACTURING },
  { slug: 'ФАБРИКИ', label: 'Фабрики', industry: Industry.FACTORIES },
  { slug: 'ГРАДЕЖНИШТВО', label: 'Градежништво', industry: Industry.CONSTRUCTION },
  { slug: 'МЕБЕЛ', label: 'Мебел', industry: Industry.FURNITURE },
  { slug: 'МЕТАЛНА_ИНДУСТРИЈА', label: 'Метална индустрија', industry: Industry.METAL_INDUSTRY },
  { slug: 'АВТО_СЕРВИСИ', label: 'Авто сервиси', industry: Industry.AUTOMOTIVE },
  { slug: 'СТОМАТОЛОГИЈА', label: 'Стоматологија', industry: Industry.DENTAL },
  { slug: 'ЗДРАВСТВО', label: 'Здравство / ПЗУ', industry: Industry.HEALTHCARE },
  { slug: 'ПРИВАТНИ_ЗДРАВСТВЕНИ_УСТАНОВИ', label: 'ПЗУ', industry: Industry.HEALTHCARE },
  { slug: 'АДВОКАТИ', label: 'Адвокати', industry: Industry.LEGAL },
  { slug: 'СМЕТКОВОДСТВO', label: 'Сметководство', industry: Industry.ACCOUNTING },
  { slug: 'СМЕТКОВОДСТВО', label: 'Сметководство', industry: Industry.ACCOUNTING },
  { slug: 'ХОТЕЛИ', label: 'Хотели', industry: Industry.LODGING },
  { slug: 'РЕСТОРАНИ', label: 'Ресторани', industry: Industry.FOOD_BEVERAGE },
  { slug: 'КАФЕАНИ', label: 'Кафеани', industry: Industry.FOOD_BEVERAGE },
  { slug: 'ФИТНЕС', label: 'Фитнес', industry: Industry.FITNESS },
  { slug: 'ТЕРЕТАНИ', label: 'Теретани', industry: Industry.FITNESS },
  { slug: 'ТУРИЗАМ', label: 'Туризам', industry: Industry.TOURISM },
  { slug: 'ТРГОВИЈА', label: 'Трговија', industry: Industry.RETAIL },
];

/**
 * Yellow Pages Macedonia — strongest public local business directory.
 */
export class YellowPagesProvider extends BaseLeadProvider {
  readonly id = 'yellow-pages';
  readonly name = 'YellowPages';
  readonly industries = Object.values(Industry);
  enabled = true;

  getCategories(): string[] {
    return YELLOW_PAGES_CATEGORIES.map((c) => c.label);
  }

  async scrape(ctx: ScrapeContext): Promise<RawCompany[]> {
    const industries = new Set(resolveIndustryFilter(ctx.config));
    const targetCity = resolveTargetCity(ctx.config);
    const categories = YELLOW_PAGES_CATEGORIES.filter((c) => industries.has(c.industry));
    const http = this.http(ctx);
    const throttle = this.throttle(ctx);
    const results: RawCompany[] = [];
    const seen = new Set<string>();
    const limit = maxCompanies(ctx, 800);

    const targets = categories.length ? categories : YELLOW_PAGES_CATEGORIES;

    for (const category of targets) {
      if (shouldStop(ctx, results.length)) break;
      await throttle.wait();

      const url = `${BASE}/kategorija/${encodeURIComponent(category.slug)}`;
      ctx.logger.info('Yellow Pages category', { category: category.label, url, targetCity });

      let html: string;
      try {
        html = await http.get<string>(url);
      } catch (err) {
        ctx.logger.warn('Yellow Pages category failed', {
          category: category.slug,
          error: err instanceof Error ? err.message : String(err),
        });
        continue;
      }

      const companies = this.parseCategoryTable(html, category.industry, category.label);
      for (const company of companies) {
        if (
          targetCity &&
          !matchesCityFilter(company.city, company.address, targetCity)
        ) {
          continue;
        }
        const key =
          company.sourceUrl ||
          `${company.name}|${company.phone || ''}|${company.city || ''}`.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        results.push(company);
        if (results.length >= limit) break;
      }
    }

    return results.slice(0, limit);
  }

  private parseCategoryTable(
    html: string,
    industry: Industry,
    categoryLabel: string,
  ): RawCompany[] {
    const $ = cheerio.load(html);
    const companies: RawCompany[] = [];
    const firmaLinks = [...html.matchAll(/\/firma\/(\d+)\/([^"'\\\s<>]+)/g)].map((m) => ({
      id: m[1]!,
      slug: m[2]!,
      url: `${BASE}/firma/${m[1]}/${m[2]}`,
    }));

    const table = $('#table-data2').length ? $('#table-data2') : $('table.display').first();
    table.find('tbody tr').each((rowIndex, row) => {
      const cells = $(row)
        .find('td')
        .map((__, td) => $(td).text().replace(/\s+/g, ' ').trim())
        .get();
      if (cells.length < 4) return;

      const name = cells[0];
      if (!name || name.length < 2) return;

      const phone = cells[1] || null;
      const address = cells[2] || null;
      const city = cells[3] || null;
      const email = cells[4] && cells[4].includes('@') ? cells[4] : null;
      const websiteRaw = cells[5] || null;
      const activity = cells[6] || categoryLabel;

      const rowHtml = $.html(row);
      const firmaMatch = rowHtml.match(/\/firma\/(\d+)\/([^"'\\\s]+)/);
      let sourceUrl: string | null = firmaMatch
        ? `${BASE}/firma/${firmaMatch[1]}/${firmaMatch[2]}`
        : null;
      if (!sourceUrl && firmaLinks[rowIndex]) {
        sourceUrl = firmaLinks[rowIndex]!.url;
      }

      companies.push({
        name,
        industry,
        category: activity,
        address,
        city: city ? titleCaseCity(city) : null,
        phone,
        email,
        website: cleanWebsite(websiteRaw),
        sourceUrl,
        sourceName: COMPANY_SOURCES.YELLOW_PAGES,
      });
    });

    return companies;
  }
}

function cleanWebsite(raw?: string | null): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value || value === '-' || value.toLowerCase() === 'n/a') return null;
  if (value.startsWith('www.')) return `https://${value}`;
  return value;
}

function titleCaseCity(city: string): string {
  return canonicalizeCity(city) || city;
}

