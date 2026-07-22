import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Industry, parseIndustry, type Industry as IndustryType } from '@leadhunter/shared';

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
  try {
    const raw = readFileSync(join(configDir(), 'mk-cities.json'), 'utf8');
    cachedCities = JSON.parse(raw) as string[];
  } catch {
    cachedCities = ['Скопје', 'Битола', 'Охрид', 'Тетово', 'Прилеп'];
  }
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
  return [...terms];
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
  for (const cfg of loadIndustries()) {
    if (cfg.keywords.some((k) => lower.includes(k.toLowerCase()))) {
      return (parseIndustry(cfg.id) || (cfg.id as IndustryType)) ?? null;
    }
  }
  return null;
}

export { Industry };
