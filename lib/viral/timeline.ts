import type { CutInstruction, PhraseScore, ViralCategory } from "./types";

const CATEGORY_SFX: Record<ViralCategory | "default", string> = {
  hook: "riser_short.mp3",
  controversy: "record_scratch.mp3",
  emotion: "heartbeat.mp3",
  curiosity_gap: "whoosh_short.mp3",
  punchline: "impact_hard.mp3",
  opinion: "whoosh_short.mp3",
  default: "whoosh_short.mp3",
};

export function buildTimeline(
  phrases: PhraseScore[],
  targetDuration = 30,
): CutInstruction[] {
  const normalizedScore = (phrase: PhraseScore) =>
    phrase.score > 1 ? phrase.score / 10 : phrase.score;

  const sorted = [...phrases].sort(
    (a, b) => normalizedScore(b) - normalizedScore(a),
  );
  const selected: PhraseScore[] = [];
  let duration = 0;

  for (const phrase of sorted) {
    const phraseDuration = phrase.end - phrase.start + 0.5;
    if (phraseDuration <= 0) continue;
    if (duration + phraseDuration > targetDuration + 3 && selected.length >= 3) {
      continue;
    }

    selected.push(phrase);
    duration += phraseDuration;

    if (duration >= targetDuration - 2) break;
  }

  if (selected.length === 0) return [];

  return selected
    .sort((a, b) => a.start - b.start)
    .map((phrase, index, selectedPhrases) => {
      const sourceStart = Math.max(0, phrase.start - 0.2);
      const sourceEnd = phrase.end + 0.3;

      return {
        id: index,
        sourceStart: round(sourceStart),
        sourceEnd: round(sourceEnd),
        text: phrase.text,
        duration: round(sourceEnd - sourceStart),
        transitionIn: index === 0 ? "fade_in" : "hard_cut",
        transitionOut:
          index === selectedPhrases.length - 1 ? "fade_out" : "hard_cut",
        sfx: index > 0 ? CATEGORY_SFX[phrase.category] || CATEGORY_SFX.default : undefined,
        paddingStart: 0.2,
        paddingEnd: 0.3,
      } satisfies CutInstruction;
    });
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
