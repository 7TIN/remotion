import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type SmallestPulseResponse = {
  status?: string;
  transcription?: string;
  audio_length?: number;
  words?: Array<{
    start?: number;
    end?: number;
    speaker?: string;
    word?: string;
  }>;
  utterances?: Array<{
    start?: number;
    end?: number;
    speaker?: string;
    text?: string;
    transcript?: string;
  }>;
  metadata?: Record<string, unknown>;
  error?: {
    message?: string;
    code?: string;
  };
};

type TranscriptWord = {
  word: string;
  startMs: number;
  endMs: number;
  speakerLabel?: string;
};

type TranscriptSegment = {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
  speakerLabel?: string;
};

type GenerateCaptionTranscriptOptions = {
  inputPath?: string;
  fromJsonPath?: string;
  outputPath?: string;
  videoId?: string;
  language?: string;
  minWords?: number;
  maxWords?: number;
  targetDurationMs?: number;
  maxDurationMs?: number;
  gapBreakMs?: number;
};

const DEFAULT_OPTIONS = {
  inputPath: "public/video1.mp4",
  outputPath: "data/transcript.ts",
  videoId: "video1",
  language: "en",
  minWords: 1,
  maxWords: 3,
  targetDurationMs: 1250,
  maxDurationMs: 1800,
  gapBreakMs: 420,
};

export async function generateCaptionTranscript(
  options: GenerateCaptionTranscriptOptions = {},
) {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const result = config.fromJsonPath
    ? await readSmallestResponse(config.fromJsonPath)
    : await transcribeMediaFile(config.inputPath, config.language);

  const words = normalizeWords(result.words);
  const sourceText = result.transcription || words.map((word) => word.word).join(" ");
  const segments =
    words.length > 0
      ? groupWordsForCaptions(words, config)
      : fallbackSegments(result, sourceText);

  await writeTranscriptModule(config.outputPath, segments);

  return {
    outputPath: config.outputPath,
    segmentCount: segments.length,
    wordCount: words.length,
    text: sourceText,
  };
}

async function transcribeMediaFile(inputPath: string, language: string) {
  const apiKey = process.env.SMALLEST_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Missing SMALLEST_API_KEY. Set it before running this manual transcript script.",
    );
  }

  const media = await readFile(path.resolve(inputPath));
  const params = new URLSearchParams({
    language,
    word_timestamps: "true",
    diarize: "false",
    format: "true",
    punctuate: "true",
    capitalize: "true",
  });

  const response = await fetch(
    `https://api.smallest.ai/waves/v1/pulse/get_text?${params}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/octet-stream",
      },
      body: media,
    },
  );

  const result = (await response.json()) as SmallestPulseResponse;

  if (!response.ok || result.status === "error") {
    const message =
      result.error?.message ||
      `Smallest.ai transcription failed with HTTP ${response.status}`;
    throw new Error(message);
  }

  return result;
}

async function readSmallestResponse(fromJsonPath: string) {
  const json = await readFile(path.resolve(fromJsonPath), "utf8");
  return JSON.parse(json) as SmallestPulseResponse;
}

function normalizeWords(words: SmallestPulseResponse["words"]): TranscriptWord[] {
  return (words || [])
    .filter(
      (word) =>
        word.word && typeof word.start === "number" && typeof word.end === "number",
    )
    .map((word) => ({
      word: String(word.word),
      startMs: secondsToMs(Number(word.start)),
      endMs: secondsToMs(Number(word.end)),
      speakerLabel: word.speaker,
    }));
}

function groupWordsForCaptions(
  words: TranscriptWord[],
  options: Required<Omit<GenerateCaptionTranscriptOptions, "fromJsonPath">> &
    Pick<GenerateCaptionTranscriptOptions, "fromJsonPath">,
): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  let current: TranscriptWord[] = [];
  let segmentStart = words[0]?.startMs || 0;

  words.forEach((word, index) => {
    const next = words[index + 1];

    if (current.length === 0) {
      segmentStart = word.startMs;
    }

    current.push(word);

    const duration = word.endMs - segmentStart;
    const nextGap = next ? next.startMs - word.endMs : 0;
    const reachedMinWords = current.length >= options.minWords;
    const reachedMaxWords = current.length >= options.maxWords;
    const reachedTargetDuration = duration >= options.targetDurationMs;
    const reachedMaxDuration = duration >= options.maxDurationMs;
    const reachedSentenceEnd = /[.!?]$/.test(word.word);
    const reachedNaturalPause = nextGap >= options.gapBreakMs;

    const shouldBreak =
      reachedMaxWords ||
      reachedMaxDuration ||
      (reachedMinWords &&
        (reachedTargetDuration || reachedSentenceEnd || reachedNaturalPause));

    if (shouldBreak) {
      segments.push(wordsToSegment(current, segments.length));
      current = [];
    }
  });

  if (current.length > 0) {
    segments.push(wordsToSegment(current, segments.length));
  }

  return segments;
}

function fallbackSegments(
  result: SmallestPulseResponse,
  sourceText: string,
): TranscriptSegment[] {
  const utterances = (result.utterances || [])
    .filter(
      (utterance) =>
        typeof utterance.start === "number" && typeof utterance.end === "number",
    )
    .map((utterance, index) => ({
      id: makeSegmentId(index),
      startMs: secondsToMs(Number(utterance.start)),
      endMs: secondsToMs(Number(utterance.end)),
      text: String(utterance.text || utterance.transcript || "").trim(),
      speakerLabel: utterance.speaker,
    }))
    .filter((segment) => segment.text.length > 0);

  if (utterances.length > 0) {
    return utterances;
  }

  return sourceText.trim()
    ? [
        {
          id: makeSegmentId(0),
          startMs: 0,
          endMs: result.audio_length ? secondsToMs(result.audio_length) : 0,
          text: sourceText.trim(),
        },
      ]
    : [];
}

function wordsToSegment(words: TranscriptWord[], index: number): TranscriptSegment {
  const first = words[0];
  const last = words[words.length - 1];

  return {
    id: makeSegmentId(index),
    startMs: first?.startMs || 0,
    endMs: last?.endMs || first?.startMs || 0,
    text: words.map((word) => word.word).join(" "),
    speakerLabel: first?.speakerLabel,
  };
}

async function writeTranscriptModule(
  outputPath: string,
  segments: TranscriptSegment[],
) {
  const serializableSegments = segments.map((segment) => {
    if (segment.speakerLabel) {
      return segment;
    }

    return {
      id: segment.id,
      startMs: segment.startMs,
      endMs: segment.endMs,
      text: segment.text,
    };
  });

  const contents = `export const transcript = ${JSON.stringify(
    serializableSegments,
    null,
    2,
  )} as const;\n`;

  await writeFile(path.resolve(outputPath), contents, "utf8");
}

function makeSegmentId(index: number) {
  return `seg_${String(index + 1).padStart(4, "0")}`;
}

function secondsToMs(seconds: number) {
  return Math.round(seconds * 1000);
}

function parseArgs(argv: string[]): GenerateCaptionTranscriptOptions {
  const options: GenerateCaptionTranscriptOptions = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (!arg.startsWith("--")) continue;

    const [key, inlineValue] = arg.slice(2).split("=");
    const value = inlineValue ?? next;

    if (inlineValue === undefined) {
      index += 1;
    }

    if (!value) continue;

    switch (key) {
      case "input":
        options.inputPath = value;
        break;
      case "from-json":
        options.fromJsonPath = value;
        break;
      case "output":
        options.outputPath = value;
        break;
      case "video-id":
        options.videoId = value;
        break;
      case "language":
        options.language = value;
        break;
      case "min-words":
        options.minWords = Number(value);
        break;
      case "max-words":
        options.maxWords = Number(value);
        break;
      case "target-ms":
        options.targetDurationMs = Number(value);
        break;
      case "max-ms":
        options.maxDurationMs = Number(value);
        break;
      case "gap-ms":
        options.gapBreakMs = Number(value);
        break;
      default:
        throw new Error(`Unknown option: --${key}`);
    }
  }

  return options;
}

const isDirectRun = path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url);

if (isDirectRun) {
  generateCaptionTranscript(parseArgs(process.argv.slice(2)))
    .then((result) => {
      console.log(
        `Wrote ${result.segmentCount} caption segments (${result.wordCount} words) to ${result.outputPath}`,
      );
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
