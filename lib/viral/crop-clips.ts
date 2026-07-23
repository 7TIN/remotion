import { spawn } from "node:child_process";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";

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

type CropOptions = {
  inputUrl: string;
  jsonPath: string;
  outDir: string;
  concurrency: number;
  retries: number;
  retryDelayMs: number;
};

const DEFAULT_JSON_PATH = "captions-clips.json";
const DEFAULT_CONCURRENCY = 4;
const DEFAULT_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 1500;

// ── Helpers ──────────────────────────────────────────
function execCommand(
  cmd: string,
  args: string[],
  cwd: string,
  maxRetries: number,
  retryDelayMs: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    let attempt = 0;

    const run = () => {
      attempt += 1;
      const child = spawn(cmd, args, { shell: false, cwd });
      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
      child.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });

      child.on("close", (code: number | null) => {
        if (code === 0) {
          resolve(stdout.trim());
          return;
        }

        const message = stderr.trim() || `Process exited with code ${code}`;
        const retryable = isYtDlpRateLimitError(message) && attempt < maxRetries;

        if (retryable) {
          const delay = retryDelayMs * attempt;
          console.warn(
            `${cmd} failed with retryable error. attempt ${attempt}/${maxRetries}. retrying in ${delay}ms: ${message}`,
          );
          setTimeout(run, delay);
          return;
        }

        reject(new Error(`${cmd} failed (code ${code}): ${message}`));
      });

      child.on("error", (error) => {
        reject(new Error(`Failed to spawn ${cmd}: ${error instanceof Error ? error.message : String(error)}`));
      });
    };

    run();
  });
}

function isYtDlpRateLimitError(message: string) {
  const normalized = message.toLowerCase();
  return (
    /http error\s*429/.test(normalized) ||
    /http error\s*403/.test(normalized) ||
    /too many requests/.test(normalized) ||
    /429/.test(normalized) ||
    /403/.test(normalized)
  );
}

function secondsToTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;
  const minutes = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(3);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${secs.padStart(6, "0")}`;
}

async function getStreamUrls(
  url: string,
  retries: number,
  retryDelayMs: number,
): Promise<string[]> {
  const out = await execCommand(
    "yt-dlp",
    ["-f", "bv*+ba/b", "--no-playlist", "-g", url],
    process.cwd(),
    retries,
    retryDelayMs,
  );
  return out.split("\n").filter(Boolean);
}

function buildFfmpegArgs(
  urls: string[],
  start: number,
  end: number,
  output: string,
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
  outDir: string,
): Promise<{ success: boolean; index: number; error?: string }> {
  if (clip.start == null || clip.end == null) {
    console.warn(`[${index + 1}] skipped: missing timestamps`);
    return { success: false, index, error: "missing timestamps" };
  }

  const output = path.join(outDir, `${index + 1}.mp4`);
  const args = buildFfmpegArgs(urls, clip.start, clip.end, output);

  console.log(
    `[${index + 1}] ${clip.start.toFixed(3)}s → ${clip.end.toFixed(3)}s  (${(
      clip.end - clip.start
    ).toFixed(3)}s)  → ${output}`,
  );

  try {
    await execCommand("ffmpeg", args, process.cwd(), 1, 0);
    console.log(`[${index + 1}] done`);
    return { success: true, index };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${index + 1}] failed: ${message}`);
    return { success: false, index, error: message };
  }
}

// ── Concurrency limiter ────────────────────────────────
async function runInBatches<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<T[]> {
  const results: Promise<T>[] = [];
  const executing = new Set<Promise<unknown>>();

  for (const task of tasks) {
    const promise = (async () => task())();
    results.push(promise);

    const wrapped = promise.finally(() => executing.delete(wrapped));
    executing.add(wrapped);

    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }

  return Promise.all(results);
}

// ── Main ───────────────────────────────────────────────
async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const raw = await readFile(options.jsonPath, "utf-8");
  const clips: Clip[] = JSON.parse(raw);
  const validClips = clips.filter(
    (c) => typeof c.start === "number" && typeof c.end === "number" && c.end > c.start,
  );

  if (validClips.length === 0) {
    throw new Error(`No valid clips found in ${options.jsonPath}`);
  }

  console.log(`Found ${validClips.length} clips. Fetching stream URLs…`);
  const urls = await getStreamUrls(options.inputUrl, options.retries, options.retryDelayMs);
  console.log(
    `Streams: ${urls.length} URL(s) (${urls.length >= 2 ? "separate V+A" : "combined"})`,
  );

  await mkdir(options.outDir, { recursive: true });

  const tasks = validClips.map((clip, index) => () => cropClip(urls, clip, index, options.outDir));

  console.log(`Starting batch crop (concurrency: ${options.concurrency})…`);
  const results = await runInBatches(tasks, options.concurrency);

  const succeeded = results.filter((result) => (result as { success: boolean }).success).length;
  const failed = results.length - succeeded;

  console.log(`\nCropped ${succeeded} clip(s) successfully.`);
  if (failed > 0) {
    console.warn(`Skipped ${failed} clip(s) due to errors. Output is still available for successful clips.`);
    process.exitCode = 1;
  }
}

function printUsage() {
  console.log(`Usage: node crop-clips.js --inputUrl <youtube-url> [options]

Options:
  --inputUrl <url>       Required YouTube video URL
  --jsonPath <path>      JSON file with clip timestamps (default: ${DEFAULT_JSON_PATH})
  --outDir <path>        Output directory for clip MP4s (default: public/clips)
  --concurrency <num>    Maximum parallel ffmpeg jobs (default: ${DEFAULT_CONCURRENCY})
  --retries <num>        yt-dlp retry attempts (default: ${DEFAULT_RETRIES})
  --retryDelayMs <num>   Delay multiplier for retries (ms, default: ${DEFAULT_RETRY_DELAY_MS})
  --help                 Show this message
`);
}

function parseArgs(argv: string[]): CropOptions {
  const options: CropOptions = {
    inputUrl: "",
    jsonPath: DEFAULT_JSON_PATH,
    outDir: "public/clips",
    concurrency: DEFAULT_CONCURRENCY,
    retries: DEFAULT_RETRIES,
    retryDelayMs: DEFAULT_RETRY_DELAY_MS,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case "--inputUrl":
      case "--input-url":
        options.inputUrl = argv[++index] ?? "";
        break;
      case "--jsonPath":
      case "--json-path":
        options.jsonPath = argv[++index] ?? options.jsonPath;
        break;
      case "--outDir":
      case "--out-dir":
        options.outDir = argv[++index] ?? options.outDir;
        break;
      case "--concurrency":
        options.concurrency = Number(argv[++index]) || DEFAULT_CONCURRENCY;
        break;
      case "--retries":
        options.retries = Number(argv[++index]) || DEFAULT_RETRIES;
        break;
      case "--retryDelayMs":
      case "--retry-delay-ms":
        options.retryDelayMs = Number(argv[++index]) || DEFAULT_RETRY_DELAY_MS;
        break;
      case "--help":
      case "-h":
        printUsage();
        process.exit(0);
      default:
        if (arg.startsWith("--")) {
          throw new Error(`Unknown argument: ${arg}`);
        }
        break;
    }
  }

  if (!options.inputUrl) {
    throw new Error("--inputUrl is required.");
  }

  return options;
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});