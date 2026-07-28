import {
  COMPANY_SOURCES,
  Industry,
  INDUSTRY_LABELS,
  canonicalizeCity,
  citySearchTerms,
  findCityInText,
  type RawCompany,
} from '@leadhunter/shared';
import { BaseLeadProvider } from '../../base-provider';
import type { ScrapeContext } from '../../types';
import {
  matchesCityFilter,
  maxCompanies,
  resolveIndustryFilter,
  shouldStop,
} from '../../provider-utils';
import {
  industryFromKeyword,
  keywordsForIndustries,
  loadIndustries,
  loadMkCities,
} from '../../industries';
import { cityGeo } from './city-geo';
import {
  CITY_SWEEP_PLACE_TYPES,
  industryFromPlaceType,
  placeTypesForIndustries,
} from './place-types';

const PLACES_SEARCH = 'https://places.googleapis.com/v1/places:searchText';
const PLACES_NEARBY = 'https://places.googleapis.com/v1/places:searchNearby';
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.websiteUri',
  'places.googleMapsUri',
  'places.rating',
  'places.userRatingCount',
  'places.primaryTypeDisplayName',
  'places.primaryType',
  'places.businessStatus',
  'places.regularOpeningHours',
  'places.photos',
  'places.addressComponents',
  'places.location',
  'nextPageToken',
].join(',');

interface PlacesTextResult {
  places?: PlaceRow[];
  nextPageToken?: string;
}

interface PlaceRow {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  rating?: number;
  userRatingCount?: number;
  primaryTypeDisplayName?: { text?: string };
  primaryType?: string;
  businessStatus?: string;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  photos?: Array<{ name?: string }>;
  addressComponents?: Array<{ longText?: string; types?: string[] }>;
  location?: { latitude?: number; longitude?: number };
}

/**
 * Google Maps / Places discovery for North Macedonia businesses.
 *
 * City-scoped mode (recommended): exhausts Maps coverage for one town via
 *  1) bilingual keyword × city text search (no national flood)
 *  2) Nearby Search by Google place types around city center
 *  3) strict post-filter so only places in the target city are kept
 *
 * Without city: broader national keyword search (legacy / volume mode).
 */
export class GoogleMapsProvider extends BaseLeadProvider {
  readonly id = 'google-maps';
  readonly name = 'GoogleMaps';
  readonly industries = Object.values(Industry);
  enabled = true;

  getCategories(): string[] {
    return Object.values(INDUSTRY_LABELS);
  }

  async scrape(ctx: ScrapeContext): Promise<RawCompany[]> {
    const industries = resolveIndustryFilter(ctx.config).filter(
      (i) => i !== Industry.HOSPITALITY,
    );
    const targetCity =
      typeof ctx.config.city === 'string' && ctx.config.city.trim()
        ? canonicalizeCity(ctx.config.city.trim()) || ctx.config.city.trim()
        : null;
    const cityScoped = Boolean(targetCity);
    // Multi-industry city scrape: compact keywords (Nearby does the heavy lifting)
    const multiIndustry = cityScoped && industries.length > 1;
    const keywords = multiIndustry
      ? this.compactKeywords(industries)
      : keywordsForIndustries(industries);
    const cities = this.resolveCities(ctx, targetCity, multiIndustry);
    const limit = maxCompanies(ctx, 2000);
    const apiKey =
      process.env.GOOGLE_PLACES_API_KEY ||
      process.env.GOOGLE_MAPS_API_KEY ||
      (typeof ctx.config.googlePlacesApiKey === 'string'
        ? ctx.config.googlePlacesApiKey
        : undefined);

    const queries = this.buildQueries(
      keywords,
      cities,
      industries,
      cityScoped,
      multiIndustry,
    );
    ctx.logger.info('Google Maps discovery starting', {
      queries: queries.length,
      industries: industries.length,
      multiIndustry,
      targetCity,
      mode: apiKey ? 'places-api' : 'nominatim-fallback',
      limit,
    });

    if (apiKey) {
      return this.scrapePlacesApi(
        ctx,
        queries,
        industries,
        apiKey,
        limit,
        targetCity,
        multiIndustry,
      );
    }

    ctx.logger.warn(
      'GOOGLE_PLACES_API_KEY not set — using OpenStreetMap Nominatim fallback for MK discovery',
    );
    return this.scrapeNominatim(ctx, queries, industries, limit, targetCity);
  }

  /** One primary MK keyword per industry — used for fast multi-industry city sweeps. */
  private compactKeywords(industries: Industry[]): string[] {
    const wanted = new Set(industries.map(String));
    const terms: string[] = [];
    for (const cfg of loadIndustries()) {
      if (!wanted.has(cfg.id) || cfg.id === 'HOSPITALITY') continue;
      const primary =
        cfg.keywords.find((k) => /[\u0400-\u04FF]/.test(k)) || cfg.keywords[0];
      if (primary) terms.push(primary);
    }
    return terms;
  }

  private resolveCities(
    ctx: ScrapeContext,
    targetCity: string | null,
    multiIndustry = false,
  ): string[] {
    if (targetCity) {
      // Multi-industry: one city spelling is enough (Nearby + compact keywords)
      if (multiIndustry) return [targetCity];
      return citySearchTerms(targetCity);
    }
    const all = loadMkCities();
    const industries = resolveIndustryFilter(ctx.config);
    const base = industries.length === 1 ? all : all.slice(0, 8);
    return Array.from(new Set(base.flatMap((c) => citySearchTerms(c))));
  }

  /**
   * When city is set: ONLY city-scoped queries (national floods drowned Resen before).
   * Multi-industry city: skip includedType text fan-out (Nearby covers types).
   * Single industry city: full bilingual + type-anchored text search.
   */
  private buildQueries(
    keywords: string[],
    cities: string[],
    industries: Industry[],
    cityScoped: boolean,
    multiIndustry: boolean,
  ): Array<{ query: string; industry: Industry; includedType?: string }> {
    const out: Array<{ query: string; industry: Industry; includedType?: string }> = [];
    const industryList = industries.length ? industries : [Industry.SERVICES];

    for (let i = 0; i < keywords.length; i++) {
      const kw = keywords[i]!;
      const industry =
        industryFromKeyword(kw) ||
        industryList[Math.min(i, industryList.length - 1)] ||
        Industry.SERVICES;

      if (cityScoped) {
        for (const city of cities) {
          out.push({ query: `${kw} ${city}`, industry });
        }
      } else {
        for (const country of ['Македонија', 'Macedonia', 'Makedonija']) {
          out.push({ query: `${kw} ${country}`, industry });
        }
        for (const city of cities) {
          out.push({ query: `${kw} ${city}`, industry });
        }
      }
    }

    // Type-anchored text only for focused single-industry city scrapes
    if (cityScoped && !multiIndustry) {
      const types = placeTypesForIndustries(industryList);
      const primaryCity = cities[0];
      if (primaryCity) {
        for (const type of types) {
          const industry =
            industryList.find((ind) =>
              placeTypesForIndustries([ind]).includes(type),
            ) || industryList[0]!;
          out.push({ query: primaryCity, industry, includedType: type });
          for (const alias of cities.slice(1)) {
            out.push({ query: alias, industry, includedType: type });
          }
        }
      }
    }

    const seen = new Set<string>();
    return out.filter((q) => {
      const key = `${q.query}|${q.includedType || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private async scrapePlacesApi(
    ctx: ScrapeContext,
    queries: Array<{ query: string; industry: Industry; includedType?: string }>,
    industries: Industry[],
    apiKey: string,
    limit: number,
    targetCity: string | null,
    multiIndustry = false,
  ): Promise<RawCompany[]> {
    const http = this.http(ctx);
    const throttle = this.throttle(ctx);
    const results: RawCompany[] = [];
    const seenPlaces = new Set<string>();

    const pushPlace = (place: PlaceRow, industry: Industry) => {
      if (shouldStop(ctx, results.length) || results.length >= limit) return false;
      const placeId = place.id || null;
      if (placeId && seenPlaces.has(placeId)) return true;
      if (placeId) seenPlaces.add(placeId);

      const name = place.displayName?.text?.trim();
      if (!name) return true;

      const city =
        canonicalizeCity(this.cityFromComponents(place.addressComponents)) ||
        findCityInText(place.formattedAddress);

      if (targetCity && !matchesCityFilter(city, place.formattedAddress, targetCity)) {
        return true;
      }

      const resolvedIndustry = industryFromPlaceType(place.primaryType, industry);
      results.push(this.toRawCompany(place, resolvedIndustry, city));
      return true;
    };

    const runNearby = async () => {
      if (!targetCity || results.length >= limit) return;
      const geo = cityGeo(targetCity);
      if (!geo) return;
      const types =
        industries.length > 0
          ? placeTypesForIndustries(industries)
          : CITY_SWEEP_PLACE_TYPES;

      for (let i = 0; i < types.length; i += 5) {
        if (shouldStop(ctx, results.length) || results.length >= limit) break;
        const batch = types.slice(i, i + 5);
        await throttle.wait();
        ctx.logger.info('Places nearby search', { targetCity, types: batch });

        try {
          const data = await http.post<{ places?: PlaceRow[] }>(
            PLACES_NEARBY,
            {
              includedTypes: batch,
              maxResultCount: 20,
              languageCode: 'mk',
              regionCode: 'MK',
              locationRestriction: {
                circle: {
                  center: { latitude: geo.lat, longitude: geo.lng },
                  radius: geo.radiusM,
                },
              },
            },
            {
              headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': FIELD_MASK.replace(',nextPageToken', ''),
              },
            },
          );

          const fallbackIndustry =
            industries.find((ind) =>
              batch.some((t) => placeTypesForIndustries([ind]).includes(t)),
            ) ||
            industries[0] ||
            Industry.SERVICES;

          for (const place of data.places || []) {
            if (!pushPlace(place, fallbackIndustry)) break;
          }
        } catch (err) {
          ctx.logger.warn('Places nearby failed', {
            types: batch,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    };

    // Multi-industry city: Nearby first (fast broad coverage), then compact text queries
    if (multiIndustry) {
      await runNearby();
    }

    const maxPages = multiIndustry ? 1 : targetCity ? 4 : 3;

    for (const { query, industry, includedType } of queries) {
      if (shouldStop(ctx, results.length) || results.length >= limit) break;
      let pageToken: string | undefined;

      for (let page = 0; page < maxPages; page++) {
        if (shouldStop(ctx, results.length) || results.length >= limit) break;
        await throttle.wait();
        ctx.logger.info('Places text search', { query, includedType, page, targetCity });

        try {
          const body: Record<string, unknown> = {
            textQuery: query,
            languageCode: 'mk',
            regionCode: 'MK',
            pageSize: 20,
          };
          if (includedType) body.includedType = includedType;
          if (pageToken) body.pageToken = pageToken;

          const geo = targetCity ? cityGeo(targetCity) : null;
          if (geo) {
            body.locationBias = {
              circle: {
                center: { latitude: geo.lat, longitude: geo.lng },
                radius: geo.radiusM,
              },
            };
          }

          const data = await http.post<PlacesTextResult>(PLACES_SEARCH, body, {
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': apiKey,
              'X-Goog-FieldMask': FIELD_MASK,
            },
          });

          for (const place of data.places || []) {
            if (!pushPlace(place, industry)) break;
          }

          pageToken = data.nextPageToken;
          if (!pageToken) break;
        } catch (err) {
          ctx.logger.warn('Places search failed', {
            query,
            includedType,
            error: err instanceof Error ? err.message : String(err),
          });
          break;
        }
      }
    }

    // Single-industry city: Nearby after text (fills type gaps keywords miss)
    if (!multiIndustry) {
      await runNearby();
    }

    ctx.logger.info('Google Maps discovery finished', {
      targetCity,
      multiIndustry,
      kept: results.length,
      seenUnique: seenPlaces.size,
    });

    return results.slice(0, limit);
  }

  private toRawCompany(
    place: PlaceRow,
    industry: Industry,
    city: string | null,
  ): RawCompany {
    const placeId = place.id || null;
    return {
      name: place.displayName?.text?.trim() || '',
      industry,
      category: place.primaryTypeDisplayName?.text || INDUSTRY_LABELS[industry],
      address: place.formattedAddress || null,
      city,
      phone: place.nationalPhoneNumber || place.internationalPhoneNumber || null,
      website: place.websiteUri || null,
      googlePlaceId: placeId,
      googleMapsUrl:
        place.googleMapsUri ||
        (placeId ? `https://www.google.com/maps/place/?q=place_id:${placeId}` : null),
      googleRating: place.rating ?? null,
      googleReviewsCount: place.userRatingCount ?? null,
      googleCategory: place.primaryTypeDisplayName?.text || place.primaryType || null,
      googleBusinessStatus: place.businessStatus || null,
      googleOpeningHours: place.regularOpeningHours?.weekdayDescriptions || null,
      googlePhotos: (place.photos || [])
        .slice(0, 5)
        .map((p) => p.name)
        .filter(Boolean) as string[],
      sourceName: COMPANY_SOURCES.GOOGLE_MAPS,
      sourceUrl: place.googleMapsUri || null,
    };
  }

  private async scrapeNominatim(
    ctx: ScrapeContext,
    queries: Array<{ query: string; industry: Industry }>,
    _industries: Industry[],
    limit: number,
    targetCity: string | null,
  ): Promise<RawCompany[]> {
    const http = this.http(ctx);
    const throttle = this.throttle(ctx);
    const results: RawCompany[] = [];
    const seen = new Set<string>();

    for (const { query, industry } of queries.slice(0, 40)) {
      if (shouldStop(ctx, results.length)) break;
      await throttle.wait();

      try {
        const url =
          `${NOMINATIM}?` +
          new URLSearchParams({
            q: `${query}, North Macedonia`,
            format: 'jsonv2',
            addressdetails: '1',
            extratags: '1',
            limit: '15',
            countrycodes: 'mk',
          }).toString();

        const rows = await http.get<
          Array<{
            place_id?: number;
            display_name?: string;
            name?: string;
            type?: string;
            class?: string;
            lat?: string;
            lon?: string;
            address?: Record<string, string>;
            extratags?: Record<string, string>;
          }>
        >(url, {
          headers: {
            Accept: 'application/json',
            'User-Agent': 'LeadHunterMK/1.0 (local research; contact=localhost)',
          },
        });

        for (const row of Array.isArray(rows) ? rows : []) {
          if (row.class === 'highway' || row.class === 'place') continue;
          const name =
            row.name ||
            row.extratags?.['name:mk'] ||
            row.display_name?.split(',')[0]?.trim();
          if (!name || name.length < 2) continue;

          const key = `${name}|${row.lat}|${row.lon}`.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);

          const city =
            canonicalizeCity(
              row.address?.city ||
                row.address?.town ||
                row.address?.municipality ||
                row.address?.village ||
                null,
            ) || findCityInText(row.display_name);

          if (targetCity && !matchesCityFilter(city, row.display_name, targetCity)) {
            continue;
          }

          const mapsUrl =
            row.lat && row.lon
              ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${city || 'Macedonia'}`)}`
              : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`;

          results.push({
            name,
            industry,
            category: row.type || INDUSTRY_LABELS[industry],
            address: row.display_name || null,
            city,
            phone: row.extratags?.phone || null,
            website: row.extratags?.website || row.extratags?.['contact:website'] || null,
            googleMapsUrl: mapsUrl,
            googlePlaceId: row.place_id ? `osm:${row.place_id}` : null,
            googleCategory: row.type || null,
            googleBusinessStatus: 'OPERATIONAL',
            sourceName: COMPANY_SOURCES.GOOGLE_MAPS,
            sourceUrl: mapsUrl,
          });

          if (results.length >= limit) break;
        }
      } catch (err) {
        ctx.logger.warn('Nominatim search failed', {
          query,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return results.slice(0, limit);
  }

  private cityFromComponents(
    components?: Array<{ longText?: string; types?: string[] }>,
  ): string | null {
    if (!components?.length) return null;
    const city = components.find((c) =>
      c.types?.some((t) => t === 'locality' || t === 'postal_town'),
    );
    return city?.longText || null;
  }
}
