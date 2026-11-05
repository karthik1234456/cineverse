// frontend/store/useTrailerStore.ts
import { create } from 'zustand';

export interface ActiveTrailer {
  movieId?: number | string;
  title: string;
  posterUrl?: string;
  trailerUrl?: string;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  playbackRate: number;
  captionsEnabled: boolean;
  isDocked: boolean;
  isOpen: boolean; // modal open
}

interface TrailerStore {
  activeTrailer: ActiveTrailer | null;
  openTrailer: (params: {
    movieId?: number | string;
    title: string;
    posterUrl?: string;
    trailerUrl?: string;
  }) => void;
  closeTrailer: () => void;
  dockTrailer: () => void;
  undockTrailer: () => void;
  setPlaying: (isPlaying: boolean) => void;
  setMuted: (isMuted: boolean) => void;
  setVolume: (volume: number) => void;
  setTime: (currentTime: number, duration?: number) => void;
  setPlaybackRate: (rate: number) => void;
  toggleCaptions: () => void;
}

function getInitialActiveTrailer(): ActiveTrailer | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem('cineverse_docked_trailer');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.isDocked) return parsed;
    }
  } catch {
    // ignore
  }
  return null;
}

export const useTrailerStore = create<TrailerStore>((set) => ({
  activeTrailer: getInitialActiveTrailer(),

  openTrailer: ({ movieId, title, posterUrl, trailerUrl }) => {
    // Read saved resume position and volume from localStorage if available
    let savedTime = 0;
    let savedVolume = 1.0;
    let savedMuted = false;

    if (typeof window !== 'undefined') {
      try {
        if (movieId) {
          const t = localStorage.getItem(`cineverse_trailer_pos_${movieId}`);
          if (t) savedTime = parseFloat(t) || 0;
        }
        const v = localStorage.getItem('cineverse_trailer_vol');
        if (v) savedVolume = parseFloat(v) || 1.0;
        const m = localStorage.getItem('cineverse_trailer_muted');
        if (m) savedMuted = m === 'true';
      } catch {
        // ignore
      }
    }

    set({
      activeTrailer: {
        movieId,
        title,
        posterUrl,
        trailerUrl,
        currentTime: savedTime,
        duration: 0,
        isPlaying: true,
        isMuted: savedMuted,
        volume: savedVolume,
        playbackRate: 1.0,
        captionsEnabled: true,
        isDocked: false,
        isOpen: true,
      },
    });
  },

  closeTrailer: () => {
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem('cineverse_docked_trailer');
      } catch {
        // ignore
      }
    }
    set((state) => {
      if (state.activeTrailer?.movieId && typeof window !== 'undefined') {
        try {
          localStorage.setItem(
            `cineverse_trailer_pos_${state.activeTrailer.movieId}`,
            state.activeTrailer.currentTime.toString()
          );
        } catch {
          // ignore
        }
      }
      return { activeTrailer: null };
    });
  },

  dockTrailer: () => {
    set((state) => {
      if (!state.activeTrailer) return state;
      const updated = {
        ...state.activeTrailer,
        isDocked: true,
        isOpen: false,
      };
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem('cineverse_docked_trailer', JSON.stringify(updated));
        } catch {
          // ignore
        }
      }
      return {
        activeTrailer: updated,
      };
    });
  },

  undockTrailer: () => {
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem('cineverse_docked_trailer');
      } catch {
        // ignore
      }
    }
    set((state) => {
      if (!state.activeTrailer) return state;
      return {
        activeTrailer: {
          ...state.activeTrailer,
          isDocked: false,
          isOpen: true,
        },
      };
    });
  },

  setPlaying: (isPlaying: boolean) => {
    set((state) => {
      if (!state.activeTrailer) return state;
      return {
        activeTrailer: {
          ...state.activeTrailer,
          isPlaying,
        },
      };
    });
  },

  setMuted: (isMuted: boolean) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('cineverse_trailer_muted', isMuted ? 'true' : 'false');
      } catch {
        // ignore
      }
    }
    set((state) => {
      if (!state.activeTrailer) return state;
      return {
        activeTrailer: {
          ...state.activeTrailer,
          isMuted,
        },
      };
    });
  },

  setVolume: (volume: number) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('cineverse_trailer_vol', volume.toString());
      } catch {
        // ignore
      }
    }
    set((state) => {
      if (!state.activeTrailer) return state;
      return {
        activeTrailer: {
          ...state.activeTrailer,
          volume,
          isMuted: volume === 0,
        },
      };
    });
  },

  setTime: (currentTime: number, duration?: number) => {
    set((state) => {
      if (!state.activeTrailer) return state;
      return {
        activeTrailer: {
          ...state.activeTrailer,
          currentTime,
          duration: duration !== undefined && duration > 0 ? duration : state.activeTrailer.duration,
        },
      };
    });
  },

  setPlaybackRate: (playbackRate: number) => {
    set((state) => {
      if (!state.activeTrailer) return state;
      return {
        activeTrailer: {
          ...state.activeTrailer,
          playbackRate,
        },
      };
    });
  },

  toggleCaptions: () => {
    set((state) => {
      if (!state.activeTrailer) return state;
      return {
        activeTrailer: {
          ...state.activeTrailer,
          captionsEnabled: !state.activeTrailer.captionsEnabled,
        },
      };
    });
  },
}));

