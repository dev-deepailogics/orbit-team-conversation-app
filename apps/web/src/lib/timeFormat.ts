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

export interface MessageChange {
  label: 'edited' | 'deleted';
  /** When it happened: the time, plus a short date when that isn't the day the message was sent */
  text: string;
  /** Full date and time, for a tooltip */
  title: string;
}

/**
 * For an edited or deleted message whose updatedAt differs from its createdAt, when it was edited or deleted.
 * Null for anything else (never changed, or only touched in some other way such as a pin).
 */
export function getMessageChange(
  m: { createdAt: string | number | Date; updatedAt?: string | number | Date | null; isEdited?: boolean; isDeleted?: boolean },
  format: TimeFormat,
): MessageChange | null {
  if (!m.isEdited && !m.isDeleted) return null;
  if (!m.updatedAt) return null;
  const created = new Date(m.createdAt);
  const updated = new Date(m.updatedAt);
  if (isNaN(created.getTime()) || isNaN(updated.getTime()) || created.getTime() === updated.getTime()) return null;

  const label = m.isDeleted ? 'deleted' : 'edited';
  const time = formatMessageTime(updated, format);
  const sameDay = created.toDateString() === updated.toDateString();
  const text = sameDay ? time : `${updated.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`;
  const title = `${label === 'deleted' ? 'Deleted' : 'Edited'} ${updated.toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
    hour12: format === '12',
  })}`;
  return { label, text, title };
}
