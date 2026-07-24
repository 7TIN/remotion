// "use server"
"use client";
import { Player } from "@remotion/player";
import { ALL_VIDEO_SRCS } from "./remotion/MyComp";
import { transcript } from "@/data/transcript";
import { useEffect, useState } from "react";
import { prefetch } from "remotion";
import { CaptionComp, type CaptionInputProps } from "./remotion/CaptionComp";
// import { TextComp } from "./remotion/TextComp";

const usePrefetchVideos = (srcs: string[]) => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all(
      srcs.map((src) => prefetch(src, { method: "blob-url" }).waitUntilDone()),
    ).then(() => setReady(true));
  }, [srcs]);

  return ready;
};

// const allVideos = [
//   ...videos.map((v) => staticFile(v.src)),
//   ...backVideo.map((v) => staticFile(v.src)),
// ];

type PlayerCompProps = {
  captionInputProps?: CaptionInputProps;
};

export const PlayerComp = ({ captionInputProps }: PlayerCompProps) => {
  // const inputProps = useMemo(() => {
  //   return {
  //     videos: videos,
  //     backVideo: backVideo,
  //   };
  // }, []);

  const ready = usePrefetchVideos(ALL_VIDEO_SRCS);

  if (!ready) {
    return (
      <div
        style={{
          width: "100%",
          aspectRatio: "9 / 16",
          background: "#000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
        }}
      >
        Loading videos...
      </div>
    );
  }

  const totalFrames = 834;

  return (
    <div className="mx-auto w-full max-w-80">
      {/* <Player
    inputProps={inputProps}
    // component={TextComp}
    // component={MyComp}
    component={VideosInSequence}
    // durationInFrames={120}
    durationInFrames={1042}
    compositionWidth={1080}
    compositionHeight={1920}
    fps={30}
    controls
    style={{
      width: "100%",
      aspectRatio: "9 / 16",
    }}
  /> */}
      {/* <Player
        inputProps={{ videos, backVideo }}
        component={VideosInSequence}
        durationInFrames={totalFrames}
        fps={24000 / 1001} // <-- exact original fps
        compositionWidth={1080}
        compositionHeight={1920}
        controls
        style={{ width: "100%", aspectRatio: "9 / 16" }}
      /> */}

      {/* <Player
    inputProps={{transcript, videos, backVideo}}
    component={MyComp}
    durationInFrames={totalFrames}
    compositionWidth={1080}
    compositionHeight={1920}
    fps={24}
    controls
    style={{
      width: "100%",
      aspectRatio: "9 / 16",
    }}
  /> */}

      <Player
        inputProps={{
          transcript,
          captionPosition: "center",
          stylePreset: "aesthetic",
          ...captionInputProps,
        }}
        acknowledgeRemotionLicense
        component={CaptionComp}
        durationInFrames={totalFrames}
        compositionWidth={1080}
        compositionHeight={1920}
        fps={24}
        controls
        style={{
          width: "100%",
          aspectRatio: "9 / 16",
        }}
      />
    </div>
  );
};
