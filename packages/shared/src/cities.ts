/** Canonical Macedonian cities with Latin/Cyrillic/Albanian spelling variants for filtering. */
export const MK_CITY_ALIASES: Record<string, string[]> = {
  Скопје: ['Скопје', 'Skopje', 'Shkupi', 'Shkup', 'СКОПЈЕ', 'SKOPJE'],
  Битола: ['Битола', 'Bitola', 'Manastiri', 'БИТОЛА', 'BITOLA'],
  Куманово: ['Куманово', 'Kumanovo', 'КУАНОВО', 'KUMANOVO'],
  Прилеп: ['Прилеп', 'Prilep', 'ПРИЛЕП'],
  Тетово: ['Тетово', 'Tetovo', 'Tetova', 'ТЕТОВО'],
  Велес: ['Велес', 'Veles', 'ВЕЛЕС'],
  Штип: ['Штип', 'Štip', 'Stip', 'Shtip', 'Komuna e Shtipit', 'ШТИП'],
  Охрид: ['Охрид', 'Ohrid', 'ОХРИД'],
  Гостивар: ['Гостивар', 'Gostivar', 'ГОСТИВАР'],
  Струмица: ['Струмица', 'Strumica', 'Strumicë', 'СТРУМИЦА'],
  Кавадарци: ['Кавадарци', 'Kavadarci', 'Kavadarc', 'КАВАДАРЦИ'],
  Кочани: ['Кочани', 'Kočani', 'Kocani', 'Koçani', 'КОЧАНИ'],
  Кичево: ['Кичево', 'Kičevo', 'Kicevo', 'КИЧЕВО'],
  Струга: ['Струга', 'Struga', 'СТРУГА'],
  Радовиш: ['Радовиш', 'Radoviš', 'Radovis', 'РАДОВИШ'],
  Гевгелија: ['Гевгелија', 'Gevgelija', 'Gjevgjeli', 'ГЕВГЕЛИЈА'],
  Дебар: ['Дебар', 'Debar', 'ДЕБАР'],
  'Крива Паланка': ['Крива Паланка', 'Kriva Palanka'],
  'Свети Николе': ['Свети Николе', 'Sveti Nikole'],
  Неготино: ['Неготино', 'Negotino'],
  Делчево: ['Делчево', 'Delčevo', 'Delchevo'],
  Виница: ['Виница', 'Vinica'],
  Ресен: ['Ресен', 'Resen'],
  Пробиштип: ['Пробиштип', 'Probištip', 'Probishtip'],
  Берово: ['Берово', 'Berovo'],
};

/** UI options: Cyrillic value (matches DB) + Latin label for readability */
export const MK_CITY_OPTIONS = Object.keys(MK_CITY_ALIASES).map((cyrillic) => {
  const aliases = MK_CITY_ALIASES[cyrillic] || [cyrillic];
  const latin = aliases.find((a) => /^[A-Za-zŠšČčŽžĆćĐđ\s-]+$/.test(a)) || cyrillic;
  return { value: cyrillic, label: `${cyrillic} / ${latin}` };
});

/** Expand any city spelling into all known aliases for filtering. */
export function cityFilterVariants(input: string): string[] {
  const raw = input.trim();
  if (!raw) return [];

  const lower = raw.toLowerCase();
  for (const [canonical, aliases] of Object.entries(MK_CITY_ALIASES)) {
    const all = [canonical, ...aliases];
    if (all.some((a) => a.toLowerCase() === lower)) {
      return Array.from(new Set(all));
    }
  }

  // Unknown city: still try case-insensitive exact + original
  return Array.from(new Set([raw, raw.toLowerCase(), raw.toUpperCase()]));
}
