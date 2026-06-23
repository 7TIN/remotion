// "use server"
"use client";
import { Player } from "@remotion/player";
import { MyComp } from "./remotion/MyComp";
import { transcript } from "@/data/transcript";
import { videos, VideosInSequence } from "./remotion/VidSeries";
import { useMemo } from "react";
// import { TextComp } from "./remotion/TextComp";

export const PlayerComp = () => {
  const inputProps = useMemo(() => {
    return {
      videos: videos,
    };
  }, []);
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

      <Player
        inputProps={{ videos }}
        component={VideosInSequence}
        durationInFrames={totalFrames}
        fps={24000 / 1001} // <-- exact original fps
        compositionWidth={1080}
        compositionHeight={1920}
        controls
        style={{ width: "100%", aspectRatio: "9 / 16" }}
      />
    </div>
  );
};
