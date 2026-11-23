import type { UserAvailabilityRecord } from '@orbit/types';
import { formatElapsed, presenceLabel, presenceOf, workedSeconds } from '@/features/availability/utils';

const t = (iso: string) => new Date(iso).getTime();
const rec = (over: Partial<UserAvailabilityRecord> = {}): UserAvailabilityRecord => ({
  id: 'a',
  userId: 'u',
  date: '2026-11-23',
  availableTime: '2026-11-23T09:00:00Z',
  totalWorkingMinutes: 0,
  isAvailable: true,
  isOnBreak: false,
  isAutoCheckedOut: false,
  breaks: [],
  ...over,
});

test('presence follows the record flags', () => {
  expect(presenceOf(null)).toBe('off');
  expect(presenceOf(rec({ isAvailable: false }))).toBe('off');
  expect(presenceOf(rec())).toBe('working');
  expect(presenceOf(rec({ isOnBreak: true }))).toBe('break');
});

test('worked time subtracts closed and open breaks', () => {
  const closed = { id: 'b1', availabilityId: 'a', breakReason: 'Lunch', breakDurationMinutes: 30,
    breakStartTime: '2026-11-23T12:00:00Z', availableAfterBreak: '2026-11-23T12:30:00Z' };
  expect(workedSeconds(rec({ breaks: [closed] }), t('2026-11-23T13:00:00Z'))).toBe(3.5 * 3600);

  // On break the clock freezes at the break start.
  const open = { ...closed, id: 'b2', breakStartTime: '2026-11-23T14:00:00Z', availableAfterBreak: null };
  const onBreak = rec({ isOnBreak: true, breaks: [closed, open] });
  expect(workedSeconds(onBreak, t('2026-11-23T15:00:00Z'))).toBe(4.5 * 3600);
  expect(presenceLabel(onBreak, t('2026-11-23T15:00:00Z'))).toBe('On break · Lunch');

  expect(workedSeconds(rec({ isAvailable: false }), t('2026-11-23T15:00:00Z'))).toBe(0);
  // Phone clock behind the check-in time never goes negative.
  expect(workedSeconds(rec(), t('2026-11-23T08:00:00Z'))).toBe(0);
});

test('formatElapsed', () => {
  expect(formatElapsed(45)).toBe('45s');
  expect(formatElapsed(12 * 60)).toBe('12m');
  expect(formatElapsed(83 * 60)).toBe('1h 23m');
});
