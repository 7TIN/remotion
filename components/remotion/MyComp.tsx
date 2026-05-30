import {AbsoluteFill, OffthreadVideo, useCurrentFrame, interpolate, staticFile} from 'remotion';

export const MyComp: React.FC<{text: string}> = ({text}) => {
  const frame = useCurrentFrame();
  
  // Text fades in from frame 30–60
  const opacity = interpolate(frame, [30, 60], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill>
      {/* Base video */}
      <OffthreadVideo src={staticFile('video1.mp4')} />
      {/* Text overlaid on top — previewed live! */}
      <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
        <div style={{fontSize: 80, color: 'white', opacity}}>
          {text}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
