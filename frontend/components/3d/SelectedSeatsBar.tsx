'use client';

import React, { useMemo } from 'react';
import { useCinemaStore } from '@/store/useCinemaStore';
import layoutData from '@/public/models/seat_layout_v2.json';
import type { SeatLayoutFile, SeatRecord } from '@/lib/types';
import { X, ArrowRight, Ticket } from 'lucide-react';
import Link from 'next/link';

export function SelectedSeatsBar() {
  const selectedSeats = useCinemaStore((s) => s.selectedSeats);
  const deselectSeat = useCinemaStore((s) => s.deselectSeat);
  const clearSelection = useCinemaStore((s) => s.clearSelection);
  const cameraMode = useCinemaStore((s) => s.cameraMode);

  const seats = (layoutData as unknown as SeatLayoutFile).seats;
  const seatMap = useMemo(() => {
    const map = new Map<string, SeatRecord>();
    for (const s of seats) map.set(s.seat_id, s);
    return map;
  }, [seats]);

  const totalPrice = useMemo(() => {
    return selectedSeats.reduce((acc, id) => {
      const seat = seatMap.get(id);
      return acc + (seat ? seat.price : 0);
    }, 0);
  }, [selectedSeats, seatMap]);

  if (selectedSeats.length === 0) return null;

  return (
    <div
      className={`pointer-events-none fixed bottom-4 left-1/2 z-30 w-full max-w-2xl -translate-x-1/2 px-4 transition-all duration-300 ${
        cameraMode === 'pov' ? 'opacity-40 hover:opacity-100' : 'opacity-100'
      }`}
    >
      <div className="pointer-events-auto flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-slate-800/90 bg-[#0e1117]/95 p-4 shadow-2xl backdrop-blur-md">
        {/* Selected Seat Chips */}
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
            <Ticket className="h-4 w-4 text-[#e50914]" />
            <span>Seats ({selectedSeats.length}/8):</span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {selectedSeats.map((seatId) => {
              const seat = seatMap.get(seatId);
              return (
                <div
                  key={seatId}
                  className="flex items-center gap-1.5 rounded-lg border border-red-900/60 bg-red-950/40 px-2.5 py-1 text-xs font-semibold text-red-200"
                >
                  <span>{seatId}</span>
                  <span className="text-[10px] text-slate-400">₹{seat?.price}</span>
                  <button
                    onClick={() => deselectSeat(seatId)}
                    className="ml-0.5 rounded p-0.5 text-red-400 hover:bg-red-900/60 hover:text-white"
                    aria-label={`Remove seat ${seatId}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>

          {selectedSeats.length > 1 && (
            <button
              onClick={clearSelection}
              className="text-[11px] text-slate-500 hover:text-slate-300 ml-1 underline"
            >
              Clear
            </button>
          )}
        </div>

        {/* Total Price and Checkout Stub Button */}
        <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 border-slate-800 pt-2 sm:pt-0">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Total</div>
            <div className="text-xl font-black text-white">₹{totalPrice}</div>
          </div>

          <Link
            href={`/checkout?seats=${selectedSeats.join(',')}&total=${totalPrice}`}
            className="flex items-center gap-2 rounded-xl bg-[#e50914] px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-red-950/80 transition hover:bg-red-700 active:scale-95"
            title="Phase 4 stub: continues with selected seats state"
          >
            <span>Continue to Checkout</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
