'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

export function TmdbReadinessBanner() {
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://127.0.0.1:8000';
    fetch(`${apiUrl}/api/dev/readiness.json`)
      .then((res) => {
        if (res.ok) return res.json();
        return null;
      })
      .then((data) => {
        if (data?.environment?.banner) {
          setBanner(data.environment.banner);
        }
      })
      .catch(() => {
        // Fallback banner when key is missing or rejected
        setBanner('Real posters unavailable: TMDB key missing or rejected');
      });
  }, []);

  if (!banner) return null;

  return (
    <div
      data-testid="tmdb-readiness-banner"
      role="alert"
      className="w-full bg-[#C8102E] text-white px-4 py-2.5 text-center text-sm font-bold shadow-md flex items-center justify-center gap-2 z-40 sticky top-0"
    >
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{banner}</span>
    </div>
  );
}
