import axios from 'axios';
import * as cheerio from 'cheerio';
import { scoreLead } from '@leadhunter/lead-scoring';
import type {
  AuditIssueInput,
  DesignAgeEstimate,
  WebsiteAuditResult,
} from '@leadhunter/shared';
import { normalizeUrl } from '@leadhunter/shared';
import { generateRuleBasedRecommendations } from './ai-audit';
import { runLighthouse } from './lighthouse';
import {
  analyzeWebsiteForOutreach,
  extractHtmlOutreachSignals,
} from './outreach-analysis';
import { detectPlaceholderSite } from './placeholder-detection';

export interface AuditOptions {
  lightweight?: boolean;
  lighthouseTimeoutMs?: number;
  hasEmail?: boolean;
  hasPhone?: boolean;
  hasGooglePresence?: boolean;
  industry?: string | null;
  sourceQualityScore?: number | null;
}

export async function auditWebsite(
  website: string | null | undefined,
  options: AuditOptions = {},
): Promise<WebsiteAuditResult> {
  const url = normalizeUrl(website);
  if (!url) {
    const score = scoreLead({
      websiteExists: false,
      websiteAccessible: false,
      sslEnabled: false,
      mobileFriendly: false,
      lighthousePerformance: null,
      lighthouseSeo: null,
      lighthouseAccessibility: null,
      hasContactForm: false,
      hasGoogleMaps: false,
      hasSocialLinks: false,
      hasPrivacyPolicy: false,
      hasCookieNotice: false,
      designAgeEstimate: 'unknown',
      hasEmail: Boolean(options.hasEmail),
      hasPhone: Boolean(options.hasPhone),
      hasGooglePresence: Boolean(options.hasGooglePresence),
      industry: options.industry,
      sourceQualityScore: options.sourceQualityScore,
    });
    const issues: AuditIssueInput[] = [
      {
        code: 'NO_WEBSITE',
        severity: 'CRITICAL',
        title: 'No website',
        description: 'Company has no website URL on record.',
      },
    ];
    const outreachAnalysis = analyzeWebsiteForOutreach({
      websiteExists: false,
      websiteAccessible: false,
      sslEnabled: false,
      mobileFriendly: false,
      hasContactForm: false,
      hasGoogleMaps: Boolean(options.hasGooglePresence),
      hasSocialLinks: false,
      designAgeEstimate: 'unknown',
      lighthousePerformance: null,
      hasPhone: Boolean(options.hasPhone),
      hasEmail: Boolean(options.hasEmail),
    });
    return {
      websiteExists: false,
      websiteAccessible: false,
      sslEnabled: false,
      mobileFriendly: false,
      lighthousePerformance: null,
      lighthouseSeo: null,
      lighthouseAccessibility: null,
      lighthouseBestPractices: null,
      hasContactForm: false,
      hasGoogleMaps: false,
      hasSocialLinks: false,
      hasPrivacyPolicy: false,
      hasCookieNotice: false,
      designAgeEstimate: 'unknown',
      isPlaceholderSite: false,
      placeholderSignals: [],
      auditSummary: 'No website found. Highest opportunity for a new website project.',
      aiRecommendations: generateRuleBasedRecommendations({
        companyName: 'Company',
        score,
        issues,
        designAgeEstimate: 'unknown',
      }),
      issues,
      score,
      outreachAnalysis,
    };
  }

  const sslEnabled = url.startsWith('https://');
  let accessible = false;
  let html = '';
  let finalUrl = url;

  try {
    const res = await axios.get<string>(url, {
      timeout: 25000,
      maxRedirects: 5,
      responseType: 'text',
      headers: {
        'User-Agent':
          'LeadHunterMK/1.0 (+https://localhost; website audit)',
        Accept: 'text/html',
      },
      validateStatus: (s) => s >= 200 && s < 400,
    });
    accessible = true;
    html = typeof res.data === 'string' ? res.data : '';
    finalUrl = res.request?.res?.responseUrl || url;
  } catch {
    accessible = false;
  }

  if (!accessible) {
    const score = scoreLead({
      websiteExists: true,
      websiteAccessible: false,
      sslEnabled,
      mobileFriendly: false,
      lighthousePerformance: null,
      lighthouseSeo: null,
      lighthouseAccessibility: null,
      hasContactForm: false,
      hasGoogleMaps: false,
      hasSocialLinks: false,
      hasPrivacyPolicy: false,
      hasCookieNotice: false,
      designAgeEstimate: 'unknown',
      hasEmail: Boolean(options.hasEmail),
      hasPhone: Boolean(options.hasPhone),
      hasGooglePresence: Boolean(options.hasGooglePresence),
      industry: options.industry,
      sourceQualityScore: options.sourceQualityScore,
    });
    const issues: AuditIssueInput[] = [
      {
        code: 'WEBSITE_INACCESSIBLE',
        severity: 'CRITICAL',
        title: 'Website inaccessible',
        description: `Could not load ${url}`,
      },
    ];
    if (!sslEnabled) {
      issues.push({
        code: 'NO_SSL',
        severity: 'HIGH',
        title: 'No SSL',
        description: 'Website does not use HTTPS.',
      });
    }
    const outreachAnalysis = analyzeWebsiteForOutreach({
      websiteExists: true,
      websiteAccessible: false,
      sslEnabled,
      mobileFriendly: false,
      hasContactForm: false,
      hasGoogleMaps: Boolean(options.hasGooglePresence),
      hasSocialLinks: false,
      designAgeEstimate: 'unknown',
      lighthousePerformance: null,
      hasPhone: Boolean(options.hasPhone),
      hasEmail: Boolean(options.hasEmail),
    });
    return {
      websiteExists: true,
      websiteAccessible: false,
      sslEnabled,
      mobileFriendly: false,
      lighthousePerformance: null,
      lighthouseSeo: null,
      lighthouseAccessibility: null,
      lighthouseBestPractices: null,
      hasContactForm: false,
      hasGoogleMaps: false,
      hasSocialLinks: false,
      hasPrivacyPolicy: false,
      hasCookieNotice: false,
      designAgeEstimate: 'unknown',
      isPlaceholderSite: false,
      placeholderSignals: [],
      auditSummary: 'Website URL exists but is not accessible.',
      aiRecommendations: generateRuleBasedRecommendations({
        companyName: 'Company',
        score,
        issues,
        designAgeEstimate: 'unknown',
      }),
      issues,
      score,
      outreachAnalysis,
    };
  }

  const $ = cheerio.load(html);
  const viewport = $('meta[name="viewport"]').attr('content') || '';
  const mobileFriendly =
    /width\s*=\s*device-width/i.test(viewport) ||
    Boolean($('link[rel="stylesheet"]').length && html.includes('@media'));
  const htmlSignals = extractHtmlOutreachSignals($, html);

  const hasContactForm =
    $('form').filter((_, el) => {
      const action = ($(el).attr('action') || '').toLowerCase();
      const htmlForm = $(el).html()?.toLowerCase() || '';
      return (
        htmlForm.includes('email') ||
        htmlForm.includes('message') ||
        htmlForm.includes('contact') ||
        action.includes('contact')
      );
    }).length > 0 ||
    html.toLowerCase().includes('contact-form') ||
    html.toLowerCase().includes('wpcf7');

  const hasGoogleMaps =
    html.includes('maps.google') ||
    html.includes('google.com/maps') ||
    html.includes('maps.googleapis.com');

  const hasSocialLinks =
    $('a[href*="facebook.com"], a[href*="linkedin.com"], a[href*="instagram.com"], a[href*="twitter.com"], a[href*="x.com"]').length >
    0;

  const hasPrivacyPolicy =
    $('a').filter((_, el) => /privacy|приватност/i.test($(el).text()) || /privacy/i.test($(el).attr('href') || '')).length >
    0;

  const hasCookieNotice =
    /cookie|колачињ/i.test(html) &&
    (/consent|accept|прифат/i.test(html) || $('#cookie, .cookie, .cookie-banner, #cookie-notice').length > 0);

  const designAgeEstimate = estimateDesignAge($, html);

  const placeholder = detectPlaceholderSite($, html, {
    hasContactForm,
    hasNav: htmlSignals.hasNav,
    serviceCopyLikely: htmlSignals.serviceCopyLikely,
  });

  let lighthousePerformance: number | null = null;
  let lighthouseSeo: number | null = null;
  let lighthouseAccessibility: number | null = null;
  let lighthouseBestPractices: number | null = null;

  if (!options.lightweight) {
    try {
      const lh = await runLighthouse(finalUrl, options.lighthouseTimeoutMs ?? 120000);
      lighthousePerformance = lh.performance;
      lighthouseSeo = lh.seo;
      lighthouseAccessibility = lh.accessibility;
      lighthouseBestPractices = lh.bestPractices;
      if (lh.seo !== null && mobileFriendly === false && lh.seo < 70) {
        // keep heuristic
      }
      if (lh.performance !== null) {
        // ok
      }
    } catch {
      // Fall back to heuristics only
      const heuristic = heuristicScores($, html, mobileFriendly, sslEnabled);
      lighthousePerformance = heuristic.performance;
      lighthouseSeo = heuristic.seo;
      lighthouseAccessibility = heuristic.accessibility;
      lighthouseBestPractices = heuristic.bestPractices;
    }
  } else {
    const heuristic = heuristicScores($, html, mobileFriendly, sslEnabled);
    lighthousePerformance = heuristic.performance;
    lighthouseSeo = heuristic.seo;
    lighthouseAccessibility = heuristic.accessibility;
    lighthouseBestPractices = heuristic.bestPractices;
  }

  const issues = buildIssues({
    sslEnabled,
    mobileFriendly,
    hasContactForm,
    hasPrivacyPolicy,
    hasCookieNotice,
    hasSocialLinks,
    hasGoogleMaps,
    designAgeEstimate,
    lighthousePerformance,
    lighthouseSeo,
    lighthouseAccessibility,
    isPlaceholderSite: placeholder.isPlaceholderSite,
  });

  const score = scoreLead({
    websiteExists: true,
    websiteAccessible: true,
    sslEnabled,
    mobileFriendly,
    lighthousePerformance,
    lighthouseSeo,
    lighthouseAccessibility,
    hasContactForm,
    hasGoogleMaps,
    hasSocialLinks,
    hasPrivacyPolicy,
    hasCookieNotice,
    designAgeEstimate,
    isPlaceholderSite: placeholder.isPlaceholderSite,
    hasEmail: Boolean(options.hasEmail),
    hasPhone: Boolean(options.hasPhone),
    hasGooglePresence: Boolean(options.hasGooglePresence),
    industry: options.industry,
    sourceQualityScore: options.sourceQualityScore,
  });

  const auditSummary = buildSummary(
    score.score,
    issues,
    designAgeEstimate,
    placeholder.isPlaceholderSite,
  );
  const outreachAnalysis = analyzeWebsiteForOutreach({
    websiteExists: true,
    websiteAccessible: true,
    sslEnabled,
    mobileFriendly,
    hasContactForm,
    hasGoogleMaps: hasGoogleMaps || Boolean(options.hasGooglePresence),
    hasSocialLinks,
    designAgeEstimate,
    lighthousePerformance,
    hasPhone: Boolean(options.hasPhone),
    hasEmail: Boolean(options.hasEmail),
    isPlaceholderSite: placeholder.isPlaceholderSite,
    htmlSignals,
  });

  return {
    websiteExists: true,
    websiteAccessible: true,
    sslEnabled,
    mobileFriendly,
    lighthousePerformance,
    lighthouseSeo,
    lighthouseAccessibility,
    lighthouseBestPractices,
    hasContactForm,
    hasGoogleMaps,
    hasSocialLinks,
    hasPrivacyPolicy,
    hasCookieNotice,
    designAgeEstimate,
    isPlaceholderSite: placeholder.isPlaceholderSite,
    placeholderSignals: placeholder.placeholderSignals,
    auditSummary,
    aiRecommendations: generateRuleBasedRecommendations({
      companyName: 'Company',
      score,
      issues,
      designAgeEstimate,
    }),
    issues,
    score,
    outreachAnalysis,
  };
}

function estimateDesignAge($: cheerio.CheerioAPI, html: string): DesignAgeEstimate {
  const lower = html.toLowerCase();
  const outdatedSignals = [
    'table width=',
    '<font ',
    'guestbook',
    'marquee',
    'macromedia',
    'frontpage',
    'jquery-1.4',
    'jquery-1.5',
    'jquery-1.6',
    'jquery-1.7',
    'bootstrap/3',
    'bootstrap.min.css" rel="stylesheet"',
  ];
  const modernSignals = [
    'tailwind',
    'next/static',
    '__next',
    'wp-content',
    'elementor',
    'webflow',
    'framer',
    'srcset',
    'loading="lazy"',
    'display: flex',
    'display:flex',
    'display: grid',
  ];

  let outdated = outdatedSignals.filter((s) => lower.includes(s)).length;
  let modern = modernSignals.filter((s) => lower.includes(s)).length;

  if (!$('meta[name="viewport"]').length) outdated += 2;
  if ($('table').length > 8 && $('div').length < 20) outdated += 2;
  if ($('nav').length && $('header').length) modern += 1;

  if (outdated >= 3 && outdated > modern) return 'outdated';
  if (outdated >= 1 && modern < 2) return 'aging';
  if (modern >= 2) return 'modern';
  return 'aging';
}

function heuristicScores(
  $: cheerio.CheerioAPI,
  html: string,
  mobileFriendly: boolean,
  sslEnabled: boolean,
) {
  const title = $('title').text().trim();
  const description = $('meta[name="description"]').attr('content') || '';
  const h1 = $('h1').length;
  const imagesWithoutAlt = $('img:not([alt]), img[alt=""]').length;

  let seo = 50;
  if (title) seo += 15;
  if (description.length > 40) seo += 15;
  if (h1 === 1) seo += 10;
  if (mobileFriendly) seo += 5;
  if (!sslEnabled) seo -= 10;

  let accessibility = 60;
  if (imagesWithoutAlt === 0) accessibility += 15;
  else accessibility -= Math.min(20, imagesWithoutAlt * 2);
  if ($('[role], nav, main, header, footer').length) accessibility += 10;

  let performance = 55;
  if (html.length < 200_000) performance += 10;
  if (html.length > 800_000) performance -= 20;
  if ($('script').length > 25) performance -= 10;
  if (mobileFriendly) performance += 5;

  let bestPractices = sslEnabled ? 80 : 40;
  if (/jquery-1\.[0-8]/.test(html)) bestPractices -= 15;

  return {
    performance: clampScore(performance),
    seo: clampScore(seo),
    accessibility: clampScore(accessibility),
    bestPractices: clampScore(bestPractices),
  };
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function buildIssues(input: {
  sslEnabled: boolean;
  mobileFriendly: boolean;
  hasContactForm: boolean;
  hasPrivacyPolicy: boolean;
  hasCookieNotice: boolean;
  hasSocialLinks: boolean;
  hasGoogleMaps: boolean;
  designAgeEstimate: DesignAgeEstimate;
  lighthousePerformance: number | null;
  lighthouseSeo: number | null;
  lighthouseAccessibility: number | null;
  isPlaceholderSite?: boolean;
}): AuditIssueInput[] {
  const issues: AuditIssueInput[] = [];
  if (input.isPlaceholderSite) {
    issues.push({
      code: 'PLACEHOLDER_SITE',
      severity: 'CRITICAL',
      title: 'Placeholder / under construction',
      description:
        'Site appears to be under construction or only redirects visitors to social media.',
    });
  }
  if (!input.sslEnabled) {
    issues.push({
      code: 'NO_SSL',
      severity: 'HIGH',
      title: 'No SSL',
      description: 'Site is not served over HTTPS.',
    });
  }
  if (!input.mobileFriendly) {
    issues.push({
      code: 'NO_MOBILE',
      severity: 'HIGH',
      title: 'No mobile support',
      description: 'Missing or weak responsive viewport configuration.',
    });
  }
  if (!input.hasContactForm) {
    issues.push({
      code: 'NO_CONTACT_FORM',
      severity: 'MEDIUM',
      title: 'Missing contact form',
      description: 'No clear contact form detected on the homepage.',
    });
  }
  if (input.lighthousePerformance !== null && input.lighthousePerformance < 50) {
    issues.push({
      code: 'SLOW_WEBSITE',
      severity: 'HIGH',
      title: 'Slow website',
      description: `Performance score ${input.lighthousePerformance}.`,
    });
  }
  if (input.lighthouseSeo !== null && input.lighthouseSeo < 60) {
    issues.push({
      code: 'POOR_SEO',
      severity: 'HIGH',
      title: 'Poor SEO',
      description: `SEO score ${input.lighthouseSeo}.`,
    });
  }
  if (input.lighthouseAccessibility !== null && input.lighthouseAccessibility < 70) {
    issues.push({
      code: 'ACCESSIBILITY',
      severity: 'MEDIUM',
      title: 'Accessibility issues',
      description: `Accessibility score ${input.lighthouseAccessibility}.`,
    });
  }
  if (input.designAgeEstimate === 'outdated') {
    issues.push({
      code: 'OUTDATED_DESIGN',
      severity: 'CRITICAL',
      title: 'Outdated design',
      description: 'Technical signals suggest a very outdated website design.',
    });
  } else if (input.designAgeEstimate === 'aging') {
    issues.push({
      code: 'AGING_DESIGN',
      severity: 'MEDIUM',
      title: 'Aging design',
      description: 'Website design appears aging and may need a refresh.',
    });
  }
  if (!input.hasPrivacyPolicy) {
    issues.push({
      code: 'NO_PRIVACY',
      severity: 'LOW',
      title: 'Missing privacy policy',
      description: 'No privacy policy link detected.',
    });
  }
  if (!input.hasCookieNotice) {
    issues.push({
      code: 'NO_COOKIE_NOTICE',
      severity: 'LOW',
      title: 'Missing cookie notice',
      description: 'No cookie consent notice detected.',
    });
  }
  if (!input.hasSocialLinks) {
    issues.push({
      code: 'NO_SOCIAL',
      severity: 'LOW',
      title: 'No social links',
      description: 'No Facebook/LinkedIn/Instagram links found.',
    });
  }
  if (!input.hasGoogleMaps) {
    issues.push({
      code: 'NO_MAPS',
      severity: 'LOW',
      title: 'No Google Maps',
      description: 'No Google Maps embed detected.',
    });
  }
  return issues;
}

function buildSummary(
  score: number,
  issues: AuditIssueInput[],
  designAgeEstimate: DesignAgeEstimate,
  isPlaceholderSite = false,
): string {
  const top = issues
    .filter((i) => i.severity === 'CRITICAL' || i.severity === 'HIGH')
    .map((i) => i.title)
    .slice(0, 4);
  const issueText = top.length ? top.join('; ') : 'No critical issues detected';
  const placeholderBit = isPlaceholderSite
    ? ' Placeholder/under-construction site detected.'
    : '';
  return `Lead score ${score}/100. Design age: ${designAgeEstimate}.${placeholderBit} Key findings: ${issueText}.`;
}
