export const COMP_FPS = 24;
export const COMP_WIDTH = 1920;
export const COMP_HEIGHT = 1080;

const TRANSITION_FRAMES = 6;

export function clampDuration(duration: number) {
  return Math.max(1, Math.round(duration * COMP_FPS));
}

export function computeTotalFrames(clipDurations?: number[]) {
  const durations = clipDurations?.length
    ? clipDurations.map(clampDuration)
    : [];

  return (
    durations.reduce((sum, duration) => sum + duration, 0) -
    Math.max(0, durations.length - 1) * TRANSITION_FRAMES
  );
}
