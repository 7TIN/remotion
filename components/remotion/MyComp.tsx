import React, { useMemo } from "react";
import {
  AbsoluteFill,
  OffthreadVideo,
  useCurrentFrame,
  useVideoConfig,
  staticFile,
  Series,
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
  videos: { id: number; src: string; durationInFrames: number }[];
  backVideo: { id: number; src: string; durationInFrames: number }[];
};

const { fontFamily } = loadFont("normal", {
  subsets: ["latin"],
});

const MAX_WORDS_PER_CAPTION = 8;
const MIN_WORDS_PER_CAPTION = 3;
const MS_PER_WORD = 260;
const MIN_CAPTION_DURATION_MS = 650;
const MAX_CAPTION_DURATION_MS = 1700;
const CAPTION_DURATION_SCALE = 0.6;
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
  if (words.length <= MAX_WORDS_PER_CAPTION) return [text.trim()];

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
  const totalWords = captions.reduce((total, c) => total + countWords(c), 0);
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
      MAX_CAPTION_DURATION_MS,
    );
    const visibleDurationMs = Math.min(
      estimatedDurationMs * CAPTION_DURATION_SCALE,
      readableDurationMs,
    );
    const gapMs = index === captions.length - 1 ? 0 : CAPTION_GAP_MS;
    const endMs = Math.min(
      startMs + visibleDurationMs,
      Math.max(startMs, estimatedEndMs - gapMs),
    );

    return {
      id: `${segment.id}_${index}`,
      startMs,
      endMs,
      text: caption,
    };
  });
};

// ───────────────────────────────────────────────
// PRE-BUILD CAPTION MAP (O(1) lookup at runtime)
// ───────────────────────────────────────────────
const buildCaptionMap = (
  chunks: CaptionChunk[],
  fps: number,
): Map<number, string> => {
  const map = new Map<number, string>();
  chunks.forEach((chunk) => {
    const startFrame = Math.floor((chunk.startMs / 1000) * fps);
    const endFrame = Math.ceil((chunk.endMs / 1000) * fps);
    for (let f = startFrame; f < endFrame; f++) {
      map.set(f, chunk.text);
    }
  });
  return map;
};

// ───────────────────────────────────────────────
// SEPARATE CAPTION COMPONENT (isolated re-renders)
// ───────────────────────────────────────────────
const CaptionOverlay: React.FC<{
  captionMap: Map<number, string>;
  frame: number;
}> = React.memo(({ captionMap, frame }) => {
  const text = captionMap.get(frame);
  if (!text) return null;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        zIndex: 10,
        pointerEvents: "none",
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
          willChange: "transform",
          textShadow: "0 2px 8px rgba(0,0,0,0.6)",
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
});
CaptionOverlay.displayName = "CaptionOverlay";

// ───────────────────────────────────────────────
// MAIN COMPOSITION COMPONENT
// ───────────────────────────────────────────────
export const MyComp: React.FC<MyCompProps> = ({
  transcript,
  videos,
  backVideo,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Precompute caption chunks once (transcript is const)
  const captionChunks = useMemo(
    () => transcript.flatMap(splitSegmentIntoCaptionChunks),
    [transcript],
  );

  // Build O(1) frame lookup map once
  const captionMap = useMemo(
    () => buildCaptionMap(captionChunks, fps),
    [captionChunks, fps],
  );

  return (
    <AbsoluteFill>
      <Series>
        {videos.map((vid) => (
          <Series.Sequence
            key={vid.src}
            durationInFrames={vid.durationInFrames}
            premountFor={Math.round(1.5 * fps)}
          >
            {vid.src.includes("clip") ? (
              <AbsoluteFill>
                <AbsoluteFill style={{ zIndex: 1 }}>
                  <OffthreadVideo
                    src={staticFile(vid.src)}
                    pauseWhenBuffering
                  />
                </AbsoluteFill>
                <AbsoluteFill
                  style={{
                    zIndex: 2,
                    justifyContent: "flex-start",
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      fontFamily,
                      fontSize: 140,
                      color: "white",
                      fontWeight: "bold",
                      textAlign: "center",
                      paddingTop: 200,
                    }}
                  >
                    INTELLIGENCE
                  </div>
                </AbsoluteFill>
                <AbsoluteFill style={{ zIndex: 3 }}>
                  <OffthreadVideo
                    pauseWhenBuffering
                    src={staticFile(
                      backVideo.find((bvid) => bvid.id === vid.id)?.src || "",
                    )}
                    transparent
                  />
                </AbsoluteFill>
              </AbsoluteFill>
            ) : (
              <OffthreadVideo src={staticFile(vid.src)} pauseWhenBuffering />
            )}
          </Series.Sequence>
        ))}
      </Series>

      {/* Isolated caption layer — only this re-renders on frame change */}
      <CaptionOverlay captionMap={captionMap} frame={frame} />
    </AbsoluteFill>
  );
};
