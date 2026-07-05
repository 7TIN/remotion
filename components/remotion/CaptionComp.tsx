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
import { loadFont as loadDancingScript } from "@remotion/google-fonts/DancingScript";

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
const { fontFamily: fontScript } = loadDancingScript("normal", {
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
  position:
    | "center"
    | "top-left"
    | "top-right"
    | "bottom-left"
    | "bottom-right";
  startFrame: number;
  endFrame: number;
  wordStaggerFrames?: number; // frames between each word appearance
};

type CaptionCompProps = {
  transcript: Segment[];
};

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
  entranceFrom: "left" | "top";
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

  const fromVal = entranceFrom === "left" ? -70 : -45;
  const translateProp = entranceFrom === "left" ? "translateX" : "translateY";
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
): RenderResult => {
  if (node.type === "word") {
    const wordFrame = frame - sequenceIndex * stagger;
    const entranceFrom = parentDirection === "horizontal" ? "left" : "top";

    return {
      element: (
        <AnimatedWord
          key={`w-${sequenceIndex}-${node.text}`}
          text={node.text}
          style={node.style}
          frame={wordFrame}
          fps={fps}
          entranceFrom={entranceFrom}
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
        justifyContent:
          isRoot && scenePosition === "center" ? "center" : undefined,
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
  const duration = scene.endFrame - scene.startFrame;

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
    // "top-left": { justifyContent: "flex-start", alignItems: "flex-start"},
    // "top-right": { justifyContent: "flex-start", alignItems: "flex-end" },
    // "bottom-left": { justifyContent: "flex-end", alignItems: "flex-start" },
    // "bottom-right": { justifyContent: "flex-end", alignItems: "flex-end" },
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
  );

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        padding: 120,
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
const STYLE_PALETTE = {
  normal: { fontFamily: fontMono, fontSize: 62, fontWeight: "bold" as const },
  stylish: {
    fontFamily: fontScript,
    fontSize: 74,
    fontStyle: "italic" as const,
  },
  big: { fontFamily: fontOswald, fontSize: 92, fontWeight: "bold" as const },
  formal: { fontFamily: fontFormal, fontSize: 56 },
};

const autoBuildScenes = (
  transcript: Segment[],
  fps: number,
): KineticScene[] => {
  const scenes: KineticScene[] = [];

  transcript.forEach((seg) => {
    const words = seg.text.trim().split(/\s+/).filter(Boolean);
    const segStart = Math.floor((seg.startMs / 1000) * fps);
    const segEnd = Math.ceil((seg.endMs / 1000) * fps);
    const segDur = segEnd - segStart;

    // Chunk into groups of 2-3 words
    const chunks: string[][] = [];
    let i = 0;
    while (i < words.length) {
      const size = Math.min(
        words.length - i,
        2 + Math.floor(Math.random() * 2),
      ); // 2 or 3
      chunks.push(words.slice(i, i + size));
      i += size;
    }

    const chunkDur = Math.max(10, Math.floor(segDur / chunks.length));

    chunks.forEach((chunk, idx) => {
      const start = segStart + idx * chunkDur;
      // const end = Math.min(start + chunkDur + 8, segEnd); // +8 frames overlap
      const end = Math.min(start + chunkDur, segEnd);

      const isVertical = Math.random() > 0.7;
      const positions = [
        "top-left",
        "top-right",
        "bottom-left",
        "bottom-right",
        "center",
      ] as const;
      // const positions = ["center"] as const;

      const position = isVertical
        ? positions[Math.floor(Math.random() * positions.length)]
        : "center";

      const children: KineticNode[] = chunk.map((w) => {
        const keys = Object.keys(
          STYLE_PALETTE,
        ) as (keyof typeof STYLE_PALETTE)[];
        const pick = keys[Math.floor(Math.random() * keys.length)];
        return {
          type: "word",
          text: w,
          style: { ...STYLE_PALETTE[pick], color: "#fff" },
        };
      });

      scenes.push({
        id: `${seg.id}_${idx}`,
        startFrame: start,
        endFrame: end,
        position,
        wordStaggerFrames: 2,
        layout: {
          type: "group",
          direction: isVertical ? "vertical" : "horizontal",
          gap: isVertical ? 8 : 14,
          // gap: isVertical ? 6 : 14,
          alignItems: "center",
          children,
        },
      });
    });
  });

  return scenes;
};

/* ─────────────────────────────────────────
   9. MAIN COMPONENT
   ───────────────────────────────────────── */
export const CaptionComp: React.FC<CaptionCompProps> = ({ transcript }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  /* Toggle between hand-crafted example and auto-generator: */
  const scenes = useMemo(() => {
    return autoBuildScenes(transcript, fps); // ← use this for automatic
    // return EXAMPLE_SCENES;                       // ← hand-crafted example
  }, [transcript, fps]);

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
