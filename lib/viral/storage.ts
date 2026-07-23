import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ViralGenerationResult, ViralJob } from "./types";

const STORAGE_ROOT = path.join(process.cwd(), "storage");
const VIDEOS_ROOT = path.join(STORAGE_ROOT, "videos");
const JOBS_ROOT = path.join(STORAGE_ROOT, "jobs");

export function getVideoStorageDir(videoId: string) {
  return path.join(VIDEOS_ROOT, videoId);
}

export function getTranscriptPath(videoId: string) {
  return path.join(getVideoStorageDir(videoId), "viral-result.json");
}

export function getTextTranscriptPath(videoId: string) {
  return path.join(getVideoStorageDir(videoId), "transcript.txt");
}

export function getSegmentsPath(videoId: string) {
  return path.join(getVideoStorageDir(videoId), "segments.json");
}

export function getSelectedPhrasesPath(videoId: string) {
  return path.join(getVideoStorageDir(videoId), "selected-phrases.json");
}

export function getClipsPath(videoId: string) {
  return path.join(getVideoStorageDir(videoId), "clips.json");
}

export function getJobPath(jobId: string) {
  return path.join(JOBS_ROOT, `${jobId}.json`);
}

export async function saveJsonFile(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function saveTextFile(filePath: string, contents: string) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, contents, "utf8");
}

export async function saveViralResult(result: ViralGenerationResult) {
  const outputPath = getTranscriptPath(result.videoId);
  await saveJsonFile(outputPath, result);
  return outputPath;
}

export async function saveViralJob(job: ViralJob) {
  await saveJsonFile(getJobPath(job.jobId), job);
}

export async function readViralJob(jobId: string): Promise<ViralJob | undefined> {
  try {
    const contents = await readFile(getJobPath(jobId), "utf8");
    return JSON.parse(contents) as ViralJob;
  } catch {
    return undefined;
  }
}

export async function updateViralJob(
  jobId: string,
  patch: Partial<ViralJob>,
): Promise<ViralJob> {
  const current = (await readViralJob(jobId)) ?? {
    jobId,
    status: "pending",
    progress: 0,
    inputUrl: "",
    options: { inputUrl: "", language: "en", targetDuration: 30 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const next: ViralJob = {
    ...current,
    ...patch,
    jobId,
    updatedAt: new Date().toISOString(),
  };

  await saveViralJob(next);
  return next;
}
