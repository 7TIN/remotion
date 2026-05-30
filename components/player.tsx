// "use server"
"use client";
import { Player } from "@remotion/player";
import { MyComp } from "./remotion/MyComp";
import { transcript } from "@/data/transcript";

export const PlayerComp = () => {
  return (
<div className="mx-auto w-full max-w-80">
  <Player
    inputProps={{transcript}}
    component={MyComp}
    durationInFrames={900}
    compositionWidth={1080}
    compositionHeight={1920}
    fps={30}
    controls
    style={{
      width: "100%",
      aspectRatio: "9 / 16",
    }}
  />
</div>
  );
};
