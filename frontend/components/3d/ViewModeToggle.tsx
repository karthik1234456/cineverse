'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useCinemaStore, DEFAULT_CAMERA_POS, DEFAULT_CAMERA_TARGET } from '@/store/useCinemaStore';
import {
  Compass,
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
  Play,
  Square,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  HelpCircle,
  Users,
  Layers,
  ChevronDown,
  Globe,
  Sliders,
} from 'lucide-react';
import { THEATRE_LOOKS, type TheatreLookId } from '@/lib/theatreLooks';
import { I18N_DICTIONARY, type SupportedLanguage } from '@/lib/i18n';
import type { CameraPreset } from '@/lib/types';

export function ViewModeToggle() {
  const mode = useCinemaStore((s) => s.mode);
  const cameraMode = useCinemaStore((s) => s.cameraMode);
  const currentMode = mode || (cameraMode === 'pov' ? 'seated' : cameraMode === 'walk' ? 'walk' : 'overview');

  const cameraPreset = useCinemaStore((s) => s.cameraPreset);
  const setCameraPreset = useCinemaStore((s) => s.setCameraPreset);
  const setCameraPose = useCinemaStore((s) => s.setCameraPose);
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
  const lightIntensity = useCinemaStore((s) => s.lightIntensity);
  const setLightIntensity = useCinemaStore((s) => s.setLightIntensity);
  const qualityMode = useCinemaStore((s) => s.qualityMode);
  const setQualityMode = useCinemaStore((s) => s.setQualityMode);

  // Audience Simulation toggle
  const showPeople = useCinemaStore((s) => s.showPeople);
  const toggleShowPeople = useCinemaStore((s) => s.toggleShowPeople);

  // Guided Tour
  const tourActive = useCinemaStore((s) => s.tourActive);
  const setTourActive = useCinemaStore((s) => s.setTourActive);
  const tourStepIndex = useCinemaStore((s) => s.tourStepIndex);
  const setTourStepIndex = useCinemaStore((s) => s.setTourStepIndex);

  // Multilingual
  const selectedLanguage = useCinemaStore((s) => s.selectedLanguage);
  const setSelectedLanguage = useCinemaStore((s) => s.setSelectedLanguage);

  // Unified Settings Modal
  const settingsModalOpen = useCinemaStore((s) => s.settingsModalOpen);
  const setSettingsModalOpen = useCinemaStore((s) => s.setSettingsModalOpen);

  // Layout context (to check if hall has balcony)
  const auditoriumLayout = useCinemaStore((s) => s.auditoriumLayout);
  const proceduralResult = useCinemaStore((s) => s.proceduralResult);
  const hasBalcony =
    Boolean(auditoriumLayout?.has_balcony) ||
    Boolean(proceduralResult?.geometry?.balconyStructure) ||
    Boolean(auditoriumLayout?.seats?.some((s) => s.level === 'balcony'));

  // UI state
  const [isPresetMenuOpen, setIsPresetMenuOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const t = I18N_DICTIONARY[selectedLanguage] || I18N_DICTIONARY.en;

  // 30-Second Guided Tour sequence steps
  const tourSteps = [
    {
      caption: t.tourCaptions.premier,
      pos: [0.0, 5.0, -16.0] as [number, number, number],
      target: [0.0, 3.5, -4.0] as [number, number, number],
    },
    ...(hasBalcony
      ? [
          {
            caption: t.tourCaptions.balcony,
            pos: [0.0, 9.8, -26.0] as [number, number, number],
            target: [0.0, 4.0, -8.0] as [number, number, number],
          },
        ]
      : []),
    {
      caption: t.tourCaptions.screen,
      pos: [0.0, 4.0, -11.0] as [number, number, number],
      target: [0.0, 3.0, -4.0] as [number, number, number],
    },
    {
      caption: t.tourCaptions.exits,
      pos: [7.5, 3.5, -16.0] as [number, number, number],
      target: [7.5, 2.0, -10.0] as [number, number, number],
    },
    {
      caption: t.tourCaptions.overview,
      pos: DEFAULT_CAMERA_POS,
      target: DEFAULT_CAMERA_TARGET,
    },
  ];

  // Tour progression timer (approx 6 seconds per step, total ~30s)
  useEffect(() => {
    if (!tourActive) return;

    const stepDuration = 6500;
    const currentStep = tourSteps[tourStepIndex % tourSteps.length];
    setCameraPose(currentStep.pos, currentStep.target);

    const timer = setTimeout(() => {
      const nextIdx = tourStepIndex + 1;
      if (nextIdx >= tourSteps.length) {
        // Tour completed
        setTourActive(false);
        setTourStepIndex(0);
        setCameraPreset('overview');
      } else {
        setTourStepIndex(nextIdx);
      }
    }, stepDuration);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setTourActive(false);
        setTourStepIndex(0);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [tourActive, tourStepIndex, hasBalcony]);

  const handleStartTour = () => {
    setMode('overview');
    setTourStepIndex(0);
    setTourActive(true);
    setIsPresetMenuOpen(false);
  };

  const handleStopTour = () => {
    setTourActive(false);
    setTourStepIndex(0);
  };

  const handleResetView = () => {
    setMode('overview');
    setCameraPreset('overview');
    setCameraPose(DEFAULT_CAMERA_POS, DEFAULT_CAMERA_TARGET);
    setFOV(60);
  };

  const handleZoomIn = () => {
    if (storeFov > 50) {
      setFOV(storeFov === 75 ? 70 : storeFov === 70 ? 60 : 50);
    }
  };

  const handleZoomOut = () => {
    if (storeFov < 75) {
      setFOV(storeFov === 50 ? 60 : storeFov === 60 ? 70 : 75);
    }
  };

  const handleSelectPreset = (preset: CameraPreset) => {
    setTourActive(false);
    if (preset === 'screen') {
      setCameraPose([0.0, 4.0, -11.0], [0.0, 3.0, -4.0]);
      setCameraPreset('screen');
    } else if (preset === 'balcony') {
      setCameraPose([0.0, 9.8, -26.0], [0.0, 4.0, -8.0]);
      setCameraPreset('balcony');
    } else if (preset === 'top') {
      setCameraPose([0.0, 15.0, -15.0], [0.0, 0.0, -14.0]);
      setCameraPreset('top');
    } else if (preset === 'picker') {
      setCameraPose([0.0, 12.0, -21.0], [0.0, 3.5, -8.0]);
      setCameraPreset('picker');
    } else {
      setCameraPreset(preset);
    }
    setIsPresetMenuOpen(false);
  };

  return (
    <>
      <div className="pointer-events-none fixed top-16 left-1/2 z-30 -translate-x-1/2 flex flex-col items-center gap-2 max-w-full px-2">
        {/* Primary Unified Control Bar */}
        <div className="pointer-events-auto flex items-center gap-1 sm:gap-1.5 rounded-full border border-[#E6DCD2] bg-white/95 p-1.5 shadow-2xl backdrop-blur-md text-[#1B1320]">
          {/* 1. Drone View */}
          <button
            onClick={() => {
              setTourActive(false);
              setMode('overview');
            }}
            data-testid="mode-drone-btn"
            className={`flex min-h-[40px] items-center gap-1.5 rounded-full px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-bold transition-all ${
              currentMode === 'overview' && !tourActive
                ? 'bg-[#C8102E] text-white shadow'
                : 'text-slate-700 hover:bg-slate-100 hover:text-[#1B1320]'
            }`}
            title="Drone view: Free orbital camera"
          >
            <Compass className="h-4 w-4" />
            <span>Drone</span>
          </button>

          {/* 2. Walk View */}
          <button
            onClick={() => {
              setTourActive(false);
              setMode('walk');
            }}
            data-testid="mode-walk-btn"
            className={`flex min-h-[40px] items-center gap-1.5 rounded-full px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-bold transition-all ${
              currentMode === 'walk'
                ? 'bg-[#C8102E] text-white shadow'
                : 'text-slate-700 hover:bg-slate-100 hover:text-[#1B1320]'
            }`}
            title="Walk mode: First-person aisle walking"
          >
            <Footprints className="h-4 w-4" />
            <span className="hidden sm:inline">Walk</span>
          </button>

          {/* 3. Sit (POV) */}
          <button
            onClick={() => {
              setTourActive(false);
              if (activeSeatId) sitAt(activeSeatId);
              else setMode('seated');
            }}
            data-testid="mode-sit-btn"
            className={`flex min-h-[40px] items-center gap-1.5 rounded-full px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-bold transition-all ${
              currentMode === 'seated'
                ? 'bg-[#C8102E] text-white shadow'
                : 'text-slate-700 hover:bg-slate-100 hover:text-[#1B1320]'
            }`}
            title="Sit in seat for direct sightline POV"
          >
            <Eye className="h-4 w-4" />
            <span>Sit {activeSeatId ? `(${activeSeatId})` : ''}</span>
          </button>

          {/* Separator */}
          <div className="h-5 w-px bg-slate-200 mx-0.5" />

          {/* 4. Camera Presets Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsPresetMenuOpen(!isPresetMenuOpen)}
              data-testid="camera-presets-menu-btn"
              aria-expanded={isPresetMenuOpen}
              aria-label="Camera Presets Menu"
              className={`flex min-h-[40px] items-center gap-1 rounded-full px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-bold transition-all ${
                isPresetMenuOpen ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
              }`}
              title="Camera Presets"
            >
              <Layers className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Presets</span>
              <ChevronDown className="h-3 w-3" />
            </button>

            {isPresetMenuOpen && (
              <div
                data-testid="camera-presets-dropdown"
                className="absolute top-full mt-2 left-0 w-48 rounded-2xl border border-[#E6DCD2] bg-white p-2 shadow-2xl backdrop-blur-md z-50 space-y-1 animate-in fade-in zoom-in-95"
              >
                <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Camera Presets
                </div>
                <button
                  onClick={() => handleSelectPreset('screen')}
                  className="flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 text-left"
                >
                  <span>Near Screen</span>
                </button>
                {hasBalcony && (
                  <button
                    onClick={() => handleSelectPreset('balcony')}
                    className="flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 text-left"
                  >
                    <span>Balcony View</span>
                    <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-1 rounded">Tier</span>
                  </button>
                )}
                <button
                  onClick={() => handleSelectPreset('top')}
                  className="flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 text-left"
                >
                  <span>Top View</span>
                </button>
                <button
                  onClick={() => handleSelectPreset('picker')}
                  className="flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 text-left"
                >
                  <span>Seat Picker View</span>
                </button>
                <div className="border-t border-slate-100 pt-1">
                  <button
                    onClick={() => handleSelectPreset('overview')}
                    className="flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 text-left"
                  >
                    <span>Default Centre</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 5. Guided Tour Button */}
          <button
            onClick={tourActive ? handleStopTour : handleStartTour}
            data-testid="guided-tour-btn"
            className={`flex min-h-[40px] items-center gap-1.5 rounded-full px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-bold transition-all ${
              tourActive
                ? 'bg-amber-600 text-white shadow animate-pulse'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
            title={tourActive ? 'Stop guided tour (Esc)' : '30-second guided theatre tour'}
          >
            {tourActive ? <Square className="h-3.5 w-3.5 fill-current" /> : <Play className="h-3.5 w-3.5" />}
            <span className="hidden lg:inline">{tourActive ? t.stopTour : t.tour}</span>
          </button>

          {/* 6. Zoom & Reset Buttons */}
          <div className="hidden sm:flex items-center gap-0.5">
            <button
              onClick={handleZoomIn}
              className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"
              title="Zoom In"
              aria-label="Zoom In"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleZoomOut}
              className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"
              title="Zoom Out"
              aria-label="Zoom Out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleResetView}
              className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"
              title="Reset View"
              aria-label="Reset View"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* 7. Heatmap Toggle */}
          <button
            onClick={toggleHeatmap}
            data-testid="toggle-3d-heatmap-btn"
            className={`flex min-h-[40px] items-center gap-1 rounded-full px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-bold transition-all ${
              isHeatmapActive
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
            title="Toggle Viewing Comfort Heatmap"
          >
            <Flame className="h-3.5 w-3.5" />
            <span className="hidden xl:inline">Heatmap</span>
          </button>

          {/* 8. Controls Help Button */}
          <button
            onClick={() => setIsHelpOpen(true)}
            data-testid="controls-help-btn"
            aria-label="Controls Help"
            className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"
            title="Controls & Navigation Guide"
          >
            <HelpCircle className="h-4 w-4" />
          </button>

          {/* 9. Unified Settings Modal Toggle */}
          <button
            onClick={() => setSettingsModalOpen(!settingsModalOpen)}
            data-testid="settings-menu-toggle"
            aria-expanded={settingsModalOpen}
            aria-label="Auditorium View Settings & Controls"
            className={`flex min-h-[40px] items-center gap-1.5 rounded-full px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-bold transition-all ${
              settingsModalOpen ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
            }`}
            title="View & Lighting Settings"
          >
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">{t.settings}</span>
          </button>
        </div>

        {/* Guided Tour Caption & Progress Bar (when Tour is Active) */}
        {tourActive && (
          <div
            data-testid="guided-tour-banner"
            className="pointer-events-auto flex items-center justify-between gap-4 rounded-2xl border border-amber-300 bg-amber-500/95 px-5 py-2.5 shadow-2xl backdrop-blur-md text-white animate-in fade-in slide-in-from-top-2 max-w-xl w-full"
          >
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-amber-200 shrink-0" />
              <div>
                <div className="text-xs uppercase font-extrabold tracking-wider text-amber-100">
                  {t.tour} ({tourStepIndex + 1}/{tourSteps.length})
                </div>
                <div className="text-sm font-bold leading-tight">
                  {tourSteps[tourStepIndex % tourSteps.length]?.caption}
                </div>
              </div>
            </div>
            <button
              onClick={handleStopTour}
              className="flex items-center gap-1 rounded-full bg-white text-slate-900 px-3 py-1 text-xs font-black shadow hover:bg-amber-100 shrink-0"
            >
              <Square className="h-3 w-3 fill-current" />
              <span>{t.stopTour}</span>
            </button>
          </div>
        )}

        {/* Seated POV Navigation Bar (visible only in Sit mode) */}
        {currentMode === 'seated' && (
          <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-[#E6DCD2] bg-white/95 px-4 py-1.5 shadow-xl backdrop-blur-md text-[#1B1320] animate-in fade-in slide-in-from-top-2">
            <span className="text-xs sm:text-sm font-bold text-slate-500 uppercase">
              Seat POV:
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => navigatePOV('prev')}
                className="flex min-h-[36px] items-center gap-1 rounded-lg px-2.5 py-1 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-100"
                title="Previous Seat"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Prev</span>
              </button>
              <button
                onClick={() => navigatePOV('next')}
                className="flex min-h-[36px] items-center gap-1 rounded-lg px-2.5 py-1 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-100"
                title="Next Seat"
              >
                <span>Next</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => navigatePOV('prevRow')}
                className="flex min-h-[36px] items-center gap-1 rounded-lg px-2.5 py-1 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-100"
                title="Row Ahead"
              >
                <ArrowUp className="h-3.5 w-3.5" />
                <span>Row Up</span>
              </button>
              <button
                onClick={() => navigatePOV('nextRow')}
                className="flex min-h-[36px] items-center gap-1 rounded-lg px-2.5 py-1 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-100"
                title="Row Behind"
              >
                <ArrowDown className="h-3.5 w-3.5" />
                <span>Row Down</span>
              </button>
            </div>

            <div className="h-4 w-px bg-slate-200 mx-1" />

            <button
              onClick={standUp}
              className="flex min-h-[36px] items-center gap-1 rounded-lg bg-slate-100 px-3 py-1 text-xs sm:text-sm font-bold text-[#C8102E] hover:bg-slate-200"
              title="Stand up to Walk Mode"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Stand Up</span>
            </button>
          </div>
        )}
      </div>

      {/* Controls Help Modal */}
      {isHelpOpen && (
        <div
          data-testid="controls-help-modal"
          role="dialog"
          aria-label="Controls and Navigation Help"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setIsHelpOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-3xl border border-[#E6DCD2] bg-white p-6 shadow-2xl text-[#1B1320] space-y-4 animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#E6DCD2] pb-3">
              <div className="flex items-center gap-2 font-black text-lg">
                <HelpCircle className="h-5 w-5 text-[#C8102E]" />
                <span>Auditorium Controls</span>
              </div>
              <button
                onClick={() => setIsHelpOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-black"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm text-slate-700">
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-200">
                <div className="font-bold text-slate-900 flex items-center gap-2 mb-1">
                  <Compass className="h-4 w-4 text-[#C8102E]" />
                  <span>Drone Camera</span>
                </div>
                <p className="text-xs text-slate-600">
                  Left click & drag to rotate. Right click & drag to pan. Scroll mouse wheel to zoom in and out.
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-3 border border-slate-200">
                <div className="font-bold text-slate-900 flex items-center gap-2 mb-1">
                  <Footprints className="h-4 w-4 text-[#C8102E]" />
                  <span>Walk Mode</span>
                </div>
                <p className="text-xs text-slate-600">
                  Use <strong>W, A, S, D</strong> or Arrow keys to walk aisles. Drag mouse to look around. Hold <strong>Shift</strong> to sprint. Click any seat to sit down.
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-3 border border-slate-200">
                <div className="font-bold text-slate-900 flex items-center gap-2 mb-1">
                  <Eye className="h-4 w-4 text-[#C8102E]" />
                  <span>Sit Mode (POV)</span>
                </div>
                <p className="text-xs text-slate-600">
                  Sit at genuine seat eye level. Use Left/Right keys or buttons to sample neighboring seats. Use Stand Up to return to walking.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setIsHelpOpen(false)}
                className="rounded-xl bg-[#C8102E] px-4 py-2 text-sm font-bold text-white shadow hover:bg-red-700"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unified Settings Modal (Task 5 requirement) */}
      {settingsModalOpen && (
        <div
          data-testid="settings-popover"
          role="dialog"
          aria-label="Auditorium View Settings & Controls"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setSettingsModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-[#E6DCD2] bg-white p-6 shadow-2xl text-[#1B1320] space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#E6DCD2] pb-3">
              <div className="flex items-center gap-2 font-black text-lg">
                <Settings className="h-5 w-5 text-[#C8102E]" />
                <span>{t.settings}</span>
              </div>
              <button
                onClick={() => setSettingsModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-black"
                aria-label="Close Settings"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* 1. Multilingual Switcher */}
            <div className="space-y-1.5" data-testid="language-switcher">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-slate-400" />
                <span>Language / भाषा / ಭಾಷೆ</span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {[
                  { code: 'en', label: 'English' },
                  { code: 'hi', label: 'हिन्दी' },
                  { code: 'kn', label: 'ಕನ್ನಡ' },
                  { code: 'ta', label: 'தமிழ்' },
                  { code: 'te', label: 'తెలుగు' },
                ].map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => setSelectedLanguage(lang.code as SupportedLanguage)}
                    className={`rounded-xl py-1.5 text-xs font-bold transition ${
                      selectedLanguage === lang.code
                        ? 'bg-[#C8102E] text-white shadow-sm'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Auditorium Lighting (Lights Up vs Show) */}
            <div className="space-y-1.5">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {t.lightingMode}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setHouseLights('full')}
                  className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold transition ${
                    houseLights === 'full'
                      ? 'bg-amber-100 text-amber-900 border border-amber-300 shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Sun className="h-4 w-4 text-amber-600" />
                  <span>{t.lightsUp}</span>
                </button>
                <button
                  onClick={() => setHouseLights('show')}
                  className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold transition ${
                    houseLights === 'show'
                      ? 'bg-indigo-950 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Moon className="h-4 w-4 text-indigo-300" />
                  <span>{t.showMode}</span>
                </button>
              </div>
            </div>

            {/* 2b. Light Intensity: Normal vs Brighter */}
            <div className="space-y-1.5" data-testid="light-intensity-selector">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                <span>Light Intensity</span>
                <span className="text-[10px] font-mono uppercase bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-bold">
                  {lightIntensity === 'brighter' ? 'Brighter (+35%)' : 'Normal (Warm)'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setLightIntensity('normal')}
                  data-testid="light-intensity-normal"
                  className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition ${
                    lightIntensity === 'normal'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Sun className="h-3.5 w-3.5" />
                  <span>Normal</span>
                </button>
                <button
                  onClick={() => setLightIntensity('brighter')}
                  data-testid="light-intensity-brighter"
                  className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition ${
                    lightIntensity === 'brighter'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Brighter</span>
                </button>
              </div>
            </div>

            {/* 3. Rendering Quality: Smooth vs Beautiful */}
            <div className="space-y-1.5" data-testid="quality-mode-selector">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                <span>{t.quality}</span>
                <span className="text-[10px] font-mono uppercase bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-bold">
                  {qualityMode === 'smooth' ? 'Smooth (60 FPS)' : 'Beautiful (HQ)'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setQualityMode('smooth')}
                  data-testid="quality-switch-smooth"
                  className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold transition ${
                    qualityMode === 'smooth'
                      ? 'bg-[#C8102E] text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Zap className="h-4 w-4" />
                  <span>{t.smooth}</span>
                </button>
                <button
                  onClick={() => setQualityMode('beautiful')}
                  data-testid="quality-switch-beautiful"
                  className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold transition ${
                    qualityMode === 'beautiful'
                      ? 'bg-[#C8102E] text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Sparkles className="h-4 w-4" />
                  <span>{t.beautiful}</span>
                </button>
              </div>
            </div>

            {/* 4. Audience Presence Simulation Toggle */}
            <div className="space-y-1.5 rounded-2xl bg-slate-50 p-3 border border-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-slate-600" />
                  <span className="text-sm font-bold text-slate-900">{t.showPeople}</span>
                </div>
                <button
                  onClick={toggleShowPeople}
                  data-testid="toggle-show-people"
                  role="switch"
                  aria-checked={showPeople}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    showPeople ? 'bg-[#C8102E]' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      showPeople ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <p className="text-[11px] text-slate-500 leading-tight">
                {t.peopleIllustrative}. Only seated in already booked positions.
              </p>
            </div>

            {/* 5. Field of View (FOV) */}
            <div className="space-y-1.5">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Field of View
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {[50, 60, 70, 75].map((val) => (
                  <button
                    key={val}
                    onClick={() => setFOV(val)}
                    className={`rounded-xl py-1.5 text-xs font-mono font-bold transition ${
                      storeFov === val
                        ? 'bg-[#C8102E] text-white shadow-sm'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {val}°
                  </button>
                ))}
              </div>
            </div>

            {/* 6. Three Selectable Aesthetic Looks */}
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
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition ${
                        isActive
                          ? 'border border-[#C8102E] bg-rose-50 text-[#9F1239] font-bold shadow-sm'
                          : 'border border-transparent bg-slate-50 text-slate-700 hover:bg-slate-100 font-medium'
                      }`}
                    >
                      <span>{look.name}</span>
                      <span className="text-[10px] text-slate-400 uppercase">{lookId}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Close button */}
            <div className="pt-2">
              <button
                onClick={() => setSettingsModalOpen(false)}
                className="w-full rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white shadow hover:bg-black"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
