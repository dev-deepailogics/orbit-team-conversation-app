import { useEffect, useState } from 'react';
import { useAvailabilityStore } from '../store';

// Server-corrected "now" that re-renders every 30s while `active` (worked time is shown in minutes).
export function useServerNow(active: boolean): number {
  const offsetMs = useAvailabilityStore(s => s.offsetMs);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [active]);
  return now + offsetMs;
}
