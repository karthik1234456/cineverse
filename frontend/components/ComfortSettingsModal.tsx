'use client';

import React, { useEffect, useRef } from 'react';
import { useComfortStore, type TextSize } from '@/store/useComfortStore';
import { useFeatureFlags } from '@/store/useFeatureFlags';
import {
  X, Eye, Type, Zap, Subtitles, Layers, Sparkles, Check
} from 'lucide-react';

interface ComfortSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ComfortSettingsModal({ isOpen, onClose }: ComfortSettingsModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const {
    textSize, highContrast, reducedMotion, captionsAlwaysOn, simpleMode,
    setTextSize, setHighContrast, setReducedMotion, setCaptionsAlwaysOn, setSimpleMode,
  } = useComfortStore();

  const {
    enableGuidedTour, enableSeatCompare, enableShareView, enableSoundPreview, enableVrPreview,
    setFlag,
  } = useFeatureFlags();

  // Focus trap and ESC handler
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'Tab' && modalRef.current) {
        const focusables = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    // Autofocus close or first button
    setTimeout(() => {
      closeBtnRef.current?.focus();
    }, 50);

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="comfort-settings-heading"
      data-testid="comfort-modal"
    >
      <div
        ref={modalRef}
        className="w-full max-w-lg bg-[#FFF8F1] high-contrast:bg-black high-contrast:text-white high-contrast:border-2 high-contrast:border-white rounded-2xl shadow-2xl border border-[#E6DCD2] p-6 max-h-[90vh] overflow-y-auto"
        data-testid="comfort-settings-modal"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#E6DCD2] high-contrast:border-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#FDEBD8] high-contrast:bg-white high-contrast:text-black text-[#C8102E]">
              <Eye className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="comfort-settings-heading"
                className="text-xl font-bold text-[#1B1320] high-contrast:text-white"
              >
                Accessibility & Comfort
              </h2>
              <p className="text-sm text-[#4A4056] high-contrast:text-gray-200">
                Customise typography, motion, contrast and views.
              </p>
            </div>
          </div>
          <button
            ref={closeBtnRef}
            onClick={onClose}
            className="p-2 rounded-xl text-[#4A4056] high-contrast:text-white hover:bg-[#FDEBD8] high-contrast:hover:bg-gray-800 transition min-w-[48px] min-h-[48px] flex items-center justify-center"
            aria-label="Close accessibility settings"
            data-testid="close-comfort-modal-btn"
          >
            <X className="w-6 h-6" aria-hidden="true" />
          </button>
        </div>

        {/* Settings Body */}
        <div className="py-5 space-y-6">
          {/* 1. Text Size */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-base font-semibold text-[#1B1320] high-contrast:text-white flex items-center gap-2">
                <Type className="w-4 h-4 text-[#C8102E] high-contrast:text-white" aria-hidden="true" />
                Text Size
              </label>
              <span className="text-sm font-medium text-[#4A4056] high-contrast:text-gray-200">
                {textSize}%
              </span>
            </div>
            <div
              className="grid grid-cols-3 gap-2"
              role="radiogroup"
              aria-label="Text size options"
            >
              {([100, 125, 150] as TextSize[]).map((sz) => (
                <button
                  key={sz}
                  type="button"
                  role="radio"
                  aria-checked={textSize === sz}
                  onClick={() => setTextSize(sz)}
                  data-testid={`text-size-${sz}-btn`}
                  className={`min-h-[48px] px-3 py-2.5 rounded-xl font-bold text-sm border transition flex items-center justify-center gap-1.5 ${
                    textSize === sz
                      ? 'bg-[#C8102E] text-white border-[#C8102E] high-contrast:bg-white high-contrast:text-black high-contrast:border-white shadow-sm'
                      : 'bg-white text-[#1B1320] border-[#E6DCD2] hover:bg-[#FDEBD8] high-contrast:bg-black high-contrast:text-white high-contrast:border-white'
                  }`}
                >
                  {textSize === sz && <Check className="w-4 h-4" aria-hidden="true" />}
                  <span>{sz}%</span>
                </button>
              ))}
            </div>
          </div>

          {/* 2. High Contrast Mode */}
          <div className="flex items-start justify-between gap-4 pt-4 border-t border-[#E6DCD2] high-contrast:border-white">
            <div className="space-y-0.5">
              <label
                htmlFor="toggle-high-contrast"
                className="text-base font-semibold text-[#1B1320] high-contrast:text-white cursor-pointer"
              >
                High-Contrast Mode
              </label>
              <p className="text-sm text-[#4A4056] high-contrast:text-gray-200">
                Stark black and white styling with high-visibility borders (&ge; 7:1).
              </p>
            </div>
            <button
              id="toggle-high-contrast"
              type="button"
              role="switch"
              aria-checked={highContrast}
              onClick={() => setHighContrast(!highContrast)}
              data-testid="toggle-high-contrast-btn"
              className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:ring-2 focus-visible:ring-[#C8102E] ${
                highContrast ? 'bg-[#C8102E] high-contrast:bg-white' : 'bg-gray-300 high-contrast:bg-gray-700'
              }`}
            >
              <span className="sr-only">Enable high contrast mode</span>
              <span
                className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white high-contrast:bg-black shadow-lg ring-0 transition duration-200 ease-in-out ${
                  highContrast ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* 3. Reduced Motion */}
          <div className="flex items-start justify-between gap-4 pt-4 border-t border-[#E6DCD2] high-contrast:border-white">
            <div className="space-y-0.5">
              <label
                htmlFor="toggle-reduced-motion"
                className="text-base font-semibold text-[#1B1320] high-contrast:text-white cursor-pointer"
              >
                Reduced Motion
              </label>
              <p className="text-sm text-[#4A4056] high-contrast:text-gray-200">
                Stops video glimpses, page shifts, and continuous animations.
              </p>
            </div>
            <button
              id="toggle-reduced-motion"
              type="button"
              role="switch"
              aria-checked={reducedMotion}
              onClick={() => setReducedMotion(!reducedMotion)}
              data-testid="toggle-reduced-motion-btn"
              className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                reducedMotion ? 'bg-[#C8102E] high-contrast:bg-white' : 'bg-gray-300 high-contrast:bg-gray-700'
              }`}
            >
              <span className="sr-only">Enable reduced motion</span>
              <span
                className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white high-contrast:bg-black shadow-lg ring-0 transition duration-200 ease-in-out ${
                  reducedMotion ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* 4. Captions Always On */}
          <div className="flex items-start justify-between gap-4 pt-4 border-t border-[#E6DCD2] high-contrast:border-white">
            <div className="space-y-0.5">
              <label
                htmlFor="toggle-captions"
                className="text-base font-semibold text-[#1B1320] high-contrast:text-white flex items-center gap-1.5 cursor-pointer"
              >
                <Subtitles className="w-4 h-4 text-[#C8102E] high-contrast:text-white" aria-hidden="true" />
                Captions for Trailers
              </label>
              <p className="text-sm text-[#4A4056] high-contrast:text-gray-200">
                Always show English / regional subtitles on video playback.
              </p>
            </div>
            <button
              id="toggle-captions"
              type="button"
              role="switch"
              aria-checked={captionsAlwaysOn}
              onClick={() => setCaptionsAlwaysOn(!captionsAlwaysOn)}
              data-testid="toggle-captions-btn"
              className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                captionsAlwaysOn ? 'bg-[#C8102E] high-contrast:bg-white' : 'bg-gray-300 high-contrast:bg-gray-700'
              }`}
            >
              <span className="sr-only">Always show captions</span>
              <span
                className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white high-contrast:bg-black shadow-lg ring-0 transition duration-200 ease-in-out ${
                  captionsAlwaysOn ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* 5. Simple Mode */}
          <div className="flex items-start justify-between gap-4 pt-4 border-t border-[#E6DCD2] high-contrast:border-white">
            <div className="space-y-0.5">
              <label
                htmlFor="toggle-simple-mode"
                className="text-base font-semibold text-[#1B1320] high-contrast:text-white flex items-center gap-1.5 cursor-pointer"
              >
                <Layers className="w-4 h-4 text-[#C8102E] high-contrast:text-white" aria-hidden="true" />
                Simple Mode
              </label>
              <p className="text-sm text-[#4A4056] high-contrast:text-gray-200">
                Hides 3D auditorium, background videos, and extras for ultra-fast, clean booking.
              </p>
            </div>
            <button
              id="toggle-simple-mode"
              type="button"
              role="switch"
              aria-checked={simpleMode}
              onClick={() => setSimpleMode(!simpleMode)}
              data-testid="toggle-simple-mode-btn"
              className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                simpleMode ? 'bg-[#C8102E] high-contrast:bg-white' : 'bg-gray-300 high-contrast:bg-gray-700'
              }`}
            >
              <span className="sr-only">Enable simple mode</span>
              <span
                className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white high-contrast:bg-black shadow-lg ring-0 transition duration-200 ease-in-out ${
                  simpleMode ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Optional Labs / Extras behind Feature Flags (Off by default) */}
          <div className="pt-4 border-t border-[#E6DCD2] high-contrast:border-white">
            <details className="group" open>
              <summary className="flex items-center justify-between cursor-pointer list-none text-sm font-bold text-[#C8102E] high-contrast:text-white hover:underline py-1">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" aria-hidden="true" />
                  Optional 3D & Audio Extras (Off by default)
                </span>
                <span className="text-xs text-[#4A4056] high-contrast:text-gray-300 group-open:rotate-180 transition-transform">
                  ▼
                </span>
              </summary>
              <div className="mt-3 space-y-3.5 pl-2 border-l-2 border-[#E6DCD2] high-contrast:border-white text-sm">
                <p className="text-xs text-[#4A4056] high-contrast:text-gray-300">
                  These optional features are disabled by default so the core booking journey stays clean and simple.
                </p>

                <div className="flex items-center justify-between pb-2 border-b border-[#E6DCD2] high-contrast:border-white">
                  <span className="font-semibold text-[#1B1320] high-contrast:text-white">Enable All Experimental Extras</span>
                  <button
                    type="button"
                    onClick={() => {
                      const anyEnabled = enableGuidedTour || enableSeatCompare || enableShareView || enableSoundPreview || enableVrPreview;
                      const next = !anyEnabled;
                      setFlag('enableGuidedTour', next);
                      setFlag('enableSeatCompare', next);
                      setFlag('enableShareView', next);
                      setFlag('enableSoundPreview', next);
                      setFlag('enableVrPreview', next);
                    }}
                    data-testid="toggle-experimental-extras-btn"
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#C8102E] text-white hover:bg-[#A60D26] transition"
                  >
                    Toggle All Extras
                  </button>
                </div>

                {/* a. Guided 3D Tour */}
                <div className="flex items-center justify-between">
                  <label htmlFor="flag-guided-tour" className="cursor-pointer">
                    Guided 3D Tour (30s flythrough)
                  </label>
                  <input
                    id="flag-guided-tour"
                    type="checkbox"
                    checked={enableGuidedTour}
                    onChange={(e) => setFlag('enableGuidedTour', e.target.checked)}
                    className="w-5 h-5 accent-[#C8102E]"
                    data-testid="flag-guided-tour"
                  />
                </div>

                {/* b. Compare Seats */}
                <div className="flex items-center justify-between">
                  <label htmlFor="flag-seat-compare" className="cursor-pointer">
                    Compare up to 3 seats side-by-side
                  </label>
                  <input
                    id="flag-seat-compare"
                    type="checkbox"
                    checked={enableSeatCompare}
                    onChange={(e) => setFlag('enableSeatCompare', e.target.checked)}
                    className="w-5 h-5 accent-[#C8102E]"
                    data-testid="flag-seat-compare"
                  />
                </div>

                {/* c. Share View */}
                <div className="flex items-center justify-between">
                  <label htmlFor="flag-share-view" className="cursor-pointer">
                    &quot;Share my view&quot; seat snapshot
                  </label>
                  <input
                    id="flag-share-view"
                    type="checkbox"
                    checked={enableShareView}
                    onChange={(e) => setFlag('enableShareView', e.target.checked)}
                    className="w-5 h-5 accent-[#C8102E]"
                    data-testid="flag-share-view"
                  />
                </div>

                {/* d. Sound Preview */}
                <div className="flex items-center justify-between">
                  <label htmlFor="flag-sound-preview" className="cursor-pointer">
                    &quot;Hear it from here&quot; sound preview
                  </label>
                  <input
                    id="flag-sound-preview"
                    type="checkbox"
                    checked={enableSoundPreview}
                    onChange={(e) => setFlag('enableSoundPreview', e.target.checked)}
                    className="w-5 h-5 accent-[#C8102E]"
                    data-testid="flag-sound-preview"
                  />
                </div>

                {/* e. VR Preview */}
                <div className="flex items-center justify-between">
                  <label htmlFor="flag-vr-preview" className="cursor-pointer">
                    Experimental VR seat preview
                  </label>
                  <input
                    id="flag-vr-preview"
                    type="checkbox"
                    checked={enableVrPreview}
                    onChange={(e) => setFlag('enableVrPreview', e.target.checked)}
                    className="w-5 h-5 accent-[#C8102E]"
                    data-testid="flag-vr-preview"
                  />
                </div>
              </div>
            </details>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-[#E6DCD2] high-contrast:border-white flex justify-end">
          <button
            type="button"
            onClick={onClose}
            data-testid="save-comfort-settings-btn"
            className="min-h-[48px] px-6 py-2.5 rounded-xl font-bold bg-[#C8102E] text-white hover:bg-[#A60D26] high-contrast:bg-white high-contrast:text-black transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

