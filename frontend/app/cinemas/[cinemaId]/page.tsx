// app/cinemas/[cinemaId]/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { MapPin, Film, Compass, CheckCircle2, ChevronRight } from 'lucide-react';
import { getCinema, type Cinema } from '@/services/api';

export default function CinemaDetailPage() {
  const params = useParams();
  const cinemaId = params.cinemaId as string;
  const [cinema, setCinema] = useState<Cinema | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCinema(cinemaId)
      .then((data) => setCinema(data))
      .catch((err) => console.warn(err))
      .finally(() => setLoading(false));
  }, [cinemaId]);

  if (loading && !cinema) {
    return <div className="p-12 text-center text-zinc-400">Loading cinema details...</div>;
  }

  if (!cinema) {
    return (
      <div className="p-12 text-center text-zinc-400">
        Cinema not found. <Link href="/cinemas" className="text-[#e50914] underline">Return</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 w-full space-y-8">
      <div className="rounded-2xl border border-white/10 bg-[#12131a] p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-red-600/20 px-3 py-1 text-xs font-bold text-red-400 mb-2 border border-red-500/30">
              CineVerse Signature Property
            </div>
            <h1 className="text-3xl font-black text-white">{cinema.name}</h1>
            <p className="flex items-center gap-1.5 text-sm text-zinc-400 mt-2">
              <MapPin className="h-4 w-4 text-zinc-500 shrink-0" />
              <span>{cinema.address}</span>
            </p>
          </div>

          <Link
            href="/cinemas/1/auditorium/1?showtime=1"
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-600/30 to-amber-600/30 border border-[#e50914]/40 px-5 py-3 text-xs font-bold text-amber-300 hover:border-amber-400 transition"
          >
            <Compass className="h-4 w-4 text-amber-400" />
            <span>Enter 3D Auditorium</span>
          </Link>
        </div>

        <div className="mt-6 pt-6 border-t border-white/10 flex flex-wrap gap-2">
          {cinema.facilities?.map((f) => (
            <span
              key={f}
              className="flex items-center gap-1.5 rounded-lg bg-white/5 border border-white/5 px-3 py-1.5 text-xs text-zinc-300"
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span>{f}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-white/5 bg-[#12131a] p-8 text-center space-y-3">
        <h2 className="text-xl font-bold text-white">Find Shows at {cinema.name}</h2>
        <p className="text-xs text-zinc-400 max-w-md mx-auto">
          Explore today's lineup and book tickets with 3D seat preview directly from the Movies page.
        </p>
        <Link
          href="/movies"
          className="inline-flex items-center gap-2 rounded-xl bg-[#e50914] px-6 py-2.5 text-xs font-bold text-white hover:bg-red-700 transition"
        >
          <span>Browse Available Movies</span>
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

