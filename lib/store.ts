import { create } from "zustand";

export const VIEW_IDS = [
  "overview",
  "globe",
  "timeline",
  "wall",
  "heatmap",
  "boards",
  "buzzwords",
] as const;

export type ViewId = (typeof VIEW_IDS)[number];

interface UiState {
  view: ViewId;
  setView: (view: ViewId) => void;
}

export const useUi = create<UiState>((set) => ({
  view: "overview",
  setView: (view) => set({ view }),
}));
