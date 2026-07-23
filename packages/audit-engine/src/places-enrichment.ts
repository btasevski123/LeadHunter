import { nameSimilarity, normalizePhoneMk, normalizeUrl } from '@leadhunter/shared';

const PLACES_SEARCH = 'https://places.googleapis.com/v1/places:searchText';

export interface PlacesEnrichmentResult {
  website: string | null;
  googlePlaceId: string | null;
  googleMapsUrl: string | null;
  phone: string | null;
  googleRating: number | null;
  googleReviewsCount: number | null;
  googleCategory: string | null;
  confidence: number;
  method: string;
  matchedName: string;
}

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
  }>;
}

/**
 * Look up a company on Google Places Text Search to fill missing website /
 * googlePlaceId. Used when directory scrapes (Yellow Pages, etc.) omit the site
 * that Maps already shows.
 */
export async function enrichFromGooglePlaces(input: {
  name: string;
  city?: string | null;
  phone?: string | null;
  address?: string | null;
  apiKey?: string | null;
}): Promise<PlacesEnrichmentResult | null> {
  const apiKey =
    input.apiKey ||
    process.env.GOOGLE_PLACES_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    null;
  if (!apiKey) return null;

  const name = input.name?.trim();
  if (!name) return null;

  const query = [name, input.city?.trim()].filter(Boolean).join(' ');
  const data = await searchPlaces(apiKey, query);
  const places = data?.places || [];
  if (!places.length) return null;

  const phoneNorm = normalizePhoneMk(input.phone);
  let best: { place: (typeof places)[number]; score: number; reason: string } | null = null;

  for (const place of places) {
    const placeName = place.displayName?.text?.trim();
    if (!placeName) continue;

    const nameScore = nameSimilarity(name, placeName);
    const placePhone = normalizePhoneMk(
      place.nationalPhoneNumber || place.internationalPhoneNumber,
    );
    const phoneExact = Boolean(phoneNorm && placePhone && phoneNorm === placePhone);
    const phoneSoft = Boolean(
      phoneNorm &&
        placePhone &&
        phoneNorm.slice(-7) === placePhone.slice(-7) &&
        phoneNorm.slice(-7).length >= 6,
    );

    let score = nameScore;
    let reason = 'name';
    if (phoneExact) {
      score = Math.max(score, 0.95);
      reason = 'phone';
    } else if (phoneSoft && nameScore >= 0.45) {
      score = Math.max(score, 0.82);
      reason = 'phone_soft';
    }

    // Prefer results that actually have a website when scores are close
    if (place.websiteUri) score += 0.03;

    if (!best || score > best.score) {
      best = { place, score, reason };
    }
  }

  if (!best || best.score < 0.55) return null;

  const place = best.place;
  const website = normalizeUrl(place.websiteUri || null);
  const confidence =
    best.score >= 0.9 ? 0.95 : best.score >= 0.75 ? 0.88 : best.score >= 0.65 ? 0.8 : 0.72;

  return {
    website,
    googlePlaceId: place.id || null,
    googleMapsUrl: place.googleMapsUri?.trim() || null,
    phone: place.nationalPhoneNumber || place.internationalPhoneNumber || null,
    googleRating: place.rating ?? null,
    googleReviewsCount: place.userRatingCount ?? null,
    googleCategory: place.primaryTypeDisplayName?.text || null,
    confidence,
    method: `places_text_search:${best.reason}`,
    matchedName: place.displayName?.text?.trim() || name,
  };
}

async function searchPlaces(apiKey: string, textQuery: string): Promise<PlacesTextResult | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(PLACES_SEARCH, {
      method: 'POST',
      signal: controller.signal,
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
        ].join(','),
      },
      body: JSON.stringify({
        textQuery,
        languageCode: 'mk',
        regionCode: 'MK',
        pageSize: 5,
      }),
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return (await res.json()) as PlacesTextResult;
  } catch {
    return null;
  }
}
