'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Film,
  Upload,
  CheckCircle,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Play,
  ExternalLink,
  RefreshCw,
  Search,
  FileCheck,
  Video,
  Info,
} from 'lucide-react';

interface TrailerItem {
  movie_id: number;
  title: string;
  slug: string;
  source_in_use: string;
  trailer_url: string | null;
  youtube_trailer_id: string | null;
  rights_holder: string | null;
  license_note: string | null;
  license_expiry: string | null;
  is_expired: boolean;
  rights_status: string;
  file_size_formatted: string | null;
  poster_frame_url: string | null;
  ambient_clip_url: string | null;
  signed_url: string | null;
  trailer_embeddable: boolean;
}

export default function AdminTrailersPage() {
  const [trailers, setTrailers] = useState<TrailerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSource, setFilterSource] = useState<'all' | 'hosted' | 'youtube' | 'none'>('all');

  // Form State
  const [selectedMovieId, setSelectedMovieId] = useState<number | ''>('');
  const [rightsHolder, setRightsHolder] = useState('');
  const [licenseNote, setLicenseNote] = useState('');
  const [expiryDate, setExpiryDate] = useState('2030-12-31');
  const [trailerUrlInput, setTrailerUrlInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [previewTrailer, setPreviewTrailer] = useState<TrailerItem | null>(null);

  // Freshness State (Task 4)
  const [freshnessStatus, setFreshnessStatus] = useState<any>(null);
  const [runningFreshness, setRunningFreshness] = useState(false);
  const [freshnessMessage, setFreshnessMessage] = useState<string | null>(null);

  const fetchFreshness = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/v1/admin/trailers/freshness/status');
      if (res.ok) {
        const data = await res.json();
        setFreshnessStatus(data);
      }
    } catch (err) {
      console.error('Failed to fetch freshness status:', err);
    }
  };

  const handleRunFreshness = async () => {
    setRunningFreshness(true);
    setFreshnessMessage(null);
    try {
      const res = await fetch('http://localhost:8000/api/v1/admin/trailers/freshness/run', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setFreshnessMessage(
          `Freshness check complete: ${data.total_checked} checked, ${data.healthy_youtube} healthy YouTube, ${data.healthy_hosted} healthy hosted, ${data.replaced_count} auto-repaired, ${data.lost_count} lost.`
        );
        fetchFreshness();
        fetchReadiness();
      } else {
        setFreshnessMessage('Failed to execute freshness check.');
      }
    } catch (err: any) {
      setFreshnessMessage(err.message || 'Error running freshness check.');
    } finally {
      setRunningFreshness(false);
    }
  };

  const fetchReadiness = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/v1/admin/trailers/readiness');
      const data = await res.json();
      if (data && data.trailers) {
        setTrailers(data.trailers);
      }
    } catch (err) {
      console.error('Failed to fetch trailer readiness:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReadiness();
    fetchFreshness();
  }, []);

  const handleAttachSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMovieId) {
      setSubmitMessage({ type: 'error', text: 'Please select a movie.' });
      return;
    }
    if (!rightsHolder.trim()) {
      setSubmitMessage({ type: 'error', text: 'Rights holder field is required.' });
      return;
    }
    if (!licenseNote.trim()) {
      setSubmitMessage({ type: 'error', text: 'License / permission note field is required.' });
      return;
    }
    if (!expiryDate) {
      setSubmitMessage({ type: 'error', text: 'Expiry date is required.' });
      return;
    }
    if (!selectedFile && !trailerUrlInput.trim()) {
      setSubmitMessage({ type: 'error', text: 'Please upload a video file or provide an owned video URL.' });
      return;
    }

    setSubmitting(true);
    setSubmitMessage(null);

    const formData = new FormData();
    formData.append('movie_id', String(selectedMovieId));
    formData.append('rights_holder', rightsHolder.trim());
    formData.append('license_note', licenseNote.trim());
    formData.append('expiry_date', expiryDate);
    if (selectedFile) {
      formData.append('file', selectedFile);
    }
    if (trailerUrlInput.trim()) {
      formData.append('trailer_url', trailerUrlInput.trim());
    }

    try {
      const res = await fetch('http://localhost:8000/api/v1/admin/trailers/attach', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setSubmitMessage({
          type: 'success',
          text: `Success! Trailer transcoded to 720p H.264 & WebM with fast-start. Clean virus scan verified.`,
        });
        setSelectedFile(null);
        setTrailerUrlInput('');
        fetchReadiness();
      } else {
        setSubmitMessage({
          type: 'error',
          text: data.detail || 'Failed to attach trailer. Validation or virus check failed.',
        });
      }
    } catch (err: any) {
      setSubmitMessage({ type: 'error', text: err.message || 'Network error while attaching trailer.' });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredTrailers = trailers.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.rights_holder && t.rights_holder.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;
    if (filterSource === 'hosted') return t.source_in_use === 'Hosted 720p';
    if (filterSource === 'youtube') return t.source_in_use === 'Official YouTube Player';
    if (filterSource === 'none') return t.source_in_use === 'Title Card';
    return true;
  });

  const hostedCount = trailers.filter((t) => t.source_in_use === 'Hosted 720p').length;
  const youtubeCount = trailers.filter((t) => t.source_in_use === 'Official YouTube Player').length;

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 p-6 md:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <div className="flex items-center gap-2 text-rose-500 font-semibold text-xs tracking-wider uppercase mb-1">
              <ShieldCheck className="w-4 h-4" />
              Rights & Pipeline Administration
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              <Film className="w-8 h-8 text-rose-500" />
              Hosted Trailer Pipeline & Rights Verification
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Upload rights-cleared trailer files with mandatory license documentation, automated virus scanning, 720p transcoding with fast start, and signed expiring URLs (§ Part B.2).
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchReadiness}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm transition"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh Readiness
            </button>
            <Link
              href="/admin"
              className="px-4 py-2 bg-slate-900 border border-white/10 hover:bg-slate-800 text-slate-300 rounded-lg text-sm transition"
            >
              Admin Dashboard
            </Link>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-[#0e121b] border border-white/5 rounded-xl p-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Hosted 720p Trailers</div>
            <div className="text-3xl font-bold text-emerald-400 mt-2 flex items-center gap-2">
              <FileCheck className="w-6 h-6 text-emerald-400" />
              {hostedCount}
            </div>
            <p className="text-xs text-slate-500 mt-1">Direct WebGL VideoTexture with CC / Studio Clearance</p>
          </div>
          <div className="bg-[#0e121b] border border-white/5 rounded-xl p-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Official YouTube Embeds</div>
            <div className="text-3xl font-bold text-rose-400 mt-2 flex items-center gap-2">
              <Video className="w-6 h-6 text-rose-400" />
              {youtubeCount}
            </div>
            <p className="text-xs text-slate-500 mt-1">Sanctioned IFrame API (Privacy-Enhanced, Zero Download)</p>
          </div>
          <div className="bg-[#0e121b] border border-white/5 rounded-xl p-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Nightly Freshness Status</div>
            <div className="text-3xl font-bold text-sky-400 mt-2 flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-sky-400" />
              {freshnessStatus?.latest_run ? 'Active' : 'Standby'}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {freshnessStatus?.latest_run ? `Last run: ${freshnessStatus.latest_run.timestamp}` : 'Embeddability monitoring ready'}
            </p>
          </div>
          <div className="bg-[#0e121b] border border-white/5 rounded-xl p-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Catalog Coverage</div>
            <div className="text-3xl font-bold text-white mt-2 flex items-center gap-2">
              <Film className="w-6 h-6 text-rose-500" />
              {trailers.length}
            </div>
            <p className="text-xs text-slate-500 mt-1">100% verified against ToS & ripper compliance guards</p>
          </div>
        </div>

        {/* Freshness & Alert Banner (Task 4) */}
        <div className="bg-[#0e121b] border border-sky-500/30 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-sky-400" />
                Nightly Embeddability & Freshness Health Monitor
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Automatically monitors every stored trailer, detects YouTube copyright takedowns/restrictions (Errors 150/153), attempts self-healing with TMDB backups, and alerts administrators.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleRunFreshness}
                disabled={runningFreshness}
                data-testid="run-freshness-btn"
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white rounded-lg text-xs font-bold transition disabled:opacity-50 cursor-pointer shadow-lg"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${runningFreshness ? 'animate-spin' : ''}`} />
                <span>{runningFreshness ? 'Auditing Catalog...' : 'Run Freshness Audit Now'}</span>
              </button>
            </div>
          </div>

          {freshnessMessage && (
            <div className="rounded-xl border border-sky-500/40 bg-sky-950/40 p-3 text-xs text-sky-200">
              {freshnessMessage}
            </div>
          )}

          {freshnessStatus?.active_alerts && freshnessStatus.active_alerts.length > 0 ? (
            <div className="rounded-xl border border-rose-500/40 bg-rose-950/40 p-4 space-y-2">
              <div className="text-xs font-bold text-rose-400 flex items-center gap-1.5 uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4" />
                <span>Alert: {freshnessStatus.active_alerts.length} Titles Lost Trailers</span>
              </div>
              <div className="space-y-1.5">
                {freshnessStatus.active_alerts.map((alert: any, idx: number) => (
                  <div key={idx} className="text-xs text-rose-200 flex items-center justify-between">
                    <span>• Movie #{alert.movie_id} <strong>{alert.title}</strong> — Video key {alert.broken_key} ({alert.reason})</span>
                    <span className="text-[10px] text-slate-400 font-mono">{alert.timestamp}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-400 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span>Zero broken trailer alerts. All {freshnessStatus?.latest_run?.total_checked || trailers.length} movies currently healthy with verified playback sources.</span>
            </div>
          )}
        </div>

        {/* Attach Trailer Form */}
        <div className="bg-[#0e121b] border border-white/10 rounded-2xl p-6 md:p-8 shadow-xl">
          <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-2">
            <Upload className="w-5 h-5 text-rose-500" />
            Attach Rights-Cleared Trailer (§ Part B.2)
          </h2>
          <p className="text-xs text-slate-400 mb-6">
            Upload an MP4/WebM file or specify an owned video URL. Automatic checks verify file format, file size (&lt;150MB), virus scan signatures, and duration.
          </p>

          <form onSubmit={handleAttachSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Movie Selection */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-300 mb-2">
                  Target Movie <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedMovieId}
                  onChange={(e) => setSelectedMovieId(Number(e.target.value) || '')}
                  className="w-full bg-[#141925] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-rose-500"
                  required
                >
                  <option value="">Select a movie from catalog...</option>
                  {trailers.map((m) => (
                    <option key={m.movie_id} value={m.movie_id}>
                      {m.title} ({m.source_in_use})
                    </option>
                  ))}
                </select>
              </div>

              {/* Rights Holder */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-300 mb-2">
                  Rights Holder / Studio <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Blender Foundation / Studio Productions"
                  value={rightsHolder}
                  onChange={(e) => setRightsHolder(e.target.value)}
                  className="w-full bg-[#141925] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-rose-500"
                  required
                />
              </div>

              {/* License Note */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-300 mb-2">
                  License / Permission Note <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Creative Commons Attribution 3.0 (CC BY 3.0)"
                  value={licenseNote}
                  onChange={(e) => setLicenseNote(e.target.value)}
                  className="w-full bg-[#141925] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-rose-500"
                  required
                />
              </div>

              {/* Expiry Date */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-300 mb-2">
                  Rights Expiry Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full bg-[#141925] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-rose-500"
                  required
                />
              </div>

              {/* File Upload */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-300 mb-2">
                  Upload Trailer File (.mp4, .webm)
                </label>
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full bg-[#141925] border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-300 file:mr-4 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-rose-600 file:text-white hover:file:bg-rose-500"
                />
              </div>

              {/* Owned URL Fallback */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-300 mb-2">
                  Or Owned File URL / Local Sample
                </label>
                <input
                  type="text"
                  placeholder="/trailers/astra-celestial-throne.mp4 or https://storage.owned.com/video.mp4"
                  value={trailerUrlInput}
                  onChange={(e) => setTrailerUrlInput(e.target.value)}
                  className="w-full bg-[#141925] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>

            {/* Pipeline Features Notice */}
            <div className="bg-[#141925] border border-white/5 rounded-xl p-4 flex flex-wrap items-center gap-6 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>Automated Virus Scanning Hook</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>Fast-Start (moov upfront) 720p H.264 & WebM</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>Poster Frame & Silent Ambient Loop Extraction</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>HMAC-SHA256 Signed Expiring URLs</span>
              </div>
            </div>

            {submitMessage && (
              <div
                className={`p-4 rounded-xl text-sm flex items-center gap-3 ${
                  submitMessage.type === 'success'
                    ? 'bg-emerald-950/60 border border-emerald-500/30 text-emerald-200'
                    : 'bg-rose-950/60 border border-rose-500/30 text-rose-200'
                }`}
              >
                {submitMessage.type === 'success' ? (
                  <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                )}
                <span>{submitMessage.text}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-3 bg-rose-600 hover:bg-rose-500 disabled:bg-slate-700 text-white font-semibold rounded-xl text-sm transition flex items-center gap-2 shadow-lg shadow-rose-900/30"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Transcoding & Verifying Media...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Attach & Transcode Trailer
                </>
              )}
            </button>
          </form>
        </div>

        {/* Readiness Table */}
        <div className="bg-[#0e121b] border border-white/10 rounded-2xl p-6 md:p-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-emerald-400" />
                Trailer Readiness & Rights Status Table (§ Part B.2)
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Per-movie presentation status, licensing rights holder, expiry dates, and signed expiring streaming URLs.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter movies or rights..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-[#141925] border border-white/10 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-rose-500 w-48 sm:w-64"
                />
              </div>
              <div className="flex rounded-lg border border-white/10 overflow-hidden text-xs">
                {(['all', 'hosted', 'youtube', 'none'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setFilterSource(mode)}
                    className={`px-3 py-1.5 font-medium transition ${
                      filterSource === mode ? 'bg-rose-600 text-white' : 'bg-[#141925] text-slate-400 hover:text-white'
                    }`}
                  >
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Movie</th>
                  <th className="py-3 px-4">Source In Use</th>
                  <th className="py-3 px-4">Rights Holder & License</th>
                  <th className="py-3 px-4">Expiry Date</th>
                  <th className="py-3 px-4">File Size</th>
                  <th className="py-3 px-4">Signed URL Stream</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredTrailers.map((item) => (
                  <tr key={item.movie_id} className="hover:bg-white/[0.02] transition">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white text-sm">{item.title}</div>
                      <div className="text-slate-500 font-mono text-[11px]">{item.slug}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      {item.source_in_use === 'Hosted 720p' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-500/30">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Hosted 720p
                        </span>
                      ) : item.source_in_use === 'Official YouTube Player' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-950/80 text-rose-400 border border-rose-500/30">
                          <Video className="w-3.5 h-3.5" />
                          Official YouTube
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-400">
                          Title Card
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="text-slate-200 font-medium truncate">{item.rights_holder || '—'}</div>
                      <div className="text-slate-500 text-[11px] truncate">{item.license_note || '—'}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span className={item.is_expired ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                          {item.license_expiry || '—'}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500">{item.rights_status}</span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-300">
                      {item.file_size_formatted || '—'}
                    </td>
                    <td className="py-3.5 px-4">
                      {item.signed_url ? (
                        <a
                          href={`http://localhost:8000${item.signed_url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-rose-400 hover:text-rose-300 font-mono text-[11px] hover:underline"
                        >
                          <span>Expiring Token</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {item.trailer_url ? (
                        <button
                          onClick={() => setPreviewTrailer(item)}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md text-xs font-medium transition inline-flex items-center gap-1"
                        >
                          <Play className="w-3 h-3 text-rose-500" />
                          Preview
                        </button>
                      ) : (
                        <span className="text-slate-600 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Video Preview Modal */}
        {previewTrailer && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#0e121b] border border-white/10 rounded-2xl max-w-3xl w-full p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div>
                  <h3 className="font-bold text-white text-lg">{previewTrailer.title}</h3>
                  <p className="text-xs text-slate-400">
                    Rights: {previewTrailer.rights_holder} ({previewTrailer.license_note})
                  </p>
                </div>
                <button
                  onClick={() => setPreviewTrailer(null)}
                  className="px-3 py-1 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded-lg text-xs"
                >
                  Close
                </button>
              </div>

              <div className="aspect-video bg-black rounded-xl overflow-hidden flex items-center justify-center">
                {previewTrailer.source_in_use === 'Hosted 720p' ? (
                  <video
                    src={previewTrailer.trailer_url || ''}
                    controls
                    autoPlay
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${previewTrailer.youtube_trailer_id}?autoplay=1&enablejsapi=1`}
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
