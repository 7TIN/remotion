// youtube-vtt-parser.ts
import { closeSync, fsyncSync, openSync, readFileSync, writeSync } from "fs";
export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface ParsedTranscript {
  transcript: string;
  segments: TranscriptSegment[];
}

const TIMESTAMP_REGEX =
  /(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})\.(\d{3})/;

function toSeconds(h: string, m: string, s: string, ms: string): number {
  return Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms) / 1000;
}

function cleanText(text: string): string {
  return (
    text
      // Remove inline timestamps
      .replace(/<\d{2}:\d{2}:\d{2}\.\d{3}>/g, "")

      // Remove all HTML tags (<c>, </c>, etc.)
      .replace(/<[^>]+>/g, "")

      // Collapse whitespace
      .replace(/\s+/g, " ")

      .trim()
  );
}

export function parseYoutubeVtt(vtt: string): ParsedTranscript {
  const lines = vtt.split(/\r?\n/);

  const segments: TranscriptSegment[] = [];

  // let previousText = "";

  for (let i = 0; i < lines.length; i++) {
    const timestamp = lines[i].match(TIMESTAMP_REGEX);

    if (!timestamp) continue;

    const start = toSeconds(
      timestamp[1],
      timestamp[2],
      timestamp[3],
      timestamp[4],
    );

    const end = toSeconds(
      timestamp[5],
      timestamp[6],
      timestamp[7],
      timestamp[8],
    );

    const textLines: string[] = [];

    i++;

    while (i < lines.length && lines[i].trim() !== "") {
      textLines.push(lines[i]);
      i++;
    }

    // Ignore finalized cues (they contain no inline word timestamps)
    const hasWordTimestamps = textLines.some((line) => line.includes("<00:"));

    if (!hasWordTimestamps) {
      continue;
    }

    // The last line contains only the newly spoken words
    const lastLine = textLines[textLines.length - 1];

    const cleaned = cleanText(lastLine);

    if (!cleaned) {
      continue;
    }

    segments.push({
      start,
      end,
      text: cleaned,
    });
  }

  return {
    transcript: segments.map((s) => s.text).join("\n"),
    segments,
  };
}

const vtt = readFileSync("captions.hi-orig.vtt", "utf8");

const result = parseYoutubeVtt(vtt);

const fd = openSync("captions-pure.txt", "w");
writeSync(fd, result.transcript);
// fsyncSync(fd);
closeSync(fd);

const fds = openSync("captions-seg.json", "w");
writeSync(fds, JSON.stringify(result.segments, null, 2));

closeSync(fds);

// console.log(result.transcript);

// console.log(result.segments);

const aiResult = [
  {
    text: "एंड डिसिप्लिन मेक्स और ब्रेक्स अ पर्सन",
    score: 9.5,
    category: "hook",
  },
  {
    text: "हम रोबट नहीं अभी एटलीस्ट आज तो नहीं है",
    score: 8.0,
    category: "opinion",
  },
  {
    text: "चीनी छोड़ दे",
    score: 9.0,
    category: "hook",
  },
  {
    text: "यह ऐसी दो चीजें है डिफरेंस आपकी लाइफ में जिसके लिए आपको कुछ नहीं करना है",
    score: 8.5,
    category: "curiosity_gap",
  },
  {
    text: "द फीलिंग दैट आई से समथिंग एंड आई कैन डू इट इज ब्लडी पावरफुल",
    score: 9.8,
    category: "punchline",
  },
  {
    text: "आप क्या सोचते हो आप अपने खुद के बारे में इट्स वन ऑफ द मोस्ट इंपोर्टेंट थिंग्स इन योर लाइफ",
    score: 8.7,
    category: "opinion",
  },
  {
    text: "व्ट यू ईट इज व्हाट यू बिकम",
    score: 9.2,
    category: "punchline",
  },
  {
    text: "पॉजिटिव इंफोर्समेंट लूप बोलते हैं",
    score: 8.3,
    category: "curiosity_gap",
  },
  {
    text: "सो ऑन अ बैड डे",
    score: 7.8,
    category: "emotion",
  },
  {
    text: "शुगर लीविंग शुगर हैज द सिंगल मोस्ट करेजियस एंड द मोस्ट एडवांटेज थिंग आव डन टू माय बॉडी",
    score: 8.9,
    category: "opinion",
  },
];

import { distance } from "fastest-levenshtein";

function normalize(text: string) {
  return (
    text
      .toLowerCase()
      // Hindi normalization
      .replace(/\bयह\b/g, "ये")
      .replace(/\bवह\b/g, "वो")

      // Remove punctuation
      .replace(/[.,!?;:"'()\-]/g, " ")

      // Collapse whitespace
      .replace(/\s+/g, " ")

      .trim()
  );
}

// function similarity(a: string, b: string) {
//   const max = Math.max(a.length, b.length);

//   if (max === 0) return 1;

//   return 1 - distance(a, b) / max;
// }

function wordOverlap(a: string, b: string) {
  const wordsA = new Set(a.split(" "));
  const wordsB = new Set(b.split(" "));

  let common = 0;

  for (const word of wordsA) {
    if (wordsB.has(word)) {
      common++;
    }
  }

  return common / Math.max(wordsA.size, wordsB.size);
}

function scoreCandidate(candidate: string, target: string) {
  // Perfect
  if (candidate === target) return 1;

  // Candidate contains AI phrase
  if (candidate.includes(target)) return 0.99;

  // AI contains candidate
  if (target.includes(candidate)) return 0.98;

  const lev =
    1 - distance(candidate, target) / Math.max(candidate.length, target.length);

  const overlap = wordOverlap(candidate, target);

  // Hybrid score
  return 0.7 * overlap + 0.3 * lev;
}

function findSegmentSpan(
  phrase: string,
  segments: TranscriptSegment[],
  {
    maxMerge = 5,
    threshold = 0.75,
  }: {
    maxMerge?: number;
    threshold?: number;
  } = {},
) {
  const target = normalize(phrase);

  let best:
    | {
        startIndex: number;
        endIndex: number;
        score: number;
      }
    | undefined;

  for (let i = 0; i < segments.length; i++) {
    let combined = "";

    for (let j = i; j < Math.min(i + maxMerge, segments.length); j++) {
      combined += (combined ? " " : "") + segments[j].text;

      const candidate = normalize(combined);

      // Perfect match
      if (candidate === target) {
        return {
          start: segments[i].start,
          end: segments[j].end,
          startIndex: i,
          endIndex: j,
          score: 1,
          matchedText: combined,
        };
      }

      // const score = similarity(candidate, target);
      const score = scoreCandidate(candidate, target);

      if (!best || score > best.score) {
        best = {
          startIndex: i,
          endIndex: j,
          score,
        };
      }

      // Candidate became much longer than target
      // No point continuing this merge chain.
      if (candidate.length > target.length * 1.4) {
        break;
      }
    }
  }

  if (!best) {
    return undefined;
  }

  return {
    start: segments[best.startIndex].start,
    end: segments[best.endIndex].end,
    startIndex: best.startIndex,
    endIndex: best.endIndex,
    score: best.score,
    matchedText: segments
      .slice(best.startIndex, best.endIndex + 1)
      .map((s) => s.text)
      .join(" "),
    matched: best.score >= threshold,
  };
}

const clips = aiResult.map((item) => {
  const span = findSegmentSpan(item.text, result.segments);

  if (!span) return;

  if (!span.matched) {
    console.log("-----------");
    console.log("AI:");
    console.log(item.text);
    console.log();
    console.log("BEST:");
    console.log(span.matchedText);
    console.log();
    console.log("Score:", span.score);
  } else {
    console.log(
      `✅ ${span.score.toFixed(3)} (${span.startIndex}-${span.endIndex})`,
      item.text,
    );
  }

return {
    ...item,
    start: span?.start,
    end: span?.end,
    startIndex: span?.startIndex,
    endIndex: span?.endIndex,
    matchScore: span?.score,
    transcript: span?.matchedText,
  };
});

const fdc = openSync("captions-clips.json", "w");
writeSync(fdc, JSON.stringify(clips, null, 2));

closeSync(fdc);

// console.log(clips);
