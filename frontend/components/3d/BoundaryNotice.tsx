'use client';

import React, { useEffect, useState } from 'react';
import { useCinemaStore } from '@/store/useCinemaStore';

export function BoundaryNotice() {
  const lastNoticeTime = useCinemaStore((s) => s.lastBoundaryNoticeTime);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!lastNoticeTime) return;
    setVisible(true);
    const timer = setTimeout(() => {
      setVisible(false);
    }, 1800);
    return () => clearTimeout(timer);
  }, [lastNoticeTime]);

  if (!visible) return null;

  return (
    <div
      data-testid="boundary-notice"
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed top-20 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-full border border-amber-500/40 bg-slate-900/90 px-4 py-2 text-xs font-semibold tracking-wide text-amber-200 shadow-2xl backdrop-blur-md transition-opacity duration-300"
    >
      <span className="h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_8px_#fbbf24] animate-ping" />
      <span>Edge of the theatre</span>
    </div>
  );
}

