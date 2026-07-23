import { spawn } from "node:child_process";
import { readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

// ── Types ──────────────────────────────────────────────
interface Clip {
  text: string;
  score: number;
  category: string;
  start: number;
  end: number;
  startIndex: number;
  endIndex: number;
  matchScore: number;
  transcript: string;
}

// ── Config ───────────────────────────────────────────
const JSON_PATH = "D:\\remotion\\captions-clips.json";
const YOUTUBE_URL = "https://youtu.be/NNH-RLNyzoM";
const OUT_DIR = "clips";
const CONCURRENCY = 4;

// ── Helpers ──────────────────────────────────────────
function exec(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { shell: false });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
    child.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });

    child.on("close", (code: number | null) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(`${cmd} failed (code ${code}): ${stderr.trim()}`));
    });
  });
}

function secondsToTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;
  const minutes = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(3);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${secs.padStart(6, "0")}`;
}

async function getStreamUrls(url: string): Promise<string[]> {
  const out = await exec("yt-dlp", [
    "-f", "bv*+ba/b",
    "--no-playlist",
    "-g",
    url,
  ]);
  return out.split("\n").filter(Boolean);
}

function buildFfmpegArgs(
  urls: string[],
  start: number,
  end: number,
  output: string
): string[] {
  const startTs = secondsToTimestamp(start);
  const endTs = secondsToTimestamp(end);

  const base = [
    "-hide_banner", "-y",
    "-avoid_negative_ts", "make_zero",
  ];

  if (urls.length >= 2) {
    return [
      ...base,
      "-ss", startTs, "-to", endTs, "-i", urls[0],
      "-ss", startTs, "-to", endTs, "-i", urls[1],
      "-map", "0:v:0", "-map", "1:a:0",
      "-vf", "setpts=PTS-STARTPTS",
      "-af", "asetpts=PTS-STARTPTS",
      "-c:v", "libx264", "-preset", "fast", "-crf", "18",
      "-c:a", "aac", "-b:a", "192k",
      "-movflags", "+faststart",
      output,
    ];
  }

  return [
    ...base,
    "-ss", startTs, "-to", endTs, "-i", urls[0],
    "-vf", "setpts=PTS-STARTPTS",
    "-af", "asetpts=PTS-STARTPTS",
    "-c:v", "libx264", "-preset", "fast", "-crf", "18",
    "-c:a", "aac", "-b:a", "192k",
    "-movflags", "+faststart",
    output,
  ];
}

async function cropClip(
  urls: string[],
  clip: Clip,
  index: number,
  outDir: string
): Promise<void> {
  if (clip.start == null || clip.end == null) {
    console.log(`[${index + 1}] skipped: missing timestamps`);
    return;
  }

  const output = join(outDir, `${index + 1}.mp4`);
  const args = buildFfmpegArgs(urls, clip.start, clip.end, output);

  console.log(
    `[${index + 1}] ${clip.start.toFixed(3)}s → ${clip.end.toFixed(3)}s  (${(clip.end - clip.start).toFixed(3)}s)  → ${output}`
  );
  await exec("ffmpeg", args);
  console.log(`[${index + 1}] done`);
}

// ── Concurrency limiter ────────────────────────────────
async function runInBatches<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<T[]> {
  const results: Promise<T>[] = [];
  const executing = new Set<Promise<T>>();

  for (const task of tasks) {
    const p = task().then((r) => {
      executing.delete(p);
      return r;
    });
    results.push(p);
    executing.add(p);
    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }
  return Promise.all(results);
}

// ── Main ───────────────────────────────────────────────
async function main(): Promise<void> {
  const raw = await readFile(JSON_PATH, "utf-8");
  const clips: Clip[] = JSON.parse(raw);
  const validClips = clips.filter((c) => c.start != null && c.end != null);

  console.log(`Found ${validClips.length} clips. Fetching stream URLs…`);
  const urls = await getStreamUrls(YOUTUBE_URL);
  console.log(
    `Streams: ${urls.length} URL(s) (${urls.length >= 2 ? "separate V+A" : "combined"})`
  );

  await mkdir(OUT_DIR, { recursive: true });

  const tasks = validClips.map(
    (clip, i) => () => cropClip(urls, clip, i, OUT_DIR)
  );

  console.log(`Starting batch crop (concurrency: ${CONCURRENCY})…`);
  await runInBatches(tasks, CONCURRENCY);

  console.log("\nAll clips cropped.");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});