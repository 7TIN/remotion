"use client";
import { loadFont } from "@remotion/google-fonts/GeistMono";
import { Video } from "@remotion/media";
import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, staticFile } from "remotion";

const { fontFamily } = loadFont("normal", {
  subsets: ["latin"],
});

export const TextComp: React.FC = () => {
  return (
    <AbsoluteFill>
      {/* Layer 1: Background video */}
      <AbsoluteFill style={{ zIndex: 1 }}>
        <OffthreadVideo src={staticFile("clip.mp4")} />
      </AbsoluteFill>

      {/* Layer 2: Text */}
      <AbsoluteFill
        style={{
          zIndex: 2,
          justifyContent: "flex-start",
          alignItems: "center",
        }}
      >
        <div
          style={{
            fontFamily,
            fontSize: 140,
            color: "white",
            fontWeight: "bold",
            textAlign: "center",
            paddingTop: 200,
            // textShadow: "0 0 40px rgba(0,0,0,0.9)",
          }}
        >
          INTELLIGENCE
        </div>
      </AbsoluteFill>
      {/* Layer 3: Foreground person (transparent webm) */}
      <AbsoluteFill style={{ zIndex: 3 }}>
        {/* <OffthreadVideo src={staticFile("foreground_rgba.webm")} transparent /> */}
        <OffthreadVideo src={staticFile("test.webm")} transparent />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
