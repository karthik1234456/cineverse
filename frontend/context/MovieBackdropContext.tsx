'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

export interface BackdropMovie {
  id: number;
  slug: string;
  title: string;
  banner_url: string;
  poster_url: string;
  dominant_color?: string | null;
  glimpse_url?: string | null;
  glimpse_webm_url?: string | null;
  glimpse_720p_url?: string | null;
}

interface MovieBackdropContextValue {
  activeMovie: BackdropMovie | null;
  setActiveMovie: (movie: BackdropMovie | null) => void;

  /** Set true while the full-screen trailer modal is open */
  isTrailerModalOpen: boolean;
  setTrailerModalOpen: (open: boolean) => void;

  /** Set true while the 3D auditorium page is mounted (has its own video) */
  isPausedBy3D: boolean;
  setPausedBy3D: (paused: boolean) => void;

  /** User preference: show background video (default true on desktop, false on mobile data) */
  isBgVideoEnabled: boolean;
  setBgVideoEnabled: (enabled: boolean) => void;
}

const MovieBackdropContext = createContext<MovieBackdropContextValue | undefined>(undefined);

function getDefaultBgVideoEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  // Respect Data Saver / slow connection
  const conn = (navigator as any).connection;
  if (conn?.saveData) return false;
  if (conn?.effectiveType === '2g' || conn?.effectiveType === 'slow-2g') return false;
  // Default off on mobile to save battery
  if (typeof window.matchMedia === 'function') {
    const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
    if (isCoarsePointer) return false;
  }
  // Check persisted pref
  try {
    const stored = localStorage.getItem('cineverse_bg_video');
    if (stored !== null) return stored === 'true';
  } catch {/* ignore */}
  return true; // desktop default: on
}

export function MovieBackdropProvider({ children }: { children: React.ReactNode }) {
  const [activeMovie, setActiveMovieRaw] = useState<BackdropMovie | null>(null);
  const [isTrailerModalOpen, setTrailerModalOpen] = useState(false);
  const [isPausedBy3D, setPausedBy3D] = useState(false);
  const [isBgVideoEnabled, setBgVideoEnabledRaw] = useState(true);

  // Hydrate pref on client
  useEffect(() => {
    setBgVideoEnabledRaw(getDefaultBgVideoEnabled());
  }, []);

  const setActiveMovie = useCallback((movie: BackdropMovie | null) => {
    setActiveMovieRaw(movie);
  }, []);

  const setBgVideoEnabled = useCallback((enabled: boolean) => {
    setBgVideoEnabledRaw(enabled);
    try { localStorage.setItem('cineverse_bg_video', String(enabled)); } catch {/* ignore */}
  }, []);

  const value = useMemo<MovieBackdropContextValue>(() => ({
    activeMovie,
    setActiveMovie,
    isTrailerModalOpen,
    setTrailerModalOpen,
    isPausedBy3D,
    setPausedBy3D,
    isBgVideoEnabled,
    setBgVideoEnabled,
  }), [
    activeMovie, setActiveMovie,
    isTrailerModalOpen,
    isPausedBy3D,
    isBgVideoEnabled, setBgVideoEnabled,
  ]);

  return (
    <MovieBackdropContext.Provider value={value}>
      {children}
    </MovieBackdropContext.Provider>
  );
}

export function useMovieBackdrop(): MovieBackdropContextValue {
  const ctx = useContext(MovieBackdropContext);
  if (!ctx) throw new Error('useMovieBackdrop must be used inside MovieBackdropProvider');
  return ctx;
}

