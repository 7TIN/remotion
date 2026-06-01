import { Segment } from "@/components/remotion/MyComp";

// lib/render.ts — reusable client function
export const renderVideo = async (transcript: Segment[]) => {
  const res = await fetch("/api/render", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transcript }),
  });

  if (!res.ok) throw new Error("Render failed");
  return res.json(); // { path: "out/MyComp-123456.mp4" }
};