"use client";

import type {
  SttProviderName,
  ViralGenerateOptions,
  ViralGenerationResult,
} from "@/lib/viral/types";
import {
  AlertCircle,
  CheckCircle2,
  Clipboard,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";

type FormState = {
  inputUrl: string;
  sttProvider: SttProviderName;
  allowProviderFallback: boolean;
  preferYoutubeCaptions: boolean;
  targetDuration: number;
};

type GenerateResponse =
  | { ok: true; result: ViralGenerationResult }
  | { ok: false; error: string };

const DEFAULT_FORM: FormState = {
  inputUrl: "",
  sttProvider: "sarvam",
  allowProviderFallback: true,
  preferYoutubeCaptions: true,
  targetDuration: 30,
};

const GEMINI_MODEL = "gemini-3.5-flash";

export const ViralClipGenerator = () => {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [result, setResult] = useState<ViralGenerationResult | null>(null);
  const [error, setError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const requestPreview: ViralGenerateOptions = useMemo(
    () => ({
      ...form,
      language: "auto",
      geminiModel: GEMINI_MODEL,
    }),
    [form],
  );

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError("");
    setResult(null);
    setCopied(false);

    try {
      const response = await fetch("/api/viral/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPreview),
      });
      const data = (await response.json()) as GenerateResponse;

      if (!data.ok) {
        throw new Error(data.error);
      }

      setResult(data.result);
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? generateError.message
          : String(generateError),
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const copyResultPath = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.transcriptPath);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-6 text-zinc-950 dark:bg-black dark:text-zinc-50">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 lg:flex-row lg:items-start">
        <section className="w-full rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 lg:w-[390px] lg:shrink-0">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-zinc-950 text-white dark:bg-white dark:text-zinc-950">
              <Sparkles size={18} />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Viral clip generator</h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                YouTube to transcript, phrases, and cut plan
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
              STT model
              <select
                value={form.sttProvider}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    sttProvider: event.target.value as SttProviderName,
                  }))
                }
                className="h-10 w-full min-w-0 rounded-md border border-zinc-200 bg-white px-2 text-sm outline-none transition focus:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <option value="sarvam">Sarvam AI</option>
                <option value="smallest">SmallestAI</option>
              </select>
            </label>

            <div className="rounded-md bg-zinc-100 p-3 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
              Language: auto-detect
            </div>

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

            <Toggle
              checked={form.preferYoutubeCaptions}
              label="Try YouTube captions before paid STT"
              onChange={(checked) =>
                setForm((current) => ({
                  ...current,
                  preferYoutubeCaptions: checked,
                }))
              }
            />

            <Toggle
              checked={form.allowProviderFallback}
              label="Fallback to the other STT model on error"
              onChange={(checked) =>
                setForm((current) => ({
                  ...current,
                  allowProviderFallback: checked,
                }))
              }
            />

            <div className="rounded-md bg-zinc-100 p-3 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
              Gemini scorer: <span className="font-mono">{GEMINI_MODEL}</span>
            </div>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating || !form.inputUrl.trim()}
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

          {isGenerating ? (
            <StatusPanel tone="working" title="Working">
              This can take a while: captions, STT fallback, Gemini scoring, and
              JSON storage all happen in this request.
            </StatusPanel>
          ) : null}

          {result ? (
            <>
              <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold">
                      Generated plan
                    </h2>
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

                <div className="flex flex-col gap-3 text-sm md:flex-row">
                  <Metric label="Transcript JSON" value={result.transcriptPath} />
                  <Metric
                    label="Segments"
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
                      key={`${phrase.segmentId}-${phrase.start}`}
                      className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800"
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="rounded bg-zinc-100 px-2 py-1 text-xs dark:bg-zinc-900">
                          {phrase.category}
                        </span>
                        <span className="font-mono text-xs text-zinc-500">
                          {phrase.start.toFixed(1)}s - {phrase.end.toFixed(1)}s
                          / {Math.round(phrase.score * 100)}%
                        </span>
                      </div>
                      <p className="font-medium">{phrase.text}</p>
                      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                        {phrase.reasoning}
                      </p>
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
            <StatusPanel tone="idle" title="Ready">
              Add a YouTube URL, choose Sarvam AI or SmallestAI, and generate a
              saved transcript + viral cut plan.
            </StatusPanel>
          )}
        </section>
      </div>
    </main>
  );
};

const Toggle = ({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) => {
  return (
    <label className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-800">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-zinc-950 dark:accent-white"
      />
    </label>
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
      <p className="text-sm text-zinc-600 dark:text-zinc-300">{children}</p>
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
