import { Industry, expandIndustryFilter } from '@leadhunter/shared';

/**
 * Google Places (New) types per LeadHunter industry.
 * Every industry must have types so city-scoped Nearby Search works uniformly.
 * @see https://developers.google.com/maps/documentation/places/web-service/place-types
 */
export const INDUSTRY_PLACE_TYPES: Record<Industry, string[]> = {
  [Industry.PRINTING]: ['printing_shop', 'copy_shop', 'store'],
  [Industry.MANUFACTURING]: ['manufacturer', 'wholesaler', 'storage', 'farm'],
  [Industry.FACTORIES]: ['manufacturer', 'storage', 'wholesaler'],
  [Industry.CONSTRUCTION]: [
    'general_contractor',
    'roofing_contractor',
    'electrician',
    'plumber',
    'painter',
    'moving_company',
  ],
  [Industry.FURNITURE]: ['furniture_store', 'home_goods_store', 'manufacturer'],
  [Industry.METAL_INDUSTRY]: ['manufacturer', 'hardware_store', 'wholesaler'],
  [Industry.AUTOMOTIVE]: [
    'car_repair',
    'car_dealer',
    'car_wash',
    'gas_station',
    'parking',
  ],
  [Industry.DENTAL]: ['dentist', 'dental_clinic'],
  [Industry.HEALTHCARE]: [
    'doctor',
    'hospital',
    'medical_clinic',
    'physiotherapist',
    'pharmacy',
  ],
  [Industry.LEGAL]: ['lawyer', 'attorney'],
  [Industry.ACCOUNTING]: ['accounting', 'insurance_agency', 'bank'],
  [Industry.TOURISM]: ['travel_agency', 'tourist_attraction', 'tour_operator'],
  [Industry.HOSPITALITY]: [
    'restaurant',
    'cafe',
    'hotel',
    'lodging',
    'bakery',
    'bar',
  ],
  [Industry.FOOD_BEVERAGE]: [
    'restaurant',
    'cafe',
    'bakery',
    'meal_takeaway',
    'bar',
    'fast_food_restaurant',
    'pizza_restaurant',
    'ice_cream_shop',
    'meal_delivery',
  ],
  [Industry.LODGING]: [
    'hotel',
    'lodging',
    'guest_house',
    'hostel',
    'motel',
    'extended_stay_hotel',
    'resort_hotel',
  ],
  [Industry.FITNESS]: [
    'gym',
    'fitness_center',
    'yoga_studio',
    'sports_club',
    'stadium',
  ],
  [Industry.RETAIL]: [
    'store',
    'supermarket',
    'clothing_store',
    'convenience_store',
    'electronics_store',
    'hardware_store',
    'shoe_store',
    'book_store',
  ],
  [Industry.SERVICES]: [
    'hair_salon',
    'beauty_salon',
    'laundry',
    'locksmith',
    'electrician',
    'plumber',
    'real_estate_agency',
    'insurance_agency',
  ],
};

/** Broad coverage when scraping a whole city without industry filter. */
export const CITY_SWEEP_PLACE_TYPES = Array.from(
  new Set(Object.values(INDUSTRY_PLACE_TYPES).flat()),
);

export function placeTypesForIndustries(industries: Industry[]): string[] {
  const expanded = industries.flatMap((i) => expandIndustryFilter(i));
  const types = new Set<string>();
  for (const industry of expanded) {
    for (const t of INDUSTRY_PLACE_TYPES[industry] || []) types.add(t);
  }
  return [...types];
}

/** Map a Google primaryType back to our Industry (best effort). */
export function industryFromPlaceType(
  primaryType: string | null | undefined,
  fallback: Industry = Industry.SERVICES,
): Industry {
  if (!primaryType) return fallback;
  for (const [industry, types] of Object.entries(INDUSTRY_PLACE_TYPES) as Array<
    [Industry, string[]]
  >) {
    if (industry === Industry.HOSPITALITY) continue;
    if (types.includes(primaryType)) return industry;
  }
  return fallback;
}
