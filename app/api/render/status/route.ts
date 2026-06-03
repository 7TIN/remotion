export async function GET(req: Request) {
  const {searchParams} = new URL(req.url);

  const jobId = searchParams.get("jobId");

  const response = await fetch(
    `http://localhost:3100/status?jobId=${jobId}`,
  );

  const data = await response.json();

  return Response.json(data);
}