import React from "react";

// The Pinwheel keeps its fixed brand colours on purpose (guideline: "built only from the brand colors").
type PinwheelVariant = "color" | "on-dark";

export const BrandPinwheel: React.FC<{
  size: number;
  variant?: PinwheelVariant;
  opacity?: number;
  className?: string;
  style?: React.CSSProperties;
}> = ({ size, variant = "color", opacity, className = "", style }) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img
    src={variant === "color" ? "/brand/pinwheel-color.svg" : "/brand/pinwheel-on-dark.svg"}
    alt=""
    aria-hidden="true"
    width={size}
    height={size}
    className={`block shrink-0 select-none ${className}`}
    style={{ width: size, height: size, opacity, ...style }}
    draggable={false}
  />
);

/** "orbit" wordmark: Lato Black, lowercase, tight tracking (guideline lockup). */
export const Wordmark: React.FC<{
  size: number;
  tracking: number;
  color?: string;
  children?: React.ReactNode;
}> = ({ size, tracking, color = "var(--theme-text)", children = "orbit" }) => (
  <span
    className="whitespace-nowrap leading-[normal]"
    style={{ fontFamily: "'Lato', sans-serif", fontWeight: 900, fontSize: size, letterSpacing: tracking, color }}
  >
    {children}
  </span>
);

/** Mark + wordmark lockup. Proportions from Figma: wordmark ≈ 0.8125 × mark, gap ≈ 0.21875 × mark. */
export const Lockup: React.FC<{ mark: number; color?: string }> = ({ mark, color }) => (
  <span className="inline-flex items-center" style={{ gap: mark * 0.21875 }}>
    <BrandPinwheel size={mark} />
    <Wordmark size={mark * 0.8125} tracking={-(mark * 0.0156)} color={color} />
  </span>
);

/** Indeterminate progress bar; the fill width matches the Figma frame and slides unless motion is reduced. */
export const BrandProgress: React.FC<{
  width: number;
  height: number;
  fill: number;
  track: string;
  color: string;
}> = ({ width, height, fill, track, color }) => {
  const travel = Math.ceil((width / fill) * 100);
  const name = `orbit-progress-${travel}`;
  return (
    <div
      role="progressbar"
      aria-label="Loading"
      className="relative overflow-hidden shrink-0"
      style={{ width, height, borderRadius: height / 2, backgroundColor: track }}
    >
      <div
        className={`${name} absolute inset-y-0 left-0`}
        style={{ width: fill, borderRadius: height / 2, backgroundColor: color }}
      />
      <style>{`
        @keyframes ${name} { 0% { transform: translateX(-100%); } 100% { transform: translateX(${travel}%); } }
        .${name} { animation: ${name} 1.6s cubic-bezier(.4,0,.2,1) infinite; }
        @media (prefers-reduced-motion: reduce) { .${name} { animation: none; } }
      `}</style>
    </div>
  );
};
