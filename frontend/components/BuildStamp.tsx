'use client';

import React, { useEffect, useState } from 'react';

export function BuildStamp() {
  const commitSha = process.env.NEXT_PUBLIC_GIT_COMMIT_SHA || 'dev';
  const buildTime = process.env.NEXT_PUBLIC_BUILD_TIME || new Date().toISOString();
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';

  return (
    <div
      data-testid="build-stamp"
      className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-300 bg-slate-100/80 px-3 py-1 font-mono text-xs text-slate-600 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-black/40 dark:text-slate-400 select-none"
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
      <span data-testid="build-stamp-git">git:{commitSha.slice(0, 7)}</span>
      <span className="opacity-40">|</span>
      <span data-testid="build-stamp-time">built:{buildTime.replace('T', ' ').slice(0, 19)} UTC</span>
      <span className="opacity-40">|</span>
      <span data-testid="build-stamp-api" className="text-emerald-600 dark:text-emerald-400 font-semibold">
        api:{backendUrl}
      </span>
      {process.env.NODE_ENV !== 'production' && (
        <span className="rounded bg-amber-500/10 px-1 text-[10px] font-bold text-amber-600">
          DEV
        </span>
      )}
    </div>
  );
}

