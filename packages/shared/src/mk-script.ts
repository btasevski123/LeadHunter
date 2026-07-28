/** Macedonian Cyrillic → Latin (common Maps / ISO-style digraphs). */
const MK_CYR_TO_LAT: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  ѓ: 'gj',
  е: 'e',
  ж: 'zh',
  з: 'z',
  ѕ: 'dz',
  и: 'i',
  ј: 'j',
  к: 'k',
  л: 'l',
  љ: 'lj',
  м: 'm',
  н: 'n',
  њ: 'nj',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  ќ: 'kj',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'c',
  ч: 'ch',
  џ: 'dj',
  ш: 'sh',
  А: 'A',
  Б: 'B',
  В: 'V',
  Г: 'G',
  Д: 'D',
  Ѓ: 'Gj',
  Е: 'E',
  Ж: 'Zh',
  З: 'Z',
  Ѕ: 'Dz',
  И: 'I',
  Ј: 'J',
  К: 'K',
  Л: 'L',
  Љ: 'Lj',
  М: 'M',
  Н: 'N',
  Њ: 'Nj',
  О: 'O',
  П: 'P',
  Р: 'R',
  С: 'S',
  Т: 'T',
  Ќ: 'Kj',
  У: 'U',
  Ф: 'F',
  Х: 'H',
  Ц: 'C',
  Ч: 'Ch',
  Џ: 'Dj',
  Ш: 'Sh',
};

const CYRILLIC_RE = /[\u0400-\u04FF]/;

export function hasCyrillic(text: string): boolean {
  return CYRILLIC_RE.test(text);
}

/** Transliterate Macedonian Cyrillic to Latin; non-Cyrillic chars pass through. */
export function cyrillicToLatinMk(text: string): string {
  let out = '';
  for (const ch of text) {
    out += MK_CYR_TO_LAT[ch] ?? ch;
  }
  return out;
}

/**
 * Expand search terms so we query both scripts used on Google Maps MK
 * (e.g. "теретана" + "teretana", "фитнес центар" + "fitnes centar").
 */
export function expandBilingualSearchTerms(terms: string[]): string[] {
  const out = new Set<string>();
  for (const raw of terms) {
    const term = raw.trim();
    if (!term) continue;
    out.add(term);
    if (hasCyrillic(term)) {
      const latin = cyrillicToLatinMk(term).trim();
      if (latin && latin.toLowerCase() !== term.toLowerCase()) {
        out.add(latin);
      }
    }
  }
  return [...out];
}
