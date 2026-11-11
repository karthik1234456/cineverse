'use client';

import React, { useEffect, useState } from 'react';

export function BuildStamp() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Visible in development builds or when debug flag is set (?debug or localStorage)
    const isDev = process.env.NODE_ENV !== 'production';
    let hasDebugFlag = false;
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        hasDebugFlag =
          params.has('debug') ||
          window.localStorage.getItem('cineverse_debug') === 'true' ||
          (window as any).__CINEVERSE_DEBUG === true;
      }
    } catch {
      // Ignore security errors in strict iframe environments
    }

    if (isDev || hasDebugFlag) {
      setIsVisible(true);
    }
  }, []);

  if (!isVisible) return null;

  const commitSha = process.env.NEXT_PUBLIC_GIT_COMMIT_SHA || 'dev';
  const buildTime = process.env.NEXT_PUBLIC_BUILD_TIME || new Date().toISOString();

  return (
    <div
      data-testid="build-stamp"
      className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-300 bg-slate-100/80 px-3 py-1 font-mono text-xs text-slate-600 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-black/40 dark:text-slate-400 select-none"
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
      <span>git:{commitSha.slice(0, 7)}</span>
      <span className="opacity-40">|</span>
      <span>built:{buildTime.replace('T', ' ').slice(0, 19)} UTC</span>
      {process.env.NODE_ENV !== 'production' && (
        <span className="rounded bg-amber-500/10 px-1 text-[10px] font-bold text-amber-600">
          DEV
        </span>
      )}
    </div>
  );
}
