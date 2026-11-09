'use client';

/**
 * MovieBackdrop
 * ─────────────
 * Renders behind all movie / booking pages:
 *   Layer 0: blurred + scaled backdrop image
 *   Layer 1: muted looping glimpse <video>  (480p → 720p on wide screens)
 *   Layer 2: warm ivory overlay tinted with movie's dominant colour
 *
 * Lives in the root layout, stays mounted across Next.js client navigations.
 * Crossfades (~500 ms CSS transition) when the active movie changes.
 * Pauses for: tab-hidden / reduced-motion / data-saver / 3D page / trailer modal.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useMovieBackdrop, BackdropMovie } from '@/context/MovieBackdropContext';
import { useComfortStore } from '@/store/useComfortStore';

// ── helpers ──────────────────────────────────────────────────────────────────

function hexToRgb(hex: string | null | undefined): [number, number, number] {
  if (!hex) return [200, 16, 46]; // crimson fallback
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [200, 16, 46];
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = () => setReduced(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}

function useDataSaver() {
  const [saver, setSaver] = useState(false);
  useEffect(() => {
    const conn = (navigator as any).connection;
    if (!conn) return;
    const check = () => {
      setSaver(conn.saveData || conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g');
    };
    check();
    conn.addEventListener?.('change', check);
    return () => conn.removeEventListener?.('change', check);
  }, []);
  return saver;
}

// ── Persistent video element (never re-mounted) ───────────────────────────────

interface VideoLayerProps {
  movie: BackdropMovie | null;
  shouldPlay: boolean;
  visible: boolean;
}

function VideoLayer({ movie, shouldPlay, visible }: VideoLayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastSlugRef = useRef<string | null>(null);

  // Swap src only when movie slug changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!movie || !movie.glimpse_url) {
      video.pause();
      lastSlugRef.current = null;
      return;
    }
    if (movie.slug !== lastSlugRef.current) {
      lastSlugRef.current = movie.slug;
      video.pause();
      // Update sources
      const mp4 = video.querySelector('source[type="video/mp4"]') as HTMLSourceElement | null;
      const webm = video.querySelector('source[type="video/webm"]') as HTMLSourceElement | null;
      if (mp4) mp4.src = movie.glimpse_url;
      if (webm) webm.src = movie.glimpse_webm_url ?? '';
      video.load();
    }
  }, [movie]);

  // Play / pause control
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !movie?.glimpse_url) return;
    if (shouldPlay) {
      video.play().catch(() => {/* autoplay blocked; silently ignore */});
    } else {
      video.pause();
    }
  }, [shouldPlay, movie]);

  // Pause on tab hidden
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handleVisibility = () => {
      if (document.hidden) video.pause();
      else if (shouldPlay) video.play().catch(() => {});
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [shouldPlay]);

  return (
    <video
      ref={videoRef}
      data-testid="movie-backdrop-video"
      className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
      style={{ opacity: visible && movie?.glimpse_url ? 0.6 : 0 }}
      muted
      loop
      playsInline
      autoPlay={false}
      disablePictureInPicture
      preload="none"
      aria-hidden="true"
    >
      <source type="video/webm" src="" />
      <source type="video/mp4" src="" />
    </video>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function MovieBackdrop() {
  const {
    activeMovie,
    isTrailerModalOpen,
    isPausedBy3D,
    isBgVideoEnabled,
    setBgVideoEnabled,
  } = useMovieBackdrop();

  const reducedMotion = useReducedMotion();
  const dataSaver = useDataSaver();
  const simpleMode = useComfortStore((s) => s.simpleMode);
  const comfortReducedMotion = useComfortStore((s) => s.reducedMotion);

  // Crossfade: we keep "displayed" and "incoming" movies to animate between them
  const [displayedMovie, setDisplayedMovie] = useState<BackdropMovie | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!activeMovie) {
      setVisible(false);
      const t = setTimeout(() => setDisplayedMovie(null), 500);
      return () => clearTimeout(t);
    }
    if (activeMovie.id !== displayedMovie?.id) {
      // fade out briefly then swap
      setVisible(false);
      const t = setTimeout(() => {
        setDisplayedMovie(activeMovie);
        setVisible(true);
      }, 150);
      return () => clearTimeout(t);
    }
    setVisible(true);
  }, [activeMovie]); // eslint-disable-line react-hooks/exhaustive-deps

  const videoShouldPlay =
    visible &&
    isBgVideoEnabled &&
    !reducedMotion &&
    !comfortReducedMotion &&
    !simpleMode &&
    !dataSaver &&
    !isTrailerModalOpen &&
    !isPausedBy3D;

  const [r, g, b] = hexToRgb(displayedMovie?.dominant_color);

  if (!displayedMovie && !visible) return null;

  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
        style={{ transition: 'opacity 500ms ease' }}
      >
        {/* Layer 0: blurred backdrop image */}
        {displayedMovie?.banner_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={displayedMovie.slug}
            src={displayedMovie.banner_url}
            alt=""
            className={`absolute inset-0 w-full h-full object-cover ${
              !reducedMotion && !comfortReducedMotion ? 'ambient-still-pan' : ''
            }`}
            style={{
              filter: 'blur(20px) saturate(1.1)',
              opacity: visible ? 1 : 0,
              transition: 'opacity 500ms ease',
            }}
            draggable={false}
          />
        )}

        {/* Layer 1: muted looping glimpse */}
        {!reducedMotion && !dataSaver && (
          <VideoLayer
            movie={displayedMovie}
            shouldPlay={videoShouldPlay}
            visible={visible}
          />
        )}

        {/* Layer 2: warm ivory tint overlay */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(
              135deg,
              rgba(255,248,241,0.90) 0%,
              rgba(${r},${g},${b},0.08) 50%,
              rgba(255,248,241,0.88) 100%
            )`,
            opacity: visible ? 1 : 0,
            transition: 'opacity 500ms ease',
          }}
        />
      </div>

      {/* Background video toggle button (accessible control) */}
      {!reducedMotion && !dataSaver && displayedMovie?.glimpse_url && visible && (
        <button
          type="button"
          data-testid="bg-video-toggle-btn"
          aria-label={isBgVideoEnabled ? 'Pause background video' : 'Play background video'}
          title={isBgVideoEnabled ? 'Pause background video' : 'Play background video'}
          onClick={() => setBgVideoEnabled(!isBgVideoEnabled)}
          className="fixed bottom-4 left-4 z-20 rounded-full bg-black/40 p-2.5 text-white/90 hover:bg-black/60 hover:text-white transition focus:outline-none focus:ring-2 focus:ring-[#C8102E] shadow-md cursor-pointer"
          style={{ backdropFilter: 'blur(6px)' }}
        >
          {isBgVideoEnabled ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
      )}
    </>
  );
}

