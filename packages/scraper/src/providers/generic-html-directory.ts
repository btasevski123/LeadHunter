import * as cheerio from 'cheerio';
import type { RawCompany } from '@leadhunter/shared';
import { BaseLeadProvider } from '../base-provider';
import type { ScrapeContext } from '../types';

export interface HtmlDirectorySelectors {
  listItem: string;
  name: string;
  industry?: string;
  city?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  detailLink?: string;
}

export interface GenericHtmlDirectoryOptions {
  id: string;
  name: string;
  industries: string[];
  baseUrl?: string;
  listPath?: string;
  selectors?: HtmlDirectorySelectors;
  enabled?: boolean;
  maxPages?: number;
}

const DEFAULT_SELECTORS: HtmlDirectorySelectors = {
  listItem: '.company-card, .listing-item, article.business',
  name: '.company-name, h2, h3, .title',
  industry: '.industry, .category',
  city: '.city, .location',
  address: '.address',
  phone: '.phone, a[href^="tel:"]',
  email: '.email, a[href^="mailto:"]',
  website: '.website a, a.website',
  detailLink: 'a.details, a.more, h2 a, h3 a',
};

/**
 * Configurable HTML directory scraper.
 * Enable via settings and provide baseUrl + CSS selectors for a public directory.
 */
export class GenericHtmlDirectoryProvider extends BaseLeadProvider {
  readonly id: string;
  readonly name: string;
  readonly industries: string[];
  private readonly baseUrl?: string;
  private readonly listPath: string;
  private readonly selectors: HtmlDirectorySelectors;
  readonly enabled: boolean;
  private readonly maxPages: number;

  constructor(options: GenericHtmlDirectoryOptions) {
    super();
    this.id = options.id;
    this.name = options.name;
    this.industries = options.industries;
    this.baseUrl = options.baseUrl;
    this.listPath = options.listPath ?? '/';
    this.selectors = { ...DEFAULT_SELECTORS, ...options.selectors };
    this.enabled = options.enabled ?? Boolean(options.baseUrl);
    this.maxPages = options.maxPages ?? 5;
  }

  async scrape(ctx: ScrapeContext): Promise<RawCompany[]> {
    if (!this.enabled || !this.baseUrl) {
      ctx.logger.warn('Generic HTML provider skipped — not configured', { id: this.id });
      return [];
    }

    const http = this.http(ctx);
    const throttle = this.throttle(ctx);
    const companies: RawCompany[] = [];

    for (let page = 1; page <= this.maxPages; page++) {
      if (ctx.signal.aborted) break;
      await throttle.wait();
      const url = this.buildPageUrl(page);
      ctx.logger.info('Fetching directory page', { url, page });
      try {
        const html = await http.get<string>(url);
        const batch = this.parseListPage(html, url);
        if (batch.length === 0) break;
        companies.push(...batch);
      } catch (err) {
        ctx.logger.error('Failed to fetch directory page', {
          url,
          error: err instanceof Error ? err.message : String(err),
        });
        break;
      }
    }

    return companies;
  }

  private buildPageUrl(page: number): string {
    const base = new URL(this.listPath, this.baseUrl);
    if (page > 1) base.searchParams.set('page', String(page));
    return base.toString();
  }

  private parseListPage(html: string, sourceUrl: string): RawCompany[] {
    const $ = cheerio.load(html);
    const out: RawCompany[] = [];

    $(this.selectors.listItem).each((_, el) => {
      const root = $(el);
      const name = text(root, this.selectors.name);
      if (!name) return;

      const emailHref = root.find(this.selectors.email || '').attr('href');
      const phoneHref = root.find(this.selectors.phone || '').attr('href');
      const websiteHref =
        root.find(this.selectors.website || '').attr('href') ||
        root.find('a[href^="http"]').not('[href*="facebook"],[href*="linkedin"]').first().attr('href');

      out.push({
        name,
        industry: this.selectors.industry ? text(root, this.selectors.industry) : null,
        city: this.selectors.city ? text(root, this.selectors.city) : null,
        address: this.selectors.address ? text(root, this.selectors.address) : null,
        phone: phoneHref?.replace(/^tel:/i, '') || (this.selectors.phone ? text(root, this.selectors.phone) : null),
        email: emailHref?.replace(/^mailto:/i, '') || (this.selectors.email ? text(root, this.selectors.email) : null),
        website: websiteHref || null,
        sourceUrl,
        sourceName: this.id,
      });
    });

    return out;
  }
}

function text(root: cheerio.Cheerio<any>, selector: string): string | null {
  const value = root.find(selector).first().text().replace(/\s+/g, ' ').trim();
  return value || null;
}
