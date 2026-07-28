import { canonicalizeCity, MK_CITY_ALIASES } from './cities';
import { cyrillicToLatinMk } from './mk-script';
import { extractDomain, nameSimilarity, normalizeEmail, normalizeName, normalizePhoneMk, normalizeRegistrationNumber } from './normalize';

/**
 * Domains shared by many unrelated businesses. A shared domain here proves
 * nothing about identity, so it must never be used as a match signal.
 */
export const GENERIC_WEBSITE_DOMAINS = new Set([
  'facebook.com',
  'fb.com',
  'm.facebook.com',
  'instagram.com',
  'linkedin.com',
  'google.com',
  'maps.google.com',
  'sites.google.com',
  'business.site',
  'youtube.com',
  'twitter.com',
  'x.com',
  'tiktok.com',
  'bit.ly',
  'linktr.ee',
  'wixsite.com',
  'blogspot.com',
  'wordpress.com',
]);

export function isDedupableWebsiteDomain(domain?: string | null): boolean {
  if (!domain) return false;
  const d = domain.toLowerCase().replace(/^www\./, '');
  return !GENERIC_WEBSITE_DOMAINS.has(d);
}

/**
 * Gates applied to weak identity signals. A shared domain, phone, or email is
 * suggestive but not proof — a web agency, a shared reception desk, or a
 * franchise head office all produce collisions — so each is paired with a
 * minimum name similarity.
 */
export const IDENTITY_THRESHOLDS = {
  /** Same website domain still needs this much name agreement. */
  domainNameGate: 0.55,
  /** Same phone number still needs this much name agreement. */
  phoneNameGate: 0.55,
  /** Same email is slightly stronger evidence than a shared phone. */
  emailNameGate: 0.45,
  /** Address agreement that, combined with a shared distinctive token, implies identity. */
  addressWithTokenOverlap: 0.55,
  /** Address agreement strong enough to carry a weaker name match. */
  addressStrong: 0.72,
  /** Name agreement required alongside `addressStrong`. */
  addressStrongNameGate: 0.45,
  /** Name agreement that implies identity on its own, within one city. */
  nameAlone: 0.86,
  /** Name agreement required when a distinctive token is shared, within one city. */
  nameWithTokenOverlap: 0.35,
  /**
   * Name agreement for the database's last-resort scan of companies in the same
   * city. Looser than `nameAlone` because the city filter has already been
   * applied by the query.
   */
  nameFallbackInCity: 0.75,
} as const;

/**
 * Words that appear in so many company names that sharing one proves nothing.
 *
 * Written in natural form (either script) and folded through `normalizeName` at
 * module load, so entries match however the source spelled them. Kept
 * deliberately broad: a shared descriptor like "studio" or "dental" caused
 * unrelated businesses to be merged, and a missed merge is recoverable while a
 * wrong merge destroys a record.
 */
const NON_DISTINCTIVE_WORDS = [
  // Geography — Google Maps routinely appends the city to the business name
  ...Object.entries(MK_CITY_ALIASES).flatMap(([canonical, aliases]) => [canonical, ...aliases]),
  'македонија',
  'macedonia',
  'severna',
  'северна',
  'north',
  'општина',
  'opstina',
  'град',
  'grad',
  'филијала',
  'filijala',
  // Generic business descriptors
  'авто',
  'auto',
  'сервис',
  'servis',
  'service',
  'центар',
  'centar',
  'center',
  'centre',
  'студио',
  'studio',
  'печатница',
  'print',
  'printing',
  'design',
  'дизајн',
  'фабрика',
  'factory',
  'мебел',
  'mebel',
  'furniture',
  'министерство',
  'ministerstvo',
  'ministry',
  'собрание',
  'sobranie',
  'градско',
  'gradsko',
  'завод',
  'zavod',
  'музеј',
  'muzej',
  'адвокат',
  'advokat',
  'attorney',
  'law',
  'дентал',
  'dental',
  'стоматологија',
  'стоматолошка',
  'поликлиника',
  'клиника',
  'clinic',
  'ординација',
  'аптека',
  'apteka',
  'фитнес',
  'фитнесс',
  'fitness',
  'fitnes',
  'gym',
  'клуб',
  'klub',
  'club',
  'yoga',
  'јога',
  'ресторан',
  'restaurant',
  'кафе',
  'cafe',
  'coffee',
  'bakery',
  'пекара',
  'hotel',
  'хотел',
  'market',
  'маркет',
  'продавница',
  'shop',
  'индустрија',
  'industrija',
  'industry',
  'месна',
  'mesna',
  'група',
  'grupa',
  'group',
  'invest',
  'инвест',
  'trade',
  'комерц',
  'komerc',
  'промет',
  'promet',
  'инженеринг',
  'inzenering',
  'engineering',
  'градежни',
  'gradezni',
  'transport',
  'транспорт',
  'logistic',
  'logistics',
  'логистика',
  'express',
  'ekspres',
  'експрес',
  'office',
  'салон',
  'salon',
  'studios',
  'team',
  'тим',
];

const NON_DISTINCTIVE_TOKENS = new Set(
  NON_DISTINCTIVE_WORDS.flatMap((word) => normalizeName(word).split(' ')).filter(Boolean),
);

/** Street-type words and administrative noise that carry no identity. */
const ADDRESS_NOISE_RE =
  /\b(ul|ulica|bul|bulevar|br|no|number|opstina|grad|selo|naselba|kat|lokal|vlez|severna|makedonija|macedonia|north)\b/g;

/** Google Plus Code fragments, e.g. "FJ3W+R6V" — a geohash, not a street. */
const PLUS_CODE_TOKEN_RE = /^[23456789cfghjmpqrvwx]{2,6}$/;

const CITY_TOKENS_IN_ADDRESS = new Set(
  Object.entries(MK_CITY_ALIASES)
    .flatMap(([canonical, aliases]) => [canonical, ...aliases])
    .flatMap((city) => normalizeName(city).split(' '))
    .filter(Boolean),
);

interface ParsedAddress {
  /** Street-name tokens with city, postcode, and noise removed. */
  street: Set<string>;
  /** House / building numbers. */
  numbers: string[];
  normalized: string;
}

function parseAddress(input?: string | null): ParsedAddress | null {
  if (!input) return null;
  const folded = cyrillicToLatinMk(
    input
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\p{L}\p{N}\s]/gu, ' '),
  )
    .replace(ADDRESS_NOISE_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!folded) return null;

  const street = new Set<string>();
  const numbers: string[] = [];

  for (const token of folded.split(' ')) {
    if (!token) continue;
    // A 4-digit group in a Macedonian address is a postal code, not a house
    // number, and every address in a city shares it.
    if (/^\d{4}$/.test(token)) continue;
    if (/^\d+[a-z]?$/.test(token)) {
      numbers.push(token.replace(/[a-z]$/, ''));
      continue;
    }
    if (token.length < 2) continue;
    if (CITY_TOKENS_IN_ADDRESS.has(token)) continue;
    if (PLUS_CODE_TOKEN_RE.test(token) && /\d/.test(token)) continue;
    street.add(token);
  }

  return { street, numbers, normalized: folded };
}

/** Normalize free-text addresses for storage and fuzzy matching. */
export function normalizeAddress(input?: string | null): string | null {
  const parsed = parseAddress(input);
  if (!parsed) return null;
  const parts = [...[...parsed.street].sort(), ...parsed.numbers];
  return parts.length ? parts.join(' ') : null;
}

/**
 * Similarity between two street addresses (0–1).
 *
 * Two rules matter more than the raw token overlap, because addresses in the
 * same city share the city name and postal code and would otherwise all look
 * alike:
 *
 * - Conflicting house numbers mean different buildings. "Zhivko Chingo 43" and
 *   "Zhivko Chingo 4" are neighbours, not the same company, so a number
 *   conflict caps the score instead of being ignored.
 * - An address with no house number at all is too vague to establish identity,
 *   so it is capped below the match threshold.
 */
export function addressSimilarity(a?: string | null, b?: string | null): number {
  const pa = parseAddress(a);
  const pb = parseAddress(b);
  if (!pa || !pb) return 0;
  if (!pa.street.size || !pb.street.size) return 0;

  let inter = 0;
  for (const token of pa.street) if (pb.street.has(token)) inter += 1;
  const union = pa.street.size + pb.street.size - inter;
  const jaccard = union === 0 ? 0 : inter / union;

  const bothNumbered = pa.numbers.length > 0 && pb.numbers.length > 0;
  if (bothNumbered) {
    const shared = pa.numbers.some((n) => pb.numbers.includes(n));
    // Same street, different building number — neighbours, not duplicates.
    return shared ? Math.min(1, jaccard + 0.25) : Math.min(jaccard, 0.5);
  }

  // Street matches but at least one side has no building number.
  return Math.min(jaccard, 0.5);
}

/**
 * Tokens from a company name that carry identity — legal forms and city names
 * are excluded because they are shared by thousands of businesses.
 *
 * Also usable as a blocking key for record linkage: two companies can only be
 * duplicates by name if they share at least one distinctive token, so grouping
 * on these avoids comparing every company against every other.
 */
export function distinctiveNameTokens(name: string): Set<string> {
  return new Set(
    normalizeName(name)
      .split(' ')
      .filter((t) => t.length >= 3 && !NON_DISTINCTIVE_TOKENS.has(t)),
  );
}

/** True when both names share at least one distinctive token. */
export function significantTokenOverlap(a: string, b: string): boolean {
  const ta = distinctiveNameTokens(a);
  const tb = distinctiveNameTokens(b);
  for (const t of ta) if (tb.has(t)) return true;
  return false;
}

export interface CompanyIdentity {
  id?: string;
  name: string;
  registrationNumber?: string | null;
  website?: string | null;
  websiteDomain?: string | null;
  phone?: string | null;
  phoneNormalized?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  googlePlaceId?: string | null;
}

export type MatchReason =
  | 'registrationNumber'
  | 'googlePlaceId'
  | 'websiteDomain'
  | 'phone'
  | 'email'
  | 'address'
  | 'name';

export interface MatchResult {
  matched: boolean;
  reason?: MatchReason;
  score: number;
}

/**
 * Whether two records can be in the same place. Unknown on either side counts as
 * compatible.
 *
 * Canonicalizes first: sources disagree on script and language for the same city
 * ("Скопје", "Skopje", "Shkupi"), and a raw string comparison treated those as
 * different places, which blocked genuine duplicates from ever matching.
 */
function sameCity(a?: string | null, b?: string | null): boolean {
  const ca = canonicalizeCity(a);
  const cb = canonicalizeCity(b);
  if (!ca || !cb) return true;
  return ca.toLowerCase() === cb.toLowerCase();
}

/**
 * Single source of truth for "are these two records the same company?".
 *
 * Used by both the scraper's in-batch dedupe and the API's database upsert so
 * the two can never disagree — a disagreement means one path merges companies
 * the other would keep separate, which silently loses businesses.
 *
 * Priority: registration number → Google place ID → domain → phone → email →
 * address → name. Everything below the two hard identifiers is gated on name
 * similarity, and the name/address heuristics additionally require the cities
 * to agree when both are known.
 */
export function matchCompanyIdentity(a: CompanyIdentity, b: CompanyIdentity): MatchResult {
  const nameScore = nameSimilarity(a.name, b.name);

  const regA = normalizeRegistrationNumber(a.registrationNumber);
  const regB = normalizeRegistrationNumber(b.registrationNumber);
  if (regA && regB && regA === regB) {
    return { matched: true, reason: 'registrationNumber', score: 1 };
  }

  if (a.googlePlaceId && b.googlePlaceId && a.googlePlaceId === b.googlePlaceId) {
    return { matched: true, reason: 'googlePlaceId', score: 1 };
  }

  const domainA = a.websiteDomain || extractDomain(a.website);
  const domainB = b.websiteDomain || extractDomain(b.website);
  if (
    domainA &&
    domainB &&
    domainA === domainB &&
    isDedupableWebsiteDomain(domainA) &&
    nameScore >= IDENTITY_THRESHOLDS.domainNameGate
  ) {
    return { matched: true, reason: 'websiteDomain', score: 0.98 };
  }

  const phoneA = a.phoneNormalized || normalizePhoneMk(a.phone);
  const phoneB = b.phoneNormalized || normalizePhoneMk(b.phone);
  if (phoneA && phoneB && phoneA === phoneB && nameScore >= IDENTITY_THRESHOLDS.phoneNameGate) {
    return { matched: true, reason: 'phone', score: 0.95 };
  }

  const emailA = normalizeEmail(a.email);
  const emailB = normalizeEmail(b.email);
  if (emailA && emailB && emailA === emailB && nameScore >= IDENTITY_THRESHOLDS.emailNameGate) {
    return { matched: true, reason: 'email', score: 0.95 };
  }

  const addrScore = addressSimilarity(a.address, b.address);
  const citiesOk = sameCity(a.city, b.city);
  const tokenOverlap = significantTokenOverlap(a.name, b.name);

  if (addrScore >= IDENTITY_THRESHOLDS.addressWithTokenOverlap && tokenOverlap && citiesOk) {
    return { matched: true, reason: 'address', score: Math.max(addrScore, nameScore) };
  }

  if (
    addrScore >= IDENTITY_THRESHOLDS.addressStrong &&
    nameScore >= IDENTITY_THRESHOLDS.addressStrongNameGate &&
    citiesOk
  ) {
    return { matched: true, reason: 'address', score: addrScore };
  }

  if (nameScore >= IDENTITY_THRESHOLDS.nameAlone && citiesOk) {
    return { matched: true, reason: 'name', score: nameScore };
  }

  // Shared distinctive token (e.g. ABC DOOEL ↔ ABC Printing) in the same city
  if (tokenOverlap && citiesOk && nameScore >= IDENTITY_THRESHOLDS.nameWithTokenOverlap) {
    return { matched: true, reason: 'name', score: Math.max(nameScore, 0.7) };
  }

  return { matched: false, score: Math.max(addrScore, nameScore) };
}
