'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useCinemaStore, DEFAULT_CAMERA_POS, DEFAULT_CAMERA_TARGET } from '@/store/useCinemaStore';
import {
  Compass,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Zap,
  HelpCircle,
  X,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  Eye,
  Footprints,
} from 'lucide-react';
import layoutData from '@/public/models/seat_layout_v2.json';
import type { SeatLayoutFile } from '@/lib/types';

interface DroneHUDProps {
  onSwitchTo2D?: () => void;
}

export function DroneHUD({ onSwitchTo2D }: DroneHUDProps) {
  const mode = useCinemaStore((s) => s.mode);
  const cameraMode = useCinemaStore((s) => s.cameraMode);
  const isDrone = mode === 'overview' || cameraMode === 'drone' || cameraMode === 'orbit';

  const hoveredSeatId = useCinemaStore((s) => s.hoveredSeatId);
  const seatStatuses = useCinemaStore((s) => s.seatStatuses);
  const seatPrices = useCinemaStore((s) => s.seatPrices);
  const selectSeat = useCinemaStore((s) => s.selectSeat);
  const sitAt = useCinemaStore((s) => s.sitAt);
  const setMode = useCinemaStore((s) => s.setMode);

  const [showHelp, setShowHelp] = useState(false);
  const [boostActive, setBoostActive] = useState(false);

  if (!isDrone) return null;

  const seats = (layoutData as unknown as SeatLayoutFile).seats;
  const hoveredSeat = hoveredSeatId ? seats.find((s) => s.seat_id === hoveredSeatId) : null;
  const status = hoveredSeatId ? seatStatuses[hoveredSeatId] || 'available' : 'available';
  const priceInfo = hoveredSeatId ? seatPrices[hoveredSeatId] : null;
  const price = priceInfo ? Math.round(priceInfo.price) : (hoveredSeat?.price ?? 380);
  const category = (priceInfo?.category ?? hoveredSeat?.category ?? 'Prime').toUpperCase();

  const handleJump = (pos: [number, number, number], target?: [number, number, number]) => {
    window.dispatchEvent(
      new CustomEvent('drone-quick-jump', {
        detail: { pos, target },
      })
    );
  };

  const handleResetView = () => {
    handleJump(DEFAULT_CAMERA_POS, DEFAULT_CAMERA_TARGET);
  };

  const handleFrontJump = () => {
    handleJump([0.0, 4.5, -11.0], [0.0, 4.0, -8.0]);
  };

  const handleMiddleJump = () => {
    handleJump([0.0, 6.8, -16.5], [0.0, 4.0, -8.0]);
  };

  const handleBackJump = () => {
    handleJump([0.0, 8.8, -23.0], [0.0, 4.0, -8.0]);
  };

  const handleElevation = (dir: 'up' | 'down') => {
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: dir === 'up' ? ' ' : 'c',
        code: dir === 'up' ? 'Space' : 'KeyC',
      })
    );
    setTimeout(() => {
      window.dispatchEvent(
        new KeyboardEvent('keyup', {
          key: dir === 'up' ? ' ' : 'c',
          code: dir === 'up' ? 'Space' : 'KeyC',
        })
      );
    }, 200);
  };

  const toggleBoost = () => {
    const next = !boostActive;
    setBoostActive(next);
    window.dispatchEvent(
      new KeyboardEvent(next ? 'keydown' : 'keyup', {
        key: 'Shift',
      })
    );
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex flex-col justify-between p-4 sm:p-6 overflow-hidden select-none">
      {/* Top Left: Return to 2D Map always visible */}
      <div className="flex items-center gap-3">
        {onSwitchTo2D && (
          <button
            onClick={onSwitchTo2D}
            data-testid="drone-return-2d-btn"
            className="pointer-events-auto flex min-h-[44px] items-center gap-2 rounded-2xl border border-white/20 bg-black/60 px-4 py-2.5 text-sm font-bold text-white shadow-xl backdrop-blur-md hover:bg-black/80 transition active:scale-95"
            aria-label="Return to 2D Seat Map"
          >
            <ArrowLeft className="h-4 w-4 text-[#C8102E]" />
            <span>2D Seat Map</span>
          </button>
        )}

        {/* Mode Switch to Walk: drops user to nearest aisle */}
        <button
          onClick={() => setMode('walk')}
          data-testid="drone-to-walk-btn"
          className="pointer-events-auto flex min-h-[44px] items-center gap-2 rounded-2xl border border-white/20 bg-black/60 px-4 py-2.5 text-sm font-bold text-white shadow-xl backdrop-blur-md hover:bg-black/80 transition active:scale-95"
          title="Switch to Walk Mode (drops to aisle)"
        >
          <Footprints className="h-4 w-4 text-emerald-400" />
          <span>Walk Mode</span>
        </button>
      </div>

      {/* Center Reticle / Drone Aim with Seat Tooltip */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative flex items-center justify-center">
          <div className="h-3 w-3 rounded-full border border-white/90 bg-white/20 backdrop-blur-sm" />
          <div className="absolute h-8 w-0.5 bg-white/30" />
          <div className="absolute h-0.5 w-8 bg-white/30" />
        </div>

        {/* Hovered Seat Tooltip in Flight */}
        {hoveredSeat && (
          <div
            data-testid="drone-seat-tooltip"
            className="pointer-events-auto absolute top-1/2 mt-10 flex flex-col items-center gap-1.5 rounded-2xl border border-white/20 bg-black/85 px-4 py-3 text-center shadow-2xl backdrop-blur-md"
          >
            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-black text-white">Seat {hoveredSeat.seat_id}</span>
              <span className="rounded-md bg-white/20 px-2 py-0.5 text-xs font-bold uppercase text-slate-200">
                {category}
              </span>
              <span className="text-base font-bold text-amber-300">₹{price}</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <button
                onClick={() => selectSeat(hoveredSeat.seat_id)}
                className="rounded-lg bg-[#C8102E] px-3 py-1 text-xs font-bold text-white hover:bg-rose-700 transition"
              >
                Select Seat
              </button>
              <button
                onClick={() => sitAt(hoveredSeat.seat_id)}
                className="rounded-lg bg-white/20 px-3 py-1 text-xs font-bold text-white hover:bg-white/30 transition flex items-center gap-1"
              >
                <Eye className="h-3 w-3" />
                <span>Sit Here</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Top Right: Quick Jumps & Reset View */}
      <div className="pointer-events-auto fixed top-16 right-4 sm:right-6 flex flex-col items-end gap-2 z-40">
        <div className="flex items-center gap-1.5 rounded-2xl border border-white/20 bg-black/60 p-1.5 shadow-xl backdrop-blur-md">
          <button
            onClick={handleResetView}
            data-testid="drone-reset-view-btn"
            className="flex min-h-[40px] items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold text-white hover:bg-white/20 transition"
            title="Reset Drone View to Full Auditorium Overview"
          >
            <RotateCcw className="h-3.5 w-3.5 text-amber-400" />
            <span>Reset View</span>
          </button>
          <span className="text-white/30">|</span>
          <button
            onClick={handleFrontJump}
            data-testid="drone-jump-front"
            className="min-h-[40px] rounded-xl px-2.5 py-1.5 text-xs font-bold text-white hover:bg-white/20 transition"
          >
            Front
          </button>
          <button
            onClick={handleMiddleJump}
            data-testid="drone-jump-middle"
            className="min-h-[40px] rounded-xl px-2.5 py-1.5 text-xs font-bold text-white hover:bg-white/20 transition"
          >
            Middle
          </button>
          <button
            onClick={handleBackJump}
            data-testid="drone-jump-back"
            className="min-h-[40px] rounded-xl px-2.5 py-1.5 text-xs font-bold text-white hover:bg-white/20 transition"
          >
            Back
          </button>
        </div>

        {/* Collapsible Controls Hint Toggle */}
        <button
          onClick={() => setShowHelp(!showHelp)}
          data-testid="drone-help-toggle"
          className="flex items-center gap-1.5 rounded-xl border border-white/20 bg-black/60 px-3 py-1.5 text-xs font-bold text-slate-300 hover:text-white transition"
        >
          <HelpCircle className="h-3.5 w-3.5" />
          <span>Flight Controls</span>
          {showHelp ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>

        {/* Collapsible Instructions Card */}
        {showHelp && (
          <div
            data-testid="drone-controls-card"
            className="w-72 rounded-2xl border border-white/20 bg-black/85 p-4 text-xs text-slate-200 shadow-2xl backdrop-blur-md space-y-2 mt-1"
          >
            <div className="flex items-center justify-between font-bold text-white border-b border-white/10 pb-2">
              <span>Drone Flight Navigation</span>
              <button onClick={() => setShowHelp(false)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5 pt-1">
              <div><kbd className="bg-white/15 px-1.5 py-0.5 rounded text-[11px] font-mono">WASD / Arrows</kbd> Move</div>
              <div><kbd className="bg-white/15 px-1.5 py-0.5 rounded text-[11px] font-mono">Mouse Drag</kbd> Look</div>
              <div><kbd className="bg-white/15 px-1.5 py-0.5 rounded text-[11px] font-mono">Space</kbd> Ascend</div>
              <div><kbd className="bg-white/15 px-1.5 py-0.5 rounded text-[11px] font-mono">C</kbd> Descend</div>
              <div><kbd className="bg-white/15 px-1.5 py-0.5 rounded text-[11px] font-mono">Q / E</kbd> Turn Yaw</div>
              <div><kbd className="bg-white/15 px-1.5 py-0.5 rounded text-[11px] font-mono">Shift</kbd> Turbo Boost</div>
              <div><kbd className="bg-white/15 px-1.5 py-0.5 rounded text-[11px] font-mono">Wheel / Pinch</kbd> Zoom</div>
              <div><kbd className="bg-white/15 px-1.5 py-0.5 rounded text-[11px] font-mono">Ctrl / Alt</kbd> Slow Precision</div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Controls Bar (Touch Friendly: Elevation Buttons & Boost Toggle) */}
      <div className="pointer-events-auto flex items-end justify-between w-full">
        {/* Left Side: Drone Mode Status Indicator */}
        <div className="rounded-2xl border border-white/20 bg-black/60 px-4 py-2.5 text-xs font-bold text-slate-200 backdrop-blur-md shadow-xl flex items-center gap-2">
          <Compass className="h-4 w-4 text-amber-400 animate-spin-slow" />
          <span>DRONE HOVER MODE</span>
        </div>

        {/* Right Side: Elevation & Boost Controls */}
        <div className="flex items-center gap-2">
          {/* Boost Toggle */}
          <button
            onClick={toggleBoost}
            data-testid="drone-boost-btn"
            className={`flex min-h-[44px] items-center gap-1.5 rounded-2xl border px-3.5 py-2 text-xs font-bold transition shadow-xl ${
              boostActive
                ? 'bg-amber-500 text-black border-amber-400 font-black ring-2 ring-amber-300'
                : 'bg-black/60 text-white border-white/20 hover:bg-black/80'
            }`}
            title="Toggle Turbo Flight Speed"
          >
            <Zap className="h-4 w-4 fill-current" />
            <span>BOOST</span>
          </button>

          {/* Ascend Button (Up) */}
          <button
            onClick={() => handleElevation('up')}
            data-testid="drone-ascend-btn"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl border border-white/20 bg-black/60 text-white shadow-xl hover:bg-black/80 active:scale-95 transition"
            aria-label="Ascend Drone"
          >
            <ArrowUp className="h-5 w-5" />
          </button>

          {/* Descend Button (Down) */}
          <button
            onClick={() => handleElevation('down')}
            data-testid="drone-descend-btn"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl border border-white/20 bg-black/60 text-white shadow-xl hover:bg-black/80 active:scale-95 transition"
            aria-label="Descend Drone"
          >
            <ArrowDown className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

