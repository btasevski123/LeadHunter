import { cyrillicToLatinMk } from './mk-script';

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

const LEGAL_SUFFIX_RE =
  /(?:^|[\s,.\-/(])(?:dooel|doo|дооел|доо|д\.о\.о\.е\.л\.|д\.о\.о\.|ад|а\.д\.|ltd|llc|gmbh|inc|co|company|компанија)(?=$|[\s,.\-/)])/gi;

export function stripLegalSuffixes(name: string): string {
  return normalizeWhitespace(name.replace(LEGAL_SUFFIX_RE, ' '));
}

/**
 * Fold names for matching/dedup. Cyrillic is transliterated to Latin so
 * "Олимпија Фитнес" and "Olimpija Fitnes" compare as the same business.
 */
export function normalizeName(name: string): string {
  const folded = normalizeWhitespace(stripLegalSuffixes(name))
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cyrillicToLatinMk(folded);
}

export function normalizeRegistrationNumber(input?: string | null): string | null {
  if (!input) return null;
  const digits = input.replace(/\D/g, '');
  return digits.length >= 7 ? digits : null;
}

/** Token Jaccard similarity on normalized company names (0–1). */
export function nameSimilarity(a: string, b: string): number {
  const ta = new Set(normalizeName(a).split(' ').filter((t) => t.length > 1));
  const tb = new Set(normalizeName(b).split(' ').filter((t) => t.length > 1));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  const union = ta.size + tb.size - inter;
  return union === 0 ? 0 : inter / union;
}

export function randomDelayMs(baseMs: number, jitterRatio = 0.4): number {
  const jitter = baseMs * jitterRatio;
  return Math.max(0, Math.round(baseMs - jitter + Math.random() * jitter * 2));
}

const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  'LeadHunterMK/1.0 (+https://localhost; research bot for local lead discovery)',
];

export function rotateUserAgent(preferred?: string): string {
  if (preferred && Math.random() > 0.5) return preferred;
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]!;
}

export function normalizeUrl(input?: string | null): string | null {
  if (!input) return null;
  let value = input.trim();
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) {
    value = `https://${value}`;
  }
  try {
    const url = new URL(value);
    url.hash = '';
    if (url.pathname === '/') {
      return `${url.protocol}//${url.host}`;
    }
    return `${url.protocol}//${url.host}${url.pathname}`.replace(/\/$/, '');
  } catch {
    return null;
  }
}

export function extractDomain(input?: string | null): string | null {
  const url = normalizeUrl(input);
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return null;
  }
}

/** Normalize North Macedonia phone numbers to digits with country code when possible. */
export function normalizePhoneMk(input?: string | null): string | null {
  if (!input) return null;
  let digits = input.replace(/[^\d+]/g, '');
  if (!digits) return null;
  digits = digits.replace(/^\+/, '');
  if (digits.startsWith('00389')) digits = digits.slice(5);
  if (digits.startsWith('389')) {
    // keep as-is
  } else if (digits.startsWith('0')) {
    digits = `389${digits.slice(1)}`;
  } else if (digits.length === 8 || digits.length === 9) {
    digits = `389${digits}`;
  }
  const only = digits.replace(/\D/g, '');
  return only.length >= 8 ? only : null;
}

export function normalizeEmail(input?: string | null): string | null {
  if (!input) return null;
  const email = input.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export function isLikelyBusinessEmail(email: string): boolean {
  const local = email.split('@')[0] ?? '';
  const prefixes = [
    'info',
    'contact',
    'office',
    'sales',
    'hello',
    'admin',
    'support',
    'marketing',
    'kontakt',
    'firma',
  ];
  return prefixes.some((p) => local === p || local.startsWith(`${p}.`) || local.startsWith(`${p}-`));
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
