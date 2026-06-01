import React from 'react';

interface SkeuomorphicCardProps {
  variant: 'dark' | 'light';
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
  className?: string;
}

export function SkeuomorphicCard({
  variant,
  title,
  subtitle,
  children,
  className = '',
}: SkeuomorphicCardProps) {
  const isDark = variant === 'dark';

  return (
    <div
      className={`
        rounded-3xl p-4
        ${
          isDark
            ? 'bg-linear-to-b from-[#202020] to-[#191919] shadow-[0_1px_0.5px_#ffffff1a_inset,0_1px_0.5px_#ffffff25_inset,0_10px_10px_-9px_#00000070,0_20px_20px_-14px_#00000060,0_0px_6px_0px_#00000060]'
            : 'bg-linear-to-b from-[#f5f5f5] to-[#ececec] shadow-[0_1px_0.5px_#ffffff8a_inset,0_1px_0.5px_#ffffff9a_inset,0_10px_10px_-9px_#00000015,0_20px_20px_-14px_#0000000a,0_0px_6px_0px_#0000000a]'
        }
        ${className}
      `}
    >
      {/* Inner Card - Raised/Popping */}
      <div
        className={`
          rounded-2xl p-5 border-2
          ${
            isDark
              ? 'bg-[#141414] border-[#0a0a0a] shadow-[0_0.5px_0_#ffffff50,0_2px_6px_#00000090_inset]'
              : 'bg-[#ffffff] border-[#e0e0e0] shadow-[0_0.5px_0_#00000010,0_2px_6px_#00000008_inset]'
          }
        `}
      >
        {/* Content */}
        <div className="space-y-3">
          {title && (
            <h3
              className={`
                text-lg font-semibold tracking-tight
                ${isDark ? 'text-[#f0f0f0]' : 'text-[#1a1a1a]'}
              `}
            >
              {title}
            </h3>
          )}
          {subtitle && (
            <p
              className={`
                text-sm
                ${isDark ? 'text-[#a0a0a0]' : 'text-[#6a6a6a]'}
              `}
            >
              {subtitle}
            </p>
          )}
          {children && (
            <div
              className={`
                text-sm leading-relaxed
                ${isDark ? 'text-[#c0c0c0]' : 'text-[#4a4a4a]'}
              `}
            >
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SkeuomorphicCard;
