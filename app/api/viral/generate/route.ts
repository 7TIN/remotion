import { generateViralClipPlan } from "@/lib/viral/generator";
import type { SttProviderName } from "@/lib/viral/types";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 300;

const requestSchema = z.object({
  inputUrl: z.string().url(),
  language: z.string().min(2).default("auto"),
  sttProvider: z.enum(["sarvam", "smallest"]).default("sarvam"),
  allowProviderFallback: z.boolean().default(true),
  preferYoutubeCaptions: z.boolean().default(true),
  targetDuration: z.number().min(10).max(60).default(30),
  geminiModel: z.string().min(1).default("gemini-3.5-flash"),
});

export async function POST(request: Request) {
  try {
    const parsed = requestSchema.parse(await request.json());
    const result = await generateViralClipPlan({
      ...parsed,
      sttProvider: parsed.sttProvider as SttProviderName,
    });

    return Response.json({
      ok: true,
      result,
    });
  } catch (error) {
    const message = readErrorMessage(error);
    const status = error instanceof z.ZodError ? 400 : 500;

    return Response.json(
      {
        ok: false,
        error: message,
      },
      { status },
    );
  }
}

function readErrorMessage(error: unknown) {
  if (error instanceof z.ZodError) {
    return error.issues.map((issue) => issue.message).join(", ");
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
