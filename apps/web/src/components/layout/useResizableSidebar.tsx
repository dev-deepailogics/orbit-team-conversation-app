'use client';

import React, { useEffect, useState } from 'react';

const MIN = 200;
const MAX = 480;
const DEFAULT = 256;
const clamp = (w: number) => Math.min(MAX, Math.max(MIN, Math.round(w)));

/**
 * Drag-to-resize for a left sidebar, remembered per browser under `storageKey`.
 * Usage: add `md:w-[var(--sidebar-w)]` + `relative` to the sidebar, spread `style`, render `handle` inside it,
 * and drop any width transition while `dragging`.
 * Starts at the default so SSR markup matches; the saved width is applied after mount.
 */
export function useResizableSidebar(storageKey: string) {
  const [width, setWidthState] = useState(DEFAULT);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(storageKey));
      if (saved) setWidthState(clamp(saved));
    } catch {}
  }, [storageKey]);

  const setWidth = (w: number) => {
    const next = clamp(w);
    setWidthState(next);
    try {
      localStorage.setItem(storageKey, String(next));
    } catch {}
  };

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = width;
    setDragging(true);
    document.body.style.cursor = 'col-resize';
    const move = (ev: PointerEvent) => setWidth(startW + ev.clientX - startX);
    const up = () => {
      setDragging(false);
      document.body.style.cursor = '';
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  // Desktop only: drag, arrow keys, double-click to reset.
  const handle = (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      aria-valuenow={width}
      aria-valuemin={MIN}
      aria-valuemax={MAX}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onDoubleClick={() => setWidth(DEFAULT)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') setWidth(width - 16);
        if (e.key === 'ArrowRight') setWidth(width + 16);
      }}
      className="hidden md:block absolute top-0 right-0 w-1.5 h-full z-40 cursor-col-resize group/resize focus:outline-none"
    >
      <span
        className={`block ml-auto w-0.5 h-full transition-opacity group-hover/resize:opacity-100 group-focus-visible/resize:opacity-100 ${
          dragging ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ backgroundColor: 'var(--theme-primary)' }}
      />
    </div>
  );

  return { width, dragging, handle, style: { ['--sidebar-w' as string]: `${width}px` } as React.CSSProperties };
}
