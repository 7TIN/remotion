import React, { useMemo } from "react";
import { Video } from "@remotion/media";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
  staticFile,
} from "remotion";

import { loadFont as loadGeistMono } from "@remotion/google-fonts/GeistMono";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadOswald } from "@remotion/google-fonts/Oswald";
import { loadFont as loadMerriweather } from "@remotion/google-fonts/Merriweather";
import { loadFont as loadEAVWNH } from "@remotion/google-fonts/EduAUVICWANTHand";


// const dancingScript = Dancing_Script({ subsets: ["latin"] });
/* ─────────────────────────────────────────
   1. FONT LOADING (module level)
   ───────────────────────────────────────── */
//  Dancing_Script
const { fontFamily: fontMono } = loadGeistMono("normal", {
  subsets: ["latin"],
});
const { fontFamily: fontInter } = loadInter("normal", { subsets: ["latin"] });
const { fontFamily: fontOswald } = loadOswald("normal", { subsets: ["latin"] });
const { fontFamily: fontChill } = loadEAVWNH("normal", {
  subsets: ["latin"],
});
const { fontFamily: fontFormal } = loadMerriweather("normal", {
  subsets: ["latin"],
});

/* ─────────────────────────────────────────
   2. TYPES
   ───────────────────────────────────────── */
export type Segment = {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
};

type WordStyle = {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string | number;
  fontStyle?: string;
  color?: string;
  letterSpacing?: string;
  textTransform?: string;
  textShadow?: string;
};

type WordNode = {
  type: "word";
  text: string;
  style?: WordStyle;
};

type GroupNode = {
  type: "group";
  direction: "horizontal" | "vertical";
  children: KineticNode[];
  gap?: number;
  alignItems?: "center" | "flex-start" | "flex-end";
};

type KineticNode = WordNode | GroupNode;

type KineticScene = {
  id: string;
  layout: GroupNode; // root is always a group
  position: KineticCaptionPosition;
  startFrame: number;
  endFrame: number;
  wordStaggerFrames?: number; // frames between each word appearance
  entranceFrom?: "left" | "right" | "top" | "bottom";
};

export type KineticCaptionPosition =
  | "center"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export type KineticCaptionPreset =
  | "aesthetic"
  | "editorial"
  | "punchy"
  | "minimal";

export type KineticCaptionStyle = {
  preset: KineticCaptionPreset;
  primaryFont: string;
  secondaryFont: string;
  emotionFont: string;
  formalFont: string;
  boldFont: string;
  color: string;
  mutedColor: string;
  accentColor: string;
  normalFontSize: number;
  stylishFontSize: number;
  formalFontSize: number;
  boldFontSize: number;
  normalFontWeight: number;
  formalFontWeight: number;
  boldFontWeight: number;
  stylishFrequency: number;
  verticalFrequency: number;
  boldFrequency: number;
  maxWordsPerScene: 2 | 3 | 4;
};

export type CaptionCompProps = {
  transcript: Segment[];
  stylePreset?: KineticCaptionPreset;
  captionStyle?: Partial<KineticCaptionStyle>;
  captionPosition?: KineticCaptionPosition;
  specialFontColor?: string;
};

export type CaptionInputProps = Omit<CaptionCompProps, "transcript">;

/* ─────────────────────────────────────────
   3. DEFAULT READABILITY STYLES
   ───────────────────────────────────────── */
const DEFAULT_WORD_STYLE: WordStyle = {
  color: "#ffffff",
  textShadow: "0 2px 12px rgba(0,0,0,0.7), 0 0 24px rgba(0,0,0,0.4)",
};

/* ─────────────────────────────────────────
   4. ANIMATED WORD COMPONENT
   ───────────────────────────────────────── */
const AnimatedWord = React.memo<{
  text: string;
  style?: WordStyle;
  frame: number; // relative to this word's scheduled entrance
  fps: number;
  entranceFrom: "left" | "right" | "top" | "bottom";
}>(({ text, style, frame, fps, entranceFrom }) => {
  const progress = spring({
    frame: Math.max(0, frame),
    fps,
    config: { damping: 14, stiffness: 220, mass: 0.55 },
  });

  const opacity = interpolate(progress, [0, 0.25], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const isHorizontal = entranceFrom === "left" || entranceFrom === "right";
  const fromVal =
    entranceFrom === "right" || entranceFrom === "bottom"
      ? 58
      : isHorizontal
        ? -70
        : -48;
  const translateProp = isHorizontal ? "translateX" : "translateY";
  const translate = interpolate(progress, [0, 1], [fromVal, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const scale = interpolate(progress, [0, 1], [0.88, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <span
      style={{
        display: "inline-block",
        opacity,
        transform: `${translateProp}(${translate}px) scale(${scale})`,
        whiteSpace: "nowrap",
        willChange: "transform, opacity",
        lineHeight: 1.1,
        ...DEFAULT_WORD_STYLE,
        ...style,
      }}
    >
      {text}
    </span>
  );
});
AnimatedWord.displayName = "AnimatedWord";

/* ─────────────────────────────────────────
   5. RECURSIVE LAYOUT RENDERER
   ───────────────────────────────────────── */
type RenderResult = { element: React.ReactNode; nextSequence: number };

const renderKineticNode = (
  node: KineticNode,
  frame: number,
  fps: number,
  stagger: number,
  sequenceIndex: number,
  parentDirection: "horizontal" | "vertical",
  isRoot: boolean = false,
  scenePosition: string = "",
  entranceFrom?: "left" | "right" | "top" | "bottom",
): RenderResult => {
  if (node.type === "word") {
    const wordFrame = frame - sequenceIndex * stagger;
    const wordEntrance =
      entranceFrom ?? (parentDirection === "horizontal" ? "left" : "top");

    return {
      element: (
        <AnimatedWord
          key={`w-${sequenceIndex}-${node.text}`}
          text={node.text}
          style={node.style}
          frame={wordFrame}
          fps={fps}
          entranceFrom={wordEntrance}
        />
      ),
      nextSequence: sequenceIndex + 1,
    };
  }

  const children: React.ReactNode[] = [];
  let currentSeq = sequenceIndex;

  node.children.forEach((child, i) => {
    const result = renderKineticNode(
      child,
      frame,
      fps,
      stagger,
      currentSeq,
      node.direction,
      false,
      scenePosition,
      entranceFrom,
    );
    children.push(
      <div key={`c-${i}`} style={{ display: "contents" }}>
        {result.element}
      </div>,
    );
    currentSeq = result.nextSequence;
  });

  const element = (
    <div
      key={`g-${sequenceIndex}`}
      style={{
        display: "flex",
        flexDirection: node.direction === "horizontal" ? "row" : "column",
        gap: node.gap ?? (node.direction === "horizontal" ? 14 : 8),
        alignItems:
          isRoot && scenePosition === "center"
            ? "center"
            : (node.alignItems ??
              (node.direction === "vertical" ? "flex-start" : "center")),
        // justifyContent:
        //   isRoot && scenePosition === "center" ? "center" : undefined,
      }}
    >
      {children}
    </div>
  );

  return { element, nextSequence: currentSeq };
};

/* ─────────────────────────────────────────
   6. SCENE RENDERER (handles position + fade)
   ───────────────────────────────────────── */
const KineticSceneRenderer = React.memo<{
  scene: KineticScene;
  frame: number;
  fps: number;
}>(({ scene, frame, fps }) => {
  const isVisible = frame >= scene.startFrame && frame < scene.endFrame;
  if (!isVisible) return null;

  const relativeFrame = frame - scene.startFrame;

  // Scene-level fade in / fade out
  // const sceneOpacity = interpolate(
  //   relativeFrame,
  //   [0, 4, duration - 4, duration],
  //   [0, 1, 1, 0],
  //   { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  // );
  const sceneOpacity = 1;

  const positionMap: Record<string, React.CSSProperties> = {
    center: { justifyContent: "center", alignItems: "center" },
    "top-left": { justifyContent: "flex-start", alignItems: "flex-start" },
    "top-right": { justifyContent: "flex-start", alignItems: "flex-end" },
    "bottom-left": { justifyContent: "flex-end", alignItems: "flex-start" },
    "bottom-right": { justifyContent: "flex-end", alignItems: "flex-end" },
  };

  const { element } = renderKineticNode(
    scene.layout,
    relativeFrame,
    fps,
    scene.wordStaggerFrames ?? 2,
    0,
    scene.layout.direction,
    true,
    scene.position,
    scene.entranceFrom,
  );

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        padding: 120,
        boxSizing: "border-box",
        pointerEvents: "none",
        opacity: sceneOpacity,
        ...positionMap[scene.position],
      }}
    >
      {element}
    </AbsoluteFill>
  );
});
KineticSceneRenderer.displayName = "KineticSceneRenderer";

/* ─────────────────────────────────────────
   7. EXAMPLE: your exact 2-second phrase
   ─────────────────────────────────────────
   Phrase: "I was scrolling on X and I came across"
   Assumed 30 fps → 2 sec = 60 frames
   ───────────────────────────────────────── */
// const EXAMPLE_SCENES: KineticScene[] = [
//   /* ── Section 1 ──
//      "I was scrolling"  →  horizontal, centered  */
//   {
//     id: "s1",
//     startFrame: 0,
//     endFrame: 22,
//     position: "center",
//     wordStaggerFrames: 2,
//     layout: {
//       type: "group",
//       direction: "horizontal",
//       gap: 14,
//       alignItems: "center",
//       children: [
//         {
//           type: "word",
//           text: "I",
//           style: { fontFamily: fontMono, fontSize: 58, fontWeight: "bold" },
//         },
//         {
//           type: "word",
//           text: "was",
//           style: {
//             fontFamily: fontScript,
//             fontSize: 64,
//             fontStyle: "italic",
//             color: "#f3f3f3",
//           },
//         },
//         {
//           type: "word",
//           text: "scrolling",
//           style: { fontFamily: fontMono, fontSize: 58, fontWeight: "bold" },
//         },
//       ],
//     },
//   },

//   /* ── Section 2 ──
//      "on X and I"
//      • "on"  → normal
//      • "X"   → big bold brand-style
//      • "and I" → "and" formal, "I" italic, arranged LEFT-TO-RIGHT
//      • The whole thing sits TOP-LEFT and flows TOP-TO-BOTTOM
//   */
//   {
//     id: "s2",
//     startFrame: 16,
//     endFrame: 44,
//     position: "top-left",
//     wordStaggerFrames: 3,
//     layout: {
//       type: "group",
//       direction: "vertical",
//       gap: 6,
//       alignItems: "flex-start",
//       children: [
//         {
//           type: "word",
//           text: "on",
//           style: { fontFamily: fontMono, fontSize: 46, fontWeight: "bold" },
//         },
//         {
//           type: "word",
//           text: "X",
//           style: {
//             fontFamily: fontOswald,
//             fontSize: 96,
//             fontWeight: "bold",
//             letterSpacing: "-0.02em",
//             textShadow: "0 4px 24px rgba(0,0,0,0.6)",
//           },
//         },
//         {
//           /* nested horizontal group: "and I" */
//           type: "group",
//           direction: "horizontal",
//           gap: 10,
//           alignItems: "center",
//           children: [
//             {
//               type: "word",
//               text: "and",
//               style: {
//                 fontFamily: fontFormal,
//                 fontSize: 44,
//                 color: "#e8e8e8",
//               },
//             },
//             {
//               type: "word",
//               text: "I",
//               style: {
//                 fontFamily: fontInter,
//                 fontSize: 50,
//                 fontStyle: "italic",
//                 fontWeight: 600,
//               },
//             },
//           ],
//         },
//       ],
//     },
//   },

//   /* ── Section 3 ──
//      "came across" → horizontal, centered  */
//   {
//     id: "s3",
//     startFrame: 36,
//     endFrame: 62,
//     position: "center",
//     wordStaggerFrames: 2,
//     layout: {
//       type: "group",
//       direction: "horizontal",
//       gap: 16,
//       alignItems: "center",
//       children: [
//         {
//           type: "word",
//           text: "came",
//           style: { fontFamily: fontMono, fontSize: 58, fontWeight: "bold" },
//         },
//         {
//           type: "word",
//           text: "across",
//           style: {
//             fontFamily: fontScript,
//             fontSize: 66,
//             fontStyle: "italic",
//             fontWeight: 300,
//             letterSpacing: "-0.01em",
//           },
//         },
//       ],
//     },
//   },
// ];

/* ─────────────────────────────────────────
   8. OPTIONAL: Auto-generator from transcript
   (Use this if you want to derive scenes from
   your existing Segment[] data instead of
   hand-crafting every scene.)
   ───────────────────────────────────────── */
const FONT_STACKS = {
  appleGaramond:
    "Apple Garamond, Iowan Old Style, Palatino Linotype, Palatino, Georgia, serif",
  impact: "Impact, Haettenschweiler, Arial Narrow Bold, sans-serif",
  interBlack: fontInter,
};

const PRESET_STYLES: Record<KineticCaptionPreset, KineticCaptionStyle> = {
  aesthetic: {
    preset: "aesthetic",
    primaryFont: fontInter,
    secondaryFont: fontMono,
    emotionFont: `${FONT_STACKS.appleGaramond}, ${fontChill}`,
    formalFont: fontFormal,
    boldFont: FONT_STACKS.impact,
    color: "#ffffff",
    mutedColor: "#f1efe9",
    accentColor: "#f1efe9",
    normalFontSize: 72,
    stylishFontSize: 88,
    formalFontSize: 64,
    boldFontSize: 118,
    normalFontWeight: 760,
    formalFontWeight: 430,
    boldFontWeight: 900,
    stylishFrequency: 0.22,
    verticalFrequency: 0.34,
    boldFrequency: 0.18,
    maxWordsPerScene: 3,
  },
  editorial: {
    preset: "editorial",
    primaryFont: fontFormal,
    secondaryFont: fontInter,
    emotionFont: FONT_STACKS.appleGaramond,
    formalFont: fontFormal,
    boldFont: fontOswald,
    color: "#ffffff",
    mutedColor: "#e7ded1",
    accentColor: "#b8f7ff",
    normalFontSize: 68,
    stylishFontSize: 78,
    formalFontSize: 70,
    boldFontSize: 108,
    normalFontWeight: 650,
    formalFontWeight: 700,
    boldFontWeight: 800,
    stylishFrequency: 0.16,
    verticalFrequency: 0.28,
    boldFrequency: 0.12,
    maxWordsPerScene: 3,
  },
  punchy: {
    preset: "punchy",
    primaryFont: fontInter,
    secondaryFont: fontMono,
    emotionFont: fontChill,
    formalFont: fontFormal,
    boldFont: FONT_STACKS.impact,
    color: "#ffffff",
    mutedColor: "#f7f7f7",
    accentColor: "#ffef5c",
    normalFontSize: 76,
    stylishFontSize: 94,
    formalFontSize: 62,
    boldFontSize: 132,
    normalFontWeight: 900,
    formalFontWeight: 500,
    boldFontWeight: 900,
    stylishFrequency: 0.18,
    verticalFrequency: 0.45,
    boldFrequency: 0.3,
    maxWordsPerScene: 2,
  },
  minimal: {
    preset: "minimal",
    primaryFont: fontInter,
    secondaryFont: fontFormal,
    emotionFont: FONT_STACKS.appleGaramond,
    formalFont: fontFormal,
    boldFont: fontOswald,
    color: "#ffffff",
    mutedColor: "#d8d8d8",
    accentColor: "#ffffff",
    normalFontSize: 62,
    stylishFontSize: 68,
    formalFontSize: 58,
    boldFontSize: 92,
    normalFontWeight: 600,
    formalFontWeight: 400,
    boldFontWeight: 700,
    stylishFrequency: 0.08,
    verticalFrequency: 0.22,
    boldFrequency: 0.08,
    maxWordsPerScene: 3,
  },
};

const CONNECTOR_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "for",
  "from",
  "i",
  "if",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "so",
  "the",
  "to",
  "was",
  "were",
  "with",
  "you",
]);

const EMOTION_WORDS = new Set([
  "amazing",
  "beautiful",
  "best",
  "crazy",
  "deep",
  "dream",
  "fast",
  "famous",
  "found",
  "huge",
  "important",
  "insane",
  "love",
  "massive",
  "never",
  "new",
  "quickly",
  "rare",
  "real",
  "really",
  "scrolling",
  "secret",
  "special",
  "suddenly",
  "viral",
  "wild",
]);

const BRAND_WORDS = new Set([
  "ai",
  "apple",
  "chatgpt",
  "google",
  "instagram",
  "meta",
  "openai",
  "tiktok",
  "twitter",
  "x",
  "youtube",
]);

const TAILWIND_COLORS: Record<string, string> = {
  "slate-100": "#f1f5f9",
  "slate-200": "#e2e8f0",
  "slate-300": "#cbd5e1",
  "gray-100": "#f3f4f6",
  "gray-200": "#e5e7eb",
  "gray-300": "#d1d5db",
  "red-300": "#fca5a5",
  "red-400": "#f87171",
  "red-500": "#ef4444",
  "orange-300": "#fdba74",
  "orange-400": "#fb923c",
  "orange-500": "#f97316",
  "amber-200": "#fde68a",
  "amber-300": "#fcd34d",
  "amber-400": "#fbbf24",
  "yellow-200": "#fef08a",
  "yellow-300": "#fde047",
  "yellow-400": "#facc15",
  "lime-300": "#bef264",
  "lime-400": "#a3e635",
  "green-300": "#86efac",
  "green-400": "#4ade80",
  "emerald-300": "#6ee7b7",
  "emerald-400": "#34d399",
  "teal-300": "#5eead4",
  "teal-400": "#2dd4bf",
  "cyan-200": "#a5f3fc",
  "cyan-300": "#67e8f9",
  "cyan-400": "#22d3ee",
  "sky-300": "#7dd3fc",
  "sky-400": "#38bdf8",
  "blue-300": "#93c5fd",
  "blue-400": "#60a5fa",
  "indigo-300": "#a5b4fc",
  "indigo-400": "#818cf8",
  "violet-300": "#c4b5fd",
  "violet-400": "#a78bfa",
  "purple-300": "#d8b4fe",
  "purple-400": "#c084fc",
  "fuchsia-300": "#f0abfc",
  "fuchsia-400": "#e879f9",
  "pink-300": "#f9a8d4",
  "pink-400": "#f472b6",
  "rose-300": "#fda4af",
  "rose-400": "#fb7185",
  white: "#ffffff",
  black: "#000000",
};

const resolveTailwindColor = (color: string | undefined) => {
  if (!color) return undefined;

  const normalized = color.trim().replace(/^text-/, "").toLowerCase();
  return TAILWIND_COLORS[normalized] ?? color;
};

const resolveCaptionStyle = (
  stylePreset: KineticCaptionPreset = "aesthetic",
  captionStyle?: Partial<KineticCaptionStyle>,
  specialFontColor?: string,
): KineticCaptionStyle => {
  const requestedPreset = captionStyle?.preset ?? stylePreset;
  const base = PRESET_STYLES[requestedPreset] ?? PRESET_STYLES.aesthetic;
  const resolvedSpecialFontColor = resolveTailwindColor(specialFontColor);

  return {
    ...base,
    ...captionStyle,
    ...(resolvedSpecialFontColor
      ? { accentColor: resolvedSpecialFontColor }
      : {}),
    preset: requestedPreset,
  };
};

const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const chance = (seed: string, frequency: number): boolean => {
  return (hashString(seed) % 1000) / 1000 < frequency;
};

const cleanWord = (word: string): string => {
  return word.toLowerCase().replace(/^[^\w]+|[^\w]+$/g, "");
};

const isBrandOrName = (word: string): boolean => {
  const cleaned = cleanWord(word);
  return (
    BRAND_WORDS.has(cleaned) ||
    /^[A-Z0-9]{2,}$/.test(word.replace(/[^\w]/g, "")) ||
    /\d/.test(word)
  );
};

const getWordStyle = (
  word: string,
  style: KineticCaptionStyle,
  seed: string,
  forceBold: boolean,
): WordStyle => {
  const cleaned = cleanWord(word);
  const isConnector = CONNECTOR_WORDS.has(cleaned);
  const isEmotion =
    EMOTION_WORDS.has(cleaned) || /ing$|ly$|ful$|ous$|ive$/.test(cleaned);
  const useStylish =
    !forceBold && isEmotion && chance(`${seed}:stylish`, style.stylishFrequency);
  const useFormal =
    !forceBold && (isConnector || chance(`${seed}:formal`, 0.34));

  if (forceBold) {
    return {
      fontFamily: style.boldFont,
      fontSize: style.boldFontSize,
      fontWeight: style.boldFontWeight,
      color: style.accentColor,
      letterSpacing: "0",
      textTransform: "uppercase",
      textShadow: "0 8px 26px rgba(0,0,0,0.72), 0 0 34px rgba(0,0,0,0.4)",
    };
  }

  if (useStylish) {
    return {
      fontFamily: style.emotionFont,
      fontSize: style.stylishFontSize,
      fontWeight: 500,
      fontStyle: "italic",
      color: style.mutedColor,
      letterSpacing: "0",
    };
  }

  if (useFormal) {
    return {
      fontFamily: style.formalFont,
      fontSize: style.formalFontSize,
      fontWeight: isConnector ? style.formalFontWeight : 700,
      fontStyle: cleaned === "i" ? "italic" : "normal",
      color: style.mutedColor,
      letterSpacing: "0",
    };
  }

  return {
    fontFamily: chance(`${seed}:secondary`, 0.28)
      ? style.secondaryFont
      : style.primaryFont,
    fontSize: style.normalFontSize,
    fontWeight: style.normalFontWeight,
    color: style.color,
    letterSpacing: "0",
  };
};

const splitIntoKineticChunks = (
  words: string[],
  segId: string,
  maxWordsPerScene: 2 | 3 | 4,
): string[][] => {
  const chunks: string[][] = [];
  let i = 0;

  while (i < words.length) {
    const remaining = words.length - i;
    if (remaining <= maxWordsPerScene) {
      chunks.push(words.slice(i));
      break;
    }

    const rareLongChunk = maxWordsPerScene === 4 && chance(`${segId}:${i}:4`, 0.12);
    const size = rareLongChunk
      ? 4
      : chance(`${segId}:${i}:3`, 0.38) && maxWordsPerScene >= 3
        ? 3
        : 2;
    chunks.push(words.slice(i, i + Math.min(size, remaining)));
    i += size;
  }

  return chunks;
};

const buildVerticalLayout = (
  chunk: string[],
  style: KineticCaptionStyle,
  seed: string,
): GroupNode => {
  const children: KineticNode[] = [];
  let wordIndex = 0;

  while (wordIndex < chunk.length) {
    const word = chunk[wordIndex];
    const shouldBold =
      isBrandOrName(word) || chance(`${seed}:${wordIndex}:bold`, style.boldFrequency);

    if (shouldBold) {
      children.push({
        type: "word",
        text: word,
        style: getWordStyle(word, style, `${seed}:${wordIndex}`, true),
      });
      wordIndex += 1;
      continue;
    }

    const nextWord = chunk[wordIndex + 1];
    const shouldPair =
      nextWord &&
      !isBrandOrName(nextWord) &&
      chance(`${seed}:${wordIndex}:pair`, 0.34);

    if (shouldPair) {
      children.push({
        type: "group",
        direction: "horizontal",
        gap: 12,
        alignItems: "center",
        children: [
          {
            type: "word",
            text: word,
            style: getWordStyle(word, style, `${seed}:${wordIndex}`, false),
          },
          {
            type: "word",
            text: nextWord,
            style: getWordStyle(nextWord, style, `${seed}:${wordIndex + 1}`, false),
          },
        ],
      });
      wordIndex += 2;
      continue;
    }

    children.push({
      type: "word",
      text: word,
      style: getWordStyle(word, style, `${seed}:${wordIndex}`, false),
    });
    wordIndex += 1;
  }

  return {
    type: "group",
    direction: "vertical",
    gap: 8,
    alignItems: chance(`${seed}:align-end`, 0.32) ? "flex-end" : "flex-start",
    children,
  };
};

const buildHorizontalLayout = (
  chunk: string[],
  style: KineticCaptionStyle,
  seed: string,
): GroupNode => {
  return {
    type: "group",
    direction: "horizontal",
    gap: 14,
    alignItems: "center",
    children: chunk.map((word, wordIndex) => ({
      type: "word",
      text: word,
      style: getWordStyle(word, style, `${seed}:${wordIndex}`, false),
    })),
  };
};

const autoBuildScenes = (
  transcript: Segment[],
  fps: number,
  style: KineticCaptionStyle,
  captionPosition: KineticCaptionPosition,
): KineticScene[] => {
  const scenes: KineticScene[] = [];

  transcript.forEach((seg) => {
    const words = seg.text.trim().split(/\s+/).filter(Boolean);
    const segStart = Math.floor((seg.startMs / 1000) * fps);
    const segEnd = Math.ceil((seg.endMs / 1000) * fps);
    const segDur = segEnd - segStart;

    const chunks = splitIntoKineticChunks(
      words,
      `${style.preset}:${seg.id}`,
      style.maxWordsPerScene,
    );

    const chunkDur = Math.max(10, Math.floor(segDur / chunks.length));

    chunks.forEach((chunk, idx) => {
      const start = segStart + idx * chunkDur;
      const end = Math.min(start + chunkDur, segEnd);
      const seed = `${style.preset}:${seg.id}:${idx}:${chunk.join(" ")}`;
      const hasImportantWord = chunk.some(isBrandOrName);
      const isVertical =
        hasImportantWord || chance(`${seed}:vertical`, style.verticalFrequency);
      const verticalChunk = [...chunk];
      const entranceOptions: KineticScene["entranceFrom"][] = isVertical
        ? ["top", "left", "right"]
        : ["left", "right"];
      const entranceFrom =
        entranceOptions[hashString(`${seed}:entrance`) % entranceOptions.length];

      scenes.push({
        id: `${seg.id}_${idx}`,
        startFrame: start,
        endFrame: end,
        position: captionPosition,
        wordStaggerFrames: isVertical ? 3 : 2,
        entranceFrom,
        layout: isVertical
          ? buildVerticalLayout(verticalChunk, style, seed)
          : buildHorizontalLayout(chunk, style, seed),
      });
    });
  });

  return scenes;
};

/* ─────────────────────────────────────────
   9. MAIN COMPONENT
   ───────────────────────────────────────── */
export const CaptionComp: React.FC<CaptionCompProps> = ({
  transcript,
  stylePreset = "aesthetic",
  captionStyle,
  captionPosition = "center",
  specialFontColor,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const resolvedStyle = useMemo(
    () => resolveCaptionStyle(stylePreset, captionStyle, specialFontColor),
    [captionStyle, specialFontColor, stylePreset],
  );

  /* Toggle between hand-crafted example and auto-generator: */
  const scenes = useMemo(() => {
    return autoBuildScenes(transcript, fps, resolvedStyle, captionPosition); // ← use this for automatic
    // return EXAMPLE_SCENES;                       // ← hand-crafted example
  }, [transcript, fps, resolvedStyle, captionPosition]);

  return (
    <AbsoluteFill>
      <Video src={staticFile("video1.mp4")} />

      {/* {scenes.map((scene) => (
        <KineticSceneRenderer
          key={scene.id}
          scene={scene}
          frame={frame}
          fps={fps}
        />
      ))} */}

      {(() => {
        const active = scenes.filter(
          (s) => frame >= s.startFrame && frame < s.endFrame,
        );
        const latest = active.sort((a, b) => b.startFrame - a.startFrame)[0];
        return latest ? (
          <KineticSceneRenderer scene={latest} frame={frame} fps={fps} />
        ) : null;
      })()}
    </AbsoluteFill>
  );
};
