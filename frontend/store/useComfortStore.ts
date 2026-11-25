import { create } from 'zustand';

export type TextSize = 100 | 125 | 150;

export interface ComfortSettings {
  textSize: TextSize;
  highContrast: boolean;
  reducedMotion: boolean;
  captionsAlwaysOn: boolean;
  simpleMode: boolean;
}

interface ComfortState extends ComfortSettings {
  setTextSize: (size: TextSize) => void;
  setHighContrast: (enabled: boolean) => void;
  setReducedMotion: (enabled: boolean) => void;
  setCaptionsAlwaysOn: (enabled: boolean) => void;
  setSimpleMode: (enabled: boolean) => void;
  initSettings: () => void;
}

const STORAGE_KEY = 'cineverse_comfort_settings';

function applyDomClasses(s: ComfortSettings) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  // Text size
  root.classList.remove('text-size-100', 'text-size-125', 'text-size-150');
  root.classList.add(`text-size-${s.textSize}`);

  // High contrast
  if (s.highContrast) {
    root.classList.add('high-contrast');
  } else {
    root.classList.remove('high-contrast');
  }

  // Reduced motion
  if (s.reducedMotion) {
    root.classList.add('reduced-motion');
  } else {
    root.classList.remove('reduced-motion');
  }

  // Simple mode (hides 3D, background video glimpse, extras)
  if (s.simpleMode) {
    root.classList.add('simple-mode');
  } else {
    root.classList.remove('simple-mode');
  }
}

export const useComfortStore = create<ComfortState>((set, get) => ({
  textSize: 100,
  highContrast: false,
  reducedMotion: false,
  captionsAlwaysOn: false,
  simpleMode: false,

  initSettings: () => {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: Partial<ComfortSettings> = JSON.parse(stored);
        const settings: ComfortSettings = {
          textSize: parsed.textSize === 125 || parsed.textSize === 150 ? parsed.textSize : 100,
          highContrast: Boolean(parsed.highContrast),
          reducedMotion: Boolean(parsed.reducedMotion),
          captionsAlwaysOn: Boolean(parsed.captionsAlwaysOn),
          simpleMode: Boolean(parsed.simpleMode),
        };
        set(settings);
        applyDomClasses(settings);
        return;
      }
    } catch {
      // ignore JSON parse errors
    }
    // Default to OS reduced motion if set
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      set({ reducedMotion: true });
      applyDomClasses({ ...get(), reducedMotion: true });
    }
  },

  setTextSize: (textSize) => {
    set({ textSize });
    const current = { ...get(), textSize };
    applyDomClasses(current);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    }
  },

  setHighContrast: (highContrast) => {
    set({ highContrast });
    const current = { ...get(), highContrast };
    applyDomClasses(current);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    }
  },

  setReducedMotion: (reducedMotion) => {
    set({ reducedMotion });
    const current = { ...get(), reducedMotion };
    applyDomClasses(current);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    }
  },

  setCaptionsAlwaysOn: (captionsAlwaysOn) => {
    set({ captionsAlwaysOn });
    const current = { ...get(), captionsAlwaysOn };
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    }
  },

  setSimpleMode: (simpleMode) => {
    set({ simpleMode });
    const current = { ...get(), simpleMode };
    applyDomClasses(current);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    }
  },
}));

