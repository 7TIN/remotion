import React from "react";
import { Composition } from "remotion";
// import {MyComposition} from './Composition';
import { MyComp } from "./MyComp";
import { transcript } from "../../data/transcript";
import { TextComp } from "./TextComp";
import {
  calculateVideoDurations,
  videos,
  VideosInSequence,
  videosSrc,
} from "./VidSeries";

export const MyVideo = () => {
  return (
    <>
      {/* <Composition component={MyComp} durationInFrames={1042} width={1080} height={1920} fps={30} id="my-comp" defaultProps={{transcript}}/> */}
      {/* <Composition component={TextComp} id="my-text" width={1080} height={1920} fps={30} durationInFrames={142} /> */}
      <Composition
        id="VideoSeries"
        component={VideosInSequence}
        durationInFrames={900} // sum of all clip durations
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          videos: videos
        }}
        calculateMetadata={async ({ props }) => {
          // Use your calculateVideoDurations() here
          const resolvedVideos = await calculateVideoDurations(videosSrc, 30);
          const totalDuration = resolvedVideos.reduce(
            (sum, v) => sum + v.durationInFrames,
            0,
          );
          return {
            props: { videos: resolvedVideos },
            durationInFrames: totalDuration,
          };
        }}
      />
    </>
  );
};
