# Technical Specification: Viral Clip Generator (Trailer Mode)
## AI-Powered Attention-Grabbing Phrase Extraction & Remotion Stitching

**Project Context:** This is an extension of an existing Remotion project that already generates aesthetic captions when a transcription is provided. This spec adds:
1. YouTube video downloading with caption extraction
2. Multi-provider transcription pipeline (yt-dlp captions → Sarvam AI → Smallest AI)
3. AI phrase scoring to extract attention-grabbing moments across the full video
4. Non-contiguous clip stitching into a single 30-second viral trailer with transitions & sound effects

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER INPUT                                      │
│  YouTube URL  ──────►  OR Upload local video + optional transcription      │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         STAGE 1: MEDIA INGESTION                               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│  │  yt-dlp      │───►│  Try Manual  │───►│  Try Auto    │                   │
│  │  Download    │    │  Captions    │    │  Captions    │                   │
│  └──────────────┘    └──────────────┘    └──────────────┘                   │
│         │                   │ Yes              │ Yes                         │
│         │                   ▼                  ▼                              │
│         │            ┌──────────────┐   ┌──────────────┐                     │
│         │            │ Parse SRT/   │   │ Parse SRT/   │                     │
│         │            │ VTT → JSON   │   │ VTT → JSON   │                     │
│         │            └──────────────┘   └──────────────┘                     │
│         │                   │                  │                              │
│         └───────────────────┴──────────────────┘                              │
│                             │ No captions found                               │
│                             ▼                                                 │
│                    ┌──────────────────────┐                                   │
│                    │  TRANSCRIPTION API   │                                   │
│                    │  Fallback Queue:     │                                   │
│                    │  1. Sarvam AI        │                                   │
│                    │  2. Smallest AI      │                                   │
│                    │  3. Groq Whisper     │                                   │
│                    └──────────────────────┘                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         STAGE 2: TRANSCRIPTION NORMALIZE                     │
│  - Ensure all outputs conform to UnifiedTranscription schema                 │
│  - Add sentence boundaries if missing (lightweight LLM pass)                 │
│  - Clean artifacts: [Music], (applause), sound effects, HTML tags             │
│  - Validate word-level or segment-level timestamps exist                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         STAGE 3: AI PHRASE SCORING                           │
│  Input: Full transcription with timestamps                                   │
│  Output: Ranked list of attention-grabbing phrases with scores               │
│  Logic: LLM evaluates each segment for virality, emotion, controversy, hooks │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         STAGE 4: CURATION & TIMELINE BUILD                    │
│  - Select top N phrases (target ~30s total)                                  │
│  - Arrange for emotional arc: Hook → Tension → Payoff                        │
│  - Add padding (±0.3s) around cuts for natural speech flow                   │
│  - Generate cut instructions: [(start, end, text, score, type)]              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         STAGE 5: VIDEO ENGINE (Remotion)                     │
│  - Download full video (if not already local)                                │
│  - Extract non-contiguous clips using ffmpeg                                 │
│  - Stitch clips with transitions (hard cut, fade, zoom)                      │
│  - Inject sound effects between phrases (riser, impact, whoosh)              │
│  - Render with existing aesthetic caption system                             │
│  - Export final 30-second trailer MP4                                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Data Models

### 2.1 UnifiedTranscription
All transcription sources (yt-dlp captions, Sarvam, Smallest AI) must normalize to this schema.

```typescript
interface UnifiedTranscription {
  source: 'ytdlp-manual' | 'ytdlp-auto' | 'sarvam' | 'smallest' | 'groq';
  language: string;           // ISO 639-1 code, e.g., 'en', 'hi', 'en-IN'
  fullText: string;            // Complete raw text for LLM context
  segments: TranscriptSegment[];
  duration: number;            // Total audio duration in seconds
}

interface TranscriptSegment {
  id: number;
  text: string;                // Clean text, no artifacts
  start: number;               // Start time in seconds (float)
  end: number;                 // End time in seconds (float)
  words?: WordTimestamp[];     // Optional word-level timestamps
  speaker?: string;            // Optional speaker label (e.g., "SPEAKER_01")
}

interface WordTimestamp {
  word: string;
  start: number;
  end: number;
  confidence?: number;
}
```

### 2.2 PhraseScore (AI Output)
```typescript
interface PhraseScore {
  segmentId: number;           // Reference to TranscriptSegment.id
  text: string;                // The exact phrase
  start: number;               // Original start time
  end: number;                 // Original end time
  score: number;               // 0.0 - 1.0 virality score
  category: 'hook' | 'controversy' | 'emotion' | 'curiosity_gap' | 'punchline' | 'opinion';
  reasoning: string;           // Why this phrase was selected (for debugging)
}
```

### 2.3 CutInstruction (Timeline Builder Output)
```typescript
interface CutInstruction {
  id: number;
  sourceStart: number;         // Start time in original video (seconds)
  sourceEnd: number;           // End time in original video (seconds)
  text: string;                // Caption text for this clip
  duration: number;            // Calculated: sourceEnd - sourceStart
  transitionIn?: 'hard_cut' | 'fade_in' | 'zoom_in' | 'none';
  transitionOut?: 'hard_cut' | 'fade_out' | 'zoom_out' | 'none';
  sfx?: string;                // Sound effect filename or URL to play at start
  paddingStart?: number;       // Seconds to extend before (default 0.2)
  paddingEnd?: number;         // Seconds to extend after (default 0.3)
}
```

### 2.4 RenderJob
```typescript
interface RenderJob {
  jobId: string;               // UUID
  inputUrl: string;            // YouTube URL or local file path
  status: 'pending' | 'downloading' | 'transcribing' | 'scoring' | 'cutting' | 'rendering' | 'done' | 'error';
  outputPath?: string;         // Final MP4 path
  transcription?: UnifiedTranscription;
  selectedPhrases?: PhraseScore[];
  timeline?: CutInstruction[];
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 3. Stage 1: Media Ingestion & Caption Extraction

### 3.1 yt-dlp Integration
Use `yt-dlp` as a child process. Must be installed on the host system.

**Step 1: List available subtitles**
```bash
yt-dlp --list-subs "<YOUTUBE_URL>"
```
Parse stdout to detect:
- Manual subtitles (language codes like `en`, `hi`, `en-IN`)
- Auto-generated subtitles (`en-auto`, `hi-auto`)

**Step 2: Download captions (preferred)**
```bash
# Try manual captions first
yt-dlp   --write-subs   --sub-langs en,hi,en-IN   --convert-subs srt   --skip-download   -o "%(id)s.%(ext)s"   "<YOUTUBE_URL>"
```

If no manual captions found, try auto-generated:
```bash
yt-dlp   --write-auto-subs   --sub-langs en,hi,en-IN   --convert-subs srt   --skip-download   -o "%(id)s.%(ext)s"   "<YOUTUBE_URL>"
```

**Step 3: Parse SRT to UnifiedTranscription**
Write an SRT parser that converts to the UnifiedTranscription schema. Handle:
- Multi-line subtitle entries
- HTML tags (`<b>`, `<i>`, `<font>`) — strip them
- Position tags — strip them
- Empty lines — skip them
- Overlapping timestamps — merge or split intelligently

**Step 4: If no captions → Download audio for API transcription**
```bash
yt-dlp   -f 'bestaudio[ext=m4a]/bestaudio'   --extract-audio   --audio-format mp3   --audio-quality 2   -o "%(id)s_audio.%(ext)s"   "<YOUTUBE_URL>"
```

### 3.2 Transcription API Fallbacks

Implement a provider queue with circuit breaker pattern.

#### Provider: Sarvam AI
```typescript
class SarvamTranscriptionProvider implements TranscriptionProvider {
  name = 'sarvam';

  async transcribe(audioPath: string): Promise<UnifiedTranscription> {
    // POST to Sarvam STT endpoint
    // Headers: Authorization: Bearer <SARVAM_API_KEY>
    // Body: multipart/form-data with audio file
    // Request word-level timestamps if available

    const response = await fetch('https://api.sarvam.ai/speech-to-text', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.SARVAM_API_KEY}` },
      body: formData, // audio file
    });

    // Normalize response to UnifiedTranscription
    // Note: If Sarvam returns sentence-level only, you may need to run
    // a lightweight forced alignment or estimate word timestamps.
  }
}
```

#### Provider: Smallest AI
```typescript
class SmallestAIProvider implements TranscriptionProvider {
  name = 'smallest';

  async transcribe(audioPath: string): Promise<UnifiedTranscription> {
    // POST to Smallest AI STT endpoint
    // Headers: Authorization: Bearer <SMALLEST_API_KEY>
    // Body: multipart/form-data with audio file

    const response = await fetch('https://api.smallest.ai/speech-to-text', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.SMALLEST_API_KEY}` },
      body: formData,
    });

    // Normalize response to UnifiedTranscription
  }
}
```

#### Provider: Groq Whisper (Final Fallback)
```typescript
class GroqWhisperProvider implements TranscriptionProvider {
  name = 'groq';

  async transcribe(audioPath: string): Promise<UnifiedTranscription> {
    // POST to Groq Whisper endpoint
    // Endpoint: https://api.groq.com/openai/v1/audio/transcriptions
    // Model: whisper-large-v3
    // Request response_format: 'verbose_json' for timestamps

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
      body: formData,
    });

    // Normalize response to UnifiedTranscription
  }
}
```

### 3.3 Provider Queue Logic
```typescript
async function getTranscription(input: string): Promise<UnifiedTranscription> {
  // input can be YouTube URL or local file path

  // 1. Try yt-dlp captions
  const captionResult = await tryYtDlpCaptions(input);
  if (captionResult) return captionResult;

  // 2. Download audio if YouTube URL
  const audioPath = isYoutubeUrl(input) 
    ? await downloadAudio(input) 
    : extractAudioFromVideo(input);

  // 3. Try providers in order
  const providers = [
    new SarvamTranscriptionProvider(),
    new SmallestAIProvider(),
    new GroqWhisperProvider(),
  ];

  for (const provider of providers) {
    try {
      const result = await provider.transcribe(audioPath);
      if (result.segments.length > 0) return result;
    } catch (err) {
      console.warn(`Provider ${provider.name} failed:`, err);
      continue;
    }
  }

  throw new Error('All transcription providers failed');
}
```

---

## 4. Stage 2: Transcription Normalization

### 4.1 Sentence Boundary Detection
If the transcription source returns paragraph-level or unpunctuated chunks, run a lightweight LLM pass to split into sentences.

**Prompt for sentence splitting:**
```
You are a text segmentation assistant. Given a transcript segment without proper punctuation boundaries, add sentence breaks (periods, question marks, exclamation marks) ONLY where grammatically appropriate. Do NOT change any words. Do NOT summarize. Preserve the original text exactly, just add punctuation and split into sentences.

Input format: JSON array of {id, text, start, end}
Output format: JSON array of {id, text, start, end} where text now has proper sentence boundaries.

Important: If the original text already has periods, preserve them. Only add missing ones.
```

Use a cheap/fast model for this: `gpt-4o-mini`, `gemini-flash`, or local `llama-3.2-1b` if running locally.

### 4.2 Artifact Cleaning
Run regex cleaners before feeding to the AI scorer:
```typescript
function cleanTranscriptText(text: string): string {
  return text
    .replace(/\[.*?\]/g, '')           // Remove [Music], [Applause], etc.
    .replace(/\(.*?\)/g, '')           // Remove (sound effects)
    .replace(/<[^>]*>/g, '')             // Remove HTML tags
    .replace(/\s+/g, ' ')               // Collapse multiple spaces
    .trim();
}
```

### 4.3 Timestamp Validation
Ensure `start < end` for all segments. If word-level timestamps exist, validate they sum correctly to segment boundaries.

---

## 5. Stage 3: AI Phrase Scoring

This is the core differentiator. The LLM must identify phrases that would make a viewer STOP SCROLLING.

### 5.1 Prompt Engineering

**System Prompt:**
```
You are an expert viral content curator and video trailer editor. Your job is to analyze a video transcript and identify the most attention-grabbing, emotionally resonant, and shareable phrases that would work well in a 30-second social media trailer.

You understand human psychology:
- People stop scrolling for: controversy, strong opinions, emotional vulnerability, surprising facts, curiosity gaps, bold claims, and relatable pain points.
- People share content that: validates their beliefs, shocks them, makes them laugh, or teaches them something counter-intuitive.

You will receive a transcript with timestamps. You must output a JSON array of the best phrases.
```

**User Prompt:**
```
Analyze the following video transcript and extract the most attention-grabbing phrases for a viral 30-second trailer.

TRANSCRIPT:
{{transcript_json}}

INSTRUCTIONS:
1. Evaluate EACH segment independently for virality potential.
2. Score each phrase from 0.0 to 1.0 based on:
   - Hook strength (does it make you want to keep watching?)
   - Emotional intensity (anger, joy, shock, vulnerability, passion)
   - Controversy / bold opinion (takes a stance, challenges norms)
   - Curiosity gap ("The thing nobody talks about...", "Here's what actually happened...")
   - Punchline / payoff (a satisfying conclusion to a setup)
   - Relatability ("I used to think...", "If you're struggling with...")

3. Categorize each selected phrase into one of:
   - "hook" — Opening grabber, makes viewer ask "what?"
   - "controversy" — Hot take, challenges mainstream view
   - "emotion" — Raw feeling, vulnerability, passion
   - "curiosity_gap" — Creates unanswered question
   - "punchline" — Satisfying payoff, mic-drop moment
   - "opinion" — Strong stance on a topic

4. Select phrases that TOGETHER can form a cohesive 25–35 second narrative arc.
   - Aim for: HOOK → TENSION → PAYOFF
   - Do NOT just pick the top 5 highest scores independently. Consider flow.
   - Prefer shorter phrases (2–8 seconds) over long explanations.
   - A 3-second hot take is worth more than a 20-second explanation.

5. For each selected phrase, provide:
   - segmentId: reference to the input segment
   - text: exact phrase text
   - start: start time in seconds
   - end: end time in seconds
   - score: 0.0–1.0
   - category: one of the types above
   - reasoning: one sentence explaining WHY this is attention-grabbing

6. Output ONLY a valid JSON array. No markdown, no explanations outside JSON.

TARGET: Extract enough phrases to fill ~30 seconds when stitched together. Aim for 5–10 phrases total.
```

**Example Output Format:**
```json
[
  {
    "segmentId": 12,
    "text": "The entire startup advice industry is a scam.",
    "start": 847.5,
    "end": 851.2,
    "score": 0.95,
    "category": "controversy",
    "reasoning": "Bold contrarian statement that immediately challenges the viewer's assumptions and creates curiosity."
  },
  {
    "segmentId": 34,
    "text": "I was making $300K a year and I was miserable.",
    "start": 1523.8,
    "end": 1526.4,
    "score": 0.91,
    "category": "emotion",
    "reasoning": "Vulnerability + relatable paradox (high salary but unhappy) creates strong emotional resonance."
  }
]
```

### 5.2 Model Selection
- **Primary:** `gpt-4o` or `gpt-4o-mini` (cheap, fast, good at following JSON schemas)
- **Alternative:** `claude-3-5-sonnet` (better at nuanced emotional analysis, slightly more expensive)
- **For high volume:** `gemini-1.5-flash` (cheapest option, good enough)

### 5.3 Cost Optimization
If the transcript is very long (>30 min), chunk it into 5-minute overlapping windows, run scoring on each chunk, then run a final "curator" pass to select the best across all chunks.

---

## 6. Stage 4: Curation & Timeline Builder

### 6.1 Selection Algorithm
```typescript
function buildTimeline(phrases: PhraseScore[], targetDuration: number = 30): CutInstruction[] {
  // Sort by score descending
  const sorted = phrases.sort((a, b) => b.score - a.score);

  // Greedy selection with narrative constraints
  const selected: PhraseScore[] = [];
  let currentDuration = 0;

  // Ensure we have at least one hook, one tension, one payoff
  const categories = new Set<string>();

  for (const phrase of sorted) {
    const phraseDuration = phrase.end - phrase.start;
    const paddedDuration = phraseDuration + 0.5; // padding

    if (currentDuration + paddedDuration > targetDuration + 3) break;

    selected.push(phrase);
    categories.add(phrase.category);
    currentDuration += paddedDuration;
  }

  // Sort selected by original timeline position (chronological)
  // OR by emotional arc: hook → tension → payoff
  // Default: chronological to avoid jarring jumps
  selected.sort((a, b) => a.start - b.start);

  // Build CutInstructions
  return selected.map((phrase, index) => ({
    id: index,
    sourceStart: Math.max(0, phrase.start - 0.2),
    sourceEnd: phrase.end + 0.3,
    text: phrase.text,
    duration: (phrase.end + 0.3) - Math.max(0, phrase.start - 0.2),
    transitionIn: index === 0 ? 'fade_in' : 'hard_cut',
    transitionOut: index === selected.length - 1 ? 'fade_out' : 'hard_cut',
    sfx: index > 0 ? 'whoosh_short.mp3' : undefined,
    paddingStart: 0.2,
    paddingEnd: 0.3,
  }));
}
```

### 6.2 Emotional Arc Arrangement (Optional Advanced Mode)
Instead of chronological, allow the AI to rearrange selected phrases for maximum impact:

```typescript
// Secondary LLM pass: "Arrange these phrases into the most compelling 30-second sequence"
// Input: selected phrases
// Output: reordered array with transition recommendations
```

---

## 7. Stage 5: Video Engine (Remotion + FFmpeg)

### 7.1 Video Download
If input is a YouTube URL and we need the video (not just audio):
```bash
yt-dlp   -f 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080]'   --merge-output-format mp4   -o "%(id)s_video.%(ext)s"   "<YOUTUBE_URL>"
```

### 7.2 Clip Extraction with FFmpeg
For each CutInstruction, extract the sub-clip:
```bash
ffmpeg -i input.mp4 -ss <start> -to <end> -c copy clip_001.mp4
```

If you need re-encoding (for transitions):
```bash
ffmpeg -i input.mp4 -ss <start> -t <duration> -c:v libx264 -preset fast -crf 23 -an clip_001.mp4
```

### 7.3 Stitching with Transitions
Create an FFmpeg concat file:
```
file clip_001.mp4
file transition_001.mp4  // generated transition
file clip_002.mp4
```

For simple hard cuts with consistent codec:
```bash
ffmpeg -f concat -safe 0 -i clips.txt -c copy output.mp4
```

For transitions (fade, zoom), use FFmpeg filter_complex or delegate to Remotion.

### 7.4 Remotion Integration
Since you already have a Remotion project for captions, extend it:

**New Composition: `ViralTrailer`**
```tsx
// src/compositions/ViralTrailer.tsx
import { Composition, Sequence, Audio, Video } from 'remotion';

interface ViralTrailerProps {
  videoUrl: string;
  cuts: CutInstruction[];
  captions: CaptionConfig; // your existing caption schema
  sfxMap: Record<string, string>; // sound effect URLs
}

export const ViralTrailer: React.FC<ViralTrailerProps> = ({ cuts, videoUrl, captions, sfxMap }) => {
  return (
    <Composition
      id="ViralTrailer"
      component={TrailerSequence}
      durationInFrames={cuts.reduce((sum, c) => sum + Math.round(c.duration * 30), 0)}
      fps={30}
      width={1080}
      height={1920} // 9:16 for shorts
      defaultProps={{ cuts, videoUrl, captions, sfxMap }}
    />
  );
};

// TrailerSequence.tsx
export const TrailerSequence: React.FC<ViralTrailerProps> = ({ cuts, videoUrl, captions, sfxMap }) => {
  let currentFrame = 0;

  return (
    <>
      {cuts.map((cut, index) => {
        const durationFrames = Math.round(cut.duration * 30);
        const fromFrame = currentFrame;
        currentFrame += durationFrames;

        return (
          <Sequence key={cut.id} from={fromFrame} durationInFrames={durationFrames}>
            {/* Video clip */}
            <Video src={videoUrl} startFrom={Math.round(cut.sourceStart * 30)} />

            {/* Your existing caption component */}
            <AestheticCaption 
              text={cut.text} 
              startFrame={0} 
              durationInFrames={durationFrames}
              style={captions}
            />

            {/* Sound effect on cut */}
            {cut.sfx && (
              <Audio src={sfxMap[cut.sfx]} startFrom={0} volume={0.6} />
            )}

            {/* Transition overlay (optional) */}
            {cut.transitionIn === 'fade_in' && <FadeInOverlay />}
            {cut.transitionOut === 'fade_out' && <FadeOutOverlay />}
          </Sequence>
        );
      })}
    </>
  );
};
```

### 7.5 Sound Effects
Maintain a small library of royalty-free SFX:
- `riser_short.mp3` — 1-second tension build before a hot take
- `impact_hard.mp3` — Emphasis on punchlines
- `whoosh_short.mp3` — Transition between clips
- `record_scratch.mp3` — For controversial takes (sparingly)
- `heartbeat.mp3` — Low-volume background for emotional moments

Map SFX to categories:
```typescript
const sfxMap: Record<string, string> = {
  hook: 'riser_short.mp3',
  controversy: 'record_scratch.mp3',
  emotion: 'heartbeat.mp3',
  punchline: 'impact_hard.mp3',
  default: 'whoosh_short.mp3',
};
```

---

## 8. API Endpoints (Next.js / Express)

### 8.1 POST /api/jobs/create
Create a new render job.

```typescript
// Request
{
  "inputUrl": "https://youtube.com/watch?v=...", // or "local:/path/to/video.mp4"
  "options": {
    "targetDuration": 30,        // seconds
    "outputFormat": "mp4",
    "aspectRatio": "9:16",         // or "1:1", "16:9"
    "captionStyle": "default",     // reference to your existing styles
    "musicOverlay": false,        // optional background music
    "sfxEnabled": true
  }
}

// Response
{
  "jobId": "uuid",
  "status": "pending",
  "message": "Job queued successfully"
}
```

### 8.2 GET /api/jobs/:jobId/status
Poll for job status.

```typescript
// Response
{
  "jobId": "uuid",
  "status": "rendering",
  "progress": 65, // percentage
  "outputUrl": null,
  "error": null
}
```

### 8.3 GET /api/jobs/:jobId/result
Get final output.

### 8.4 POST /api/transcribe (Internal)
Direct transcription endpoint for testing.

---

## 9. File Structure

```
project-root/
├── src/
│   ├── compositions/           # Remotion compositions
│   │   ├── CaptionedClip.tsx   # YOUR EXISTING
│   │   └── ViralTrailer.tsx  # NEW
│   ├── components/
│   │   ├── AestheticCaption.tsx  # YOUR EXISTING
│   │   ├── Transitions.tsx       # NEW: FadeIn, ZoomIn, etc.
│   │   └── SoundEffects.tsx      # NEW
│   ├── lib/
│   │   ├── transcription/
│   │   │   ├── index.ts              # Provider queue
│   │   │   ├── providers/
│   │   │   │   ├── base.ts           # TranscriptionProvider interface
│   │   │   │   ├── ytdlp.ts          # Caption extraction
│   │   │   │   ├── sarvam.ts         # Sarvam AI
│   │   │   │   ├── smallest.ts       # Smallest AI
│   │   │   │   └── groq.ts           # Groq Whisper fallback
│   │   │   ├── normalize.ts          # SRT parser, cleaning, sentence splitting
│   │   │   └── types.ts              # UnifiedTranscription, etc.
│   │   ├── ai/
│   │   │   ├── phrase-scorer.ts      # LLM prompt + scoring logic
│   │   │   ├── curator.ts            # Timeline builder
│   │   │   └── prompts/
│   │   │       └── phrase-scorer.txt # The prompt template
│   │   ├── video/
│   │   │   ├── downloader.ts         # yt-dlp wrapper
│   │   │   ├── cutter.ts             # FFmpeg clip extraction
│   │   │   └── renderer.ts           # Remotion render orchestration
│   │   └── utils/
│   │       ├── srt-parser.ts
│   │       └── validators.ts
│   ├── pages/api/
│   │   ├── jobs/
│   │   │   ├── create.ts
│   │   │   ├── [jobId]/
│   │   │   │   ├── status.ts
│   │   │   │   └── result.ts
│   │   └── transcribe.ts
│   └── types/
│       └── index.ts
├── public/
│   └── sfx/                    # Sound effects
│       ├── riser_short.mp3
│       ├── impact_hard.mp3
│       └── whoosh_short.mp3
├── temp/                       # Downloaded videos, audio, clips
├── remotion.config.ts
├── next.config.js
└── .env.local
```

---

## 10. Environment Variables

```bash
# Transcription APIs
SARVAM_API_KEY=sk-...
SMALLEST_API_KEY=sk-...
GROQ_API_KEY=gsk-...

# AI Phrase Scorer
OPENAI_API_KEY=sk-...           # For GPT-4o / GPT-4o-mini
# Or
ANTHROPIC_API_KEY=sk-...        # For Claude
# Or
GOOGLE_API_KEY=...              # For Gemini

# Remotion
REMOTION_AWS_ACCESS_KEY_ID=...
REMOTION_AWS_SECRET_ACCESS_KEY=...
REMOTION_S3_BUCKET=...

# Storage
TEMP_DIR=./temp
OUTPUT_DIR=./output

# Optional: Local LLM for sentence splitting (instead of API)
# OLLAMA_URL=http://localhost:11434
```

---

## 11. Error Handling & Edge Cases

| Scenario | Handling |
|----------|----------|
| yt-dlp fails (geo-blocked, deleted video) | Return 400 with clear error. Suggest user uploads file directly. |
| No captions + all transcription APIs fail | Return 500 with detailed logs. Retry with exponential backoff. |
| Transcription has no timestamps | Reject and fall back to API that provides timestamps. Timestamps are non-negotiable. |
| AI returns no high-scoring phrases | Lower threshold dynamically (e.g., from 0.7 to 0.5) and warn user that content may not be viral-worthy. |
| Selected phrases exceed 30s | Truncate lowest-scoring phrases until under limit. Prioritize hook + payoff. |
| Video download is 4K/8K | Cap download at 1080p to save bandwidth and processing time. |
| Audio has heavy background music | Note in UI that transcription quality may be reduced. Consider audio separation (demucs) as future enhancement. |
| Phrase timestamps overlap after padding | Detect overlaps and trim padding or shift boundaries. |

---

## 12. Performance Considerations

1. **Async Job Queue:** Use BullMQ, Inngest, or QStash to process jobs outside the HTTP request lifecycle. Vercel has 10s/60s timeout limits.
2. **Stream Downloads:** Pipe yt-dlp output directly to processing without saving full files when possible.
3. **Cache Transcriptions:** Store transcription results by video ID (YouTube) to avoid re-transcribing the same video.
4. **Parallel API Calls:** If testing multiple transcription providers, run them in parallel and pick the best result (not sequential fallback).
5. **Remotion Lambda:** For production rendering at scale, use `@remotion/lambda` instead of local rendering.

---

## 13. Future Enhancements (Out of Scope for V1)

- [ ] **Speaker Diarization:** Detect who said what, color-code captions per speaker.
- [ ] **Visual Analysis:** Use frame embeddings to avoid cutting on awkward facial expressions or motion blur.
- [ ] **Music Detection:** Auto-detect beat drops and sync cuts to music rhythm.
- [ ] **A/B Testing:** Generate 2–3 trailer variants with different phrase selections and let user pick.
- [ ] **Auto-Thumbnail:** Generate thumbnail from the highest-scored phrase frame + text overlay.
- [ ] **Multi-language:** Auto-detect language and route to appropriate transcription provider.

---

## 14. Implementation Checklist for Codex

- [ ] Create `UnifiedTranscription` types and interfaces
- [ ] Implement yt-dlp caption extraction (manual → auto → audio download)
- [ ] Implement SRT/VTT parser
- [ ] Implement Sarvam AI provider with normalization
- [ ] Implement Smallest AI provider with normalization
- [ ] Implement Groq Whisper fallback provider
- [ ] Build provider queue with circuit breaker
- [ ] Implement sentence boundary detection (LLM pass)
- [ ] Implement artifact cleaning pipeline
- [ ] Build AI phrase scorer with the provided prompt
- [ ] Build timeline curator (selection + arrangement)
- [ ] Extend Remotion with `ViralTrailer` composition
- [ ] Implement FFmpeg clip extraction
- [ ] Add sound effect injection in Remotion
- [ ] Build API endpoints: create job, status, result
- [ ] Add job queue (BullMQ or Inngest)
- [ ] Add error handling for all edge cases
- [ ] Write tests for SRT parser and provider normalization
- [ ] Document environment variables

---

*End of Specification*
