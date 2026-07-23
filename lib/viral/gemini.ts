import type { AiPhraseSelection, ViralCategory } from "./types";

const CATEGORIES: ViralCategory[] = [
  "hook",
  "controversy",
  "emotion",
  "curiosity_gap",
  "punchline",
  "opinion",
];

const GEMINI_MODEL = "gemini-2.5-flash";

export function getGeminiModel() {
  return GEMINI_MODEL;
}

export async function scorePhrasesWithGemini({
  textTranscript,
  targetDuration,
}: {
  textTranscript: string;
  targetDuration: number;
}) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GOOGLE_API_KEY for Gemini phrase scoring.");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: "You are an expert viral content curator and video trailer editor. Identify phrases that make viewers stop scrolling. Output only valid JSON.",
            },
          ],
        },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: buildPrompt(textTranscript, targetDuration),
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.35,
          responseMimeType: "application/json",
        },
      }),
    },
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(readGeminiError(result, `Gemini failed with HTTP ${response.status}`));
  }

  const text = readGeminiText(result);
  return normalizePhraseSelections(JSON.parse(stripJsonFences(text)));
}

function buildPrompt(textTranscript: string, targetDuration: number) {
  const { minPhraseSec, maxPhraseSec, minPhrases, maxPhrases } =
    getPromptParams(targetDuration);

  return `Analyze this video transcript and extract attention grabbing phrases for a viral ${targetDuration} second social media trailer.

Instructions:
1. Evaluate each segment independently for hook strength, emotion, controversy, curiosity gap, punchline, and opinion value.
2. Select phrases that together form a cohesive Hook -> Tension -> Payoff arc.
3. Prefer short phrases, roughly ${minPhraseSec} to ${maxPhraseSec} seconds each.
4. Aim for ${minPhrases} to ${maxPhrases} phrases total.
5. Output only a valid JSON array. No markdown.
6. Strictly give phrases in the input language only (example: even if an English sentence appears inside Hindi, return the phrase in Hindi only).
7. Give exactly the output phrase as in the input. Do not cut or trim any word (they will be searched in a larger timed transcript file).

Each item must be:
{
  "text": string,
  "score": number,
  "category": "hook" | "controversy" | "emotion" | "curiosity_gap" | "punchline" | "opinion"
}

TRANSCRIPT:
${textTranscript}`;
}

export function getPromptParams(targetDuration: number) {
  if (targetDuration <= 20) {
    return {
      minPhraseSec: 2,
      maxPhraseSec: 4,
      minPhrases: 4,
      maxPhrases: 6,
    };
  }

  if (targetDuration <= 30) {
    return {
      minPhraseSec: 2,
      maxPhraseSec: 5,
      minPhrases: 5,
      maxPhrases: 8,
    };
  }

  if (targetDuration <= 45) {
    return {
      minPhraseSec: 2,
      maxPhraseSec: 6,
      minPhrases: 7,
      maxPhrases: 12,
    };
  }

  return {
    minPhraseSec: 3,
    maxPhraseSec: 6,
    minPhrases: 10,
    maxPhrases: 15,
  };
}

function normalizePhraseSelections(value: unknown): AiPhraseSelection[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => item as Record<string, unknown>)
    .map((item) => ({
      text: String(item.text || "").trim(),
      score: clamp(Number(item.score), 0, 10),
      category: CATEGORIES.includes(item.category as ViralCategory)
        ? (item.category as ViralCategory)
        : "hook",
    }))
    .filter((phrase) => phrase.text);
}

function readGeminiText(result: unknown) {
  const record = result as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };

  const text = record.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("");

  if (!text) {
    throw new Error("Gemini returned no text content.");
  }

  return text;
}

function readGeminiError(result: unknown, fallback: string) {
  const record = result as { error?: { message?: string } };
  return record.error?.message || fallback;
}

function stripJsonFences(value: string) {
  return value
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
