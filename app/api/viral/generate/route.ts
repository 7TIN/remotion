import { runViralJob } from "@/lib/viral/generator";
import { readViralJob, saveViralJob } from "@/lib/viral/storage";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 300;

const requestSchema = z.object({
  inputUrl: z.string().url(),
  language: z.string().min(2).default("en"),
  targetDuration: z.number().min(10).max(60).default(30),
});

export async function POST(request: Request) {
  try {
    const parsed = requestSchema.parse(await request.json());
    const jobId = crypto.randomUUID();
    const now = new Date().toISOString();

    await saveViralJob({
      jobId,
      status: "pending",
      progress: 0,
      inputUrl: parsed.inputUrl,
      options: parsed,
      createdAt: now,
      updatedAt: now,
    });

    void runViralJob(jobId, parsed).catch((error) => {
      console.error(`Viral job ${jobId} failed`, error);
    });

    return Response.json({
      ok: true,
      jobId,
      status: "pending",
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
