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
import { viewScore } from '@/lib/seatScoring';
import obstructionsData from '@/public/models/seat_obstructions.json';
import { Eye, Plus, Minus, ArrowLeftRight, HelpCircle, ShieldCheck, Flame, X, ChevronDown, ChevronUp } from 'lucide-react';

export function SeatInformationPanel() {
  const activeSeatId = useCinemaStore((s) => s.activeSeatId);
  const selectedSeats = useCinemaStore((s) => s.selectedSeats);
  const selectSeat = useCinemaStore((s) => s.selectSeat);
  const deselectSeat = useCinemaStore((s) => s.deselectSeat);
  const sitAt = useCinemaStore((s) => s.sitAt);
  const cameraMode = useCinemaStore((s) => s.cameraMode);
  const mode = useCinemaStore((s) => s.mode);
  const seatStatuses = useCinemaStore((s) => s.seatStatuses);
  const addToCompare = useCinemaStore((s) => s.addToCompare);
  const toggleCompare = useCinemaStore((s) => s.toggleCompare);
  const seatPrices = useCinemaStore((s) => s.seatPrices);

  const [showDetails, setShowDetails] = useState(false);
  const [showCalculationInfo, setShowCalculationInfo] = useState(false);

  const auditoriumLayout = useCinemaStore((s) => s.auditoriumLayout);
  const seats = auditoriumLayout?.seats || (layoutData as unknown as SeatLayoutFile).seats;
  const seat = useMemo(() => {
    if (!activeSeatId) return null;
    return seats.find((s) => s.seat_id === activeSeatId) || null;
  }, [activeSeatId, seats]);

  // Hide in first-person walk or when no seat is actively clicked (Finding F6 fixed)
  const isFirstPerson = mode === 'walk' || mode === 'seated' || cameraMode === 'pov' || cameraMode === 'walk';
  if (isFirstPerson || !seat) {
    return null;
  }

  const isSelected = selectedSeats.includes(seat.seat_id);
  const rawStatus = seatStatuses[seat.seat_id] || 'available';
  const isBooked = rawStatus === 'booked';
  const isHeld = rawStatus === 'held';

  const comfortScore = viewScore(seat as any);
  const obstruction = (obstructionsData as any).seats?.[seat.seat_id];
  const coverage = geometricCoverage(seat.screen_h_fov_deg, seat.screen_v_fov_deg);

  // Plain-language view rating by default (Part H item 1 compliance)
  const viewRating = (() => {
    const row = seat.row.toUpperCase();
    if (row === 'A' || row === 'B') {
      return {
        label: 'Very close',
        badgeClass: 'bg-orange-500 text-white',
        description: 'Front-row immersion; higher upward viewing angle.',
      };
    }
    if (row === 'I' || row === 'J') {
      return {
        label: 'Far back',
        badgeClass: 'bg-indigo-600 text-white',
        description: 'Wide panoramic view from the upper tier.',
      };
    }
    if (comfortScore.score >= 80) {
      return {
        label: 'Great view',
        badgeClass: 'bg-emerald-600 text-white',
        description: 'Optimal central viewing angle and full screen coverage.',
      };
    }
    if (comfortScore.score >= 65) {
      return {
        label: 'Good view',
        badgeClass: 'bg-blue-600 text-white',
        description: 'Clear, comfortable sightline to the entire screen.',
      };
    }
    return {
      label: 'OK view',
      badgeClass: 'bg-amber-500 text-white',
      description: 'Decent view with a slight side angle offset.',
    };
  })();

  const quote = seatPrices[seat.seat_id];
  const displayPrice = quote ? Math.round(quote.price) : (seat.price ?? 380);
  const displayCategory = quote?.category ?? seat.category ?? 'Prime';

  return (
    <>
      <div
        className="pointer-events-none fixed right-4 top-16 z-30 hidden w-[340px] max-h-[calc(100dvh-5rem)] flex-col gap-3 overflow-y-auto transition-all duration-300 md:flex animate-in fade-in slide-in-from-right-4"
      >
        <div className="pointer-events-auto rounded-3xl border border-[#E6DCD2] bg-white/95 p-5 shadow-2xl backdrop-blur-md text-[#1B1320]">
          {/* Seat Header & Close Button */}
          <div className="flex items-start justify-between border-b border-[#E6DCD2] pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black tracking-tight text-[#1B1320]">
                  Seat {seat.seat_id}
                </span>
                <span
                  className={`inline-block rounded-lg px-2.5 py-0.5 text-sm font-bold uppercase tracking-wider ${displayCategory.toLowerCase() === 'front'
                    ? 'bg-amber-50 text-[#8D5B28] border border-amber-300'
                    : displayCategory.toLowerCase() === 'prime'
                      ? 'bg-blue-50 text-[#1E40AF] border border-blue-300'
                      : 'bg-rose-50 text-[#9F1239] border border-rose-300'
                    }`}
                >
                  {displayCategory}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-slate-500">
                Row {seat.row} • Seat {seat.number}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="text-right">
                <div className="text-2xl font-black text-[#C8102E]">₹{displayPrice}</div>
              </div>
              <button
                onClick={() => useCinemaStore.setState({ activeSeatId: null })}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-black transition"
                aria-label="Close Seat Details Card"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Quick Actions (Select / Deselect & Sit Here) */}
          <div className="mt-4 space-y-2">
            {!isBooked && !isHeld ? (
              <button
                onClick={() => {
                  if (isSelected) deselectSeat(seat.seat_id);
                  else selectSeat(seat.seat_id);
                }}
                data-testid="docked-seat-select-toggle"
                className={`flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl py-3 text-base font-bold transition shadow-sm ${isSelected
                  ? 'bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-300'
                  : 'bg-[#C8102E] text-white hover:bg-[#A60D26]'
                  }`}
              >
                {isSelected ? <Minus className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                <span>{isSelected ? 'Deselect Seat' : 'Select Seat (₹' + displayPrice + ')'}</span>
              </button>
            ) : (
              <div className="flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-slate-100 text-sm font-bold text-slate-500 border border-slate-200">
                {isBooked ? 'Seat Unavailable (Booked)' : 'Seat Held by Patron'}
              </div>
            )}

            <button
              onClick={() => sitAt(seat.seat_id)}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl bg-[#FAF6F0] border border-[#E6DCD2] py-2.5 text-sm font-bold text-[#1B1320] transition hover:bg-slate-100 shadow-sm"
            >
              <Eye className="h-4 w-4 text-[#C8102E]" />
              <span>Sit in this Seat (Sightline POV)</span>
            </button>
          </div>

          {/* Plain-Language Viewing Rating (§ Part H item 1) */}
          <div className="mt-4 rounded-2xl bg-[#FAF6F0] p-3.5 border border-[#E6DCD2] space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-bold text-[#1B1320] flex items-center gap-1.5">
                <Flame className="h-4 w-4 text-emerald-600" />
                <span>Viewing Rating</span>
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-lg text-sm font-black ${viewRating.badgeClass}`}
              >
                {viewRating.label}
              </span>
            </div>

            <div className="text-sm text-slate-700 leading-normal">
              {viewRating.description}
            </div>

            {/* Honest Obstruction Disclosure (Finding F10 fixed) */}
            <div className="text-sm text-slate-500 leading-normal pt-1 border-t border-[#E6DCD2]/60">
              {obstruction && obstruction.visible_percentage < 100
                ? `Estimated screen visibility: ${obstruction.visible_percentage}%.`
                : 'No obstruction found by our estimate (people in other seats are not modelled).'}
            </div>
          </div>

          {/* Collapsible Details Section (Geometric Angles & Calculations) */}
          <div className="mt-3 border-t border-[#E6DCD2] pt-2">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex w-full items-center justify-between py-2 text-sm font-bold text-slate-700 hover:text-black"
            >
              <span>{showDetails ? 'Hide Detailed Angles' : 'View Geometric Angles'}</span>
              {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {showDetails && (
              <div className="mt-2 space-y-2 text-sm text-slate-700 animate-in fade-in duration-200">
                <div className="rounded-xl bg-[#FAF6F0] p-2.5 border border-[#E6DCD2] flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Numeric View Score</span>
                  <span className="font-bold text-[#1B1320]">{comfortScore.score} / 100</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-[#FAF6F0] p-2.5 border border-[#E6DCD2]">
                    <div className="text-slate-500 font-medium">Horizontal Angle</div>
                    <div className="text-sm font-bold text-[#1B1320] mt-0.5">
                      {formatHorizontalAngle(seat.horizontal_offset_deg)}
                    </div>
                  </div>
                  <div className="rounded-xl bg-[#FAF6F0] p-2.5 border border-[#E6DCD2]">
                    <div className="text-slate-500 font-medium">Vertical Angle</div>
                    <div className="text-sm font-bold text-[#1B1320] mt-0.5">
                      {formatVerticalAngle(seat.vertical_angle_deg)}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl bg-[#FAF6F0] p-2.5 border border-[#E6DCD2] flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Screen Distance</span>
                  <span className="font-bold text-[#1B1320]">{seat.screen_distance_m_est.toFixed(1)} meters</span>
                </div>

                <div className="rounded-xl bg-[#FAF6F0] p-2.5 border border-[#E6DCD2] flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Geometric Screen Coverage</span>
                  <span className="font-bold text-[#C8102E]">{coverage}%</span>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => {
                      addToCompare(seat.seat_id);
                      toggleCompare();
                    }}
                    className="flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#E6DCD2] bg-white py-2 text-sm font-bold text-slate-800 hover:bg-slate-50"
                  >
                    <ArrowLeftRight className="h-3.5 w-3.5 text-[#C8102E]" />
                    <span>Compare Seat</span>
                  </button>
                  <button
                    onClick={() => setShowCalculationInfo(true)}
                    className="flex min-h-[40px] items-center justify-center gap-1 rounded-xl border border-[#E6DCD2] bg-white px-3.5 py-2 text-sm font-bold text-slate-800 hover:bg-slate-50"
                  >
                    <HelpCircle className="h-3.5 w-3.5 text-slate-400" />
                    <span>Help</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* How is this calculated Modal */}
      {showCalculationInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="max-w-md rounded-3xl border border-[#E6DCD2] bg-white p-6 shadow-2xl text-[#1B1320] space-y-4">
            <div className="flex items-center justify-between border-b border-[#E6DCD2] pb-3">
              <h2 className="text-lg font-black text-[#1B1320]">How Sightlines are Estimated</h2>
              <button
                onClick={() => setShowCalculationInfo(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
              <p>
                Our sightline rating uses geometric raycasts from eye level directly to screen corners based on SMPTE ST 2092 theatre standards.
              </p>
              <p className="text-sm text-slate-700 bg-[#FAF6F0] p-3 rounded-xl border border-[#E6DCD2]">
                <strong>Honesty Disclosure:</strong> Viewing angles and sightlines are geometric estimates. Procedural halls are idealized acoustic and architectural models generated from auditorium layout specifications and not physical laser scans. Patrons in front rows or personal head movement are not simulated.
              </p>
            </div>
            <button
              onClick={() => setShowCalculationInfo(false)}
              className="w-full rounded-2xl bg-[#C8102E] py-2.5 text-sm font-bold text-white hover:bg-[#A60D26]"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
