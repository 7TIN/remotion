import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "path";
import fs from "fs";
import { NextResponse } from "next/server";

// Module-level cache — bundles once per Next.js server lifecycle
let bundleCache: string | null = null;

const getBundle = async () => {
  if (bundleCache) return bundleCache;
  bundleCache = await bundle({
    entryPoint: path.resolve("./src/remotion/index.ts"),
  });
  return bundleCache;
};

export async function POST(req: Request) {
  try {
    const { transcript, compositionId = "MyComp" } = await req.json();

    fs.mkdirSync("out", { recursive: true });

    const bundleLocation = await getBundle();

    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: compositionId,
      inputProps: { transcript },
    });

    const outputPath = `out/${compositionId}-${Date.now()}.mp4`;

    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: "h264",
      outputLocation: outputPath,
      inputProps: { transcript },
      crf: 23,
      concurrency: 4,
    });

    // return NextResponse.json({ path: outputPath });
    return NextResponse.json({
      fileName: path.basename(outputPath),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
