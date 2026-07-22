import type {
  CaptionTranscriptSegment,
  SmallestPulseResponse,
  TranscriptSegment,
  TranscriptionSource,
  UnifiedTranscription,
  WordTimestamp,
} from "./types";

export function cleanTranscriptText(text: string) {
  return text
    .replace(/\[.*?\]/g, "")
    .replace(/\(.*?\)/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/\{.*?\}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseSubtitleToTranscription(
  contents: string,
  source: Extract<TranscriptionSource, "ytdlp-manual" | "ytdlp-auto">,
  language: string,
): UnifiedTranscription {
  const normalized = contents.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const blocks = normalized
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  const segments: TranscriptSegment[] = [];

  blocks.forEach((block) => {
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => line !== "WEBVTT" && !line.startsWith("NOTE"));

    const timingIndex = lines.findIndex((line) => line.includes("-->"));
    if (timingIndex === -1) return;

    const timing = lines[timingIndex];
    const [rawStart, rawEnd] = timing.split("-->").map((part) => part.trim());
    const start = parseTimestamp(rawStart);
    const end = parseTimestamp(rawEnd.split(/\s+/)[0]);
    const text = cleanTranscriptText(lines.slice(timingIndex + 1).join(" "));

    if (!text || !Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
      return;
    }

    segments.push({
      id: segments.length + 1,
      text,
      start,
      end,
    });
  });

  return buildUnifiedTranscription(source, language, segments);
}

export function normalizeSmallestResponse(
  response: SmallestPulseResponse,
  language: string,
): UnifiedTranscription {
  const words = (response.words || [])
    .filter(
      (word) =>
        word.word && typeof word.start === "number" && typeof word.end === "number",
    )
    .map((word) => ({
      word: cleanTranscriptText(String(word.word)),
      start: Number(word.start),
      end: Number(word.end),
      speaker: word.speaker,
    }))
    .filter((word) => word.word && word.start < word.end);

  const utteranceSegments = (response.utterances || [])
    .filter(
      (utterance) =>
        typeof utterance.start === "number" && typeof utterance.end === "number",
    )
    .map((utterance) => ({
      text: cleanTranscriptText(
        String(utterance.text || utterance.transcript || ""),
      ),
      start: Number(utterance.start),
      end: Number(utterance.end),
      speaker: utterance.speaker,
    }))
    .filter((segment) => segment.text && segment.start < segment.end);

  const segments =
    utteranceSegments.length > 0
      ? utteranceSegments.map((segment, index) => ({
          id: index + 1,
          ...segment,
          words: words
            .filter(
              (word) => word.start >= segment.start && word.end <= segment.end,
            )
            .map(stripSpeakerFromWord),
        }))
      : groupWordsIntoSegments(words);

  const transcription = response.transcription || words.map((word) => word.word).join(" ");
  const duration = response.audio_length || inferDuration(segments);

  return {
    source: "smallest",
    language,
    fullText: cleanTranscriptText(transcription),
    segments,
    duration,
  };
}

export function normalizeGenericSegmentResponse(
  response: unknown,
  source: Extract<TranscriptionSource, "sarvam">,
  language: string,
): UnifiedTranscription {
  const record = response as Record<string, unknown>;
  const rawSegments =
    getArray(record.segments) ||
    getArray(record.utterances) ||
    getArray(record.transcript) ||
    [];
  const rawWords = getArray(record.words) || [];
  const words = rawWords
    .map((item) => item as Record<string, unknown>)
    .map((item) => ({
      word: cleanTranscriptText(String(item.word || item.text || "")),
      start: secondsValue(item.start ?? item.start_time ?? item.startMs),
      end: secondsValue(item.end ?? item.end_time ?? item.endMs),
      confidence:
        typeof item.confidence === "number" ? item.confidence : undefined,
    }))
    .filter((word) => word.word && word.start < word.end);

  let segments: TranscriptSegment[] = rawSegments
    .map((item) => item as Record<string, unknown>)
    .map((item, index) => ({
      id: index + 1,
      text: cleanTranscriptText(
        String(item.text || item.transcript || item.sentence || ""),
      ),
      start: secondsValue(item.start ?? item.start_time ?? item.startMs),
      end: secondsValue(item.end ?? item.end_time ?? item.endMs),
      speaker: typeof item.speaker === "string" ? item.speaker : undefined,
    }))
    .filter((segment) => segment.text && segment.start < segment.end);

  if (segments.length === 0 && words.length > 0) {
    segments = groupWordsIntoSegments(words);
  }

  const fullText =
    cleanTranscriptText(
      String(record.transcript || record.text || record.transcription || ""),
    ) || segments.map((segment) => segment.text).join(" ");

  return {
    source,
    language,
    fullText,
    segments,
    duration: inferDuration(segments),
  };
}

export function buildCaptionTranscript(
  transcription: UnifiedTranscription,
): CaptionTranscriptSegment[] {
  const words = transcription.segments.flatMap((segment) =>
    segment.words && segment.words.length > 0
      ? segment.words
      : estimateWordsForSegment(segment),
  );

  if (words.length === 0) {
    return transcription.segments.map((segment, index) => ({
      id: makeSegmentId(index),
      startMs: secondsToMs(segment.start),
      endMs: secondsToMs(segment.end),
      text: segment.text,
    }));
  }

  const chunks: CaptionTranscriptSegment[] = [];
  let current: WordTimestamp[] = [];
  let start = words[0]?.start || 0;

  words.forEach((word, index) => {
    const next = words[index + 1];

    if (current.length === 0) start = word.start;
    current.push(word);

    const durationMs = secondsToMs(word.end - start);
    const nextGapMs = next ? secondsToMs(next.start - word.end) : 0;
    const shouldBreak =
      current.length >= 3 ||
      durationMs >= 1300 ||
      /[.!?]$/.test(word.word) ||
      nextGapMs >= 420;

    if (shouldBreak) {
      chunks.push({
        id: makeSegmentId(chunks.length),
        startMs: secondsToMs(current[0]?.start || 0),
        endMs: secondsToMs(current[current.length - 1]?.end || 0),
        text: current.map((item) => item.word).join(" "),
      });
      current = [];
    }
  });

  if (current.length > 0) {
    chunks.push({
      id: makeSegmentId(chunks.length),
      startMs: secondsToMs(current[0]?.start || 0),
      endMs: secondsToMs(current[current.length - 1]?.end || 0),
      text: current.map((item) => item.word).join(" "),
    });
  }

  return chunks;
}

function buildUnifiedTranscription(
  source: TranscriptionSource,
  language: string,
  segments: TranscriptSegment[],
) {
  return {
    source,
    language,
    fullText: segments.map((segment) => segment.text).join(" "),
    segments,
    duration: inferDuration(segments),
  };
}

function parseTimestamp(timestamp: string) {
  const clean = timestamp.replace(",", ".");
  const parts = clean.split(":").map(Number);
  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    return hours * 3600 + minutes * 60 + seconds;
  }

  if (parts.length === 2) {
    const [minutes, seconds] = parts;
    return minutes * 60 + seconds;
  }

  return Number.NaN;
}

function groupWordsIntoSegments(
  words: Array<WordTimestamp & { speaker?: string }>,
): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  let current: Array<WordTimestamp & { speaker?: string }> = [];
  let start = words[0]?.start || 0;

  words.forEach((word) => {
    if (current.length === 0) start = word.start;
    current.push(word);

    const duration = word.end - start;
    const shouldBreak =
      duration >= 5 ||
      current.length >= 18 ||
      (duration >= 1.4 && /[.!?]$/.test(word.word));

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

function wordsToSegment(
  words: Array<WordTimestamp & { speaker?: string }>,
  index: number,
): TranscriptSegment {
  const first = words[0];
  const last = words[words.length - 1];

  return {
    id: index + 1,
    text: words.map((word) => word.word).join(" "),
    start: first?.start || 0,
    end: last?.end || first?.start || 0,
    speaker: first?.speaker,
    words: words.map(stripSpeakerFromWord),
  };
}

function stripSpeakerFromWord({
  confidence,
  end,
  start,
  word,
}: WordTimestamp & { speaker?: string }): WordTimestamp {
  return {
    word,
    start,
    end,
    ...(typeof confidence === "number" ? { confidence } : {}),
  };
}

function estimateWordsForSegment(segment: TranscriptSegment): WordTimestamp[] {
  const words = segment.text.split(/\s+/).filter(Boolean);
  const duration = Math.max(0.1, segment.end - segment.start);
  const wordDuration = duration / Math.max(1, words.length);

  return words.map((word, index) => ({
    word,
    start: segment.start + index * wordDuration,
    end: segment.start + (index + 1) * wordDuration,
  }));
}

function inferDuration(segments: TranscriptSegment[]) {
  return segments[segments.length - 1]?.end || 0;
}

function secondsToMs(seconds: number) {
  return Math.round(seconds * 1000);
}

function makeSegmentId(index: number) {
  return `seg_${String(index + 1).padStart(4, "0")}`;
}

function getArray(value: unknown) {
  return Array.isArray(value) ? value : undefined;
}

function secondsValue(value: unknown) {
  if (typeof value !== "number") return 0;
  return value > 1000 ? value / 1000 : value;
}
