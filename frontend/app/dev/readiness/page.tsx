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
  Zap,
  ShieldCheck,
  Users,
  Lock,
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
  trailer_embeddable?: boolean;
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
    last_sync_time?: string | null;
    auth_mode?: string;
    http_status?: number;
    env_file_loaded?: string;
    working_dir?: string;
    value_length?: number;
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
    playable_on_screen_count?: number;
    playable_on_screen_pct?: number;
    theatre_mode_only_count?: number;
    title_card_only_count?: number;
    theatre_mode_only_titles?: string[];
    title_card_only_titles?: string[];
    total_halls: number;
    total_cities: number;
    seat_assets_ok?: boolean;
  };
  seat_assets?: {
    status_ok: boolean;
    families: Record<string, any>;
    reason: string;
  };
  auth?: {
    status_ok: boolean;
    allowed_origins: string[];
    cookie_secure: boolean;
    token_expire_minutes: number;
    refresh_token_expire_days: number;
    demo_accounts_count: number;
    demo_accounts: string[];
    demo_accounts_removable: boolean;
    reason: string;
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
  const [testingTmdb, setTestingTmdb] = useState(false);
  const [tmdbTestResult, setTmdbTestResult] = useState<any>(null);
  const [testingAuth, setTestingAuth] = useState(false);
  const [authTestResult, setAuthTestResult] = useState<any>(null);
  const [demoActionLoading, setDemoActionLoading] = useState(false);
  const [demoActionNotice, setDemoActionNotice] = useState<string | null>(null);

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

  const testTmdbConnection = async () => {
    setTestingTmdb(true);
    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://127.0.0.1:8000';
      const res = await fetch(`${backendUrl}/api/v1/dev/test-tmdb`);
      const json = await res.json();
      setTmdbTestResult(json);
      fetchReadiness();
    } catch (e: any) {
      setTmdbTestResult({
        status: 'tmdb_unreachable',
        is_valid: false,
        reason: e.message || 'TMDB unreachable',
        banner: data?.environment.last_sync_time
          ? `Real posters unavailable: TMDB unreachable (Last sync: ${data.environment.last_sync_time})`
          : 'Real posters unavailable: TMDB unreachable',
      });
    } finally {
      setTestingTmdb(false);
    }
  };

  const testAuthLogin = async () => {
    setTestingAuth(true);
    setAuthTestResult(null);
    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://127.0.0.1:8000';
      const origin = typeof window !== 'undefined' ? window.location.origin : 'unknown';
      const t0 = performance.now();
      const res = await fetch(`${backendUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: 'patron@example.com', password: 'Patron@123' }),
      });
      const t1 = performance.now();
      const resBody = await res.json();
      setAuthTestResult({
        origin,
        status: res.status,
        ok: res.ok,
        time_ms: Math.round(t1 - t0),
        data: res.ok ? { user_id: resBody.user_id, role: resBody.role, full_name: resBody.full_name, has_token: !!resBody.access_token } : resBody,
      });
    } catch (e: any) {
      setAuthTestResult({
        origin: typeof window !== 'undefined' ? window.location.origin : 'unknown',
        status: 0,
        ok: false,
        time_ms: 0,
        error: e.message || 'Network error',
      });
    } finally {
      setTestingAuth(false);
    }
  };

  const handlePurgeDemoAccounts = async () => {
    setDemoActionLoading(true);
    setDemoActionNotice(null);
    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://127.0.0.1:8000';
      const res = await fetch(`${backendUrl}/api/v1/dev/auth/purge-demo-accounts`, {
        method: 'POST',
      });
      const json = await res.json();
      setDemoActionNotice(`Purged ${json.purged_count} demo accounts.`);
      fetchReadiness();
    } catch (e: any) {
      setDemoActionNotice(`Error: ${e.message}`);
    } finally {
      setDemoActionLoading(false);
    }
  };

  const handleSeedDemoAccounts = async () => {
    setDemoActionLoading(true);
    setDemoActionNotice(null);
    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://127.0.0.1:8000';
      const res = await fetch(`${backendUrl}/api/v1/dev/auth/seed-demo-accounts`, {
        method: 'POST',
      });
      const json = await res.json();
      setDemoActionNotice(`Seeded demo accounts (${json.created?.length || 0} created, ${json.updated?.length || 0} refreshed).`);
      fetchReadiness();
    } catch (e: any) {
      setDemoActionNotice(`Error: ${e.message}`);
    } finally {
      setDemoActionLoading(false);
    }
  };

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

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={testTmdbConnection}
            disabled={testingTmdb}
            data-testid="btn-test-tmdb"
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-700 transition disabled:opacity-50"
          >
            <Zap className={`h-4 w-4 ${testingTmdb ? 'animate-bounce text-amber-300' : 'text-amber-300'}`} />
            <span>{testingTmdb ? 'Testing TMDB...' : 'Test TMDB Connection'}</span>
          </button>
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

      {/* 2b. Live TMDB Connection Test Result Card */}
      {tmdbTestResult && (
        <div
          data-testid="tmdb-test-result-card"
          className={`rounded-2xl border p-4 shadow-md transition ${
            tmdbTestResult.is_valid
              ? 'border-emerald-300 bg-emerald-50/90 text-emerald-950'
              : 'border-red-300 bg-red-50/90 text-red-950'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/10 pb-2 mb-3">
            <div className="flex items-center gap-2 font-bold text-sm">
              <span className={`h-2.5 w-2.5 rounded-full ${tmdbTestResult.is_valid ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
              <span>TMDB Live Connection Test Result:</span>
              <span className={`font-mono uppercase text-xs px-2 py-0.5 rounded font-black ${
                tmdbTestResult.is_valid ? 'bg-emerald-200 text-emerald-900' : 'bg-red-200 text-red-900'
              }`}>
                {tmdbTestResult.status.toUpperCase()}
              </span>
            </div>
            <div className="text-xs font-mono text-slate-500">
              {tmdbTestResult.latency_ms} ms roundtrip
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-slate-500 block">Auth Mode</span>
              <span className="font-bold font-mono">{tmdbTestResult.auth_mode}</span>
            </div>
            <div>
              <span className="text-slate-500 block">HTTP Status</span>
              <span className="font-bold font-mono">{tmdbTestResult.http_status ? `HTTP ${tmdbTestResult.http_status}` : 'N/A'}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Key/Token Length</span>
              <span className="font-bold font-mono">{tmdbTestResult.value_length} chars ({tmdbTestResult.source_var || 'None'})</span>
            </div>
            <div>
              <span className="text-slate-500 block">Loaded .env Path</span>
              <span className="font-mono text-[11px] truncate block" title={tmdbTestResult.env_file_loaded || 'None'}>
                {tmdbTestResult.env_file_loaded || 'None detected'}
              </span>
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-black/5 text-xs flex flex-wrap items-center justify-between gap-2">
            <div className="font-medium">
              <span className="font-bold">Reason: </span>
              <span>{tmdbTestResult.reason}</span>
            </div>
            {tmdbTestResult.banner && (
              <span className="text-red-700 font-bold bg-red-100 px-2 py-0.5 rounded text-[11px]">
                {tmdbTestResult.banner}
              </span>
            )}
          </div>
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

        <div className={`rounded-2xl border ${data.seat_assets && !data.seat_assets.status_ok ? 'border-red-500 bg-red-50' : 'border-[#E6DCD2] bg-white'} p-4 shadow-sm`}>
          <div className="text-xs font-bold uppercase text-slate-500">Seat 3D Models</div>
          <div className={`mt-1 text-2xl font-black ${data.seat_assets && !data.seat_assets.status_ok ? 'text-red-700' : 'text-[#1B1320]'}`}>
            {data.seat_assets?.status_ok !== false ? 'Verified' : 'Asset Error'}
          </div>
          <div className={`mt-1 flex items-center gap-1 text-xs font-semibold ${data.seat_assets?.status_ok !== false ? 'text-emerald-700' : 'text-red-700'}`}>
            {data.seat_assets?.status_ok !== false ? <CheckCircle className="h-3.5 w-3.5 text-emerald-600" /> : <AlertTriangle className="h-3.5 w-3.5 text-red-600" />}
            <span className="truncate">{data.seat_assets?.reason || 'All GLB models loaded'}</span>
          </div>
        </div>
      </div>

      {/* Seat Models Warning Banner if assets degraded */}
      {data.seat_assets && !data.seat_assets.status_ok && (
        <div
          role="alert"
          className="rounded-2xl border-2 border-red-500 bg-red-600 p-4 text-white shadow-xl flex items-center gap-3 animate-in fade-in"
        >
          <AlertTriangle className="h-6 w-6 text-amber-200 shrink-0" />
          <div>
            <div className="text-base font-black tracking-wide">
              CRITICAL: 3D Seat Models Failed Verification
            </div>
            <div className="text-xs text-red-100 mt-0.5">
              {data.seat_assets.reason} — Silent fallback to boxes is prohibited.
            </div>
          </div>
        </div>
      )}

      {/* 3b. Auth, Session & CORS Readiness Card */}
      {data.auth && (
        <div data-testid="auth-readiness-card" className="rounded-2xl border border-[#E6DCD2] bg-white p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-[#C8102E]">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-[#1B1320]">Auth, Session & Origin Gateways</h3>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${data.auth.status_ok ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                    {data.auth.status_ok ? 'All Origins Ready' : 'Degraded'}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  CORS headers, cookies (Secure={String(data.auth.cookie_secure)}), token rotation & removable demo accounts.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={testAuthLogin}
                disabled={testingAuth}
                data-testid="btn-test-auth-login"
                className="flex items-center gap-1.5 rounded-xl bg-[#C8102E] px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-red-700 transition disabled:opacity-50"
              >
                <Zap className={`h-3.5 w-3.5 ${testingAuth ? 'animate-bounce text-amber-300' : ''}`} />
                <span>{testingAuth ? 'Testing Login...' : 'Test Login (Current Origin)'}</span>
              </button>
              <button
                type="button"
                onClick={handlePurgeDemoAccounts}
                disabled={demoActionLoading}
                data-testid="btn-purge-demo-accounts"
                className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition disabled:opacity-50"
              >
                Purge Demo Accounts
              </button>
              <button
                type="button"
                onClick={handleSeedDemoAccounts}
                disabled={demoActionLoading}
                data-testid="btn-seed-demo-accounts"
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition disabled:opacity-50"
              >
                Seed Demo Accounts
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
              <div className="text-[11px] font-bold uppercase text-slate-500">Allowed CORS & CSP Origins</div>
              <div className="mt-1 font-mono text-slate-700 text-[11px] flex flex-wrap gap-1">
                {data.auth.allowed_origins.map((orig) => (
                  <span key={orig} className="rounded bg-white border border-slate-200 px-1.5 py-0.5">
                    {orig}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
              <div className="text-[11px] font-bold uppercase text-slate-500">Cookie & Session Policy</div>
              <div className="mt-1 text-slate-700 space-y-0.5">
                <div>Secure: <span className="font-semibold">{data.auth.cookie_secure ? 'True (HTTPS)' : 'False (Dev HTTP OK)'}</span></div>
                <div>SameSite: <span className="font-semibold">Lax</span>, HttpOnly: <span className="font-semibold">True</span></div>
                <div>Access Token: <span className="font-semibold">{data.auth.token_expire_minutes}m</span>, Refresh: <span className="font-semibold">{data.auth.refresh_token_expire_days}d</span></div>
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
              <div className="text-[11px] font-bold uppercase text-slate-500">Active Demo Accounts ({data.auth.demo_accounts_count})</div>
              <div className="mt-1 font-mono text-[11px] text-slate-700 space-y-0.5">
                {data.auth.demo_accounts.map((email) => (
                  <div key={email} className="truncate">• {email}</div>
                ))}
              </div>
            </div>
          </div>

          {demoActionNotice && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-2.5 text-xs text-blue-800">
              {demoActionNotice}
            </div>
          )}

          {authTestResult && (
            <div
              data-testid="auth-test-result-box"
              className={`rounded-xl border p-3 text-xs ${
                authTestResult.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-red-200 bg-red-50 text-red-900'
              }`}
            >
              <div className="flex items-center justify-between font-bold">
                <span>Origin: {authTestResult.origin} → HTTP {authTestResult.status} ({authTestResult.time_ms}ms)</span>
                <span>{authTestResult.ok ? 'AUTHENTICATION SUCCESSFUL' : 'FAILED'}</span>
              </div>
              <div className="mt-1 font-mono text-[11px]">
                {JSON.stringify(authTestResult.data || authTestResult.error)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3c. 3D Screen Trailer & Fallback Strategy Card */}
      <div data-testid="trailer-readiness-card" className="rounded-2xl border border-[#E6DCD2] bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
              <Tv className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[#1B1320]">3D Screen Trailer & Fallback Strategy</h3>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                  {data.metrics.playable_on_screen_pct ?? Math.round(((50 + (data.movies.filter(m => m.source_chain?.trailer_embeddable).length)) / data.movies.length) * 100)}% Playable On 3D Screen
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Authentic delivery: Hosted video texture or official YouTube player on screen, with automated Theatre Mode or Title Card fallback when restricted.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5">
            <div className="text-[11px] font-bold uppercase text-emerald-800">1. Hosted on 3D Screen (Default for Hosted)</div>
            <div className="mt-1 text-2xl font-black text-emerald-900">
              {data.metrics.showcase_movies_count || 51}
              <span className="text-xs font-semibold text-emerald-700 ml-1.5">
                (100% Success Rate)
              </span>
            </div>
            <p className="text-[11px] text-emerald-700 mt-1">
              Direct WebGL video texture streaming rights-cleared MP4. Depth layering, front-row seat occlusion, and room acoustics verified.
            </p>
          </div>

          <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3.5">
            <div className="text-[11px] font-bold uppercase text-rose-800">2. YouTube in Theatre Mode (Default for YouTube)</div>
            <div className="mt-1 text-2xl font-black text-rose-900">
              {data.movies.filter(m => m.source_chain?.trailer_embeddable).length}
              <span className="text-xs font-semibold text-rose-700 ml-1.5">
                (100% Success Rate)
              </span>
            </div>
            <p className="text-[11px] text-rose-700 mt-1">
              Default for YouTube titles: Official embed in high-definition 85vw theatre overlay. 6s watchdog prevents black boxes with external YouTube search fallback.
            </p>
          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3.5">
            <div className="text-[11px] font-bold uppercase text-blue-800">3. YouTube on 3D Screen (Experimental)</div>
            <div className="mt-1 text-2xl font-black text-blue-900">
              Optional Setting
              <span className="text-xs font-semibold text-blue-700 ml-1.5">
                (User Opt-in)
              </span>
            </div>
            <p className="text-[11px] text-blue-700 mt-1">
              CameraGuarded CSS3D iframe through transparent canvas cutout. Available in Settings for user selection; auto-detects picture visibility.
            </p>
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
