import React, { useMemo, useEffect, useState } from "react";
import {
  prefetch,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  AbsoluteFill,
  OffthreadVideo,
} from "remotion";
import {
  TransitionSeries,
  linearTiming,
} from "@remotion/transitions";
import { loadFont } from "@remotion/google-fonts/GeistMono";
import { fade } from "@remotion/transitions/fade";

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

type VideoDef = {
  id: number;
  src: string;
  durationInFrames: number;
};

// ───────────────────────────────────────────────
// MODULE-LEVEL DATA (computed once on import)
// ───────────────────────────────────────────────

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
  "and", "but", "because", "so", "that", "which",
  "while", "when", "where", "who", "with",
]);
const END_PHRASE_BREAK_WORDS = new Set(["like"]);

const videos: VideoDef[] = [
  { id: 1, src: "clip_00-03.mp4", durationInFrames: 72 },
  { id: 2, src: "rest_03-10.mp4", durationInFrames: 168 },
  { id: 3, src: "clip_10-13.mp4", durationInFrames: 72 },
  { id: 4, src: "rest_13-18.mp4", durationInFrames: 120 },
  { id: 5, src: "clip_18-21.mp4", durationInFrames: 72 },
  { id: 6, src: "rest_21-26.mp4", durationInFrames: 120 },
  { id: 7, src: "clip_26-29.mp4", durationInFrames: 72 },
  { id: 8, src: "rest_29-end.mp4", durationInFrames: 138 },
];

const backVideo: VideoDef[] = [
  { id: 1, src: "b016d130-df46-4fea-a00e-66199ba94e67_output.webm", durationInFrames: 72 },
  { id: 3, src: "887ff269-255a-422d-b0e8-d5d9d3c673f9_output.webm", durationInFrames: 72 },
  { id: 5, src: "c5a88e61-5aab-4a12-9b4a-ad697dff2eaa_output.webm", durationInFrames: 72 },
  { id: 7, src: "4201bfc4-2e10-4366-8747-24272d7c8470_output.webm", durationInFrames: 72 },
];

// ─── PRECOMPUTED VIDEO MAP (zero lookups at render time) ───
const resolvedVideos = videos.map((vid) => ({
  ...vid,
  resolvedSrc: staticFile(vid.src),
  backSrc: vid.src.includes("clip")
    ? staticFile(backVideo.find((b) => b.id === vid.id)?.src ?? "")
    : null,
}));

// All video URLs for prefetch
export const ALL_VIDEO_SRCS = resolvedVideos.flatMap((v) =>
  v.backSrc ? [v.resolvedSrc, v.backSrc] : [v.resolvedSrc]
);

// ─── PRECOMPUTED STYLES (no object re-creation per frame) ───
const Z1_STYLE: React.CSSProperties = { zIndex: 1 };
const Z3_STYLE: React.CSSProperties = { zIndex: 3 };
const TEXT_LAYER_STYLE: React.CSSProperties = {
  zIndex: 2,
  justifyContent: "flex-start",
  alignItems: "center",
};
const INTELLIGENCE_STYLE: React.CSSProperties = {
  fontFamily,
  fontSize: 140,
  color: "white",
  fontWeight: "bold",
  textAlign: "center",
  paddingTop: 200,
};
const CAPTION_BOX_STYLE: React.CSSProperties = {
  justifyContent: "center",
  alignItems: "center",
  zIndex: 10,
  pointerEvents: "none",
};
const CAPTION_TEXT_STYLE: React.CSSProperties = {
  color: "white",
  fontFamily,
  fontSize: 60,
  fontWeight: "bold",
  textAlign: "center",
  maxWidth: "80%",
  willChange: "transform",
  textShadow: "0 2px 8px rgba(0,0,0,0.6)",
};

// ─── CAPTION UTILITIES ───
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
  const totalWords = captions.reduce((t, c) => t + countWords(c), 0);
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

const buildCaptionMap = (
  chunks: CaptionChunk[],
  fps: number
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

// ─── ISOLATED CAPTION COMPONENT ───
const CaptionOverlay = React.memo<{
  captionMap: Map<number, string>;
  frame: number;
}>(({ captionMap, frame }) => {
  const text = captionMap.get(frame);
  if (!text) return null;
  return (
    <AbsoluteFill style={CAPTION_BOX_STYLE}>
      <div style={CAPTION_TEXT_STYLE}>{text}</div>
    </AbsoluteFill>
  );
});
CaptionOverlay.displayName = "CaptionOverlay";

// ─── PREFETCH HOOK (Player only) ───
// ─── MAIN COMPOSITION ───
export const MyComp: React.FC<{ transcript: Segment[] }> = ({ transcript }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const captionChunks = useMemo(
    () => transcript.flatMap(splitSegmentIntoCaptionChunks),
    [transcript]
  );
  const captionMap = useMemo(
    () => buildCaptionMap(captionChunks, fps),
    [captionChunks, fps]
  );

  return (
    <AbsoluteFill>
      <TransitionSeries>
        {resolvedVideos.map((vid, i) => (
          <React.Fragment key={vid.id}>
            <TransitionSeries.Sequence
              durationInFrames={vid.durationInFrames}
              premountFor={Math.round(3 * fps)} // 3 sec decoder warmup
            >
              {vid.backSrc ? (
                <AbsoluteFill>
                  <AbsoluteFill style={Z1_STYLE}>
                    <OffthreadVideo
                      src={vid.resolvedSrc}
                      pauseWhenBuffering
                    />
                  </AbsoluteFill>
                  <AbsoluteFill style={TEXT_LAYER_STYLE}>
                    <div style={INTELLIGENCE_STYLE}>INTELLIGENCE</div>
                  </AbsoluteFill>
                  <AbsoluteFill style={Z3_STYLE}>
                    <OffthreadVideo
                      src={vid.backSrc}
                      transparent
                      pauseWhenBuffering
                    />
                  </AbsoluteFill>
                </AbsoluteFill>
              ) : (
                <OffthreadVideo
                  src={vid.resolvedSrc}
                  pauseWhenBuffering
                />
              )}
            </TransitionSeries.Sequence>

            {i < resolvedVideos.length - 1 && (
              <TransitionSeries.Transition
                timing={linearTiming({ durationInFrames: 5 })}
                presentation={fade()}
              />
            )}
          </React.Fragment>
        ))}
      </TransitionSeries>

      <CaptionOverlay captionMap={captionMap} frame={frame} />
    </AbsoluteFill>
  );
};