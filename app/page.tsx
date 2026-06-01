// import { PlayerComp } from "@/components/player";
import Caption from "@/components/caption-1";
import SkeuomorphicCard from "@/components/SkeuomorphicCard";
// import { ModeToggle } from "@/components/toggle-theme-button";
import Image from "next/image";

export const words = ["hello", "user !", "how", "are", "you"];



export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 dark:bg-black font-mono gap-y-4">
      {/* <ModeToggle /> */}
      {/* HELLO */}
      <div className="relative cursor-pointer overflow-hidden rounded-panel flex items-center justify-center text-white bg-neutral-600 px-3 py-px rounded-sm">
        Hello
        {/* <span className="text-neutral-400 pl-1">User !</span> */}
      </div>
      <div className="relative cursor-pointer overflow-hidden rounded-panel flex items-center justify-center text-black bg-white/70 px-3 py-px rounded-sm">
        Hello
      </div>
      <Caption variant="dark"/>
      <Caption variant="light"/>

      {/* <div className="flex gap-x-5">
        <SkeuomorphicCard
          variant="dark"
          title="Dark Skeuomorphic Card"
          subtitle="Layered depth with smooth padding"
        ></SkeuomorphicCard>
                <SkeuomorphicCard
          variant="light"
          title="Dark Skeuomorphic Card"
          subtitle="Layered depth with smooth padding"
        ></SkeuomorphicCard>
      </div> */}
      {/* <PlayerComp/> */}
    </div>
  );
}
