'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useCinemaStore } from '@/store/useCinemaStore';
import layoutData from '@/public/models/seat_layout_v2.json';
import type { SeatLayoutFile, SeatRecord } from '@/lib/types';

export function SeatHoverTooltip() {
  const hoveredSeatId = useCinemaStore((s) => s.hoveredSeatId);
  const seatPrices = useCinemaStore((s) => s.seatPrices);
  const seatStatuses = useCinemaStore((s) => s.seatStatuses);
  const selectedSeats = useCinemaStore((s) => s.selectedSeats);
  const mode = useCinemaStore((s) => s.mode);
  const cameraMode = useCinemaStore((s) => s.cameraMode);
  const auditoriumLayout = useCinemaStore((s) => s.auditoriumLayout);

  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(() => {
    if (typeof window !== 'undefined') {
      return { x: Math.round(window.innerWidth / 2), y: Math.round(window.innerHeight / 2) };
    }
    return null;
  });

  const seats = auditoriumLayout?.seats || (layoutData as unknown as SeatLayoutFile).seats;
  const seat = useMemo(() => {
    if (!hoveredSeatId) return null;
    return seats.find((s) => s.seat_id === hoveredSeatId) || null;
  }, [hoveredSeatId, seats]);

  // Track mouse coordinates over the 3D canvas
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Do not display this cursor tooltip in first-person Walk mode (WalkHUD handles crosshair target)
  const isWalk = mode === 'walk' || cameraMode === 'walk';
  if (isWalk || !seat || !mousePos) {
    return null;
  }

  const status = seatStatuses[seat.seat_id] || 'available';
  const isSelected = selectedSeats.includes(seat.seat_id);
  const isBooked = status === 'booked';
  const isHeld = status === 'held';

  const priceQuote = seatPrices[seat.seat_id];
  const displayPrice = priceQuote ? Math.round(priceQuote.price) : (seat.price ?? 380);
  const displayCategory = (priceQuote?.category ?? seat.category ?? 'Prime').toUpperCase();

  // Position calculation: offset from cursor, flip near viewport edges
  const tooltipWidth = 230;
  const tooltipHeight = 105;
  const padding = 16;

  let posX = mousePos.x + 18;
  let posY = mousePos.y - tooltipHeight - 16;

  // Flip horizontally if overflow right
  if (typeof window !== 'undefined') {
    if (posX + tooltipWidth > window.innerWidth - padding) {
      posX = mousePos.x - tooltipWidth - 18;
    }
    // Flip vertically if overflow top (e.g. near top navbar)
    if (posY < 64) {
      posY = mousePos.y + 24;
    }
    // Clamp inside viewport
    posX = Math.max(padding, Math.min(posX, window.innerWidth - tooltipWidth - padding));
    posY = Math.max(64, Math.min(posY, window.innerHeight - tooltipHeight - padding));
  }

  const categoryColorClass =
    displayCategory.toLowerCase() === 'premier'
      ? 'bg-rose-50 text-[#9F1239] border-rose-300'
      : displayCategory.toLowerCase() === 'front'
        ? 'bg-amber-50 text-[#8D5B28] border-amber-300'
        : 'bg-blue-50 text-[#1E40AF] border-blue-300';

  const hintText = isBooked
    ? 'Sold out'
    : isHeld
      ? 'Held by patron'
      : isSelected
        ? 'Click to deselect'
        : 'Click to select';

  return (
    <div
      data-testid={`seat-tooltip-${seat.seat_id}`}
      role="tooltip"
      style={{
        position: 'fixed',
        left: `${posX}px`,
        top: `${posY}px`,
        width: `${tooltipWidth}px`,
        pointerEvents: 'none', // Strictly non-interactive; never intercepts pointer events
        userSelect: 'none',
        zIndex: 45,
      }}
      className="pointer-events-none select-none rounded-2xl border border-[#E6DCD2] bg-white/95 p-3.5 shadow-2xl backdrop-blur-md text-[#1B1320] transition-transform duration-75 ease-out"
    >
      {/* Header: Seat ID & Category (No buttons, no scores) */}
      <div className="flex items-center justify-between border-b border-[#E6DCD2] pb-1.5">
        <span className="text-base font-black tracking-tight text-[#1B1320]">
          Seat {seat.seat_id}
        </span>
        <span
          className={`rounded-md border px-2 py-0.5 text-xs font-bold uppercase tracking-wider ${categoryColorClass}`}
        >
          {displayCategory}
        </span>
      </div>

      {/* Body: Price (22px bold) & Status / Hint */}
      <div className="mt-2 flex items-baseline justify-between">
        <div className="text-[22px] font-black text-[#C8102E] leading-none">
          ₹{displayPrice}
        </div>
        <div className="text-sm font-semibold text-slate-600">
          {hintText}
        </div>
      </div>
    </div>
  );
}
