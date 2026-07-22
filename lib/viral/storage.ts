import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ViralGenerationResult } from "./types";

const STORAGE_ROOT = path.join(process.cwd(), "storage", "videos");

export function getVideoStorageDir(videoId: string) {
  return path.join(STORAGE_ROOT, videoId);
}

export function getTranscriptPath(videoId: string) {
  return path.join(getVideoStorageDir(videoId), "viral-result.json");
}

export async function saveViralResult(result: ViralGenerationResult) {
  const outputPath = getTranscriptPath(result.videoId);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  return outputPath;
}
