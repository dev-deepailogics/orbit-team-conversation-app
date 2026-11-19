'use client';

import React, { useEffect, useState } from 'react';

export interface ResizableSidebarOptions {
  storageKey: string;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  side?: 'left' | 'right'; // 'left' means sidebar is on the left (handle on right edge); 'right' means sidebar is on the right (handle on left edge)
}

/**
 * Drag-to-resize for sidebars, remembered per browser under `storageKey`.
 * Supports both left sidebars (handle on right, drag right to expand)
 * and right sidebars like Thread (handle on left, drag left to expand).
 */
export function useResizableSidebar(
  keyOrOptions: string | ResizableSidebarOptions
) {
  const options: ResizableSidebarOptions =
    typeof keyOrOptions === 'string'
      ? { storageKey: keyOrOptions }
      : keyOrOptions;

  const {
    storageKey,
    defaultWidth = 256,
    minWidth = 200,
    maxWidth = 480,
    side = 'left',
  } = options;

  const clamp = (w: number) => Math.min(maxWidth, Math.max(minWidth, Math.round(w)));

  const [width, setWidthState] = useState(defaultWidth);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(storageKey));
      if (saved) setWidthState(clamp(saved));
    } catch {}
  }, [storageKey, minWidth, maxWidth]);

  const setWidth = (w: number) => {
    const next = clamp(w);
    setWidthState(next);
    try {
      localStorage.setItem(storageKey, String(next));
    } catch {}
  };

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = width;
    setDragging(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const move = (ev: PointerEvent) => {
      ev.preventDefault();
      // If side is 'right', moving mouse left (ev.clientX < startX) should INCREASE width
      const delta = side === 'right' ? startX - ev.clientX : ev.clientX - startX;
      setWidth(startW + delta);
    };

    const up = (ev: PointerEvent) => {
      ev.preventDefault();
      setDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const handlePositionClass =
    side === 'right'
      ? 'top-0 left-0 -translate-x-1/2 w-4 cursor-col-resize'
      : 'top-0 right-0 translate-x-1/2 w-4 cursor-col-resize';

  // Desktop only: drag, arrow keys, double-click to reset.
  const handle = (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      aria-valuenow={width}
      aria-valuemin={minWidth}
      aria-valuemax={maxWidth}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onDoubleClick={() => setWidth(defaultWidth)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') setWidth(side === 'right' ? width + 16 : width - 16);
        if (e.key === 'ArrowRight') setWidth(side === 'right' ? width - 16 : width + 16);
      }}
      className={`hidden md:flex items-center justify-center absolute ${handlePositionClass} h-full z-50 group/resize focus:outline-none select-none`}
    >
      <span
        className={`w-0.5 h-full transition-all group-hover/resize:w-1 group-hover/resize:bg-slack-activeChannel group-focus-visible/resize:w-1 group-focus-visible/resize:bg-slack-activeChannel ${
          dragging ? 'w-1 bg-slack-activeChannel opacity-100' : 'opacity-0 group-hover/resize:opacity-100'
        }`}
        style={{ backgroundColor: dragging ? 'var(--theme-primary, #1164A3)' : undefined }}
      />
    </div>
  );

  return {
    width,
    dragging,
    handle,
    style: { ['--sidebar-w' as string]: `${width}px` } as React.CSSProperties,
  };
}
