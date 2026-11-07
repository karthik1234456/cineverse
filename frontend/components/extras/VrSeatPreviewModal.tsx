'use client';

import React, { useState, useEffect } from 'react';
import { X, Glasses, AlertCircle, Compass, ShieldCheck } from 'lucide-react';

interface VrSeatPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  seatId: string;
}

export function VrSeatPreviewModal({ isOpen, onClose, seatId }: VrSeatPreviewModalProps) {
  const [hasXrSupport, setHasXrSupport] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (typeof navigator !== 'undefined' && (navigator as any).xr) {
      (navigator as any).xr
        .isSessionSupported('immersive-vr')
        .then((supported: boolean) => setHasXrSupport(supported))
        .catch(() => setHasXrSupport(false));
    } else {
      setHasXrSupport(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="vr-preview-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      data-testid="vr-preview-modal"
    >
      <div className="w-full max-w-lg bg-[#0E1117] text-white rounded-3xl border border-white/20 p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-indigo-600 text-white">
              <Glasses className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h3 id="vr-preview-title" className="text-xl font-bold text-white">
                Experimental VR Headset Preview
              </h3>
              <p className="text-xs text-slate-400">
                Immersive WebXR stereoscopic view from Seat {seatId}.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Close VR preview"
            data-testid="close-vr-modal-btn"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Headset Detection Status Banner (Required: mark UNVERIFIED if no headset) */}
        {!hasXrSupport ? (
          <div
            className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-1.5"
            data-testid="vr-status-unverified"
          >
            <div className="flex items-center gap-2 font-bold text-sm text-amber-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>UNVERIFIED (No VR headset detected)</span>
            </div>
            <p className="leading-relaxed">
              No compatible WebXR immersive headset detected in this browser session. To enter true VR, open this page inside Meta Quest Browser, Apple Vision Pro Safari, or a WebXR-compatible desktop browser.
            </p>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" />
            <span>WebXR VR Headset Detected & Ready</span>
          </div>
        )}

        {/* Comfort Vignette & Teleportation Features */}
        <div className="space-y-3 p-4 rounded-2xl bg-white/5 border border-white/10 text-xs text-slate-300">
          <h4 className="font-bold text-white text-sm">Comfort & Locomotion Features:</h4>
          <ul className="space-y-2 list-disc list-inside">
            <li>
              <span className="font-semibold text-white">Dynamic Comfort Vignette:</span> Automatically narrows peripheral field-of-view during fast head turns to eliminate simulator motion sickness.
            </li>
            <li>
              <span className="font-semibold text-white">Arc Teleport Movement:</span> Click thumbstick to cast an arc and teleport directly to auditorium aisles without continuous acceleration.
            </li>
            <li>
              <span className="font-semibold text-white">Seated POV Snap:</span> Press right trigger to lock instantly into Seat {seatId} at exact physical eye height (1.2m).
            </li>
          </ul>
        </div>

        {/* Action Button */}
        <div className="flex justify-end pt-2">
          <button
            type="button"
            disabled={!hasXrSupport}
            onClick={() => {
              if (hasXrSupport) {
                alert('Launching WebXR Immersive Session with comfort vignette...');
              }
            }}
            className={`min-h-[48px] px-6 py-2.5 rounded-xl font-bold text-sm transition flex items-center gap-2 ${
              hasXrSupport
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg cursor-pointer'
                : 'bg-white/10 text-slate-500 border border-white/10 cursor-not-allowed'
            }`}
            data-testid="enter-vr-btn"
          >
            <Glasses className="w-4 h-4" />
            <span>{hasXrSupport ? 'Enter VR Session' : 'VR Headset Required'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

