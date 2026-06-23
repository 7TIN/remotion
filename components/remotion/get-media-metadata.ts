// get-media-metadata.ts
// import {Input, ALL_FORMATS, UrlSource} from 'mediabunny';

// export const getMediaMetadata = async (src: string) => {
//   const input = new Input({
//     formats: ALL_FORMATS,
//     source: new UrlSource(src, {
//       getRetryDelay: () => null,
//     }),
//   });

//   const durationInSeconds = await input.computeDuration();

//   return {durationInSeconds};
// };


import {Input, ALL_FORMATS, FilePathSource} from 'mediabunny';
import path from 'node:path';

export const getMediaMetadata = async (src: string) => {
  // If src is a staticFile path like '/clip_00-03.mp4',
  // resolve it to the actual file path on disk
  const filePath = path.join(process.cwd(), 'public', src);

  const input = new Input({
    formats: ALL_FORMATS,
    source: new FilePathSource(filePath),
  });

  const durationInSeconds = await input.computeDuration();
  return {durationInSeconds};
};
