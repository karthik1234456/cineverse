'use client';

import React from 'react';
import Link from 'next/link';
import { Info } from 'lucide-react';

export function TmdbAttribution() {
  return (
    <div
      data-testid="tmdb-attribution-footer"
      className="mt-6 pt-6 border-t border-[#E6DCD2] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 max-w-7xl mx-auto px-4"
    >
      <div className="flex items-center gap-3">
        {/* Official TMDB Logo SVG Badge */}
        <div
          data-testid="tmdb-logo"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#0d253f] text-white font-black text-xs tracking-wider"
          aria-label="The Movie Database (TMDB)"
        >
          <span className="text-[#01b4e4]">THE</span>
          <span className="text-[#90cea1]">MOVIE</span>
          <span className="text-white">DB</span>
        </div>
        <p className="text-left leading-relaxed">
          This product uses the TMDB API but is not endorsed or certified by TMDB.
        </p>
      </div>

      <div className="flex items-center gap-4 shrink-0">
        <span
          data-testid="sample-showtimes-notice"
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-semibold"
        >
          <Info className="h-3.5 w-3.5 text-amber-600" />
          <span>Sample showtimes for demonstration</span>
        </span>
        <Link href="/about" className="text-[#C8102E] hover:underline font-bold">
          About & Licensing
        </Link>
      </div>
    </div>
  );
}

