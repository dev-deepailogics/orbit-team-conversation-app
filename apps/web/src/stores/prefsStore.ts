import { create } from 'zustand';

// Per-device UI preferences, kept in localStorage.
const KEY = 'orbit_prefs';

export interface TodoPos {
  x: number;
  y: number;
}

interface Prefs {
  showTodoButton: boolean;
  todoPos: TodoPos | null; // null = default (right edge, vertically centred)
}

interface PrefsState extends Prefs {
  setShowTodoButton: (v: boolean) => void;
  setTodoPos: (p: TodoPos | null) => void;
}

const DEFAULTS: Prefs = { showTodoButton: true, todoPos: null };

function read(): Prefs {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(KEY) : null;
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

function write(p: Prefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable */
  }
}

export const usePrefsStore = create<PrefsState>((set, get) => ({
  ...DEFAULTS,
  setShowTodoButton: (showTodoButton) => {
    set({ showTodoButton });
    write({ showTodoButton, todoPos: get().todoPos });
  },
  setTodoPos: (todoPos) => {
    set({ todoPos });
    write({ showTodoButton: get().showTodoButton, todoPos });
  },
}));

// Hydrate after mount so server and client first renders match.
export function hydratePrefs() {
  usePrefsStore.setState(read());
}
