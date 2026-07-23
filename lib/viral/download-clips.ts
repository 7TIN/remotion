import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { PhraseScore, ViralGenerationLog } from "./types";

const PUBLIC_CLIPS_ROOT = path.join(process.cwd(), "public", "clips");

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

      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });

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
            `${cmd} failed with retryable status (${message}). attempt ${attempt}/${maxRetries}, retrying in ${delay}ms.`,
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

function secondsToTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;
  const minutes = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(3);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${secs.padStart(6, "0")}`;
}

async function getStreamUrls(
  inputUrl: string,
  retries: number,
  retryDelayMs: number,
): Promise<string[]> {
  const out = await execCommand(
    "yt-dlp",
    ["-f", "bv*+ba/b", "--no-playlist", "-g", inputUrl],
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
  const base = ["-hide_banner", "-y", "-avoid_negative_ts", "make_zero"];

  if (urls.length >= 2) {
    return [
      ...base,
      "-ss",
      startTs,
      "-to",
      endTs,
      "-i",
      urls[0],
      "-ss",
      startTs,
      "-to",
      endTs,
      "-i",
      urls[1],
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      "-vf",
      "setpts=PTS-STARTPTS",
      "-af",
      "asetpts=PTS-STARTPTS",
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-crf",
      "18",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-movflags",
      "+faststart",
      output,
    ];
  }

  return [
    ...base,
    "-ss",
    startTs,
    "-to",
    endTs,
    "-i",
    urls[0],
    "-vf",
    "setpts=PTS-STARTPTS",
    "-af",
    "asetpts=PTS-STARTPTS",
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "18",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-movflags",
    "+faststart",
    output,
  ];
}

async function cropClip(
  urls: string[],
  phrase: PhraseScore,
  index: number,
  clipDir: string,
): Promise<{ success: boolean; index: number; src?: string; duration?: number; message?: string }> {
  const output = path.join(clipDir, `${index + 1}.mp4`);
  const args = buildFfmpegArgs(urls, phrase.start, phrase.end, output);

  try {
    await execCommand("ffmpeg", args, process.cwd(), 1, 0);
    const duration = Math.max(0.1, phrase.end - phrase.start);
    return {
      success: true,
      index,
      src: `/clips/${path.basename(clipDir)}/${index + 1}.mp4`,
      duration,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, index, message };
  }
}

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

export async function downloadClipsForVideo({
  inputUrl,
  videoId,
  selectedPhrases,
  maxConcurrency = 3,
  retries = 3,
  retryDelayMs = 1500,
  logs,
}: {
  inputUrl: string;
  videoId: string;
  selectedPhrases: PhraseScore[];
  maxConcurrency?: number;
  retries?: number;
  retryDelayMs?: number;
  logs: ViralGenerationLog[];
}): Promise<Array<{ src: string; duration: number }>> {
  const clipDir = path.join(PUBLIC_CLIPS_ROOT, videoId);
  await mkdir(clipDir, { recursive: true });

  logs.push({
    stage: "download",
    status: "success",
    message: `Preparing clip downloads in public/clips/${videoId}`,
  });

  let urls: string[];

  try {
    urls = await getStreamUrls(inputUrl, retries, retryDelayMs);
    logs.push({
      stage: "download",
      status: "success",
      message: `Downloaded stream URLs (${urls.length} URL(s)).`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logs.push({
      stage: "download",
      status: "warning",
      message: `Could not resolve stream URLs for clip cropping: ${message}`,
    });
    return [];
  }

  const successfulSources: Array<string | undefined> = Array(selectedPhrases.length).fill(undefined);
  const successfulDurations: Array<number | undefined> = Array(selectedPhrases.length).fill(undefined);
  const tasks = selectedPhrases.map((phrase, index) => async () => {
    const result = await cropClip(urls, phrase, index, clipDir);
    if (!result.success) {
      logs.push({
        stage: "download",
        status: "warning",
        message: `Clip ${index + 1} failed: ${result.message}`,
      });
      return result;
    }

    if (result.src) {
      successfulSources[index] = result.src;
      successfulDurations[index] = result.duration;
    }

    return result;
  });

  const results = await runInBatches(tasks, maxConcurrency);
  const succeeded = results.filter((result) => (result as { success: boolean }).success).length;
  const failed = results.length - succeeded;

  logs.push({
    stage: "download",
    status: failed > 0 ? "warning" : "success",
    message: `Clip crop complete. ${succeeded} succeeded, ${failed} failed.`,
  });

  return successfulSources
    .map((src, index) => ({
      src,
      duration: successfulDurations[index] ?? 0,
    }))
    .filter((item): item is { src: string; duration: number } => typeof item.src === "string");
}
