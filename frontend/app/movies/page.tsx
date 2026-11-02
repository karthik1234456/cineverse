// app/movies/page.tsx
'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Filter, Search, SlidersHorizontal } from 'lucide-react';
import { MovieCard } from '@/components/MovieCard';
import { getMovies, type Movie } from '@/services/api';

function MoviesListContent() {
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get('search') || '';

  const [movies, setMovies] = useState<Movie[]>([]);
  const [search, setSearch] = useState(initialSearch);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('All');
  const [selectedGenre, setSelectedGenre] = useState<string>('All');
  const [selectedFormat, setSelectedFormat] = useState<string>('All');
  const [selectedTab, setSelectedTab] = useState<'all' | 'now_showing' | 'coming_soon'>('now_showing');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getMovies({
      search: search || undefined,
      language: selectedLanguage !== 'All' ? selectedLanguage : undefined,
      genre: selectedGenre !== 'All' ? selectedGenre : undefined,
      format: selectedFormat !== 'All' ? selectedFormat : undefined,
      status: selectedTab !== 'all' ? selectedTab : undefined,
    })
      .then((data) => setMovies(data))
      .catch((err) => console.warn(err))
      .finally(() => setLoading(false));
  }, [search, selectedLanguage, selectedGenre, selectedFormat, selectedTab]);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 w-full">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-white">Explore Movies</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Browse currently running blockbusters and upcoming theatrical releases
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex rounded-xl bg-[#16181f] p-1 border border-white/5">
          <button
            onClick={() => setSelectedTab('now_showing')}
            className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition ${
              selectedTab === 'now_showing' ? 'bg-[#e50914] text-white shadow' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Now Showing
          </button>
          <button
            onClick={() => setSelectedTab('coming_soon')}
            className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition ${
              selectedTab === 'coming_soon' ? 'bg-[#e50914] text-white shadow' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Coming Soon
          </button>
          <button
            onClick={() => setSelectedTab('all')}
            className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition ${
              selectedTab === 'all' ? 'bg-[#e50914] text-white shadow' : 'text-zinc-400 hover:text-white'
            }`}
          >
            All Movies
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-[#12131a] p-4 mb-8">
        <div className="flex items-center gap-2 text-xs font-bold text-zinc-300 pr-2 border-r border-white/10">
          <SlidersHorizontal className="h-4 w-4 text-[#e50914]" />
          <span>Filters:</span>
        </div>

        {/* Languages */}
        <select
          value={selectedLanguage}
          onChange={(e) => setSelectedLanguage(e.target.value)}
          className="rounded-xl border border-white/10 bg-[#16181f] px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-[#e50914]"
        >
          <option value="All">All Languages</option>
          <option value="English">English</option>
          <option value="Hindi">Hindi</option>
          <option value="Kannada">Kannada</option>
          <option value="Telugu">Telugu</option>
          <option value="Tamil">Tamil</option>
          <option value="Malayalam">Malayalam</option>
        </select>

        {/* Genres */}
        <select
          value={selectedGenre}
          onChange={(e) => setSelectedGenre(e.target.value)}
          className="rounded-xl border border-white/10 bg-[#16181f] px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-[#e50914]"
        >
          <option value="All">All Genres</option>
          <option value="Sci-Fi">Sci-Fi</option>
          <option value="Action">Action</option>
          <option value="Thriller">Thriller</option>
          <option value="Adventure">Adventure</option>
          <option value="Drama">Drama</option>
          <option value="Comedy">Comedy</option>
        </select>

        {/* Formats */}
        <select
          value={selectedFormat}
          onChange={(e) => setSelectedFormat(e.target.value)}
          className="rounded-xl border border-white/10 bg-[#16181f] px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-[#e50914]"
        >
          <option value="All">All Formats</option>
          <option value="IMAX 3D">IMAX 3D</option>
          <option value="4DX">4DX</option>
          <option value="2D Dolby Atmos">2D Dolby Atmos</option>
          <option value="2D">Standard 2D</option>
        </select>

        {/* Reset button if active */}
        {(selectedLanguage !== 'All' || selectedGenre !== 'All' || selectedFormat !== 'All' || search) && (
          <button
            onClick={() => {
              setSelectedLanguage('All');
              setSelectedGenre('All');
              setSelectedFormat('All');
              setSearch('');
            }}
            className="text-xs text-[#e50914] hover:underline ml-auto font-medium"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Movie Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="aspect-[2/3] rounded-2xl bg-zinc-900 animate-pulse" />
          ))}
        </div>
      ) : movies.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {movies.map((movie) => (
            <MovieCard key={movie.id} movie={movie} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-[#12131a] p-12 text-center text-zinc-400">
          <p className="text-base font-bold text-white">No movies found matching criteria</p>
          <p className="text-xs mt-1">Try adjusting your filters or search keywords</p>
        </div>
      )}
    </div>
  );
}

export default function MoviesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-zinc-400">Loading catalog...</div>}>
      <MoviesListContent />
    </Suspense>
  );
}

