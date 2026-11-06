// app/cinemas/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { MapPin, Compass, ChevronRight } from 'lucide-react';
import { getCinemas, type Cinema } from '@/services/api';

export default function CinemasPage() {
  const [cinemas, setCinemas] = useState<Cinema[]>([]);
  const [loading, setLoading] = useState(true);

  function loadCinemas(cityId?: number) {
    setLoading(true);
    getCinemas(cityId)
      .then((data) => setCinemas(data))
      .catch((err) => console.warn(err))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const storedCityId = typeof window !== 'undefined' ? localStorage.getItem('cineverse_city_id') : null;
    loadCinemas(storedCityId ? parseInt(storedCityId, 10) : 1);

    function onCityChanged(e: any) {
      if (e.detail?.id) {
        loadCinemas(e.detail.id);
      }
    }
    window.addEventListener('cityChanged', onCityChanged);
    return () => window.removeEventListener('cityChanged', onCityChanged);
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 w-full text-[#1B1320]">
      <div className="mb-10">
        <h1 className="text-3xl sm:text-4xl font-black text-[#1B1320] tracking-tight">Cinemas & Theatres</h1>
        <p className="text-base text-slate-600 mt-2">
          Explore CineVerse properties equipped with Laser IMAX, Dolby Atmos sound, and 3D auditorium previews
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {cinemas.map((c) => (
          <div
            key={c.id}
            className="flex flex-col justify-between rounded-3xl border border-[#E6DCD2] bg-white p-7 shadow-sm hover:shadow-md transition group"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="rounded-full bg-rose-50 px-3.5 py-1 text-sm font-bold text-[#9F1239] border border-rose-200">
                  CineVerse Premium
                </span>
                <span className="text-sm font-semibold text-slate-500">M-Ticket Available</span>
              </div>

              <h2 className="text-2xl font-bold text-[#1B1320] group-hover:text-[#C8102E] transition">
                {c.name}
              </h2>

              <p className="flex items-start gap-2 text-base text-slate-600 mt-2.5">
                <MapPin className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                <span>{c.address}</span>
              </p>

              <div className="flex flex-wrap gap-2 mt-4">
                {c.facilities?.map((f) => (
                  <span
                    key={f}
                    className="rounded-xl bg-[#FAF6F0] border border-[#E6DCD2] px-3 py-1 text-sm font-medium text-slate-700"
                  >
                    {f}
                  </span>
                ))}
              </div>

              <div className="mt-5 rounded-2xl border border-[#E6DCD2] bg-[#FAF6F0] p-4 text-sm text-slate-600">
                <span className="font-bold text-[#1B1320]">Cancellation Policy:</span> {c.cancellation_policy}
              </div>
            </div>

            <div className="mt-8 pt-5 border-t border-[#E6DCD2] flex items-center justify-between">
              <Link
                href="/cinemas/1/auditorium/1?showtime=1&mode=3d"
                className="flex items-center gap-1.5 text-sm font-bold text-amber-700 hover:text-amber-800 underline"
              >
                <Compass className="h-4 w-4 text-amber-600" />
                <span>3D Theatre</span>
              </Link>

              <Link
                href={`/cinemas/${c.id}`}
                className="flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[#C8102E] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#A60D26] transition shadow-sm"
              >
                <span>Browse Shows</span>
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
