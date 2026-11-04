'use client';

import React from 'react';
import { useCinemaStore } from '@/store/useCinemaStore';
import {
  Orbit,
  Footprints,
  Eye,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  LogOut,
} from 'lucide-react';

export function ViewModeToggle() {
  const mode = useCinemaStore((s) => s.mode);
  const cameraMode = useCinemaStore((s) => s.cameraMode);
  const currentMode = mode || (cameraMode === 'pov' ? 'seated' : cameraMode === 'walk' ? 'walk' : 'overview');

  const cameraPreset = useCinemaStore((s) => s.cameraPreset);
  const setCameraPreset = useCinemaStore((s) => s.setCameraPreset);
  const activeSeatId = useCinemaStore((s) => s.activeSeatId);
  const setMode = useCinemaStore((s) => s.setMode);
  const sitAt = useCinemaStore((s) => s.sitAt);
  const standUp = useCinemaStore((s) => s.standUp);
  const navigatePOV = useCinemaStore((s) => s.navigatePOV);
  const storeFov = useCinemaStore((s) => s.fov);
  const setFOV = useCinemaStore((s) => s.setFOV);

  return (
    <div className="pointer-events-none fixed top-20 left-1/2 z-30 -translate-x-1/2 flex flex-col items-center gap-2">
      {/* Main Mode Switcher Pill */}
      <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-slate-800/80 bg-[#0e1117]/95 p-1.5 shadow-2xl backdrop-blur-md">
        {/* Three Primary Modes (§5b) */}
        <button
          onClick={() => setMode('overview')}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
            currentMode === 'overview'
              ? 'bg-[#e50914] text-white shadow'
              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
          title="Overview 3D Orbit View"
        >
          <Orbit className="h-3.5 w-3.5" />
          <span>Overview</span>
        </button>

        <button
          onClick={() => setMode('walk')}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
            currentMode === 'walk'
              ? 'bg-[#e50914] text-white shadow'
              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
          title="Walk around auditorium in first-person"
        >
          <Footprints className="h-3.5 w-3.5" />
          <span>Walk Mode</span>
        </button>

        <button
          onClick={() => {
            if (activeSeatId) sitAt(activeSeatId);
            else setMode('seated');
          }}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
            currentMode === 'seated'
              ? 'bg-[#e50914] text-white shadow'
              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
          title="Seated sightline POV"
        >
          <Eye className="h-3.5 w-3.5" />
          <span>Seated POV {activeSeatId ? `(${activeSeatId})` : ''}</span>
        </button>

        {/* Overview Presets Sub-menu */}
        {currentMode === 'overview' && (
          <div className="flex items-center gap-1 pl-2 border-l border-slate-800">
            <PresetButton
              active={cameraPreset === 'overview'}
              label="Default"
              onClick={() => setCameraPreset('overview')}
            />
            <PresetButton
              active={cameraPreset === 'front'}
              label="Front"
              onClick={() => setCameraPreset('front')}
            />
            <PresetButton
              active={cameraPreset === 'back'}
              label="Back"
              onClick={() => setCameraPreset('back')}
            />
            <PresetButton
              active={cameraPreset === 'aerial'}
              label="Aerial"
              onClick={() => setCameraPreset('aerial')}
            />
          </div>
        )}

        {/* Seated Controls Sub-menu */}
        {currentMode === 'seated' && (
          <div className="flex items-center gap-1.5 pl-2 border-l border-slate-800">
            {/* Quick seat stepping */}
            <div className="flex items-center gap-0.5 rounded-full bg-slate-900/80 p-0.5">
              <button
                onClick={() => navigatePOV('prev')}
                className="rounded-full p-1 text-slate-300 hover:bg-slate-800 hover:text-white"
                title="Previous Seat (Q)"
              >
                <ArrowLeft className="h-3 w-3" />
              </button>
              <button
                onClick={() => navigatePOV('next')}
                className="rounded-full p-1 text-slate-300 hover:bg-slate-800 hover:text-white"
                title="Next Seat (E)"
              >
                <ArrowRight className="h-3 w-3" />
              </button>
              <button
                onClick={() => navigatePOV('prevRow')}
                className="rounded-full p-1 text-slate-300 hover:bg-slate-800 hover:text-white"
                title="Row Ahead (Z)"
              >
                <ArrowUp className="h-3 w-3" />
              </button>
              <button
                onClick={() => navigatePOV('nextRow')}
                className="rounded-full p-1 text-slate-300 hover:bg-slate-800 hover:text-white"
                title="Row Behind (X)"
              >
                <ArrowDown className="h-3 w-3" />
              </button>
            </div>

            {/* Stand Up button */}
            <button
              onClick={standUp}
              className="flex items-center gap-1 rounded-full bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-700"
              title="Stand up to aisle (Esc / F)"
            >
              <LogOut className="h-3 w-3 text-slate-400" />
              <span>Stand Up</span>
            </button>
          </div>
        )}

        {/* Camera Lens FOV Selector */}
        <div className="flex items-center gap-1 pl-2 border-l border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-400 px-1">FOV</span>
          {[50, 60, 70, 75].map((val) => (
            <button
              key={val}
              onClick={() => setFOV(val)}
              className={`rounded px-1.5 py-0.5 text-[10px] font-mono font-bold ${
                storeFov === val
                  ? 'bg-slate-700 text-sky-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {val}°
            </button>
          ))}
        </div>
      </div>
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
      className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
        active
          ? 'bg-slate-800 text-white font-semibold'
          : 'text-slate-400 hover:text-slate-200'
      }`}
    >
      {label}
    </button>
  );
}
