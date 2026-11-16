'use client';

import { useEffect, useState } from 'react';

export type TimeFormat = '12' | '24';

const STORAGE_KEY = 'orbit_time_format';
const CHANGE_EVENT = 'orbit-time-format-change';
const DEFAULT_FORMAT: TimeFormat = '12';

export function getTimeFormat(): TimeFormat {
  if (typeof window === 'undefined') return DEFAULT_FORMAT;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === '24' ? '24' : DEFAULT_FORMAT;
  } catch {
    return DEFAULT_FORMAT;
  }
}

export function setTimeFormat(format: TimeFormat) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, format);
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: format }));
  } catch {
    // ignore
  }
}

export function useTimeFormat(): TimeFormat {
  const [format, setFormat] = useState<TimeFormat>(getTimeFormat);

  useEffect(() => {
    const sync = () => setFormat(getTimeFormat());
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return format;
}

export function formatMessageTime(date: string | number | Date, format: TimeFormat): string {
  return new Date(date).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: format === '12',
  });
}
