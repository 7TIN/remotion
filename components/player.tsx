// "use server"
"use client";
import { Player } from "@remotion/player";
import { MyComp } from "./remotion/MyComp";
import { transcript } from "@/data/transcript";
import { backVideo, videos, VideosInSequence } from "./remotion/VidSeries";
import { useEffect, useMemo, useState } from "react";
import { prefetch, staticFile } from "remotion";
// import { TextComp } from "./remotion/TextComp";

// const usePrefetchVideos = (srcs: string[]) => {
//   const [ready, setReady] = useState(false);

//   useEffect(() => {
//     const controllers = srcs.map((src) => {
//       const { waitUntilDone } = prefetch(src, {
//         method: "blob-url",
//         contentType: "video/mp4",
//       });
//       return waitUntilDone();
//     });

//     Promise.all(controllers).then(() => setReady(true));
//   }, [srcs]);

//   return ready;
// };
// const allVideos = [
//   ...videos.map((v) => staticFile(v.src)),
//   ...backVideo.map((v) => staticFile(v.src)),
// ];

export const PlayerComp = () => {
  const inputProps = useMemo(() => {
    return {
      videos: videos,
      backVideo: backVideo,
    };
  }, []);

  // const ready = usePrefetchVideos(allVideos);

  // if (!ready) return <div>Loading...</div>;

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
        fps={24000 / 1000} // <-- exact original fps
        compositionWidth={1080}
        compositionHeight={1920}
        controls
        style={{ width: "100%", aspectRatio: "9 / 16" }}
      /> */}

      <Player
    inputProps={{transcript, videos, backVideo}}
    component={MyComp}
    durationInFrames={900}
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
