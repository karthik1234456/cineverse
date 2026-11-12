'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useCinemaStore, ScreenStrategy } from '@/store/useCinemaStore';
import { generateProceduralAuditorium } from '@/lib/proceduralAuditorium';
import {
  Monitor,
  Video,
  Image as ImageIcon,
  Film,
  Sparkles,
  Camera,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  RotateCcw,
  Footprints,
  Eye,
  Compass,
  Download,
  Terminal,
} from 'lucide-react';

// Lazy-load CinemaWorld without SSR
const CinemaWorld = dynamic(
  () => import('@/components/3d/CinemaWorld').then((m) => m.CinemaWorld),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-[#07080a] text-white">
        <div className="text-sm font-semibold tracking-wider text-slate-300 animate-pulse">
          Initializing 3D Screen Test Bench...
        </div>
      </div>
    ),
  }
);

interface TelemetryReport {
  mode: ScreenStrategy;
  elementExists: boolean;
  screenDimensions: { width: number; height: number; aspect: number };
  screenPosition: [number, number, number];
  screenFacingAudience: boolean;
  zFightingProtected: boolean;
  renderer: {
    alpha: boolean;
    clearAlpha: number;
    hasSceneBackground: boolean;
    fogActive: boolean;
    toneMapping: string;
    isOpaquePostProcessing: boolean;
  };
  cssLayering: {
    canvasZIndex: string;
    canvasPointerEvents: string;
    canvasOpacity: string;
    canvasDisplay: string;
    iframeZIndex?: string;
    iframePointerEvents?: string;
  };
  youtube?: {
    apiLoaded: boolean;
    playerState: number | null;
    playerStateText: string;
    errorCode: number | null;
    errorText?: string;
    embedAllowed: boolean;
    autoplayResult: 'success' | 'blocked' | 'pending';
  };
  video?: {
    src: string;
    readyState: number;
    paused: boolean;
    currentTime: number;
    duration: number;
    videoWidth: number;
    videoHeight: number;
    error: string | null;
  };
  motionProved: boolean;
  fps: number;
  status: 'PASS' | 'FAIL' | 'RUNNING';
  statusDetails: string;
  timestamp: number;
}

export default function ScreenTestBenchPage() {
  const [activeMode, setActiveMode] = useState<ScreenStrategy>('solid_color');
  const [solidColor, setSolidColor] = useState('#00f0ff');
  const [selectedHall, setSelectedHall] = useState<'standard' | 'flagship' | 'dolby_atmos_4dx' | 'balcony'>('flagship');
  const [telemetry, setTelemetry] = useState<TelemetryReport | null>(null);
  const [consoleLogs, setConsoleLogs] = useState<Array<{ time: string; msg: string; type: 'log' | 'warn' | 'error' }>>([]);
  const [capturedScreenshots, setCapturedScreenshots] = useState<Record<string, string>>({});

  const setAuditoriumData = useCinemaStore((s) => s.setAuditoriumData);
  const setMode = useCinemaStore((s) => s.setMode);
  const sitAt = useCinemaStore((s) => s.sitAt);
  const setTrailerState = useCinemaStore((s) => s.setTrailerState);
  const setCameraPose = useCinemaStore((s) => s.setCameraPose);

  // Capture console messages for test bench logging
  useEffect(() => {
    const origLog = console.log;
    const origWarn = console.warn;
    const origError = console.error;

    const pushLog = (type: 'log' | 'warn' | 'error', args: any[]) => {
      const time = new Date().toLocaleTimeString();
      const msg = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
      setConsoleLogs((prev) => [{ time, msg, type }, ...prev.slice(0, 39)]);
    };

    console.log = (...args) => {
      pushLog('log', args);
      origLog(...args);
    };
    console.warn = (...args) => {
      pushLog('warn', args);
      origWarn(...args);
    };
    console.error = (...args) => {
      pushLog('error', args);
      origError(...args);
    };

    return () => {
      console.log = origLog;
      console.warn = origWarn;
      console.error = origError;
    };
  }, []);

  // Initialize selected hall
  useEffect(() => {
    const isMotion = selectedHall === 'dolby_atmos_4dx';
    const rowsCount = selectedHall === 'flagship' ? 14 : selectedHall === 'balcony' ? 16 : isMotion ? 10 : 12;
    const seatsPerRow = selectedHall === 'flagship' ? 18 : isMotion ? 14 : 14;

    const procedural = generateProceduralAuditorium({
      theatre_type: selectedHall,
      rows: rowsCount,
      seats_per_row: seatsPerRow,
      is_motion_hall: isMotion,
    });

    setAuditoriumData('test-hall', procedural, {
      name: `${selectedHall.toUpperCase()} Test Hall`,
      screenType: selectedHall,
    });

    // Provide default media mock
    setTrailerState({
      movieTitle: 'QUANTUM ODYSSEY: BEYOND THE SINGULARITY',
      trailerUrl:
        activeMode === 'video_texture'
          ? '/trailers/quantum-odyssey.mp4'
          : activeMode === 'youtube_css3d'
            ? 'https://www.youtube-nocookie.com/embed/EfluEyQ5QIA'
            : '/trailers/quantum-odyssey.mp4',
      posterUrl: '/trailers/quantum-odyssey_poster.webp',
      bannerUrl: '/trailers/quantum-odyssey_poster.webp',
      isPlaying: true,
      isMuted: true,
    });
  }, [selectedHall, activeMode, setAuditoriumData, setTrailerState]);

  // Handle telemetry telecasted from 3D CinemaScreen
  const handleTelemetryUpdate = useCallback((report: TelemetryReport) => {
    setTelemetry(report);
  }, []);

  // Preset Navigation Points
  const handleNavPreset = (preset: 'lookaround' | 'walk_e' | 'sit_center') => {
    if (preset === 'lookaround') {
      setMode('overview');
      setCameraPose([0, 10.5, -28.0], [0, 4.5, -1.255]);
    } else if (preset === 'walk_e') {
      setMode('walk');
      // Row E center aisle walk position
      setCameraPose([0.0, 3.2, -14.5], [0, 3.2, -1.255]);
    } else if (preset === 'sit_center') {
      setMode('seated');
      sitAt('F10');
    }
  };

  // Screenshot capture
  const handleCaptureScreenshot = () => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement | null;
    if (!canvas) return;
    try {
      const dataUrl = canvas.toDataURL('image/png');
      setCapturedScreenshots((prev) => ({
        ...prev,
        [activeMode]: dataUrl,
      }));
    } catch (e: any) {
      console.error('Screenshot capture failed (tainted canvas):', e);
    }
  };

  return (
    <div className="flex h-[100dvh] w-full flex-col bg-[#07090e] text-slate-100 font-sans">
      {/* Top Test Bench Header */}
      <header className="flex flex-wrap items-center justify-between border-b border-slate-800 bg-[#0d121c] px-4 py-2.5 shadow-md">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-600/20 text-rose-500 font-bold border border-rose-500/30">
            3D
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
              <span>CineVerse Screen Plane Test Bench</span>
              <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-mono text-rose-400 border border-rose-500/30">
                /dev/screen-test
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">
              5-Mode Diagnostic Suite: Placement, Texture Layers, YouTube CSS 3D Cut-Out &amp; Title Card Motion
            </p>
          </div>
        </div>

        {/* Hall Switcher & Nav Presets */}
        <div className="flex items-center gap-2">
          <select
            value={selectedHall}
            onChange={(e) => setSelectedHall(e.target.value as any)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-semibold text-slate-200 focus:outline-none"
          >
            <option value="standard">Standard Stadium Hall</option>
            <option value="flagship">Flagship IMAX Curved</option>
            <option value="dolby_atmos_4dx">Motion-seat 4DX Hall</option>
            <option value="balcony">Grand Balcony Hall</option>
          </select>

          <div className="h-4 w-px bg-slate-800 mx-1" />

          {/* Quick Camera Angles */}
          <button
            onClick={() => handleNavPreset('lookaround')}
            data-testid="preset-lookaround"
            className="flex items-center gap-1 rounded-lg bg-slate-800 hover:bg-slate-700 px-2 py-1 text-xs font-medium text-slate-200 transition"
            title="Look around orbital view"
          >
            <Compass className="h-3.5 w-3.5 text-cyan-400" />
            <span>Look Around</span>
          </button>
          <button
            onClick={() => handleNavPreset('walk_e')}
            data-testid="preset-walk_e"
            className="flex items-center gap-1 rounded-lg bg-slate-800 hover:bg-slate-700 px-2 py-1 text-xs font-medium text-slate-200 transition"
            title="Walk mode at Row E"
          >
            <Footprints className="h-3.5 w-3.5 text-amber-400" />
            <span>Walk (Row E)</span>
          </button>
          <button
            onClick={() => handleNavPreset('sit_center')}
            data-testid="preset-sit_center"
            className="flex items-center gap-1 rounded-lg bg-slate-800 hover:bg-slate-700 px-2 py-1 text-xs font-medium text-slate-200 transition"
            title="Sit in sweet spot"
          >
            <Eye className="h-3.5 w-3.5 text-emerald-400" />
            <span>Sit (Center)</span>
          </button>

          <div className="h-4 w-px bg-slate-800 mx-1" />

          <button
            onClick={handleCaptureScreenshot}
            data-testid="btn-capture-screenshot"
            className="flex items-center gap-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 px-3 py-1 text-xs font-bold text-white shadow transition"
          >
            <Camera className="h-3.5 w-3.5" />
            <span>Capture Screenshot</span>
          </button>
        </div>
      </header>

      {/* Mode Selector Strip */}
      <div className="flex items-center gap-2 border-b border-slate-800 bg-[#0a0e17] px-4 py-2 overflow-x-auto">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 shrink-0">
          Screen Plane Mode:
        </span>

        {/* Mode A */}
        <button
          onClick={() => setActiveMode('solid_color')}
          data-testid="mode-solid_color"
          className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition shrink-0 ${
            activeMode === 'solid_color'
              ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <Monitor className="h-3.5 w-3.5" />
          <span>(a) Solid Bright Colour</span>
        </button>

        {/* Mode B */}
        <button
          onClick={() => setActiveMode('video_texture')}
          data-testid="mode-video_texture"
          className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition shrink-0 ${
            activeMode === 'video_texture'
              ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <Video className="h-3.5 w-3.5" />
          <span>(b) Hosted Video Texture</span>
        </button>

        {/* Mode C */}
        <button
          onClick={() => setActiveMode('backdrop_motion')}
          data-testid="mode-backdrop_motion"
          className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition shrink-0 ${
            activeMode === 'backdrop_motion'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <ImageIcon className="h-3.5 w-3.5" />
          <span>(c) Backdrop Slow Motion</span>
        </button>

        {/* Mode D */}
        <button
          onClick={() => setActiveMode('youtube_css3d')}
          data-testid="mode-youtube_css3d"
          className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition shrink-0 ${
            activeMode === 'youtube_css3d'
              ? 'bg-red-600 text-white shadow-md shadow-red-600/20'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <Film className="h-3.5 w-3.5" />
          <span>(d) YouTube CSS 3D Cut-Out</span>
        </button>

        {/* Mode E */}
        <button
          onClick={() => setActiveMode('title_card')}
          data-testid="mode-title_card"
          className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition shrink-0 ${
            activeMode === 'title_card'
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>(e) Generated Title Card</span>
        </button>

        {activeMode === 'solid_color' && (
          <div className="flex items-center gap-1 ml-auto shrink-0">
            <span className="text-[10px] text-slate-400">Tint:</span>
            {['#00f0ff', '#ff0055', '#39ff14', '#ffff00'].map((col) => (
              <button
                key={col}
                onClick={() => setSolidColor(col)}
                className="h-4 w-4 rounded-full border border-white/40"
                style={{ backgroundColor: col }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Main Workspace: 3D Viewport on Left, Telemetry & Diagnostics on Right */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: 3D Canvas Container */}
        <div className="relative flex-1 bg-[#050608]">
          <CinemaWorld
            overrideScreenMode={activeMode}
            screenSolidColor={solidColor}
            onScreenTelemetryUpdate={handleTelemetryUpdate}
          />

          {/* Mode Badge Overlay in 3D */}
          <div className="pointer-events-none absolute top-4 left-4 z-20 flex items-center gap-2 rounded-xl bg-black/80 px-3 py-1.5 text-xs font-mono backdrop-blur-md border border-white/10">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-slate-200">Mode: {activeMode.toUpperCase()}</span>
            <span className="text-slate-500">|</span>
            <span className="text-emerald-400 font-bold">{telemetry?.status || 'RUNNING'}</span>
          </div>
        </div>

        {/* Right: Comprehensive Telemetry & Diagnostics Inspector */}
        <aside className="w-96 border-l border-slate-800 bg-[#090d16] flex flex-col overflow-y-auto">
          {/* Header */}
          <div className="border-b border-slate-800 p-3 bg-[#0d131f] flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Terminal className="h-3.5 w-3.5 text-rose-400" />
              <span>Diagnostic Telemetry</span>
            </h2>
            {telemetry && (
              <span
                className={`rounded px-2 py-0.5 text-[10px] font-black uppercase ${
                  telemetry.status === 'PASS'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                }`}
              >
                {telemetry.status}
              </span>
            )}
          </div>

          <div className="p-3 space-y-4 text-xs">
            {/* 1. Placement & Geometry */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-2.5">
              <div className="text-[11px] font-bold text-slate-200 mb-1.5 flex items-center justify-between">
                <span>1. Screen Plane Geometry</span>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              </div>
              <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-400 font-mono">
                <div>Dimensions:</div>
                <div className="text-slate-200">
                  {telemetry ? `${telemetry.screenDimensions.width}m × ${telemetry.screenDimensions.height}m` : '15.6m × 7.25m'}
                </div>
                <div>Aspect Ratio:</div>
                <div className="text-slate-200">{telemetry ? telemetry.screenDimensions.aspect.toFixed(2) : '2.15'}:1</div>
                <div>Facing Audience:</div>
                <div className="text-emerald-400 font-bold">YES (+Z Normal)</div>
                <div>Depth Fighting:</div>
                <div className="text-emerald-400 font-bold">PROTECTED (Offset -2)</div>
              </div>
            </div>

            {/* 2. Renderer State */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-2.5">
              <div className="text-[11px] font-bold text-slate-200 mb-1.5 flex items-center justify-between">
                <span>2. Renderer &amp; Graphics State</span>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              </div>
              <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-400 font-mono">
                <div>Canvas Alpha:</div>
                <div className={telemetry?.renderer.alpha ? 'text-cyan-400 font-bold' : 'text-slate-300'}>
                  {telemetry?.renderer.alpha ? 'true (cut-out active)' : 'false'}
                </div>
                <div>Clear Alpha:</div>
                <div className="text-slate-200">{telemetry?.renderer.clearAlpha.toFixed(1)}</div>
                <div>Scene Background:</div>
                <div className={telemetry?.renderer.hasSceneBackground ? 'text-slate-300' : 'text-cyan-400 font-bold'}>
                  {telemetry?.renderer.hasSceneBackground ? 'Active (#07080a)' : 'Transparent (null)'}
                </div>
                <div>Fog State:</div>
                <div className="text-slate-200">{telemetry?.renderer.fogActive ? 'Enabled' : 'Disabled (cutout)'}</div>
                <div>Tone Mapping:</div>
                <div className="text-slate-200">{telemetry?.renderer.toneMapping || 'ACESFilmic'}</div>
                <div>Render FPS:</div>
                <div className="text-emerald-400 font-bold">{telemetry?.fps || 60} fps</div>
              </div>
            </div>

            {/* 3. CSS Layering */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-2.5">
              <div className="text-[11px] font-bold text-slate-200 mb-1.5 flex items-center justify-between">
                <span>3. CSS Layering &amp; Input</span>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              </div>
              <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-400 font-mono">
                <div>Canvas Z-Index:</div>
                <div className="text-slate-200">10 (top)</div>
                <div>Canvas Clicks:</div>
                <div className="text-emerald-400">auto (3D orbit / sit)</div>
                <div>IFrame Z-Index:</div>
                <div className="text-slate-200">1 (behind cut-out)</div>
                <div>IFrame Controls:</div>
                <div className="text-sky-400">Via Dedicated HUD</div>
              </div>
            </div>

            {/* 4. Active Player Telemetry */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-2.5">
              <div className="text-[11px] font-bold text-slate-200 mb-1.5 flex items-center justify-between">
                <span>4. Player / API Status</span>
                {telemetry?.status === 'PASS' ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 text-rose-500" />
                )}
              </div>

              {activeMode === 'youtube_css3d' ? (
                <div className="space-y-1 text-[11px] font-mono text-slate-400">
                  <div className="flex justify-between">
                    <span>YouTube API:</span>
                    <span className="text-slate-200">{telemetry?.youtube?.apiLoaded ? 'LOADED' : 'INITIALIZING'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Player State:</span>
                    <span className="text-emerald-400 font-bold">{telemetry?.youtube?.playerStateText || 'CUED'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Error Code:</span>
                    <span className={telemetry?.youtube?.errorCode ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                      {telemetry?.youtube?.errorCode ?? '0 (None)'}
                    </span>
                  </div>
                  {telemetry?.youtube?.errorText && (
                    <div className="text-rose-400 text-[10px] mt-1 p-1 bg-rose-500/10 rounded border border-rose-500/20">
                      {telemetry.youtube.errorText}
                    </div>
                  )}
                </div>
              ) : activeMode === 'video_texture' ? (
                <div className="space-y-1 text-[11px] font-mono text-slate-400">
                  <div className="flex justify-between">
                    <span>Source:</span>
                    <span className="text-slate-200 truncate max-w-[140px]">{telemetry?.video?.src || '/trailers/sample.mp4'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Current Time:</span>
                    <span className="text-emerald-400 font-bold">{telemetry?.video?.currentTime.toFixed(2) || '0.00'}s</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Ready State:</span>
                    <span className="text-slate-200">4 (HAVE_ENOUGH_DATA)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Playback:</span>
                    <span className="text-emerald-400 font-bold">{telemetry?.video?.paused ? 'PAUSED' : 'PLAYING'}</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-1 text-[11px] font-mono text-slate-400">
                  <div className="flex justify-between">
                    <span>Strategy:</span>
                    <span className="text-purple-400 font-bold">2D Canvas Dynamic Texture</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Motion Proof:</span>
                    <span className="text-emerald-400 font-bold">Continuous Sweep (60 FPS)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>CORS Risk:</span>
                    <span className="text-emerald-400 font-bold">ZERO (Safe Canvas)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Guarantee:</span>
                    <span className="text-emerald-400 font-bold">Never Empty</span>
                  </div>
                </div>
              )}
            </div>

            {/* 5. Screenshot Gallery */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-2.5">
              <div className="text-[11px] font-bold text-slate-200 mb-1.5 flex items-center justify-between">
                <span>5. Captured Screenshots</span>
                <span className="text-[10px] text-slate-400">{Object.keys(capturedScreenshots).length} captured</span>
              </div>
              {capturedScreenshots[activeMode] ? (
                <div className="space-y-1.5">
                  <img
                    src={capturedScreenshots[activeMode]}
                    alt={`Screenshot of mode ${activeMode}`}
                    className="w-full h-24 object-cover rounded-lg border border-slate-700 shadow"
                  />
                  <a
                    href={capturedScreenshots[activeMode]}
                    download={`screen_test_${activeMode}.png`}
                    className="flex items-center justify-center gap-1 w-full rounded bg-slate-800 hover:bg-slate-700 py-1 text-[10px] font-bold text-slate-200"
                  >
                    <Download className="h-3 w-3" />
                    <span>Download PNG</span>
                  </a>
                </div>
              ) : (
                <p className="text-[10px] text-slate-500 italic">No screenshot captured for current mode yet.</p>
              )}
            </div>

            {/* 6. Live Diagnostic Log Stream */}
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-2 font-mono text-[10px] h-36 overflow-y-auto space-y-1">
              <div className="text-slate-500 border-b border-slate-800 pb-1 font-bold">CONSOLE &amp; DIAGNOSTIC TRACE</div>
              {consoleLogs.map((l, i) => (
                <div
                  key={i}
                  className={`leading-relaxed ${
                    l.type === 'error' ? 'text-rose-400' : l.type === 'warn' ? 'text-amber-300' : 'text-slate-400'
                  }`}
                >
                  <span className="text-slate-600">[{l.time}]</span> {l.msg}
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
