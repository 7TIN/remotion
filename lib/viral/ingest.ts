import { execFile } from "node:child_process";
import { mkdir, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { parseSubtitleToTranscription } from "./normalize";
import { parseYoutubeVtt } from "./youtube-vtt-parser";
import type { UnifiedTranscription, ViralGenerationLog } from "./types";

const execFileAsync = promisify(execFile);

export function getVideoId(inputUrl: string) {
  try {
    const url = new URL(inputUrl);
    const watchId = url.searchParams.get("v");
    if (watchId) return sanitizeId(watchId);

    const pathId = url.pathname.split("/").filter(Boolean).at(-1);
    if (pathId) return sanitizeId(pathId);
  } catch {
    // Fall through to hash-style id.
  }

  return `vid_${Math.abs(hashString(inputUrl))}`;
}

export async function tryYoutubeCaptions({
  inputUrl,
  language,
  videoDir,
  videoId,
  logs,
}: {
  inputUrl: string;
  language: string;
  videoDir: string;
  videoId: string;
  logs: ViralGenerationLog[];
}) {
  const manual = await downloadSubtitleKind({
    inputUrl,
    videoDir,
    videoId,
    kind: "manual",
    language,
    logs,
  });

  if (manual) {
    return transcriptionFromSubtitleFile(
      manual.contents,
      manual.filePath,
      "ytdlp-manual",
      language,
      logs,
    );
  }

  const auto = await downloadSubtitleKind({
    inputUrl,
    videoDir,
    videoId,
    kind: "auto",
    language,
    logs,
  });

  if (auto) {
    return transcriptionFromSubtitleFile(
      auto.contents,
      auto.filePath,
      "ytdlp-auto",
      language,
      logs,
    );
  }

  return undefined;
}

function transcriptionFromSubtitleFile(
  contents: string,
  filePath: string,
  source: Extract<UnifiedTranscription["source"], "ytdlp-manual" | "ytdlp-auto">,
  language: string,
  logs: ViralGenerationLog[],
): UnifiedTranscription {
  const isVtt = filePath.endsWith(".vtt") || contents.trim().startsWith("WEBVTT");

  if (source === "ytdlp-auto" && isVtt) {
    const parsed = parseYoutubeVtt(contents);
    if (parsed.segments.length > 0) {
      logs.push({
        stage: "captions",
        status: "success",
        message: `Parsed ${parsed.segments.length} word-level VTT segments.`,
      });

      return {
        source,
        language,
        fullText: parsed.transcript.replace(/\n/g, " "),
        segments: parsed.segments.map((segment, index) => ({
          id: index + 1,
          text: segment.text,
          start: segment.start,
          end: segment.end,
        })),
        duration: parsed.segments.at(-1)?.end || 0,
      };
    }
  }

  return parseSubtitleToTranscription(contents, source, language);
}

export async function downloadAudioForTranscription({
  inputUrl,
  videoDir,
  videoId,
}: {
  inputUrl: string;
  videoDir: string;
  videoId: string;
}) {
  await mkdir(videoDir, { recursive: true });
  await execYtDlp(
    [
      "-f",
      "bestaudio[ext=m4a]/bestaudio",
      "--extract-audio",
      "--audio-format",
      "mp3",
      "--audio-quality",
      "2",
      "-o",
      `${videoId}_audio.%(ext)s`,
      inputUrl,
    ],
    videoDir,
    { retries: 3, retryDelayMs: 1500 },
  );

  const files = await readdir(videoDir);
  const audioFile = files.find(
    (file) => file.startsWith(`${videoId}_audio`) && file.endsWith(".mp3"),
  );

  if (!audioFile) {
    throw new Error("yt-dlp finished but no MP3 audio file was produced.");
  }

  return path.join(videoDir, audioFile);
}

async function downloadSubtitleKind({
  inputUrl,
  videoDir,
  videoId,
  kind,
  language,
  logs,
}: {
  inputUrl: string;
  videoDir: string;
  videoId: string;
  kind: "manual" | "auto";
  language: string;
  logs: ViralGenerationLog[];
}): Promise<{ filePath: string; contents: string } | undefined> {
  await mkdir(videoDir, { recursive: true });

  try {
    await execYtDlp(
      [
        kind === "manual" ? "--write-subs" : "--write-auto-subs",
        "--sub-langs",
        language,
        "--skip-download",
        "-o",
        `${videoId}.%(ext)s`,
        inputUrl,
      ],
      videoDir,
      { retries: 3, retryDelayMs: 1500 },
    );

    const files = await readdir(videoDir);
    const subtitle = files.find(
      (file) =>
        file.startsWith(videoId) &&
        (file.endsWith(".srt") || file.endsWith(".vtt")),
    );

    if (!subtitle) return undefined;

    const filePath = path.join(videoDir, subtitle);
    logs.push({
      stage: kind === "manual" ? "manual-captions" : "auto-captions",
      status: "success",
      message: `Downloaded ${kind} subtitle file: ${subtitle}`,
    });

    return {
      filePath,
      contents: await readFile(filePath, "utf8"),
    };
  } catch (error) {
    logs.push({
      stage: kind === "manual" ? "manual-captions" : "auto-captions",
      status: "warning",
      message: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}

async function execYtDlp(
  args: string[],
  cwd: string,
  options: { retries?: number; retryDelayMs?: number } = {},
) {
  const maxRetries = options.retries ?? 1;
  const retryDelayMs = options.retryDelayMs ?? 1000;
  let attempt = 0;

  while (true) {
    try {
      await execFileAsync("yt-dlp", args, {
        cwd,
        timeout: 180_000,
        windowsHide: true,
        maxBuffer: 1024 * 1024 * 12,
      });
      return;
    } catch (error) {
      attempt += 1;
      const message = error instanceof Error ? error.message : String(error);
      const isRetryable = isYtDlpRateLimitError(message);

      if (attempt < maxRetries && isRetryable) {
        const delayMs = retryDelayMs * attempt;
        console.warn(
          `yt-dlp retry ${attempt}/${maxRetries} due to rate limit or 403/429: ${message}`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      throw new Error(
        `yt-dlp failed. Make sure yt-dlp is installed and available on PATH. ${message}`,
      );
    }
  }
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

function sanitizeId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "video";
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return hash;
}

export function assertTimestampedTranscription(
  transcription: UnifiedTranscription,
) {
  if (transcription.segments.length === 0) {
    throw new Error("Transcription returned no segments.");
  }

  const invalid = transcription.segments.find(
    (segment) => !(segment.start < segment.end),
  );

  if (invalid) {
    throw new Error(`Transcription segment ${invalid.id} has invalid timestamps.`);
  }
}

export function buildTextOnlyTranscript(transcription: UnifiedTranscription) {
  return transcription.segments.map((segment) => segment.text).join("\n");
}

export function segmentsForMatching(transcription: UnifiedTranscription) {
  return transcription.segments.map((segment) => ({
    start: segment.start,
    end: segment.end,
    text: segment.text,
  }));
}
