import React from "react";
import { Composition } from "remotion";
// import {MyComposition} from './Composition';
import { transcript } from "../../data/transcript";
// import { TextComp } from "./TextComp";
import {
  // calculateVideoDurations,
  videos,
  VideosInSequence,
  backVideo,
  // videosSrc,
} from "./VidSeries";
import { MyComp } from "./MyComp";
import { CaptionComp } from "./CaptionComp";

export const MyVideo = () => {
  return (
    <>
      {/* <Composition component={MyComp} durationInFrames={1042} width={1080} height={1920} fps={30} id="my-comp" defaultProps={{transcript}}/> */}
      {/* <Composition component={TextComp} id="my-text" width={1080} height={1920} fps={30} durationInFrames={142} /> */}
      {/* <Composition
      id="VideoSeries"
      component={VideosInSequence}
      durationInFrames={834}
      fps={24000 / 1001}  // match your player: ~23.976
      width={1080}        // match your player (you had 1920x1080 but player uses 1080x1920)
      height={1920}
      defaultProps={{ 
        videos,
        backVideo  // <-- pass this too
      }}
    /> */}

      {/* <Composition
      id="myComp"
      component={MyComp}
      durationInFrames={834}
      fps={24000 / 1001}  // match your player: ~23.976
      width={1080}        // match your player (you had 1920x1080 but player uses 1080x1920)
      height={1920}
      defaultProps={{ 
         transcript
      }}
    /> */}

      <Composition
        id="caption"
        component={CaptionComp}
        durationInFrames={834}
        fps={24000 / 1001} // match your player: ~23.976
        width={1080} // match your player (you had 1920x1080 but player uses 1080x1920)
        height={1920}
        defaultProps={{
          transcript,
          captionPosition: "center",
          stylePreset: "aesthetic",
          captionStyle: {
            stylishFrequency: 0.16,
            verticalFrequency: 0.42,
            accentColor: "#fff36d",
          },
        }}
      />
    </>
  );
};
