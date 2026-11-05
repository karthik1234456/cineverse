// app/movies/page.tsx
'use client';

import React, { useState, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { SlidersHorizontal, ArrowUpDown, X } from 'lucide-react';
import { MovieCard } from '@/components/MovieCard';
import { getMovies, type Movie } from '@/services/api';

function MoviesListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read URL query params
  const paramSearch = searchParams.get('search') || '';
  const paramLang = searchParams.get('lang') || 'All';
  const paramGenre = searchParams.get('genre') || 'All';
  const paramFormat = searchParams.get('format') || 'All';
  const paramCert = searchParams.get('certificate') || 'All';
  const paramSort = searchParams.get('sort') || 'popularity';
  const paramStatus = searchParams.get('status') || 'now_showing';

  const [movies, setMovies] = useState<Movie[]>([]);
  const [search, setSearch] = useState(paramSearch);
  const [selectedLanguage, setSelectedLanguage] = useState<string>(paramLang);
  const [selectedGenre, setSelectedGenre] = useState<string>(paramGenre);
  const [selectedFormat, setSelectedFormat] = useState<string>(paramFormat);
  const [selectedCertificate, setSelectedCertificate] = useState<string>(paramCert);
  const [selectedSort, setSelectedSort] = useState<string>(paramSort);
  const [selectedTab, setSelectedTab] = useState<'all' | 'now_showing' | 'coming_soon'>(
    paramStatus as 'all' | 'now_showing' | 'coming_soon'
  );
  const [loading, setLoading] = useState(true);

  // Sync state back to URL
  const updateUrlParams = useCallback(
    (updates: Record<string, string>) => {
      const current = new URLSearchParams(
        typeof window !== 'undefined' ? window.location.search : searchParams.toString()
      );
      Object.entries(updates).forEach(([key, val]) => {
        if (!val || val === 'All' || (key === 'status' && val === 'all') || (key === 'sort' && val === 'popularity')) {
          current.delete(key);
        } else {
          current.set(key, val);
        }
      });
      const query = current.toString();
      router.replace(`/movies${query ? `?${query}` : ''}`, { scroll: false });
    },
    [router, searchParams]
  );

  useEffect(() => {
    setLoading(true);
    getMovies({
      search: search || undefined,
      language: selectedLanguage !== 'All' ? selectedLanguage : undefined,
      genre: selectedGenre !== 'All' ? selectedGenre : undefined,
      format: selectedFormat !== 'All' ? selectedFormat : undefined,
      certificate: selectedCertificate !== 'All' ? selectedCertificate : undefined,
      sort: selectedSort as any,
      status: selectedTab !== 'all' ? selectedTab : undefined,
    })
      .then((data) => setMovies(data))
      .catch((err) => console.warn(err))
      .finally(() => setLoading(false));
  }, [search, selectedLanguage, selectedGenre, selectedFormat, selectedCertificate, selectedSort, selectedTab]);

  function handleTabChange(tab: 'all' | 'now_showing' | 'coming_soon') {
    setSelectedTab(tab);
    updateUrlParams({ status: tab });
  }

  function handleLanguageChange(lang: string) {
    setSelectedLanguage(lang);
    updateUrlParams({ lang });
  }

  function handleGenreChange(g: string) {
    setSelectedGenre(g);
    updateUrlParams({ genre: g });
  }

  function handleFormatChange(f: string) {
    setSelectedFormat(f);
    updateUrlParams({ format: f });
  }

  function handleCertChange(c: string) {
    setSelectedCertificate(c);
    updateUrlParams({ certificate: c });
  }

  function handleSortChange(s: string) {
    setSelectedSort(s);
    updateUrlParams({ sort: s });
  }

  function handleReset() {
    setSelectedLanguage('All');
    setSelectedGenre('All');
    setSelectedFormat('All');
    setSelectedCertificate('All');
    setSelectedSort('popularity');
    setSearch('');
    setSelectedTab('now_showing');
    router.replace('/movies', { scroll: false });
  }

  const isFiltered =
    selectedLanguage !== 'All' ||
    selectedGenre !== 'All' ||
    selectedFormat !== 'All' ||
    selectedCertificate !== 'All' ||
    selectedSort !== 'popularity' ||
    Boolean(search) ||
    selectedTab !== 'now_showing';

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 w-full" data-testid="movies-catalog-page">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-[#1B1320] tracking-tight">Explore Movies</h1>
          <p className="text-base text-slate-600 mt-2">
            Browse currently running blockbusters and upcoming theatrical releases with verified 3D previews
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex rounded-2xl bg-white p-1.5 border border-[#E6DCD2] shadow-sm">
          <button
            onClick={() => handleTabChange('now_showing')}
            className={`rounded-xl px-5 py-2.5 text-sm font-bold transition ${
              selectedTab === 'now_showing'
                ? 'bg-[#C8102E] text-white shadow'
                : 'text-slate-600 hover:text-[#1B1320]'
            }`}
          >
            Now Showing
          </button>
          <button
            onClick={() => handleTabChange('coming_soon')}
            className={`rounded-xl px-5 py-2.5 text-sm font-bold transition ${
              selectedTab === 'coming_soon'
                ? 'bg-[#C8102E] text-white shadow'
                : 'text-slate-600 hover:text-[#1B1320]'
            }`}
          >
            Coming Soon
          </button>
          <button
            onClick={() => handleTabChange('all')}
            className={`rounded-xl px-5 py-2.5 text-sm font-bold transition ${
              selectedTab === 'all'
                ? 'bg-[#C8102E] text-white shadow'
                : 'text-slate-600 hover:text-[#1B1320]'
            }`}
          >
            All Movies
          </button>
        </div>
      </div>

      {/* Filter and Sort bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#E6DCD2] bg-white p-4 shadow-sm mb-10">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-800 pr-3 border-r border-[#E6DCD2]">
          <SlidersHorizontal className="h-5 w-5 text-[#C8102E]" />
          <span>Filters</span>
        </div>

        {/* Languages */}
        <select
          value={selectedLanguage}
          onChange={(e) => handleLanguageChange(e.target.value)}
          className="rounded-xl border border-[#E6DCD2] bg-[#FAF6F0] px-3.5 py-2.5 text-sm font-medium text-[#1B1320] focus:outline-none focus:ring-2 focus:ring-[#C8102E]"
          data-testid="language-filter"
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
          onChange={(e) => handleGenreChange(e.target.value)}
          className="rounded-xl border border-[#E6DCD2] bg-[#FAF6F0] px-3.5 py-2.5 text-sm font-medium text-[#1B1320] focus:outline-none focus:ring-2 focus:ring-[#C8102E]"
          data-testid="genre-filter"
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
          onChange={(e) => handleFormatChange(e.target.value)}
          className="rounded-xl border border-[#E6DCD2] bg-[#FAF6F0] px-3.5 py-2.5 text-sm font-medium text-[#1B1320] focus:outline-none focus:ring-2 focus:ring-[#C8102E]"
          data-testid="format-filter"
        >
          <option value="All">All Formats</option>
          <option value="IMAX 3D">IMAX 3D</option>
          <option value="4DX">4DX</option>
          <option value="2D Dolby Atmos">2D Dolby Atmos</option>
          <option value="2D">Standard 2D</option>
        </select>

        {/* Certificate */}
        <select
          value={selectedCertificate}
          onChange={(e) => handleCertChange(e.target.value)}
          className="rounded-xl border border-[#E6DCD2] bg-[#FAF6F0] px-3.5 py-2.5 text-sm font-medium text-[#1B1320] focus:outline-none focus:ring-2 focus:ring-[#C8102E]"
          data-testid="certificate-filter"
        >
          <option value="All">All Ratings</option>
          <option value="U">U (Universal)</option>
          <option value="UA">UA (Parental Guidance)</option>
          <option value="A">A (Adults Only)</option>
        </select>

        {/* Sort */}
        <div className="flex items-center gap-2 pl-3 border-l border-[#E6DCD2]">
          <ArrowUpDown className="h-4 w-4 text-slate-500" />
          <select
            value={selectedSort}
            onChange={(e) => handleSortChange(e.target.value)}
            className="rounded-xl border border-[#E6DCD2] bg-[#FAF6F0] px-3.5 py-2.5 text-sm font-medium text-[#1B1320] focus:outline-none focus:ring-2 focus:ring-[#C8102E]"
            data-testid="sort-filter"
          >
            <option value="popularity">Popularity</option>
            <option value="rating">Top Rated</option>
            <option value="release_date">Release Date</option>
            <option value="title">Alphabetical (A-Z)</option>
          </select>
        </div>

        {/* Reset button if active */}
        {isFiltered && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 text-sm text-[#C8102E] hover:underline ml-auto font-bold"
            data-testid="reset-filters-button"
          >
            <X className="h-4 w-4" />
            <span>Reset Filters</span>
          </button>
        )}
      </div>

      {/* Movie Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="aspect-[2/3] rounded-2xl bg-white/70 animate-pulse border border-[#E6DCD2]" />
          ))}
        </div>
      ) : movies.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
          {movies.map((movie) => (
            <MovieCard key={movie.id} movie={movie} />
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-[#E6DCD2] bg-white p-12 text-center text-slate-600 shadow-sm">
          <p className="text-xl font-bold text-[#1B1320]">No movies found matching criteria</p>
          <p className="text-sm mt-2">Try adjusting your filters or search keywords</p>
          <button
            onClick={handleReset}
            className="mt-6 rounded-xl bg-[#C8102E] px-6 py-3 text-sm font-bold text-white hover:bg-[#A60D26] transition shadow"
          >
            Clear All Filters
          </button>
        </div>
      )}
    </div>
  );
}

export default function MoviesPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-base text-slate-600">Loading catalog...</div>}>
      <MoviesListContent />
    </Suspense>
  );
}
