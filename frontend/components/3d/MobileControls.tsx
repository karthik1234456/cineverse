'use client';

import React, { useState, useMemo } from 'react';
import { useCinemaStore } from '@/store/useCinemaStore';
import layoutData from '@/public/models/seat_layout_v2.json';
import type { SeatLayoutFile, SeatRecord } from '@/lib/types';
import {
  formatHorizontalAngle,
  formatVerticalAngle,
  geometricCoverage,
} from '@/lib/seatView';
import {
  Eye,
  Orbit,
  Sun,
  Moon,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';

export function MobileControls() {
  const [sheetSnap, setSheetSnap] = useState<'peek' | 'half' | 'full'>('peek');

  const activeSeatId = useCinemaStore((s) => s.activeSeatId);
  const selectedSeats = useCinemaStore((s) => s.selectedSeats);
  const selectSeat = useCinemaStore((s) => s.selectSeat);
  const deselectSeat = useCinemaStore((s) => s.deselectSeat);
  const enterPOV = useCinemaStore((s) => s.enterPOV);
  const exitPOV = useCinemaStore((s) => s.exitPOV);
  const cameraMode = useCinemaStore((s) => s.cameraMode);
  const houseLights = useCinemaStore((s) => s.houseLights);
  const setHouseLights = useCinemaStore((s) => s.setHouseLights);
  const seatStatuses = useCinemaStore((s) => s.seatStatuses);
  const seatPrices = useCinemaStore((s) => s.seatPrices);

  const allSeats = (layoutData as unknown as SeatLayoutFile).seats;
  const seat = useMemo(() => {
    return allSeats.find((s) => s.seat_id === activeSeatId) || allSeats[0];
  }, [activeSeatId, allSeats]);

  const seatMap = useMemo(() => {
    const map = new Map<string, SeatRecord>();
    for (const s of allSeats) map.set(s.seat_id, s);
    return map;
  }, [allSeats]);

  const isSelected = selectedSeats.includes(seat.seat_id);
  const rawStatus = seatStatuses[seat.seat_id] || 'available';
  const isBooked = rawStatus === 'booked';
  const isHeld = rawStatus === 'held';
  const coverage = geometricCoverage(seat.screen_h_fov_deg, seat.screen_v_fov_deg);

  const totalPrice = useMemo(() => {
    return selectedSeats.reduce((acc, id) => {
      const serverPrice = seatPrices[id]?.price;
      if (serverPrice !== undefined) return acc + serverPrice;
      const s = seatMap.get(id);
      return acc + (s ? s.price : 380);
    }, 0);
  }, [selectedSeats, seatMap, seatPrices]);

  return (
    <div className="md:hidden">
      {/* Floating Top Quick Actions Bar */}
      <div className="fixed top-3 left-3 right-3 z-30 flex items-center justify-between pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-[#0e1117]/90 border border-slate-800 p-1 shadow-lg backdrop-blur-md">
          {cameraMode === 'pov' ? (
            <button
              onClick={exitPOV}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-full bg-slate-800 px-3 text-xs font-semibold text-white"
            >
              <Orbit className="h-4 w-4 text-sky-400" />
              <span>Orbit</span>
            </button>
          ) : (
            <button
              onClick={() => enterPOV(seat.seat_id)}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-full bg-slate-800 px-3 text-xs font-semibold text-white"
            >
              <Eye className="h-4 w-4 text-sky-400" />
              <span>POV {seat.seat_id}</span>
            </button>
          )}

          <button
            onClick={() => setHouseLights(houseLights === 'full' ? 'show' : 'full')}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full p-2 text-slate-300 hover:text-white"
            aria-label="Toggle house lights"
          >
            {houseLights === 'full' ? (
              <Sun className="h-4 w-4 text-amber-400" />
            ) : (
              <Moon className="h-4 w-4 text-blue-400" />
            )}
          </button>
        </div>

        {selectedSeats.length > 0 && (
          <div className="pointer-events-auto rounded-full bg-[#e50914] px-3.5 py-2 text-xs font-bold text-white shadow-lg shadow-red-950">
            {selectedSeats.length} Selected (₹{totalPrice})
          </div>
        )}
      </div>

      {/* Responsive Bottom Sheet */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-30 rounded-t-2xl border-t border-slate-800 bg-[#0e1117]/95 p-4 shadow-2xl backdrop-blur-lg transition-transform duration-300 text-white pb-[env(safe-area-inset-bottom,16px)] ${
          sheetSnap === 'peek'
            ? 'translate-y-[calc(100%-110px)]'
            : sheetSnap === 'half'
            ? 'translate-y-[calc(100%-280px)]'
            : 'translate-y-0 max-h-[85vh] overflow-y-auto'
        }`}
      >
        {/* Handle Bar */}
        <div
          onClick={() =>
            setSheetSnap(sheetSnap === 'peek' ? 'half' : sheetSnap === 'half' ? 'full' : 'peek')
          }
          className="flex min-h-[30px] w-full cursor-pointer items-center justify-center -mt-2 mb-2"
        >
          <div className="h-1.5 w-12 rounded-full bg-slate-700" />
        </div>

        {/* Peek View Header (Always Visible) */}
        <div className="flex items-center justify-between pb-2">
          <div>
            {(() => {
              const quote = seatPrices[seat.seat_id];
              const displayPrice = quote ? Math.round(quote.price) : (seat.price || 380);
              const displayCategory = quote?.category || seat.category || 'Prime';
              return (
                <>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-black text-white">{seat.seat_id}</span>
                    <span className="text-xs text-slate-400">Row {seat.row}</span>
                    <span className="text-xs font-semibold uppercase text-amber-400">
                      {displayCategory}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 font-medium">₹{displayPrice}</div>
                </>
              );
            })()}
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={isBooked || isHeld}
              onClick={() => {
                if (isSelected) deselectSeat(seat.seat_id);
                else selectSeat(seat.seat_id);
              }}
              className={`flex min-h-[44px] min-w-[120px] items-center justify-center gap-1.5 rounded-xl px-4 text-xs font-bold transition ${
                isBooked || isHeld
                  ? 'cursor-not-allowed bg-zinc-800 text-zinc-500'
                  : isSelected
                  ? 'bg-zinc-800 text-red-400 border border-red-500/50'
                  : 'bg-[#e50914] text-white'
              }`}
            >
              {isSelected ? 'Remove' : isBooked ? 'Booked' : isHeld ? 'Held' : 'Select'}
            </button>
          </div>
        </div>

        {/* Expanded Details (Half / Full) */}
        <div className="mt-3 space-y-2 border-t border-slate-800/60 pt-3 text-xs">
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-lg bg-slate-900/80 p-2">
              <div className="text-[10px] text-slate-400">Distance</div>
              <div className="font-semibold text-slate-200">≈ {seat.screen_distance_m_est} m</div>
            </div>
            <div className="rounded-lg bg-slate-900/80 p-2">
              <div className="text-[10px] text-slate-400">Offset</div>
              <div className="font-semibold text-slate-200">
                {formatHorizontalAngle(seat.horizontal_offset_deg)}
              </div>
            </div>
            <div className="rounded-lg bg-slate-900/80 p-2">
              <div className="text-[10px] text-slate-400">Vertical</div>
              <div className="font-semibold text-slate-200">
                {formatVerticalAngle(seat.vertical_angle_deg)}
              </div>
            </div>
            <div className="rounded-lg bg-slate-900/80 p-2">
              <div className="text-[10px] text-slate-400">Coverage</div>
              <div className="font-bold text-[#e50914]">{coverage}%</div>
            </div>
          </div>

          {selectedSeats.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-800">
              <Link
                href={`/checkout?seats=${selectedSeats.join(',')}&total=${totalPrice}`}
                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#e50914] py-3 text-xs font-bold text-white shadow-lg shadow-red-950"
              >
                <span>Continue to Checkout (₹{totalPrice})</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
