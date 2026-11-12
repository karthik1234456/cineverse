// app/movies/[id]/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Star, Play, Compass, MapPin, CheckCircle2, Navigation, ExternalLink, ShieldCheck
} from 'lucide-react';
import { useTrailerStore } from '@/store/useTrailerStore';
import {
  getMovie, getMovieShowtimes,
  type MovieDetail, type CinemaShowtimesGroup
} from '@/services/api';
import { CinemaLocationModal } from '@/components/map/CinemaLocationModal';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useMovieBackdrop } from '@/context/MovieBackdropContext';
import { MoviePoster } from '@/components/MoviePoster';

export default function MovieDetailPage() {
  const params = useParams();
  const movieIdOrSlug = params.id as string;

  const [movie, setMovie] = useState<MovieDetail | null>(null);
  const [showtimesGroups, setShowtimesGroups] = useState<CinemaShowtimesGroup[]>([]);
  const [selectedDateIdx, setSelectedDateIdx] = useState<number>(0);
  const [currentCityId, setCurrentCityId] = useState<number | undefined>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('cineverse_city_id');
      if (stored) return parseInt(stored, 10);
      const citySlug = localStorage.getItem('cineverse_city');
      if (citySlug === 'delhi-ncr') return 3;
      if (citySlug === 'mumbai') return 2;
      if (citySlug === 'bengaluru') return 1;
    }
    return undefined;
  });
  const [loading, setLoading] = useState(true);
  const [radiusFilter, setRadiusFilter] = useState<number | null>(null);
  const [activeModalCinema, setActiveModalCinema] = useState<CinemaShowtimesGroup | null>(null);
  const openTrailer = useTrailerStore((s) => s.openTrailer);

  const { setActiveMovie, setTrailerModalOpen } = useMovieBackdrop();
  const { coords: userCoords, isRequesting: isGeoRequesting, requestLocation, clearLocation } = useGeolocation();

  // Clear backdrop on unmount
  useEffect(() => {
    return () => { setActiveMovie(null); };
  }, [setActiveMovie]);

  // Listen to city changes
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('cineverse_city_id') : null;
    if (stored) setCurrentCityId(parseInt(stored, 10));

    function onCityChanged(e: any) {
      if (e.detail?.id) setCurrentCityId(e.detail.id);
    }
    window.addEventListener('cityChanged', onCityChanged);
    return () => window.removeEventListener('cityChanged', onCityChanged);
  }, []);

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

    getMovie(movieIdOrSlug)
      .then(async (m) => {
        setMovie(m);
        // Activate movie backdrop
        setActiveMovie({
          id: m.id,
          slug: m.slug,
          title: m.title,
          banner_url: m.banner_url,
          poster_url: m.poster_url,
          dominant_color: (m as any).dominant_color ?? null,
          glimpse_url: (m as any).glimpse_url ?? null,
          glimpse_webm_url: (m as any).glimpse_webm_url ?? null,
          glimpse_720p_url: (m as any).glimpse_720p_url ?? null,
        });
        const targetCityId = currentCityId ?? (
          typeof window !== 'undefined'
            ? (parseInt(localStorage.getItem('cineverse_city_id') || '0', 10) || undefined)
            : undefined
        );
        const groups = await getMovieShowtimes(
          m.id,
          targetCityId,
          selectedDate.iso,
          undefined,
          undefined,
          userCoords?.lat,
          userCoords?.lng,
          radiusFilter || undefined
        );
        if (groups && groups.length > 0) {
          setShowtimesGroups(groups);
        } else if (selectedDateIdx === 0 && !radiusFilter) {
          // Check subsequent days to show the first available showtime in this city
          for (let i = 1; i < dates.length; i++) {
            const nextGroups = await getMovieShowtimes(
              m.id,
              targetCityId,
              dates[i].iso,
              undefined,
              undefined,
              userCoords?.lat,
              userCoords?.lng,
              radiusFilter || undefined
            );
            if (nextGroups && nextGroups.length > 0) {
              setSelectedDateIdx(i);
              setShowtimesGroups(nextGroups);
              return;
            }
          }
          setShowtimesGroups([]);
        } else {
          setShowtimesGroups(groups || []);
        }
      })
      .catch((err) => console.warn(err))
      .finally(() => setLoading(false));
  }, [movieIdOrSlug, selectedDateIdx, currentCityId, userCoords, radiusFilter]);

  if (loading && !movie) {
    return (
      <div className="flex h-96 items-center justify-center text-lg font-medium text-slate-600">
        Loading movie details...
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="p-16 text-center text-slate-600">
        <p className="text-xl font-bold text-[#1B1320]">Movie not found</p>
        <Link href="/movies" className="mt-4 inline-block text-base font-bold text-[#C8102E] underline">
          Return to all movies
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#FFF8F1] text-[#1B1320]">
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

      {/* Hero Banner Section with Rich Burgundy Gradient Band */}
      <section className="relative w-full overflow-hidden bg-band-burgundy text-white flex items-end">
        <div className="absolute inset-0">
          <img
            src={movie.banner_url}
            alt={movie.title}
            className="h-full w-full object-cover opacity-20 mix-blend-overlay"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 w-full flex flex-col md:flex-row items-center md:items-end gap-8">
          {/* Poster */}
          <div className="w-52 sm:w-60 shrink-0 aspect-[2/3] rounded-3xl overflow-hidden border-2 border-white/20 shadow-2xl bg-black/40 relative">
            <MoviePoster
              src={movie.poster_url}
              alt={movie.title}
              title={movie.title}
              certificate={movie.certificate}
              className="h-full w-full object-cover"
              containerClassName="h-full w-full"
              priority
            />
            <div className="absolute top-3 left-3 rounded-lg bg-black/70 px-2.5 py-1 text-sm font-bold border border-white/20 backdrop-blur-md">
              {movie.certificate}
            </div>
          </div>

          {/* Title and metadata */}
          <div className="flex-1 space-y-4 text-center md:text-left">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
              <div className="flex items-center gap-1.5 rounded-xl bg-black/50 backdrop-blur-md px-3.5 py-1.5 text-base font-bold text-amber-300 border border-white/10">
                <Star className="h-5 w-5 fill-amber-300" />
                <span>{movie.rating_avg.toFixed(1)}/10</span>
                <span className="text-slate-300 font-normal text-sm">({movie.rating_count} votes)</span>
              </div>
              <span className="rounded-xl bg-white/15 px-3.5 py-1.5 text-sm font-semibold text-slate-100">
                {movie.duration_minutes} mins
              </span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
              {movie.title}
            </h1>

            <p className="text-base sm:text-lg text-slate-100 max-w-3xl leading-relaxed">
              {movie.synopsis}
            </p>

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 pt-1">
              <span className="text-sm font-semibold text-slate-300">Audio:</span>
              {movie.languages?.map((lang) => (
                <span key={lang} className="rounded-lg bg-white/15 border border-white/15 px-3 py-1 text-sm font-medium text-white">
                  {lang}
                </span>
              ))}
              <span className="text-sm font-semibold text-slate-300 ml-3">Genres:</span>
              {movie.genres?.map((g) => (
                <span key={g} className="rounded-lg bg-rose-500/30 border border-rose-400/40 px-3 py-1 text-sm font-medium text-rose-100">
                  {g}
                </span>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 pt-3">
              <button
                onClick={() => openTrailer({
                  movieId: movie.id,
                  title: movie.title,
                  posterUrl: movie.poster_url,
                  trailerUrl: movie.trailer_url || undefined,
                })}
                className="flex min-h-[48px] items-center gap-2 rounded-xl bg-white px-6 py-3 text-base font-bold text-[#1B1320] shadow hover:bg-slate-100 transition"
                data-testid="movie-play-trailer-btn"
              >
                <Play className="h-4 w-4 fill-[#1B1320]" />
                <span>Play Trailer</span>
              </button>

              <Link
                href="/cinemas/1/auditorium/1?showtime=1&mode=3d"
                className="flex min-h-[48px] items-center gap-2 rounded-xl bg-amber-400/20 border border-amber-300 px-6 py-3 text-base font-bold text-amber-200 hover:bg-amber-400/30 transition shadow"
              >
                <Compass className="h-4 w-4 text-amber-300" />
                <span>3D Auditorium Sightlines</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Main Container */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 space-y-12 w-full">
        {/* Showtime Date Strip Selection */}
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-[#1B1320] tracking-tight">Select Date & Showtimes</h2>
              <p className="text-base text-slate-600 mt-1">Pick a showtime to view live seat availability in 2D or 3D</p>
            </div>
            <div className="flex items-center gap-4 text-sm font-semibold">
              <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-emerald-500" /> Available</span>
              <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-amber-500" /> Fast Filling</span>
              <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-rose-500" /> Almost Full</span>
            </div>
          </div>

          {/* 7-Day Date Strip */}
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
            {dates.map((d, idx) => {
              const isSelected = selectedDateIdx === idx;
              return (
                <button
                  key={d.iso}
                  onClick={() => setSelectedDateIdx(idx)}
                  className={`flex min-h-[56px] flex-col items-center justify-center rounded-2xl border px-6 py-3 min-w-[100px] transition shadow-sm ${
                    isSelected
                      ? 'border-[#C8102E] bg-[#C8102E] text-white shadow-md'
                      : 'border-[#E6DCD2] bg-white text-slate-700 hover:border-slate-400 hover:text-[#1B1320]'
                  }`}
                >
                  <span className="text-sm font-bold uppercase tracking-wider">{d.dayName}</span>
                  <span className="text-base font-black mt-0.5">{d.dateFormatted}</span>
                </button>
              );
            })}
          </div>

          {/* Distance Filter Strip & Near Me (Phase 6) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-[#FFF8F1] border border-[#E6DCD2]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-[#1B1320] mr-1">Distance:</span>
              {[
                { label: 'All', value: null },
                { label: 'Within 5 km', value: 5 },
                { label: 'Within 10 km', value: 10 },
                { label: 'Within 20 km', value: 20 },
              ].map((rf) => (
                <button
                  key={rf.label}
                  type="button"
                  onClick={() => setRadiusFilter(rf.value)}
                  className={`h-9 px-3.5 rounded-xl text-xs font-bold transition border ${
                    radiusFilter === rf.value
                      ? 'bg-[#C8102E] text-white border-[#C8102E]'
                      : 'bg-white text-[#4A4056] border-[#E6DCD2] hover:border-[#C8102E]'
                  }`}
                  data-testid={`radius-filter-${rf.value || 'all'}`}
                >
                  {rf.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={userCoords ? clearLocation : requestLocation}
                disabled={isGeoRequesting}
                className={`flex items-center gap-1.5 h-9 px-3.5 rounded-xl font-bold text-xs transition ${
                  userCoords
                    ? 'bg-[#2563EB] text-white'
                    : 'bg-white border border-[#E6DCD2] text-[#1B1320] hover:border-[#C8102E]'
                }`}
                data-testid="movie-near-me-btn"
              >
                <Navigation className={`h-3.5 w-3.5 ${isGeoRequesting ? 'animate-spin' : ''}`} />
                <span>{userCoords ? 'Near Me Active' : 'Sort by Distance'}</span>
              </button>
              <span className="text-[12px] text-[#4A4056] hidden md:inline">
                Your location is used only to show nearby cinemas and is never stored.
              </span>
            </div>
          </div>

          {/* Showtimes Grouped by Cinema */}
          <div className="space-y-6">
            {showtimesGroups.length > 0 ? (
              showtimesGroups.map((group) => (
                <div
                  key={group.cinema_id}
                  className="rounded-3xl border border-[#E6DCD2] bg-white p-6 shadow-sm space-y-5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E6DCD2]">
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="text-xl font-bold text-[#1B1320]">{group.cinema_name}</h3>
                        {group.distance_km != null && (
                          <span
                            className="rounded-lg bg-[#EAF1FF] px-2.5 py-0.5 text-xs font-bold text-[#2563EB]"
                            data-testid={`cinema-distance-${group.cinema_id}`}
                          >
                            {group.distance_km} km away
                          </span>
                        )}
                        <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-sm font-bold text-emerald-800 border border-emerald-200">
                          M-Ticket Available
                        </span>
                        <button
                          type="button"
                          onClick={() => setActiveModalCinema(group)}
                          className="flex items-center gap-1 text-xs font-bold text-[#0E8F8A] bg-[#E6F6F0] px-2.5 py-1 rounded-lg hover:bg-[#d0efe4] transition"
                          title="View on Map"
                          data-testid={`cinema-map-modal-btn-${group.cinema_id}`}
                        >
                          <MapPin className="h-3.5 w-3.5" />
                          <span>Map & Directions</span>
                        </button>
                      </div>
                      <p className="text-sm text-slate-600 flex items-center gap-1.5 mt-1.5">
                        <MapPin className="h-4 w-4 text-slate-400" />
                        <span>{group.address}</span>
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {group.facilities?.map((f) => (
                        <span key={f} className="rounded-lg bg-[#FAF6F0] px-2.5 py-1 text-sm font-medium text-slate-700 border border-[#E6DCD2]">
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Showtime chips */}
                  <div className="flex flex-wrap gap-4" data-testid="showtimes-list">
                    {group.showtimes.map((st) => {
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
                        ? `/cinemas/${group.cinema_id}/auditorium/${st.auditorium_id}?showtime=${st.id}&mode=3d`
                        : `/cinemas/${group.cinema_id}/auditorium/${st.auditorium_id}?showtime=${st.id}&mode=2d`;

                      return (
                        <Link
                          key={st.id}
                          href={targetUrl}
                          data-testid="showtime-chip"
                          data-has-3d={st.has_3d_preview}
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
                            <span data-testid="chip-lowest-price">₹{st.lowest_price}</span>
                          </div>
                          {/* Availability text label badge */}
                          <span
                            data-testid="chip-availability-label"
                            className={`mt-1.5 rounded-full px-2.5 py-0.5 text-sm font-bold uppercase tracking-wider ${badgeColor}`}
                          >
                            {availLabel}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-3xl border border-[#E6DCD2] bg-white p-10 text-center text-slate-600 shadow-sm">
                No scheduled showtimes for this date. Please select another date above.
              </div>
            )}
          </div>
        </section>

        {/* Cast & Crew Section */}
        {movie.cast_members && movie.cast_members.length > 0 && (
          <section className="border-t border-[#E6DCD2] pt-10">
            <h2 className="text-2xl font-black text-[#1B1320] mb-6">Cast & Crew</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
              {movie.cast_members.map((person) => (
                <div
                  key={person.id}
                  className="rounded-2xl border border-[#E6DCD2] bg-white p-4 text-center flex flex-col items-center shadow-sm"
                >
                  <div className="h-16 w-16 rounded-full bg-[#FAF6F0] border border-[#E6DCD2] flex items-center justify-center text-xl font-bold text-[#C8102E] mb-2">
                    {person.person_name.charAt(0)}
                  </div>
                  <div className="text-sm font-bold text-[#1B1320] line-clamp-1">{person.person_name}</div>
                  <div className="text-sm text-slate-600 mt-1">{person.role_name}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Reviews Section */}
        <section className="border-t border-[#E6DCD2] pt-10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-black text-[#1B1320]">Viewer Reviews & Ratings</h2>
              <p className="text-base text-slate-600 mt-1">Verified moviegoers who watched in CineVerse theatres</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {movie.reviews && movie.reviews.length > 0 ? (
              movie.reviews.map((rev) => (
                <div
                  key={rev.id}
                  className="rounded-3xl border border-[#E6DCD2] bg-white p-6 space-y-3 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 rounded-lg bg-amber-100 px-2.5 py-1 text-sm font-bold text-amber-900 border border-amber-300">
                        <Star className="h-4 w-4 fill-amber-500" />
                        <span>{rev.rating}/10</span>
                      </div>
                      <span className="text-base font-bold text-[#1B1320]">{rev.headline}</span>
                    </div>
                    <span className="flex items-center gap-1 text-sm font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Verified</span>
                    </span>
                  </div>

                  <p className="text-base text-slate-700 leading-relaxed">{rev.content}</p>

                  <div className="text-sm font-medium text-slate-600 pt-3 border-t border-[#E6DCD2] flex justify-between">
                    <span>{rev.user_name}</span>
                    <span>{new Date(rev.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-2 text-center text-slate-500 py-8">
                Be the first to review this movie after watching!
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Cinema Location & Map Modal (Phase 6) */}
      <CinemaLocationModal
        isOpen={!!activeModalCinema}
        onClose={() => setActiveModalCinema(null)}
        cinema={
          activeModalCinema
            ? {
                name: activeModalCinema.cinema_name,
                address: activeModalCinema.address,
                latitude: activeModalCinema.latitude,
                longitude: activeModalCinema.longitude,
                pincode: activeModalCinema.pincode,
                landmark: activeModalCinema.landmark,
                parking: activeModalCinema.parking,
                transit_stop: activeModalCinema.transit_stop,
                phone: activeModalCinema.phone,
                opening_hours: activeModalCinema.opening_hours,
                distance_km: activeModalCinema.distance_km,
              }
            : null
        }
      />
    </div>
  );
}
