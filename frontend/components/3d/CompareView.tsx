'use client';

import React, { useMemo } from 'react';
import { useCinemaStore } from '@/store/useCinemaStore';
import layoutData from '@/public/models/seat_layout_v2.json';
import type { SeatLayoutFile, SeatRecord } from '@/lib/types';
import {
  formatHorizontalAngle,
  formatVerticalAngle,
  geometricCoverage,
} from '@/lib/seatView';
import { X, Eye, Check, ArrowRightLeft } from 'lucide-react';

export function CompareView() {
  const isComparing = useCinemaStore((s) => s.isComparing);
  const compareSeats = useCinemaStore((s) => s.compareSeats);
  const toggleCompare = useCinemaStore((s) => s.toggleCompare);
  const removeFromCompare = useCinemaStore((s) => s.removeFromCompare);
  const enterPOV = useCinemaStore((s) => s.enterPOV);
  const selectSeat = useCinemaStore((s) => s.selectSeat);
  const selectedSeats = useCinemaStore((s) => s.selectedSeats);

  const allSeats = (layoutData as unknown as SeatLayoutFile).seats;
  const seatMap = useMemo(() => {
    const map = new Map<string, SeatRecord>();
    for (const s of allSeats) map.set(s.seat_id, s);
    return map;
  }, [allSeats]);

  const items = useMemo(() => {
    return compareSeats.map((id) => seatMap.get(id)).filter(Boolean) as SeatRecord[];
  }, [compareSeats, seatMap]);

  if (!isComparing) return null;

  // Compute best/neutral per metric
  const maxFov = Math.max(...items.map((i) => i.screen_h_fov_deg), 0);
  const minAngle = Math.min(...items.map((i) => Math.abs(i.horizontal_offset_deg)), 100);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-800 bg-[#0e1117] p-6 shadow-2xl text-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-[#e50914]" />
            <h2 className="text-lg font-bold text-white">Seat View Comparison</h2>
            <span className="text-xs text-slate-400">({items.length}/3 seats selected)</span>
          </div>

          <button
            onClick={toggleCompare}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400">
            No seats chosen for comparison. Click the compare button on any seat panel to add it.
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {items.map((seat) => {
              const isSelected = selectedSeats.includes(seat.seat_id);
              const coverage = geometricCoverage(seat.screen_h_fov_deg, seat.screen_v_fov_deg);
              const isWidestFov = items.length > 1 && seat.screen_h_fov_deg === maxFov;
              const isMostCentered =
                items.length > 1 && Math.abs(seat.horizontal_offset_deg) === minAngle;

              return (
                <div
                  key={seat.seat_id}
                  className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 flex flex-col justify-between"
                >
                  <div>
                    {/* Seat Header */}
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-xl font-black text-white">{seat.seat_id}</div>
                        <div className="text-xs text-slate-400">
                          Row {seat.row} • Seat {seat.number}
                        </div>
                      </div>
                      <button
                        onClick={() => removeFromCompare(seat.seat_id)}
                        className="text-slate-500 hover:text-slate-300"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-300">
                        {seat.category}
                      </span>
                      <span className="font-bold text-white">₹{seat.price}</span>
                    </div>

                    {/* Metrics */}
                    <div className="mt-4 space-y-2 text-xs">
                      <div className="rounded bg-slate-950/60 p-2">
                        <div className="text-[10px] text-slate-400">Distance to Screen</div>
                        <div className="font-semibold text-slate-200">
                          ≈ {seat.screen_distance_m_est} m ({seat.screen_distance.toFixed(1)}u)
                        </div>
                      </div>

                      <div
                        className={`rounded p-2 ${
                          isMostCentered
                            ? 'border border-sky-500/40 bg-sky-950/30'
                            : 'bg-slate-950/60'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-400">Horizontal Angle</span>
                          {isMostCentered && (
                            <span className="text-[9px] font-bold text-sky-400">Centered</span>
                          )}
                        </div>
                        <div className="font-semibold text-slate-200">
                          {formatHorizontalAngle(seat.horizontal_offset_deg)}
                        </div>
                      </div>

                      <div className="rounded bg-slate-950/60 p-2">
                        <div className="text-[10px] text-slate-400">Vertical Angle</div>
                        <div className="font-semibold text-slate-200">
                          {formatVerticalAngle(seat.vertical_angle_deg)}
                        </div>
                      </div>

                      <div
                        className={`rounded p-2 ${
                          isWidestFov
                            ? 'border border-emerald-500/40 bg-emerald-950/30'
                            : 'bg-slate-950/60'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-400">Screen FOV</span>
                          {isWidestFov && (
                            <span className="text-[9px] font-bold text-emerald-400">Widest</span>
                          )}
                        </div>
                        <div className="font-semibold text-slate-200">
                          {seat.screen_h_fov_deg.toFixed(1)}° H × {seat.screen_v_fov_deg.toFixed(1)}° V
                        </div>
                      </div>

                      <div className="rounded bg-slate-950/60 p-2">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-slate-400">Coverage</span>
                          <span className="font-bold text-[#e50914]">{coverage}%</span>
                        </div>
                        <div className="mt-1 h-1 w-full rounded-full bg-slate-800">
                          <div
                            className="h-full rounded-full bg-[#e50914]"
                            style={{ width: `${coverage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="mt-4 flex flex-col gap-2 pt-2 border-t border-slate-800/60">
                    <button
                      onClick={() => {
                        enterPOV(seat.seat_id);
                        toggleCompare();
                      }}
                      className="flex items-center justify-center gap-1.5 rounded-lg bg-slate-800 py-2 text-xs font-semibold text-sky-400 hover:bg-slate-700"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Enter POV</span>
                    </button>

                    <button
                      onClick={() => selectSeat(seat.seat_id)}
                      className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition ${
                        isSelected
                          ? 'border border-red-500/40 bg-zinc-800 text-red-400'
                          : 'bg-[#e50914] text-white hover:bg-red-700'
                      }`}
                    >
                      {isSelected ? (
                        <>
                          <Check className="h-3.5 w-3.5" /> Selected
                        </>
                      ) : (
                        'Select This Seat'
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

