import type { AuditIssueInput, DesignAgeEstimate, ScoreResult } from '@leadhunter/shared';

export interface AiAuditInput {
  companyName: string;
  industry?: string | null;
  city?: string | null;
  website?: string | null;
  score: ScoreResult;
  issues: AuditIssueInput[];
  designAgeEstimate: DesignAgeEstimate;
}

export async function generateAiAudit(input: AiAuditInput): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return generateRuleBasedRecommendations(input);
  }

  try {
    const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const prompt = buildPrompt(input);

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        messages: [
          {
            role: 'system',
            content:
              'You are a senior web consultant helping a freelancer in North Macedonia sell website redesign, SEO, and digital transformation services. Write concise, actionable audits in English.',
          },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!res.ok) {
      return generateRuleBasedRecommendations(input);
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    return content || generateRuleBasedRecommendations(input);
  } catch {
    return generateRuleBasedRecommendations(input);
  }
}

export function generateRuleBasedRecommendations(input: AiAuditInput): string {
  const issueList = input.issues.map((i) => `- ${i.title}: ${i.description}`).join('\n') || '- None';
  const impact =
    input.score.score >= 80
      ? 'High — weak digital presence likely limits inbound enquiries and trust.'
      : input.score.score >= 60
        ? 'Medium — selective improvements can unlock more local demand.'
        : 'Lower — site is relatively healthy; focus on conversion and content.';

  const strategy =
    !input.website || input.score.reasons.includes('No website')
      ? 'Propose a new brochure-to-lead website with clear services, contact form, Google Maps, and Macedonian/English content.'
      : input.designAgeEstimate === 'outdated'
        ? 'Propose a full redesign on a modern stack (responsive, SSL, fast hosting), migrate content, and set up basic SEO + analytics.'
        : 'Propose a phased upgrade: mobile UX polish, SEO fixes, contact/conversion paths, then visual refresh.';

  return [
    `## Current problems`,
    issueList,
    ``,
    `## Potential improvements`,
    `- Ensure HTTPS and mobile-first layout`,
    `- Add or improve contact form and click-to-call`,
    `- Strengthen local SEO (title, meta, city + service pages)`,
    `- Add privacy/cookie compliance and trust signals`,
    `- Capture desktop/mobile screenshots for before/after pitching`,
    ``,
    `## Estimated business impact`,
    impact,
    ``,
    `## Suggested redesign strategy`,
    strategy,
    ``,
    `Lead score: ${input.score.score}/100`,
    `Reasons: ${input.score.reasons.join('; ')}`,
  ].join('\n');
}

function buildPrompt(input: AiAuditInput): string {
  return `Company: ${input.companyName}
Industry: ${input.industry || 'n/a'}
City: ${input.city || 'n/a'}
Website: ${input.website || 'none'}
Lead score: ${input.score.score}
Score reasons: ${input.score.reasons.join(', ')}
Design age: ${input.designAgeEstimate}
Issues: ${input.issues.map((i) => i.title).join(', ')}

Write sections: Current problems, Potential improvements, Estimated business impact, Suggested redesign strategy.`;
}
