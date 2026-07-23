export interface VttTranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface ParsedVttTranscript {
  transcript: string;
  segments: VttTranscriptSegment[];
}

const TIMESTAMP_REGEX =
  /(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})\.(\d{3})/;

function toSeconds(h: string, m: string, s: string, ms: string): number {
  return Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms) / 1000;
}

function cleanText(text: string): string {
  return text
    .replace(/<\d{2}:\d{2}:\d{2}\.\d{3}>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseYoutubeVtt(vtt: string): ParsedVttTranscript {
  const lines = vtt.split(/\r?\n/);
  const segments: VttTranscriptSegment[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const timestamp = lines[i].match(TIMESTAMP_REGEX);
    if (!timestamp) continue;

    const start = toSeconds(
      timestamp[1],
      timestamp[2],
      timestamp[3],
      timestamp[4],
    );
    const end = toSeconds(
      timestamp[5],
      timestamp[6],
      timestamp[7],
      timestamp[8],
    );

    const textLines: string[] = [];
    i += 1;

    while (i < lines.length && lines[i].trim() !== "") {
      textLines.push(lines[i]);
      i += 1;
    }

    const hasWordTimestamps = textLines.some((line) => line.includes("<00:"));
    if (!hasWordTimestamps) continue;

    const lastLine = textLines[textLines.length - 1];
    const cleaned = cleanText(lastLine);
    if (!cleaned) continue;

    segments.push({ start, end, text: cleaned });
  }

  return {
    transcript: segments.map((segment) => segment.text).join("\n"),
    segments,
  };
}
