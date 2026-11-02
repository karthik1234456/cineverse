'use client';

import React from 'react';
import { useProgress } from '@react-three/drei';

interface LoadingOverlayProps {
  error?: string | null;
  onRetry?: () => void;
}

export function LoadingOverlay({ error, onRetry }: LoadingOverlayProps) {
  const { progress, active } = useProgress();

  if (!active && !error) return null;

  // Derive descriptive stage text based on progress percentage
  let stageText = 'Initializing 3D auditorium engine...';
  if (progress > 20 && progress <= 50) {
    stageText = 'Loading 100 contoured recliner seats...';
  } else if (progress > 50 && progress <= 80) {
    stageText = 'Calibrating acoustic panels & lighting...';
  } else if (progress > 80 && progress < 100) {
    stageText = 'Verifying sightlines & geometric FOV...';
  } else if (progress >= 100) {
    stageText = 'Auditorium ready';
  }

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#07080a] text-white">
      <div className="w-full max-w-md px-6 text-center">
        {/* CineVerse Branding */}
        <div className="mb-8 flex items-center justify-center gap-2">
          <div className="h-3 w-3 rounded-full bg-[#e50914] shadow-[0_0_12px_#e50914]" />
          <h1 className="text-2xl font-bold tracking-widest text-slate-100 uppercase">
            CineVerse <span className="text-[#e50914]">3D</span>
          </h1>
        </div>

        {error ? (
          <div className="rounded-lg border border-red-900/60 bg-red-950/40 p-6 text-left">
            <h2 className="text-lg font-semibold text-red-400">Failed to Load 3D Experience</h2>
            <p className="mt-2 text-sm text-slate-300">{error}</p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="mt-4 rounded-md bg-[#e50914] px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
              >
                Retry Loading
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full bg-gradient-to-r from-red-600 to-[#e50914] transition-all duration-300 ease-out"
                style={{ width: `${Math.max(5, progress)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>{stageText}</span>
              <span className="font-mono font-medium text-slate-200">{Math.round(progress)}%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function WebGLFallback() {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-[#090a0f] p-6 text-center text-white">
      <div className="max-w-md rounded-xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl backdrop-blur-md">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-900/40 text-red-500">
          ⚠️
        </div>
        <h2 className="text-xl font-bold text-slate-100">WebGL Not Available</h2>
        <p className="mt-3 text-sm text-slate-400">
          Your browser or graphics hardware does not have WebGL acceleration enabled. Please enable
          hardware acceleration in your browser settings to explore CineVerse in 3D.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-6 rounded-lg bg-[#e50914] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-red-950 transition hover:bg-red-700"
        >
          Reload Page
        </button>
      </div>
    </div>
  );
}

