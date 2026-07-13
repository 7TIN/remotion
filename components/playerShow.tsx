"use client";

import { PlayerComp } from "./player";
import type {
  CaptionInputProps,
  KineticCaptionPosition,
  KineticCaptionPreset,
  KineticCaptionStyle,
} from "./remotion/CaptionComp";
import { Check, Palette, Play, RotateCcw, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";

type CaptionDraft = {
  stylePreset: KineticCaptionPreset;
  captionPosition: KineticCaptionPosition;
  specialFontColor: string;
  normalColor: string;
  mutedColor: string;
  stylishFrequency: number;
  verticalFrequency: number;
  boldFrequency: number;
  maxWordsPerScene: 2 | 3 | 4;
  normalFontSize: number;
  stylishFontSize: number;
  formalFontSize: number;
  boldFontSize: number;
  normalFontWeight: number;
  formalFontWeight: number;
  boldFontWeight: number;
};

type SliderKey = {
  [Key in keyof CaptionDraft]: CaptionDraft[Key] extends number ? Key : never;
}[keyof CaptionDraft];

const PRESETS: KineticCaptionPreset[] = [
  "aesthetic",
  "editorial",
  "punchy",
  "minimal",
];

const POSITIONS: KineticCaptionPosition[] = [
  "center",
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
];

const COLOR_OPTIONS = [
  { label: "Yellow", value: "yellow-300", hex: "#fde047" },
  { label: "Emerald", value: "emerald-300", hex: "#6ee7b7" },
  { label: "Cyan", value: "cyan-300", hex: "#67e8f9" },
  { label: "Sky", value: "sky-300", hex: "#7dd3fc" },
  { label: "Violet", value: "violet-300", hex: "#c4b5fd" },
  { label: "Rose", value: "rose-400", hex: "#fb7185" },
  { label: "Amber", value: "amber-300", hex: "#fcd34d" },
  { label: "White", value: "white", hex: "#ffffff" },
];

const DEFAULT_DRAFT: CaptionDraft = {
  stylePreset: "aesthetic",
  captionPosition: "center",
  specialFontColor: "yellow-300",
  normalColor: "#ffffff",
  mutedColor: "#f1efe9",
  stylishFrequency: 0.22,
  verticalFrequency: 0.34,
  boldFrequency: 0.18,
  maxWordsPerScene: 3,
  normalFontSize: 72,
  stylishFontSize: 88,
  formalFontSize: 64,
  boldFontSize: 118,
  normalFontWeight: 760,
  formalFontWeight: 430,
  boldFontWeight: 900,
};

const draftToInputProps = (draft: CaptionDraft): CaptionInputProps => ({
  stylePreset: draft.stylePreset,
  captionPosition: draft.captionPosition,
  specialFontColor: draft.specialFontColor,
  captionStyle: {
    color: draft.normalColor,
    mutedColor: draft.mutedColor,
    stylishFrequency: draft.stylishFrequency,
    verticalFrequency: draft.verticalFrequency,
    boldFrequency: draft.boldFrequency,
    maxWordsPerScene: draft.maxWordsPerScene,
    normalFontSize: draft.normalFontSize,
    stylishFontSize: draft.stylishFontSize,
    formalFontSize: draft.formalFontSize,
    boldFontSize: draft.boldFontSize,
    normalFontWeight: draft.normalFontWeight,
    formalFontWeight: draft.formalFontWeight,
    boldFontWeight: draft.boldFontWeight,
  } satisfies Partial<KineticCaptionStyle>,
});

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

export const PlayerShow = () => {
  // Render/status actions are paused while this screen is focused on previewing caption inputs.
  // const handleRender = async () => {};
  // const handleStatus = async () => {};

  const [draft, setDraft] = useState<CaptionDraft>(DEFAULT_DRAFT);
  const [appliedDraft, setAppliedDraft] = useState<CaptionDraft>(DEFAULT_DRAFT);
  const [previewVersion, setPreviewVersion] = useState(0);

  const appliedInputProps = useMemo(
    () => draftToInputProps(appliedDraft),
    [appliedDraft],
  );

  const updateDraft = <Key extends keyof CaptionDraft>(
    key: Key,
    value: CaptionDraft[Key],
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const updateSlider = (key: SliderKey, value: string) => {
    updateDraft(key, Number(value) as CaptionDraft[typeof key]);
  };

  const applyPreview = () => {
    setAppliedDraft(draft);
    setPreviewVersion((version) => version + 1);
  };

  const resetDraft = () => {
    setDraft(DEFAULT_DRAFT);
    setAppliedDraft(DEFAULT_DRAFT);
    setPreviewVersion((version) => version + 1);
  };

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      <section className="order-2 lg:order-1">
        <PlayerComp
          key={previewVersion}
          captionInputProps={appliedInputProps}
        />
      </section>

      <section className="order-1 text-zinc-950 lg:order-2 dark:text-zinc-50">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Caption controls</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Applied preview: {appliedDraft.stylePreset} /{" "}
              {appliedDraft.captionPosition}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={resetDraft}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
              aria-label="Reset caption inputs"
            >
              <RotateCcw size={16} />
            </button>
            <button
              type="button"
              onClick={applyPreview}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-zinc-950 px-3 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              <Play size={16} />
              Preview
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <ControlGroup icon={<Palette size={16} />} title="Look">
            <SelectControl
              label="Preset"
              value={draft.stylePreset}
              options={PRESETS}
              onChange={(value) =>
                updateDraft("stylePreset", value as KineticCaptionPreset)
              }
            />
            <SelectControl
              label="Position"
              value={draft.captionPosition}
              options={POSITIONS}
              onChange={(value) =>
                updateDraft("captionPosition", value as KineticCaptionPosition)
              }
            />
            <ColorPicker
              label="Special color"
              value={draft.specialFontColor}
              onChange={(value) => updateDraft("specialFontColor", value)}
            />
            <ColorPicker
              label="Normal color"
              value={draft.normalColor}
              outputHex
              onChange={(value) => updateDraft("normalColor", value)}
            />
            <ColorPicker
              label="Soft color"
              value={draft.mutedColor}
              outputHex
              onChange={(value) => updateDraft("mutedColor", value)}
            />
          </ControlGroup>

          <ControlGroup icon={<SlidersHorizontal size={16} />} title="Motion Mix">
            <RangeControl
              label="Stylish words"
              value={draft.stylishFrequency}
              min={0}
              max={0.6}
              step={0.01}
              valueLabel={formatPercent(draft.stylishFrequency)}
              onChange={(value) => updateSlider("stylishFrequency", value)}
            />
            <RangeControl
              label="Vertical sections"
              value={draft.verticalFrequency}
              min={0}
              max={0.8}
              step={0.01}
              valueLabel={formatPercent(draft.verticalFrequency)}
              onChange={(value) => updateSlider("verticalFrequency", value)}
            />
            <RangeControl
              label="Bold words"
              value={draft.boldFrequency}
              min={0}
              max={0.6}
              step={0.01}
              valueLabel={formatPercent(draft.boldFrequency)}
              onChange={(value) => updateSlider("boldFrequency", value)}
            />
            <SelectControl
              label="Words per scene"
              value={String(draft.maxWordsPerScene)}
              options={["2", "3", "4"]}
              onChange={(value) =>
                updateDraft("maxWordsPerScene", Number(value) as 2 | 3 | 4)
              }
            />
          </ControlGroup>

          <ControlGroup icon={<SlidersHorizontal size={16} />} title="Type Size">
            <RangeControl
              label="Normal"
              value={draft.normalFontSize}
              min={48}
              max={96}
              step={1}
              valueLabel={`${draft.normalFontSize}px`}
              onChange={(value) => updateSlider("normalFontSize", value)}
            />
            <RangeControl
              label="Stylish"
              value={draft.stylishFontSize}
              min={56}
              max={112}
              step={1}
              valueLabel={`${draft.stylishFontSize}px`}
              onChange={(value) => updateSlider("stylishFontSize", value)}
            />
            <RangeControl
              label="Formal"
              value={draft.formalFontSize}
              min={44}
              max={96}
              step={1}
              valueLabel={`${draft.formalFontSize}px`}
              onChange={(value) => updateSlider("formalFontSize", value)}
            />
            <RangeControl
              label="Bold"
              value={draft.boldFontSize}
              min={72}
              max={156}
              step={1}
              valueLabel={`${draft.boldFontSize}px`}
              onChange={(value) => updateSlider("boldFontSize", value)}
            />
          </ControlGroup>

          <ControlGroup icon={<SlidersHorizontal size={16} />} title="Type Weight">
            <RangeControl
              label="Normal"
              value={draft.normalFontWeight}
              min={300}
              max={900}
              step={10}
              valueLabel={String(draft.normalFontWeight)}
              onChange={(value) => updateSlider("normalFontWeight", value)}
            />
            <RangeControl
              label="Formal"
              value={draft.formalFontWeight}
              min={300}
              max={900}
              step={10}
              valueLabel={String(draft.formalFontWeight)}
              onChange={(value) => updateSlider("formalFontWeight", value)}
            />
            <RangeControl
              label="Bold"
              value={draft.boldFontWeight}
              min={600}
              max={900}
              step={10}
              valueLabel={String(draft.boldFontWeight)}
              onChange={(value) => updateSlider("boldFontWeight", value)}
            />
          </ControlGroup>
        </div>
      </section>
    </div>
  );
};

const ControlGroup = ({
  children,
  icon,
  title,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  title: string;
}) => {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </div>
      <div className="grid gap-3">{children}</div>
    </div>
  );
};

const SelectControl = ({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: string[];
  value: string;
}) => {
  return (
    <label className="grid gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-950 outline-none transition focus:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
};

const ColorPicker = ({
  label,
  onChange,
  outputHex = false,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  outputHex?: boolean;
  value: string;
}) => {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3 text-xs font-medium text-zinc-600 dark:text-zinc-300">
        <span>{label}</span>
        <span className="font-mono text-[11px] text-zinc-500">{value}</span>
      </div>
      <div className="grid grid-cols-8 gap-2">
        {COLOR_OPTIONS.map((color) => {
          const nextValue = outputHex ? color.hex : color.value;
          const selected = value === nextValue;

          return (
            <button
              key={`${label}-${color.value}`}
              type="button"
              onClick={() => onChange(nextValue)}
              className="relative h-8 rounded-md border border-zinc-200 ring-offset-2 transition hover:scale-105 dark:border-zinc-800 dark:ring-offset-zinc-950"
              style={{ backgroundColor: color.hex }}
              aria-label={`${label}: ${color.label}`}
            >
              {selected ? (
                <span className="absolute inset-0 flex items-center justify-center text-zinc-950">
                  <Check size={15} strokeWidth={3} />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const RangeControl = ({
  label,
  max,
  min,
  onChange,
  step,
  value,
  valueLabel,
}: {
  label: string;
  max: number;
  min: number;
  onChange: (value: string) => void;
  step: number;
  value: number;
  valueLabel: string;
}) => {
  return (
    <label className="grid gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-300">
      <span className="flex items-center justify-between gap-3">
        <span>{label}</span>
        <span className="font-mono text-[11px] text-zinc-500">{valueLabel}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-2 w-full accent-zinc-950 dark:accent-white"
      />
    </label>
  );
};
