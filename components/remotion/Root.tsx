import React from 'react';
import {Composition} from 'remotion';
// import {MyComposition} from './Composition';
import {MyComp} from './MyComp';
import {transcript} from '../../data/transcript';
import { TextComp } from './TextComp';

export const MyVideo = () => {
  return (
    <>
      <Composition component={MyComp} durationInFrames={1042} width={1080} height={1920} fps={30} id="my-comp" defaultProps={{transcript}}/>
      <Composition component={TextComp} id="my-text" width={1080} height={1920} fps={30} durationInFrames={142} />
    </>
  );
};
