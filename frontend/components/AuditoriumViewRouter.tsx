'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SeatMap2D } from '@/components/2d/SeatMap2D';
import { AuditoriumExperience } from '@/components/3d/AuditoriumExperience';
import { useCinemaStore } from '@/store/useCinemaStore';
import { getShowtimeSeats, type ShowtimeSeatsResponse } from '@/services/api';
import { LayoutGrid, Maximize2, Minimize2, ArrowLeft } from 'lucide-react';
import { useMovieBackdrop } from '@/context/MovieBackdropContext';
import { useComfortStore } from '@/store/useComfortStore';

interface AuditoriumViewRouterProps {
  cinemaId: string;
  auditoriumId: string;
  showtimeId: string;
  initialMode?: '2d' | '3d';
}

export function AuditoriumViewRouter({
  cinemaId,
  auditoriumId,
  showtimeId,
  initialMode,
}: AuditoriumViewRouterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const modeParam = searchParams.get('mode');
  const seatParam = searchParams.get('seat');

  // Default is 2D seat map per Phase 4 requirement; mode=3d or mode=pov switches to 3D
  const [currentMode, setCurrentMode] = useState<'2d' | '3d'>(
    (modeParam === '3d' || modeParam === 'pov' || initialMode === '3d') ? '3d' : '2d'
  );
  const simpleMode = useComfortStore((s) => s.simpleMode);
  const is3DActive = currentMode === '3d' && !simpleMode;

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showtimeDetails, setShowtimeDetails] = useState<ShowtimeSeatsResponse | null>(null);
  const { setActiveMovie, setPausedBy3D } = useMovieBackdrop();

  // Sync 3D active state to pause background video when 3D theatre canvas is active
  useEffect(() => {
    setPausedBy3D(is3DActive);
    return () => setPausedBy3D(false);
  }, [is3DActive, setPausedBy3D]);

  useEffect(() => {
    getShowtimeSeats(showtimeId)
      .then((data) => {
        setShowtimeDetails(data);
        if (data) {
          setActiveMovie({
            id: data.movie_id,
            slug: (data as any).slug || `movie-${data.movie_id}`,
            title: data.movie_title,
            banner_url: data.banner_url || data.poster_url || '',
            poster_url: data.poster_url || '',
            dominant_color: data.dominant_color ?? null,
            glimpse_url: data.glimpse_url ?? null,
            glimpse_webm_url: data.glimpse_webm_url ?? null,
            glimpse_720p_url: data.glimpse_720p_url ?? null,
          });
        }
      })
      .catch((err) => console.warn('Router showtime details fetch notice:', err));
  }, [showtimeId, setActiveMovie]);

  const has3D = true;

  useEffect(() => {
    if (modeParam === '3d' || modeParam === 'pov') {
      setCurrentMode('3d');
      if (modeParam === 'pov') {
        const isValid = seatParam && /^[A-J](0[1-9]|10)$/i.test(seatParam.trim());
        if (isValid) {
          const upperSeat = seatParam!.trim().toUpperCase();
          useCinemaStore.getState().sitAt(upperSeat);
        } else {
          useCinemaStore.getState().setMode('overview');
        }
      }
    } else if (modeParam === '2d') {
      setCurrentMode('2d');
    }
  }, [modeParam, seatParam]);

  // Fullscreen state listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Global 'F' key toggle for fullscreen (Part E Requirement)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullScreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  function toggleFullScreen() {
    if (typeof document === 'undefined') return;
    if (!document.fullscreenElement) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => { });
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => { });
      }
    }
  }

  function handleSwitchTo3D() {
    setCurrentMode('3d');
    const params = new URLSearchParams(window.location.search);
    params.set('mode', '3d');
    router.replace(`?${params.toString()}`);
  }

  function handleSwitchToPOV(seatId: string) {
    useCinemaStore.getState().sitAt(seatId);
    setCurrentMode('3d');
    const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    params.set('mode', 'pov');
    params.set('seat', seatId);
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleSwitchTo2D() {
    setCurrentMode('2d');
    const params = new URLSearchParams(window.location.search);
    params.set('mode', '2d');
    router.replace(`?${params.toString()}`);
  }

  if (is3DActive) {
    return (
      <div className="relative h-[100dvh] w-full overflow-hidden" data-testid="auditorium-3d-wrapper">
        {/* Slim Immersive Top Bar (§ Part E / Finding F8 fixed) */}
        <header className="fixed top-0 left-0 right-0 z-40 flex h-14 items-center justify-between border-b border-[#E6DCD2]/80 bg-white/95 px-4 shadow-sm backdrop-blur-md">
          {/* Left: Back to 2D */}
          <button
            onClick={handleSwitchTo2D}
            data-testid="switch-to-2d-button"
            id="back-to-seat-map-btn"
            className="flex min-h-[44px] items-center gap-2 rounded-xl border border-[#E6DCD2] bg-white px-4 py-2 text-sm font-bold text-[#1B1320] shadow-sm hover:bg-slate-50 transition active:scale-95"
            aria-label="Back to seat map"
          >
            <ArrowLeft className="h-4 w-4 text-[#C8102E]" />
            <span className="font-bold">Back to seat map</span>
          </button>

          {/* Center: Movie / Auditorium Title */}
          <div className="flex items-center gap-2 text-sm font-bold text-[#1B1320]">
            <span className="text-[#C8102E] font-black">CINEVERSE 3D</span>
            <span className="text-[#E6DCD2]">|</span>
            <span data-testid="auditorium-header-title">
              {showtimeDetails?.auditorium_name || `Auditorium ${auditoriumId}`} — {showtimeDetails?.screen_type || 'Standard Flat'}
            </span>
          </div>

          {/* Right: Fullscreen Toggle Button */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleFullScreen}
              data-testid="fullscreen-toggle-btn"
              className="flex min-h-[44px] items-center gap-2 rounded-xl border border-[#E6DCD2] bg-white px-3.5 py-2 text-sm font-bold text-[#1B1320] shadow-sm hover:bg-slate-50 transition active:scale-95"
              aria-label={isFullscreen ? 'Exit Full Screen' : 'Enter Full Screen'}
              title="Toggle Fullscreen (F)"
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="h-4 w-4 text-[#C8102E]" />
                  <span className="hidden md:inline">Exit Fullscreen</span>
                </>
              ) : (
                <>
                  <Maximize2 className="h-4 w-4 text-[#C8102E]" />
                  <span className="hidden md:inline">Full Screen</span>
                </>
              )}
              <kbd className="hidden lg:inline rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500 font-mono font-bold">F</kbd>
            </button>
          </div>
        </header>

        <AuditoriumExperience
          cinemaId={cinemaId}
          auditoriumId={auditoriumId}
          showtimeId={showtimeId}
        />
      </div>
    );
  }

  return (
    <SeatMap2D
      cinemaId={cinemaId}
      auditoriumId={auditoriumId}
      showtimeId={showtimeId}
      onSwitchTo3D={handleSwitchTo3D}
      onSwitchToPOV={handleSwitchToPOV}
      has3DAsset={has3D}
    />
  );
}
