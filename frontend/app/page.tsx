// app/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Star, Play, Tag, ArrowRight } from 'lucide-react';
import { MovieCard } from '@/components/MovieCard';
import { TrailerModal } from '@/components/TrailerModal';
import { getMovies, type Movie } from '@/services/api';

export default function HomePage() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [selectedFormat, setSelectedFormat] = useState<string>('All');
  const [activeHeroIdx, setActiveHeroIdx] = useState<number>(0);
  const [trailerModal, setTrailerModal] = useState<{ isOpen: boolean; title: string; trailerUrl?: string }>({
    isOpen: false,
    title: '',
  });

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
      {/* Rich Colour Band Hero Section */}
      {heroMovie && (
        <section className="relative w-full overflow-hidden bg-band-burgundy py-16 md:py-20 shadow-md">
          {/* Subtle movie backdrop blend */}
          <div className="absolute inset-0 opacity-20 pointer-events-none">
            <img
              src={heroMovie.banner_url}
              alt={heroMovie.title}
              className="h-full w-full object-cover"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>

          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-white/20 backdrop-blur-sm px-4 py-1.5 text-sm font-bold uppercase tracking-wider text-white">
                  Movie of the Day
                </span>
                <span className="rounded-full bg-white/20 backdrop-blur-sm px-3.5 py-1.5 text-sm font-semibold text-white">
                  {heroMovie.certificate}
                </span>
                <div className="flex items-center gap-1.5 rounded-full bg-white/20 backdrop-blur-sm px-3.5 py-1.5 text-sm font-bold text-white">
                  <Star className="h-4 w-4 fill-[#F2A900] text-[#F2A900]" />
                  <span>{heroMovie.rating_avg.toFixed(1)} / 10</span>
                </div>
              </div>

              <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-white tracking-tight leading-tight">
                {heroMovie.title}
              </h1>

              <p className="text-lg sm:text-xl text-white/90 line-clamp-3 leading-relaxed font-normal">
                {heroMovie.synopsis}
              </p>

              {/* Exactly Two Hero CTAs: Book tickets (primary) + Watch trailer (secondary) */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Link
                  href={`/movies/${heroMovie.slug}`}
                  className="btn-primary min-h-[52px] px-8 text-lg shadow-lg"
                  data-testid="hero-book-button"
                >
                  Book Tickets
                </Link>

                <button
                  onClick={() => setTrailerModal({
                    isOpen: true,
                    title: heroMovie.title,
                    trailerUrl: heroMovie.trailer_url || '/trailers/quantum_odyssey.webm'
                  })}
                  className="btn-secondary min-h-[52px] px-6 text-lg border-white/30 text-white bg-white/10 hover:bg-white/20 shadow-md backdrop-blur-sm"
                  data-testid="hero-trailer-button"
                >
                  <Play className="h-5 w-5 fill-current" />
                  <span>Watch Trailer</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

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

      {/* Trailer Modal */}
      <TrailerModal
        isOpen={trailerModal.isOpen}
        onClose={() => setTrailerModal({ isOpen: false, title: '' })}
        title={trailerModal.title}
        trailerUrl={trailerModal.trailerUrl}
      />
    </div>
  );
}
