"use client";

import type { ViralGenerationResult, ViralJob } from "@/lib/viral/types";
import {
  AlertCircle,
  CheckCircle2,
  Clipboard,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Player } from "@remotion/player";
import { useEffect, useRef, useState } from "react";
import {
  VideoSeriesComp,
} from "@/components/remotion/trailerComp";
import {
  COMP_FPS,
  COMP_HEIGHT,
  COMP_WIDTH,
  computeTotalFrames,
} from "@/components/remotion/trailerConfig";

type FormState = {
  inputUrl: string;
  language: string;
  targetDuration: number;
};

type GenerateStartResponse =
  | { ok: true; jobId: string; status: string }
  | { ok: false; error: string };

type StatusResponse =
  | { ok: true; job: ViralJob }
  | { ok: false; error: string };

const DEFAULT_FORM: FormState = {
  inputUrl: "",
  language: "en",
  targetDuration: 30,
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Starting",
  captions: "Fetching YouTube captions",
  transcribing: "Transcribing audio fallback",
  scoring: "Selecting viral phrases with Gemini",
  matching: "Matching phrases to timestamps",
  saving: "Saving results",
  done: "Done",
  error: "Failed",
};

export const ViralClipGenerator = () => {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [result, setResult] = useState<ViralGenerationResult | null>(null);
  const [job, setJob] = useState<ViralJob | null>(null);
  const [error, setError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, []);

  const stopPolling = () => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const pollJob = (jobId: string) => {
    stopPolling();
    pollRef.current = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/viral/status?jobId=${jobId}`);
        const data = (await response.json()) as StatusResponse;

        if (!data.ok) {
          throw new Error(data.error);
        }

        setJob(data.job);

        if (data.job.status === "done" && data.job.result) {
          setResult(data.job.result);
          setIsGenerating(false);
          stopPolling();
        }

        if (data.job.status === "error") {
          throw new Error(data.job.error || "Generation failed.");
        }
      } catch (pollError) {
        setError(
          pollError instanceof Error ? pollError.message : String(pollError),
        );
        setIsGenerating(false);
        stopPolling();
      }
    }, 2000);
  };

  const handleGenerate = async () => {
    if (!form.inputUrl.trim()) {
      setError("Paste a YouTube URL first.");
      return;
    }

    setIsGenerating(true);
    setError("");
    setResult(null);
    setJob(null);
    setCopied(false);
    stopPolling();

    try {
      const response = await fetch("/api/viral/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await response.json()) as GenerateStartResponse;

      if (!data.ok) {
        throw new Error(data.error);
      }

      pollJob(data.jobId);
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? generateError.message
          : String(generateError),
      );
      setIsGenerating(false);
    }
  };

  const copyResultPath = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.transcriptPath);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const statusLabel = job ? STATUS_LABELS[job.status] || job.status : "";

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-6 text-zinc-950 dark:bg-black dark:text-zinc-50">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 lg:flex-row lg:items-start">
        <section className="w-full rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 lg:w-97.5 lg:shrink-0">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-zinc-950 text-white dark:bg-white dark:text-zinc-950">
              <Sparkles size={18} />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Viral clip generator</h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                YouTube captions to viral trailer plan
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <label className="flex min-w-0 flex-col gap-1 text-sm font-medium">
              YouTube URL
              <input
                value={form.inputUrl}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    inputUrl: event.target.value,
                  }))
                }
                placeholder="https://www.youtube.com/watch?v=..."
                className="h-10 w-full min-w-0 rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-950"
              />
            </label>

            <label className="flex min-w-0 flex-col gap-1 text-sm font-medium">
              Subtitle language
              <input
                value={form.language}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    language: event.target.value.trim() || "en",
                  }))
                }
                placeholder="en"
                className="h-10 w-full min-w-0 rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-950"
              />
              <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
                Default is English. Use hi or hi-orig for Hindi auto subs.
              </span>
            </label>

            <label className="flex min-w-0 flex-col gap-1 text-sm font-medium">
              Trailer duration
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={10}
                  max={60}
                  step={1}
                  value={form.targetDuration}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      targetDuration: Number(event.target.value),
                    }))
                  }
                  className="w-full accent-zinc-950 dark:accent-white"
                />
                <span className="w-12 text-right font-mono text-xs text-zinc-500">
                  {form.targetDuration}s
                </span>
              </div>
            </label>

            <div className="rounded-md bg-zinc-100 p-3 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
              Pipeline: YouTube manual/auto captions, Gemini phrase selection,
              local timestamp matching. STT fallback only if captions are missing.
            </div>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              {isGenerating ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <Sparkles size={16} />
              )}
              {isGenerating ? "Generating" : "Generate clip plan"}
            </button>
          </div>
        </section>

        <section className="flex min-w-0 flex-1 flex-col gap-4">
          {error ? (
            <StatusPanel tone="error" title="Generation failed">
              {error}
            </StatusPanel>
          ) : null}

          {isGenerating && job ? (
            <StatusPanel tone="working" title={statusLabel}>
              <div className="flex flex-col gap-2">
                <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-zinc-950 transition-all dark:bg-white"
                    style={{ width: `${job.progress}%` }}
                  />
                </div>
                <p className="text-xs text-zinc-500">
                  Job {job.jobId.slice(0, 8)} at {job.progress}%
                </p>
              </div>
            </StatusPanel>
          ) : null}

          {isGenerating && !job ? (
            <StatusPanel tone="working" title="Starting job">
              Creating generation job...
            </StatusPanel>
          ) : null}

          {result ? (
            <>
              <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold">Generated plan</h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {result.videoId} / {result.transcription.source}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={copyResultPath}
                    className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-200 px-3 text-sm transition hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-900"
                  >
                    {copied ? <CheckCircle2 size={16} /> : <Clipboard size={16} />}
                    {copied ? "Copied" : "Copy path"}
                  </button>
                </div>

                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <Metric label="Result JSON" value={result.transcriptPath} />
                  <Metric label="Text transcript" value={result.textTranscriptPath} />
                  <Metric label="Segments" value={result.segmentsPath} />
                  <Metric label="Clips JSON" value={result.clipsPath} />
                  <Metric label="Clip directory" value={result.clipDirectory} />
                  <Metric
                    label="Segments count"
                    value={String(result.transcription.segments.length)}
                  />
                  <Metric
                    label="Timeline"
                    value={`${result.timeline.length} cuts`}
                  />
                </div>
              </div>

              <ResultSection title="Selected phrases">
                <div className="flex flex-col gap-3">
                  {result.selectedPhrases.map((phrase) => (
                    <article
                      key={`${phrase.text}-${phrase.start}`}
                      className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800"
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="rounded bg-zinc-100 px-2 py-1 text-xs dark:bg-zinc-900">
                          {phrase.category}
                        </span>
                        <span className="font-mono text-xs text-zinc-500">
                          {phrase.start.toFixed(1)}s - {phrase.end.toFixed(1)}s
                          / match {Math.round(phrase.matchScore * 100)}%
                        </span>
                      </div>
                      <p className="font-medium">{phrase.text}</p>
                      {!phrase.matched ? (
                        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                          Low-confidence match: {phrase.matchedText}
                        </p>
                      ) : null}
                    </article>
                  ))}
                </div>
              </ResultSection>

              <ResultSection title="Cut timeline">
                <div className="flex flex-col gap-2">
                  {result.timeline.map((cut) => (
                    <div
                      key={cut.id}
                      className="flex flex-col gap-2 rounded-md border border-zinc-200 p-3 text-sm md:flex-row md:items-start dark:border-zinc-800"
                    >
                      <span className="font-mono text-xs text-zinc-500 md:w-16 md:shrink-0">
                        cut {cut.id + 1}
                      </span>
                      <span className="min-w-0 flex-1">{cut.text}</span>
                      <span className="font-mono text-xs text-zinc-500 md:w-28 md:shrink-0 md:text-right">
                        {cut.sourceStart}s - {cut.sourceEnd}s
                      </span>
                    </div>
                  ))}
                </div>
              </ResultSection>

              {result.clipSources?.length ? (
                <ResultSection title="Preview clips">
                  <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <Player
                      component={VideoSeriesComp}
                      inputProps={{
                        clipSources: result.clipSources,
                        clipDurations: result.clipDurations,
                      }}
                      durationInFrames={computeTotalFrames(result.clipDurations)}
                      acknowledgeRemotionLicense
                      compositionWidth={COMP_WIDTH}
                      compositionHeight={COMP_HEIGHT}
                      fps={COMP_FPS}
                      controls
                      style={{ width: "100%" }}
                    />
                  </div>
                </ResultSection>
              ) : null}

              <ResultSection title="Pipeline logs">
                <div className="flex flex-col gap-2">
                  {result.logs.map((log, index) => (
                    <div
                      key={`${log.stage}-${index}`}
                      className="flex gap-2 rounded-md bg-zinc-100 p-2 text-xs dark:bg-zinc-900"
                    >
                      <span className="min-w-24 font-mono">{log.stage}</span>
                      <span>{log.message}</span>
                    </div>
                  ))}
                </div>
              </ResultSection>
            </>
          ) : (
            !isGenerating &&
            !error && (
              <StatusPanel tone="idle" title="Ready">
                Paste a YouTube URL, pick duration, and generate a saved
                transcript + viral cut plan from YouTube captions.
              </StatusPanel>
            )
          )}
        </section>
      </div>
    </main>
  );
};

const StatusPanel = ({
  children,
  title,
  tone,
}: {
  children: React.ReactNode;
  title: string;
  tone: "idle" | "working" | "error";
}) => {
  const icon =
    tone === "error" ? (
      <AlertCircle size={18} />
    ) : tone === "working" ? (
      <Loader2 className="animate-spin" size={18} />
    ) : (
      <CheckCircle2 size={18} />
    );

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-2 flex items-center gap-2 font-semibold">
        {icon}
        {title}
      </div>
      <div className="text-sm text-zinc-600 dark:text-zinc-300">{children}</div>
    </div>
  );
};

const Metric = ({ label, value }: { label: string; value: string }) => {
  return (
    <div className="rounded-md bg-zinc-100 p-3 dark:bg-zinc-900">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 break-all font-mono text-xs">{value}</div>
    </div>
  );
};

const ResultSection = ({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) => {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="mb-3 text-base font-semibold">{title}</h2>
      {children}
    </div>
  );
};
