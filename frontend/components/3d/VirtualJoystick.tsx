'use client';

import React, { useRef, useState, useEffect } from 'react';
import { useCinemaStore } from '@/store/useCinemaStore';

export function VirtualJoystick() {
  const mode = useCinemaStore((s) => s.mode);
  const isWalk = mode === 'walk';

  const hoveredSeatId = useCinemaStore((s) => s.hoveredSeatId);
  const sitAt = useCinemaStore((s) => s.sitAt);
  const updateWalkPose = useCinemaStore((s) => s.updateWalkPose);
  const walkPlayer = useCinemaStore((s) => s.walkPlayer);

  const [isRunning, setIsRunning] = useState(false);
  const [joystickActive, setJoystickActive] = useState(false);
  const [knobPos, setKnobPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const joystickRef = useRef<HTMLDivElement>(null);
  const touchIdRef = useRef<number | null>(null);
  const moveIntervalRef = useRef<any>(null);

  if (!isWalk) return null;

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    touchIdRef.current = touch.identifier;
    setJoystickActive(true);
    updateJoystickKnob(touch.clientX, touch.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === touchIdRef.current) {
        updateJoystickKnob(touch.clientX, touch.clientY);
        break;
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === touchIdRef.current) {
        touchIdRef.current = null;
        setJoystickActive(false);
        setKnobPos({ x: 0, y: 0 });
        break;
      }
    }
  };

  const updateJoystickKnob = (clientX: number, clientY: number) => {
    if (!joystickRef.current) return;
    const rect = joystickRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const maxDist = rect.width / 2;

    const dist = Math.hypot(dx, dy);
    const clampedDist = Math.min(dist, maxDist);
    const angle = Math.atan2(dy, dx);

    const nx = Math.cos(angle) * (clampedDist / maxDist);
    const ny = Math.sin(angle) * (clampedDist / maxDist);

    setKnobPos({ x: nx * (maxDist * 0.7), y: ny * (maxDist * 0.7) });
  };

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-16 z-40 flex items-end justify-between px-6 pb-2 md:hidden">
      {/* Left Virtual Joystick */}
      <div
        ref={joystickRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        className="pointer-events-auto relative flex h-28 w-28 items-center justify-center rounded-full border-2 border-white/20 bg-black/40 backdrop-blur-md touch-none"
      >
        <div
          style={{
            transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
          }}
          className="h-12 w-12 rounded-full border border-white/40 bg-white/30 shadow-lg backdrop-blur-sm"
        />
      </div>

      {/* Right Action buttons: Run Toggle + Sit Button */}
      <div className="pointer-events-auto flex flex-col items-end gap-3">
        {hoveredSeatId && (
          <button
            onClick={() => sitAt(hoveredSeatId)}
            className="flex items-center gap-1.5 rounded-full bg-[#e50914] px-5 py-3 text-sm font-bold text-white shadow-xl hover:bg-[#b80710] active:scale-95"
          >
            Sit in {hoveredSeatId}
          </button>
        )}

        <button
          onClick={() => setIsRunning(!isRunning)}
          className={`flex h-12 w-12 items-center justify-center rounded-full border text-sm font-bold shadow-lg transition-colors ${
            isRunning
              ? 'border-[#e50914] bg-[#e50914] text-white'
              : 'border-white/20 bg-black/40 text-slate-300'
          }`}
        >
          {isRunning ? 'RUN' : 'WALK'}
        </button>
      </div>
    </div>
  );
}

