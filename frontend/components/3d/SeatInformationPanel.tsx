'use client';

import React, { useMemo, useState } from 'react';
import { useCinemaStore } from '@/store/useCinemaStore';
import layoutData from '@/public/models/seat_layout_v2.json';
import type { SeatLayoutFile } from '@/lib/types';
import {
  formatHorizontalAngle,
  formatVerticalAngle,
  geometricCoverage,
} from '@/lib/seatView';
import { Eye, Plus, Minus, ArrowLeftRight, HelpCircle } from 'lucide-react';

export function SeatInformationPanel() {
  const activeSeatId = useCinemaStore((s) => s.activeSeatId);
  const selectedSeats = useCinemaStore((s) => s.selectedSeats);
  const selectSeat = useCinemaStore((s) => s.selectSeat);
  const deselectSeat = useCinemaStore((s) => s.deselectSeat);
  const enterPOV = useCinemaStore((s) => s.enterPOV);
  const cameraMode = useCinemaStore((s) => s.cameraMode);
  const mode = useCinemaStore((s) => s.mode);
  const seatStatuses = useCinemaStore((s) => s.seatStatuses);
  const addToCompare = useCinemaStore((s) => s.addToCompare);
  const toggleCompare = useCinemaStore((s) => s.toggleCompare);

  const [showCalculationInfo, setShowCalculationInfo] = useState(false);

  const seats = (layoutData as unknown as SeatLayoutFile).seats;
  const seat = useMemo(() => {
    if (!activeSeatId) return seats[0];
    return seats.find((s) => s.seat_id === activeSeatId) || seats[0];
  }, [activeSeatId, seats]);

  // First-person modes (Walk/Seated/POV) are minimal: auto-hide the right panel
  const isFirstPerson = mode === 'walk' || mode === 'seated' || cameraMode === 'pov' || cameraMode === 'walk';
  if (isFirstPerson || !seat) {
    return null;
  }

  const isSelected = selectedSeats.includes(seat.seat_id);
  const rawStatus = seatStatuses[seat.seat_id] || 'available';
  const isBooked = rawStatus === 'booked';
  const isHeld = rawStatus === 'held';

  const coverage = geometricCoverage(seat.screen_h_fov_deg, seat.screen_v_fov_deg);

  return (
    <>
      <div
        className="pointer-events-none fixed right-4 top-20 z-20 hidden w-84 max-h-[calc(100dvh-6rem)] flex-col gap-3 overflow-y-auto transition-opacity duration-300 md:flex"
      >
        <div className="pointer-events-auto rounded-2xl border border-slate-800/80 bg-[#0e1117]/90 p-5 shadow-2xl backdrop-blur-md text-white">
          {/* Seat Header & Category */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div>
              <div className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                Seat Inspection
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black tracking-tight text-white">{seat.seat_id}</span>
                <span className="text-xs text-slate-400">
                  Row {seat.row} • Seat {seat.number}
                </span>
              </div>
            </div>

            <div className="text-right">
              <span
                className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase ${
                  seat.category === 'front'
                    ? 'bg-amber-950/60 text-amber-300 border border-amber-500/40'
                    : seat.category === 'prime'
                    ? 'bg-blue-950/60 text-blue-300 border border-blue-500/40'
                    : 'bg-purple-950/60 text-purple-300 border border-purple-500/40'
                }`}
              >
                {seat.category}
              </span>
              <div className="mt-0.5 text-base font-bold text-slate-100">₹{seat.price}</div>
            </div>
          </div>

          {/* View Metrics Grid */}
          <div className="mt-4 space-y-2.5 text-xs">
            {/* Distance */}
            <div className="flex items-center justify-between rounded-lg bg-slate-900/60 p-2 px-3">
              <span className="text-slate-400">Screen Distance</span>
              <span className="font-semibold text-slate-200">
                ≈ {seat.screen_distance_m_est} m{' '}
                <span className="text-[10px] font-normal text-slate-500">
                  ({seat.screen_distance.toFixed(1)}u)
                </span>
              </span>
            </div>

            {/* Horizontal Offset */}
            <div className="flex items-center justify-between rounded-lg bg-slate-900/60 p-2 px-3">
              <span className="text-slate-400">Horizontal Offset</span>
              <span className="font-semibold text-slate-200">
                {formatHorizontalAngle(seat.horizontal_offset_deg)}
              </span>
            </div>

            {/* Vertical Gaze Angle */}
            <div className="flex items-center justify-between rounded-lg bg-slate-900/60 p-2 px-3">
              <span className="text-slate-400">Vertical Gaze Angle</span>
              <span className="font-semibold text-slate-200">
                {formatVerticalAngle(seat.vertical_angle_deg)}
              </span>
            </div>

            {/* Screen Subtended FOV */}
            <div className="flex items-center justify-between rounded-lg bg-slate-900/60 p-2 px-3">
              <span className="text-slate-400">Screen Field of View</span>
              <span className="font-semibold text-slate-200">
                {seat.screen_h_fov_deg.toFixed(1)}° H × {seat.screen_v_fov_deg.toFixed(1)}° V
              </span>
            </div>

            {/* Geometric Screen Coverage Bar */}
            <div className="rounded-lg bg-slate-900/60 p-2.5 px-3">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Geometric Screen Coverage</span>
                <span className="font-bold text-[#e50914]">{coverage}%</span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-red-600 to-[#e50914] transition-all duration-300"
                  style={{ width: `${coverage}%` }}
                />
              </div>
              <div className="mt-2 text-[10px] leading-tight text-slate-400">
                Viewing angles are geometric estimates. Heads of other people are not modelled.
              </div>
              <button
                onClick={() => setShowCalculationInfo(true)}
                className="mt-1 flex items-center gap-1 text-[10px] text-sky-400 hover:text-sky-300 underline"
              >
                <HelpCircle className="h-3 w-3" />
                <span>How is this calculated?</span>
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-5 space-y-2">
            <button
              onClick={() => enterPOV(seat.seat_id)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-800 py-2.5 text-xs font-semibold text-slate-100 transition hover:bg-slate-700"
            >
              <Eye className="h-4 w-4 text-sky-400" />
              Preview Seat Sightline
            </button>

            <div className="flex gap-2">
              <button
                disabled={isBooked || isHeld}
                onClick={() => {
                  if (isSelected) {
                    deselectSeat(seat.seat_id);
                  } else {
                    selectSeat(seat.seat_id);
                  }
                }}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition ${
                  isBooked || isHeld
                    ? 'cursor-not-allowed bg-zinc-800 text-zinc-500'
                    : isSelected
                    ? 'bg-zinc-800 text-red-400 border border-red-500/50 hover:bg-zinc-700'
                    : 'bg-[#e50914] text-white hover:bg-red-700 shadow-lg shadow-red-950/60'
                }`}
              >
                {isSelected ? (
                  <>
                    <Minus className="h-3.5 w-3.5" /> Deselect Seat
                  </>
                ) : isBooked ? (
                  'Unavailable'
                ) : isHeld ? (
                  'Currently Held'
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5" /> Select Seat
                  </>
                )}
              </button>

              <button
                onClick={() => {
                  addToCompare(seat.seat_id);
                  toggleCompare();
                }}
                className="flex items-center justify-center rounded-xl border border-slate-700 bg-slate-800/80 px-3 text-xs font-medium text-slate-300 transition hover:bg-slate-700 hover:text-white"
                title="Compare with another seat"
              >
                <ArrowLeftRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Correct Cinema Standard Orientation Note */}
          <div className="mt-3 text-center text-[10px] text-slate-400">
            Seat 01 is on your left when facing the screen.
          </div>
        </div>
      </div>

      {/* How is this calculated modal */}
      {showCalculationInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#0e1117] p-5 shadow-2xl text-slate-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white flex items-center gap-2 text-sm">
                <HelpCircle className="h-4 w-4 text-sky-400" />
                Sightline & Coverage Calculations
              </h3>
              <button
                onClick={() => setShowCalculationInfo(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="mt-3 space-y-2.5 text-xs text-slate-300">
              <p>
                <strong>Distance:</strong> Euclidean distance between the seated eye position and the center of the screen geometry.
              </p>
              <p>
                <strong>Horizontal Offset:</strong> Angle relative to the central projector axis. Negative values indicate the screen center is to the viewer's left; positive values indicate to the right.
              </p>
              <p>
                <strong>Coverage:</strong> The solid angular percentage of the standard cinema viewing cone (36°–45° SMPTE standard) filled by the screen surface from this seat.
              </p>
              <p className="text-slate-400 italic">
                Note: All values are purely geometric estimates based on 3D model coordinates. Physical obstructions such as patron heads are not modelled.
              </p>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowCalculationInfo(false)}
                className="rounded-lg bg-[#e50914] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-red-700 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
