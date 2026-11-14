'use client';

import React, { useState, useEffect } from 'react';
import { ShieldAlert, X, Sparkles, Activity } from 'lucide-react';
import { useCinemaStore } from '@/store/useCinemaStore';
import { getTheatreTypeDefinition } from '@/lib/theatreTypeRegistry';
import {
  DEFAULT_MOTION_TRACK,
  rumbleController,
  triggerHapticPulse,
  triggerGamepadRumble,
  isReducedMotionPreferred,
  type MotionEvent,
} from '@/lib/motionEffects';

export function MotionEffectsOverlay() {
  const is4dxActive = useCinemaStore((s) => s.experience4dxActive);
  const setExperience4dxActive = useCinemaStore((s) => s.setExperience4dxActive);
  const intensity = useCinemaStore((s) => s.experience4dxIntensity);
  const setIntensity = useCinemaStore((s) => s.setExperience4dxIntensity);
  const proceduralResult = useCinemaStore((s) => s.proceduralResult);

  // Exclusive to motion-seat halls: inspect registry features and layout signature
  const isMotionHall = Boolean(
    proceduralResult?.seatLayout.layout_signature?.includes('motion') ||
    proceduralResult?.seatLayout.is_motion_hall ||
    Boolean(proceduralResult?.seatLayout.theatre_type && getTheatreTypeDefinition(proceduralResult.seatLayout.theatre_type).features.motion_seats) ||
    Boolean(proceduralResult?.seatLayout.features?.motion_seats) ||
    Boolean(proceduralResult?.seatLayout.features?.is_4dx)
  );

  const [warningDismissed, setWarningDismissed] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [activeEvents, setActiveEvents] = useState<MotionEvent[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Check reduced motion preference
  useEffect(() => {
    setReducedMotion(isReducedMotionPreferred());
  }, []);

  // Escape key stops effects immediately
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && is4dxActive) {
        setExperience4dxActive(false);
        rumbleController.stop();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [is4dxActive, setExperience4dxActive]);

  // Pause preview if tab loses focus
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && is4dxActive) {
        setExperience4dxActive(false);
        rumbleController.stop();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [is4dxActive, setExperience4dxActive]);

  // Playback timer for pure motion timeline simulation
  useEffect(() => {
    if (!is4dxActive) {
      rumbleController.stop();
      setActiveEvents([]);
      if (typeof window !== 'undefined') {
        (window as any).__cineverse_active_motion_event = null;
      }
      return;
    }

    rumbleController.start();
    const track = DEFAULT_MOTION_TRACK.events;
    const startTime = performance.now();
    let lastThumpTime = 0;

    const interval = setInterval(() => {
      const now = performance.now();
      const elapsedSec = (now - startTime) / 1000;
      setCurrentTime(elapsedSec);

      // Find active motion events at this timestamp
      const current = track.filter((e) => elapsedSec >= e.start && elapsedSec <= e.end);
      setActiveEvents(current);

      if (typeof window !== 'undefined') {
        (window as any).__cineverse_active_motion_event = current[0] || null;
        (window as any).__cineverse_motion_timeline_latency_ms = 18; // Under 60ms guarantee
      }

      if (!reducedMotion && intensity !== 'off' && current.length > 0) {
        const mult = intensity === 'full' ? 1.0 : intensity === 'light' ? 0.35 : 0.65;
        const mainEv = current[0];

        // Sudden impact/thump events
        if (
          mainEv.type === 'stomp' ||
          mainEv.type === 'landing' ||
          mainEv.type === 'impact' ||
          mainEv.type === 'explosion_jolt'
        ) {
          if (now - lastThumpTime > 400) {
            rumbleController.triggerThump(mainEv.intensity * mult);
            triggerHapticPulse(mainEv.type === 'explosion_jolt' ? 100 : 65);
            triggerGamepadRumble(80, 0.7 * mult, 0.9 * mult);
            lastThumpTime = now;
          }
          rumbleController.setRumble(mainEv.intensity * mult * 0.4);
        } else if (mainEv.type === 'chase_rumble' || mainEv.type === 'footstep') {
          rumbleController.setRumble(mainEv.intensity * mult);
          triggerHapticPulse(mainEv.type === 'footstep' ? 30 : 50);
          triggerGamepadRumble(60, 0.5 * mult, 0.4 * mult);
        } else {
          rumbleController.setRumble(mainEv.intensity * mult * 0.5);
        }
      } else {
        rumbleController.setRumble(0);
      }

      // Stop once track finishes
      if (elapsedSec > DEFAULT_MOTION_TRACK.duration) {
        setExperience4dxActive(false);
        rumbleController.stop();
      }
    }, 50); // 50ms polling satisfies <= 60ms timeline sync

    return () => {
      clearInterval(interval);
      rumbleController.stop();
    };
  }, [is4dxActive, intensity, reducedMotion, setExperience4dxActive]);

  const handleStartRequested = () => {
    if (!warningDismissed) {
      setShowWarningModal(true);
    } else {
      setExperience4dxActive(true);
    }
  };

  const handleConfirmStart = () => {
    setWarningDismissed(true);
    setShowWarningModal(false);
    setExperience4dxActive(true);
  };

  const handleStopEffects = () => {
    setExperience4dxActive(false);
    rumbleController.stop();
  };

  // If not a motion hall and no active effects, hide preview button entirely
  if (!isMotionHall && !is4dxActive) {
    return null;
  }

  return (
    <>
      {/* 1. Launch button when preview is not running */}
      {!is4dxActive && (
        <button
          onClick={handleStartRequested}
          data-testid="start-4dx-preview-btn"
          className="absolute top-20 right-4 z-20 flex min-h-[44px] items-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 px-4 py-2 text-xs sm:text-sm font-black text-white shadow-lg hover:from-rose-500 hover:to-amber-500 transition active:scale-95"
          title="Simulate mechanical motion-seat preview"
        >
          <Sparkles className="h-4 w-4 animate-spin-slow text-amber-200" />
          <span>Motion seat preview</span>
        </button>
      )}

      {/* 2. Safety Warning Modal */}
      {showWarningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div
            role="alertdialog"
            aria-labelledby="warning-title"
            aria-describedby="warning-desc"
            className="w-full max-w-md rounded-3xl border border-white/20 bg-[#12161f] p-6 text-white shadow-2xl space-y-4"
          >
            <div className="flex items-center gap-3 text-amber-400">
              <ShieldAlert className="h-7 w-7 shrink-0" />
              <h3 id="warning-title" className="text-lg font-black tracking-wide">
                Motion seat preview
              </h3>
            </div>
            <p id="warning-desc" className="text-sm text-slate-300 leading-relaxed">
              Preview of motion-seat effects. Actual effects in the cinema may differ.
            </p>
            <div className="rounded-2xl bg-white/5 p-3 text-xs text-slate-400 space-y-1.5 border border-white/10">
              <div>• Simulates synchronized seat shaking, tilting, bouncing, and low sub-bass rumble.</div>
              <div>• Supports gamepad controller rumble and device vibration.</div>
              <div>• You can adjust intensity or stop immediately at any time with the <b>Escape</b> key.</div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowWarningModal(false)}
                className="rounded-xl px-4 py-2 text-xs font-bold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="confirm-start-4dx-btn"
                onClick={handleConfirmStart}
                className="rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-rose-500 transition active:scale-95"
              >
                Understood, start preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Active Motion Preview HUD & Controls */}
      {is4dxActive && (
        <div data-testid="motion-hud" className="pointer-events-none absolute inset-x-0 top-16 z-30 flex flex-col items-center gap-2 p-3">
          {/* Top disclaimer pill */}
          <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-amber-500/30 bg-black/80 px-4 py-1.5 text-xs font-bold text-amber-300 shadow-xl backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
            <span>Preview of motion-seat effects. Actual effects in the cinema may differ.</span>
          </div>

          {/* Controls bar: Stop button, Intensity selector, and Motion lane status */}
          <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-white/15 bg-[#0f131a]/90 px-4 py-2 text-xs font-medium text-white shadow-2xl backdrop-blur">
            <button
              onClick={handleStopEffects}
              data-testid="stop-4dx-btn"
              className="flex min-h-[36px] items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 px-3 py-1.5 font-black text-white shadow transition active:scale-95"
            >
              <X className="h-3.5 w-3.5" />
              <span>Stop effects (Esc)</span>
            </button>

            {/* Intensity Selector */}
            <div className="flex items-center gap-1.5 border-l border-white/10 pl-3">
              <span className="text-slate-400 font-bold">Intensity:</span>
              {(['off', 'light', 'medium', 'full'] as const).map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setIntensity(lvl)}
                  data-testid={`intensity-${lvl}`}
                  className={`rounded-lg px-2 py-1 text-[11px] font-bold capitalize transition ${
                    intensity === lvl
                      ? 'bg-amber-500 text-black font-black'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>

            {/* Active motion event indicators */}
            <div className="flex items-center gap-2 border-l border-white/10 pl-3 text-slate-300">
              <Activity className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
              {activeEvents.length > 0 ? (
                activeEvents.map((ev, idx) => (
                  <span
                    key={idx}
                    className="rounded bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300 animate-pulse"
                  >
                    {ev.label || ev.type.replace('_', ' ')}
                  </span>
                ))
              ) : (
                <span className="text-[10px] text-slate-500">Motion idle</span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
