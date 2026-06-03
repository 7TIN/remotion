import http from "http";
import path from "path";
import fs from "fs";

import {bundle} from "@remotion/bundler";
import {
  renderMedia,
  selectComposition,
} from "@remotion/renderer";

const jobs = new Map();

console.log("Bundling Remotion project...");

const bundleLocation = await bundle({
  entryPoint: path.resolve("./components/remotion/index.ts"),
});

console.log("Bundle ready!");

const server = http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/render") {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
    });

    req.on("end", async () => {
      const {transcript} = JSON.parse(body);

      const jobId = crypto.randomUUID();

      jobs.set(jobId, {
        status: "pending",
      });

      res.writeHead(200, {
        "Content-Type": "application/json",
      });

      res.end(
        JSON.stringify({
          jobId,
        }),
      );

      void (async () => {
        try {
          fs.mkdirSync("out", {
            recursive: true,
          });

          const composition = await selectComposition({
            serveUrl: bundleLocation,
            id: "my-comp",
            inputProps: {
              transcript,
            },
          });

          const fileName = `${jobId}.mp4`;

          const outputPath = path.join(
            process.cwd(),
            "out",
            fileName,
          );

          await renderMedia({
            composition,
            serveUrl: bundleLocation,
            codec: "h264",
            outputLocation: outputPath,
            inputProps: {
              transcript,
            },
            concurrency: 4,
          });

          jobs.set(jobId, {
            status: "completed",
            fileName,
          });
        } catch (err) {
          jobs.set(jobId, {
            status: "failed",
            error: String(err),
          });
        }
      })();
    });

    return;
  }

  if (req.method === "GET" && req.url.startsWith("/status")) {
    const url = new URL(req.url, "http://localhost");

    const jobId = url.searchParams.get("jobId");

    const job = jobs.get(jobId);

    if (!job) {
      res.writeHead(404);
      res.end();
      return;
    }

    res.writeHead(200, {
      "Content-Type": "application/json",
    });

    res.end(JSON.stringify(job));
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(3100, () => {
  console.log("Render server running on :3100");
});