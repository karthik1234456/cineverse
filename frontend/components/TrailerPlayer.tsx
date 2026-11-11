// frontend/components/TrailerPlayer.tsx
'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Subtitles,
  RotateCcw,
  RotateCw,
  X,
  ExternalLink,
  Film,
} from 'lucide-react';
import { useTrailerStore } from '@/store/useTrailerStore';
import { useMovieBackdrop } from '@/context/MovieBackdropContext';
import { useComfortStore } from '@/store/useComfortStore';

function getYoutubeEmbedUrl(url: string): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (/^[\w-]{11}$/.test(trimmed)) {
    return `https://www.youtube-nocookie.com/embed/${trimmed}?autoplay=1&modestbranding=1&rel=0`;
  }
  let videoId = '';
  const match = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  if (match) {
    videoId = match[1];
  } else if (trimmed.includes('embed/')) {
    videoId = trimmed.split('embed/')[1]?.split('?')[0] || '';
  }
  return videoId
    ? `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&modestbranding=1&rel=0`
    : trimmed;
}

export function TrailerPlayer() {
  const activeTrailer = useTrailerStore((s) => s.activeTrailer);
  const captionsAlwaysOn = useComfortStore((s) => s.captionsAlwaysOn);
  const closeTrailer = useTrailerStore((s) => s.closeTrailer);
  const dockTrailer = useTrailerStore((s) => s.dockTrailer);
  const setPlaying = useTrailerStore((s) => s.setPlaying);
  const setMuted = useTrailerStore((s) => s.setMuted);
  const setVolume = useTrailerStore((s) => s.setVolume);
  const setTime = useTrailerStore((s) => s.setTime);
  const setPlaybackRate = useTrailerStore((s) => s.setPlaybackRate);
  const toggleCaptions = useTrailerStore((s) => s.toggleCaptions);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isSaveData = typeof navigator !== 'undefined' && Boolean((navigator as any).connection?.saveData);

  // Sync with MovieBackdrop: pause background video when full trailer modal is open
  const { setTrailerModalOpen } = useMovieBackdrop();
  useEffect(() => {
    setTrailerModalOpen(Boolean(activeTrailer?.isOpen));
    return () => setTrailerModalOpen(false);
  }, [activeTrailer?.isOpen, setTrailerModalOpen]);

  // Sync video play/pause with store
  useEffect(() => {
    if (!videoRef.current || !activeTrailer) return;
    if (activeTrailer.isPlaying && videoRef.current.paused) {
      videoRef.current.play().catch(() => {
        setPlaying(false);
      });
    } else if (!activeTrailer.isPlaying && !videoRef.current.paused) {
      videoRef.current.pause();
    }
  }, [activeTrailer?.isPlaying, setPlaying]);

  // Sync volume and mute
  useEffect(() => {
    if (!videoRef.current || !activeTrailer) return;
    videoRef.current.volume = activeTrailer.volume;
    videoRef.current.muted = activeTrailer.isMuted;
  }, [activeTrailer?.volume, activeTrailer?.isMuted]);

  // Sync playback rate
  useEffect(() => {
    if (!videoRef.current || !activeTrailer) return;
    videoRef.current.playbackRate = activeTrailer.playbackRate;
  }, [activeTrailer?.playbackRate]);

  // Keyboard navigation
  useEffect(() => {
    if (!activeTrailer || !activeTrailer.isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.key === ' ' || e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        if (activeTrailer) setPlaying(!activeTrailer.isPlaying);
      } else if (e.key === 'j' || e.key === 'J' || e.key === 'ArrowLeft') {
        e.preventDefault();
        if (videoRef.current) {
          videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
        }
      } else if (e.key === 'l' || e.key === 'L' || e.key === 'ArrowRight') {
        e.preventDefault();
        if (videoRef.current) {
          videoRef.current.currentTime = Math.min(videoRef.current.duration || 0, videoRef.current.currentTime + 10);
        }
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        if (activeTrailer) setMuted(!activeTrailer.isMuted);
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        toggleCaptions();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (isFullscreen) {
          if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
          setIsFullscreen(false);
        } else {
          closeTrailer();
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTrailer, isFullscreen, closeTrailer, setPlaying, setMuted, toggleCaptions]);

  function toggleFullscreen() {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }

  function handleMouseMove() {
    setControlsVisible(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (activeTrailer?.isPlaying) {
        setControlsVisible(false);
      }
    }, 3500);
  }

  function formatTime(seconds: number) {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  if (!activeTrailer || !activeTrailer.isOpen) return null;

  const hasTrailer = Boolean(activeTrailer.trailerUrl) && !videoError;
  const isDirectVideo = activeTrailer.trailerUrl && (
    activeTrailer.trailerUrl.endsWith('.mp4') ||
    activeTrailer.trailerUrl.endsWith('.webm') ||
    activeTrailer.trailerUrl.endsWith('.ogv') ||
    activeTrailer.trailerUrl.startsWith('/trailers/')
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${activeTrailer.title} Trailer`}
      data-testid="trailer-player-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 sm:p-6"
    >
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        className="relative w-full max-w-5xl rounded-3xl border border-[#E6DCD2] bg-[#0E1117] shadow-2xl overflow-hidden text-white flex flex-col group"
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/10 bg-black/40 backdrop-blur-md z-20">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-[#C8102E] flex items-center justify-center shrink-0">
              <Film className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-white truncate">
                {activeTrailer.title}
              </h2>
              <p className="text-sm text-slate-300">Official Cinematic Trailer</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Dock to Mini Player Button */}
            {hasTrailer && (
              <button
                onClick={dockTrailer}
                data-testid="trailer-dock-button"
                className="flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3.5 py-2 text-sm font-bold text-white hover:bg-white/20 transition min-h-[44px]"
                title="Dock Mini Player while browsing"
                aria-label="Dock Mini Player"
              >
                <Minimize2 className="h-4 w-4" />
                <span className="hidden sm:inline">Dock Player</span>
              </button>
            )}

            {/* Close Button */}
            <button
              onClick={closeTrailer}
              data-testid="trailer-close-button"
              className="rounded-full p-2.5 text-slate-300 hover:bg-white/20 hover:text-white transition min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Close Trailer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Video Canvas Area */}
        <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden">
          {hasTrailer ? (
            isDirectVideo ? (
              <>
                <video
                  ref={videoRef}
                  src={activeTrailer.trailerUrl}
                  playsInline
                  autoPlay={!isSaveData}
                  muted={activeTrailer.isMuted}
                  className="h-full w-full object-contain cursor-pointer"
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
                    setTime(el.currentTime, el.duration);
                  }}
                  onEnded={() => setPlaying(false)}
                  onError={() => setVideoError(true)}
                  data-testid="main-trailer-video"
                />

                {/* Subtitle / WebVTT overlay simulation if enabled */}
                {(activeTrailer.captionsEnabled || captionsAlwaysOn) && (
                  <div className="pointer-events-none absolute bottom-16 left-1/2 -translate-x-1/2 rounded-lg bg-black/80 px-4 py-1.5 text-center text-sm font-medium text-white shadow backdrop-blur-sm">
                    [Soundtrack playing · Audio Dialogue]
                  </div>
                )}
              </>
            ) : (activeTrailer.trailerUrl && (activeTrailer.trailerUrl.includes('youtube') || activeTrailer.trailerUrl.includes('youtu.be') || /^[\w-]{11}$/.test(activeTrailer.trailerUrl.trim()))) ? (
              <iframe
                src={getYoutubeEmbedUrl(activeTrailer.trailerUrl)}
                title={`${activeTrailer.title} Official Trailer`}
                className="h-full w-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
                allowFullScreen
                data-testid="youtube-trailer-iframe"
              />
            ) : (
              <div className="p-8 text-center text-slate-300">
                <p className="text-lg font-bold text-white">Playback Format Unsupported</p>
                <p className="text-sm mt-1">{activeTrailer.trailerUrl}</p>
              </div>
            )
          ) : (
            /* Fallback Poster State when Trailer is Unavailable (Tightening 3) */
            <div className="relative h-full w-full flex flex-col items-center justify-center bg-zinc-950 p-6 text-center" data-testid="trailer-unavailable-fallback">
              {activeTrailer.posterUrl && (
                <div className="absolute inset-0 opacity-25">
                  <img
                    src={activeTrailer.posterUrl}
                    alt={activeTrailer.title}
                    className="h-full w-full object-cover blur-sm"
                  />
                </div>
              )}
              <div className="relative z-10 max-w-md space-y-3 rounded-2xl border border-white/10 bg-black/75 p-6 backdrop-blur-md">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-amber-300">
                  <Film className="h-7 w-7" />
                </div>
                <h3 className="text-xl font-bold text-white">Trailer not available</h3>
                <p className="text-sm text-slate-300">
                  The distributor has not yet published an official streaming preview for this title. You can still proceed to select seats and reserve your tickets.
                </p>
              </div>
            </div>
          )}

          {/* Center Play/Pause Overlay Indicator on click */}
          {hasTrailer && isDirectVideo && (
            <button
              onClick={() => setPlaying(!activeTrailer.isPlaying)}
              className={`absolute flex h-20 w-20 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md transition-all duration-300 ${
                activeTrailer.isPlaying ? 'opacity-0 hover:opacity-100 scale-90' : 'opacity-100 scale-100'
              }`}
              aria-label={activeTrailer.isPlaying ? 'Pause' : 'Play'}
            >
              {activeTrailer.isPlaying ? <Pause className="h-8 w-8" /> : <Play className="h-8 w-8 ml-1 fill-white" />}
            </button>
          )}
        </div>

        {/* Video Player Control Bar (Visible on direct video) */}
        {hasTrailer && isDirectVideo && (
          <div
            className={`transition-opacity duration-300 border-t border-white/10 bg-gradient-to-t from-black/95 to-black/70 p-4 space-y-2 z-20 ${
              controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            data-testid="trailer-player-controls"
          >
            {/* Progress Slider */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-mono font-semibold text-slate-300 min-w-[44px]">
                {formatTime(activeTrailer.currentTime)}
              </span>
              <input
                type="range"
                min={0}
                max={activeTrailer.duration || 100}
                step={0.1}
                value={activeTrailer.currentTime}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (videoRef.current) {
                    videoRef.current.currentTime = val;
                  }
                  setTime(val);
                }}
                className="w-full accent-[#C8102E] cursor-pointer h-2 bg-white/20 rounded-lg appearance-none"
                aria-label="Seek Video Timeline"
              />
              <span className="text-sm font-mono text-slate-400 min-w-[44px]">
                {formatTime(activeTrailer.duration)}
              </span>
            </div>

            {/* Bottom Controls Row */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-3">
                {/* Play / Pause Toggle */}
                <button
                  onClick={() => setPlaying(!activeTrailer.isPlaying)}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
                  aria-label={activeTrailer.isPlaying ? 'Pause Trailer' : 'Play Trailer'}
                  data-testid="trailer-play-pause-btn"
                >
                  {activeTrailer.isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5 fill-white" />}
                </button>

                {/* Seek -10s */}
                <button
                  onClick={() => {
                    if (videoRef.current) {
                      videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
                    }
                  }}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition"
                  title="Rewind 10 seconds (J / Left Arrow)"
                  aria-label="Rewind 10s"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>

                {/* Seek +10s */}
                <button
                  onClick={() => {
                    if (videoRef.current) {
                      videoRef.current.currentTime = Math.min(videoRef.current.duration || 0, videoRef.current.currentTime + 10);
                    }
                  }}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition"
                  title="Forward 10 seconds (L / Right Arrow)"
                  aria-label="Forward 10s"
                >
                  <RotateCw className="h-4 w-4" />
                </button>

                {/* Volume & Mute */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setMuted(!activeTrailer.isMuted)}
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition"
                    aria-label={activeTrailer.isMuted ? 'Unmute Audio' : 'Mute Audio'}
                    data-testid="trailer-mute-btn"
                  >
                    {activeTrailer.isMuted ? <VolumeX className="h-5 w-5 text-rose-400" /> : <Volume2 className="h-5 w-5" />}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={activeTrailer.isMuted ? 0 : activeTrailer.volume}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setVolume(v);
                      if (v > 0 && activeTrailer.isMuted) setMuted(false);
                    }}
                    className="w-16 accent-[#C8102E] cursor-pointer h-1.5 bg-white/20 rounded appearance-none"
                    aria-label="Volume Slider"
                  />
                </div>
              </div>

              {/* Right Side Options */}
              <div className="flex items-center gap-2">
                {/* Speed Dropdown */}
                <select
                  value={activeTrailer.playbackRate}
                  onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
                  data-testid="trailer-speed-btn"
                  className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm font-bold text-white hover:bg-white/20 focus:outline-none min-h-[44px]"
                  aria-label="Playback Speed"
                >
                  <option value={0.75} className="bg-slate-900 text-white">0.75×</option>
                  <option value={1.0} className="bg-slate-900 text-white">1.0× (Normal)</option>
                  <option value={1.25} className="bg-slate-900 text-white">1.25×</option>
                  <option value={1.5} className="bg-slate-900 text-white">1.5×</option>
                  <option value={2.0} className="bg-slate-900 text-white">2.0×</option>
                </select>

                {/* Subtitles / Captions Toggle */}
                <button
                  onClick={toggleCaptions}
                  data-testid="trailer-captions-btn"
                  className={`flex min-h-[44px] items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-bold transition ${
                    activeTrailer.captionsEnabled
                      ? 'border-[#C8102E] bg-[#C8102E] text-white shadow'
                      : 'border-white/20 bg-white/10 text-slate-300 hover:bg-white/20'
                  }`}
                  aria-label="Toggle Subtitles"
                  title="Captions (C)"
                >
                  <Subtitles className="h-4 w-4" />
                  <span className="hidden sm:inline">CC</span>
                </button>

                {/* Fullscreen Button */}
                <button
                  onClick={toggleFullscreen}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-white/20 bg-white/10 text-slate-300 hover:bg-white/20 hover:text-white transition"
                  aria-label="Toggle Fullscreen"
                  title="Fullscreen (F)"
                >
                  <Maximize2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

