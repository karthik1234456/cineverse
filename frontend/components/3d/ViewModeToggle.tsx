'use client';

import React from 'react';
import { useCinemaStore } from '@/store/useCinemaStore';
import {
  Orbit,
  Eye,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

export function ViewModeToggle() {
  const cameraMode = useCinemaStore((s) => s.cameraMode);
  const cameraPreset = useCinemaStore((s) => s.cameraPreset);
  const setCameraPreset = useCinemaStore((s) => s.setCameraPreset);
  const activeSeatId = useCinemaStore((s) => s.activeSeatId);
  const exitPOV = useCinemaStore((s) => s.exitPOV);
  const enterPOV = useCinemaStore((s) => s.enterPOV);
  const navigatePOV = useCinemaStore((s) => s.navigatePOV);
  const storeFov = useCinemaStore((s) => s.fov);
  const setFOV = useCinemaStore((s) => s.setFOV);

  return (
    <div className="pointer-events-none fixed top-4 left-1/2 z-30 -translate-x-1/2 flex flex-col items-center gap-2">
      {/* Main Pill Controls */}
      <div className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-slate-800/80 bg-[#0e1117]/90 p-1.5 shadow-2xl backdrop-blur-md">
        {cameraMode === 'orbit' ? (
          <>
            {/* Presets */}
            <div className="flex items-center gap-1 pr-1 border-r border-slate-800">
              <PresetButton
                active={cameraPreset === 'overview'}
                label="Overview"
                onClick={() => setCameraPreset('overview')}
              />
              <PresetButton
                active={cameraPreset === 'front'}
                label="Front Rows"
                onClick={() => setCameraPreset('front')}
              />
              <PresetButton
                active={cameraPreset === 'back'}
                label="Back Rows"
                onClick={() => setCameraPreset('back')}
              />
              <PresetButton
                active={cameraPreset === 'aerial'}
                label="Aerial Map"
                onClick={() => setCameraPreset('aerial')}
              />
            </div>

            {/* Quick POV Trigger */}
            <button
              onClick={() => {
                if (activeSeatId) enterPOV(activeSeatId);
              }}
              className="flex items-center gap-1.5 rounded-full bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-sky-400 hover:bg-slate-700 hover:text-sky-300"
              title="Preview POV for selected seat"
            >
              <Eye className="h-3.5 w-3.5" />
              <span>Seat POV ({activeSeatId || 'A01'})</span>
            </button>
          </>
        ) : (
          /* POV Controls */
          <div className="flex items-center gap-2 px-2 py-0.5">
            <button
              onClick={exitPOV}
              className="flex items-center gap-1.5 rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-700"
              title="Return to Orbit Mode (Esc)"
            >
              <Orbit className="h-3.5 w-3.5 text-slate-400" />
              <span>Orbit View</span>
            </button>

            <span className="text-xs font-bold text-white px-1">
              Seat {activeSeatId} POV
            </span>

            {/* Navigation Arrows */}
            <div className="flex items-center gap-0.5 bg-slate-900/80 rounded-full p-0.5">
              <button
                onClick={() => navigatePOV('prev')}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                title="Previous Seat (Left Arrow)"
              >
                <ArrowLeft className="h-3 w-3" />
              </button>
              <button
                onClick={() => navigatePOV('next')}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                title="Next Seat (Right Arrow)"
              >
                <ArrowRight className="h-3 w-3" />
              </button>
              <button
                onClick={() => navigatePOV('prevRow')}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                title="Forward Row (Up Arrow)"
              >
                <ArrowUp className="h-3 w-3" />
              </button>
              <button
                onClick={() => navigatePOV('nextRow')}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                title="Back Row (Down Arrow)"
              >
                <ArrowDown className="h-3 w-3" />
              </button>
            </div>

            {/* FOV Toggle */}
            <div className="flex items-center gap-1 border-l border-slate-800 pl-2">
              <span className="text-[10px] text-slate-400">Lens:</span>
              {[50, 60, 75].map((f) => (
                <button
                  key={f}
                  onClick={() => setFOV(f)}
                  className={`rounded px-1.5 py-0.5 text-[10px] font-mono font-semibold ${
                    storeFov === f
                      ? 'bg-[#e50914] text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {f}°
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* POV Look Instructions Banner */}
      {cameraMode === 'pov' && (
        <div className="pointer-events-auto rounded-full bg-slate-900/85 border border-slate-800/80 px-3 py-1 text-[11px] text-slate-400 backdrop-blur-md">
          Drag to look around (yaw ±60°, pitch ±25°) • Press <kbd className="text-slate-200">Esc</kbd> to exit
        </div>
      )}
    </div>
  );
}

function PresetButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
        active
          ? 'bg-[#e50914] text-white shadow-[0_0_8px_rgba(229,9,20,0.4)]'
          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
      }`}
    >
      {label}
    </button>
  );
}
