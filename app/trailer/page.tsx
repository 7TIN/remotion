import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  COMP_FPS,
  COMP_HEIGHT,
  COMP_WIDTH,
  computeTotalFrames,
} from "@/components/remotion/trailerConfig";
import { VideoSeriesComp } from "@/components/remotion/trailerComp";
import { Player } from "@remotion/player";

type ClipData = {
  start: number;
  end: number;
  [key: string]: unknown;
};

async function loadClipDurations(): Promise<number[]> {
  const filePath = path.join(process.cwd(), "captions-clips.json");
  try {
    const raw = await readFile(filePath, "utf8");
    const clips = (JSON.parse(raw) as ClipData[]).filter(
      (clip) =>
        typeof clip.start === "number" &&
        typeof clip.end === "number" &&
        clip.end > clip.start,
    );

    return clips.map((clip) => clip.end - clip.start);
  } catch (error) {
    if (
      error instanceof Error &&
      (error as { code?: string }).code === "ENOENT"
    ) {
      console.warn(`captions-clips.json not found at build time: ${filePath}`);
      return [];
    }

    throw error;
  }
}

export default async function TrailerPage() {
  const clipDurations = await loadClipDurations();
  const clipSources = clipDurations.map(
    (_, index) => `/clips/${index + 1}.mp4`,
  );
  const durationInFrames = computeTotalFrames(clipDurations);

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 dark:bg-black font-mono">
      <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Player
          acknowledgeRemotionLicense
          component={VideoSeriesComp}
          durationInFrames={durationInFrames}
          compositionWidth={COMP_WIDTH}
          compositionHeight={COMP_HEIGHT}
          fps={COMP_FPS}
          controls
          inputProps={{ clipSources, clipDurations }}
          style={{
            width: "100%",
          }}
        />
      </div>
    </div>
  );
}
