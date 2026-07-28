/**
 * Canonical Macedonian cities with Latin/Cyrillic/Albanian spelling variants.
 *
 * Comparison is case-insensitive, so uppercase forms need no separate entry.
 * Albanian names matter: Google Maps returns them for towns with an Albanian
 * majority, and an unrecognised spelling is stored verbatim, which fragments
 * city filters and stops duplicates in that town from ever matching.
 */
export const MK_CITY_ALIASES: Record<string, string[]> = {
  Скопје: ['Скопје', 'Skopje', 'Shkupi', 'Shkup', 'Shkupë'],
  Битола: ['Битола', 'Bitola', 'Manastiri', 'Manastir'],
  Куманово: ['Куманово', 'Kumanovo', 'Kumanovë', 'Kumanova'],
  Прилеп: ['Прилеп', 'Prilep', 'Prilepi'],
  Тетово: ['Тетово', 'Tetovo', 'Tetova', 'Tetovë'],
  Велес: ['Велес', 'Veles', 'Velesi'],
  Штип: ['Штип', 'Štip', 'Stip', 'Shtip', 'Shtipi', 'Komuna e Shtipit'],
  Охрид: ['Охрид', 'Ohrid', 'Ohri', 'Ohër'],
  Гостивар: ['Гостивар', 'Gostivar', 'Gostivari'],
  Струмица: ['Струмица', 'Strumica', 'Strumicë'],
  Кавадарци: ['Кавадарци', 'Kavadarci', 'Kavadarc'],
  Кочани: ['Кочани', 'Kočani', 'Kocani', 'Koçani'],
  Кичево: ['Кичево', 'Kičevo', 'Kicevo', 'Kërçova', 'Kercova'],
  Струга: ['Струга', 'Struga', 'Strugë'],
  Радовиш: ['Радовиш', 'Radoviš', 'Radovis', 'Radovish', 'Radovishti'],
  Гевгелија: ['Гевгелија', 'Gevgelija', 'Gjevgjeli', 'Gevgelia'],
  Дебар: ['Дебар', 'Debar', 'Dibra', 'Dibër', 'Diber'],
  'Крива Паланка': ['Крива Паланка', 'Kriva Palanka', 'Palanka e Kriva'],
  'Свети Николе': ['Свети Николе', 'Sveti Nikole', 'Shën Nikolla'],
  Неготино: ['Неготино', 'Negotino', 'Negotina'],
  Делчево: ['Делчево', 'Delčevo', 'Delchevo', 'Delceva'],
  Виница: ['Виница', 'Vinica', 'Vinicë'],
  Ресен: ['Ресен', 'Resen', 'Reseni'],
  Пробиштип: ['Пробиштип', 'Probištip', 'Probishtip'],
  Берово: ['Берово', 'Berovo', 'Berova'],
};

/** UI options: Cyrillic value (matches DB) + Latin label for readability */
export const MK_CITY_OPTIONS = Object.keys(MK_CITY_ALIASES).map((cyrillic) => {
  const aliases = MK_CITY_ALIASES[cyrillic] || [cyrillic];
  const latin = aliases.find((a) => /^[A-Za-zŠšČčŽžĆćĐđ\s-]+$/.test(a)) || cyrillic;
  return { value: cyrillic, label: `${cyrillic} / ${latin}` };
});

/**
 * Expand any city spelling into all known aliases for filtering.
 *
 * Case variants are included because these feed a case-sensitive `IN` query and
 * historical rows were stored in whatever case the source used.
 */
export function cityFilterVariants(input: string): string[] {
  const raw = input.trim();
  if (!raw) return [];

  const withCases = (values: string[]) =>
    Array.from(new Set(values.flatMap((v) => [v, v.toLowerCase(), v.toUpperCase()])));

  const lower = raw.toLowerCase();
  for (const [canonical, aliases] of Object.entries(MK_CITY_ALIASES)) {
    const all = [canonical, ...aliases];
    if (all.some((a) => a.toLowerCase() === lower)) {
      return withCases(all);
    }
  }

  return withCases([raw]);
}

/**
 * Canonical Cyrillic city name for storage (Resen → Ресен, Shkupi → Скопје).
 *
 * Scrapers sometimes yield junk in the city field — a single stray character, a
 * postal code, punctuation — which then pollutes city filters and, because the
 * matcher compares cities, silently blocks legitimate duplicate merges. Values
 * that cannot be a city name are rejected rather than stored.
 */
export function canonicalizeCity(input?: string | null): string | null {
  if (!input?.trim()) return null;
  const raw = input.trim();
  const lower = raw.toLowerCase();
  for (const [canonical, aliases] of Object.entries(MK_CITY_ALIASES)) {
    if ([canonical, ...aliases].some((a) => a.toLowerCase() === lower)) {
      return canonical;
    }
  }
  // Unknown city: keep it only if it plausibly is one. Smaller MK towns are not
  // in the alias table, so unknown-but-valid names must still pass through.
  const letters = raw.replace(/[^\p{L}]/gu, '');
  if (letters.length < 3) return null;
  return raw;
}

/**
 * Cyrillic + Latin forms for Places text queries.
 * Example: "Resen" → ["Ресен", "Resen"]
 */
export function citySearchTerms(input: string): string[] {
  const raw = input.trim();
  if (!raw) return [];
  const lower = raw.toLowerCase();
  for (const [canonical, aliases] of Object.entries(MK_CITY_ALIASES)) {
    const all = [canonical, ...aliases];
    if (!all.some((a) => a.toLowerCase() === lower)) continue;
    const latin = aliases.find((a) => /^[A-Za-zŠšČčŽžĆćĐđ\s-]+$/.test(a));
    return Array.from(new Set([canonical, ...(latin ? [latin] : [])]));
  }
  return [raw];
}

/** Detect a known MK city inside a free-text address. */
export function findCityInText(text?: string | null): string | null {
  if (!text) return null;
  const candidates = Object.entries(MK_CITY_ALIASES)
    .flatMap(([canonical, aliases]) =>
      [canonical, ...aliases].map((alias) => ({ canonical, alias })),
    )
    .sort((a, b) => b.alias.length - a.alias.length);
  for (const { canonical, alias } of candidates) {
    if (text.includes(alias)) return canonical;
  }
  return null;
}

/** All canonical Cyrillic cities (scraper default coverage). */
export const MK_CANONICAL_CITIES = Object.keys(MK_CITY_ALIASES);
