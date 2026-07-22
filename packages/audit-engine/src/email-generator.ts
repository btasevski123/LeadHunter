import type { ScoreResult } from '@leadhunter/shared';

export interface EmailGeneratorInput {
  companyName: string;
  industry?: string | null;
  city?: string | null;
  website?: string | null;
  contactName?: string | null;
  score?: ScoreResult | null;
  auditSummary?: string | null;
  kind?: 'OUTREACH' | 'FOLLOW_UP';
}

export interface GeneratedEmail {
  subject: string;
  content: string;
}

export async function generateOutreachEmail(
  input: EmailGeneratorInput,
): Promise<GeneratedEmail> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    try {
      const ai = await generateWithOpenAi(input);
      if (ai) return ai;
    } catch {
      // fallback
    }
  }
  return generateRuleBasedEmail(input);
}

function generateRuleBasedEmail(input: EmailGeneratorInput): GeneratedEmail {
  const city = input.city || 'North Macedonia';
  const kind = input.kind || 'OUTREACH';
  const score = input.score?.score;
  const noWebsite = !input.website || input.score?.reasons.includes('No website');

  if (kind === 'FOLLOW_UP') {
    return {
      subject: `Following up — website opportunity for ${input.companyName}`,
      content: `Hello,

I wanted to quickly follow up on my previous note about improving the online presence of ${input.companyName}${input.city ? ` in ${input.city}` : ''}.

I audited a few local ${input.industry || 'business'} websites and ${input.companyName} stood out as a strong candidate for a practical upgrade (mobile experience, trust signals, and clearer enquiries).

Would you be open to a short 15-minute call this week?

Best regards`,
    };
  }

  if (noWebsite) {
    return {
      subject: `${input.companyName} — a simple website that brings enquiries`,
      content: `Hello,

I came across ${input.companyName}${input.city ? ` in ${city}` : ''} while researching ${input.industry || 'local'} businesses in North Macedonia.

It looks like you may not have an active website yet. Many similar businesses lose calls and messages because customers search online first.

I help companies like yours launch a clean, mobile-friendly website with:
- Clear services and contact options
- Google Maps and click-to-call
- Basic SEO for ${city}

If useful, I can share a short proposal and examples.

Best regards`,
    };
  }

  return {
    subject: `Quick idea to improve ${input.companyName}'s website`,
    content: `Hello,

I reviewed the website for ${input.companyName}${input.website ? ` (${input.website})` : ''}${score ? ` — opportunity score ${score}/100` : ''}.

${input.auditSummary || 'There are a few practical improvements that could increase trust and enquiries (mobile experience, SEO, and clearer contact paths).'}

I specialise in website redesign and digital upgrades for businesses in North Macedonia. Happy to send a short audit summary and suggested next steps — no obligation.

Would a brief call work this week?

Best regards`,
  };
}

async function generateWithOpenAi(
  input: EmailGeneratorInput,
): Promise<GeneratedEmail | null> {
  const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.5,
      messages: [
        {
          role: 'system',
          content:
            'Write concise B2B outreach emails for a freelance web developer in North Macedonia. Return JSON with keys subject and content only.',
        },
        {
          role: 'user',
          content: JSON.stringify(input),
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
