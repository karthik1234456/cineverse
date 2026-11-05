'use client';

import React from 'react';
import { useCinemaStore } from '@/store/useCinemaStore';
import { Volume2, VolumeX, Play, Pause, Film } from 'lucide-react';

export function TrailerControls() {
  const trailer = useCinemaStore((s) => s.trailer);
  const toggleTrailerPlay = useCinemaStore((s) => s.toggleTrailerPlay);
  const toggleTrailerMute = useCinemaStore((s) => s.toggleTrailerMute);

  // Auto-hide in first-person seated mode if desired, but keep accessible in overview/walk
  const hasTrailer = Boolean(trailer.trailerUrl);

  return (
    <div
      data-testid="trailer-controls-hud"
      className="pointer-events-auto fixed bottom-24 left-4 z-30 flex flex-wrap items-center gap-2 rounded-2xl border border-[#E6DCD2] bg-white/95 p-2 shadow-xl backdrop-blur-md text-[#1B1320]"
    >
      <div className="flex items-center gap-2 px-2 text-sm font-bold text-slate-700">
        <Film className="h-4 w-4 text-[#C8102E]" />
        <span className="hidden sm:inline max-w-[180px] truncate">
          {trailer.movieTitle || 'Movie Trailer'}
        </span>
      </div>

      {hasTrailer ? (
        <>
          <button
            onClick={toggleTrailerPlay}
            data-testid="trailer-play-toggle"
            className="flex min-h-[44px] items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
            aria-label={trailer.isPlaying ? 'Pause trailer' : 'Play trailer'}
          >
            {trailer.isPlaying ? (
              <>
                <Pause className="h-4 w-4 text-[#C8102E]" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="h-4 w-4 text-[#C8102E]" />
                <span>Play</span>
              </>
            )}
          </button>

          <button
            onClick={toggleTrailerMute}
            data-testid="trailer-mute-toggle"
            className={`flex min-h-[44px] items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-bold transition shadow-sm ${
              trailer.isMuted
                ? 'bg-[#C8102E] text-white hover:bg-[#A60D26]'
                : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}
            aria-label={trailer.isMuted ? 'Turn sound on' : 'Mute sound'}
          >
            {trailer.isMuted ? (
              <>
                <VolumeX className="h-4 w-4" />
                <span>Tap for Sound</span>
              </>
            ) : (
              <>
                <Volume2 className="h-4 w-4" />
                <span>Sound On</span>
              </>
            )}
          </button>
        </>
      ) : (
        <div className="flex min-h-[44px] items-center px-3 py-1.5 text-xs font-semibold text-amber-800 bg-amber-50 rounded-xl border border-amber-200">
          Trailer not available
        </div>
      )}
    </div>
  );
}

