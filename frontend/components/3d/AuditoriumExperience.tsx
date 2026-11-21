'use client';

import React, { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useSeatData } from '@/hooks/useSeatData';
import { AuditoriumInfoPanel } from './AuditoriumInfoPanel';
import { SeatInformationPanel } from './SeatInformationPanel';
import { SeatHoverTooltip } from './SeatHoverTooltip';
import { SelectedSeatsBar } from './SelectedSeatsBar';
import { ViewModeToggle } from './ViewModeToggle';
import { CompareView } from './CompareView';
import { MobileControls } from './MobileControls';
import { useMovieBackdrop } from '@/context/MovieBackdropContext';
import { WalkHUD } from './WalkHUD';
import { ScreenMediaCluster } from './ScreenMediaCluster';
import { MotionEffectsOverlay } from './MotionEffectsOverlay';
import { BoundaryNotice } from './BoundaryNotice';
import { ToastNotification } from '../ui/ToastNotification';
import { useCinemaStore } from '@/store/useCinemaStore';
import { CanvasErrorBoundary } from './CanvasErrorBoundary';
import { TheatreModePlayer } from './TheatreModePlayer';

// Lazy-load 3D Canvas with ssr: false as required in § 6
const CinemaWorld = dynamic(
  () => import('./CinemaWorld').then((mod) => mod.CinemaWorld),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[100dvh] w-full items-center justify-center bg-[#07080a] text-white">
        <div className="text-center">
          <div className="h-3 w-3 rounded-full bg-[#e50914] shadow-[0_0_12px_#e50914] mx-auto mb-4 animate-ping" />
          <div className="text-sm font-semibold tracking-widest text-slate-300 uppercase">
            Initializing CineVerse 3D Engine...
          </div>
        </div>
      </div>
    ),
  }
);

interface AuditoriumExperienceProps {
  cinemaId?: string;
  auditoriumId?: string;
  showtimeId?: string;
  onSwitchTo2D?: () => void;
}

export function AuditoriumExperience({
  cinemaId = 'cineverse-imax',
  auditoriumId = 'auditorium-1',
  showtimeId = '1',
  onSwitchTo2D,
}: AuditoriumExperienceProps) {
  // TanStack Query seat status sync
  const { data: seatData, isLoading } = useSeatData(showtimeId);
  const proceduralResult = useCinemaStore((s) => s.proceduralResult);

  // Pause MovieBackdrop video while 3D auditorium is mounted (never two videos at once)
  const { setPausedBy3D } = useMovieBackdrop();
  useEffect(() => {
    setPausedBy3D(true);
    return () => setPausedBy3D(false);
  }, [setPausedBy3D]);

  // Check URL query flag ?hq=1
  const setUseHqModel = useCinemaStore((s) => s.setUseHqModel);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('hq') === '1') {
        setUseHqModel(true);
      }
    }
  }, [setUseHqModel]);

  // Prompt loading skeleton appears within 100ms; keeps UI responsive and avoids premature GLTF/Canvas load
  if ((isLoading || !proceduralResult) && !seatData) {
    return (
      <div className="flex h-[100dvh] w-full items-center justify-center bg-[#07080a] text-white select-none">
        <div className="text-center">
          <div className="h-3 w-3 rounded-full bg-[#e50914] shadow-[0_0_12px_#e50914] mx-auto mb-4 animate-ping" />
          <div className="text-sm font-semibold tracking-widest text-slate-300 uppercase">
            Entering 3D Theatre...
          </div>
        </div>
      </div>
    );
  }

  return (
    <main
      data-cinema-id={cinemaId}
      data-auditorium-id={auditoriumId}
      className="relative h-[100dvh] w-full overflow-hidden bg-[#07080a]"
    >
      {/* Full-viewport Canvas protected with Error Boundary */}
      <CanvasErrorBoundary onFallbackTo2D={onSwitchTo2D}>
        <CinemaWorld />
      </CanvasErrorBoundary>

      {/* Overlaid UI elements */}
      {/* Left HUD Column: Stacks Info Panel, Light Controls, and Trailer Panel without collision (§ Part D) */}
      <div
        id="hud-left-column"
        className="pointer-events-none fixed left-4 top-16 bottom-6 z-30 flex flex-col gap-3 w-80 max-w-[calc(100vw-2rem)] overflow-y-auto overflow-x-hidden no-scrollbar"
      >
        <AuditoriumInfoPanel inline />
        <ScreenMediaCluster inline />
      </div>

      <SeatInformationPanel />
      <SeatHoverTooltip />
      <SelectedSeatsBar />
      <ViewModeToggle />
      <MotionEffectsOverlay />
      <WalkHUD />
      <CompareView />
      <MobileControls />
      <BoundaryNotice />
      <TheatreModePlayer />
      <ToastNotification />
    </main>
  );
}
