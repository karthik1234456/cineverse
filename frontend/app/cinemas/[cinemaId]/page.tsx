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
    return (
      <div className="p-16 text-center text-lg font-medium text-slate-600">
        Loading cinema details...
      </div>
    );
  }

  if (!cinema) {
    return (
      <div className="p-16 text-center text-slate-600">
        <p className="text-xl font-bold text-[#1B1320]">Cinema not found</p>
        <Link href="/cinemas" className="mt-4 inline-block text-base font-bold text-[#C8102E] underline">
          Return to Cinemas
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 w-full space-y-10 text-[#1B1320]" data-testid="cinema-detail-page">
      {/* Cinema Header Banner */}
      <div className="rounded-3xl border border-[#E6DCD2] bg-white p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3.5 py-1 text-sm font-bold text-[#9F1239] border border-rose-200">
              CineVerse Signature Property
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-[#1B1320]">{cinema.name}</h1>
            <p className="flex items-center gap-1.5 text-base text-slate-600 mt-2">
              <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
              <span>{cinema.address}</span>
            </p>
          </div>

          <Link
            href={`/cinemas/${cinema.id}/auditorium/1?showtime=1&mode=3d`}
            className="flex min-h-[48px] items-center gap-2 rounded-xl bg-amber-400/20 border border-amber-300 px-6 py-3 text-base font-bold text-amber-900 hover:bg-amber-400/30 transition shadow-sm"
          >
            <Compass className="h-5 w-5 text-amber-700" />
            <span>Enter 3D Auditorium</span>
          </Link>
        </div>

        <div className="mt-6 pt-6 border-t border-[#E6DCD2] flex flex-wrap gap-2">
          {cinema.facilities?.map((f) => (
            <span
              key={f}
              className="flex items-center gap-1.5 rounded-xl bg-[#FAF6F0] border border-[#E6DCD2] px-3.5 py-1.5 text-sm font-medium text-slate-700"
            >
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>{f}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Date Picker Strip */}
      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-black text-[#1B1320]">Select Date</h2>
          <p className="text-base text-slate-600 mt-0.5">Filter movie schedules by day</p>
        </div>
        <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
          {dates.map((d, idx) => {
            const isSelected = selectedDateIdx === idx;
            return (
              <button
                key={d.iso}
                onClick={() => setSelectedDateIdx(idx)}
                className={`flex min-h-[56px] min-w-[100px] flex-col items-center justify-center rounded-2xl border px-5 py-3 transition shadow-sm ${
                  isSelected
                    ? 'border-[#C8102E] bg-[#C8102E] text-white shadow-md font-bold'
                    : 'border-[#E6DCD2] bg-white text-slate-700 hover:border-slate-400 hover:text-[#1B1320]'
                }`}
              >
                <span className="text-sm uppercase tracking-wider font-semibold">{d.dayName}</span>
                <span className="text-base font-black mt-0.5">{d.dateFormatted}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Movies & Showtimes at this Cinema */}
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-[#1B1320]">Available Shows at {cinema.name}</h2>
          <p className="text-base text-slate-600 mt-1">Select a showtime to proceed to seat selection in 2D or 3D</p>
        </div>

        {movieShowtimes.length > 0 ? (
          <div className="space-y-6">
            {movieShowtimes.map((item) => (
              <div
                key={item.movie_id}
                className="rounded-3xl border border-[#E6DCD2] bg-white p-6 sm:p-7 space-y-5 shadow-sm hover:shadow-md transition"
                data-testid="cinema-movie-showtimes"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E6DCD2]">
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-12 rounded-xl bg-[#E6DCD2] shrink-0 overflow-hidden border border-[#E6DCD2]">
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
                      <div className="flex items-center gap-2.5">
                        <Link
                          href={`/movies/${item.slug}`}
                          className="text-xl font-bold text-[#1B1320] hover:text-[#C8102E] transition"
                        >
                          {item.title}
                        </Link>
                        <span className="rounded-lg bg-[#FAF6F0] border border-[#E6DCD2] px-2.5 py-0.5 text-sm font-bold text-slate-700">
                          {item.certificate}
                        </span>
                      </div>
                      <div className="text-sm text-slate-600 mt-1.5 flex items-center gap-2">
                        <span>{item.duration_minutes} min</span>
                        <span>•</span>
                        <span>{item.languages?.join(', ')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {item.formats?.map((fmt) => (
                      <span key={fmt} className="rounded-lg bg-[#FAF6F0] border border-[#E6DCD2] px-3 py-1 text-sm font-medium text-slate-700">
                        {fmt}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Showtime chips */}
                <div className="flex flex-wrap gap-4">
                  {item.showtimes.map((st) => {
                    const startTime = new Date(st.start_time);
                    const timeString = startTime.toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true,
                    });

                    const availLabel =
                      st.availability_status === 'SOLD_OUT'
                        ? 'Sold out'
                        : st.availability_status === 'ALMOST_FULL'
                        ? 'Almost full'
                        : st.availability_status === 'FAST_FILLING'
                        ? 'Fast filling'
                        : 'Available';

                    const statusBorder =
                      st.availability_status === 'SOLD_OUT'
                        ? 'border-zinc-300 bg-zinc-100 text-zinc-600'
                        : st.availability_status === 'ALMOST_FULL'
                        ? 'border-rose-400 bg-rose-50 text-rose-950'
                        : st.availability_status === 'FAST_FILLING'
                        ? 'border-amber-400 bg-amber-50 text-amber-950'
                        : 'border-emerald-300 bg-emerald-50 text-emerald-950';

                    const badgeColor =
                      st.availability_status === 'SOLD_OUT'
                        ? 'bg-zinc-200 text-zinc-700'
                        : st.availability_status === 'ALMOST_FULL'
                        ? 'bg-rose-200 text-rose-900'
                        : st.availability_status === 'FAST_FILLING'
                        ? 'bg-amber-200 text-amber-900'
                        : 'bg-emerald-200 text-emerald-900';

                    const targetUrl = st.has_3d_preview
                      ? `/cinemas/${cinema.id}/auditorium/${st.auditorium_id}?showtime=${st.id}&mode=3d`
                      : `/cinemas/${cinema.id}/auditorium/${st.auditorium_id}?showtime=${st.id}&mode=2d`;

                    return (
                      <Link
                        key={st.id}
                        href={targetUrl}
                        data-testid="showtime-chip"
                        data-availability={st.availability_status}
                        data-price={st.lowest_price}
                        className={`group flex min-h-[72px] min-w-[140px] flex-col items-center justify-center rounded-2xl border-2 px-5 py-3 transition hover:scale-105 shadow-sm ${statusBorder}`}
                      >
                        <span className="text-base font-black">{timeString}</span>
                        <span className="text-sm font-semibold opacity-90 mt-0.5">
                          {st.format}
                        </span>
                        <div className="flex items-center gap-1.5 mt-1 text-sm font-bold text-[#C8102E]">
                          {st.has_3d_preview ? (
                            <>
                              <Compass className="h-3.5 w-3.5" />
                              <span>3D POV</span>
                            </>
                          ) : (
                            <span>2D Map</span>
                          )}
                          <span>•</span>
                          <span>₹{st.lowest_price}</span>
                        </div>
                        <span className={`mt-1.5 rounded-full px-2.5 py-0.5 text-sm font-bold uppercase tracking-wider ${badgeColor}`}>
                          {availLabel}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-[#E6DCD2] bg-white p-12 text-center text-slate-600 shadow-sm">
            No scheduled showtimes for this date at {cinema.name}. Please select another date above.
          </div>
        )}
      </div>
    </div>
  );
}
