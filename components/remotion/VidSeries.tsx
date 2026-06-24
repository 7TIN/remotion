// import React from "react";
import {
  AbsoluteFill,
  OffthreadVideo,
  Series,
  staticFile,
  useVideoConfig,
} from "remotion";
// // import {CalculateMetadataFunction} from 'remotion';
// import { getMediaMetadata } from "./get-media-metadata";
import { loadFont } from "@remotion/google-fonts/GeistMono";

const { fontFamily } = loadFont("normal", {
  subsets: ["latin"],
});

type video = { id: number; src: string; durationInFrames: number };


export const backVideo: video[] = [
  {
    id: 1,
    src: "b016d130-df46-4fea-a00e-66199ba94e67_output.webm",
    durationInFrames: 72,
  },
  {
    id: 3,
    src: "887ff269-255a-422d-b0e8-d5d9d3c673f9_output.webm",
    durationInFrames: 72,
  },
  {
    id: 5,
    src: "c5a88e61-5aab-4a12-9b4a-ad697dff2eaa_output.webm",
    durationInFrames: 72,
  },
  {
    id: 7,
    src: "4201bfc4-2e10-4366-8747-24272d7c8470_output.webm",
    durationInFrames: 72,
  },
];

export const videos: video[] = [
  { id: 1, src: "clip_00-03.mp4", durationInFrames: 72 },
  { id: 2, src: "rest_03-10.mp4", durationInFrames: 168 },
  { id: 3, src: "clip_10-13.mp4", durationInFrames: 72 },
  { id: 4, src: "rest_13-18.mp4", durationInFrames: 120 },
  { id: 5, src: "clip_18-21.mp4", durationInFrames: 72 },
  { id: 6, src: "rest_21-26.mp4", durationInFrames: 120 },
  { id: 7, src: "clip_26-29.mp4", durationInFrames: 72 },
  { id: 8, src: "rest_29-end.mp4", durationInFrames: 138 },
];

// export const VideosInSequence: React.FC<{
//   videos: { id: number; src: string; durationInFrames: number }[];
// }> = ({ videos }) => {
//   return (
//     <Series>
//       {videos.map((vid) => (
//         <Series.Sequence key={vid.src} durationInFrames={vid.durationInFrames}>
//           <OffthreadVideo src={staticFile(vid.src)} />
//         </Series.Sequence>
//       ))}
//     </Series>
//   );
// };

export const VideosInSequence: React.FC<{
  videos: { id: number; src: string; durationInFrames: number }[];
  backVideo: { id: number; src: string; durationInFrames: number }[];
}> = ({ videos, backVideo }) => {
  const { fps } = useVideoConfig();

  return (
    <Series>
      {videos.map((vid) => (
        <Series.Sequence
          key={vid.src}
          durationInFrames={vid.durationInFrames}
          premountFor={Math.round(1.5 * fps)}
        >
          {vid.src.includes("clip") ? (
            <AbsoluteFill>
              <AbsoluteFill style={{ zIndex: 1 }}>
                <OffthreadVideo src={staticFile(vid.src)} pauseWhenBuffering />
              </AbsoluteFill>
              <AbsoluteFill
                style={{
                  zIndex: 2,
                  justifyContent: "flex-start",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    fontFamily,
                    fontSize: 140,
                    color: "white",
                    fontWeight: "bold",
                    textAlign: "center",
                    paddingTop: 200,
                  }}
                >
                  INTELLIGENCE
                </div>
              </AbsoluteFill>
              <AbsoluteFill style={{ zIndex: 3 }}>
                <OffthreadVideo
                  pauseWhenBuffering
                  src={staticFile(
                    backVideo.find((bvid) => bvid.id === vid.id)?.src || "",
                  )}
                  transparent
                />
              </AbsoluteFill>
            </AbsoluteFill>
          ) : (
            <OffthreadVideo src={staticFile(vid.src)} pauseWhenBuffering />
          )}
        </Series.Sequence>
      ))}
    </Series>
  );
};


// export const videosSrc = [
//   {
//     id: 1,
//     src: "clip_00-03.mp4",
//   },
//   {
//     id: 2,
//     src: "clip_10-13.mp4",
//   },
//   {
//     id: 3,
//     src: "clip_18-21.mp4",
//   },
//   {
//     id: 4,
//     src: "clip_26-29.mp4",
//   },
//   {
//     id: 5,
//     src: "rest_03-10.mp4",
//   },
//   {
//     id: 6,
//     src: "rest_13-18.mp4",
//   },
//   {
//     id: 7,
//     src: "rest_21-26.mp4",
//   },
//   {
//     id: 8,
//     src: "rest_29-34.mp4",
//   },
// ];

// export const calculateVideoDurations = async (
//   videosSrc: { id: number; src: string }[],
//   fps: number,
// ): Promise<video[]> => {
//   const results = await Promise.all(
//     videosSrc.map(async (video) => {
//       const { durationInSeconds } = await getMediaMetadata(
//         staticFile(video.src),
//       );
//       return {
//         id: video.id,
//         src: video.src,
//         durationInFrames: Math.floor(durationInSeconds * fps),
//       };
//     }),
//   );
//   return results;
// };

// const videos = await calculateVideoDurations(videosSrc, 30);

// console.log(videos);
// const videos : video[] = []

// const calculateVideoDurations = async(videosSrc : {id:number,src:string}[], fps : number) : Promise<video[]> => {
//     {
//         // videosSrc.map((key) => {
//         //     const duration =
//         // })
//         const results = await Promise.all(
//             videosSrc.map( async(video) => {
//                 const {durationInFrames} = await parseMedia
//             })
//         )
//     }
// };
