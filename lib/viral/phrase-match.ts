import { distance } from "fastest-levenshtein";
import type { VttTranscriptSegment } from "./youtube-vtt-parser";

export type MatchedPhraseSpan = {
  start: number;
  end: number;
  startIndex: number;
  endIndex: number;
  score: number;
  matchedText: string;
  matched: boolean;
};

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/\bयह\b/g, "ये")
    .replace(/\bवह\b/g, "वो")
    .replace(/[.,!?;:"'()\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordOverlap(a: string, b: string) {
  const wordsA = new Set(a.split(" "));
  const wordsB = new Set(b.split(" "));

  let common = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) common += 1;
  }

  return common / Math.max(wordsA.size, wordsB.size);
}

function scoreCandidate(candidate: string, target: string) {
  if (candidate === target) return 1;
  if (candidate.includes(target)) return 0.99;
  if (target.includes(candidate)) return 0.98;

  const lev =
    1 - distance(candidate, target) / Math.max(candidate.length, target.length);
  const overlap = wordOverlap(candidate, target);

  return 0.7 * overlap + 0.3 * lev;
}

export function findSegmentSpan(
  phrase: string,
  segments: VttTranscriptSegment[],
  {
    maxMerge = 5,
    threshold = 0.75,
  }: {
    maxMerge?: number;
    threshold?: number;
  } = {},
): MatchedPhraseSpan | undefined {
  const target = normalize(phrase);

  let best:
    | {
        startIndex: number;
        endIndex: number;
        score: number;
      }
    | undefined;

  for (let i = 0; i < segments.length; i += 1) {
    let combined = "";

    for (let j = i; j < Math.min(i + maxMerge, segments.length); j += 1) {
      combined += (combined ? " " : "") + segments[j].text;
      const candidate = normalize(combined);

      if (candidate === target) {
        return {
          start: segments[i].start,
          end: segments[j].end,
          startIndex: i,
          endIndex: j,
          score: 1,
          matchedText: combined,
          matched: true,
        };
      }

      const score = scoreCandidate(candidate, target);
      if (!best || score > best.score) {
        best = { startIndex: i, endIndex: j, score };
      }

      if (candidate.length > target.length * 1.4) break;
    }
  }

  if (!best) return undefined;

  const matchedText = segments
    .slice(best.startIndex, best.endIndex + 1)
    .map((segment) => segment.text)
    .join(" ");

  return {
    start: segments[best.startIndex].start,
    end: segments[best.endIndex].end,
    startIndex: best.startIndex,
    endIndex: best.endIndex,
    score: best.score,
    matchedText,
    matched: best.score >= threshold,
  };
}
