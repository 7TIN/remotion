import { Segment } from "@/components/remotion/MyComp";

export const startRender = async (
  transcript: Segment[],
) => {
  const res = await fetch("/api/render", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      transcript,
    }),
  });

  return res.json();
};

export const checkRenderStatus = async (
  jobId: string,
) => {
  const res = await fetch(
    `/api/render/status?jobId=${jobId}`,
  );

  return res.json();
};