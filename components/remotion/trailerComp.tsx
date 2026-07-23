"use client"
import React from "react";
import {
  AbsoluteFill,
  OffthreadVideo,
  staticFile,
} from "remotion";
import {
  TransitionSeries,
  linearTiming,
} from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { flip } from "@remotion/transitions/flip";
import clipsJson from "@/captions-clips.json";

// ── Types ──────────────────────────────────────────────
interface ClipData {
  start: number;
  end: number;
  [key: string]: unknown;
}

import type {TransitionPresentation} from "@remotion/transitions";

type AnyTransitionPresentation = TransitionPresentation<Record<string, unknown>>;

function getTransition(index: number): AnyTransitionPresentation {
  switch (index % 6) {
    case 0:
      return slide({ direction: "from-left" });

    case 1:
      return slide({ direction: "from-right" });

    case 2:
      return slide({ direction: "from-bottom" });

    case 3:
      return wipe({ direction: "from-left" });

    case 4:
      return flip();

    default:
      return fade();
  }
}

// ── Config ─────────────────────────────────────────────
export const COMP_FPS = 24;
export const COMP_WIDTH = 1080;
export const COMP_HEIGHT = 1920;
const TRANSITION_FRAMES = 6; // 0.25s quick cuts

// ── Build clip list from JSON timestamps ───────────────
const clips: ClipData[] = (clipsJson as ClipData[]).filter(
  (c) => typeof c.start === "number" && typeof c.end === "number"
);

// const pwd = process.cwd()

const CLIPS = clips.map((clip, i) => ({
  id: i + 1,
 src: staticFile(`clips/${i + 1}.mp4`),
  durationInFrames: Math.ceil((clip.end - clip.start) * COMP_FPS),
}));

// ── Total composition duration ─────────────────────────
// Transitions overlap adjacent clips, so subtract their durations
export const TOTAL_FRAMES = CLIPS.reduce(
  (sum, c) => sum + c.durationInFrames,
  0
) - Math.max(0, CLIPS.length - 1) * TRANSITION_FRAMES;

// ── Thrilling transition presets (cycles through) ──────

// ── Component ──────────────────────────────────────────
export const VideoSeriesComp: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <TransitionSeries>
        {CLIPS.map((clip, i) => (
          <React.Fragment key={clip.id}>
            <TransitionSeries.Sequence
              durationInFrames={clip.durationInFrames}
              premountFor={Math.round(2 * COMP_FPS)}
            >
              <AbsoluteFill>
                <OffthreadVideo
                  src={clip.src}
                  pauseWhenBuffering
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              </AbsoluteFill>
            </TransitionSeries.Sequence>

            {i < CLIPS.length - 1 && (
              <TransitionSeries.Transition
                timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
                presentation={getTransition(i)}
              />
            )}
          </React.Fragment>
        ))}
      </TransitionSeries>
    </AbsoluteFill>
  );
};