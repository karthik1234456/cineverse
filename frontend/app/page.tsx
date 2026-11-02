// app/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Sparkles, Compass, Star, Play, MapPin, Film, ChevronRight } from 'lucide-react';
import { MovieCard } from '@/components/MovieCard';
import { TrailerModal } from '@/components/TrailerModal';
import { getMovies, getCinemas, type Movie, type Cinema } from '@/services/api';

export default function HomePage() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [cinemas, setCinemas] = useState<Cinema[]>([]);
  const [selectedFormat, setSelectedFormat] = useState<string>('All');
  const [activeHeroIdx, setActiveHeroIdx] = useState<number>(0);
  const [trailerModal, setTrailerModal] = useState<{ isOpen: boolean; title: string }>({
    isOpen: false,
    title: '',
  });

  useEffect(() => {
    getMovies().then((data) => setMovies(data)).catch((err) => console.warn(err));
    getCinemas().then((data) => setCinemas(data)).catch((err) => console.warn(err));
  }, []);

  const nowShowing = movies.filter((m) => m.is_now_showing);
  const comingSoon = movies.filter((m) => m.is_coming_soon);

  const heroMovies = nowShowing.slice(0, 3);
  const heroMovie = heroMovies[activeHeroIdx] || nowShowing[0];

  const filteredNowShowing = selectedFormat === 'All'
    ? nowShowing
    : nowShowing.filter((m) => m.formats?.includes(selectedFormat));

  return (
    <div className="flex flex-col min-h-screen bg-[#0b0c10] text-white">
      {/* Cinematic Hero Carousel */}
      {heroMovie && (
        <section className="relative w-full h-[520px] md:h-[580px] overflow-hidden bg-black">
          {/* Background image & gradient overlay */}
          <div className="absolute inset-0">
            <img
              src={heroMovie.banner_url}
              alt={heroMovie.title}
              className="h-full w-full object-cover opacity-40 transition-opacity duration-700"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0b0c10] via-[#0b0c10]/60 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0b0c10] via-[#0b0c10]/70 to-transparent" />
          </div>

          <div className="relative mx-auto flex h-full max-w-7xl flex-col justify-end px-4 pb-12 sm:px-6 lg:px-8">
            <div className="max-w-2xl space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-[#e50914] px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-white shadow">
                  Trending #1
                </span>
                <span className="rounded-md bg-white/10 backdrop-blur-sm px-2.5 py-0.5 text-xs font-semibold text-zinc-300">
                  {heroMovie.certificate}
                </span>
                <div className="flex items-center gap-1 rounded-md bg-black/50 backdrop-blur-sm px-2.5 py-0.5 text-xs font-bold text-amber-400">
                  <Star className="h-3.5 w-3.5 fill-amber-400" />
                  <span>{heroMovie.rating_avg.toFixed(1)}/10</span>
                </div>
                <span className="text-xs text-zinc-400">({heroMovie.rating_count} votes)</span>
              </div>

              <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white drop-shadow-md">
                {heroMovie.title}
              </h1>

              <p className="text-sm sm:text-base text-zinc-300 line-clamp-3 leading-relaxed">
                {heroMovie.synopsis}
              </p>

              <div className="flex flex-wrap gap-2 pt-1">
                {heroMovie.formats?.map((fmt) => (
                  <span
                    key={fmt}
                    className="rounded-lg bg-zinc-800/80 border border-white/10 px-3 py-1 text-xs font-semibold text-zinc-200"
                  >
                    {fmt}
                  </span>
                ))}
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Link
                  href={`/movies/${heroMovie.slug}`}
                  className="rounded-xl bg-[#e50914] px-6 py-3 text-sm font-bold text-white hover:bg-red-700 transition shadow-xl shadow-red-950/50 flex items-center gap-2"
                >
                  <Film className="h-4 w-4" />
                  <span>Book Tickets</span>
                </Link>

                <Link
                  href="/cinemas/1/auditorium/1?showtime=1"
                  className="rounded-xl bg-white/10 backdrop-blur-md border border-white/20 px-5 py-3 text-sm font-semibold text-white hover:bg-white/20 transition flex items-center gap-2 shadow"
                >
                  <Compass className="h-4 w-4 text-amber-400" />
                  <span>Explore in 3D</span>
                </Link>

                <button
                  onClick={() => setTrailerModal({ isOpen: true, title: heroMovie.title })}
                  className="rounded-xl px-4 py-3 text-sm font-medium text-zinc-400 hover:text-white transition flex items-center gap-2"
                >
                  <Play className="h-4 w-4 fill-white text-white" />
                  <span>Watch Trailer</span>
                </button>
              </div>
            </div>

            {/* Carousel navigation pills */}
            <div className="absolute bottom-6 right-6 flex gap-2">
              {heroMovies.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveHeroIdx(idx)}
                  className={`h-2 rounded-full transition-all ${
                    activeHeroIdx === idx ? 'w-8 bg-[#e50914]' : 'w-2 bg-white/30 hover:bg-white/50'
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Signature 3D Differentiator Showcase Banner */}
      <section className="border-y border-white/10 bg-gradient-to-r from-red-950/40 via-[#16181f] to-amber-950/30 py-8 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#e50914]/20 border border-[#e50914]/40 text-[#e50914] shadow-[0_0_20px_rgba(229,9,20,0.4)]">
              <Compass className="h-7 w-7" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-red-600/20 px-2.5 py-0.5 text-[11px] font-bold text-red-400 mb-1 border border-red-500/30">
                <Sparkles className="h-3 w-3" />
                <span>SIGNATURE FEATURE</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                Choose Seats Inside a Real 3D Auditorium
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 mt-0.5 max-w-xl">
                Preview the exact screen sightline, eye elevation, and viewing angle before you pay. Compare front row vs prime row view in real-time WebGL.
              </p>
            </div>
          </div>

          <Link
            href="/cinemas/1/auditorium/1?showtime=1"
            className="shrink-0 rounded-xl bg-gradient-to-r from-[#e50914] to-red-700 px-6 py-3.5 text-sm font-bold text-white hover:from-red-600 hover:to-red-800 transition shadow-xl shadow-red-950/50 flex items-center gap-2 group"
          >
            <span>Enter 3D Experience</span>
            <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition" />
          </Link>
        </div>
      </section>

      {/* Main Content Area */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 space-y-12">
        {/* Now Showing Section */}
        <section>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-black text-white">Now Showing in Cinemas</h2>
              <p className="text-xs text-zinc-400 mt-1">Select a movie to browse available auditoriums & showtimes</p>
            </div>

            {/* Format Filter Chips */}
            <div className="flex flex-wrap gap-2">
              {['All', 'IMAX 3D', '4DX', '2D Dolby Atmos'].map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => setSelectedFormat(fmt)}
                  className={`rounded-full px-3.5 py-1 text-xs font-semibold transition ${
                    selectedFormat === fmt
                      ? 'bg-[#e50914] text-white shadow-md'
                      : 'border border-white/10 bg-[#16181f] text-zinc-400 hover:text-white hover:border-white/25'
                  }`}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>

          {/* Movies Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {filteredNowShowing.map((movie) => (
              <MovieCard key={movie.id} movie={movie} />
            ))}
          </div>
        </section>

        {/* Top Cinemas Section */}
        <section className="border-t border-white/10 pt-10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-black text-white">Top Theatres in Your City</h2>
              <p className="text-xs text-zinc-400 mt-1">Equipped with Laser IMAX, Dolby Atmos sound, and 3D preview</p>
            </div>
            <Link href="/cinemas" className="text-xs font-bold text-[#e50914] hover:underline">
              View all cinemas →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {cinemas.slice(0, 4).map((c) => (
              <div
                key={c.id}
                className="rounded-2xl border border-white/5 bg-[#12131a] p-5 flex flex-col justify-between hover:border-white/15 transition group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-bold text-white group-hover:text-[#e50914] transition">
                      {c.name}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-zinc-400 mt-1 line-clamp-1">
                    <MapPin className="h-3 w-3 text-zinc-500 shrink-0" />
                    <span>{c.address}</span>
                  </div>

                  <div className="flex flex-wrap gap-1 mt-3">
                    {c.facilities?.slice(0, 3).map((f) => (
                      <span
                        key={f}
                        className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] text-zinc-300 border border-white/5"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[11px] text-zinc-500">M-Ticket & F&B</span>
                  <Link
                    href={`/cinemas/${c.id}`}
                    className="text-xs font-bold text-[#e50914] hover:underline"
                  >
                    Showtimes →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Coming Soon Section */}
        {comingSoon.length > 0 && (
          <section className="border-t border-white/10 pt-10">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-black text-white">Coming Soon</h2>
                <p className="text-xs text-zinc-400 mt-1">Anticipated blockbusters releasing in the next 30 days</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {comingSoon.map((movie) => (
                <MovieCard key={movie.id} movie={movie} />
              ))}
            </div>
          </section>
        )}
      </div>

      <TrailerModal
        isOpen={trailerModal.isOpen}
        onClose={() => setTrailerModal({ isOpen: false, title: '' })}
        title={trailerModal.title}
      />
    </div>
  );
}
