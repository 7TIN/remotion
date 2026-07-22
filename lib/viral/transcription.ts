import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  normalizeGenericSegmentResponse,
  normalizeSmallestResponse,
} from "./normalize";
import type {
  SttProviderName,
  UnifiedTranscription,
  ViralGenerationLog,
} from "./types";

type TranscribeOptions = {
  audioPath: string;
  language: string;
  selectedProvider: SttProviderName;
  allowFallback: boolean;
  logs: ViralGenerationLog[];
};

export async function transcribeWithProviderQueue({
  allowFallback,
  audioPath,
  language,
  logs,
  selectedProvider,
}: TranscribeOptions): Promise<UnifiedTranscription> {
  const providers = allowFallback
    ? selectedProvider === "sarvam"
      ? ["sarvam", "smallest"]
      : ["smallest", "sarvam"]
    : [selectedProvider];

  const failures: string[] = [];

  for (const provider of providers) {
    try {
      logs.push({
        stage: "transcription",
        status: "success",
        message: `Trying ${provider} STT.`,
      });

      const result =
        provider === "sarvam"
          ? await transcribeSarvam(audioPath, language)
          : await transcribeSmallest(audioPath, language);

      if (result.segments.length === 0) {
        throw new Error(`${provider} returned no timestamped segments.`);
      }

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${provider}: ${message}`);
      logs.push({
        stage: "transcription",
        status: "warning",
        message: `${provider} failed: ${message}`,
      });
    }
  }

  throw new Error(`All selected transcription providers failed. ${failures.join(" | ")}`);
}

async function transcribeSarvam(audioPath: string, language: string) {
  const apiKey = process.env.SARVAM_API_KEY;
  if (!apiKey) {
    throw new Error("Missing SARVAM_API_KEY.");
  }

  const form = await makeAudioFormData(audioPath);
  if (language !== "auto") {
    form.set("language_code", language);
  }
  form.set("with_timestamps", "true");

  const response = await fetch("https://api.sarvam.ai/speech-to-text", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "api-subscription-key": apiKey,
    },
    body: form,
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(readProviderError(result, `Sarvam failed with HTTP ${response.status}`));
  }

  return normalizeGenericSegmentResponse(result, "sarvam", language);
}

async function transcribeSmallest(audioPath: string, language: string) {
  const apiKey = process.env.SMALLEST_API_KEY;
  if (!apiKey) {
    throw new Error("Missing SMALLEST_API_KEY.");
  }

  const audio = await readFile(audioPath);
  const params = new URLSearchParams({
    word_timestamps: "true",
    diarize: "false",
    format: "true",
    punctuate: "true",
    capitalize: "true",
  });
  if (language !== "auto") {
    params.set("language", language);
  }

  const response = await fetch(
    `https://api.smallest.ai/waves/v1/pulse/get_text?${params}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/octet-stream",
      },
      body: audio,
    },
  );

  const result = await response.json();

  if (!response.ok || result.status === "error") {
    throw new Error(
      readProviderError(result, `Smallest AI failed with HTTP ${response.status}`),
    );
  }

  return normalizeSmallestResponse(result, language);
}

async function makeAudioFormData(audioPath: string) {
  const bytes = await readFile(audioPath);
  const form = new FormData();
  form.set(
    "file",
    new Blob([bytes], { type: "audio/mpeg" }),
    path.basename(audioPath),
  );
  return form;
}

function readProviderError(result: unknown, fallback: string) {
  if (!result || typeof result !== "object") return fallback;

  const record = result as Record<string, unknown>;
  const error = record.error;

  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const message = (error as Record<string, unknown>).message;
    if (typeof message === "string") return message;
  }

  if (typeof record.message === "string") return record.message;
  return fallback;
}
