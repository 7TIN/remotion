import {
  COMP_FPS,
  TOTAL_FRAMES,
  VideoSeriesComp,
} from "@/components/remotion/trailerComp";
import { Player } from "@remotion/player";

const TrailerPage = () => {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 dark:bg-black font-mono">
      {/* <PlayerComp/> */}
      <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Player
          component={VideoSeriesComp}
          durationInFrames={TOTAL_FRAMES}
          compositionWidth={1920}
          compositionHeight={1080}
          fps={COMP_FPS}
          controls
          style={{
            width: "100%",
          }}
        />
      </div>
    </div>
  );
};

export default TrailerPage;
