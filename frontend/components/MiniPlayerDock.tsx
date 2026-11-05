// frontend/components/MiniPlayerDock.tsx
'use client';

import React, { useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize2, X } from 'lucide-react';
import { useTrailerStore } from '@/store/useTrailerStore';

export function MiniPlayerDock() {
  const activeTrailer = useTrailerStore((s) => s.activeTrailer);
  const undockTrailer = useTrailerStore((s) => s.undockTrailer);
  const closeTrailer = useTrailerStore((s) => s.closeTrailer);
  const setPlaying = useTrailerStore((s) => s.setPlaying);
  const setMuted = useTrailerStore((s) => s.setMuted);
  const setTime = useTrailerStore((s) => s.setTime);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Sync play/pause with video element in docked mode
  useEffect(() => {
    if (!videoRef.current || !activeTrailer || !activeTrailer.isDocked) return;
    if (activeTrailer.isPlaying && videoRef.current.paused) {
      videoRef.current.play().catch(() => setPlaying(false));
    } else if (!activeTrailer.isPlaying && !videoRef.current.paused) {
      videoRef.current.pause();
    }
  }, [activeTrailer?.isPlaying, activeTrailer?.isDocked, setPlaying]);

  useEffect(() => {
    if (!videoRef.current || !activeTrailer || !activeTrailer.isDocked) return;
    videoRef.current.muted = activeTrailer.isMuted;
    videoRef.current.volume = activeTrailer.volume;
  }, [activeTrailer?.isMuted, activeTrailer?.volume, activeTrailer?.isDocked]);

  if (!activeTrailer || !activeTrailer.isDocked || !activeTrailer.trailerUrl) {
    return null;
  }

  return (
    <aside
      aria-label="Picture-in-picture Trailer Mini Player"
      data-testid="mini-player-dock"
      className="fixed bottom-6 right-6 z-50 w-72 sm:w-80 rounded-3xl border-2 border-[#E6DCD2] bg-white p-3 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-5 fade-in duration-300"
    >
      {/* Video Container */}
      <div className="relative aspect-video w-full rounded-2xl bg-black overflow-hidden group shadow-inner">
        <video
          ref={videoRef}
          src={activeTrailer.trailerUrl}
          playsInline
          autoPlay
          muted={activeTrailer.isMuted}
          className="h-full w-full object-cover cursor-pointer"
          onClick={() => setPlaying(!activeTrailer.isPlaying)}
          onTimeUpdate={(e) => {
            const el = e.currentTarget;
            setTime(el.currentTime, el.duration);
          }}
          onLoadedMetadata={(e) => {
            const el = e.currentTarget;
            if (activeTrailer.currentTime > 0) {
              el.currentTime = activeTrailer.currentTime;
            }
          }}
          onEnded={() => setPlaying(false)}
        />

        {/* Hover Overlay Controls */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
          <button
            onClick={() => setPlaying(!activeTrailer.isPlaying)}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-[#1B1320] shadow hover:bg-white transition"
            aria-label={activeTrailer.isPlaying ? 'Pause' : 'Play'}
          >
            {activeTrailer.isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5 fill-[#1B1320]" />}
          </button>
        </div>
      </div>

      {/* Dock Bottom Info & Actions */}
      <div className="mt-2.5 flex items-center justify-between gap-2 px-1">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-black text-[#1B1320] truncate">
            {activeTrailer.title}
          </div>
          <div className="text-sm text-slate-500 font-medium">Trailer Playing</div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Mute Toggle */}
          <button
            onClick={() => setMuted(!activeTrailer.isMuted)}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-600 hover:text-[#1B1320] hover:bg-[#FDEBD8] transition"
            aria-label={activeTrailer.isMuted ? 'Unmute' : 'Mute'}
            data-testid="mini-player-mute-btn"
          >
            {activeTrailer.isMuted ? <VolumeX className="h-4 w-4 text-rose-600" /> : <Volume2 className="h-4 w-4" />}
          </button>

          {/* Expand / Undock to Full Modal */}
          <button
            onClick={undockTrailer}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-600 hover:text-[#1B1320] hover:bg-[#FDEBD8] transition"
            title="Expand Full Trailer"
            aria-label="Expand Full Trailer"
            data-testid="mini-player-expand-button"
          >
            <Maximize2 className="h-4 w-4" />
          </button>

          {/* Close */}
          <button
            onClick={closeTrailer}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-600 hover:text-[#C8102E] hover:bg-rose-50 transition"
            title="Close Trailer"
            aria-label="Close Trailer"
            data-testid="mini-player-close-button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

