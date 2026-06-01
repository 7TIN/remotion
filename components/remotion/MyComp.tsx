import { Video } from "@remotion/media";
import { useMemo } from "react";
import {
  AbsoluteFill,
  OffthreadVideo,
  useCurrentFrame,
  useVideoConfig,
  staticFile,
} from "remotion";


import { loadFont } from "@remotion/google-fonts/GeistMono";


export type Segment = {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
};

type CaptionChunk = {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
};

type MyCompProps = {
  transcript: Segment[];
};

const { fontFamily } = loadFont("normal", {
  subsets : ["latin"]
});

const MAX_WORDS_PER_CAPTION = 8;
const MIN_WORDS_PER_CAPTION = 3;
const MS_PER_WORD = 260;
const MIN_CAPTION_DURATION_MS = 650;
const MAX_CAPTION_DURATION_MS = 1700;
const CAPTION_DURATION_SCALE = 0.60;
const CAPTION_GAP_MS = 50;

const NEXT_PHRASE_BREAK_WORDS = new Set([
  "and",
  "but",
  "because",
  "so",
  "that",
  "which",
  "while",
  "when",
  "where",
  "who",
  "with",
]);

const END_PHRASE_BREAK_WORDS = new Set(["like"]);

const normalizeWord = (word: string) =>
  word.toLowerCase().replace(/^[^a-z0-9']+|[^a-z0-9']+$/gi, "");

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const countWords = (text: string) =>
  text.trim().split(/\s+/).filter(Boolean).length;

const splitTextIntoCaptions = (text: string): string[] => {
  const words = text.trim().split(/\s+/).filter(Boolean);

  if (words.length <= MAX_WORDS_PER_CAPTION) {
    return [text.trim()];
  }

  const captions: string[] = [];
  let currentWords: string[] = [];

  words.forEach((word, index) => {
    currentWords.push(word);

    const isLastWord = index === words.length - 1;
    const currentWord = normalizeWord(word);
    const nextWord = words[index + 1] ? normalizeWord(words[index + 1]) : "";
    const hasEnoughWords = currentWords.length >= MIN_WORDS_PER_CAPTION;
    const hasSentencePunctuation = /[.!?;:]$/.test(word);
    const reachedMaxWords = currentWords.length >= MAX_WORDS_PER_CAPTION;
    const nextStartsPhrase = NEXT_PHRASE_BREAK_WORDS.has(nextWord);
    const currentEndsPhrase = END_PHRASE_BREAK_WORDS.has(currentWord);

    if (
      isLastWord ||
      (hasEnoughWords &&
        (hasSentencePunctuation ||
          reachedMaxWords ||
          currentEndsPhrase ||
          (currentWords.length >= 4 && nextStartsPhrase)))
    ) {
      captions.push(currentWords.join(" "));
      currentWords = [];
    }
  });

  return captions;
};

const splitSegmentIntoCaptionChunks = (segment: Segment): CaptionChunk[] => {
  const captions = splitTextIntoCaptions(segment.text);
  const totalWords = captions.reduce(
    (total, caption) => total + countWords(caption),
    0
  );
  const durationMs = segment.endMs - segment.startMs;
  let elapsedWords = 0;

  return captions.map((caption, index) => {
    const captionWords = countWords(caption);
    const startMs =
      index === 0
        ? segment.startMs
        : segment.startMs + (durationMs * elapsedWords) / totalWords;

    elapsedWords += captionWords;

    const estimatedEndMs =
      index === captions.length - 1
        ? segment.endMs
        : segment.startMs + (durationMs * elapsedWords) / totalWords;
    const estimatedDurationMs = estimatedEndMs - startMs;
    const readableDurationMs = clamp(
      captionWords * MS_PER_WORD,
      MIN_CAPTION_DURATION_MS,
      MAX_CAPTION_DURATION_MS
    );
    const visibleDurationMs = Math.min(
      estimatedDurationMs * CAPTION_DURATION_SCALE,
      readableDurationMs
    );
    const gapMs = index === captions.length - 1 ? 0 : CAPTION_GAP_MS;
    const endMs = Math.min(
      startMs + visibleDurationMs,
      Math.max(startMs, estimatedEndMs - gapMs)
    );

    return {
      id: `${segment.id}_${index}`,
      startMs,
      endMs,
      text: caption,
    };
  });
};

export const MyComp: React.FC<MyCompProps> = ({ transcript }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const currentMs = (frame / fps) * 1000;

  const captionChunks = useMemo(
    () => transcript.flatMap(splitSegmentIntoCaptionChunks),
    [transcript]
  );

  const activeCaption = captionChunks.find(
    (caption) => currentMs >= caption.startMs && currentMs < caption.endMs
  );

  return (
    <AbsoluteFill>
      <Video src={staticFile("video1.mp4")} />

      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div
          style={{
            color: "white",
            fontFamily,
            fontSize: 60,
            fontWeight: "bold",
            textAlign: "center",
            maxWidth: "80%",
            textShadow: "0 0 10px rgba(0,0,0,0.9)",
          }}
        >
          {activeCaption?.text}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
