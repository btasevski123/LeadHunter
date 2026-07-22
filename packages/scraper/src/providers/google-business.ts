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
  searchTermsFor,
  shouldStop,
} from '../provider-utils';

const DDG = 'https://html.duckduckgo.com/html/';

const SKIP_HOSTS = [
  'yellowpages.com.mk',
  'companywall.com.mk',
  'biznismreza.mk',
  'zk.mk',
  'facebook.com',
  'instagram.com',
  'linkedin.com',
  'youtube.com',
  'wikipedia.org',
  'duckduckgo.com',
];

/**
 * Google / web discovery via DuckDuckGo HTML (no API key required).
 * Optional: set GOOGLE_PLACES_API_KEY later for Places enrichment.
 */
export class GoogleBusinessProvider extends BaseLeadProvider {
  readonly id = 'google-business';
  readonly name = 'GoogleBusiness';
  readonly industries = Object.values(Industry);
  enabled = true;

  getCategories(): string[] {
    return Object.values(INDUSTRY_LABELS);
  }

  async scrape(ctx: ScrapeContext): Promise<RawCompany[]> {
    const industries = resolveIndustryFilter(ctx.config);
    const terms = searchTermsFor(industries);
    const http = this.http(ctx);
    const throttle = this.throttle(ctx);
    const results: RawCompany[] = [];
    const seen = new Set<string>();
    const limit = maxCompanies(ctx, 120);

    const queries = terms.map((t) => `${t} Македонија`);

    for (let i = 0; i < queries.length; i++) {
      if (shouldStop(ctx, results.length)) break;
      const query = queries[i]!;
      const industry = industries[Math.min(i, industries.length - 1)] || Industry.SERVICES;
      await throttle.wait();

      ctx.logger.info('Google discovery query', { query });
      try {
        const html = await http.post<string>(
          DDG,
          new URLSearchParams({ q: query }).toString(),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              Referer: 'https://html.duckduckgo.com/',
            },
          },
        );

        const hits = this.parseDdg(html);
        for (const hit of hits) {
          if (seen.has(hit.website!)) continue;
          seen.add(hit.website!);
          results.push({
            ...hit,
            industry,
            category: INDUSTRY_LABELS[industry],
            sourceName: COMPANY_SOURCES.GOOGLE_DISCOVERY,
          });
          if (results.length >= limit) break;
        }
      } catch (err) {
        ctx.logger.warn('Google discovery query failed', {
          query,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return results.slice(0, limit);
  }

  private parseDdg(html: string): RawCompany[] {
    const $ = cheerio.load(html);
    const companies: RawCompany[] = [];

    $('a.result__a').each((_, el) => {
      const title = $(el).text().replace(/\s+/g, ' ').trim();
      const href = $(el).attr('href') || '';
      const destination = unwrapDdgUrl(href);
      if (!destination || !title) return;
      if (shouldSkipHost(destination)) return;

      let host: string;
      try {
        host = new URL(destination).hostname.replace(/^www\./, '');
      } catch {
        return;
      }

      // Prefer Macedonian / regional business sites
      if (!/\.(mk|com\.mk|net\.mk|org\.mk)$/i.test(host) && !destination.includes('.mk/')) {
        if (!/\.mk$/i.test(host)) return;
      }

      const name = cleanTitle(title);
      companies.push({
        name,
        website: destination,
        sourceUrl: destination,
        googleMapsUrl: null,
      });
    });

    return companies;
  }
}

function unwrapDdgUrl(href: string): string | null {
  try {
    if (href.startsWith('//')) href = `https:${href}`;
    const url = new URL(href, 'https://duckduckgo.com');
    const uddg = url.searchParams.get('uddg');
    if (uddg) return decodeURIComponent(uddg);
    if (url.hostname.includes('duckduckgo')) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function shouldSkipHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    return SKIP_HOSTS.some((s) => host === s || host.endsWith(`.${s}`));
  } catch {
    return true;
  }
}

function cleanTitle(title: string): string {
  return title
    .split('|')[0]!
    .split('—')[0]!
    .split('-')[0]!
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}
