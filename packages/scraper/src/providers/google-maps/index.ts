import {
  COMPANY_SOURCES,
  Industry,
  INDUSTRY_LABELS,
  type RawCompany,
} from '@leadhunter/shared';
import { BaseLeadProvider } from '../../base-provider';
import type { ScrapeContext } from '../../types';
import { maxCompanies, resolveIndustryFilter, shouldStop } from '../../provider-utils';
import { industryFromKeyword, keywordsForIndustries, loadMkCities } from '../../industries';

const PLACES_SEARCH = 'https://places.googleapis.com/v1/places:searchText';
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

interface PlacesTextResult {
  places?: Array<{
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
    businessStatus?: string;
    regularOpeningHours?: { weekdayDescriptions?: string[] };
    photos?: Array<{ name?: string }>;
    addressComponents?: Array<{ longText?: string; types?: string[] }>;
  }>;
  nextPageToken?: string;
}

/**
 * Google Maps / Places discovery for North Macedonia businesses.
 *
 * Primary: Google Places API (New) Text Search when GOOGLE_PLACES_API_KEY
 * (or GOOGLE_MAPS_API_KEY) is set.
 *
 * Fallback: OpenStreetMap Nominatim (public, rate-limited) so local/dev
 * environments still discover real MK businesses without a paid key.
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
    const industries = resolveIndustryFilter(ctx.config);
    const keywords = keywordsForIndustries(industries);
    const cities = this.resolveCities(ctx);
    const limit = maxCompanies(ctx, 2000);
    const apiKey =
      process.env.GOOGLE_PLACES_API_KEY ||
      process.env.GOOGLE_MAPS_API_KEY ||
      (typeof ctx.config.googlePlacesApiKey === 'string'
        ? ctx.config.googlePlacesApiKey
        : undefined);

    const queries = this.buildQueries(keywords, cities, industries);
    ctx.logger.info('Google Maps discovery starting', {
      queries: queries.length,
      mode: apiKey ? 'places-api' : 'nominatim-fallback',
      limit,
    });

    if (apiKey) {
      return this.scrapePlacesApi(ctx, queries, industries, apiKey, limit);
    }

    ctx.logger.warn(
      'GOOGLE_PLACES_API_KEY not set — using OpenStreetMap Nominatim fallback for MK discovery',
    );
    return this.scrapeNominatim(ctx, queries, industries, limit);
  }

  private resolveCities(ctx: ScrapeContext): string[] {
    if (typeof ctx.config.city === 'string' && ctx.config.city.trim()) {
      return [ctx.config.city.trim()];
    }
    const all = loadMkCities();
    // Scale mode: search major cities; narrow when industry-filtered
    const industries = resolveIndustryFilter(ctx.config);
    if (industries.length === 1) return all;
    return all.slice(0, 8);
  }

  private buildQueries(
    keywords: string[],
    cities: string[],
    industries: Industry[],
  ): Array<{ query: string; industry: Industry }> {
    const out: Array<{ query: string; industry: Industry }> = [];
    const industryList = industries.length ? industries : [Industry.SERVICES];

    for (let i = 0; i < keywords.length; i++) {
      const kw = keywords[i]!;
      const industry =
        industryFromKeyword(kw) ||
        industryList[Math.min(i, industryList.length - 1)] ||
        Industry.SERVICES;

      // National + city-scoped queries for volume
      out.push({ query: `${kw} Македонија`, industry });
      for (const city of cities) {
        out.push({ query: `${kw} ${city}`, industry });
      }
    }

    // Deduplicate query strings
    const seen = new Set<string>();
    return out.filter((q) => {
      if (seen.has(q.query)) return false;
      seen.add(q.query);
      return true;
    });
  }

  private async scrapePlacesApi(
    ctx: ScrapeContext,
    queries: Array<{ query: string; industry: Industry }>,
    industries: Industry[],
    apiKey: string,
    limit: number,
  ): Promise<RawCompany[]> {
    const http = this.http(ctx);
    const throttle = this.throttle(ctx);
    const results: RawCompany[] = [];
    const seenPlaces = new Set<string>();

    for (const { query, industry } of queries) {
      if (shouldStop(ctx, results.length)) break;
      let pageToken: string | undefined;

      for (let page = 0; page < 3; page++) {
        if (shouldStop(ctx, results.length)) break;
        await throttle.wait();
        ctx.logger.info('Places text search', { query, page });

        try {
          const body: Record<string, unknown> = {
            textQuery: query,
            languageCode: 'mk',
            regionCode: 'MK',
            pageSize: 20,
          };
          if (pageToken) body.pageToken = pageToken;

          const data = await http.post<PlacesTextResult>(PLACES_SEARCH, body, {
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': apiKey,
              'X-Goog-FieldMask': [
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
                'places.businessStatus',
                'places.regularOpeningHours',
                'places.photos',
                'places.addressComponents',
                'nextPageToken',
              ].join(','),
            },
          });

          for (const place of data.places || []) {
            const placeId = place.id || null;
            if (placeId && seenPlaces.has(placeId)) continue;
            if (placeId) seenPlaces.add(placeId);

            const name = place.displayName?.text?.trim();
            if (!name) continue;

            const city = this.cityFromComponents(place.addressComponents) ||
              this.cityFromAddress(place.formattedAddress);

            results.push({
              name,
              industry,
              category: place.primaryTypeDisplayName?.text || INDUSTRY_LABELS[industry],
              address: place.formattedAddress || null,
              city,
              phone:
                place.nationalPhoneNumber || place.internationalPhoneNumber || null,
              website: place.websiteUri || null,
              googlePlaceId: placeId,
              googleMapsUrl:
                place.googleMapsUri ||
                (placeId
                  ? `https://www.google.com/maps/place/?q=place_id:${placeId}`
                  : null),
              googleRating: place.rating ?? null,
              googleReviewsCount: place.userRatingCount ?? null,
              googleCategory: place.primaryTypeDisplayName?.text || null,
              googleBusinessStatus: place.businessStatus || null,
              googleOpeningHours: place.regularOpeningHours?.weekdayDescriptions || null,
              googlePhotos: (place.photos || [])
                .slice(0, 5)
                .map((p) => p.name)
                .filter(Boolean),
              sourceName: COMPANY_SOURCES.GOOGLE_MAPS,
              sourceUrl: place.googleMapsUri || null,
            });

            if (results.length >= limit) break;
          }

          pageToken = data.nextPageToken;
          if (!pageToken) break;
        } catch (err) {
          ctx.logger.warn('Places search failed', {
            query,
            error: err instanceof Error ? err.message : String(err),
          });
          break;
        }
      }
    }

    return results.slice(0, limit);
  }

  private async scrapeNominatim(
    ctx: ScrapeContext,
    queries: Array<{ query: string; industry: Industry }>,
    _industries: Industry[],
    limit: number,
  ): Promise<RawCompany[]> {
    const http = this.http(ctx);
    const throttle = this.throttle(ctx);
    const results: RawCompany[] = [];
    const seen = new Set<string>();

    // Nominatim requires a descriptive UA and low request volume
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
            row.address?.city ||
            row.address?.town ||
            row.address?.municipality ||
            row.address?.village ||
            null;

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

  private cityFromAddress(address?: string): string | null {
    if (!address) return null;
    const cities = loadMkCities();
    for (const city of cities) {
      if (address.includes(city)) return city;
    }
    return null;
  }
}
