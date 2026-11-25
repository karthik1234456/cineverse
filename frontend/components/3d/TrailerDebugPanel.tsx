'use client';

import React, { useEffect, useState } from 'react';
import { useCinemaStore } from '@/store/useCinemaStore';

export function TrailerDebugPanel() {
  const trailer = useCinemaStore((s) => s.trailer);
  const trailerDisplayPreference = useCinemaStore((s) => s.trailerDisplayPreference);
  const houseLights = useCinemaStore((s) => s.houseLights);

  const [isDebug, setIsDebug] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const hasDebugParam = params.get('debug') === '1';
      const isDev = process.env.NODE_ENV === 'development';
      setIsDebug(hasDebugParam || isDev);
    }
  }, []);

  if (!isDebug) return null;

  const isHosted = Boolean(
    trailer.trailerUrl &&
      (trailer.trailerUrl.endsWith('.mp4') ||
        trailer.trailerUrl.endsWith('.webm') ||
        trailer.trailerUrl.startsWith('/trailers/') ||
        trailer.trailerUrl.includes('googleapis.com'))
  );

  const sourceType = isHosted ? 'hosted_mp4' : trailer.trailerUrl ? 'youtube' : 'none';
  const videoIdOrFile = isHosted
    ? trailer.trailerUrl
    : trailer.youtubeTrailerId || (trailer.trailerUrl ? trailer.trailerUrl.split('/').pop() : 'none');

  return (
    <div
      data-testid="trailer-debug-panel"
      className="pointer-events-auto rounded-xl border border-amber-500/40 bg-black/90 p-3 font-mono text-[11px] text-amber-300 shadow-2xl backdrop-blur-md z-50 max-w-sm select-text"
    >
      <div className="flex items-center justify-between border-b border-amber-500/20 pb-1 mb-2 font-bold uppercase tracking-wider text-amber-400">
        <span>Trailer Debug Panel (?debug=1)</span>
      </div>
      <div className="space-y-1">
        <div><span className="text-slate-400">Source Type:</span> <span className="font-bold text-white">{sourceType}</span></div>
        <div className="truncate"><span className="text-slate-400">Video ID/File:</span> <span className="text-white">{videoIdOrFile}</span></div>
        <div><span className="text-slate-400">Embeddable Flag:</span> <span className={trailer.trailerEmbeddable !== false ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>{String(trailer.trailerEmbeddable !== false)}</span></div>
        <div><span className="text-slate-400">Player State:</span> <span className="text-white">{trailer.playbackStatus || 'ready'} ({trailer.isPlaying ? 'playing' : 'stopped'})</span></div>
        <div><span className="text-slate-400">Last Error:</span> <span className="text-rose-400">{trailer.youtubeErrorCode ? `Code ${trailer.youtubeErrorCode}` : 'none'}</span></div>
        <div><span className="text-slate-400">Strategy In Use:</span> <span className="text-sky-300">{trailer.activeStrategy || (trailer.isTheatreMode ? 'theatre_mode' : trailerDisplayPreference)}</span></div>
        <div><span className="text-slate-400">Sound:</span> <span className="text-white">{trailer.isMuted ? 'Muted' : 'Audible'} (Vol: {trailer.volume || 80}%)</span></div>
        <div><span className="text-slate-400">House Lights:</span> <span className="text-white">{houseLights}</span></div>
      </div>
    </div>
  );
}
