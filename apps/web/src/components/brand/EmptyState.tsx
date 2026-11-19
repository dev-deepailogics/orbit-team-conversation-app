import React from "react";
import { BrandPinwheel } from "./BrandMark";

/** Figma 1:10623 · Empty · All caught up (main-area content; centred in its container). */
export const EmptyState: React.FC<{
  title?: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}> = ({
  title = "You're all caught up",
  body = "No new mentions or unread threads. Enjoy the quiet in orbit.",
  actionLabel = "Browse channels",
  onAction,
  className = "",
}) => (
  <div
    className={`flex-1 flex items-center justify-center overflow-hidden p-4 ${className}`}
    style={{ backgroundColor: "var(--theme-bg-surface)" }}
  >
    <div className="relative w-[600px] max-w-full h-[420px] shrink-0">
      <BrandPinwheel size={420} opacity={0.08} className="absolute left-1/2 -translate-x-1/2 top-0 max-w-none" />
      <BrandPinwheel size={110} className="absolute left-1/2 -translate-x-1/2 top-[65px]" />
      <h2
        className="absolute inset-x-0 top-[200px] text-center text-[28px] font-bold"
        style={{ color: "var(--theme-text)" }}
      >
        {title}
      </h2>
      <p
        className="absolute left-1/2 -translate-x-1/2 top-[246px] w-[500px] max-w-full text-center text-base"
        style={{ color: "var(--theme-text-muted)" }}
      >
        {body}
      </p>
      {onAction && (
        <button
          onClick={onAction}
          className="absolute left-1/2 -translate-x-1/2 top-[306px] w-[200px] h-[46px] rounded-[10px] text-[15px] font-semibold transition hover:bg-[var(--theme-primary-hover)]"
          style={{ backgroundColor: "var(--theme-primary)", color: "var(--theme-primary-text)" }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  </div>
);
