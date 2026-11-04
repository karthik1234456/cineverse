'use client';

import React, { useState, useEffect } from 'react';
import { useCinemaStore } from '@/store/useCinemaStore';
import layoutData from '@/public/models/seat_layout_v2.json';
import type { SeatLayoutFile, SeatStatus, QualityTier } from '@/lib/types';
import { Info, Sliders, Sun, Moon } from 'lucide-react';

export function AuditoriumInfoPanel() {
  const [showHonestyModal, setShowHonestyModal] = useState(false);
  const [showDevControls, setShowDevControls] = useState(false);
  const [isDebugMode, setIsDebugMode] = useState(false);

  const seatStatuses = useCinemaStore((s) => s.seatStatuses);
  const selectedSeats = useCinemaStore((s) => s.selectedSeats);
  const houseLights = useCinemaStore((s) => s.houseLights);
  const setHouseLights = useCinemaStore((s) => s.setHouseLights);
  const qualityTier = useCinemaStore((s) => s.qualityTier);
  const setQualityTier = useCinemaStore((s) => s.setQualityTier);
  const useHqModel = useCinemaStore((s) => s.useHqModel);
  const setUseHqModel = useCinemaStore((s) => s.setUseHqModel);
  const updateSeatStatus = useCinemaStore((s) => s.updateSeatStatus);
  const showToast = useCinemaStore((s) => s.showToast);
  const cameraMode = useCinemaStore((s) => s.cameraMode);
  const mode = useCinemaStore((s) => s.mode);

  // Check URL query flag ?debug=1 (dev builds only)
  useEffect(() => {
    if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
      const params = new URLSearchParams(window.location.search);
      setIsDebugMode(params.get('debug') === '1');
    }
  }, []);

  const layout = layoutData as unknown as SeatLayoutFile;

  // Compute status counts strictly partitioning into exactly 100 seats
  const counts = React.useMemo(() => {
    let available = 0;
    let booked = 0;
    let held = 0;
    const selected = selectedSeats.length;

    for (const seat of layout.seats) {
      if (selectedSeats.includes(seat.seat_id)) {
        continue;
      }
      const status: SeatStatus = seatStatuses[seat.seat_id] || 'available';

      if (status === 'available') available++;
      else if (status === 'booked') booked++;
      else if (status === 'held') held++;
    }

    return { available, booked, held, selected };
  }, [seatStatuses, selectedSeats, layout.seats]);

  // First-person modes (Walk/Seated/POV) are minimal: auto-hide the panel
  const isFirstPerson = mode === 'walk' || mode === 'seated' || cameraMode === 'pov' || cameraMode === 'walk';
  if (isFirstPerson) {
    return null;
  }

  return (
    <>
      <div
        className="pointer-events-none fixed left-4 top-20 z-20 hidden w-80 max-h-[calc(100dvh-6rem)] flex-col gap-3 overflow-y-auto transition-opacity duration-300 md:flex"
      >
        {/* Theatre Title & Screen Spec Card */}
        <div className="pointer-events-auto rounded-xl border border-slate-800/80 bg-[#0e1117]/85 p-4 shadow-2xl backdrop-blur-md">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#e50914] shadow-[0_0_8px_#e50914]" />
                <h1 className="text-sm font-bold tracking-tight text-white">
                  Auditorium 1 — 3D Laser IMAX
                </h1>
              </div>
              <p className="mt-0.5 text-xs text-slate-400">
                100 Luxury Recliners • 10 Rows (A–J)
              </p>
            </div>

            <button
              onClick={() => setShowHonestyModal(true)}
              className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition"
              title="How CineVerse 3D calculates sightlines"
            >
              <Info className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-900/60 px-3 py-2 text-xs">
            <span className="text-slate-400">Screen Format</span>
            <span className="font-medium text-slate-200">
              {layout.screen.aspect}:1 Aspect ({layout.screen.width}m × {layout.screen.height}m)
            </span>
          </div>

          {/* Seat Categories & Pricing */}
          <div className="mt-3 space-y-1.5 border-t border-slate-800/60 pt-3">
            <div className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
              Tiers & Pricing
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
              <div className="rounded border border-amber-500/30 bg-amber-950/20 py-1.5">
                <div className="font-semibold text-amber-300">Front</div>
                <div className="text-[10px] text-slate-400">Rows A-C</div>
                <div className="mt-0.5 font-bold text-slate-100">₹150</div>
              </div>
              <div className="rounded border border-blue-500/30 bg-blue-950/20 py-1.5">
                <div className="font-semibold text-blue-300">Prime</div>
                <div className="text-[10px] text-slate-400">Rows D-G</div>
                <div className="mt-0.5 font-bold text-slate-100">₹250</div>
              </div>
              <div className="rounded border border-purple-500/30 bg-purple-950/20 py-1.5">
                <div className="font-semibold text-purple-300">Premier</div>
                <div className="text-[10px] text-slate-400">Rows H-J</div>
                <div className="mt-0.5 font-bold text-slate-100">₹350</div>
              </div>
            </div>
          </div>

          {/* Seat Availability Counts & Legend (Strictly sums to 100) */}
          <div className="mt-3 border-t border-slate-800/60 pt-3">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full border border-sky-400 bg-sky-900/60" />
                <span>Available</span>
                <span className="font-semibold text-slate-400">({counts.available})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full border border-red-500 bg-[#e50914]" />
                <span>Selected</span>
                <span className="font-semibold text-red-400">({counts.selected})</span>
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between text-xs text-slate-300">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full border border-amber-500 bg-amber-600 animate-pulse" />
                <span>Held</span>
                <span className="font-semibold text-amber-400">({counts.held})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full border border-zinc-600 bg-zinc-800" />
                <span>Booked</span>
                <span className="font-semibold text-zinc-500">({counts.booked})</span>
              </div>
            </div>
          </div>

          {/* Quick Environment Controls */}
          <div className="mt-4 flex items-center justify-between border-t border-slate-800/60 pt-3 text-xs">
            <button
              onClick={() => setHouseLights(houseLights === 'full' ? 'show' : 'full')}
              className="flex items-center gap-1.5 rounded-md bg-slate-800/80 px-2.5 py-1.5 text-slate-300 transition hover:bg-slate-700 hover:text-white"
            >
              {houseLights === 'full' ? (
                <>
                  <Sun className="h-3.5 w-3.5 text-amber-400" />
                  <span>Lights Up</span>
                </>
              ) : (
                <>
                  <Moon className="h-3.5 w-3.5 text-blue-400" />
                  <span>Show Mode</span>
                </>
              )}
            </button>

            {/* Dev Tools: only visible when ?debug=1 in dev */}
            {isDebugMode && (
              <button
                onClick={() => setShowDevControls(!showDevControls)}
                className="flex items-center gap-1.5 rounded-md bg-slate-800/60 px-2 py-1.5 text-[11px] text-slate-400 transition hover:bg-slate-700 hover:text-slate-200"
              >
                <Sliders className="h-3.5 w-3.5" />
                <span>Dev Tools</span>
              </button>
            )}
          </div>

          {/* Dev Simulation Drawer (only when debug enabled) */}
          {isDebugMode && showDevControls && (
            <div className="mt-3 space-y-2 rounded-lg border border-slate-800 bg-slate-950/70 p-2.5 text-xs text-slate-300">
              <div className="font-semibold text-slate-400">Dev & Test Diagnostics</div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    updateSeatStatus('D05', 'held');
                    showToast('Simulated: Another patron held seat D05');
                  }}
                  className="flex-1 rounded bg-amber-950/60 border border-amber-600/40 px-2 py-1 text-[11px] text-amber-300 hover:bg-amber-900/60"
                >
                  Hold D05
                </button>
                <button
                  onClick={() => {
                    updateSeatStatus('D05', 'available');
                    showToast('Simulated: Seat D05 released');
                  }}
                  className="flex-1 rounded bg-slate-800 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-700"
                >
                  Release D05
                </button>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-400">Quality Tier</span>
                <select
                  value={qualityTier}
                  onChange={(e) => setQualityTier(e.target.value as QualityTier)}
                  className="rounded bg-slate-900 px-1.5 py-0.5 text-[11px] text-slate-200"
                >
                  <option value="high">High (Full fx)</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low (Mobile)</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">HQ Model (9.5MB)</span>
                <input
                  type="checkbox"
                  checked={useHqModel}
                  onChange={(e) => setUseHqModel(e.target.checked)}
                  className="rounded"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Honesty Rules / How is this calculated Modal */}
      {showHonestyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-[#0e1117] p-6 shadow-2xl text-slate-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Info className="h-5 w-5 text-[#e50914]" />
                How CineVerse 3D Calculates Your View
              </h2>
              <button
                onClick={() => setShowHonestyModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs leading-relaxed text-slate-300">
              <div className="rounded-lg bg-slate-900/80 p-3">
                <div className="font-semibold text-white">Estimated Measurements</div>
                <p className="mt-1">
                  Units in this model are procedural scale units. Distances in metres are converted
                  using an estimate factor of <strong>≈ 0.43 m per unit</strong> (derived from standard
                  0.55m recliner seat width). All metric values are approximate (marked with ≈).
                </p>
              </div>

              <div className="rounded-lg bg-slate-900/80 p-3">
                <div className="font-semibold text-white">Geometric Eye Model</div>
                <p className="mt-1">
                  Eye heights assume a seated adult with eyes approximately <strong>0.65m</strong> above
                  the seat cushion top and <strong>0.45 units</strong> in front of the backrest.
                  Viewing angles are geometric estimates. Heads of other people are not modelled.
                </p>
              </div>

              <div className="rounded-lg bg-slate-900/80 p-3">
                <div className="font-semibold text-white">Cinema Standard Numbering</div>
                <p className="mt-1">
                  Seat 01 is on your left when facing the screen. Seats run left-to-right (01 to 10)
                  across each row A through J.
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowHonestyModal(false)}
                className="rounded-lg bg-[#e50914] px-4 py-2 text-xs font-bold text-white hover:bg-red-700 transition"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
