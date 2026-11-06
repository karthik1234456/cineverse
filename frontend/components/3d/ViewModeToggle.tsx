'use client';

import React, { useState } from 'react';
import { useCinemaStore } from '@/store/useCinemaStore';
import {
  Orbit,
  Footprints,
  Eye,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  LogOut,
  Flame,
  Settings,
  Sun,
  Moon,
  Sparkles,
  Zap,
  X,
} from 'lucide-react';
import { THEATRE_LOOKS, type TheatreLookId } from '@/lib/theatreLooks';

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
  const isHeatmapActive = useCinemaStore((s) => s.isHeatmapActive);
  const toggleHeatmap = useCinemaStore((s) => s.toggleHeatmap);
  const theatreLook = useCinemaStore((s) => s.theatreLook);
  const setTheatreLook = useCinemaStore((s) => s.setTheatreLook);
  const houseLights = useCinemaStore((s) => s.houseLights);
  const setHouseLights = useCinemaStore((s) => s.setHouseLights);
  const qualityTier = useCinemaStore((s) => s.qualityTier);
  const setQualityTier = useCinemaStore((s) => s.setQualityTier);
  const qualityMode = useCinemaStore((s) => s.qualityMode);
  const setQualityMode = useCinemaStore((s) => s.setQualityMode);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <div className="pointer-events-none fixed top-16 left-1/2 z-30 -translate-x-1/2 flex flex-col items-center gap-2">
      {/* Primary Minimal 3-Way Mode Switcher + Settings Button (Part E Compliance) */}
      <div className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-[#E6DCD2] bg-white/95 p-1.5 shadow-2xl backdrop-blur-md text-[#1B1320]">
        {/* 1. Look around (Overview) */}
        <button
          onClick={() => setMode('overview')}
          className={`flex min-h-[44px] items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-all ${currentMode === 'overview'
            ? 'bg-[#C8102E] text-white shadow'
            : 'text-slate-700 hover:bg-slate-100 hover:text-[#1B1320]'
            }`}
          title="Look around 3D auditorium"
        >
          <Orbit className="h-4 w-4" />
          <span>Look around</span>
        </button>

        {/* 2. Walk */}
        <button
          onClick={() => setMode('walk')}
          className={`flex min-h-[44px] items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-all ${currentMode === 'walk'
            ? 'bg-[#C8102E] text-white shadow'
            : 'text-slate-700 hover:bg-slate-100 hover:text-[#1B1320]'
            }`}
          title="Walk around auditorium in first-person"
        >
          <Footprints className="h-4 w-4" />
          <span>Walk Mode</span>
        </button>

        {/* 3. Sit (Seated POV) */}
        <button
          onClick={() => {
            if (activeSeatId) sitAt(activeSeatId);
            else setMode('seated');
          }}
          className={`flex min-h-[44px] items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-all ${currentMode === 'seated'
            ? 'bg-[#C8102E] text-white shadow'
            : 'text-slate-700 hover:bg-slate-100 hover:text-[#1B1320]'
            }`}
          title="Sit in seat for sightline POV"
        >
          <Eye className="h-4 w-4" />
          <span>Sit {activeSeatId ? `(${activeSeatId})` : ''}</span>
        </button>

        {/* Settings Toggle Gear Button */}
        <button
          onClick={() => setIsSettingsOpen(!isSettingsOpen)}
          data-testid="settings-menu-toggle"
          aria-expanded={isSettingsOpen}
          aria-label="Auditorium View Settings & Controls"
          className={`flex min-h-[44px] items-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold transition-all ${isSettingsOpen
            ? 'bg-slate-900 text-white'
            : 'text-slate-700 hover:bg-slate-100'
            }`}
          title="View & Lighting Settings"
        >
          <Settings className="h-4 w-4" />
          <span className="hidden sm:inline">Settings</span>
        </button>
      </div>

      {/* Seated POV Navigation Bar (Only visible when Seated) */}
      {currentMode === 'seated' && (
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-[#E6DCD2] bg-white/95 px-4 py-1.5 shadow-xl backdrop-blur-md text-[#1B1320] animate-in fade-in slide-in-from-top-2">
          <span className="text-xs font-bold text-slate-500 uppercase">Seat POV:</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigatePOV('prev')}
              className="flex min-h-[36px] items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100"
              title="Previous Seat"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Prev</span>
            </button>
            <button
              onClick={() => navigatePOV('next')}
              className="flex min-h-[36px] items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100"
              title="Next Seat"
            >
              <span>Next</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => navigatePOV('prevRow')}
              className="flex min-h-[36px] items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100"
              title="Row Ahead"
            >
              <ArrowUp className="h-3.5 w-3.5" />
              <span>Row Up</span>
            </button>
            <button
              onClick={() => navigatePOV('nextRow')}
              className="flex min-h-[36px] items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100"
              title="Row Behind"
            >
              <ArrowDown className="h-3.5 w-3.5" />
              <span>Row Down</span>
            </button>
          </div>

          <div className="h-4 w-px bg-slate-200 mx-1" />

          <button
            onClick={standUp}
            className="flex min-h-[36px] items-center gap-1 rounded-lg bg-slate-100 px-3 py-1 text-xs font-bold text-[#C8102E] hover:bg-slate-200"
            title="Stand up to Walk Mode"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Stand Up</span>
          </button>
        </div>
      )}

      {/* Settings Popover Dropdown (FOV, Presets, Heatmap, Looks, Lighting) */}
      {isSettingsOpen && (
        <div
          data-testid="settings-popover"
          className="pointer-events-auto w-[320px] rounded-3xl border border-[#E6DCD2] bg-white/95 p-5 shadow-2xl backdrop-blur-md text-[#1B1320] space-y-4 animate-in fade-in zoom-in-95"
        >
          <div className="flex items-center justify-between border-b border-[#E6DCD2] pb-2">
            <div className="flex items-center gap-2 font-black text-sm">
              <Settings className="h-4 w-4 text-[#C8102E]" />
              <span>Theatre Settings</span>
            </div>
            <button
              onClick={() => setIsSettingsOpen(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-black"
              aria-label="Close Settings"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* 1. Rendering Quality: Smooth vs Beautiful (Task 2) */}
          <div className="space-y-1.5" data-testid="quality-mode-selector">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
              <span>Rendering Quality</span>
              <span className="text-[10px] font-mono uppercase bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-bold">
                {qualityMode === 'smooth' ? 'Smooth (60 FPS)' : 'Beautiful (HQ)'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setQualityMode('smooth')}
                data-testid="quality-switch-smooth"
                className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition ${qualityMode === 'smooth'
                  ? 'bg-[#C8102E] text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
              >
                <Zap className="h-3.5 w-3.5" />
                <span>Smooth</span>
              </button>
              <button
                onClick={() => setQualityMode('beautiful')}
                data-testid="quality-switch-beautiful"
                className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition ${qualityMode === 'beautiful'
                  ? 'bg-[#C8102E] text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Beautiful</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500 leading-tight">
              {qualityMode === 'smooth'
                ? 'High frame rates, 1x resolution, shadows disabled.'
                : 'Enhanced point light shadows, rich spill & high resolution.'}
            </p>
          </div>

          {/* 2. Camera Presets (Overview mode) */}
          <div className="space-y-1.5">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Camera Viewpoint
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {(['overview', 'front', 'back', 'aerial'] as const).map((preset) => (
                <button
                  key={preset}
                  onClick={() => setCameraPreset(preset)}
                  className={`rounded-xl py-1.5 text-xs font-bold capitalize transition ${cameraPreset === preset
                    ? 'bg-[#C8102E] text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                >
                  {preset === 'overview' ? 'Default' : preset}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Field of View (FOV) */}
          <div className="space-y-1.5">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Field of View
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {[50, 60, 70, 75].map((val) => (
                <button
                  key={val}
                  onClick={() => setFOV(val)}
                  className={`rounded-xl py-1.5 text-xs font-mono font-bold transition ${storeFov === val
                    ? 'bg-[#C8102E] text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                >
                  {val}°
                </button>
              ))}
            </div>
          </div>

          {/* 3. Three Selectable Aesthetic Looks (Part F Requirement) */}
          <div className="space-y-1.5">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
              <span>Theatre Interior Look</span>
              <Sparkles className="h-3 w-3 text-amber-500" />
            </div>
            <div className="space-y-1">
              {(['a', 'b', 'c'] as TheatreLookId[]).map((lookId) => {
                const look = THEATRE_LOOKS[lookId];
                const isActive = theatreLook === lookId;
                return (
                  <button
                    key={lookId}
                    onClick={() => setTheatreLook(lookId)}
                    data-testid={`theatre-look-btn-${lookId}`}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition ${isActive
                      ? 'border border-[#C8102E] bg-rose-50 text-[#9F1239] font-bold shadow-sm'
                      : 'border border-transparent bg-slate-50 text-slate-700 hover:bg-slate-100 font-medium'
                      }`}
                  >
                    <span>{look.name}</span>
                    <span className="text-[10px] text-slate-500">{lookId.toUpperCase()}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. House Lights (Lights Up vs Show) */}
          <div className="space-y-1.5">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Lighting Environment
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setHouseLights('full')}
                className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition ${houseLights === 'full'
                  ? 'bg-amber-100 text-amber-900 border border-amber-300 shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
              >
                <Sun className="h-3.5 w-3.5 text-amber-600" />
                <span>Lights Up</span>
              </button>
              <button
                onClick={() => setHouseLights('show')}
                className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition ${houseLights === 'show'
                  ? 'bg-indigo-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
              >
                <Moon className="h-3.5 w-3.5 text-indigo-300" />
                <span>Show Mode</span>
              </button>
            </div>
          </div>

          {/* 5. Viewing Comfort Heatmap Toggle */}
          <div className="border-t border-[#E6DCD2] pt-3">
            <button
              onClick={toggleHeatmap}
              data-testid="toggle-3d-heatmap-btn"
              className={`flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl text-xs font-bold transition ${isHeatmapActive
                ? 'bg-emerald-600 text-white shadow'
                : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                }`}
            >
              <Flame className="h-4 w-4" />
              <span>{isHeatmapActive ? 'Viewing Heatmap: Active' : 'Toggle Viewing Comfort Heatmap'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
