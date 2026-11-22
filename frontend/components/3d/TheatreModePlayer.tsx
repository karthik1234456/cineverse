'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  ArrowLeft,
  X,
  Film,
  Sparkles,
} from 'lucide-react';
import { useCinemaStore } from '@/store/useCinemaStore';

function getYouTubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;
  const m = trimmed.match(/(?:youtu\.be\/|(?:youtube\.com|youtube-nocookie\.com)\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
  return m ? m[1] : null;
}

export function TheatreModePlayer() {
  const theatreModeOpen = useCinemaStore((s) => s.theatreModeOpen);
  const setTheatreModeOpen = useCinemaStore((s) => s.setTheatreModeOpen);
  const trailer = useCinemaStore((s) => s.trailer);
  const setTrailerState = useCinemaStore((s) => s.setTrailerState);
  const setHouseLights = useCinemaStore((s) => s.setHouseLights);

  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(80);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const frameRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const youtubeId = getYouTubeId(trailer.trailerUrl);
  const isHosted = Boolean(
    trailer.trailerUrl &&
      (trailer.trailerUrl.endsWith('.mp4') ||
        trailer.trailerUrl.endsWith('.webm') ||
        trailer.trailerUrl.startsWith('/trailers/') ||
        trailer.trailerUrl.includes('googleapis.com'))
  );

  const handleClose = useCallback(() => {
    setTheatreModeOpen(false);
    setTrailerState({
      isTheatreMode: false,
      isPlaying: false,
      playbackStatus: 'ready',
    });
    setHouseLights('full');
  }, [setTheatreModeOpen, setTrailerState, setHouseLights]);

  // Synchronize playback status on open (§ Part 1, 2)
  useEffect(() => {
    if (theatreModeOpen) {
      setTrailerState({
        isTheatreMode: true,
        isPlaying: true,
        playbackStatus: 'playing',
      });
      setHouseLights('dim');
    }
  }, [theatreModeOpen, setTrailerState, setHouseLights]);

  // Keyboard navigation inside Theatre Mode
  useEffect(() => {
    if (!theatreModeOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === 'Escape' || e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        handleClose();
      } else if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        setIsMuted((m) => !m);
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [theatreModeOpen, handleClose]);

  const toggleFullscreen = () => {
    if (!frameRef.current) return;
    if (!document.fullscreenElement) {
      frameRef.current.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  if (!theatreModeOpen) return null;

  return (
    <div
      data-testid="theatre-mode-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-3 sm:p-6 animate-fadeIn"
      role="dialog"
      aria-label="Theatre Mode Trailer Player"
    >
      {/* Cinema Screen Frame (§ Part A: 85% viewport width, controls outside picture) */}
      <div
        ref={frameRef}
        data-testid="theatre-mode-cinema-frame"
        className="relative flex flex-col w-[85vw] max-w-7xl max-h-[92vh] rounded-2xl border-2 border-slate-700/80 bg-[#090b10] shadow-[0_0_80px_rgba(200,16,46,0.25)] overflow-hidden"
      >
        {/* Top Header Bar */}
        <header className="flex h-12 items-center justify-between border-b border-white/10 bg-[#0e131d]/90 px-4 py-2">
          {/* Back to 3D Button */}
          <button
            onClick={handleClose}
            data-testid="theatre-mode-back-btn"
            className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/15 transition active:scale-95"
            aria-label="Back to 3D Hall"
          >
            <ArrowLeft className="h-4 w-4 text-rose-500" />
            <span>Back to 3D Hall</span>
          </button>

          {/* Movie Title & Badge */}
          <div className="flex items-center gap-2 text-xs font-bold text-white overflow-hidden">
            <Film className="h-4 w-4 text-rose-500 shrink-0" />
            <span className="truncate">{trailer.movieTitle || 'Theatrical Trailer'}</span>
            <span className="shrink-0 rounded-full bg-rose-600/20 border border-rose-500/40 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-rose-400">
              Theatre Mode
            </span>
          </div>

          {/* Close button */}
          <button
            onClick={handleClose}
            data-testid="theatre-mode-close-btn"
            className="rounded-xl p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition"
            aria-label="Close Theatre Mode"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Video / Player Area */}
        <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden">
          {isHosted ? (
            <video
              ref={videoRef}
              data-testid="theatre-mode-video-element"
              src={trailer.trailerUrl}
              autoPlay
              playsInline
              loop
              controls
              muted={isMuted}
              className="w-full h-full object-contain"
            />
          ) : youtubeId ? (
            <iframe
              ref={iframeRef}
              data-testid="theatre-mode-youtube-iframe"
              src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&enablejsapi=1&rel=0&modestbranding=1&playsinline=1`}
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <Sparkles className="h-10 w-10 text-rose-500 mb-2 animate-pulse" />
              <p className="text-sm font-bold text-white mb-1">
                {trailer.movieTitle || 'Theatrical Presentation'}
              </p>
              <p className="text-xs text-slate-400">
                Playing preview on the cinema auditorium screen.
              </p>
            </div>
          )}
        </div>

        {/* Bottom Control Bar */}
        <footer className="flex flex-wrap items-center justify-between border-t border-white/10 bg-[#0e131d]/95 px-4 py-2.5 text-white">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsPlaying((p) => !p)}
              data-testid="theatre-mode-play-pause-btn"
              className="flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 px-3 py-1.5 text-xs font-bold transition"
            >
              {isPlaying ? (
                <>
                  <Pause className="h-3.5 w-3.5 text-rose-400" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 text-rose-400" />
                  <span>Play</span>
                </>
              )}
            </button>

            <button
              onClick={() => setIsMuted((m) => !m)}
              data-testid="theatre-mode-mute-btn"
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition shadow ${
                isMuted
                  ? 'bg-rose-600 text-white hover:bg-rose-500'
                  : 'bg-emerald-600 text-white hover:bg-emerald-500'
              }`}
            >
              {isMuted ? (
                <>
                  <VolumeX className="h-3.5 w-3.5" />
                  <span>Unmute</span>
                </>
              ) : (
                <>
                  <Volume2 className="h-3.5 w-3.5" />
                  <span>Sound On</span>
                </>
              )}
            </button>

            <div className="flex items-center gap-1.5 pl-1">
              <input
                type="range"
                min="0"
                max="100"
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setVolume(val);
                  if (val > 0 && isMuted) setIsMuted(false);
                  if (videoRef.current) {
                    videoRef.current.volume = val / 100;
                  }
                }}
                className="w-20 accent-rose-500 h-1.5 bg-white/20 rounded-lg cursor-pointer"
                aria-label="Volume Level"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleFullscreen}
              data-testid="theatre-mode-fullscreen-btn"
              className="flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 px-3 py-1.5 text-xs font-bold transition text-slate-300 hover:text-white"
              title="Fullscreen"
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Exit Fullscreen</span>
                </>
              ) : (
                <>
                  <Maximize2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Fullscreen</span>
                </>
              )}
            </button>

            <button
              onClick={handleClose}
              data-testid="theatre-mode-done-btn"
              className="rounded-xl bg-gradient-to-r from-red-600 to-rose-600 px-4 py-1.5 text-xs font-bold text-white shadow hover:from-red-500 hover:to-rose-500 transition"
            >
              Return to 3D View
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
