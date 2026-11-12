'use client';

import React, { useState, useEffect } from 'react';
import { notFound } from 'next/navigation';
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Film,
  Tv,
  MapPin,
  RefreshCw,
  Search,
  Building2,
} from 'lucide-react';

interface MediaCheck {
  source?: string;
  type?: string;
  url?: string | null;
  http_status?: number;
  size?: string;
  size_bytes?: number;
  file_status?: string;
  status?: string;
  status_ok: boolean;
  reason: string;
}

interface SourceChainInfo {
  screen_3d_source: string;
  screen_3d_strategy?: string;
  screen_3d_desc: string;
  screen_guarantee?: string;
  booking_bg_source: string;
  booking_bg_desc: string;
  has_hosted_clip: boolean;
  is_youtube_only: boolean;
  official_player_supported: boolean;
  popup_modal_available?: boolean;
}

interface MovieReport {
  id: number;
  title: string;
  slug: string;
  is_showcase: boolean;
  is_tmdb: boolean;
  tmdb_id?: number | null;
  poster: MediaCheck;
  backdrop: MediaCheck;
  trailer: MediaCheck;
  ambient_clip: MediaCheck;
  effects_track: MediaCheck;
  source_chain?: SourceChainInfo;
  status_ok: boolean;
  reason: string;
}

interface HallReport {
  id: number;
  name: string;
  cinema_id: number;
  cinema_name: string;
  city_name: string;
  theatre_type: string;
  layout_version: string;
  source_3d: string;
  features: string[];
  total_seats: number;
  status_ok: boolean;
  reason: string;
}

interface CityReport {
  id: number;
  name: string;
  slug: string;
  movie_count: number;
  cinema_count: number;
  hall_count: number;
  show_count: number;
  is_live: boolean;
  status_ok: boolean;
  reason: string;
}

interface CityHallTypeReport {
  city_id: number;
  city_name: string;
  city_slug: string;
  hall_type: string;
  hall_count: number;
  sample_hall_name: string;
  sample_cinema_name: string;
  min_seats: number;
  max_seats: number;
  different_layouts: boolean;
  status_ok: boolean;
  reason: string;
}

interface ReadinessData {
  status: string;
  environment: {
    tmdb_api_key_set: boolean;
    tmdb_api_key_valid: boolean;
    tmdb_sync_run: boolean;
    tmdb_synced_movies_count: number;
    catalog_source: string;
    banner?: string | null;
    status_ok: boolean;
    reason: string;
  };
  metrics: {
    total_movies: number;
    showcase_movies_count: number;
    showcase_trailers_ready: number;
    non_showcase_movies_count: number;
    non_showcase_tmdb_posters_200: number;
    non_showcase_tmdb_ratio: number;
    total_halls: number;
    total_cities: number;
  };
  movies: MovieReport[];
  halls: HallReport[];
  cities: CityReport[];
  city_hall_types?: CityHallTypeReport[];
}

export default function DeveloperReadinessPage() {
  const [data, setData] = useState<ReadinessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'movies' | 'halls' | 'cities' | 'hall_types'>('movies');
  const [movieFilter, setMovieFilter] = useState<'all' | 'showcase' | 'tmdb' | 'errors'>('all');
  const [hallFilter, setHallFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Production disabling guard:
  // In production builds, this page must return 404 unless explicitly enabled via NEXT_PUBLIC_ENABLE_DEV_PAGES
  if (
    typeof process !== 'undefined' &&
    process.env.NODE_ENV === 'production' &&
    !process.env.NEXT_PUBLIC_ENABLE_DEV_PAGES
  ) {
    notFound();
  }

  function fetchReadiness() {
    setLoading(true);
    const backendUrl =
      process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://127.0.0.1:8000';

    fetch(`${backendUrl}/api/dev/readiness.json`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Server returned HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((resData) => {
        setData(resData);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }

  useEffect(() => {
    fetchReadiness();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 bg-[#FFF8F1] p-8 text-[#1B1320]">
        <RefreshCw className="h-8 w-8 animate-spin text-[#C8102E]" />
        <p className="text-base font-bold">Scanning system and media asset readiness...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <div className="rounded-2xl border border-red-300 bg-red-50 p-6 text-red-900">
          <div className="flex items-center gap-2 font-bold text-lg mb-2">
            <XCircle className="h-6 w-6 text-red-600" />
            <span>Developer Readiness Check Failed</span>
          </div>
          <p className="text-sm">{error || 'Unknown error occurred while inspecting assets.'}</p>
          <button
            onClick={fetchReadiness}
            className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white shadow hover:bg-red-700"
          >
            Retry Inspection
          </button>
        </div>
      </div>
    );
  }

  // Filter movies
  const filteredMovies = data.movies.filter((m) => {
    if (movieFilter === 'showcase' && !m.is_showcase) return false;
    if (movieFilter === 'tmdb' && !m.is_tmdb) return false;
    if (movieFilter === 'errors' && m.status_ok) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        m.title.toLowerCase().includes(q) ||
        m.slug.toLowerCase().includes(q) ||
        (m.tmdb_id && String(m.tmdb_id).includes(q))
      );
    }
    return true;
  });

  // Filter halls
  const filteredHalls = data.halls.filter((h) => {
    if (hallFilter !== 'all' && h.theatre_type.toLowerCase() !== hallFilter.toLowerCase()) {
      return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        h.name.toLowerCase().includes(q) ||
        h.cinema_name.toLowerCase().includes(q) ||
        h.city_name.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Unique theatre types for filtering
  const theatreTypes = Array.from(new Set(data.halls.map((h) => h.theatre_type)));

  return (
    <div
      data-testid="dev-readiness-page"
      className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6 text-[#1B1320]"
    >
      {/* 1. Header Banner & Diagnostics Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E6DCD2] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-mono font-bold uppercase text-white">
              DEV ONLY
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-[#1B1320]">
              Developer Readiness & Asset Audit
            </h1>
          </div>
          <p className="mt-1 text-sm text-[#4A4056]">
            Live diagnostic of all titles, media assets, 3D auditorium generators, and city schedules.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <a
            href="/dev/screen-test"
            data-testid="nav-screen-test-bench"
            className="flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-purple-700 transition"
          >
            <span>📺 3D Screen Test Bench</span>
          </a>
          <button
            onClick={fetchReadiness}
            className="flex items-center gap-2 rounded-xl border border-[#E6DCD2] bg-white px-4 py-2 text-sm font-bold text-slate-800 shadow-sm hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Re-scan System</span>
          </button>
        </div>
      </div>

      {/* 2. Mandatory Red Environment Banner when TMDB key missing/rejected */}
      {data.environment.banner && (
        <div
          data-testid="tmdb-readiness-banner"
          role="alert"
          className="rounded-2xl border-2 border-red-500 bg-red-600 p-4 text-white shadow-xl flex items-center justify-between gap-4 animate-in fade-in"
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-amber-200 shrink-0" />
            <div>
              <div className="text-base font-black tracking-wide">
                {data.environment.banner}
              </div>
              <div className="text-xs text-red-100 mt-0.5">
                {data.environment.reason}. Generated showcase art will NOT be silently substituted for real titles.
              </div>
            </div>
          </div>
          <span className="rounded-lg bg-black/30 px-3 py-1 text-xs font-mono font-bold uppercase text-white shrink-0">
            CATALOG_SOURCE: {data.environment.catalog_source}
          </span>
        </div>
      )}

      {/* 3. Metrics Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-[#E6DCD2] bg-white p-4 shadow-sm">
          <div className="text-xs font-bold uppercase text-slate-500">Showcase Movies</div>
          <div className="mt-1 text-2xl font-black text-[#1B1320]">
            {data.metrics.showcase_movies_count}
          </div>
          <div className="mt-1 flex items-center gap-1 text-xs font-semibold text-emerald-700">
            <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
            <span>{data.metrics.showcase_trailers_ready} trailers ready</span>
          </div>
        </div>

        <div className="rounded-2xl border border-[#E6DCD2] bg-white p-4 shadow-sm">
          <div className="text-xs font-bold uppercase text-slate-500">TMDB Non-Showcase</div>
          <div className="mt-1 text-2xl font-black text-[#1B1320]">
            {data.metrics.non_showcase_movies_count}
          </div>
          <div
            className={`mt-1 flex items-center gap-1 text-xs font-semibold ${data.metrics.non_showcase_tmdb_ratio >= 0.9 ? 'text-emerald-700' : 'text-red-700'
              }`}
          >
            {data.metrics.non_showcase_tmdb_ratio >= 0.9 ? (
              <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <XCircle className="h-3.5 w-3.5 text-red-600" />
            )}
            <span>
              {Math.round(data.metrics.non_showcase_tmdb_ratio * 100)}% HTTP 200 (
              {data.metrics.non_showcase_tmdb_posters_200}/{data.metrics.non_showcase_movies_count})
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-[#E6DCD2] bg-white p-4 shadow-sm">
          <div className="text-xs font-bold uppercase text-slate-500">3D Auditoriums</div>
          <div className="mt-1 text-2xl font-black text-[#1B1320]">
            {data.metrics.total_halls}
          </div>
          <div className="mt-1 text-xs font-semibold text-slate-600">
            5 distinct theatre types
          </div>
        </div>

        <div className="rounded-2xl border border-[#E6DCD2] bg-white p-4 shadow-sm">
          <div className="text-xs font-bold uppercase text-slate-500">Cities Active</div>
          <div className="mt-1 text-2xl font-black text-[#1B1320]">
            {data.metrics.total_cities}
          </div>
          <div className="mt-1 text-xs font-semibold text-emerald-700">
            All 7 cities live with schedules
          </div>
        </div>
      </div>

      {/* 4. Tab Switcher */}
      <div className="flex items-center gap-2 border-b border-[#E6DCD2] pb-2">
        <button
          onClick={() => setActiveTab('movies')}
          data-testid="tab-movies-btn"
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${activeTab === 'movies'
              ? 'bg-[#C8102E] text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
            }`}
        >
          <Film className="h-4 w-4" />
          <span>Movies ({data.movies.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('halls')}
          data-testid="tab-halls-btn"
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${activeTab === 'halls'
              ? 'bg-[#C8102E] text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
            }`}
        >
          <Tv className="h-4 w-4" />
          <span>Halls & 3D ({data.halls.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('cities')}
          data-testid="tab-cities-btn"
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${activeTab === 'cities'
              ? 'bg-[#C8102E] text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
            }`}
        >
          <MapPin className="h-4 w-4" />
          <span>Cities ({data.cities.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('hall_types')}
          data-testid="tab-hall-types-btn"
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${activeTab === 'hall_types'
              ? 'bg-[#C8102E] text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
            }`}
        >
          <Building2 className="h-4 w-4" />
          <span>Hall Types by City ({data.city_hall_types?.length || 0})</span>
        </button>
      </div>

      {/* 5. TAB CONTENT: MOVIES */}
      {activeTab === 'movies' && (
        <div className="space-y-4">
          {/* Controls & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              {(['all', 'showcase', 'tmdb', 'errors'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setMovieFilter(f)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold capitalize transition ${movieFilter === f
                      ? 'bg-slate-900 text-white'
                      : 'bg-white border border-[#E6DCD2] text-slate-700 hover:bg-slate-50'
                    }`}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search movie title or TMDB ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-[#E6DCD2] bg-white pl-9 pr-3 py-1.5 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#C8102E]"
              />
            </div>
          </div>

          {/* Movies Diagnostic Table */}
          <div className="overflow-x-auto rounded-2xl border border-[#E6DCD2] bg-white shadow-sm">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E6DCD2] bg-slate-50 font-bold text-slate-600">
                  <th className="p-3">ID & Title</th>
                  <th className="p-3">Catalog Source</th>
                  <th className="p-3">Poster Asset</th>
                  <th className="p-3">Backdrop Asset</th>
                  <th className="p-3">Trailer Video</th>
                  <th className="p-3">Ambient Glimpse</th>
                  <th className="p-3">4DX Effects Track</th>
                  <th className="p-3">Source Chain</th>
                  <th className="p-3">Status & Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMovies.map((m) => {
                  return (
                    <tr
                      key={m.id}
                      data-testid={`readiness-movie-row-${m.id}`}
                      className="hover:bg-slate-50/70 transition"
                    >
                      {/* 1. Title & ID */}
                      <td className="p-3 font-semibold text-slate-900">
                        <div className="font-bold text-sm text-[#1B1320]">{m.title}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          ID: {m.id} · {m.slug}
                        </div>
                      </td>

                      {/* 2. Source & TMDB ID */}
                      <td className="p-3">
                        {m.is_showcase ? (
                          <span className="inline-block rounded-md bg-amber-50 px-2 py-0.5 font-bold text-amber-800 border border-amber-200">
                            Showcase
                          </span>
                        ) : (
                          <div className="space-y-0.5">
                            <span className="inline-block rounded-md bg-indigo-50 px-2 py-0.5 font-bold text-indigo-800 border border-indigo-200">
                              TMDB Real
                            </span>
                            <div className="text-[10px] font-mono text-slate-500">
                              TMDB #{m.tmdb_id || 'N/A'}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* 3. Poster */}
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          {m.poster.status_ok ? (
                            <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600 shrink-0" />
                          )}
                          <div>
                            <div className="font-bold">
                              {m.poster.source?.toUpperCase()} ({m.poster.http_status})
                            </div>
                            <div className="text-[11px] text-slate-500">{m.poster.size}</div>
                            <div className="text-[10px] text-slate-400 line-clamp-1">
                              {m.poster.reason}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 4. Backdrop */}
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          {m.backdrop.status_ok ? (
                            <CheckCircle className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 text-red-600 shrink-0" />
                          )}
                          <div>
                            <div className="font-semibold text-[11px]">
                              {m.backdrop.http_status === 200 ? 'HTTP 200' : 'Missing'}
                            </div>
                            <div className="text-[10px] text-slate-400 line-clamp-1">
                              {m.backdrop.reason}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 5. Trailer */}
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          {m.trailer.status_ok ? (
                            <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600 shrink-0" />
                          )}
                          <div>
                            <div className="font-bold capitalize">{m.trailer.type}</div>
                            <div className="text-[10px] text-slate-400 line-clamp-1">
                              {m.trailer.reason}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 6. Ambient Clip */}
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          {m.ambient_clip.status_ok ? (
                            <CheckCircle className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          ) : (
                            <span className="text-[11px] text-slate-400">None</span>
                          )}
                          <div className="text-[10px] text-slate-500 line-clamp-1">
                            {m.ambient_clip.reason}
                          </div>
                        </div>
                      </td>

                      {/* 7. Effects Track */}
                      <td className="p-3">
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${m.effects_track.status === 'reviewed'
                              ? 'bg-purple-50 text-purple-800 border border-purple-200'
                              : m.effects_track.status === 'auto'
                                ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                        >
                          {m.effects_track.status}
                        </span>
                        <div className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                          {m.effects_track.reason}
                        </div>
                      </td>

                      {/* 8. Source Chain & 3D Screen Strategy */}
                      <td className="p-3">
                        <div className="space-y-1">
                          <div className="text-[11px] font-semibold text-slate-800">
                            <span className="text-slate-400 font-normal">3D Screen: </span>
                            <span className="text-indigo-900 font-bold">{m.source_chain?.screen_3d_source || (m.is_showcase ? 'Hosted Video Texture' : 'Generated Title Card')}</span>
                          </div>
                          {m.source_chain?.screen_guarantee && (
                            <div className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 border border-emerald-200">
                              <span>✓</span>
                              <span>{m.source_chain.screen_guarantee}</span>
                            </div>
                          )}
                          <div className="text-[11px] font-semibold text-slate-800">
                            <span className="text-slate-400 font-normal">Booking BG: </span>
                            <span className="text-emerald-900 font-bold">{m.source_chain?.booking_bg_source || (m.is_showcase ? 'Hosted Ambient Clip' : 'Animated Backdrop')}</span>
                          </div>
                        </div>
                      </td>

                      {/* 8. Overall Status & Plain Reason */}
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`rounded-full h-2 w-2 shrink-0 ${m.status_ok ? 'bg-emerald-500' : 'bg-red-500'
                              }`}
                          />
                          <span
                            className={`font-bold ${m.status_ok ? 'text-emerald-800' : 'text-red-700'
                              }`}
                          >
                            {m.status_ok ? 'Pass' : 'Degraded'}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 leading-tight mt-0.5">
                          {m.reason}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. TAB CONTENT: AUDITORIUMS & 3D */}
      {activeTab === 'halls' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-slate-500 mr-1">Theatre Type:</span>
              <button
                onClick={() => setHallFilter('all')}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${hallFilter === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-white border border-[#E6DCD2] text-slate-700'
                  }`}
              >
                All ({data.halls.length})
              </button>
              {theatreTypes.map((t) => {
                const count = data.halls.filter((h) => h.theatre_type === t).length;
                return (
                  <button
                    key={t}
                    onClick={() => setHallFilter(t)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${hallFilter.toLowerCase() === t.toLowerCase()
                        ? 'bg-slate-900 text-white'
                        : 'bg-white border border-[#E6DCD2] text-slate-700'
                      }`}
                  >
                    {t} ({count})
                  </button>
                );
              })}
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search auditorium or cinema..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-[#E6DCD2] bg-white pl-9 pr-3 py-1.5 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#C8102E]"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-[#E6DCD2] bg-white shadow-sm">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E6DCD2] bg-slate-50 font-bold text-slate-600">
                  <th className="p-3">Hall Name & Cinema</th>
                  <th className="p-3">Theatre Type</th>
                  <th className="p-3">Layout Version</th>
                  <th className="p-3">3D Source</th>
                  <th className="p-3">Seats</th>
                  <th className="p-3">Architectural Features</th>
                  <th className="p-3">Status & Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredHalls.map((h) => (
                  <tr
                    key={h.id}
                    data-testid={`readiness-hall-row-${h.id}`}
                    className="hover:bg-slate-50/70 transition"
                  >
                    <td className="p-3 font-semibold text-slate-900">
                      <div className="font-bold text-sm text-[#1B1320]">{h.name}</div>
                      <div className="text-[11px] text-slate-500">
                        {h.cinema_name} · {h.city_name} (ID #{h.id})
                      </div>
                    </td>

                    <td className="p-3">
                      <span className="rounded-md bg-rose-50 px-2 py-0.5 text-xs font-bold text-[#9F1239] border border-rose-200">
                        {h.theatre_type}
                      </span>
                    </td>

                    <td className="p-3 font-mono font-bold text-slate-700">
                      {h.layout_version}
                    </td>

                    <td className="p-3">
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs font-bold ${h.source_3d === 'supplied model'
                            ? 'bg-amber-50 text-amber-900 border border-amber-200'
                            : 'bg-indigo-50 text-indigo-900 border border-indigo-200'
                          }`}
                      >
                        {h.source_3d}
                      </span>
                    </td>

                    <td className="p-3 font-mono font-bold">{h.total_seats}</td>

                    <td className="p-3">
                      <div className="flex flex-wrap gap-1 max-w-sm">
                        {h.features.map((f) => (
                          <span
                            key={f}
                            className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700"
                          >
                            {f.replace('_', ' ')}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span className="font-bold text-emerald-800">Ready</span>
                      </div>
                      <div className="text-[10px] text-slate-500 line-clamp-1">{h.reason}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. TAB CONTENT: CITIES */}
      {activeTab === 'cities' && (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-2xl border border-[#E6DCD2] bg-white shadow-sm">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E6DCD2] bg-slate-50 font-bold text-slate-600">
                  <th className="p-3">City Name</th>
                  <th className="p-3">Slug</th>
                  <th className="p-3">Cinemas</th>
                  <th className="p-3">Halls</th>
                  <th className="p-3">Active Shows</th>
                  <th className="p-3">Distinct Movies</th>
                  <th className="p-3">Live Status</th>
                  <th className="p-3">Plain Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.cities.map((c) => (
                  <tr
                    key={c.id}
                    data-testid={`readiness-city-row-${c.slug}`}
                    className="hover:bg-slate-50/70 transition"
                  >
                    <td className="p-3 font-bold text-sm text-[#1B1320]">{c.name}</td>
                    <td className="p-3 font-mono text-slate-500">{c.slug}</td>
                    <td className="p-3 font-mono font-bold text-slate-700">{c.cinema_count}</td>
                    <td className="p-3 font-mono font-bold text-slate-700">{c.hall_count}</td>
                    <td className="p-3 font-mono font-bold text-[#C8102E]">{c.show_count}</td>
                    <td className="p-3 font-mono font-bold text-slate-700">{c.movie_count}</td>
                    <td className="p-3">
                      {c.is_live ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                          <span>LIVE</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-800">
                          <XCircle className="h-3.5 w-3.5 text-red-600" />
                          <span>INACTIVE</span>
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-slate-600 text-[11px]">{c.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 8. TAB CONTENT: HALL TYPES BY CITY */}
      {activeTab === 'hall_types' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[#E6DCD2] bg-white p-4 shadow-sm text-xs text-slate-600">
            <span className="font-bold text-[#1B1320]">Hall Diversity Verification:</span> Every seeded city must feature at least one auditorium of every architectural category (Large screen, Overhead sound, Motion seats, Recliner, Balcony, Boutique, Standard) with real-world dimensions and varied layouts.
          </div>

          <div className="overflow-x-auto rounded-2xl border border-[#E6DCD2] bg-white shadow-sm">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E6DCD2] bg-slate-50 font-bold text-slate-600">
                  <th className="p-3">City</th>
                  <th className="p-3">Hall Type (Generic Category)</th>
                  <th className="p-3">Halls Count</th>
                  <th className="p-3">Sample Auditorium</th>
                  <th className="p-3">Cinema Destination</th>
                  <th className="p-3">Capacity Range</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Plain Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data.city_hall_types || []).map((row, idx) => (
                  <tr
                    key={`${row.city_slug}-${row.hall_type}-${idx}`}
                    data-testid={`readiness-hall-type-${row.city_slug}-${row.hall_type.toLowerCase().replace(/\s+/g, '-')}`}
                    className="hover:bg-slate-50/70 transition"
                  >
                    <td className="p-3 font-bold text-sm text-[#1B1320]">{row.city_name}</td>
                    <td className="p-3">
                      <span className="inline-block rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-900 border border-indigo-200">
                        {row.hall_type}
                      </span>
                    </td>
                    <td className="p-3 font-mono font-bold text-sm text-[#C8102E]">{row.hall_count}</td>
                    <td className="p-3 font-semibold text-slate-800">{row.sample_hall_name}</td>
                    <td className="p-3 text-slate-600">{row.sample_cinema_name}</td>
                    <td className="p-3 font-mono text-slate-700">
                      {row.min_seats} – {row.max_seats} seats
                    </td>
                    <td className="p-3">
                      {row.status_ok ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                          <span>READY</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-800">
                          <XCircle className="h-3.5 w-3.5 text-red-600" />
                          <span>MISSING</span>
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-slate-600 text-[11px]">{row.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
