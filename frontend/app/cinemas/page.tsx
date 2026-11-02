// app/cinemas/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { MapPin, Film, Compass, ChevronRight } from 'lucide-react';
import { getCinemas, type Cinema } from '@/services/api';

export default function CinemasPage() {
  const [cinemas, setCinemas] = useState<Cinema[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCinemas()
      .then((data) => setCinemas(data))
      .catch((err) => console.warn(err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 w-full">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-white">Cinemas & Theatres</h1>
        <p className="text-xs text-zinc-400 mt-1">
          Explore CineVerse properties equipped with Laser IMAX, Dolby Atmos sound, and 3D auditorium preview
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cinemas.map((c) => (
          <div
            key={c.id}
            className="flex flex-col justify-between rounded-2xl border border-white/5 bg-[#12131a] p-6 hover:border-white/15 transition group"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="rounded-full bg-red-600/20 px-2.5 py-0.5 text-[10px] font-bold text-red-400 border border-red-500/30">
                  CineVerse Premium
                </span>
                <span className="text-[11px] text-zinc-500">M-Ticket</span>
              </div>

              <h2 className="text-xl font-bold text-white group-hover:text-[#e50914] transition">
                {c.name}
              </h2>

              <p className="flex items-start gap-1.5 text-xs text-zinc-400 mt-2">
                <MapPin className="h-4 w-4 text-zinc-500 shrink-0 mt-0.5" />
                <span>{c.address}</span>
              </p>

              <div className="flex flex-wrap gap-1.5 mt-4">
                {c.facilities?.map((f) => (
                  <span
                    key={f}
                    className="rounded-lg bg-white/5 border border-white/5 px-2.5 py-1 text-[11px] text-zinc-300"
                  >
                    {f}
                  </span>
                ))}
              </div>

              <div className="mt-4 rounded-xl border border-white/5 bg-[#0f1014] p-3 text-xs text-zinc-400">
                <span className="font-semibold text-zinc-300">Cancellation Policy:</span> {c.cancellation_policy}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
              <Link
                href="/cinemas/1/auditorium/1?showtime=1"
                className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:underline"
              >
                <Compass className="h-3.5 w-3.5" />
                <span>3D Theatre</span>
              </Link>

              <Link
                href={`/cinemas/${c.id}`}
                className="flex items-center gap-1 rounded-xl bg-[#e50914] px-4 py-2 text-xs font-bold text-white hover:bg-red-700 transition"
              >
                <span>Browse Shows</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

