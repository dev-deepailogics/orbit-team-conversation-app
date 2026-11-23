import type { UserAvailabilityRecord } from '@orbit/types';

export type Presence = 'working' | 'break' | 'off';

// Same list as web (apps/web/src/components/availability/EmployeeAvailabilityHeader.tsx).
export const BREAK_REASONS = ['Lunch', 'Namaz', 'Tea Break', 'Personal', 'Meeting / Discussion', 'Other'];

// Checking out before this many worked hours asks for confirmation (matches web).
export const FULL_SHIFT_HOURS = 8;

export const presenceOf = (r: UserAvailabilityRecord | null | undefined): Presence =>
  !r?.isAvailable ? 'off' : r.isOnBreak ? 'break' : 'working';

// (now - check-in) - breaks, with an open break counted up to now (so it freezes while on break).
export function workedSeconds(r: UserAvailabilityRecord | null | undefined, now: number): number {
  if (!r?.isAvailable) return 0;
  let breakMs = 0;
  for (const b of r.breaks ?? []) {
    const end = b.availableAfterBreak ? new Date(b.availableAfterBreak).getTime() : now;
    breakMs += Math.max(0, end - new Date(b.breakStartTime).getTime());
  }
  return Math.max(0, Math.floor((now - new Date(r.availableTime).getTime() - breakMs) / 1000));
}

// 45s → 12m → 1h 23m
export function formatElapsed(secs: number): string {
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
}

export function presenceLabel(r: UserAvailabilityRecord | null | undefined, now: number): string {
  const p = presenceOf(r);
  if (p === 'off') return 'Checked out';
  if (p === 'break') return `On break${r?.breaks?.at(-1)?.breakReason ? ` · ${r.breaks.at(-1)!.breakReason}` : ''}`;
  return `Available · ${formatElapsed(workedSeconds(r, now))}`;
}
