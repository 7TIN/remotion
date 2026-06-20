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
      {/* <video src="/foreground_rgba.webm"></video> */}

      <div className="flex bg-white max-w-80 h-50 text-center justify-center items-center w-full">
      <p className="text-shadow-gray-50 text-black text-5xl">SUPERRRRR</p>

      </div>

      <div className="relative cursor-pointer overflow-hidden rounded-panel flex items-center justify-center text-white bg-neutral-600 px-3 py-px rounded-sm">
        Hello
        {/* <span className="text-neutral-400 pl-1">User !</span> */}
      </div>
      <div className="relative cursor-pointer overflow-hidden rounded-panel flex items-center justify-center text-black bg-white/70 px-3 py-px rounded-sm">
        Hello
      </div>
      <Caption variant="dark" />
      <Caption variant="light" />

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
<div className="flex gap-2 text-xl flex-wrap items-center justify-center ">
  <span className="font-jakarta">Plus Jakarta Sans</span>
  <span className="font-reenie">Reenie Beanie</span>
  <span className="font-roboto">Roboto</span>
  <span className="font-bricolage">Bricolage Grotesque</span>
  <span className="font-anton">Anton</span>
  {/* <span className="font-playfair">Playfair Display</span>
  <span className="font-poetsen">Poetsen One</span>
  <span className="font-lora">Lora</span>
  <span className="font-russo">Russo One</span>
  <span className="font-jersey">Jersey 15</span>
  <span className="font-surfer">Original Surfer</span>
  <span className="font-inter">Inter</span>
  <span className="font-poppins">Poppins</span>
  <span className="font-literata">Literata</span>
  <span className="font-manrope">Manrope</span>
  <span className="font-sans">Geist Sans (default)</span>
  <span className="font-mono">Geist Mono</span> */}
</div>
    </div>
  );
}
