'use client';

import React, { useState, useEffect } from 'react';
import ProblemReportModal from './ProblemReportModal';
import { initTelemetryBuffer } from '../lib/telemetryBuffer';

export default function ProblemReportButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [isEnabled, setIsEnabled] = useState(true);

  useEffect(() => {
    // Check client feature flag: default enabled in dev/test, can be disabled by NEXT_PUBLIC_ENABLE_BUG_REPORTING=false
    const flag = process.env.NEXT_PUBLIC_ENABLE_BUG_REPORTING;
    if (flag === 'false' || flag === '0') {
      setIsEnabled(false);
      return;
    }

    // Initialize telemetry log buffers on mount
    initTelemetryBuffer();

    // Keyboard shortcut handler: Alt+Shift+B, Ctrl+Shift+B, or F8
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.altKey && e.shiftKey && e.key.toLowerCase() === 'b') ||
        (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'b') ||
        e.key === 'F8'
      ) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!isEnabled) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 rounded-full transition shadow-sm hover:border-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500"
        title="Report an issue or glitch (Alt+Shift+B or F8)"
        aria-label="Report a problem"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        <span>Report a problem</span>
        <kbd className="hidden md:inline-block px-1 py-0.2 text-[10px] bg-slate-800 border border-slate-700 rounded text-slate-400 font-mono">
          F8
        </kbd>
      </button>

      <ProblemReportModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}

