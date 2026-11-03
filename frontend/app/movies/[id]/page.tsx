// app/movies/[id]/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Star, Play, Compass, MapPin, Calendar, Clock,
  Sparkles, MessageSquarePlus, CheckCircle2, ChevronRight
} from 'lucide-react';
import { TrailerModal } from '@/components/TrailerModal';
import {
  getMovie, getMovieShowtimes,
  type MovieDetail, type CinemaShowtimesGroup
} from '@/services/api';

export default function MovieDetailPage() {
  const params = useParams();
  const router = useRouter();
  const movieIdOrSlug = params.id as string;

  const [movie, setMovie] = useState<MovieDetail | null>(null);
  const [showtimesGroups, setShowtimesGroups] = useState<CinemaShowtimesGroup[]>([]);
  const [selectedDateIdx, setSelectedDateIdx] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [trailerOpen, setTrailerOpen] = useState(false);

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
    const storedCityId = typeof window !== 'undefined' ? localStorage.getItem('cineverse_city_id') : null;
    const cityId = storedCityId ? parseInt(storedCityId, 10) : undefined;

    getMovie(movieIdOrSlug)
      .then((m) => {
        setMovie(m);
        return getMovieShowtimes(m.id, cityId, selectedDate.iso);
      })
      .then((groups) => setShowtimesGroups(groups))
      .catch((err) => console.warn(err))
      .finally(() => setLoading(false));
  }, [movieIdOrSlug, selectedDateIdx]);

  if (loading && !movie) {
    return (
      <div className="flex h-96 items-center justify-center text-zinc-400">
        Loading movie details...
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="p-12 text-center text-zinc-400">
        Movie not found. <Link href="/movies" className="text-[#e50914] underline">Return to movies</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#0b0c10] text-white">
      {/* JSON-LD Structured Data for Movie SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Movie',
            name: movie.title,
            description: movie.synopsis,
            image: movie.poster_url,
            datePublished: movie.release_date,
            duration: `PT${movie.duration_minutes}M`,
            contentRating: movie.certificate,
            aggregateRating:
              movie.rating_avg > 0
                ? {
                    '@type': 'AggregateRating',
                    ratingValue: movie.rating_avg.toFixed(1),
                    bestRating: '10',
                    ratingCount: movie.rating_count || 1,
                  }
                : undefined,
            actor: movie.cast_members?.map((c) => ({
              '@type': 'Person',
              name: c.person_name,
            })),
          }),
        }}
      />
      {/* Hero Banner Section */}
      <section className="relative w-full min-h-[460px] overflow-hidden bg-black flex items-end">
        <div className="absolute inset-0">
          <img
            src={movie.banner_url}
            alt={movie.title}
            className="h-full w-full object-cover opacity-30"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b0c10] via-[#0b0c10]/80 to-transparent" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 w-full flex flex-col md:flex-row items-center md:items-end gap-8">
          {/* Poster */}
          <div className="w-48 sm:w-56 shrink-0 aspect-[2/3] rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-zinc-900 relative">
            <img
              src={movie.poster_url}
              alt={movie.title}
              className="h-full w-full object-cover"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <div className="absolute top-3 left-3 rounded-md bg-black/60 px-2 py-0.5 text-xs font-bold border border-white/10">
              {movie.certificate}
            </div>
          </div>

          {/* Title and metadata */}
          <div className="flex-1 space-y-3 text-center md:text-left">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
              <div className="flex items-center gap-1 rounded-lg bg-black/60 backdrop-blur-md px-3 py-1 text-sm font-bold text-amber-400 border border-white/10">
                <Star className="h-4 w-4 fill-amber-400" />
                <span>{movie.rating_avg.toFixed(1)}/10</span>
                <span className="text-zinc-500 font-normal">({movie.rating_count} votes)</span>
              </div>
              <span className="rounded-lg bg-white/10 px-3 py-1 text-xs text-zinc-300">
                {movie.duration_minutes} mins
              </span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-black text-white">{movie.title}</h1>

            <p className="text-sm text-zinc-300 max-w-3xl leading-relaxed">{movie.synopsis}</p>

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 pt-2">
              <span className="text-xs text-zinc-400">Audio:</span>
              {movie.languages?.map((lang) => (
                <span key={lang} className="rounded-md bg-white/5 border border-white/10 px-2.5 py-0.5 text-xs text-zinc-300">
                  {lang}
                </span>
              ))}
              <span className="text-xs text-zinc-400 ml-2">Genres:</span>
              {movie.genres?.map((g) => (
                <span key={g} className="rounded-md bg-red-950/40 border border-red-500/30 px-2.5 py-0.5 text-xs text-red-300">
                  {g}
                </span>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 pt-3">
              <button
                onClick={() => setTrailerOpen(true)}
                className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-semibold text-white hover:bg-white/20 transition"
              >
                <Play className="h-3.5 w-3.5 fill-white" />
                <span>Play Trailer</span>
              </button>

              <Link
                href="/cinemas/1/auditorium/1?showtime=1"
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-600/30 to-amber-600/30 border border-[#e50914]/40 px-4 py-2.5 text-xs font-bold text-amber-300 hover:border-amber-400 transition"
              >
                <Compass className="h-3.5 w-3.5 text-amber-400" />
                <span>3D Auditorium Sightlines</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Main Container */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 space-y-12 w-full">
        {/* Showtime Date Strip Selection */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black text-white">Select Date & Showtimes</h2>
              <p className="text-xs text-zinc-400 mt-0.5">Click any showtime timing to enter 3D seat selection</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Available</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Fast Filling</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Almost Full</span>
            </div>
          </div>

          {/* 7-Day Date Strip */}
          <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none">
            {dates.map((d, idx) => {
              const isSelected = selectedDateIdx === idx;
              return (
                <button
                  key={d.iso}
                  onClick={() => setSelectedDateIdx(idx)}
                  className={`flex flex-col items-center justify-center rounded-2xl border px-5 py-3 min-w-[90px] transition ${
                    isSelected
                      ? 'border-[#e50914] bg-[#e50914] text-white shadow-lg shadow-red-950/50'
                      : 'border-white/5 bg-[#12131a] text-zinc-400 hover:border-white/20 hover:text-white'
                  }`}
                >
                  <span className="text-[11px] font-bold uppercase">{d.dayName}</span>
                  <span className="text-sm font-black mt-0.5">{d.dateFormatted}</span>
                </button>
              );
            })}
          </div>

          {/* Showtimes Grouped by Cinema */}
          <div className="space-y-4">
            {showtimesGroups.length > 0 ? (
              showtimesGroups.map((group) => (
                <div
                  key={group.cinema_id}
                  className="rounded-2xl border border-white/5 bg-[#12131a] p-5 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/5">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-white">{group.cinema_name}</h3>
                        <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                          M-Ticket Available
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3 text-zinc-500" />
                        <span>{group.address}</span>
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {group.facilities?.map((f) => (
                        <span key={f} className="rounded bg-white/5 px-2 py-0.5 text-[10px] text-zinc-400">
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Showtime chips */}
                  <div className="flex flex-wrap gap-3" data-testid="showtimes-list">
                    {group.showtimes.map((st) => {
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
                        ? `/cinemas/${group.cinema_id}/auditorium/${st.auditorium_id}?showtime=${st.id}`
                        : `/cinemas/${group.cinema_id}/auditorium/${st.auditorium_id}?showtime=${st.id}&mode=2d`;

                      return (
                        <Link
                          key={st.id}
                          href={targetUrl}
                          data-testid="showtime-chip"
                          data-has-3d={st.has_3d_preview}
                          className={`group flex flex-col items-center justify-center rounded-xl border px-4 py-2.5 transition duration-200 hover:scale-105 hover:border-white/40 ${statusColor}`}
                        >
                          <span className="text-sm font-black text-white">{timeString}</span>
                          <span className="text-[10px] font-semibold text-zinc-400 mt-0.5">
                            {st.format}
                          </span>
                          <div className="flex items-center gap-1 mt-1 text-[9px] font-bold text-amber-400">
                            {st.has_3d_preview ? (
                              <>
                                <Compass className="h-2.5 w-2.5 text-amber-400" />
                                <span>3D Seat POV</span>
                              </>
                            ) : (
                              <span className="text-zinc-400">2D Seat Map</span>
                            )}
                            <span className="text-zinc-500">•</span>
                            <span>₹{st.lowest_price}</span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-white/5 bg-[#12131a] p-8 text-center text-zinc-400">
                No scheduled showtimes for this date. Please select another date above.
              </div>
            )}
          </div>
        </section>

        {/* Cast & Crew Section */}
        {movie.cast_members && movie.cast_members.length > 0 && (
          <section className="border-t border-white/10 pt-10">
            <h2 className="text-2xl font-black text-white mb-6">Cast & Crew</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
              {movie.cast_members.map((person) => (
                <div
                  key={person.id}
                  className="rounded-xl border border-white/5 bg-[#12131a] p-3 text-center flex flex-col items-center"
                >
                  <div className="h-16 w-16 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center text-lg font-bold text-zinc-300 mb-2">
                    {person.person_name.charAt(0)}
                  </div>
                  <div className="text-xs font-bold text-white line-clamp-1">{person.person_name}</div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">{person.role_name}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Reviews Section */}
        <section className="border-t border-white/10 pt-10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-black text-white">Viewer Reviews & Ratings</h2>
              <p className="text-xs text-zinc-400 mt-0.5">Verified moviegoers who watched in CineVerse theatres</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {movie.reviews && movie.reviews.length > 0 ? (
              movie.reviews.map((rev) => (
                <div
                  key={rev.id}
                  className="rounded-2xl border border-white/5 bg-[#12131a] p-5 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center gap-1 rounded bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-400 border border-amber-500/30">
                        <Star className="h-3 w-3 fill-amber-400" />
                        <span>{rev.rating}/10</span>
                      </div>
                      <span className="text-xs font-bold text-white">{rev.headline}</span>
                    </div>
                    <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>Verified</span>
                    </span>
                  </div>

                  <p className="text-xs text-zinc-300 leading-relaxed">{rev.content}</p>

                  <div className="text-[11px] text-zinc-500 pt-2 border-t border-white/5 flex justify-between">
                    <span>{rev.user_name}</span>
                    <span>{new Date(rev.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-2 text-center text-zinc-500 py-6">
                Be the first to review this movie after watching!
              </div>
            )}
          </div>
        </section>
      </div>

      <TrailerModal
        isOpen={trailerOpen}
        onClose={() => setTrailerOpen(false)}
        title={movie.title}
        trailerUrl={movie.trailer_url}
      />
    </div>
  );
}

