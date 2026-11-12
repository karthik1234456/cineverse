'use client';

import React, { useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Film, ChevronDown, Sparkles, ExternalLink, X, AlertCircle, Loader2 } from 'lucide-react';
import { useCinemaStore } from '@/store/useCinemaStore';
import { useTrailerStore } from '@/store/useTrailerStore';

export interface MovieClipOption {
  id: string;
  label: string;
  url: string;
  isHd?: boolean;
}

const SAMPLE_HOSTED_CLIPS: MovieClipOption[] = [
  { id: 'trailer_main', label: 'Official Trailer (Hosted)', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', isHd: true },
  { id: 'clip_teaser', label: 'Teaser Clip', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', isHd: true },
  { id: 'clip_action', label: 'Action Sequence Clip', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', isHd: false },
];

export function ScreenMediaCluster() {
  const trailer = useCinemaStore((s) => s.trailer);
  const setTrailer = useCinemaStore((s) => s.setTrailerState);
  const toggleTrailerPlay = useCinemaStore((s) => s.toggleTrailerPlay);
  const toggleTrailerMute = useCinemaStore((s) => s.toggleTrailerMute);
  const openTrailer = useTrailerStore((s) => s.openTrailer);

  const [isMinimized, setIsMinimized] = useState(false);
  const [showClipMenu, setShowClipMenu] = useState(false);
  const [qualityMode, setQualityMode] = useState<'HD' | 'Auto'>('Auto');
  const [volumeLevel, setVolumeLevel] = useState(80);

  const activeStrategy = trailer.activeStrategy || 'title_card';
  const playbackStatus = trailer.playbackStatus || 'loading';

  const isVideoTexture = activeStrategy === 'video_texture';
  const isYouTubeCSS3D = activeStrategy === 'youtube_css3d';
  const isTitleCard = activeStrategy === 'title_card' || activeStrategy === 'backdrop_motion';

  const handleSelectClip = (clip: MovieClipOption) => {
    setShowClipMenu(false);
    setTrailer({
      trailerUrl: clip.url,
      isPlaying: true,
      isMuted: trailer.isMuted,
      activeStrategy: 'video_texture',
      playbackStatus: 'loading',
    });
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setVolumeLevel(val);
    const vid = (window as any).__cineverse_video as HTMLVideoElement | undefined;
    if (vid) {
      vid.volume = val / 100;
      if (val > 0 && trailer.isMuted) {
        toggleTrailerMute();
      }
    }
  };

  const handleOpenPopup = () => {
    openTrailer({
      movieId: 1,
      title: trailer.movieTitle || 'Movie Trailer',
      posterUrl: trailer.posterUrl || '',
      trailerUrl: trailer.trailerUrl || '',
    });
  };

  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        data-testid="restore-media-cluster-btn"
        className="pointer-events-auto fixed bottom-24 left-4 z-30 flex h-11 w-11 items-center justify-center rounded-2xl border border-white/20 bg-[#12161f]/90 text-white shadow-xl backdrop-blur-md hover:bg-[#1a202c] transition"
        title="Open Screen Media Controls"
        aria-label="Open Screen Media Controls"
      >
        <Film className="h-5 w-5 text-rose-500" />
      </button>
    );
  }

  // Determine true status indicator
  const getStatusBadge = () => {
    if (playbackStatus === 'loading') {
      return (
        <span className="flex items-center gap-1 text-[11px] font-semibold text-sky-400">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Loading...</span>
        </span>
      );
    }
    if (playbackStatus === 'playing') {
      return (
        <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Playing on Screen</span>
        </span>
      );
    }
    if (playbackStatus === 'paused') {
      return (
        <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-400">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          <span>Paused</span>
        </span>
      );
    }
    if (playbackStatus === 'blocked') {
      return (
        <span className="flex items-center gap-1 text-[11px] font-semibold text-rose-400">
          <AlertCircle className="h-3 w-3 text-rose-400" />
          <span>Autoplay Blocked</span>
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-400">
        <span>Title Card Motion</span>
      </span>
    );
  };

  return (
    <div
      data-testid="trailer-controls-hud"
      className="pointer-events-auto fixed bottom-24 left-4 z-30 flex flex-col gap-2 rounded-2xl border border-white/15 bg-[#0f131a]/95 p-3 shadow-2xl backdrop-blur-lg text-white max-w-sm sm:max-w-md"
    >
      {/* Header bar: Movie clip label + minimize */}
      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-2">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-200 truncate">
          <Film className="h-4 w-4 text-rose-500 shrink-0" />
          <span className="truncate">{trailer.movieTitle || 'Screen Experience'}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0" data-testid="screen-playback-status-badge">
          {/* True Status Pill */}
          {getStatusBadge()}

          {/* Minimize button */}
          <button
            onClick={() => setIsMinimized(true)}
            data-testid="close-media-cluster-btn"
            className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white transition"
            title="Minimize media controls"
            aria-label="Minimize media controls"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Main control row */}
      {isVideoTexture ? (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {/* Play/Pause */}
          <button
            onClick={toggleTrailerPlay}
            data-testid="trailer-play-toggle"
            className="flex min-h-[38px] items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 px-3 py-1.5 text-xs font-bold transition"
            aria-label={trailer.isPlaying ? 'Pause trailer' : 'Play trailer'}
          >
            {trailer.isPlaying && playbackStatus === 'playing' ? (
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

          {/* Mute / Tap for sound */}
          <button
            onClick={toggleTrailerMute}
            data-testid="trailer-mute-toggle"
            className={`flex min-h-[38px] items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition shadow ${
              trailer.isMuted
                ? 'bg-rose-600 text-white hover:bg-rose-500 ring-2 ring-rose-400/50'
                : 'bg-emerald-600 text-white hover:bg-emerald-500'
            }`}
            aria-label={trailer.isMuted ? 'Turn sound on' : 'Mute sound'}
          >
            {trailer.isMuted ? (
              <>
                <VolumeX className="h-3.5 w-3.5" />
                <span>Tap for Sound</span>
              </>
            ) : (
              <>
                <Volume2 className="h-3.5 w-3.5" />
                <span>Sound On</span>
              </>
            )}
          </button>

          {/* Volume slider */}
          <div className="flex items-center gap-1.5 pl-1" data-testid="volume-slider-container">
            <input
              type="range"
              min="0"
              max="100"
              value={trailer.isMuted ? 0 : volumeLevel}
              onChange={handleVolumeChange}
              data-testid="volume-slider"
              className="w-16 sm:w-20 accent-rose-500 h-1.5 bg-white/20 rounded-lg cursor-pointer"
              aria-label="Volume Level"
            />
          </div>

          {/* Change video clip dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowClipMenu((v) => !v)}
              data-testid="change-video-clip-btn"
              className="flex min-h-[38px] items-center gap-1 rounded-xl bg-white/10 hover:bg-white/20 px-2.5 py-1.5 text-xs font-semibold text-slate-300 transition"
              title="Change Movie Clip"
            >
              <span>Clips</span>
              <ChevronDown className="h-3 w-3" />
            </button>

            {showClipMenu && (
              <div
                data-testid="clips-dropdown-menu"
                className="absolute bottom-full left-0 mb-2 w-52 rounded-2xl border border-white/20 bg-[#161b26] p-1.5 shadow-2xl backdrop-blur-xl z-40 space-y-1"
              >
                <div className="px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Select Movie Clip
                </div>
                {SAMPLE_HOSTED_CLIPS.map((clip) => (
                  <button
                    key={clip.id}
                    onClick={() => handleSelectClip(clip)}
                    data-testid={`select-clip-${clip.id}`}
                    className="w-full text-left rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-rose-600 hover:text-white transition flex items-center justify-between"
                  >
                    <span>{clip.label}</span>
                    {clip.isHd && <span className="text-[9px] bg-white/20 px-1 rounded font-black">HD</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Title Card / Backdrop Mode / YouTube Fallback (Prompt Item 4) */
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-col">
            <span className="text-xs text-slate-300 font-medium">
              {isTitleCard
                ? 'Dynamic Title Card & Light Sweep Active'
                : '3D Screen Active'}
            </span>
            <span className="text-[11px] text-slate-400">
              {trailer.trailerUrl ? 'High-definition theatrical trailer available.' : 'Now showing in selected theatres.'}
            </span>
          </div>

          {trailer.trailerUrl && (
            <button
              type="button"
              onClick={handleOpenPopup}
              data-testid="watch-trailer-popup-btn"
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 px-3.5 py-2 text-xs font-bold text-white shadow-lg shadow-red-600/30 hover:from-red-500 hover:to-rose-500 transition cursor-pointer"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>Watch trailer</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
