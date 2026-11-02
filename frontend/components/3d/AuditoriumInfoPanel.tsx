'use client';

import React, { useState } from 'react';
import { useCinemaStore } from '@/store/useCinemaStore';
import layoutData from '@/public/models/seat_layout_v2.json';
import type { SeatLayoutFile, SeatStatus } from '@/lib/types';
import { Info, Sliders, Sun, Moon } from 'lucide-react';
import type { QualityTier } from '@/lib/types';

export function AuditoriumInfoPanel() {
  const [showHonestyModal, setShowHonestyModal] = useState(false);
  const [showDevControls, setShowDevControls] = useState(false);

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

  const layout = layoutData as unknown as SeatLayoutFile;

  // Compute status counts
  const counts = React.useMemo(() => {
    let available = 0;
    let booked = 0;
    let held = 0;

    for (const seat of layout.seats) {
      const status: SeatStatus = selectedSeats.includes(seat.seat_id)
        ? 'selected'
        : seatStatuses[seat.seat_id] || 'available';

      if (status === 'selected' || status === 'available') available++;
      if (status === 'booked') booked++;
      if (status === 'held') held++;
    }

    return { available, booked, held, selected: selectedSeats.length };
  }, [seatStatuses, selectedSeats, layout.seats]);

  // Hide left panel on mobile or in POV mode to keep view unobstructed
  return (
    <>
      <div
        className={`pointer-events-none absolute left-5 top-5 z-20 hidden w-80 flex-col gap-3 transition-opacity duration-300 md:flex ${
          cameraMode === 'pov' ? 'opacity-30 hover:opacity-100' : 'opacity-100'
        }`}
      >
        {/* Theatre Title & Screen Spec Card */}
        <div className="pointer-events-auto rounded-xl border border-slate-800/80 bg-[#0e1117]/85 p-4 shadow-2xl backdrop-blur-md">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#e50914] shadow-[0_0_8px_#e50914]" />
                <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                  Auditorium 1
                </span>
              </div>
              <h1 className="mt-0.5 text-lg font-bold tracking-tight text-white">
                IMAX Laser Theatre
              </h1>
            </div>
            <button
              onClick={() => setShowHonestyModal(true)}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
              title="How is this calculated?"
              aria-label="How is this calculated?"
            >
              <Info className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-900/70 px-3 py-2 text-xs">
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

          {/* Seat Availability Counts & Legend */}
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

            <button
              onClick={() => setShowDevControls(!showDevControls)}
              className="flex items-center gap-1.5 rounded-md bg-slate-800/60 px-2 py-1.5 text-[11px] text-slate-400 transition hover:bg-slate-700 hover:text-slate-200"
            >
              <Sliders className="h-3.5 w-3.5" />
              <span>Dev Tools</span>
            </button>
          </div>

          {/* Dev Simulation Drawer */}
          {showDevControls && (
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
                  Seat POV places the camera at an estimated adult eye height: seat cushion top + 0.65 m,
                  positioned 0.45 units forward from the backrest. This is a mathematical approximation,
                  not a physical laser scan.
                </p>
              </div>

              <div className="rounded-lg bg-slate-900/80 p-3">
                <div className="font-semibold text-white">No Obstruction Guarantee</div>
                <p className="mt-1 text-amber-300/90">
                  ⚠️ We do NOT claim views are completely unobstructed. Tall patrons in front rows, handrails,
                  or stage edges are not dynamically simulated. The visibility metric represents pure
                  <strong> Geometric Screen Coverage</strong> (visual angle subtended by the screen).
                </p>
              </div>

              <div className="rounded-lg bg-slate-900/80 p-3">
                <div className="font-semibold text-white">Audience Numbering Orientation</div>
                <p className="mt-1">
                  Facing the screen from the auditorium, Seat 01 is on the viewer&apos;s right, and Seat 10
                  is on the viewer&apos;s left. Wayfinding labels follow the official venue coordinates.
                </p>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setShowHonestyModal(false)}
                className="rounded-lg bg-[#e50914] px-4 py-2 text-xs font-semibold text-white transition hover:bg-red-700"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
