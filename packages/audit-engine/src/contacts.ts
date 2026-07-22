import axios from 'axios';
import * as cheerio from 'cheerio';
import {
  BUSINESS_EMAIL_PREFIXES,
  isLikelyBusinessEmail,
  normalizeEmail,
  normalizePhoneMk,
  normalizeUrl,
} from '@leadhunter/shared';

export interface DiscoveredContact {
  type: 'EMAIL' | 'PHONE' | 'FACEBOOK' | 'LINKEDIN' | 'INSTAGRAM' | 'OTHER';
  value: string;
  sourceUrl: string;
  confidence: number;
  isPrimary: boolean;
}

export async function discoverContacts(input: {
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  facebookUrl?: string | null;
  linkedinUrl?: string | null;
  instagramUrl?: string | null;
}): Promise<DiscoveredContact[]> {
  const results: DiscoveredContact[] = [];
  const seen = new Set<string>();

  const add = (c: DiscoveredContact) => {
    const key = `${c.type}:${c.value.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    results.push(c);
  };

  if (input.email) {
    const email = normalizeEmail(input.email);
    if (email) {
      add({
        type: 'EMAIL',
        value: email,
        sourceUrl: 'record',
        confidence: 0.95,
        isPrimary: true,
      });
    }
  }
  if (input.phone) {
    const phone = normalizePhoneMk(input.phone) || input.phone;
    add({
      type: 'PHONE',
      value: phone,
      sourceUrl: 'record',
      confidence: 0.9,
      isPrimary: true,
    });
  }
  for (const [type, value] of [
    ['FACEBOOK', input.facebookUrl],
    ['LINKEDIN', input.linkedinUrl],
    ['INSTAGRAM', input.instagramUrl],
  ] as const) {
    const url = normalizeUrl(value);
    if (url) {
      add({ type, value: url, sourceUrl: 'record', confidence: 0.9, isPrimary: true });
    }
  }

  const website = normalizeUrl(input.website);
  if (!website) return prioritize(results);

  const paths = [
    '/',
    '/contact',
    '/contact-us',
    '/kontakt',
    '/kontaktirajte-ne',
    '/kontakti',
    '/about',
    '/about-us',
    '/za-nas',
    '/za-nas',
    '/company',
  ];
  for (const p of paths) {
    const pageUrl = new URL(p, website).toString();
    try {
      const html = await fetchHtml(pageUrl);
      if (!html) continue;
      extractFromHtml(html, pageUrl, add);
      // Footer is part of homepage HTML; also scan footer-only snippets when present
      const $ = cheerio.load(html);
      const footerHtml = $('footer').html() || $('[class*="footer"]').html();
      if (footerHtml) extractFromHtml(footerHtml, pageUrl, add);
    } catch {
      // continue
    }
  }

  return prioritize(results);
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await axios.get<string>(url, {
      timeout: 15000,
      responseType: 'text',
      headers: {
        'User-Agent': 'LeadHunterMK/1.0 (+https://localhost; contact discovery)',
        Accept: 'text/html',
      },
      validateStatus: (s) => s >= 200 && s < 400,
    });
    return typeof res.data === 'string' ? res.data : null;
  } catch {
    return null;
  }
}

function extractFromHtml(
  html: string,
  sourceUrl: string,
  add: (c: DiscoveredContact) => void,
) {
  const $ = cheerio.load(html);

  $('a[href^="mailto:"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const email = normalizeEmail(href.replace(/^mailto:/i, '').split('?')[0]);
    if (!email) return;
    add({
      type: 'EMAIL',
      value: email,
      sourceUrl,
      confidence: confidenceForEmail(email),
      isPrimary: false,
    });
  });

  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const textEmails = html.match(emailRegex) || [];
  for (const raw of textEmails) {
    const email = normalizeEmail(raw);
    if (!email) continue;
    if (email.endsWith('.png') || email.endsWith('.jpg')) continue;
    add({
      type: 'EMAIL',
      value: email,
      sourceUrl,
      confidence: confidenceForEmail(email) * 0.9,
      isPrimary: false,
    });
  }

  $('a[href^="tel:"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const phone = normalizePhoneMk(href.replace(/^tel:/i, '')) || href.replace(/^tel:/i, '');
    if (!phone) return;
    add({
      type: 'PHONE',
      value: phone,
      sourceUrl,
      confidence: 0.75,
      isPrimary: false,
    });
  });

  $('a[href*="facebook.com"]').each((_, el) => {
    const href = normalizeUrl($(el).attr('href'));
    if (href) add({ type: 'FACEBOOK', value: href, sourceUrl, confidence: 0.85, isPrimary: false });
  });
  $('a[href*="linkedin.com"]').each((_, el) => {
    const href = normalizeUrl($(el).attr('href'));
    if (href) add({ type: 'LINKEDIN', value: href, sourceUrl, confidence: 0.85, isPrimary: false });
  });
  $('a[href*="instagram.com"]').each((_, el) => {
    const href = normalizeUrl($(el).attr('href'));
    if (href) add({ type: 'INSTAGRAM', value: href, sourceUrl, confidence: 0.85, isPrimary: false });
  });
}

function confidenceForEmail(email: string): number {
  if (isLikelyBusinessEmail(email)) return 0.92;
  const local = email.split('@')[0] || '';
  if (BUSINESS_EMAIL_PREFIXES.some((p) => local.includes(p))) return 0.85;
  if (local.includes('.') || local.includes('_')) return 0.55;
  return 0.65;
}

function prioritize(contacts: DiscoveredContact[]): DiscoveredContact[] {
  const emails = contacts
    .filter((c) => c.type === 'EMAIL')
    .sort((a, b) => b.confidence - a.confidence);
  if (emails[0]) {
    for (const e of emails) e.isPrimary = false;
    emails[0].isPrimary = true;
  }
  return contacts.sort((a, b) => b.confidence - a.confidence);
}
