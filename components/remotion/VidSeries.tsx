// import React from "react";
import { OffthreadVideo, Series, staticFile, useVideoConfig } from "remotion";
// // import {CalculateMetadataFunction} from 'remotion';
import { getMediaMetadata } from "./get-media-metadata";

// export const videos: video[] = [
//   {
//     id: 1,
//     src: "clip_00-03.mp4",
//     durationInFrames: 92,
//   },
//   {
//     id: 2,
//     src: "rest_03-10.mp4",
//     durationInFrames: 212,
//   },
//   {
//     id: 3,
//     src: "clip_10-13.mp4",
//     durationInFrames: 92,
//   },
//   {
//     id: 4,
//     src: "rest_13-18.mp4",
//     durationInFrames: 152,
//   },
//   {
//     id: 5,
//     src: "clip_18-21.mp4",
//     durationInFrames: 92,
//   },
//   {
//     id: 6,
//     src: "rest_21-26.mp4",
//     durationInFrames: 151,
//   },
//   {
//     id: 7,
//     src: "clip_26-29.mp4",
//     durationInFrames: 91,
//   },
//   {
//     id: 8,
//     src: "rest_29-34.mp4",
//     durationInFrames: 31,
//   },
// ];

// VidSeries.ts
export const videos : video[] = [
  { id: 1, src: "clip_00-03.mp4",   durationInFrames: 72 },
  { id: 2, src: "rest_03-10.mp4",   durationInFrames: 168 },
  { id: 3, src: "clip_10-13.mp4",   durationInFrames: 72 },
  { id: 4, src: "rest_13-18.mp4",   durationInFrames: 120 },
  { id: 5, src: "clip_18-21.mp4",   durationInFrames: 72 },
  { id: 6, src: "rest_21-26.mp4",   durationInFrames: 120 },
  { id: 7, src: "clip_26-29.mp4",   durationInFrames: 72 },
  { id: 8, src: "rest_29-end.mp4",  durationInFrames: 138 },
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
  videos: {id: number; src: string; durationInFrames: number}[];
}> = ({videos}) => {
  const {fps} = useVideoConfig();

  return (
    <Series>
      {videos.map((vid) => (
        <Series.Sequence
          key={vid.src}
          durationInFrames={vid.durationInFrames}
          premountFor={Math.round(1.5 * fps)}
        >
          <OffthreadVideo
            src={staticFile(vid.src)}
            pauseWhenBuffering
          />
        </Series.Sequence>
      ))}
    </Series>
  );
};

type video = { id: number; src: string; durationInFrames: number };

export const videosSrc = [
  {
    id: 1,
    src: "clip_00-03.mp4",
  },
  {
    id: 2,
    src: "clip_10-13.mp4",
  },
  {
    id: 3,
    src: "clip_18-21.mp4",
  },
  {
    id: 4,
    src: "clip_26-29.mp4",
  },
  {
    id: 5,
    src: "rest_03-10.mp4",
  },
  {
    id: 6,
    src: "rest_13-18.mp4",
  },
  {
    id: 7,
    src: "rest_21-26.mp4",
  },
  {
    id: 8,
    src: "rest_29-34.mp4",
  },
];


export const calculateVideoDurations = async (
  videosSrc: { id: number; src: string }[],
  fps: number,
): Promise<video[]> => {
  const results = await Promise.all(
    videosSrc.map(async (video) => {
      const { durationInSeconds } = await getMediaMetadata(
        staticFile(video.src),
      );
      return {
        id: video.id,
        src: video.src,
        durationInFrames: Math.floor(durationInSeconds * fps),
      };
    }),
  );
  return results;
};

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
