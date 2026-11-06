// components/2d/FallbackSeatList.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Compass, Sparkles, ArrowLeft } from 'lucide-react';
import { getShowtimeSeats, holdSeats, type SeatInventoryItem } from '@/services/api';

interface FallbackSeatListProps {
  cinemaId: string;
  auditoriumId: string;
  showtimeId: string;
}

export function FallbackSeatList({
  cinemaId,
  auditoriumId,
  showtimeId,
}: FallbackSeatListProps) {
  const router = useRouter();
  const [seats, setSeats] = useState<SeatInventoryItem[]>([]);
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getShowtimeSeats(parseInt(showtimeId, 10) || 1)
      .then((data) => setSeats(data.seats || []))
      .catch((err) => console.warn(err))
      .finally(() => setLoading(false));
  }, [showtimeId]);

  const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

  function toggleSeat(seat: SeatInventoryItem) {
    if (seat.status !== 'AVAILABLE') return;
    if (selectedSeatIds.includes(seat.seat_id)) {
      setSelectedSeatIds((prev) => prev.filter((id) => id !== seat.seat_id));
    } else {
      if (selectedSeatIds.length >= 6) {
        alert('You can select a maximum of 6 seats per booking.');
        return;
      }
      setSelectedSeatIds((prev) => [...prev, seat.seat_id]);
    }
  }

  const selectedSeats = seats.filter((s) => selectedSeatIds.includes(s.seat_id));
  const totalPrice = selectedSeats.reduce((acc, s) => acc + s.price, 0);

  async function handleContinue() {
    if (selectedSeatIds.length === 0) return;
    try {
      const showtimeNum = parseInt(showtimeId, 10) || 1;
      const res = await holdSeats(showtimeNum, selectedSeatIds);
      router.push(`/checkout?hold_id=${res.hold_id}`);
    } catch (err: any) {
      console.warn('Hold seats error:', err);
    }
  }

  return (
    <div className="min-h-screen bg-[#07080a] text-white p-4 sm:p-8" data-testid="fallback-2d-seat-list">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Navigation back and Mode switcher */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Showtimes</span>
          </button>

          <Link
            href={`/cinemas/${cinemaId}/auditorium/${auditoriumId}?showtime=${showtimeId}`}
            className="flex items-center gap-1.5 rounded-full bg-red-600/20 border border-red-500/30 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-600/30 transition"
          >
            <Compass className="h-3.5 w-3.5 text-amber-400" />
            <span>Switch to 3D Experience</span>
          </Link>
        </div>

        {/* 3D Coming Soon Banner */}
        <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-950/40 via-[#14151c] to-[#12131a] p-5 flex items-start gap-3 shadow-lg">
          <Sparkles className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-sm font-bold text-amber-300">
              3D Auditorium Sightline View Coming Soon for this Screen
            </h2>
            <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
              Our 3D laser-scanning team is currently calibrating this hall. In the meantime, you can select and reserve your preferred seats directly from the 2D layout below.
            </p>
          </div>
        </div>

        {/* Curved Screen Banner */}
        <div className="pt-4 pb-8 flex flex-col items-center">
          <div className="h-2 w-3/4 max-w-lg rounded-full bg-gradient-to-r from-transparent via-red-500/80 to-transparent shadow-[0_0_15px_rgba(229,9,20,0.6)]" />
          <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold mt-2">
            CINEMA SCREEN (EYES THIS WAY)
          </span>
        </div>

        {/* 2D Seat Matrix */}
        {loading ? (
          <div className="p-12 text-center text-zinc-500">Loading auditorium layout...</div>
        ) : (
          <div className="space-y-2 py-4">
            {rows.map((rowLetter) => {
              const rowSeats = seats.filter((s) => s.row === rowLetter || s.seat_id.startsWith(rowLetter));
              return (
                <div key={rowLetter} className="flex items-center justify-center gap-2">
                  <span className="w-5 text-center text-xs font-bold text-zinc-500">{rowLetter}</span>
                  <div className="flex gap-1.5 sm:gap-2">
                    {rowSeats.map((seat) => {
                      const isSelected = selectedSeatIds.includes(seat.seat_id);
                      const isBooked = seat.status === 'BOOKED';
                      const isHeld = seat.status === 'HELD' || seat.status === 'PAYMENT_PENDING';
                      const isAvailable = seat.status === 'AVAILABLE';

                      const seatColor = isSelected
                        ? 'bg-amber-400 text-black border-amber-300 font-bold scale-105 shadow-md shadow-amber-500/30'
                        : isBooked
                        ? 'bg-red-950/60 border-red-900/60 text-red-500 cursor-not-allowed opacity-50'
                        : isHeld
                        ? 'bg-amber-950/60 border-amber-900/60 text-amber-500 cursor-not-allowed opacity-60'
                        : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300 hover:border-emerald-400 hover:scale-105';

                      return (
                        <button
                          key={seat.seat_id}
                          disabled={!isAvailable}
                          onClick={() => toggleSeat(seat)}
                          title={`${seat.seat_id} - ${seat.category} (₹${seat.price}) - ${seat.status}`}
                          className={`flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg border text-[10px] font-semibold transition ${seatColor}`}
                          data-seat-id={seat.seat_id}
                          data-testid={`seat-btn-${seat.seat_id}`}
                        >
                          {seat.number || seat.seat_id.slice(1)}
                        </button>
                      );
                    })}
                  </div>
                  <span className="w-5 text-center text-xs font-bold text-zinc-500">{rowLetter}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-6 pt-4 border-t border-white/10 text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-emerald-950/40 border border-emerald-500/40" />
            <span>Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-amber-400 border border-amber-300" />
            <span>Selected</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-red-950/60 border border-red-900/60 opacity-60" />
            <span>Booked</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-amber-950/60 border border-amber-900/60 opacity-60" />
            <span>Held</span>
          </div>
        </div>

        {/* Selected Seats Bottom Action Bar */}
        {selectedSeatIds.length > 0 && (
          <div className="sticky bottom-4 rounded-2xl border border-white/15 bg-[#14161f]/95 p-4 backdrop-blur-md shadow-2xl flex items-center justify-between">
            <div>
              <div className="text-sm text-zinc-400">
                Selected ({selectedSeatIds.length}): <strong className="text-white">{selectedSeatIds.join(', ')}</strong>
              </div>
              <div className="text-lg font-black text-amber-400 mt-0.5">
                Total: ₹{Math.round(totalPrice)}
              </div>
            </div>

            <button
              onClick={handleContinue}
              className="rounded-xl bg-[#e50914] px-6 py-2.5 text-sm font-bold text-white hover:bg-red-700 transition shadow-lg shadow-red-950/50"
              data-testid="proceed-to-checkout"
            >
              Proceed to Checkout
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
