import React from "react";
import { BrandPinwheel, BrandProgress, Lockup, Wordmark } from "./BrandMark";

const onBrand = (pct: number) => `color-mix(in srgb, var(--theme-primary-text) ${pct}%, transparent)`;
// Light, saturated tint of the primary (brand/200 #99F6E4 for Mint Teal).
const brandTint = "oklch(from var(--theme-primary) 0.91 calc(c * 0.8) h)";
const cardShadow = "0 12px 16px rgba(10, 51, 89, 0.16)";

/** Figma 1:10493 · Splash · App launch (shown while the session is being restored). */
export const Splash: React.FC = () => (
  <div
    className="h-screen w-screen flex items-center justify-center overflow-hidden"
    style={{
      background:
        "linear-gradient(180deg, var(--theme-primary), color-mix(in srgb, var(--theme-primary-hover) 80%, black))",
    }}
  >
    {/* 1440×900 frame content; everything is positioned relative to the centred 400px halo */}
    <div
      className="relative w-[600px] h-[560px] shrink-0 -translate-y-2.5"
      role="status"
      aria-label="Starting Orbit"
    >
      <div
        className="absolute left-[100px] top-0 w-[400px] h-[400px] rounded-full"
        style={{ backgroundColor: onBrand(6) }}
      />
      <div
        className="absolute left-[150px] top-[50px] w-[300px] h-[300px] rounded-full"
        style={{ backgroundColor: onBrand(8) }}
      />
      <BrandPinwheel size={150} variant="on-dark" className="absolute left-[225px] top-[125px]" />
      <div className="absolute inset-x-0 top-[310px] flex justify-center">
        <Wordmark size={52} tracking={-1} color="var(--theme-primary-text)">
          Orbit
        </Wordmark>
      </div>
      <p
        className="absolute inset-x-0 top-[400px] text-center text-[18px] font-medium"
        style={{ color: "color-mix(in srgb, var(--theme-selected) 90%, transparent)" }}
      >
        Where your team stays in orbit
      </p>
      <div className="absolute left-[180px] top-[500px]">
        <BrandProgress width={240} height={4} fill={96} track={onBrand(25)} color="var(--theme-primary-text)" />
      </div>
      <p className="absolute inset-x-0 top-[524px] text-center text-[13px] font-medium" style={{ color: brandTint }}>
        Starting Orbit…
      </p>
    </div>
  </div>
);

const SkeletonBar: React.FC<{ w: number; h?: number; r?: number; opacity?: number; className?: string }> = ({
  w,
  h = 14,
  r = 7,
  opacity = 1,
  className = "",
}) => (
  <div
    className={`shrink-0 ${className}`}
    style={{
      width: w,
      height: h,
      borderRadius: r,
      backgroundColor: `color-mix(in srgb, var(--theme-border) ${opacity * 100}%, transparent)`,
    }}
  />
);

// [title width, body line widths] per message row, straight from the frame.
const SKELETON_ROWS: number[][] = [
  [820, 460],
  [640],
  [820, 460],
  [640],
  [820, 460],
  [640],
];

/** Figma 1:10507 · Loading · Workspace skeleton with the 1:10543 loading card. */
export const WorkspaceSkeleton: React.FC = () => (
  <div className="relative h-screen w-screen flex overflow-hidden" style={{ backgroundColor: "var(--theme-bg-surface)" }}>
    <aside
      className="hidden md:block relative w-[272px] shrink-0 h-full"
      style={{ backgroundColor: "var(--theme-primary-hover)" }}
    >
      <div className="absolute left-4 top-4 w-8 h-8 rounded-lg" style={{ backgroundColor: onBrand(90) }} />
      <div className="absolute left-5 top-[100px] flex flex-col gap-7">
        {[150, 200, 200, 150, 200, 200, 150, 200, 200].map((w, i) => (
          <div key={i} className="h-4 rounded-lg" style={{ width: w, backgroundColor: onBrand(18) }} />
        ))}
      </div>
    </aside>

    <main className="relative flex-1 min-w-0 h-full overflow-hidden">
      <div className="absolute left-6 top-6 flex flex-col gap-2">
        <SkeletonBar w={300} h={22} r={8} />
        <SkeletonBar w={420} opacity={0.7} />
      </div>
      <div className="absolute left-6 top-[130px] flex flex-col">
        {SKELETON_ROWS.map((lines, i) => (
          <div key={i} className="h-[108px] flex gap-3.5">
            <SkeletonBar w={40} h={40} r={20} />
            <div className="pt-0.5 flex flex-col gap-2.5">
              <SkeletonBar w={180} />
              {lines.map((w, j) => (
                <SkeletonBar key={j} w={w} opacity={j === 0 ? 0.7 : 0.5} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div
        className="absolute inset-0"
        style={{ backgroundColor: "color-mix(in srgb, var(--theme-bg-surface) 55%, transparent)" }}
      />
    </main>

    <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
      <div
        role="status"
        aria-label="Loading your workspace"
        className="relative w-[400px] max-w-full h-[290px] rounded-3xl border flex flex-col items-center"
        style={{ backgroundColor: "var(--theme-bg-app)", borderColor: "var(--theme-border)", boxShadow: cardShadow }}
      >
        <div className="mt-[49px]">
          <Lockup mark={76.8} />
        </div>
        <p className="mt-[23px] text-[18px] font-semibold" style={{ color: "var(--theme-text)" }}>
          Loading your workspace
        </p>
        <p className="mt-2 text-sm" style={{ color: "var(--theme-text-muted)" }}>
          Fetching channels, docs and boards
        </p>
        <div className="mt-[33px]">
          <BrandProgress width={240} height={6} fill={150} track="var(--theme-border)" color="var(--theme-primary)" />
        </div>
      </div>
    </div>
  </div>
);

/** Figma 1:10897 · Loading · Messages overlay card (300×190), centred over a scrimmed message area. */
export const MessagesLoadingOverlay: React.FC<{ label?: string }> = ({ label = "Loading messages…" }) => (
  <div
    className="absolute inset-0 z-20 flex items-center justify-center"
    style={{ backgroundColor: "color-mix(in srgb, var(--theme-bg-surface) 55%, transparent)" }}
  >
    <div
      role="status"
      aria-label={label}
      className="w-[300px] h-[190px] rounded-[20px] border flex flex-col items-center"
      style={{ backgroundColor: "var(--theme-bg-app)", borderColor: "var(--theme-border)", boxShadow: cardShadow }}
    >
      <BrandPinwheel size={68} className="mt-[29px]" />
      <p className="mt-[14px] text-base font-semibold" style={{ color: "var(--theme-text)" }}>
        {label}
      </p>
      <div className="mt-[19px]">
        <BrandProgress width={160} height={5} fill={70} track="var(--theme-border)" color="var(--theme-primary)" />
      </div>
    </div>
  </div>
);
