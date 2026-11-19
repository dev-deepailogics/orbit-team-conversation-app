"use client";

import React, { useEffect, useState } from "react";
import { BrandPinwheel } from "./BrandMark";

const WARNING = "#D97706";

/** Tracks the browser's network status via the online/offline events. */
export function useOnlineStatus() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

/** Figma 1:10595 · Error · You are offline. */
export const OfflineScreen: React.FC<{ onRetry: () => void; checking?: boolean; className?: string }> = ({
  onRetry,
  checking,
  className = "fixed inset-0 z-[100]",
}) => (
  <div
    role="alertdialog"
    aria-labelledby="orbit-offline-title"
    className={`${className} flex items-center justify-center overflow-hidden p-4`}
    style={{ backgroundColor: "var(--theme-bg-surface)" }}
  >
    <div className="relative w-[600px] max-w-full h-[572px] shrink-0 -translate-y-3.5">
      <div
        className="absolute left-1/2 -translate-x-1/2 top-0 w-[400px] h-[400px] rounded-full"
        style={{ backgroundColor: "var(--theme-selected)" }}
      />
      <BrandPinwheel size={150} opacity={0.55} className="absolute left-1/2 -translate-x-1/2 top-[125px]" />
      <div
        className="absolute left-1/2 translate-x-[50px] top-[250px] w-14 h-14 rounded-full flex items-center justify-center text-[28px] font-bold"
        style={{
          backgroundColor: "var(--theme-bg-app)",
          color: WARNING,
          boxShadow: "0 12px 16px rgba(10, 51, 89, 0.16)",
        }}
        aria-hidden="true"
      >
        !
      </div>
      <h1
        id="orbit-offline-title"
        className="absolute inset-x-0 top-[410px] text-center text-[28px] font-bold"
        style={{ color: "var(--theme-text)" }}
      >
        You&apos;re offline
      </h1>
      <p
        className="absolute left-1/2 -translate-x-1/2 top-[456px] w-[500px] max-w-full text-center text-base"
        style={{ color: "var(--theme-text-muted)" }}
      >
        Orbit lost its connection. Your drafts are saved and will send as soon as you are back.
      </p>
      <button
        onClick={onRetry}
        disabled={checking}
        className="absolute left-1/2 -translate-x-1/2 top-[526px] w-[200px] h-[46px] rounded-[10px] text-[15px] font-semibold transition hover:bg-[var(--theme-primary-hover)] disabled:opacity-70"
        style={{ backgroundColor: "var(--theme-primary)", color: "var(--theme-primary-text)" }}
      >
        {checking ? "Checking…" : "Try again"}
      </button>
    </div>
  </div>
);

/**
 * Self-contained offline overlay: mount once inside the app layout. It covers the UI without
 * unmounting it, so in-progress composer text survives the outage.
 */
export const OfflineOverlay: React.FC = () => {
  const online = useOnlineStatus();
  const [checking, setChecking] = useState(false);
  const [dismissedWhileOffline, setDismissed] = useState(false);

  useEffect(() => {
    if (online) setDismissed(false);
  }, [online]);

  if (online || dismissedWhileOffline) return null;
  return (
    <OfflineScreen
      checking={checking}
      onRetry={() => {
        setChecking(true);
        setTimeout(() => {
          setChecking(false);
          if (navigator.onLine) setDismissed(true);
        }, 800);
      }}
    />
  );
};
