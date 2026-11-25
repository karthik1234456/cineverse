// app/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Star, Play, Tag, ArrowRight, RefreshCw, AlertCircle, Film, MapPin } from 'lucide-react';
import { MovieCard } from '@/components/MovieCard';
import { MoviePoster } from '@/components/MoviePoster';
import { useTrailerStore } from '@/store/useTrailerStore';
import { getMovies, type Movie } from '@/services/api';
import { useMovieBackdrop } from '@/context/MovieBackdropContext';

const REQUEST_TIMEOUT_MS = 3500;

function withTimeout<T>(promise: Promise<T>, ms: number = REQUEST_TIMEOUT_MS, errorMsg = 'Request timed out'): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(errorMsg));
    }, ms);
    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export default function HomePage() {
  const [currentCityId, setCurrentCityId] = useState<number | undefined>(undefined);
  const [currentCityName, setCurrentCityName] = useState<string>('Your City');

  // Independent Hero state
  const [heroMovie, setHeroMovie] = useState<Movie | null>(null);
  const [heroLoading, setHeroLoading] = useState<boolean>(true);
  const [heroError, setHeroError] = useState<string | null>(null);

  // Independent Now Showing state
  const [nowShowingMovies, setNowShowingMovies] = useState<Movie[]>([]);
  const [nowShowingLoading, setNowShowingLoading] = useState<boolean>(true);
  const [nowShowingError, setNowShowingError] = useState<string | null>(null);

  // Coming Soon state
  const [comingSoonMovies, setComingSoonMovies] = useState<Movie[]>([]);

  const [selectedFormat, setSelectedFormat] = useState<string>('All');
  const [activeHeroIdx, setActiveHeroIdx] = useState<number>(0);
  const openTrailer = useTrailerStore((s) => s.openTrailer);
  const { setActiveMovie } = useMovieBackdrop();

  useEffect(() => {
    setActiveMovie(null);
  }, [setActiveMovie]);

  // Read city from storage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedId = localStorage.getItem('cineverse_city_id');
      const storedName = localStorage.getItem('cineverse_city_name');
      if (storedId) setCurrentCityId(parseInt(storedId, 10));
      if (storedName) setCurrentCityName(storedName);
    }
  }, []);

  // 1. Independent Hero loader with timeout & retry
  const loadHero = useCallback(async (cityId?: number, retryCount = 1) => {
    setHeroLoading(true);
    setHeroError(null);
    try {
      const res = await withTimeout(
        getMovies({ city_id: cityId, status: 'now_showing', sort: 'popularity', page_size: 5 }),
        REQUEST_TIMEOUT_MS,
        'Hero movie request timed out'
      );
      if (res && res.length > 0) {
        setHeroMovie(res[0]);
        setHeroError(null);
      } else {
        // Fallback: fetch any now showing movie for this city
        const fallback = await withTimeout(
          getMovies({ city_id: cityId, status: 'now_showing', page_size: 3 }),
          REQUEST_TIMEOUT_MS,
          'Hero fallback request timed out'
        );
        if (fallback && fallback.length > 0) {
          setHeroMovie(fallback[0]);
          setHeroError(null);
        } else {
          setHeroMovie(null);
        }
      }
    } catch (err: any) {
      if (retryCount > 0) {
        await new Promise((r) => setTimeout(r, 500));
        return loadHero(cityId, retryCount - 1);
      }
      console.warn('Hero load error:', err);
      setHeroError(err.message || 'Unable to load Movie of the Day');
      setHeroMovie(null);
    } finally {
      setHeroLoading(false);
    }
  }, []);

  // 2. Independent Now Showing loader with timeout & retry
  const loadNowShowing = useCallback(async (cityId?: number, retryCount = 1) => {
    setNowShowingLoading(true);
    setNowShowingError(null);
    try {
      const res = await withTimeout(
        getMovies({ city_id: cityId, status: 'now_showing', page_size: 50 }),
        REQUEST_TIMEOUT_MS,
        'Now showing movies request timed out'
      );
      setNowShowingMovies(res || []);
      setNowShowingError(null);
    } catch (err: any) {
      if (retryCount > 0) {
        await new Promise((r) => setTimeout(r, 500));
        return loadNowShowing(cityId, retryCount - 1);
      }
      console.warn('Now Showing load error:', err);
      setNowShowingError(err.message || 'Unable to load Now Showing releases');
      setNowShowingMovies([]);
    } finally {
      setNowShowingLoading(false);
    }
  }, []);

  // 3. Coming Soon loader
  const loadComingSoon = useCallback(async (cityId?: number) => {
    try {
      const res = await withTimeout(
        getMovies({ city_id: cityId, status: 'coming_soon', page_size: 8 }),
        REQUEST_TIMEOUT_MS,
        'Coming soon request timed out'
      );
      setComingSoonMovies(res || []);
    } catch (err) {
      // Non-blocking
      console.warn('Coming soon load error:', err);
    }
  }, []);

  // Initial and reactive data fetching
  const refreshAllData = useCallback((cityId?: number) => {
    loadHero(cityId);
    loadNowShowing(cityId);
    loadComingSoon(cityId);
  }, [loadHero, loadNowShowing, loadComingSoon]);

  useEffect(() => {
    const storedCityId = typeof window !== 'undefined' ? localStorage.getItem('cineverse_city_id') : null;
    const cid = storedCityId ? parseInt(storedCityId, 10) : undefined;
    refreshAllData(cid);

    function onCityChanged(e: any) {
      if (e.detail) {
        const newId = e.detail.id;
        const newName = e.detail.name || 'Your City';
        setCurrentCityId(newId);
        setCurrentCityName(newName);
        refreshAllData(newId);
      }
    }
    window.addEventListener('cityChanged', onCityChanged);
    return () => window.removeEventListener('cityChanged', onCityChanged);
  }, [refreshAllData]);

  // Graceful fallback: If hero movie failed or is missing, fall back to the first real movie of the city
  const activeHero = heroMovie || (nowShowingMovies.length > 0 ? nowShowingMovies[0] : null);

  const filteredNowShowing = selectedFormat === 'All'
    ? nowShowingMovies
    : nowShowingMovies.filter((m) => m.formats?.includes(selectedFormat));

  return (
    <div className="flex flex-col min-h-screen bg-[#FFF8F1] text-[#1B1320]">
      {/* =========================================================================
          HERO SECTION (Movie of the Day) - Loaded Independently
         ========================================================================= */}
      <section data-testid="hero-movie-of-day" className="relative w-full overflow-hidden bg-[#0B0914] pt-8 sm:pt-12 md:pt-14 pb-14 md:pb-16 shadow-2xl min-h-[420px]">
        {activeHero ? (
          <>
            {/* Cinematic movie backdrop with directional contrast scrim */}
            <div className="absolute inset-0 pointer-events-none">
              <img
                src={activeHero.banner_url || '/backdrops/quantum-odyssey.webp'}
                alt={activeHero.title}
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
                    {activeHero.formats && activeHero.formats.length > 0 && (
                      <span className="rounded-full bg-white/20 backdrop-blur-md px-3.5 py-1.5 text-sm font-bold text-white border border-white/20">
                        {activeHero.formats[0]}
                      </span>
                    )}
                    <span className="rounded-full bg-white/20 backdrop-blur-md px-3.5 py-1.5 text-sm font-bold text-white border border-white/20">
                      {activeHero.certificate}
                    </span>
                    {activeHero.languages && activeHero.languages.length > 0 && (
                      <span className="rounded-full bg-white/20 backdrop-blur-md px-3.5 py-1.5 text-sm font-bold text-white border border-white/20">
                        {activeHero.languages[0]}
                      </span>
                    )}
                    <span className="rounded-full bg-white/20 backdrop-blur-md px-3.5 py-1.5 text-sm font-bold text-white border border-white/20">
                      {activeHero.duration_minutes} mins
                    </span>
                    <div className="flex items-center gap-1.5 rounded-full bg-white/20 backdrop-blur-md px-3.5 py-1.5 text-sm font-bold text-white border border-white/20">
                      <Star className="h-4 w-4 fill-[#F2A900] text-[#F2A900]" />
                      <span>{activeHero.rating_avg.toFixed(1)} / 10</span>
                    </div>
                  </div>

                  {/* High-contrast 40-48px+ title, wraps to 2 lines, never truncated */}
                  <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.15] break-words">
                    {activeHero.title}
                  </h1>

                  {/* 18px body text (text-lg) on desktop, relaxed line height */}
                  <p className="text-base sm:text-lg text-white/90 line-clamp-3 leading-relaxed font-normal max-w-2xl">
                    {activeHero.synopsis}
                  </p>

                  {/* Exactly Two Hero CTAs: Book tickets (primary) + Watch trailer (secondary) */}
                  <div className="flex flex-wrap items-center gap-4 pt-2">
                    <Link
                      href={`/movies/${activeHero.slug}`}
                      className="btn-primary min-h-[52px] px-8 text-lg font-bold shadow-lg flex items-center justify-center gap-2"
                      data-testid="hero-book-tickets-btn"
                    >
                      Book Tickets
                    </Link>

                    <button
                      onClick={() => openTrailer({
                        movieId: activeHero.id,
                        title: activeHero.title,
                        posterUrl: activeHero.poster_url,
                        trailerUrl: activeHero.trailer_url || undefined
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
                    href={`/movies/${activeHero.slug}`}
                    className="group block relative w-64 xl:w-72 aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl border-2 border-white/25 hover:border-white/50 transition duration-300 transform hover:-translate-y-1"
                    data-testid="hero-poster-card"
                  >
                    <MoviePoster
                      src={activeHero.poster_url}
                      alt={activeHero.title}
                      title={activeHero.title}
                      certificate={activeHero.certificate}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                      containerClassName="h-full w-full bg-[#181124]"
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
        ) : heroError && !nowShowingMovies.length ? (
          /* Error State with friendly message & Retry button */
          <div data-testid="hero-error-state" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
            <div className="rounded-3xl border border-red-500/40 bg-red-950/40 p-8 backdrop-blur-md text-white max-w-2xl">
              <div className="flex items-start gap-4">
                <div className="rounded-2xl bg-red-600/30 p-3 text-red-400 shrink-0">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <div className="space-y-3">
                  <h3 className="text-2xl font-bold text-white">Unable to Load Movie of the Day</h3>
                  <p className="text-base text-white/80 leading-relaxed">
                    {heroError || 'A network error occurred while retrieving the featured movie.'}
                  </p>
                  <button
                    onClick={() => loadHero(currentCityId)}
                    data-testid="hero-retry-btn"
                    className="inline-flex items-center gap-2 rounded-xl bg-[#C8102E] px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-red-700 transition"
                  >
                    <RefreshCw className="h-4 w-4" />
                    <span>Retry</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : !heroLoading && !activeHero ? (
          /* Empty State when city has no movies */
          <div data-testid="hero-empty-state" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-md text-white max-w-2xl">
              <div className="flex items-start gap-4">
                <div className="rounded-2xl bg-white/10 p-3 text-[#F2A900] shrink-0">
                  <Film className="h-6 w-6" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-white">No Movies Scheduled in {currentCityName}</h3>
                  <p className="text-base text-white/80 leading-relaxed">
                    There are currently no movies scheduled in {currentCityName}. Please select another city from the top bar to view available movies and showtimes.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Skeleton Loader (never hangs forever; bounded by REQUEST_TIMEOUT_MS) */
          <div data-testid="hero-skeleton" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 flex justify-between items-center animate-pulse">
            <div className="space-y-4 max-w-2xl w-full">
              <div className="h-8 w-40 bg-white/20 rounded-full" />
              <div className="h-12 w-96 max-w-full bg-white/20 rounded-xl" />
              <div className="h-20 max-w-2xl bg-white/10 rounded-xl" />
              <div className="flex gap-4 pt-2">
                <div className="h-12 w-36 bg-white/30 rounded-xl" />
                <div className="h-12 w-36 bg-white/20 rounded-xl" />
              </div>
            </div>
            <div className="hidden lg:block w-64 xl:w-72 aspect-[2/3] bg-white/10 rounded-2xl border border-white/20 shrink-0" />
          </div>
        )}
      </section>

      {/* =========================================================================
          MAIN CONTENT AREA
         ========================================================================= */}
      <div className="mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-12 space-y-16">
        {/* ROW 1: Now Showing - Loaded Independently */}
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

          {/* Now Showing Content / Error / Empty / Grid */}
          {nowShowingError ? (
            <div data-testid="now-showing-error-state" className="rounded-3xl border border-red-200 bg-red-50 p-8 text-red-950">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-6 w-6 text-red-600 shrink-0" />
                  <div>
                    <h3 className="text-lg font-bold">Unable to load Now Showing releases</h3>
                    <p className="text-sm text-red-700 mt-0.5">{nowShowingError}</p>
                  </div>
                </div>
                <button
                  onClick={() => loadNowShowing(currentCityId)}
                  data-testid="now-showing-retry-btn"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#C8102E] px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-red-700 transition shrink-0"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Retry</span>
                </button>
              </div>
            </div>
          ) : nowShowingLoading && nowShowingMovies.length === 0 ? (
            <div data-testid="now-showing-skeleton" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 animate-pulse">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="space-y-3">
                  <div className="aspect-[2/3] rounded-2xl bg-[#E6DCD2]/70 w-full" />
                  <div className="h-5 w-3/4 rounded-lg bg-[#E6DCD2]/70" />
                  <div className="h-4 w-1/2 rounded-lg bg-[#E6DCD2]/50" />
                </div>
              ))}
            </div>
          ) : filteredNowShowing.length === 0 ? (
            <div data-testid="now-showing-empty-state" className="rounded-3xl border border-[#E6DCD2] bg-white p-12 text-center text-[#1B1320] shadow-sm">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FDEBD8] text-[#C8102E] mb-4">
                <Film className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold text-[#1B1320]">No Movies Currently Showing in {currentCityName}</h3>
              <p className="text-base text-[#4A4056] max-w-md mx-auto mt-2 leading-relaxed">
                New showtimes are updated daily. Select another city from the top bar or explore upcoming releases below.
              </p>
            </div>
          ) : (
            <div data-testid="now-showing-grid" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-6">
              {filteredNowShowing.map((movie) => (
                <MovieCard key={movie.id} movie={movie} />
              ))}
            </div>
          )}
        </section>

        {/* ROW 2: Coming Soon */}
        {comingSoonMovies.length > 0 && (
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
              {comingSoonMovies.slice(0, 4).map((movie) => (
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
