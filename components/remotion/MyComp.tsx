// export const MyComp: React.FC<{text: string}> = ({text}) => {
//   return <div>Hello {text}!</div>;
// };

import { AbsoluteFill, OffthreadVideo } from "remotion";

export const MyComp = () => {
  return (
    <AbsoluteFill>
      <OffthreadVideo
        src="/video1.mp4"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
        }}
      />
    </AbsoluteFill>
  );
};