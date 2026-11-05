'use client';

import React, { useState, useEffect } from 'react';
import { useCinemaStore } from '@/store/useCinemaStore';
import layoutData from '@/public/models/seat_layout_v2.json';
import type { SeatLayoutFile } from '@/lib/types';
import { VirtualJoystick } from './VirtualJoystick';

export function WalkHUD() {
  const mode = useCinemaStore((s) => s.mode);
  const cameraMode = useCinemaStore((s) => s.cameraMode);
  const isWalk = mode === 'walk' || cameraMode === 'walk';

  const hoveredSeatId = useCinemaStore((s) => s.hoveredSeatId);
  const seatStatuses = useCinemaStore((s) => s.seatStatuses);
  const sitAt = useCinemaStore((s) => s.sitAt);
  const teleportToRow = useCinemaStore((s) => s.teleportToRow);
  const setMode = useCinemaStore((s) => s.setMode);

  const [hasDismissedHint, setHasDismissedHint] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setHasDismissedHint(true);
    }, 10000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleLock = () => {
      setIsLocked(!!document.pointerLockElement);
    };
    document.addEventListener('pointerlockchange', handleLock);
    return () => document.removeEventListener('pointerlockchange', handleLock);
  }, []);

  const seatPrices = useCinemaStore((s) => s.seatPrices);
  if (!isWalk) return null;

  const seats = (layoutData as unknown as SeatLayoutFile).seats;
  const hoveredSeat = hoveredSeatId ? seats.find((s) => s.seat_id === hoveredSeatId) : null;
  const status = hoveredSeatId ? seatStatuses[hoveredSeatId] || 'available' : 'available';
  const priceInfo = hoveredSeatId ? seatPrices[hoveredSeatId] : null;
  const price = priceInfo ? Math.round(priceInfo.price) : (hoveredSeat?.price ?? 380);
  const category = (priceInfo?.category ?? hoveredSeat?.category ?? 'Prime').toUpperCase();

  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex flex-col justify-between overflow-hidden">
      {/* Center Crosshair */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative flex items-center justify-center">
          <div className="h-2.5 w-2.5 rounded-full border border-white/80 bg-white/30 backdrop-blur-sm" />
          <div className="absolute h-7 w-0.5 bg-white/20" />
          <div className="absolute h-0.5 w-7 bg-white/20" />
        </div>

        {/* Hovered Seat Aim Tooltip */}
        {hoveredSeat && (
          <div className="pointer-events-auto absolute top-1/2 mt-8 flex flex-col items-center gap-1.5 rounded-2xl border border-white/10 bg-[#07080a]/90 px-4 py-3 text-center shadow-2xl backdrop-blur-md">
            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-bold text-white">
                Seat {hoveredSeat.seat_id}
              </span>
              <span className="rounded-lg bg-white/10 px-2.5 py-0.5 text-sm font-semibold uppercase tracking-wider text-slate-300">
                {category}
              </span>
              <span className="text-base font-bold text-emerald-400">
                ₹{price}
              </span>
            </div>

            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full ${
                  status === 'available'
                    ? 'bg-emerald-500'
                    : status === 'held'
                    ? 'bg-amber-500 animate-pulse'
                    : 'bg-zinc-600'
                }`}
              />
              <span className="capitalize">{status}</span>
            </div>

            <button
              onClick={() => sitAt(hoveredSeat.seat_id)}
              className="mt-1.5 flex min-h-[44px] items-center gap-2 rounded-xl bg-[#C8102E] px-4 py-2 text-sm font-bold text-white shadow hover:bg-[#A60D26]"
            >
              <span>Sit Down</span>
              <kbd className="rounded bg-black/30 px-2 py-0.5 text-sm font-mono text-white/90">E</kbd>
            </button>
          </div>
        )}
      </div>

      {/* Top Banner: First-time walk hint or Click to Look overlay (clears top bar) */}
      {!hasDismissedHint && !isLocked && (
        <div className="pointer-events-auto mx-auto mt-28 max-w-lg rounded-2xl border border-white/10 bg-black/85 p-4 text-center shadow-xl backdrop-blur-md">
          <p className="text-sm font-medium text-slate-200">
            <span className="font-bold text-[#C8102E]">First-Person Walk Mode:</span> Click canvas to lock mouse view. Use <kbd className="rounded bg-white/20 px-2 py-0.5 text-sm font-mono font-bold">W</kbd> <kbd className="rounded bg-white/20 px-2 py-0.5 text-sm font-mono font-bold">A</kbd> <kbd className="rounded bg-white/20 px-2 py-0.5 text-sm font-mono font-bold">S</kbd> <kbd className="rounded bg-white/20 px-2 py-0.5 text-sm font-mono font-bold">D</kbd> or arrow keys to walk up the aisle.
          </p>
          <button
            onClick={() => setHasDismissedHint(true)}
            className="mt-2.5 text-sm font-semibold text-slate-300 underline hover:text-white"
          >
            Got it, dismiss
          </button>
        </div>
      )}

      {/* Bottom Controls Bar */}
      <div className="pointer-events-auto flex items-center justify-between border-t border-white/10 bg-[#07080a]/90 px-6 py-3 backdrop-blur-md">
        {/* Key Hints */}
        <div className="hidden md:flex items-center gap-5 text-sm text-slate-300">
          <div className="flex items-center gap-1.5">
            <span className="rounded border border-white/20 bg-white/10 px-2 py-0.5 font-mono text-sm font-bold">W A S D</span>
            <span>Move</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="rounded border border-white/20 bg-white/10 px-2 py-0.5 font-mono text-sm font-bold">Shift</span>
            <span>Run</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="rounded border border-white/20 bg-white/10 px-2 py-0.5 font-mono text-sm font-bold">Mouse</span>
            <span>Look</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="rounded border border-white/20 bg-white/10 px-2 py-0.5 font-mono text-sm font-bold">E / Enter</span>
            <span>Sit in Seat</span>
          </div>
        </div>

        {/* Teleport / Row quick jump */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-400">Jump to row:</span>
          <div className="flex gap-1.5 overflow-x-auto">
            {['A', 'C', 'E', 'G', 'J'].map((row) => (
              <button
                key={row}
                onClick={() => teleportToRow(row)}
                className="min-h-[40px] rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/20"
              >
                Row {row}
              </button>
            ))}
          </div>

          <button
            onClick={() => setMode('overview')}
            className="ml-3 min-h-[40px] rounded-lg bg-white/10 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/20"
          >
            Overview (O)
          </button>
        </div>
      </div>

      {/* Virtual Joystick for Mobile */}
      <VirtualJoystick />
    </div>
  );
}
