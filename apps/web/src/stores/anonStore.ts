import { create } from 'zustand';

// Whether the user's own anonymous persona / "You" markers are visible. Hidden by default.
interface AnonState {
  reveal: boolean;
  toggleReveal: () => void;
}

export const useAnonStore = create<AnonState>((set) => ({
  reveal: false,
  toggleReveal: () => set((s) => ({ reveal: !s.reveal })),
}));
