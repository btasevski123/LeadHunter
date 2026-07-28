/** Approximate city centers for Places locationBias / Nearby Search (WGS84). */
export const MK_CITY_GEO: Record<
  string,
  { lat: number; lng: number; radiusM: number }
> = {
  Скопје: { lat: 41.9981, lng: 21.4254, radiusM: 18_000 },
  Битола: { lat: 41.0311, lng: 21.3403, radiusM: 10_000 },
  Куманово: { lat: 42.1322, lng: 21.7144, radiusM: 9_000 },
  Прилеп: { lat: 41.3451, lng: 21.555, radiusM: 9_000 },
  Тетово: { lat: 42.0097, lng: 20.9715, radiusM: 9_000 },
  Велес: { lat: 41.7156, lng: 21.7756, radiusM: 8_000 },
  Штип: { lat: 41.7415, lng: 22.1958, radiusM: 8_000 },
  Охрид: { lat: 41.1172, lng: 20.8019, radiusM: 10_000 },
  Гостивар: { lat: 41.796, lng: 20.9082, radiusM: 8_000 },
  Струмица: { lat: 41.4378, lng: 22.6433, radiusM: 8_000 },
  Кавадарци: { lat: 41.4331, lng: 22.0119, radiusM: 7_000 },
  Кочани: { lat: 41.9164, lng: 22.4128, radiusM: 7_000 },
  Кичево: { lat: 41.5133, lng: 20.9633, radiusM: 7_000 },
  Струга: { lat: 41.1781, lng: 20.6778, radiusM: 8_000 },
  Радовиш: { lat: 41.6383, lng: 22.4647, radiusM: 7_000 },
  Гевгелија: { lat: 41.1417, lng: 22.5014, radiusM: 7_000 },
  Дебар: { lat: 41.525, lng: 20.5242, radiusM: 7_000 },
  'Крива Паланка': { lat: 42.2019, lng: 22.3319, radiusM: 7_000 },
  'Свети Николе': { lat: 41.865, lng: 21.9411, radiusM: 7_000 },
  Неготино: { lat: 41.4839, lng: 22.0906, radiusM: 7_000 },
  Делчево: { lat: 41.9672, lng: 22.7694, radiusM: 7_000 },
  Виница: { lat: 41.8828, lng: 22.5092, radiusM: 7_000 },
  Ресен: { lat: 41.0889, lng: 20.9167, radiusM: 6_000 },
  Пробиштип: { lat: 41.9936, lng: 22.1781, radiusM: 6_000 },
  Берово: { lat: 41.7031, lng: 22.8578, radiusM: 6_000 },
};

export function cityGeo(city: string): { lat: number; lng: number; radiusM: number } | null {
  return MK_CITY_GEO[city] || null;
}
