import {
  assertTimestampedTranscription,
  buildTextOnlyTranscript,
  downloadAudioForTranscription,
  getVideoId,
  segmentsForMatching,
  tryYoutubeCaptions,
} from "./ingest";
import { scorePhrasesWithGemini } from "./gemini";
import { buildCaptionTranscript } from "./normalize";
import { findSegmentSpan } from "./phrase-match";
import {
  getClipsPath,
  getSegmentsPath,
  getSelectedPhrasesPath,
  getTextTranscriptPath,
  getTranscriptPath,
  getVideoStorageDir,
  saveJsonFile,
  saveTextFile,
  saveViralResult,
  updateViralJob,
} from "./storage";
import { buildTimeline } from "./timeline";
import { transcribeWithProviderQueue } from "./transcription";
import type {
  AiPhraseSelection,
  PhraseScore,
  UnifiedTranscription,
  ViralGenerateOptions,
  ViralGenerationLog,
  ViralGenerationResult,
  ViralJobStatus,
} from "./types";

export async function generateViralClipPlan(
  options: ViralGenerateOptions,
  onProgress?: (status: ViralJobStatus, progress: number) => Promise<void>,
): Promise<ViralGenerationResult> {
  const logs: ViralGenerationLog[] = [];
  const videoId = getVideoId(options.inputUrl);
  const videoDir = getVideoStorageDir(videoId);

  const report = async (status: ViralJobStatus, progress: number) => {
    if (onProgress) await onProgress(status, progress);
  };

  await report("captions", 10);

  let transcription: UnifiedTranscription | undefined;

  logs.push({
    stage: "captions",
    status: "success",
    message: "Trying YouTube manual captions, then auto captions.",
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

  if (!transcription) {
    await report("transcribing", 25);
    logs.push({
      stage: "audio",
      status: "success",
      message: "No YouTube captions found. Downloading audio for STT fallback.",
    });

    const audioPath = await downloadAudioForTranscription({
      inputUrl: options.inputUrl,
      videoDir,
      videoId,
    });

    transcription = await transcribeWithProviderQueue({
      audioPath,
      language: options.language,
      logs,
    });
  }

  assertTimestampedTranscription(transcription);

  const textTranscript = buildTextOnlyTranscript(transcription);
  const matchSegments = segmentsForMatching(transcription);
  const textTranscriptPath = getTextTranscriptPath(videoId);
  const segmentsPath = getSegmentsPath(videoId);

  await saveTextFile(textTranscriptPath, textTranscript);
  await saveJsonFile(segmentsPath, matchSegments);

  await report("scoring", 45);

  logs.push({
    stage: "gemini",
    status: "success",
    message: `Scoring transcript (${matchSegments.length} segments) with Gemini.`,
  });

  const aiSelections = await scorePhrasesWithGemini({
    textTranscript,
    targetDuration: options.targetDuration,
  });

  if (aiSelections.length === 0) {
    throw new Error("Gemini returned no usable viral phrases.");
  }

  await report("matching", 70);

  const selectedPhrases = matchAiSelections(aiSelections, matchSegments, logs);
  if (selectedPhrases.length === 0) {
    throw new Error(
      "Could not match any Gemini phrases to timed transcript segments.",
    );
  }

  const selectedPhrasesPath = getSelectedPhrasesPath(videoId);
  const clipsPath = getClipsPath(videoId);
  await saveJsonFile(selectedPhrasesPath, aiSelections);
  await saveJsonFile(clipsPath, selectedPhrases);

  const captionTranscript = buildCaptionTranscript(transcription);
  const timeline = buildTimeline(selectedPhrases, options.targetDuration);

  await report("saving", 90);

  const result: ViralGenerationResult = {
    videoId,
    inputUrl: options.inputUrl,
    createdAt: new Date().toISOString(),
    options,
    transcriptPath: getTranscriptPath(videoId),
    textTranscriptPath,
    segmentsPath,
    selectedPhrasesPath,
    clipsPath,
    transcription,
    captionTranscript,
    aiSelections,
    selectedPhrases,
    timeline,
    logs,
  };

  const outputPath = await saveViralResult(result);
  await report("done", 100);

  return {
    ...result,
    transcriptPath: outputPath,
  };
}

export async function runViralJob(jobId: string, options: ViralGenerateOptions) {
  const videoId = getVideoId(options.inputUrl);

  try {
    await updateViralJob(jobId, {
      status: "pending",
      progress: 0,
      options,
      inputUrl: options.inputUrl,
      videoId,
    });

    const result = await generateViralClipPlan(options, async (status, progress) => {
      await updateViralJob(jobId, { status, progress, videoId });
    });

    await updateViralJob(jobId, {
      status: "done",
      progress: 100,
      videoId: result.videoId,
      result,
    });

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateViralJob(jobId, {
      status: "error",
      error: message,
    });
    throw error;
  }
}

function matchAiSelections(
  aiSelections: AiPhraseSelection[],
  segments: Array<{ start: number; end: number; text: string }>,
  logs: ViralGenerationLog[],
): PhraseScore[] {
  const matched: PhraseScore[] = [];

  for (const selection of aiSelections) {
    const span = findSegmentSpan(selection.text, segments);
    if (!span) {
      logs.push({
        stage: "matching",
        status: "warning",
        message: `No segment match for phrase: ${selection.text}`,
      });
      continue;
    }

    if (!span.matched) {
      logs.push({
        stage: "matching",
        status: "warning",
        message: `Low-confidence match (${span.score.toFixed(2)}) for: ${selection.text}`,
      });
    }

    matched.push({
      ...selection,
      start: span.start,
      end: span.end,
      startIndex: span.startIndex,
      endIndex: span.endIndex,
      matchScore: span.score,
      matchedText: span.matchedText,
      matched: span.matched,
    });
  }

  return matched;
}
