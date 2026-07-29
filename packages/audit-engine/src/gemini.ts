import { GoogleGenerativeAI } from '@google/generative-ai';

const DEFAULT_MODEL = 'gemini-2.5-flash';

export function geminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export function getGeminiModel() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  const modelName = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: 0.6,
      // Prefer structured JSON when we ask for subject/content.
      responseMimeType: 'application/json',
    },
  });
}

/**
 * Ask Gemini for text. When `json` is true, responseMimeType is application/json.
 * Returns raw model text (caller parses).
 */
export async function geminiGenerateText(
  prompt: string,
  options: { json?: boolean; temperature?: number } = {},
): Promise<string | null> {
  if (!geminiConfigured()) return null;

  const apiKey = process.env.GEMINI_API_KEY!.trim();
  const modelName = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: options.temperature ?? 0.6,
      ...(options.json === false
        ? {}
        : { responseMimeType: 'application/json' as const }),
    },
  });

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text()?.trim();
    return text || null;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Surface billing/quota issues clearly in API logs.
    console.warn(`[gemini] generateContent failed (${modelName}): ${message}`);
    throw err;
  }
}

/** Parse a JSON object out of Gemini output (handles accidental markdown fences). */
export function parseGeminiJson<T extends Record<string, unknown>>(raw: string): T | null {
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      return null;
    }
  }
}
