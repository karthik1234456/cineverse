'use client';

import React, { useMemo } from 'react';
import { useCinemaStore } from '@/store/useCinemaStore';
import layoutData from '@/public/models/seat_layout_v2.json';
import type { SeatLayoutFile } from '@/lib/types';
import {
  formatHorizontalAngle,
  formatVerticalAngle,
  geometricCoverage,
} from '@/lib/seatView';
import { Eye, Plus, Minus, ArrowLeftRight } from 'lucide-react';

export function SeatInformationPanel() {
  const activeSeatId = useCinemaStore((s) => s.activeSeatId);
  const selectedSeats = useCinemaStore((s) => s.selectedSeats);
  const selectSeat = useCinemaStore((s) => s.selectSeat);
  const deselectSeat = useCinemaStore((s) => s.deselectSeat);
  const enterPOV = useCinemaStore((s) => s.enterPOV);
  const cameraMode = useCinemaStore((s) => s.cameraMode);
  const seatStatuses = useCinemaStore((s) => s.seatStatuses);
  const addToCompare = useCinemaStore((s) => s.addToCompare);
  const toggleCompare = useCinemaStore((s) => s.toggleCompare);

  const seats = (layoutData as unknown as SeatLayoutFile).seats;
  const seat = useMemo(() => {
    if (!activeSeatId) return seats[0];
    return seats.find((s) => s.seat_id === activeSeatId) || seats[0];
  }, [activeSeatId, seats]);

  if (!seat) return null;

  const isSelected = selectedSeats.includes(seat.seat_id);
  const rawStatus = seatStatuses[seat.seat_id] || 'available';
  const isBooked = rawStatus === 'booked';
  const isHeld = rawStatus === 'held';

  const coverage = geometricCoverage(seat.screen_h_fov_deg, seat.screen_v_fov_deg);

  return (
    <div
      className={`pointer-events-none absolute right-5 top-5 z-20 hidden w-84 flex-col gap-3 transition-opacity duration-300 md:flex ${
        cameraMode === 'pov' ? 'opacity-35 hover:opacity-100' : 'opacity-100'
      }`}
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
            <div className="flex items-center gap-1 text-slate-400">
              <span>Horizontal Offset</span>
            </div>
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
            <div className="mt-1 text-[9px] text-slate-500 italic">
              Estimated geometric visual cone. Sightline is not obstruction-guaranteed.
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-5 space-y-2">
          {cameraMode !== 'pov' ? (
            <button
              onClick={() => enterPOV(seat.seat_id)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-800 py-2.5 text-xs font-semibold text-slate-100 transition hover:bg-slate-700"
            >
              <Eye className="h-4 w-4 text-sky-400" />
              Preview Seat POV
            </button>
          ) : (
            <div className="text-center text-xs text-sky-400 font-medium py-1">
              Currently in Seat POV View
            </div>
          )}

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

        {/* Numbering Quirk Hint */}
        <div className="mt-3 text-center text-[10px] text-slate-500">
          Audience orientation: facing screen, Seat 01 is on right, Seat 10 on left.
        </div>
      </div>
    </div>
  );
}
