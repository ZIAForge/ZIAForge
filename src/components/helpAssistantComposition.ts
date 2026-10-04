import { create } from 'zustand'

/** Window-local, memory-only composition survives navigation without storing questions on disk. */
export const useHelpComposition = create<{
  draft: string; preset: string; revision: number;
  setDraft(text: string): void; setPreset(name: string): void; clearAccepted(revision: number): void;
}>(set => ({
  draft: '', preset: '', revision: 0,
  setDraft: draft => set(state => ({ draft, revision: state.revision + 1 })),
  setPreset: preset => set({ preset }),
  clearAccepted: revision => set(state => state.revision === revision ? { draft: '', revision: state.revision + 1 } : {}),
}))
