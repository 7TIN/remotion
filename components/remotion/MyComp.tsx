import {
  AbsoluteFill,
  OffthreadVideo,
  useCurrentFrame,
  useVideoConfig,
  staticFile,
} from "remotion";

type Segment = {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
};


type MyCompProps = {
  transcript: Segment[];
};

export const MyComp : React.FC<MyCompProps> = ({
  transcript,
}: {
  transcript: Segment[];
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const currentMs = (frame / fps) * 1000;

  const activeSegment = transcript.find(
    (segment) =>
      currentMs >= segment.startMs &&
      currentMs < segment.endMs
  );

  return (
    <AbsoluteFill>
      <OffthreadVideo src={staticFile("video1.mp4")} />

      <AbsoluteFill
        style={{
          justifyContent: "flex-end",
          alignItems: "center",
          paddingBottom: 180,
        }}
      >
        <div
          style={{
            color: "white",
            fontSize: 60,
            fontWeight: "bold",
            textAlign: "center",
            maxWidth: "80%",
            textShadow: "0 0 10px rgba(0,0,0,0.9)",
          }}
        >
          {activeSegment?.text}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};