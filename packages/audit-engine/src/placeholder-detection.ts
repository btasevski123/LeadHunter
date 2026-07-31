import type * as cheerio from 'cheerio';

export const PLACEHOLDER_SIGNALS = [
  'under_construction_text',
  'social_only_links',
  'thin_content',
  'no_business_structure',
] as const;

export type PlaceholderSignal = (typeof PLACEHOLDER_SIGNALS)[number];

export interface PlaceholderDetectionInput {
  hasContactForm?: boolean;
  hasNav?: boolean;
  serviceCopyLikely?: boolean;
}

export interface PlaceholderDetectionResult {
  isPlaceholderSite: boolean;
  placeholderSignals: PlaceholderSignal[];
}

const UNDER_CONSTRUCTION_RE =
  /under\s*construction|coming\s*soon|site\s*under\s*construction|page\s*(is\s*)?under\s*construction|во\s*изработка|во\s*изградба|наскоро|скоро\s*(ќе|ke)|во подготовка|underconstr|comingsoon|lanceras snart|en construction/i;

const SOCIAL_HOST_RE =
  /facebook\.com|fb\.com|instagram\.com|tiktok\.com|linkedin\.com|twitter\.com|x\.com|youtube\.com|wa\.me|api\.whatsapp\.com/i;

/**
 * Detects placeholder / under-construction / social-only landing pages
 * (e.g. domain live with "во изработка" + FB/IG buttons only).
 *
 * Rules:
 * - under_construction_text alone → placeholder
 * - otherwise need ≥2 signals among the rest
 */
export function detectPlaceholderSite(
  $: cheerio.CheerioAPI,
  html: string,
  input: PlaceholderDetectionInput = {},
): PlaceholderDetectionResult {
  const signals: PlaceholderSignal[] = [];
  const text = visibleText($);
  const lowerHtml = html.toLowerCase();

  if (UNDER_CONSTRUCTION_RE.test(text) || UNDER_CONSTRUCTION_RE.test(lowerHtml)) {
    signals.push('under_construction_text');
  }

  if (isThinContent(text, $)) {
    signals.push('thin_content');
  }

  if (isSocialOnlyLinks($)) {
    signals.push('social_only_links');
  }

  const hasNav = input.hasNav ?? false;
  const serviceCopyLikely = input.serviceCopyLikely ?? false;
  const hasContactForm = input.hasContactForm ?? false;
  if (!hasNav && !serviceCopyLikely && !hasContactForm) {
    signals.push('no_business_structure');
  }

  const isPlaceholderSite =
    signals.includes('under_construction_text') ||
    countNonConstructionSignals(signals) >= 2;

  return {
    isPlaceholderSite,
    placeholderSignals: signals,
  };
}

function countNonConstructionSignals(signals: PlaceholderSignal[]): number {
  return signals.filter((s) => s !== 'under_construction_text').length;
}

function visibleText($: cheerio.CheerioAPI): string {
  const clone = $.root().clone();
  clone.find('script, style, noscript, svg').remove();
  return clone.text().replace(/\s+/g, ' ').trim();
}

function isThinContent(text: string, $: cheerio.CheerioAPI): boolean {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length > 0 && words.length < 45) return true;
  if (text.length > 0 && text.length < 220) return true;

  const sections = $('main, section, article, .content, #content').length;
  const headings = $('h1, h2, h3').length;
  const paragraphs = $('p').filter((_, el) => ($(el).text() || '').trim().length > 30).length;
  if (sections <= 1 && headings <= 2 && paragraphs <= 1 && words.length < 80) {
    return true;
  }
  return false;
}

function isSocialOnlyLinks($: cheerio.CheerioAPI): boolean {
  const anchors = $('a[href]')
    .toArray()
    .map((el) => String($(el).attr('href') || '').trim())
    .filter((href) => {
      if (!href) return false;
      const lower = href.toLowerCase();
      if (lower.startsWith('#')) return false;
      if (lower.startsWith('javascript:')) return false;
      if (lower.startsWith('mailto:')) return false;
      if (lower.startsWith('tel:')) return false;
      return true;
    });

  if (anchors.length === 0 || anchors.length > 6) return false;

  const social = anchors.filter((href) => SOCIAL_HOST_RE.test(href));
  if (social.length === 0) return false;

  const nonSocialContent = anchors.filter((href) => {
    if (SOCIAL_HOST_RE.test(href)) return false;
    // Home / empty path does not count as real site structure
    if (href === '/' || href === './') return false;
    try {
      if (/^https?:\/\//i.test(href)) {
        const u = new URL(href);
        return u.pathname !== '/' && u.pathname.length > 1;
      }
    } catch {
      return true;
    }
    return href.startsWith('/') ? href.length > 1 : true;
  });

  return nonSocialContent.length === 0 && social.length / anchors.length >= 0.5;
}
