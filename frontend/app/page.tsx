// app/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Star, Play, Tag, ArrowRight } from 'lucide-react';
import { MovieCard } from '@/components/MovieCard';
import { MoviePoster } from '@/components/MoviePoster';
import { useTrailerStore } from '@/store/useTrailerStore';
import { getMovies, type Movie } from '@/services/api';
import { useMovieBackdrop } from '@/context/MovieBackdropContext';

export default function HomePage() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [selectedFormat, setSelectedFormat] = useState<string>('All');
  const [activeHeroIdx, setActiveHeroIdx] = useState<number>(0);
  const openTrailer = useTrailerStore((s) => s.openTrailer);
  const { setActiveMovie } = useMovieBackdrop();

  useEffect(() => {
    setActiveMovie(null);
  }, [setActiveMovie]);

  function loadData(cityId?: number) {
    getMovies({ city_id: cityId })
      .then((movieData) => {
        setMovies(movieData);
      })
      .catch((err) => console.warn(err));
  }

  useEffect(() => {
    const storedCityId = typeof window !== 'undefined' ? localStorage.getItem('cineverse_city_id') : null;
    loadData(storedCityId ? parseInt(storedCityId, 10) : undefined);

    function onCityChanged(e: any) {
      if (e.detail?.id) {
        loadData(e.detail.id);
      }
    }
    window.addEventListener('cityChanged', onCityChanged);
    return () => window.removeEventListener('cityChanged', onCityChanged);
  }, []);

  const nowShowing = movies.filter((m) => m.is_now_showing);
  const comingSoon = movies.filter((m) => m.is_coming_soon);

  const heroMovies = nowShowing.slice(0, 3);
  const heroMovie = heroMovies[activeHeroIdx] || nowShowing[0];

  const filteredNowShowing = selectedFormat === 'All'
    ? nowShowing
    : nowShowing.filter((m) => m.formats?.includes(selectedFormat));

  return (
    <div className="flex flex-col min-h-screen bg-[#FFF8F1] text-[#1B1320]">
      {/* Rich High-Contrast Cinema Hero Section (Finding E1) */}
      <section data-testid="hero-movie-of-day" className="relative w-full overflow-hidden bg-[#0B0914] pt-8 sm:pt-12 md:pt-14 pb-14 md:pb-16 shadow-2xl min-h-[420px]">
        {heroMovie ? (
          <>
            {/* Cinematic movie backdrop with directional contrast scrim */}
            <div className="absolute inset-0 pointer-events-none">
              <img
                src={heroMovie.banner_url}
                alt={heroMovie.title}
                className="h-full w-full object-cover object-center"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              {/* High-Contrast Directional Scrim Overlay (> 7:1 WCAG AAA Contrast) */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0B0914] via-[#0B0914]/85 to-[#0B0914]/60 lg:bg-gradient-to-r lg:from-[#0B0914] lg:via-[#0B0914]/90 lg:to-transparent" />
            </div>

            <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8 xl:gap-12">
                {/* Left Content Column */}
                <div className="max-w-2xl xl:max-w-3xl space-y-6">
                  {/* High-contrast metadata chips (all >= 14px text) */}
                  <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                    <span className="rounded-full bg-[#C8102E] px-4 py-1.5 text-sm font-bold uppercase tracking-wider text-white shadow-sm">
                      Movie of the Day
                    </span>
                    {heroMovie.formats && heroMovie.formats.length > 0 && (
                      <span className="rounded-full bg-white/20 backdrop-blur-md px-3.5 py-1.5 text-sm font-bold text-white border border-white/20">
                        {heroMovie.formats[0]}
                      </span>
                    )}
                    <span className="rounded-full bg-white/20 backdrop-blur-md px-3.5 py-1.5 text-sm font-bold text-white border border-white/20">
                      {heroMovie.certificate}
                    </span>
                    {heroMovie.languages && heroMovie.languages.length > 0 && (
                      <span className="rounded-full bg-white/20 backdrop-blur-md px-3.5 py-1.5 text-sm font-bold text-white border border-white/20">
                        {heroMovie.languages[0]}
                      </span>
                    )}
                    <span className="rounded-full bg-white/20 backdrop-blur-md px-3.5 py-1.5 text-sm font-bold text-white border border-white/20">
                      {heroMovie.duration_minutes} mins
                    </span>
                    <div className="flex items-center gap-1.5 rounded-full bg-white/20 backdrop-blur-md px-3.5 py-1.5 text-sm font-bold text-white border border-white/20">
                      <Star className="h-4 w-4 fill-[#F2A900] text-[#F2A900]" />
                      <span>{heroMovie.rating_avg.toFixed(1)} / 10</span>
                    </div>
                  </div>

                  {/* High-contrast 40-48px+ title, wraps to 2 lines, never truncated */}
                  <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.15] break-words">
                    {heroMovie.title}
                  </h1>

                  {/* 18px body text (text-lg) on desktop, relaxed line height */}
                  <p className="text-base sm:text-lg text-white/90 line-clamp-3 leading-relaxed font-normal max-w-2xl">
                    {heroMovie.synopsis}
                  </p>

                  {/* Exactly Two Hero CTAs: Book tickets (primary) + Watch trailer (secondary) */}
                  <div className="flex flex-wrap items-center gap-4 pt-2">
                    <Link
                      href={`/movies/${heroMovie.slug}`}
                      className="btn-primary min-h-[52px] px-8 text-lg font-bold shadow-lg flex items-center justify-center gap-2"
                      data-testid="hero-book-tickets-btn"
                    >
                      Book Tickets
                    </Link>

                    <button
                      onClick={() => openTrailer({
                        movieId: heroMovie.id,
                        title: heroMovie.title,
                        posterUrl: heroMovie.poster_url,
                        trailerUrl: heroMovie.trailer_url || undefined
                      })}
                      className="btn-secondary min-h-[52px] px-7 text-lg font-bold border-2 border-white/40 text-white bg-white/15 hover:bg-white/25 shadow-lg backdrop-blur-md flex items-center justify-center gap-2.5 transition"
                      data-testid="hero-watch-trailer-btn"
                    >
                      <Play className="h-5 w-5 fill-current" />
                      <span>Watch Trailer</span>
                    </button>
                  </div>
                </div>

                {/* Right Rail: Floating 2:3 Movie Poster on desktop with rim light */}
                <div className="hidden lg:block shrink-0">
                  <Link
                    href={`/movies/${heroMovie.slug}`}
                    className="group block relative w-64 xl:w-72 aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl border-2 border-white/25 hover:border-white/50 transition duration-300 transform hover:-translate-y-1"
                    data-testid="hero-poster-card"
                  >
                    <MoviePoster
                      src={heroMovie.poster_url}
                      alt={heroMovie.title}
                      title={heroMovie.title}
                      certificate={heroMovie.certificate}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                      containerClassName="h-full w-full"
                      priority
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition duration-300 flex items-end p-4">
                      <span className="text-white text-sm font-bold flex items-center gap-1.5">
                        <span>View Details</span>
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    </div>
                  </Link>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 animate-pulse">
            <div className="h-8 w-40 bg-white/20 rounded-full mb-4" />
            <div className="h-12 w-96 bg-white/20 rounded-xl mb-4" />
            <div className="h-20 max-w-2xl bg-white/10 rounded-xl mb-6" />
            <div className="flex gap-4">
              <div className="h-12 w-36 bg-white/30 rounded-xl" />
              <div className="h-12 w-36 bg-white/20 rounded-xl" />
            </div>
          </div>
        )}
      </section>

      {/* Main Content: Max 3 Distinct Sections (Simplicity Budget) */}
      <div className="mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-12 space-y-16">
        {/* ROW 1: Now Showing */}
        <section aria-labelledby="now-showing-heading">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <h2 id="now-showing-heading" className="text-3xl font-black text-[#1B1320] tracking-tight">
                Now Showing
              </h2>
              <p className="text-base text-[#4A4056] mt-1">Explore the latest releases in theatres near you</p>
            </div>

            {/* Clean Format Filter Chips */}
            <div className="flex flex-wrap items-center gap-2">
              {['All', 'IMAX 3D', '4DX', '2D Dolby Atmos'].map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => setSelectedFormat(fmt)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition min-h-[44px] ${
                    selectedFormat === fmt
                      ? 'bg-[#C8102E] text-white shadow-sm'
                      : 'bg-white text-[#1B1320] border border-[#E6DCD2] hover:bg-[#FDEBD8]'
                  }`}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-6">
            {filteredNowShowing.map((movie) => (
              <MovieCard key={movie.id} movie={movie} />
            ))}
          </div>
        </section>

        {/* ROW 2: Coming Soon */}
        {comingSoon.length > 0 && (
          <section aria-labelledby="coming-soon-heading">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 id="coming-soon-heading" className="text-3xl font-black text-[#1B1320] tracking-tight">
                  Coming Soon
                </h2>
                <p className="text-base text-[#4A4056] mt-1">Mark your calendar for upcoming blockbusters</p>
              </div>
              <Link
                href="/movies"
                className="text-base font-bold text-[#C8102E] hover:underline flex items-center gap-1.5"
              >
                <span>View all</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-6">
              {comingSoon.slice(0, 4).map((movie) => (
                <MovieCard key={movie.id} movie={movie} />
              ))}
            </div>
          </section>
        )}

        {/* ROW 3: Special Offers Strip */}
        <section aria-labelledby="offers-heading">
          <div className="rounded-3xl bg-band-indigo p-8 sm:p-10 shadow-lg text-white">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="space-y-2 max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3.5 py-1 text-sm font-bold">
                  <Tag className="h-4 w-4" />
                  <span>Exclusive Offer</span>
                </div>
                <h3 id="offers-heading" className="text-2xl sm:text-3xl font-black">
                  Flat ₹100 Off On Your First Booking
                </h3>
                <p className="text-base sm:text-lg text-white/90">
                  Use coupon code <span className="font-mono font-bold bg-white/20 px-2.5 py-1 rounded-lg">CINEVERSE100</span> at checkout. Valid on all 3D and IMAX shows.
                </p>
              </div>
              <Link
                href="/movies"
                className="btn-primary min-h-[50px] bg-white text-[#1B1320] hover:bg-[#FDEBD8] shadow-md font-bold px-8 shrink-0"
              >
                Explore Movies
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
