import React from 'react';
import {Composition} from 'remotion';
// import {MyComposition} from './Composition';
import {MyComp} from './MyComp';
import {transcript} from '@/data/transcript';


// export const RemotionRoot: React.FC = () => {
//   return (
//     <>
//       <Composition
//         id="Empty"
//         component={MyComposition}
//         durationInFrames={60}
//         fps={30}
//         width={1280}
//         height={720}
//       />
//     </>
//   );
// };


export const MyVideo = () => {
  return (
    <>
      <Composition component={MyComp} durationInFrames={1042} width={1080} height={1920} fps={30} id="my-comp" defaultProps={{transcript}} />
    </>
  );
};
