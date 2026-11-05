'use client';

import React, { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useSeatData } from '@/hooks/useSeatData';
import { AuditoriumInfoPanel } from './AuditoriumInfoPanel';
import { SeatInformationPanel } from './SeatInformationPanel';
import { SelectedSeatsBar } from './SelectedSeatsBar';
import { ViewModeToggle } from './ViewModeToggle';
import { CompareView } from './CompareView';
import { MobileControls } from './MobileControls';
import { WalkHUD } from './WalkHUD';
import { TrailerControls } from './TrailerControls';
import { ToastNotification } from '../ui/ToastNotification';
import { useCinemaStore } from '@/store/useCinemaStore';

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
}

export function AuditoriumExperience({
  cinemaId = 'cineverse-imax',
  auditoriumId = 'auditorium-1',
  showtimeId = '1',
}: AuditoriumExperienceProps) {
  // TanStack Query seat status sync
  useSeatData(showtimeId);

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
      {/* Full-viewport Canvas */}
      <CinemaWorld />

      {/* Overlaid UI elements */}
      <AuditoriumInfoPanel />
      <SeatInformationPanel />
      <SelectedSeatsBar />
      <ViewModeToggle />
      <TrailerControls />
      <WalkHUD />
      <CompareView />
      <MobileControls />
      <ToastNotification />
    </main>
  );
}
