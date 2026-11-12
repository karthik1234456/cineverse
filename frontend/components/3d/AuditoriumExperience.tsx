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
  useSeatData(showtimeId);

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
      <AuditoriumInfoPanel />
      <SeatInformationPanel />
      <SeatHoverTooltip />
      <SelectedSeatsBar />
      <ViewModeToggle />
      <ScreenMediaCluster />
      <MotionEffectsOverlay />
      <WalkHUD />
      <CompareView />
      <MobileControls />
      <BoundaryNotice />
      <ToastNotification />
    </main>
  );
}
