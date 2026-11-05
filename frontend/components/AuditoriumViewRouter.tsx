'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SeatMap2D } from '@/components/2d/SeatMap2D';
import { AuditoriumExperience } from '@/components/3d/AuditoriumExperience';
import { LayoutGrid, Maximize2, Minimize2, ArrowLeft } from 'lucide-react';

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

  // Default is 2D seat map per Phase 4 requirement
  const [currentMode, setCurrentMode] = useState<'2d' | '3d'>(
    (modeParam === '3d' || initialMode === '3d') ? '3d' : '2d'
  );

  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (modeParam === '3d' || modeParam === '2d') {
      setCurrentMode(modeParam);
    }
  }, [modeParam]);

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

  function handleSwitchTo2D() {
    setCurrentMode('2d');
    const params = new URLSearchParams(window.location.search);
    params.set('mode', '2d');
    router.replace(`?${params.toString()}`);
  }

  if (currentMode === '3d') {
    return (
      <div className="relative h-[100dvh] w-full overflow-hidden" data-testid="auditorium-3d-wrapper">
        {/* Slim Immersive Top Bar (§ Part E / Finding F8 fixed) */}
        <header className="fixed top-0 left-0 right-0 z-40 flex h-14 items-center justify-between border-b border-[#E6DCD2]/80 bg-white/95 px-4 shadow-sm backdrop-blur-md">
          {/* Left: Back to 2D */}
          <button
            onClick={handleSwitchTo2D}
            data-testid="switch-to-2d-button"
            className="flex min-h-[44px] items-center gap-2 rounded-xl border border-[#E6DCD2] bg-white px-4 py-2 text-sm font-bold text-[#1B1320] shadow-sm hover:bg-slate-50 transition active:scale-95"
            aria-label="Switch back to 2D Seat Map"
          >
            <ArrowLeft className="h-4 w-4 text-[#C8102E]" />
            <span className="hidden sm:inline">2D Seat Map</span>
          </button>

          {/* Center: Movie / Auditorium Title */}
          <div className="flex items-center gap-2 text-sm font-bold text-[#1B1320]">
            <span className="text-[#C8102E] font-black">CINEVERSE 3D</span>
            <span className="text-[#E6DCD2]">|</span>
            <span>Auditorium {auditoriumId}</span>
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
      has3DAsset={true}
    />
  );
}
