// app/cinemas/[cinemaId]/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { MapPin, Compass, CheckCircle2 } from 'lucide-react';
import { getCinema, getCinemaShowtimes, type Cinema, type CinemaMovieShowtimes } from '@/services/api';

export default function CinemaDetailPage() {
  const params = useParams();
  const cinemaIdParam = params.cinemaId as string;
  const [cinema, setCinema] = useState<Cinema | null>(null);
  const [movieShowtimes, setMovieShowtimes] = useState<CinemaMovieShowtimes[]>([]);
  const [selectedDateIdx, setSelectedDateIdx] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // Generate 7-day dates strip
  const dates = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const iso = `${yyyy}-${mm}-${dd}`;
    const dayName = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short' });
    const dateFormatted = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
    return { dayName, dateFormatted, iso };
  });

  const selectedDate = dates[selectedDateIdx];

  useEffect(() => {
    setLoading(true);
    getCinema(cinemaIdParam)
      .then((c) => {
        setCinema(c);
        return getCinemaShowtimes(c.id, selectedDate.iso);
      })
      .then((shows) => setMovieShowtimes(shows))
      .catch((err) => console.warn(err))
      .finally(() => setLoading(false));
  }, [cinemaIdParam, selectedDateIdx]);

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
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 w-full space-y-8" data-testid="cinema-detail-page">
      {/* Cinema Header Banner */}
      <div className="rounded-2xl border border-white/10 bg-[#12131a] p-8 shadow-xl">
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
            href={`/cinemas/${cinema.id}/auditorium/1?showtime=1`}
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

      {/* Date Picker Strip */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {dates.map((d, idx) => {
          const isSelected = selectedDateIdx === idx;
          return (
            <button
              key={d.iso}
              onClick={() => setSelectedDateIdx(idx)}
              className={`flex flex-col items-center justify-center rounded-2xl border px-5 py-3 min-w-[95px] shrink-0 transition ${
                isSelected
                  ? 'border-[#e50914] bg-[#e50914] text-white shadow-lg shadow-red-950/60 font-bold'
                  : 'border-white/5 bg-[#12131a] text-zinc-400 hover:border-white/20 hover:text-white'
              }`}
            >
              <span className="text-[11px] uppercase tracking-wider">{d.dayName}</span>
              <span className="text-sm font-black mt-0.5">{d.dateFormatted}</span>
            </button>
          );
        })}
      </div>

      {/* Movies & Showtimes at this Cinema */}
      <div className="space-y-6">
        <h2 className="text-2xl font-black text-white">Available Shows at {cinema.name}</h2>

        {movieShowtimes.length > 0 ? (
          <div className="space-y-6">
            {movieShowtimes.map((item) => (
              <div
                key={item.movie_id}
                className="rounded-2xl border border-white/10 bg-[#12131a] p-6 space-y-4 hover:border-white/20 transition"
                data-testid="cinema-movie-showtimes"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/5">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-10 rounded bg-zinc-800 shrink-0 overflow-hidden border border-white/10">
                      <img
                        src={item.poster_url}
                        alt={item.title}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/movies/${item.slug}`}
                          className="text-lg font-bold text-white hover:text-[#e50914] transition"
                        >
                          {item.title}
                        </Link>
                        <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-bold text-zinc-300">
                          {item.certificate}
                        </span>
                      </div>
                      <div className="text-xs text-zinc-400 mt-1">
                        <span>{item.duration_minutes} min</span>
                        <span className="mx-1.5">•</span>
                        <span>{item.languages?.join(', ')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {item.formats?.map((fmt) => (
                      <span key={fmt} className="rounded-lg bg-zinc-800 border border-white/5 px-2.5 py-1 text-xs text-zinc-300">
                        {fmt}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Showtime chips */}
                <div className="flex flex-wrap gap-3">
                  {item.showtimes.map((st) => {
                    const startTime = new Date(st.start_time);
                    const timeString = startTime.toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true,
                    });

                    const statusColor =
                      st.availability_status === 'ALMOST_FULL'
                        ? 'border-red-500/50 text-red-400 bg-red-950/20'
                        : st.availability_status === 'FAST_FILLING'
                        ? 'border-amber-500/50 text-amber-300 bg-amber-950/20'
                        : 'border-emerald-500/40 text-emerald-300 bg-emerald-950/20';

                    const targetUrl = st.has_3d_preview
                      ? `/cinemas/${cinema.id}/auditorium/${st.auditorium_id}?showtime=${st.id}`
                      : `/cinemas/${cinema.id}/auditorium/${st.auditorium_id}?showtime=${st.id}&mode=2d`;

                    return (
                      <Link
                        key={st.id}
                        href={targetUrl}
                        data-testid="cinema-showtime-chip"
                        className={`group flex flex-col items-center justify-center rounded-xl border px-4 py-2.5 transition duration-200 hover:scale-105 hover:border-white/40 ${statusColor}`}
                      >
                        <span className="text-sm font-black text-white">{timeString}</span>
                        <span className="text-[10px] font-semibold text-zinc-400 mt-0.5">
                          {st.format}
                        </span>
                        <div className="flex items-center gap-1 mt-1 text-[9px] font-bold text-amber-400">
                          {st.has_3d_preview && <Compass className="h-2.5 w-2.5" />}
                          <span>₹{st.lowest_price}</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-white/5 bg-[#12131a] p-12 text-center text-zinc-400">
            No scheduled showtimes for this date at {cinema.name}. Please select another date above.
          </div>
        )}
      </div>
    </div>
  );
}
