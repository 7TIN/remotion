import type { PhraseScore, TranscriptSegment, ViralCategory } from "./types";

const CATEGORIES: ViralCategory[] = [
  "hook",
  "controversy",
  "emotion",
  "curiosity_gap",
  "punchline",
  "opinion",
];

export async function scorePhrasesWithGemini({
  geminiModel,
  segments,
  targetDuration,
}: {
  geminiModel: string;
  segments: TranscriptSegment[];
  targetDuration: number;
}) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GOOGLE_API_KEY for Gemini phrase scoring.");
  }

  const transcript = segments.map((segment) => ({
    id: segment.id,
    text: segment.text,
    start: round(segment.start),
    end: round(segment.end),
  }));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: "You are an expert viral content curator and video trailer editor. Identify phrases that make viewers stop scrolling. Use only valid JSON in your response.",
            },
          ],
        },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: buildPrompt(transcript, targetDuration),
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
  return normalizePhraseScores(JSON.parse(stripJsonFences(text)));
}

function buildPrompt(transcript: unknown, targetDuration: number) {
  return `Analyze this video transcript and extract attention-grabbing phrases for a viral ${targetDuration}-second social media trailer.

TRANSCRIPT:
${JSON.stringify(transcript)}

Instructions:
1. Evaluate each segment independently for hook strength, emotion, controversy, curiosity gap, punchline, and opinion value.
2. Select phrases that together form a cohesive Hook -> Tension -> Payoff arc.
3. Prefer short phrases, roughly 2 to 8 seconds each.
4. Aim for 5 to 10 phrases total.
5. Output only a valid JSON array. No markdown.

Each item must be:
{
  "segmentId": number,
  "text": string,
  "start": number,
  "end": number,
  "score": number,
  "category": "hook" | "controversy" | "emotion" | "curiosity_gap" | "punchline" | "opinion",
  "reasoning": string
}`;
}

function normalizePhraseScores(value: unknown): PhraseScore[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => item as Record<string, unknown>)
    .map((item) => ({
      segmentId: Number(item.segmentId),
      text: String(item.text || "").trim(),
      start: Number(item.start),
      end: Number(item.end),
      score: clamp(Number(item.score), 0, 1),
      category: CATEGORIES.includes(item.category as ViralCategory)
        ? (item.category as ViralCategory)
        : "hook",
      reasoning: String(item.reasoning || "").trim(),
    }))
    .filter(
      (phrase) =>
        phrase.text &&
        Number.isFinite(phrase.segmentId) &&
        Number.isFinite(phrase.start) &&
        Number.isFinite(phrase.end) &&
        phrase.start < phrase.end,
    );
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

function round(value: number) {
  return Math.round(value * 100) / 100;
}
