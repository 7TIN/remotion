export type SttProviderName = "sarvam" | "smallest";

export type TranscriptionSource =
  | "ytdlp-manual"
  | "ytdlp-auto"
  | "sarvam"
  | "smallest";

export type ViralCategory =
  | "hook"
  | "controversy"
  | "emotion"
  | "curiosity_gap"
  | "punchline"
  | "opinion";

export type WordTimestamp = {
  word: string;
  start: number;
  end: number;
  confidence?: number;
};

export type TranscriptSegment = {
  id: number;
  text: string;
  start: number;
  end: number;
  words?: WordTimestamp[];
  speaker?: string;
};

export type UnifiedTranscription = {
  source: TranscriptionSource;
  language: string;
  fullText: string;
  segments: TranscriptSegment[];
  duration: number;
};

export type CaptionTranscriptSegment = {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
};

export type PhraseScore = {
  segmentId: number;
  text: string;
  start: number;
  end: number;
  score: number;
  category: ViralCategory;
  reasoning: string;
};

export type CutInstruction = {
  id: number;
  sourceStart: number;
  sourceEnd: number;
  text: string;
  duration: number;
  transitionIn?: "hard_cut" | "fade_in" | "zoom_in" | "none";
  transitionOut?: "hard_cut" | "fade_out" | "zoom_out" | "none";
  sfx?: string;
  paddingStart?: number;
  paddingEnd?: number;
};

export type ViralGenerateOptions = {
  inputUrl: string;
  language: string;
  sttProvider: SttProviderName;
  allowProviderFallback: boolean;
  preferYoutubeCaptions: boolean;
  targetDuration: number;
  geminiModel: string;
};

export type ViralGenerationLog = {
  stage: string;
  status: "success" | "warning" | "error";
  message: string;
};

export type ViralGenerationResult = {
  videoId: string;
  inputUrl: string;
  createdAt: string;
  options: ViralGenerateOptions;
  transcriptPath: string;
  transcription: UnifiedTranscription;
  captionTranscript: CaptionTranscriptSegment[];
  selectedPhrases: PhraseScore[];
  timeline: CutInstruction[];
  logs: ViralGenerationLog[];
};

export type SmallestPulseResponse = {
  status?: string;
  transcription?: string;
  audio_length?: number;
  words?: Array<{
    start?: number;
    end?: number;
    speaker?: string;
    word?: string;
  }>;
  utterances?: Array<{
    start?: number;
    end?: number;
    speaker?: string;
    text?: string;
    transcript?: string;
  }>;
  metadata?: Record<string, unknown>;
  error?: {
    message?: string;
    code?: string;
  };
};
