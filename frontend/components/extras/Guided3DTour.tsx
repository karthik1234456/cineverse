'use client';

import React, { useState, useEffect } from 'react';
import { useComfortStore } from '@/store/useComfortStore';
import { Play, Pause, SkipForward, X, Camera } from 'lucide-react';

interface Guided3DTourProps {
  isOpen: boolean;
  onClose: () => void;
  cinemaName?: string;
  auditoriumName?: string;
}

const TOUR_STOPS = [
  { time: 0, title: 'Screen & Front Rake', desc: 'Direct view of the floor and forward acoustic array.', angle: 'Front-low' },
  { time: 8, title: 'Prime Centre Rows (Row E-F)', desc: 'The acoustic sweet-spot with 36° horizontal field of view.', angle: 'Centre-optimal' },
  { time: 16, title: 'Wheelchair & Companion Spaces', desc: 'Level-access step-free bays with unrestricted sightlines.', angle: 'Accessible-tier' },
  { time: 24, title: 'Premier Recliner Gallery', desc: 'Deep-pitch luxury recliners with private sightline clearance.', angle: 'Rear-elevated' },
];

export function Guided3DTour({ isOpen, onClose, cinemaName, auditoriumName }: Guided3DTourProps) {
  const [currentSec, setCurrentSec] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const reducedMotion = useComfortStore((s) => s.reducedMotion);

  useEffect(() => {
    if (!isOpen || !isPlaying) return;
    const interval = setInterval(() => {
      setCurrentSec((prev) => {
        if (prev >= 30) {
          setIsPlaying(false);
          return 30;
        }
        return prev + 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, isPlaying]);

  if (!isOpen) return null;

  const currentStop = TOUR_STOPS.slice().reverse().find((s) => currentSec >= s.time) || TOUR_STOPS[0];
  const progressPct = Math.min(100, Math.round((currentSec / 30) * 100));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="guided-tour-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      data-testid="guided-tour-modal"
    >
      <div className="w-full max-w-xl bg-[#0E1117] border border-white/20 rounded-3xl p-6 text-white shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#C8102E] text-white">
              <Camera className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h3 id="guided-tour-title" className="text-lg font-bold text-white">
                30-Second Guided Theatre Tour
              </h3>
              <p className="text-xs text-slate-400">
                {cinemaName || 'CineVerse'} • {auditoriumName || 'Auditorium'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Skip and close guided tour"
            data-testid="close-guided-tour-btn"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Tour Stage Info */}
        <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
          <div className="flex items-center justify-between text-xs text-amber-400 font-bold uppercase tracking-wider">
            <span>Stop: {currentStop.title}</span>
            <span>{30 - currentSec}s remaining</span>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">
            {currentStop.desc}
          </p>
          <div className="text-xs text-slate-400 pt-1">
            Camera Angle: <span className="font-semibold text-white">{currentStop.angle}</span>
            {reducedMotion && <span className="ml-2 text-amber-300">(Stepped stills mode active)</span>}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#C8102E] transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-400 text-center">
            Simulated 3D tour for guidance. Actual theatre lighting and atmosphere may vary.
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm min-h-[44px] transition"
            data-testid="toggle-tour-play-btn"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            <span>{isPlaying ? 'Pause Tour' : 'Resume'}</span>
          </button>

          <button
            onClick={onClose}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#C8102E] hover:bg-[#A60D26] text-white font-bold text-sm min-h-[44px] transition"
            data-testid="skip-guided-tour-btn"
          >
            <SkipForward className="w-4 h-4" />
            <span>Skip Tour & Pick Seats</span>
          </button>
        </div>
      </div>
    </div>
  );
}

