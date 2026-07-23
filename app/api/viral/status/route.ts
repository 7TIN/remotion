import { readViralJob } from "@/lib/viral/storage";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");

  if (!jobId) {
    return Response.json(
      { ok: false, error: "Missing jobId." },
      { status: 400 },
    );
  }

  const job = await readViralJob(jobId);
  if (!job) {
    return Response.json(
      { ok: false, error: "Job not found." },
      { status: 404 },
    );
  }

  return Response.json({
    ok: true,
    job,
  });
}
