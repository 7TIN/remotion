"use client";

import { checkRenderStatus, startRender } from "@/lib/render";
import { PlayerComp } from "./player";
import { transcript } from "@/data/transcript";
import { useState } from "react";

export const PlayerShow = () => {
  // const handleDownload = async () => {
  //   const { fileName } = await renderVideo(transcript);

  //   window.location.href =
  //     `/api/download?file=${encodeURIComponent(fileName)}`;
  // };

  const [jobId, setJobId] = useState("");

  const handleRender = async () => {
    const data = await startRender(transcript);

    setJobId(data.jobId);
  };

  const handleStatus = async () => {
    if (!jobId) return;

    const data = await checkRenderStatus(jobId);

    console.log(data);

    if (data.status === "completed") {
      window.location.href = `/api/download?file=${data.fileName}`;
    }
  };

  return (
    <div className="mx-auto w-full max-w-80">
      <PlayerComp />

      {/* <button
        onClick={handleDownload}
        className="mt-4 rounded bg-black px-4 py-2 text-white"
      >
        Export Video
      </button> */}

      <button className="mt-4 rounded px-4 py-2" onClick={handleRender}>
        Start Render
      </button>

      <button className="mt-4 rounded px-4 py-2" onClick={handleStatus}>
        Check Status
      </button>
    </div>
  );
};
