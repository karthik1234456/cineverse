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
        <div className="pointer-events-auto rounded-3xl border border-[#E6DCD2] bg-white/95 p-6 shadow-2xl backdrop-blur-md text-[#1B1320]">
          {/* Seat Header & Category */}
          <div className="flex items-center justify-between border-b border-[#E6DCD2] pb-4">
            <div>
              <div className="text-xs font-bold tracking-wider text-slate-500 uppercase">
                Seat Inspection
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-black tracking-tight text-[#1B1320]">{seat.seat_id}</span>
                <span className="text-sm font-semibold text-slate-500">
                  Row {seat.row} • Seat {seat.number}
                </span>
              </div>
            </div>

            <div className="text-right">
              <span
                className={`inline-block rounded-xl px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                  seat.category === 'front'
                    ? 'bg-amber-50 text-[#8D5B28] border border-amber-300'
                    : seat.category === 'prime'
                    ? 'bg-blue-50 text-[#1E40AF] border border-blue-300'
                    : 'bg-rose-50 text-[#9F1239] border border-rose-300'
                }`}
              >
                {seat.category}
              </span>
              <div className="mt-1 text-xl font-black text-[#C8102E]">₹{seat.price}</div>
            </div>
          </div>

          {/* View Metrics Grid */}
          <div className="mt-4 space-y-2.5 text-sm">
            {/* Distance */}
            <div className="flex items-center justify-between rounded-xl bg-[#FAF6F0] p-2.5 px-3 border border-[#E6DCD2]">
              <span className="text-slate-600 font-medium">Screen Distance</span>
              <span className="font-bold text-[#1B1320]">
                ≈ {seat.screen_distance_m_est} m{' '}
                <span className="text-xs font-normal text-slate-500">
                  ({seat.screen_distance.toFixed(1)}u)
                </span>
              </span>
            </div>

            {/* Horizontal Offset */}
            <div className="flex items-center justify-between rounded-xl bg-[#FAF6F0] p-2.5 px-3 border border-[#E6DCD2]">
              <span className="text-slate-600 font-medium">Horizontal Offset</span>
              <span className="font-bold text-[#1B1320]">
                {formatHorizontalAngle(seat.horizontal_offset_deg)}
              </span>
            </div>

            {/* Vertical Gaze Angle */}
            <div className="flex items-center justify-between rounded-xl bg-[#FAF6F0] p-2.5 px-3 border border-[#E6DCD2]">
              <span className="text-slate-600 font-medium">Vertical Gaze Angle</span>
              <span className="font-bold text-[#1B1320]">
                {formatVerticalAngle(seat.vertical_angle_deg)}
              </span>
            </div>

            {/* Screen Subtended FOV */}
            <div className="flex items-center justify-between rounded-xl bg-[#FAF6F0] p-2.5 px-3 border border-[#E6DCD2]">
              <span className="text-slate-600 font-medium">Screen Field of View</span>
              <span className="font-bold text-[#1B1320]">
                {seat.screen_h_fov_deg.toFixed(1)}° H × {seat.screen_v_fov_deg.toFixed(1)}° V
              </span>
            </div>

            {/* Geometric Screen Coverage Bar */}
            <div className="rounded-xl bg-[#FAF6F0] p-3 border border-[#E6DCD2]">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">Geometric Screen Coverage</span>
                <span className="font-black text-[#C8102E]">{coverage}%</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full bg-[#C8102E] transition-all duration-300"
                  style={{ width: `${coverage}%` }}
                />
              </div>
              <div className="mt-2 text-xs leading-tight text-slate-500">
                Viewing angles are geometric estimates. Heads of other patrons are not modelled.
              </div>
              <button
                onClick={() => setShowCalculationInfo(true)}
                className="mt-1 flex items-center gap-1 text-xs text-[#C8102E] hover:underline font-semibold"
              >
                <HelpCircle className="h-3.5 w-3.5" />
                <span>How is this calculated?</span>
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-5 space-y-2">
            <button
              onClick={() => enterPOV(seat.seat_id)}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#FAF6F0] border border-[#E6DCD2] py-2.5 text-sm font-bold text-[#1B1320] transition hover:bg-slate-100 shadow-sm"
            >
              <Eye className="h-4 w-4 text-[#C8102E]" />
              <span>Preview Seat Sightline</span>
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
                className={`flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition shadow ${
                  isBooked || isHeld
                    ? 'cursor-not-allowed bg-slate-200 text-slate-400'
                    : isSelected
                    ? 'bg-slate-200 text-slate-800 hover:bg-slate-300'
                    : 'bg-[#C8102E] text-white hover:bg-[#A60D26]'
                }`}
              >
                {isSelected ? (
                  <>
                    <Minus className="h-4 w-4" /> Deselect Seat
                  </>
                ) : isBooked ? (
                  'Unavailable'
                ) : isHeld ? (
                  'Currently Held'
                ) : (
                  <>
                    <Plus className="h-4 w-4" /> Select Seat
                  </>
                )}
              </button>

              <button
                onClick={() => {
                  addToCompare(seat.seat_id);
                  toggleCompare();
                }}
                className="flex min-h-[44px] items-center justify-center rounded-xl border border-[#E6DCD2] bg-[#FAF6F0] px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
                title="Compare with another seat"
              >
                <ArrowLeftRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Correct Cinema Standard Orientation Note */}
          <div className="mt-3 text-center text-xs text-slate-500 font-medium">
            Seat 01 is on your left when facing the screen.
          </div>
        </div>
      </div>

      {/* How is this calculated modal */}
      {showCalculationInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-[#E6DCD2] bg-white p-6 shadow-2xl text-[#1B1320]">
            <div className="flex items-center justify-between border-b border-[#E6DCD2] pb-3">
              <h3 className="font-bold text-[#1B1320] flex items-center gap-2 text-base">
                <HelpCircle className="h-5 w-5 text-[#C8102E]" />
                Sightline & Coverage Calculations
              </h3>
              <button
                onClick={() => setShowCalculationInfo(false)}
                className="text-slate-400 hover:text-[#1B1320] text-sm font-bold"
              >
                ✕
              </button>
            </div>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <p>
                <strong className="text-[#1B1320]">Distance:</strong> Euclidean distance between the seated eye position and the center of the screen geometry.
              </p>
              <p>
                <strong className="text-[#1B1320]">Horizontal Offset:</strong> Angle relative to the central projector axis. Negative values indicate the screen center is to the viewer's left; positive values indicate to the right.
              </p>
              <p>
                <strong className="text-[#1B1320]">Coverage:</strong> The solid angular percentage of the standard cinema viewing cone (36°–45° SMPTE standard) filled by the screen surface from this seat.
              </p>
              <p className="text-xs text-slate-500 italic bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                Note: All values are purely geometric estimates based on 3D model coordinates. Physical obstructions such as patron heads are not modelled.
              </p>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setShowCalculationInfo(false)}
                className="min-h-[40px] rounded-xl bg-[#C8102E] px-5 py-2 text-sm font-bold text-white hover:bg-[#A60D26] transition shadow"
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
