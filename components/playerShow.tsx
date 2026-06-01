"use client";

import { renderVideo } from "@/lib/render";
import { PlayerComp } from "./player";
import { transcript } from "@/data/transcript";

export const PlayerShow = () => {
  const handleDownload = async () => {
    const { fileName } = await renderVideo(transcript);

    window.location.href =
      `/api/download?file=${encodeURIComponent(fileName)}`;
  };

  return (
    <div className="mx-auto w-full max-w-80">
      <PlayerComp
      />

      <button
        onClick={handleDownload}
        className="mt-4 rounded bg-black px-4 py-2 text-white"
      >
        Export Video
      </button>
    </div>
  );
};