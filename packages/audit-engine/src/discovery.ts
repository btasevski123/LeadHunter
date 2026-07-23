import { normalizeUrl } from '@leadhunter/shared';

export interface DiscoveryResult {
  discoveredUrl: string;
  kind: 'WEBSITE' | 'FACEBOOK' | 'LINKEDIN' | 'INSTAGRAM';
  confidence: number;
  method: string;
}

/**
 * Website / social discovery heuristics for companies missing a website.
 * Uses name+city domain guessing and known social URL patterns.
 * Does not call paid search APIs in v1.
 */
export async function discoverWebsitePresence(input: {
  name: string;
  city?: string | null;
  website?: string | null;
  facebookUrl?: string | null;
  linkedinUrl?: string | null;
  instagramUrl?: string | null;
}): Promise<DiscoveryResult[]> {
  const results: DiscoveryResult[] = [];

  if (input.website) {
    const url = normalizeUrl(input.website);
    if (url) {
      results.push({
        discoveredUrl: url,
        kind: 'WEBSITE',
        confidence: 1,
        method: 'existing_record',
      });
    }
  }

  if (input.facebookUrl) {
    const url = normalizeUrl(input.facebookUrl);
    if (url) {
      results.push({
        discoveredUrl: url,
        kind: 'FACEBOOK',
        confidence: 0.95,
        method: 'existing_record',
      });
    }
  }
  if (input.linkedinUrl) {
    const url = normalizeUrl(input.linkedinUrl);
    if (url) {
      results.push({
        discoveredUrl: url,
        kind: 'LINKEDIN',
        confidence: 0.95,
        method: 'existing_record',
      });
    }
  }
  if (input.instagramUrl) {
    const url = normalizeUrl(input.instagramUrl);
    if (url) {
      results.push({
        discoveredUrl: url,
        kind: 'INSTAGRAM',
        confidence: 0.95,
        method: 'existing_record',
      });
    }
  }

  if (!input.website) {
    const slug = slugifyMk(input.name);
    const latinSlug = slugifyLatin(input.name);
    const slugs = Array.from(new Set([slug, latinSlug].filter(Boolean)));
    const candidates: string[] = [];
    for (const s of slugs) {
      candidates.push(
        `https://${s}.mk`,
        `https://www.${s}.mk`,
        `http://${s}.mk`,
        `https://${s}.com.mk`,
      );
    }

    for (const candidate of candidates) {
      const ok = await probeUrl(candidate);
      if (ok) {
        results.push({
          discoveredUrl: candidate,
          kind: 'WEBSITE',
          confidence: candidate.includes('.mk') ? 0.72 : 0.55,
          method: 'domain_guess_probe',
        });
        break;
      }
    }

    // Social guess from slug (confidence lower — stored for operator review)
    const socialSlug = latinSlug || slug;
    results.push({
      discoveredUrl: `https://facebook.com/${socialSlug}`,
      kind: 'FACEBOOK',
      confidence: 0.25,
      method: 'social_slug_guess',
    });
  }

  return results;
}

function slugifyMk(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .slice(0, 40);
}

/** Cyrillic/MK → Latin slug so guesses like avtoatom.mk work for АВТО АТОМ. */
function slugifyLatin(name: string): string {
  const map: Record<string, string> = {
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
  };
  const lower = name.toLowerCase();
  let out = '';
  for (const ch of lower) {
    out += map[ch] ?? ch;
  }
  return out
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .slice(0, 40);
}

async function probeUrl(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: { 'User-Agent': 'LeadHunterMK/1.0' },
      });
      clearTimeout(timer);
      return res.ok;
    } catch {
      return false;
    }
  }
}
