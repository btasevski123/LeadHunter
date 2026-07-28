import type { ScoreResult } from '@leadhunter/shared';

export type EmailLanguage = 'en' | 'mk';

export interface EmailGeneratorInput {
  companyName: string;
  industry?: string | null;
  city?: string | null;
  website?: string | null;
  contactName?: string | null;
  recipientEmail?: string | null;
  score?: ScoreResult | null;
  auditSummary?: string | null;
  aiRecommendations?: string | null;
  classification?: string | null;
  recommendedService?: string | null;
  senderName?: string | null;
  senderCompany?: string | null;
  kind?: 'OUTREACH' | 'FOLLOW_UP';
  language?: EmailLanguage;
}

export interface GeneratedEmail {
  subject: string;
  content: string;
  language: EmailLanguage;
}

export async function generateOutreachEmail(
  input: EmailGeneratorInput,
): Promise<GeneratedEmail> {
  const language: EmailLanguage = input.language === 'mk' ? 'mk' : 'en';
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    try {
      const ai = await generateWithOpenAi({ ...input, language });
      if (ai) return { ...ai, language };
    } catch {
      // fallback
    }
  }
  return { ...generateRuleBasedEmail({ ...input, language }), language };
}

function senderSignOff(input: EmailGeneratorInput): string {
  const name = input.senderName?.trim();
  const company = input.senderCompany?.trim();
  if (name && company) return `${name}\n${company}`;
  if (name) return name;
  if (company) return company;
  return input.language === 'mk' ? 'Со почит' : 'Best regards';
}

function generateRuleBasedEmail(input: EmailGeneratorInput): GeneratedEmail {
  const language: EmailLanguage = input.language === 'mk' ? 'mk' : 'en';
  const city = input.city || (language === 'mk' ? 'Северна Македонија' : 'North Macedonia');
  const kind = input.kind || 'OUTREACH';
  const score = input.score?.score;
  const noWebsite = !input.website || input.score?.reasons.includes('No website');
  const signOff = senderSignOff(input);
  const greeting = input.contactName
    ? language === 'mk'
      ? `Почитувани ${input.contactName},`
      : `Dear ${input.contactName},`
    : language === 'mk'
      ? 'Почитувани,'
      : 'Hello,';

  if (language === 'mk') {
    if (kind === 'FOLLOW_UP') {
      return {
        language,
        subject: `Следење — онлајн присуство за ${input.companyName}`,
        content: `${greeting}

Сакав накратко да се надоврзам на претходната порака во врска со онлајн присуството на ${input.companyName}${input.city ? ` во ${input.city}` : ''}.

Многу локални ${input.industry || 'бизниси'} губат потенцијални клиенти бидејќи веб-страницата не е доволно јасна, мобилна или видлива на Google. Можам да ви подготвам краток предлог со конкретни подобрувања.

Дали би биле отворени за краток разговор од 15 минути оваа недела?

${signOff}`,
      };
    }

    if (noWebsite) {
      return {
        language,
        subject: `${input.companyName} — едноставна веб-страница што носи барања`,
        content: `${greeting}

Додека истражував ${input.industry || 'локални'} бизниси во ${city}, наидов на ${input.companyName}.

Изгледа дека моментално немате активна веб-страница. Многу слични компании губат повици и пораки бидејќи клиентите прво пребаруваат онлајн.

Можам да ви помогнам со чиста, мобилна веб-страница што вклучува:
- Јасни услуги и начин на контакт
- Google Maps и клик-за-повикување
- Основен SEO за ${city}

Доколку ви е од интерес, можам да ви испратам краток предлог и примери.

${signOff}`,
      };
    }

    return {
      language,
      subject: `Идеја за подобрување на веб-страницата на ${input.companyName}`,
      content: `${greeting}

Ја прегледав веб-страницата на ${input.companyName}${input.website ? ` (${input.website})` : ''}${score ? ` — резултат на можност ${score}/100` : ''}.

${input.auditSummary || 'Има неколку практични подобрувања што можат да ја зголемат довербата и бројот на барања (мобилно искуство, SEO и појасни патеки за контакт).'}

${input.recommendedService ? `Предлог услуга: ${input.recommendedService}.` : ''}

Специјализирам за редизајн на веб-страници и дигитални надградби за бизниси во Северна Македонија. Со задоволство ќе ви испратам краток резиме и следни чекори — без обврска.

Дали би одговарал краток разговор оваа недела?

${signOff}`,
    };
  }

  if (kind === 'FOLLOW_UP') {
    return {
      language,
      subject: `Following up — website opportunity for ${input.companyName}`,
      content: `${greeting}

I wanted to quickly follow up on my previous note about improving the online presence of ${input.companyName}${input.city ? ` in ${input.city}` : ''}.

I audited a few local ${input.industry || 'business'} websites and ${input.companyName} stood out as a strong candidate for a practical upgrade (mobile experience, trust signals, and clearer enquiries).

Would you be open to a short 15-minute call this week?

${signOff}`,
    };
  }

  if (noWebsite) {
    return {
      language,
      subject: `${input.companyName} — a simple website that brings enquiries`,
      content: `${greeting}

I came across ${input.companyName}${input.city ? ` in ${city}` : ''} while researching ${input.industry || 'local'} businesses in North Macedonia.

It looks like you may not have an active website yet. Many similar businesses lose calls and messages because customers search online first.

I help companies like yours launch a clean, mobile-friendly website with:
- Clear services and contact options
- Google Maps and click-to-call
- Basic SEO for ${city}

If useful, I can share a short proposal and examples.

${signOff}`,
    };
  }

  return {
    language,
    subject: `Quick idea to improve ${input.companyName}'s website`,
    content: `${greeting}

I reviewed the website for ${input.companyName}${input.website ? ` (${input.website})` : ''}${score ? ` — opportunity score ${score}/100` : ''}.

${input.auditSummary || 'There are a few practical improvements that could increase trust and enquiries (mobile experience, SEO, and clearer contact paths).'}

${input.recommendedService ? `Suggested service: ${input.recommendedService}.` : ''}

I specialise in website redesign and digital upgrades for businesses in North Macedonia. Happy to send a short audit summary and suggested next steps — no obligation.

Would a brief call work this week?

${signOff}`,
  };
}

async function generateWithOpenAi(
  input: EmailGeneratorInput & { language: EmailLanguage },
): Promise<{ subject: string; content: string } | null> {
  const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const languageLabel =
    input.language === 'mk' ? 'Macedonian (македонски)' : 'English';

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.45,
      messages: [
        {
          role: 'system',
          content: [
            `You write professional B2B outreach emails for a web/digital agency in North Macedonia.`,
            `Write the entire email in ${languageLabel}.`,
            `Tone: respectful, concrete, commercial but not pushy. 160–220 words.`,
            `Structure: greeting, why you contacted them, 2–3 specific observations, clear offer, soft CTA, sign-off.`,
            `Use the audit findings and recommended service when provided. Do not invent fake metrics.`,
            `Do not include placeholders like [Your Name] — use the provided sender details or omit the personal name.`,
            `Return JSON with keys subject and content only. content must be plain text with newlines.`,
          ].join(' '),
        },
        {
          role: 'user',
          content: JSON.stringify({
            language: input.language,
            kind: input.kind || 'OUTREACH',
            companyName: input.companyName,
            industry: input.industry,
            city: input.city,
            website: input.website,
            contactName: input.contactName,
            leadScore: input.score?.score,
            scoreReasons: input.score?.reasons,
            auditSummary: input.auditSummary,
            aiRecommendations: input.aiRecommendations,
            classification: input.classification,
            recommendedService: input.recommendedService,
            senderName: input.senderName,
            senderCompany: input.senderCompany,
          }),
        },
      ],
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) return null;
  const parsed = JSON.parse(raw) as { subject?: string; content?: string };
  if (!parsed.subject || !parsed.content) return null;
  return { subject: parsed.subject, content: parsed.content };
}
