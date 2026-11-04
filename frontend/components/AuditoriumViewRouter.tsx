'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SeatMap2D } from '@/components/2d/SeatMap2D';
import { AuditoriumExperience } from '@/components/3d/AuditoriumExperience';
import { LayoutGrid } from 'lucide-react';

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

  useEffect(() => {
    if (modeParam === '3d' || modeParam === '2d') {
      setCurrentMode(modeParam);
    }
  }, [modeParam]);

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
      <div className="relative h-[100dvh] w-full" data-testid="auditorium-3d-wrapper">
        {/* Top-right floating switcher back to 2D */}
        <div className="fixed top-4 right-4 z-40">
          <button
            onClick={handleSwitchTo2D}
            data-testid="switch-to-2d-button"
            className="flex min-h-[44px] items-center gap-2 rounded-full border border-[#E6DCD2] bg-white/95 px-5 py-2.5 text-sm font-bold text-[#1B1320] shadow-xl backdrop-blur-md hover:bg-slate-50 transition"
            aria-label="Switch back to 2D Seat Map"
          >
            <LayoutGrid className="h-4 w-4 text-[#C8102E]" />
            <span>2D Seat Map</span>
          </button>
        </div>

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
