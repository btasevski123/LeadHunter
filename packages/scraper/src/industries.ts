import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  Industry,
  MK_CANONICAL_CITIES,
  cyrillicToLatinMk,
  expandBilingualSearchTerms,
  parseIndustry,
  type Industry as IndustryType,
} from '@leadhunter/shared';

export interface IndustryConfig {
  id: string;
  name: string;
  keywords: string[];
}

let cachedIndustries: IndustryConfig[] | null = null;
let cachedCities: string[] | null = null;

function configDir(): string {
  // Prefer package config next to dist/ or src/
  const candidates = [
    join(__dirname, '..', 'config'),
    join(__dirname, '..', '..', 'config'),
    join(process.cwd(), 'packages', 'scraper', 'config'),
    join(process.cwd(), 'config'),
  ];
  for (const dir of candidates) {
    try {
      readFileSync(join(dir, 'industries.json'), 'utf8');
      return dir;
    } catch {
      // try next
    }
  }
  return join(__dirname, '..', '..', 'config');
}

export function loadIndustries(): IndustryConfig[] {
  if (cachedIndustries) return cachedIndustries;
  const raw = readFileSync(join(configDir(), 'industries.json'), 'utf8');
  cachedIndustries = JSON.parse(raw) as IndustryConfig[];
  return cachedIndustries;
}

export function loadMkCities(): string[] {
  if (cachedCities) return cachedCities;
  let fromFile: string[] = [];
  try {
    const raw = readFileSync(join(configDir(), 'mk-cities.json'), 'utf8');
    fromFile = JSON.parse(raw) as string[];
  } catch {
    fromFile = [];
  }
  // Always merge shared aliases so smaller towns (e.g. Ресен) are never dropped
  cachedCities = Array.from(new Set([...MK_CANONICAL_CITIES, ...fromFile]));
  return cachedCities;
}

export function keywordsForIndustries(industries: IndustryType[]): string[] {
  const configs = loadIndustries();
  const wanted = new Set(industries.map(String));
  const terms = new Set<string>();
  for (const cfg of configs) {
    if (!wanted.has(cfg.id)) continue;
    for (const kw of cfg.keywords) terms.add(kw);
  }
  // Google Maps MK listings use both scripts — query Cyrillic + Latin forms
  return expandBilingualSearchTerms([...terms]);
}

export function resolveIndustriesFromConfig(
  industry?: string | null,
  list?: IndustryType[],
): IndustryType[] {
  if (list?.length) return list;
  const parsed = parseIndustry(industry);
  if (parsed) return [parsed];
  return loadIndustries()
    .map((c) => parseIndustry(c.id))
    .filter((v): v is IndustryType => Boolean(v));
}

export function industryFromKeyword(text: string): IndustryType | null {
  const lower = text.toLowerCase();
  const latinLower = cyrillicToLatinMk(lower);
  // Prefer longer keyword matches so "пзу стоматологија" beats bare "пзу"
  let best: { industry: IndustryType; len: number } | null = null;
  for (const cfg of loadIndustries()) {
    if (cfg.id === 'HOSPITALITY') continue;
    for (const kw of expandBilingualSearchTerms(cfg.keywords)) {
      const k = kw.toLowerCase();
      const kLatin = cyrillicToLatinMk(k);
      if (!lower.includes(k) && !latinLower.includes(kLatin)) continue;
      if (!best || k.length > best.len) {
        const industry = parseIndustry(cfg.id) || (cfg.id as IndustryType);
        best = { industry, len: k.length };
      }
    }
  }
  return best?.industry ?? null;
}

export { Industry };
