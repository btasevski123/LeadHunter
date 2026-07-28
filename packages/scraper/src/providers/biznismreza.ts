import {
  COMPANY_SOURCES,
  Industry,
  MK_CANONICAL_CITIES,
  findCityInText,
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

const SMART_SEARCH = 'https://biznismreza.mk/Marketing/Default.aspx/SmartSearch';

interface SmartSearchHit {
  id: number;
  name: string;
}

/**
 * Biznis Mreza (biznismreza.mk) — company name + EMBS via public SmartSearch API.
 * Full contact profiles are behind login; we store registration numbers for dedupe.
 */
export class BiznisMrezaProvider extends BaseLeadProvider {
  readonly id = 'biznismreza';
  readonly name = 'BiznisMreza';
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

    const searchTerms = targetCity
      ? terms.flatMap((t) => [`${t} ${targetCity}`, t])
      : terms;

    for (const term of searchTerms) {
      if (shouldStop(ctx, results.length)) break;
      if (term.length < 3) continue;
      await throttle.wait();

      ctx.logger.info('BiznisMreza search', { term, targetCity });
      try {
        const payload = await http.post<{ d: string }>(
          SMART_SEARCH,
          { keyword: term },
          {
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              'X-Requested-With': 'XMLHttpRequest',
              Referer: 'https://biznismreza.mk/',
            },
          },
        );

        const hits = this.parseHits(payload?.d);
        const industry = industries[0] || Industry.SERVICES;

        for (const hit of hits) {
          if (hit.id === 999999) continue; // search echo
          const key = String(hit.id);
          if (seen.has(key)) continue;
          seen.add(key);

          const { city, cleanName } = this.splitNameCity(hit.name);
          if (targetCity && !matchesCityFilter(city, hit.name, targetCity)) {
            continue;
          }
          results.push({
            name: cleanName,
            registrationNumber: String(hit.id),
            industry,
            city,
            sourceName: COMPANY_SOURCES.BIZNIS_MREZA,
            sourceUrl: `https://biznismreza.mk/Marketing/Default.aspx?companyId=${hit.id}`,
          });

          if (results.length >= limit) break;
        }
      } catch (err) {
        ctx.logger.warn('BiznisMreza search failed', {
          term,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return results.slice(0, limit);
  }

  private parseHits(raw?: string): SmartSearchHit[] {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as SmartSearchHit[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private splitNameCity(name: string): { cleanName: string; city: string | null } {
    const found = findCityInText(name);
    if (found) {
      return {
        cleanName: name.replace(new RegExp(`\\s*${found}\\s*$`), '').trim() || name,
        city: found,
      };
    }
    for (const city of MK_CANONICAL_CITIES) {
      if (name.includes(city)) {
        return {
          cleanName: name.replace(new RegExp(`\\s*${city}\\s*$`), '').trim() || name,
          city,
        };
      }
    }
    return { cleanName: name.trim(), city: null };
  }
}
