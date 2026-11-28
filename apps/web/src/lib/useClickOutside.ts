import { RefObject, useEffect, useRef } from 'react';

/** While `active`, calls `onOutside` when a mousedown lands outside `ref` (e.g. to close a dropdown). */
export function useClickOutside(ref: RefObject<HTMLElement | null>, active: boolean, onOutside: () => void) {
  // Latest callback, so callers can pass an inline function without re-attaching the listener every render
  const callback = useRef(onOutside);
  callback.current = onOutside;

  useEffect(() => {
    if (!active) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) callback.current();
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [ref, active]);
}
