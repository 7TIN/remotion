"use client"
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface captionProps {
  className? : string,
  variant: 'dark' | 'light';
}


export default function Caption({className = '', variant} :captionProps) {
  const words = [
    "What",
    "is",
    "it",
    "the",
    "part",
    "about",
    "human",
    "intelligence?"
  ];

  const [currentWord, setCurrentWord] = useState(-1);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentWord((prev) => {
        if (prev >= words.length - 1) {
          clearInterval(interval);
          return prev;
        }

        return prev + 1;
      });
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className={cn("cursor-pointer flex flex-row items-center justify-center px-3 py-px rounded-sm gap-x-2", variant === 'dark' ? 'bg-neutral-600' : 'bg-white/70', className)}>
      {words.map((word, index) => (
        <span
          key={index}
          className={`
            ${index <= currentWord
              ? `${variant === 'dark' ? " text-white" : "text-black" }`
              : "text-neutral-500"}
          `}
        >
          {word}{" "}
        </span>
      ))}
    </div>
  );
}