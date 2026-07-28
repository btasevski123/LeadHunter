import * as cheerio from 'cheerio';
import {
  COMPANY_SOURCES,
  Industry,
  type RawCompany,
} from '@leadhunter/shared';
import { BaseLeadProvider } from '../base-provider';
import type { ScrapeContext } from '../types';
import {
  industryLabels,
  matchesCityFilter,
  maxCompanies,
  resolveIndustryFilter,
  resolveTargetCity,
  searchTermsFor,
  shouldStop,
} from '../provider-utils';

const BASE = 'https://www.companywall.com.mk';

/**
 * CompanyWall (companywall.com.mk) — Macedonian company registry front-end.
 * List pages expose name + address; contact details are often gated.
 */
export class CompanyWallProvider extends BaseLeadProvider {
  readonly id = 'companywall';
  readonly name = 'CompanyWall';
  readonly industries = Object.values(Industry);
  enabled = true;

  getCategories(): string[] {
    return industryLabels(this.industries as Industry[]);
  }

  async scrape(ctx: ScrapeContext): Promise<RawCompany[]> {
    const industries = resolveIndustryFilter(ctx.config);
    const terms = searchTermsFor(industries);
    const targetCity = resolveTargetCity(ctx.config);
    const http = this.http(ctx);
    const throttle = this.throttle(ctx);
    const results: RawCompany[] = [];
    const seen = new Set<string>();
    const limit = maxCompanies(ctx, 250);
    const maxPagesPerTerm = Number(ctx.config.maxPagesPerTerm || 3);

    const searchTerms = targetCity
      ? terms.flatMap((t) => [`${t} ${targetCity}`, t])
      : terms;

    for (const term of searchTerms) {
      if (shouldStop(ctx, results.length)) break;

      for (let page = 1; page <= maxPagesPerTerm; page++) {
        if (shouldStop(ctx, results.length)) break;
        await throttle.wait();

        const url = `${BASE}/prebaruvanje?SearchTerm=${encodeURIComponent(term)}&p=${page}`;
        ctx.logger.info('CompanyWall page', { term, page, url, targetCity });

        let html: string;
        try {
          html = await http.get<string>(url);
        } catch (err) {
          ctx.logger.warn('CompanyWall page failed', {
            term,
            page,
            error: err instanceof Error ? err.message : String(err),
          });
          break;
        }

        const pageCompanies = this.parseListPage(html, industries[0] || Industry.SERVICES);
        if (pageCompanies.length === 0) break;

        for (const company of pageCompanies) {
          if (
            targetCity &&
            !matchesCityFilter(company.city, company.address, targetCity)
          ) {
            continue;
          }
          const key = company.sourceUrl || company.name;
          if (seen.has(key)) continue;
          seen.add(key);
          results.push(company);
          if (results.length >= limit) break;
        }
      }
    }

    // Optionally enrich a subset from detail pages (polite, capped).
    const enrichLimit = Math.min(results.length, Number(ctx.config.enrichDetailLimit || 15));
    for (let i = 0; i < enrichLimit; i++) {
      if (ctx.signal.aborted) break;
      const company = results[i]!;
      if (!company.sourceUrl) continue;
      await throttle.wait();
      try {
        const detailHtml = await http.get<string>(company.sourceUrl);
        Object.assign(company, this.parseDetailPage(detailHtml, company));
      } catch {
        // ignore detail failures
      }
    }

    return results.slice(0, limit);
  }

  private parseListPage(html: string, industry: Industry): RawCompany[] {
    const $ = cheerio.load(html);
    const companies: RawCompany[] = [];

    $('h3 a[href*="/kompanija/"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const name = $(el).text().replace(/\s+/g, ' ').trim();
      if (!name || !href) return;

      const sourceUrl = href.startsWith('http') ? href : `${BASE}${href}`;
      const card = $(el).closest('.row, .col, article, li, div').parent();
      const blockText = card.text().replace(/\s+/g, ' ').trim();
      const address = this.extractAddressNear(blockText, name);
      const { city, municipality } = this.splitCityMunicipality(address || blockText);

      const idMatch = href.match(/\/([^/]+)\/?$/);
      companies.push({
        name,
        industry,
        address: address || null,
        city,
        municipality,
        sourceUrl,
        sourceName: COMPANY_SOURCES.COMPANY_WALL,
        registrationNumber: idMatch?.[1] && /^MM/i.test(idMatch[1]) ? null : null,
      });
    });

    return companies;
  }

  private parseDetailPage(html: string, base: RawCompany): Partial<RawCompany> {
    const $ = cheerio.load(html);
    const text = $('body').text().replace(/\s+/g, ' ');

    const phoneMatch = text.match(/Телефон[^\d]{0,20}([\d/\-\s]{6,20})/i);
    const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    const edbMatch = text.match(/ЕДБ\s*(\d{10,15})/i);
    const addressMatch = text.match(/Адреса[^\w]{0,20}(.{10,120}?)(?:Република|,|$)/i);

    const website =
      $('a[href^="http"]')
        .filter((_, el) => {
          const href = $(el).attr('href') || '';
          return (
            !href.includes('companywall') &&
            !href.includes('facebook') &&
            !href.includes('linkedin') &&
            /\.(mk|com|net|eu)(\/|$)/i.test(href)
          );
        })
        .first()
        .attr('href') || null;

    return {
      phone: phoneMatch?.[1]?.trim() || base.phone,
      email: emailMatch?.[1]?.trim() || base.email,
      address: addressMatch?.[1]?.trim() || base.address,
      registrationNumber: edbMatch?.[1] || base.registrationNumber,
      website: website || base.website,
    };
  }

  private extractAddressNear(text: string, name: string): string | null {
    const withoutName = text.replace(name, '').trim();
    if (withoutName.length < 8) return null;
    return withoutName.slice(0, 160);
  }

  private splitCityMunicipality(text: string): { city: string | null; municipality: string | null } {
    const cities = [
      'Скопје',
      'Битола',
      'Куманово',
      'Прилеп',
      'Тетово',
      'Велес',
      'Штип',
      'Охрид',
      'Гостивар',
      'Струмица',
      'Кавадарци',
      'Кочани',
      'Кичево',
      'Струга',
      'Илинден',
      'Петровец',
    ];
    for (const city of cities) {
      if (text.includes(city)) {
        return { city, municipality: city === 'Скопје' ? null : city };
      }
    }
    // Latin fallbacks
    const latin = ['Skopje', 'Bitola', 'Ohrid', 'Tetovo', 'Prilep'];
    for (const city of latin) {
      if (new RegExp(city, 'i').test(text)) return { city, municipality: null };
    }
    return { city: null, municipality: null };
  }
}
