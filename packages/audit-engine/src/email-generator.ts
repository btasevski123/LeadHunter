import type { ScoreResult } from '@leadhunter/shared';
import {
  analyzeWebsiteForOutreach,
  pickOutreachEmailFacts,
  type OutreachWebsiteAnalysis,
} from './outreach-analysis';

export type EmailLanguage = 'en' | 'mk';

export interface WebsiteIssueInput {
  title: string;
  description?: string | null;
  severity?: string | null;
}

export interface EmailGeneratorInput {
  companyName: string;
  industry?: string | null;
  city?: string | null;
  website?: string | null;
  contactName?: string | null;
  recipientEmail?: string | null;
  /** Internal only — never mentioned in the email text. */
  score?: ScoreResult | null;
  auditSummary?: string | null;
  aiRecommendations?: string | null;
  classification?: string | null;
  recommendedService?: string | null;
  websiteIssues?: WebsiteIssueInput[];
  /**
   * Structured analyzer output. Templates may ONLY fill slots from
   * these lists (exactly one positive, one primary issue).
   */
  outreachAnalysis?: OutreachWebsiteAnalysis | null;
  /** Fallback signals when outreachAnalysis was not persisted yet. */
  auditSignals?: {
    websiteExists?: boolean;
    websiteAccessible?: boolean;
    sslEnabled?: boolean;
    mobileFriendly?: boolean;
    hasContactForm?: boolean;
    hasGoogleMaps?: boolean;
    hasSocialLinks?: boolean;
    designAgeEstimate?: 'modern' | 'aging' | 'outdated' | 'unknown';
    lighthousePerformance?: number | null;
    hasPhone?: boolean;
    hasEmail?: boolean;
  } | null;
  senderName?: string | null;
  senderCompany?: string | null;
  kind?: 'OUTREACH' | 'FOLLOW_UP';
  language?: EmailLanguage;
}

export interface GeneratedEmail {
  subject: string;
  content: string;
  language: EmailLanguage;
  /** Always templates — kept for API/UI compatibility. */
  source: 'template';
}

/** Resolve the analyzer payload used for email facts (never invent outside vocab). */
export function resolveOutreachAnalysis(
  input: EmailGeneratorInput,
): OutreachWebsiteAnalysis {
  if (input.outreachAnalysis) {
    return {
      positive_observations: input.outreachAnalysis.positive_observations || [],
      issues: input.outreachAnalysis.issues || [],
    };
  }

  const s = input.auditSignals;
  if (s) {
    return analyzeWebsiteForOutreach({
      websiteExists: s.websiteExists ?? Boolean(input.website),
      websiteAccessible: s.websiteAccessible ?? Boolean(input.website),
      sslEnabled: Boolean(s.sslEnabled),
      mobileFriendly: Boolean(s.mobileFriendly),
      hasContactForm: Boolean(s.hasContactForm),
      hasGoogleMaps: Boolean(s.hasGoogleMaps),
      hasSocialLinks: Boolean(s.hasSocialLinks),
      designAgeEstimate: s.designAgeEstimate || 'unknown',
      lighthousePerformance: s.lighthousePerformance ?? null,
      hasPhone: Boolean(s.hasPhone),
      hasEmail: Boolean(s.hasEmail || input.recipientEmail),
    });
  }

  return analyzeWebsiteForOutreach({
    websiteExists: Boolean(input.website),
    websiteAccessible: Boolean(input.website),
    sslEnabled: true,
    mobileFriendly: true,
    hasContactForm: false,
    hasGoogleMaps: false,
    hasSocialLinks: false,
    designAgeEstimate: 'unknown',
    lighthousePerformance: null,
    hasEmail: Boolean(input.recipientEmail),
  });
}

/**
 * Facts templates are allowed to mention.
 * Exactly one positive (if any). One primary issue. Nothing invented.
 */
export function buildOutreachBrief(input: EmailGeneratorInput): {
  observations: string[];
  issues: string[];
  hasWebsite: boolean;
  positive: string | null;
} {
  const analysis = resolveOutreachAnalysis(input);
  const picked = pickOutreachEmailFacts(analysis);
  return {
    observations: picked.positive ? [picked.positive] : [],
    issues: picked.issues,
    hasWebsite: Boolean(input.website) && !analysis.issues.includes('No active website'),
    positive: picked.positive,
  };
}

/** Fill MK/EN outreach templates from analyzer facts — no AI. */
export async function generateOutreachEmail(
  input: EmailGeneratorInput,
): Promise<GeneratedEmail> {
  const language: EmailLanguage = input.language === 'mk' ? 'mk' : 'en';
  const draft = generateTemplateEmail({ ...input, language });

  return {
    subject: scrubBannedPhrases(draft.subject),
    content: scrubBannedPhrases(draft.content),
    language,
    source: 'template',
  };
}

function senderSignOff(input: EmailGeneratorInput): string {
  const name = input.senderName?.trim();
  const company = input.senderCompany?.trim();
  if (name && company) return `${name}\n${company}`;
  if (name) return name;
  if (company) return company;
  return '';
}

/** Positive clause after "Забележав дека …" / "I noticed that …" */
function positiveClause(text: string | null | undefined, language: EmailLanguage): string | null {
  if (!text) return null;
  const mk: Record<string, string> = {
    'Contact information is easy to find': 'контакт информациите лесно се наоѓаат',
    'Services are clearly explained': 'услугите се јасно објаснети',
    'Strong local brand presence': 'имате добро присуство како локален бизнис',
    'Professional photography': 'имате квалитетни фотографии',
    'Simple navigation': 'навигацијата е едноставна',
    'Works well on mobile': 'сајтот добро се гледа на телефон',
    'Site loads over HTTPS': 'страницата користи безбедна врска',
    'Modern visual design': 'дизајнот изгледа современо',
  };
  const en: Record<string, string> = {
    'Contact information is easy to find': 'contact information is easy to find',
    'Services are clearly explained': 'services are clearly explained',
    'Strong local brand presence': 'you have a strong local presence',
    'Professional photography': 'you have good quality photography',
    'Simple navigation': 'navigation is simple',
    'Works well on mobile': 'the website works well on mobile',
    'Site loads over HTTPS': 'the website uses a secure connection',
    'Modern visual design': 'the design looks modern',
  };
  const map = language === 'mk' ? mk : en;
  return map[text] || lowerFirst(text);
}

function lowerFirst(text: string): string {
  if (!text) return text;
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/** Constructive observation — no blame, no “outdated / losing customers”. */
function issueParagraph(issueKey: string | undefined, language: EmailLanguage): string | null {
  if (!issueKey) return null;

  if (language === 'mk') {
    const mk: Record<string, string> = {
      'Not mobile friendly':
        'На телефон, приказот би можел да биде појасен и полесен за користење.',
      'No HTTPS':
        'Страницата би можела да користи безбедна HTTPS врска.',
      'Outdated visual design':
        'Визуелниот приказ би можел да изгледа посвежо и појасно.',
      'No clear way to get in touch':
        'Би било полесно ако има јасен начин да се прати барање директно од страницата.',
      'Pages feel slow':
        'Страницата би можела да се отвора побрзо.',
      'Website is offline or unreachable':
        'Моментално страницата не се отвора стабилно.',
      'No active website':
        'Моментално нема активна веб-страница.',
    };
    return mk[issueKey] || null;
  }

  const en: Record<string, string> = {
    'Not mobile friendly':
      'On mobile, the layout could be clearer and easier to use.',
    'No HTTPS':
      'The website could use a secure HTTPS connection.',
    'Outdated visual design':
      'The visual presentation could look fresher and clearer.',
    'No clear way to get in touch':
      'It would help to have a clearer way to send an inquiry from the page.',
    'Pages feel slow':
      'The pages could open a bit faster.',
    'Website is offline or unreachable':
      'The website does not open reliably at the moment.',
    'No active website':
      'There does not appear to be an active website right now.',
  };
  return en[issueKey] || null;
}

/** Intro + issue body; omitted entirely when there is no issue. */
function issueSection(issueBody: string | null, language: EmailLanguage): string | null {
  if (!issueBody) return null;
  if (language === 'mk') {
    return `Имаше една работа која мислам дека би можела да се подобри:\n\n${issueBody}`;
  }
  return `There was one thing I thought could be improved:\n\n${issueBody}`;
}

function closingBlock(language: EmailLanguage, signOff: string): string {
  if (language === 'mk') {
    return signOff ? `Поздрав,\n${signOff}` : 'Поздрав,';
  }
  return signOff ? `Best,\n${signOff}` : 'Best,';
}

function generateTemplateEmail(
  input: EmailGeneratorInput & { language: EmailLanguage },
): { subject: string; content: string } {
  const { language } = input;
  const brief = buildOutreachBrief(input);
  const signOff = senderSignOff(input);
  const greeting = input.contactName
    ? language === 'mk'
      ? `Здраво ${input.contactName},`
      : `Hi ${input.contactName},`
    : language === 'mk'
      ? 'Здраво,'
      : 'Hi,';
  const close = closingBlock(language, signOff);
  const positive = positiveClause(brief.positive, language);
  const issue = issueSection(issueParagraph(brief.issues[0], language), language);

  if (language === 'mk') {
    if (input.kind === 'FOLLOW_UP') {
      return {
        subject: `Кратка порака за ${input.companyName}`,
        content: joinBody([
          greeting,
          `Само кратко да се надоврзам на претходната порака за ${input.companyName}.`,
          `Не сакам да ви одземам време, само сакав да проверам дали би сакале да ви испратам неколку идеи за можни подобрувања.`,
          `Доколку моментално не е приоритет, нема никаков проблем.`,
          `Ви посакувам успешна работа.`,
          close,
        ]),
      };
    }

    if (!brief.hasWebsite) {
      const cityBit = input.city?.trim() ? ` во ${input.city.trim()}` : '';
      return {
        subject: `${input.companyName}`,
        content: joinBody([
          greeting,
          `Додека разгледував компании${cityBit}, наидов на ${input.companyName}.`,
          `Забележав дека моментално немате веб-сајт.`,
          `Многу компании денес добиваат нови клиенти преку онлајн пребарување, па едноставна веб-страница може да биде корисна како место каде луѓето ќе најдат информации, услуги и контакт.`,
          `Доколку сакате, можам да ви испратам пример како би можело да изгледа едноставно решение за вашиот бизнис.`,
          close,
        ]),
      };
    }

    return {
      subject: `${input.companyName}`,
      content: joinBody([
        greeting,
        `Го најдов ${input.companyName} додека разгледував локални бизниси и го погледнав вашиот веб-сајт.`,
        positive ? `Забележав дека ${positive}.` : null,
        issue,
        `Сакав само да ви го споделам ова бидејќи веб-сајтот често е првата точка каде што некој се запознава со компанијата.`,
        `Доколку сакате, можам да ви испратам неколку конкретни предлози без никаква обврска.`,
        close,
      ]),
    };
  }

  if (input.kind === 'FOLLOW_UP') {
    return {
      subject: `Quick note for ${input.companyName}`,
      content: joinBody([
        greeting,
        `Just a quick follow-up on my previous message about ${input.companyName}.`,
        `I don't want to take much of your time, I just wanted to check if you'd like me to send a few ideas for possible improvements.`,
        `If now is not the right time, no problem at all.`,
        `Wishing you continued success.`,
        close,
      ]),
    };
  }

  if (!brief.hasWebsite) {
    const cityBit = input.city?.trim() ? ` in ${input.city.trim()}` : '';
    return {
      subject: `${input.companyName}`,
      content: joinBody([
        greeting,
        `While looking through businesses${cityBit}, I came across ${input.companyName}.`,
        `I noticed that you currently do not have a website.`,
        `Many businesses today get discovered through online searches, and a simple website can be a useful place where people can find information, services, and contact details.`,
        `If you'd like, I can send an example of what a simple solution for your business could look like.`,
        close,
      ]),
    };
  }

  return {
    subject: `${input.companyName}`,
    content: joinBody([
      greeting,
      `I found ${input.companyName} while looking through local businesses and took a look at your website.`,
      positive ? `I noticed that ${positive}.` : null,
      issue,
      `I just wanted to share this because a website is often the first place where people get to know a company.`,
      `If you'd like, I can send a few specific suggestions with no obligation.`,
      close,
    ]),
  };
}

function joinBody(parts: Array<string | null | undefined>): string {
  return parts
    .map((p) => (p || '').trim())
    .filter(Boolean)
    .join('\n\n');
}

/** Defence if banned jargon ever lands in a draft. */
export function scrubBannedPhrases(text: string): string {
  const banned =
    /\b(AI|ChatGPT|Gemini|automation|lead score|opportunity score|website audit|digital transformation|growth hacking|conversion rate|SEO score|performance score|website analysis)\b/gi;
  return text.replace(banned, '').replace(/[ \t]{2,}/g, ' ').trim();
}
