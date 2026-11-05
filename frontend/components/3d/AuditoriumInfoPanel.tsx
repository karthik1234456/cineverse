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
  const storeTiers = useCinemaStore((s) => s.tiers);

  const displayTiers = React.useMemo(() => {
    if (storeTiers && storeTiers.length > 0) {
      return storeTiers.map((t) => ({
        name: t.name,
        category: t.category,
        rows: t.rows.length > 0 ? `Rows ${t.rows[0]}–${t.rows[t.rows.length - 1]}` : '',
        price: t.price,
        colorClass:
          t.category.toLowerCase() === 'premier'
            ? 'border-rose-300 bg-rose-50 text-[#9F1239]'
            : t.category.toLowerCase() === 'front'
            ? 'border-amber-300 bg-amber-50 text-[#8D5B28]'
            : 'border-blue-300 bg-blue-50 text-[#1E40AF]',
      }));
    }
    return [
      { name: 'Front', category: 'front', rows: 'Rows A–C', price: 280, colorClass: 'border-amber-300 bg-amber-50 text-[#8D5B28]' },
      { name: 'Prime', category: 'prime', rows: 'Rows D–G', price: 380, colorClass: 'border-blue-300 bg-blue-50 text-[#1E40AF]' },
      { name: 'Premier', category: 'premier', rows: 'Rows H–J', price: 520, colorClass: 'border-rose-300 bg-rose-50 text-[#9F1239]' },
    ];
  }, [storeTiers]);

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
        <div className="pointer-events-auto rounded-3xl border border-[#E6DCD2] bg-white/95 p-5 shadow-2xl backdrop-blur-md text-[#1B1320]">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#C8102E] shadow-[0_0_8px_#C8102E]" />
                <h1 className="text-base font-bold tracking-tight text-[#1B1320]">
                  Auditorium 1 — 3D Laser IMAX
                </h1>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                100 Luxury Recliners • 10 Rows (A–J)
              </p>
            </div>

            <button
              onClick={() => setShowHonestyModal(true)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-[#1B1320] transition"
              title="How CineVerse 3D calculates sightlines"
            >
              <Info className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 flex items-center justify-between rounded-xl bg-[#FAF6F0] border border-[#E6DCD2] px-3 py-2 text-xs">
            <span className="text-slate-600 font-medium">Screen Format</span>
            <span className="font-bold text-[#1B1320]">
              {layout.screen.aspect}:1 Aspect ({layout.screen.width}m × {layout.screen.height}m)
            </span>
          </div>

          {/* Seat Categories & Pricing (§ Task 3) */}
          <div className="mt-4 space-y-2 border-t border-[#E6DCD2] pt-3">
            <div className="text-xs font-bold tracking-wider text-slate-500 uppercase">
              Tiers & Pricing
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              {displayTiers.map((tier) => (
                <div key={tier.name} className={`rounded-xl border py-2 ${tier.colorClass}`}>
                  <div className="font-bold">{tier.name}</div>
                  <div className="text-xs text-slate-500">{tier.rows}</div>
                  <div className="mt-0.5 font-black text-sm">₹{Math.round(tier.price)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Seat Availability Counts & Legend (Strictly sums to 100) */}
          <div className="mt-4 border-t border-[#E6DCD2] pt-3">
            <div className="flex items-center justify-between text-xs text-slate-700">
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full border border-slate-300 bg-[#FAF6F0]" />
                <span className="font-medium">Available</span>
                <span className="font-bold text-slate-500">({counts.available})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-[#C8102E]" />
                <span className="font-bold text-[#C8102E]">Selected</span>
                <span className="font-bold text-[#C8102E]">({counts.selected})</span>
              </div>
            </div>

            <div className="mt-2.5 flex items-center justify-between text-xs text-slate-700">
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-amber-500 animate-pulse" />
                <span className="font-medium">Held</span>
                <span className="font-bold text-amber-700">({counts.held})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-slate-300" />
                <span className="font-medium">Booked</span>
                <span className="font-bold text-slate-400">({counts.booked})</span>
              </div>
            </div>
          </div>

          {/* Quick Environment Controls */}
          <div className="mt-4 flex items-center justify-between border-t border-[#E6DCD2] pt-3 text-xs">
            <button
              onClick={() => setHouseLights(houseLights === 'full' ? 'show' : 'full')}
              className="flex min-h-[36px] items-center gap-1.5 rounded-xl border border-[#E6DCD2] bg-[#FAF6F0] px-3 py-1.5 text-slate-700 font-bold transition hover:bg-slate-100"
            >
              {houseLights === 'full' ? (
                <>
                  <Sun className="h-4 w-4 text-amber-500" />
                  <span>Lights Up</span>
                </>
              ) : (
                <>
                  <Moon className="h-4 w-4 text-blue-600" />
                  <span>Show Mode</span>
                </>
              )}
            </button>

            {/* Dev Tools: only visible when ?debug=1 in dev */}
            {isDebugMode && (
              <button
                onClick={() => setShowDevControls(!showDevControls)}
                className="flex items-center gap-1.5 rounded-md bg-slate-800/60 px-2 py-1.5 text-xs text-slate-400 transition hover:bg-slate-700 hover:text-slate-200"
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
                  className="flex-1 rounded bg-amber-950/60 border border-amber-600/40 px-2 py-1 text-xs text-amber-300 hover:bg-amber-900/60"
                >
                  Hold D05
                </button>
                <button
                  onClick={() => {
                    updateSeatStatus('D05', 'available');
                    showToast('Simulated: Seat D05 released');
                  }}
                  className="flex-1 rounded bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700"
                >
                  Release D05
                </button>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-slate-400">Quality Tier</span>
                <select
                  value={qualityTier}
                  onChange={(e) => setQualityTier(e.target.value as QualityTier)}
                  className="rounded bg-slate-900 px-1.5 py-0.5 text-xs text-slate-200"
                >
                  <option value="high">High (Full fx)</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low (Mobile)</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">HQ Model (9.5MB)</span>
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
