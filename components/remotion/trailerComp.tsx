"use client"
import React from "react";
import {
  AbsoluteFill,
  OffthreadVideo,
} from "remotion";
import {
  TransitionSeries,
  linearTiming,
} from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { flip } from "@remotion/transitions/flip";

// ── Types ──────────────────────────────────────────────

export interface VideoSeriesCompProps {
  clipSources?: string[];
  clipDurations?: number[];
}

import type {TransitionPresentation} from "@remotion/transitions";
import {
  clampDuration,
  COMP_FPS,
} from "./trailerConfig";

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
const TRANSITION_FRAMES = 6; // 0.25s quick cuts

// ── Build clip list from JSON timestamps ───────────────
// `VideoSeriesComp` receives clip durations from the page at runtime.
const DEFAULT_CLIPS: Array<{ id: number; src: string; durationInFrames: number }> = [];

// ── Total composition duration ─────────────────────────
// Transitions overlap adjacent clips, so subtract their durations
export function computeTotalFrames(clipDurations?: number[]) {
  const durations = clipDurations?.length
    ? clipDurations.map(clampDuration)
    : DEFAULT_CLIPS.map((clip) => clip.durationInFrames);

  return (
    durations.reduce((sum, duration) => sum + duration, 0) -
    Math.max(0, durations.length - 1) * TRANSITION_FRAMES
  );
}

// ── Thrilling transition presets (cycles through) ──────

// ── Component ──────────────────────────────────────────
export const VideoSeriesComp: React.FC<VideoSeriesCompProps> = ({
  clipSources,
  clipDurations,
}) => {
  const clipsToRender = clipSources?.length
    ? clipSources.map((src, index) => ({
        id: index + 1,
        src,
        durationInFrames: clipDurations
          ? clampDuration(clipDurations[index] ?? COMP_FPS * 3)
          : COMP_FPS * 3,
      }))
    : DEFAULT_CLIPS;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <TransitionSeries>
        {clipsToRender.map((clip, i) => (
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

            {i < clipsToRender.length - 1 && (
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