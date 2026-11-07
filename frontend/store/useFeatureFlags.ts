import { create } from 'zustand';

export interface FeatureFlags {
  enableGuidedTour: boolean;
  enableSeatCompare: boolean;
  enableShareView: boolean;
  enableSoundPreview: boolean;
  enableVrPreview: boolean;
  enableTicketTransfer: boolean;
}

interface FeatureFlagsState extends FeatureFlags {
  setFlag: (key: keyof FeatureFlags, value: boolean) => void;
  resetAll: () => void;
  initFlags: () => void;
}

const STORAGE_KEY = 'cineverse_feature_flags';

const DEFAULT_FLAGS: FeatureFlags = {
  enableGuidedTour: false,
  enableSeatCompare: false,
  enableShareView: false,
  enableSoundPreview: false,
  enableVrPreview: false,
  enableTicketTransfer: false,
};

export const useFeatureFlags = create<FeatureFlagsState>((set, get) => ({
  ...DEFAULT_FLAGS,

  initFlags: () => {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        set({ ...DEFAULT_FLAGS, ...JSON.parse(stored) });
      }
    } catch {
      // ignore
    }
  },

  setFlag: (key, value) => {
    set({ [key]: value });
    if (typeof localStorage !== 'undefined') {
      const updated = {
        enableGuidedTour: get().enableGuidedTour,
        enableSeatCompare: get().enableSeatCompare,
        enableShareView: get().enableShareView,
        enableSoundPreview: get().enableSoundPreview,
        enableVrPreview: get().enableVrPreview,
        enableTicketTransfer: get().enableTicketTransfer,
        [key]: value,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }
  },

  resetAll: () => {
    set(DEFAULT_FLAGS);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_FLAGS));
    }
  },
}));

