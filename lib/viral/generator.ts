import {
  assertTimestampedTranscription,
  downloadAudioForTranscription,
  getVideoId,
  tryYoutubeCaptions,
} from "./ingest";
import { scorePhrasesWithGemini } from "./gemini";
import { buildCaptionTranscript } from "./normalize";
import { getTranscriptPath, getVideoStorageDir, saveViralResult } from "./storage";
import { buildTimeline } from "./timeline";
import { transcribeWithProviderQueue } from "./transcription";
import type {
  UnifiedTranscription,
  ViralGenerateOptions,
  ViralGenerationLog,
  ViralGenerationResult,
} from "./types";

export async function generateViralClipPlan(
  options: ViralGenerateOptions,
): Promise<ViralGenerationResult> {
  const logs: ViralGenerationLog[] = [];
  const videoId = getVideoId(options.inputUrl);
  const videoDir = getVideoStorageDir(videoId);

  let transcription: UnifiedTranscription | undefined;

  if (options.preferYoutubeCaptions) {
    logs.push({
      stage: "captions",
      status: "success",
      message: "Trying YouTube manual and auto captions first.",
    });

    transcription = await tryYoutubeCaptions({
      inputUrl: options.inputUrl,
      language: options.language,
      logs,
      videoDir,
      videoId,
    });

    if (transcription) {
      logs.push({
        stage: "captions",
        status: "success",
        message: `Using ${transcription.source} transcript with ${transcription.segments.length} segments.`,
      });
    }
  }

  if (!transcription) {
    logs.push({
      stage: "audio",
      status: "success",
      message: "Downloading audio for selected STT provider.",
    });

    const audioPath = await downloadAudioForTranscription({
      inputUrl: options.inputUrl,
      videoDir,
      videoId,
    });

    transcription = await transcribeWithProviderQueue({
      allowFallback: options.allowProviderFallback,
      audioPath,
      language: options.language,
      logs,
      selectedProvider: options.sttProvider,
    });
  }

  assertTimestampedTranscription(transcription);
  const captionTranscript = buildCaptionTranscript(transcription);

  logs.push({
    stage: "gemini",
    status: "success",
    message: `Scoring ${transcription.segments.length} transcript segments with ${options.geminiModel}.`,
  });

  const selectedPhrases = await scorePhrasesWithGemini({
    geminiModel: options.geminiModel,
    segments: transcription.segments,
    targetDuration: options.targetDuration,
  });

  if (selectedPhrases.length === 0) {
    throw new Error("Gemini returned no usable viral phrases.");
  }

  const timeline = buildTimeline(selectedPhrases, options.targetDuration);

  const result: ViralGenerationResult = {
    videoId,
    inputUrl: options.inputUrl,
    createdAt: new Date().toISOString(),
    options,
    transcriptPath: getTranscriptPath(videoId),
    transcription,
    captionTranscript,
    selectedPhrases,
    timeline,
    logs,
  };

  const outputPath = await saveViralResult(result);

  return {
    ...result,
    transcriptPath: outputPath,
  };
}
