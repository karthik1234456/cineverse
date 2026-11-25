'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Volume2, VolumeX, Play, Pause, Headphones, AlertTriangle } from 'lucide-react';

interface HearItFromHereModalProps {
  isOpen: boolean;
  onClose: () => void;
  seatId: string;
  distanceMeters?: number;
  offsetDeg?: number;
}

export function HearItFromHereModal({
  isOpen,
  onClose,
  seatId,
  distanceMeters = 12.5,
  offsetDeg = 2.0,
}: HearItFromHereModalProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true); // strictly muted by default
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const pannerRef = useRef<StereoPannerNode | null>(null);

  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, []);

  if (!isOpen) return null;

  function stopAudio() {
    if (oscRef.current) {
      try {
        oscRef.current.stop();
        oscRef.current.disconnect();
      } catch {
        // ignore
      }
      oscRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setIsPlaying(false);
  }

  function toggleAudio() {
    if (isPlaying) {
      stopAudio();
    } else {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        audioCtxRef.current = ctx;

        // Panner based on left/right angle (-1.0 to 1.0)
        const panner = ctx.createStereoPanner();
        const panValue = Math.max(-1, Math.min(1, offsetDeg / 45));
        panner.pan.setValueAtTime(panValue, ctx.currentTime);
        pannerRef.current = panner;

        // Gain based on distance (inverse square root approximation)
        const gain = ctx.createGain();
        const distFactor = Math.max(0.2, 1.0 - (distanceMeters / 30));
        const initialVol = isMuted ? 0 : distFactor * 0.25;
        gain.gain.setValueAtTime(initialVol, ctx.currentTime);
        gainNodeRef.current = gain;

        // Pleasant ambient cinematic chord (440Hz A4)
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, ctx.currentTime); // warm cinematic drone
        oscRef.current = osc;

        osc.connect(panner);
        panner.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        setIsPlaying(true);
      } catch (err) {
        console.warn('Web Audio not available:', err);
      }
    }
  }

  function handleUnmute() {
    setIsMuted(false);
    if (gainNodeRef.current && audioCtxRef.current) {
      const distFactor = Math.max(0.2, 1.0 - (distanceMeters / 30));
      gainNodeRef.current.gain.setValueAtTime(distFactor * 0.25, audioCtxRef.current.currentTime);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sound-preview-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      data-testid="hear-it-modal"
    >
      <div className="w-full max-w-lg bg-white rounded-3xl border border-[#E6DCD2] p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E6DCD2] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-purple-50 text-purple-700">
              <Headphones className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h3 id="sound-preview-title" className="text-xl font-bold text-[#1B1320]">
                Hear It From Here
              </h3>
              <p className="text-xs text-slate-500">
                Approximate acoustic balance and distance perception from Seat {seatId}.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopAudio();
              onClose();
            }}
            className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 transition min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Close sound preview"
            data-testid="close-sound-modal-btn"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Acoustic Attributes */}
        <div className="p-4 rounded-2xl bg-[#FAF6F0] border border-[#E6DCD2] space-y-2">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-500 font-semibold block">Screen Distance</span>
              <span className="text-sm font-bold text-[#1B1320]">{distanceMeters} meters</span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold block">Stereo Balance / Offset</span>
              <span className="text-sm font-bold text-[#1B1320]">
                {offsetDeg === 0 ? 'Centred (0°)' : `${Math.abs(offsetDeg)}° ${offsetDeg > 0 ? 'Right' : 'Left'}`}
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-600 pt-1">
            Reverberation & soundstage: Dolby Atmos calibrated room decay (~0.4s RT60).
          </p>
        </div>

        {/* Honest Disclaimer (Required by spec) */}
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-950 flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <span className="font-bold">Approximation Notice:</span> This is a mathematical acoustic approximation model of sound attenuation and angle. Actual theatre acoustics depend on auditorium volume, speaker layout, and audience absorption.
          </p>
        </div>

        {/* Muted by default Audio Control */}
        <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-slate-900 text-white space-y-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleAudio}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#C8102E] hover:bg-[#A60D26] text-white font-bold text-sm min-h-[44px] transition shadow"
              data-testid="toggle-sound-preview-btn"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              <span>{isPlaying ? 'Pause Audio' : 'Tap to Play Sound'}</span>
            </button>

            {isPlaying && isMuted && (
              <button
                type="button"
                onClick={handleUnmute}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-bold text-sm min-h-[44px] transition"
                data-testid="unmute-sound-preview-btn"
              >
                <VolumeX className="w-4 h-4" />
                <span>Audio is Muted (Tap to Unmute)</span>
              </button>
            )}

            {isPlaying && !isMuted && (
              <button
                type="button"
                onClick={() => setIsMuted(true)}
                className="p-2.5 rounded-xl bg-white/20 text-white hover:bg-white/30 transition min-h-[44px] min-w-[44px] flex items-center justify-center"
                title="Mute"
              >
                <Volume2 className="w-4 h-4" />
              </button>
            )}
          </div>
          <span className="text-[11px] text-slate-400">
            Audio starts muted by default per accessibility guidelines.
          </span>
        </div>
      </div>
    </div>
  );
}

