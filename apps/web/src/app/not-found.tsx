'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { BrandPinwheel } from '@/components/brand/BrandMark';

/** Figma 1:10609 · Error · Page not found. */
export default function NotFoundPage() {
  // Signed-in users go back to the app; visitors to the marketing home.
  const [homeHref, setHomeHref] = useState('/');
  useEffect(() => {
    try {
      if (localStorage.getItem('orbit_token')) setHomeHref('/app');
    } catch {}
  }, []);

  return (
    <main
      className="min-h-screen w-full flex items-center justify-center overflow-hidden p-4"
      style={{ backgroundColor: 'var(--theme-bg-surface)', fontFamily: "var(--theme-font, 'Inter'), sans-serif" }}
    >
      <div className="relative w-[600px] max-w-full h-[486px] shrink-0 -translate-y-[37px]">
        <p
          aria-hidden="true"
          className="absolute inset-x-0 top-0 text-center text-[150px] font-bold leading-[normal] select-none"
          style={{ color: 'oklch(from var(--theme-primary) 0.91 calc(c * 0.8) h)' }}
        >
          404
        </p>
        <BrandPinwheel size={120} className="absolute left-1/2 -translate-x-1/2 top-[100px]" />
        <h1
          className="absolute inset-x-0 top-[330px] text-center text-[28px] font-bold"
          style={{ color: 'var(--theme-text)' }}
        >
          This page drifted out of orbit
        </h1>
        <p
          className="absolute left-1/2 -translate-x-1/2 top-[376px] w-[500px] max-w-full text-center text-base"
          style={{ color: 'var(--theme-text-muted)' }}
        >
          The link may be broken or the page was moved.
        </p>
        <div className="absolute inset-x-0 top-[440px] flex justify-center gap-5">
          <Link
            href={homeHref}
            className="w-[200px] h-[46px] rounded-[10px] flex items-center justify-center text-[15px] font-semibold transition hover:bg-[var(--theme-primary-hover)]"
            style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}
          >
            Back to Home
          </Link>
          {homeHref === '/app' && (
            <Link
              href="/app?search=1"
              className="w-[120px] h-[46px] rounded-[10px] border flex items-center justify-center text-[15px] font-semibold transition hover:bg-[var(--theme-fill-hover)]"
              style={{ backgroundColor: 'var(--theme-bg-app)', borderColor: 'var(--theme-border)', color: 'var(--theme-text)' }}
            >
              Search
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
