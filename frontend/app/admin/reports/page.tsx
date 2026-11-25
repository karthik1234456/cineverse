// frontend/app/admin/reports/page.tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  ShieldAlert,
  ArrowLeft,
  Copy,
  Check,
  Download,
  Filter,
  Search,
  ExternalLink,
  ChevronDown,
  RefreshCw,
  Terminal,
  Activity,
  Layers,
  Monitor
} from 'lucide-react';
import { getStoredUser } from '@/services/api';

interface ProblemReport {
  id: number;
  created_at: string;
  status: string;
  user_description: string;
  expected_behavior?: string;
  screenshot_filename?: string;
  screenshot_url?: string;
  url: string;
  route: string;
  query_params?: Record<string, any>;
  build_stamp?: string;
  auditorium_id?: string;
  showtime_id?: number;
  cinema_id?: number;
  mode?: string;
  selected_seats?: string[];
  console_logs?: Array<{ timestamp: string; level: string; message: string }>;
  network_requests?: Array<{ timestamp: string; method: string; url: string; status: number; durationMs: number }>;
  browser_info?: Record<string, any>;
  render_metrics?: Record<string, any>;
  antigravity_prompt?: string;
}

export default function AdminReportsPage() {
  const [reports, setReports] = useState<ProblemReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReport, setSelectedReport] = useState<ProblemReport | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null);

  const fetchReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      let url = '/api/v1/admin/reports';
      if (statusFilter !== 'all') {
        url += `?status=${statusFilter}`;
      }

      const res = await fetch(url, { headers });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          throw new Error('Access denied. Administrator privileges required to view diagnostics.');
        }
        throw new Error(`Failed to load problem reports (${res.status})`);
      }
      const data = await res.json();
      setReports(data);
      if (data.length > 0 && !selectedReport) {
        setSelectedReport(data[0]);
      }
    } catch (err: any) {
      setError(err.message || 'Error loading problem reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [statusFilter]);

  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        r.user_description.toLowerCase().includes(q) ||
        r.route.toLowerCase().includes(q) ||
        (r.mode && r.mode.toLowerCase().includes(q)) ||
        (r.auditorium_id && r.auditorium_id.includes(q))
      );
    });
  }, [reports, searchQuery]);

  const handleCopyPrompt = async (report: ProblemReport) => {
    const promptText = report.antigravity_prompt || generateClientFallbackPrompt(report);
    try {
      await navigator.clipboard.writeText(promptText);
      setCopiedId(report.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback prompt copy
      const ta = document.createElement('textarea');
      ta.value = promptText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedId(report.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleExportAll = async () => {
    setIsExporting(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/v1/admin/reports/export?status=open', { headers });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cineverse_open_bug_reports_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert(err.message || 'Failed to export reports');
    } finally {
      setIsExporting(false);
    }
  };

  const handleUpdateStatus = async (reportId: number, newStatus: string) => {
    setUpdatingStatusId(reportId);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/v1/admin/reports/${reportId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      const updated = await res.json();
      setReports((prev) => prev.map((r) => (r.id === reportId ? updated : r)));
      if (selectedReport?.id === reportId) {
        setSelectedReport(updated);
      }
    } catch (err: any) {
      alert(err.message || 'Status update failed');
    } finally {
      setUpdatingStatusId(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 w-full text-slate-100 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link
              href="/admin"
              className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Admin Console</span>
            </Link>
            <span className="text-slate-600">/</span>
            <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">Telemetry</span>
          </div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
            <ShieldAlert className="w-6 h-6 text-red-500" />
            <span>Problem Reports & Diagnostics</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Review user-submitted glitches, 3D canvas state, sanitized console logs, and generate Antigravity fix prompts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchReports}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-900 border border-slate-700 rounded-lg hover:bg-slate-800 transition flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={handleExportAll}
            disabled={isExporting}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-lg shadow transition flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExporting ? 'Exporting...' : 'Export All Open Reports'}</span>
          </button>
        </div>
      </div>

      {error ? (
        <div className="p-8 rounded-2xl bg-red-950/20 border border-red-500/30 text-center space-y-3">
          <p className="text-base font-bold text-red-300">{error}</p>
          <p className="text-xs text-slate-400">
            Sign in as an administrator (<code className="text-slate-200">admin@cineverse.in</code>) to inspect client telemetry and bug submissions.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Filter & List */}
          <div className="lg:col-span-5 space-y-4">
            {/* Filter Tabs */}
            <div className="flex items-center justify-between gap-2 p-1 bg-slate-900/80 border border-slate-800 rounded-xl">
              {(['all', 'open', 'in_progress', 'resolved'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg capitalize transition ${
                    statusFilter === st
                      ? 'bg-cyan-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {st.replace('_', ' ')}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search descriptions, routes, modes..."
                className="w-full pl-9 pr-3 py-2 bg-slate-900/90 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Reports List */}
            <div className="space-y-2.5 max-h-[70vh] overflow-y-auto pr-1">
              {loading && reports.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">Loading diagnostic reports...</div>
              ) : filteredReports.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 bg-slate-900/40 border border-slate-800/80 rounded-xl">
                  No problem reports found for current filter.
                </div>
              ) : (
                filteredReports.map((r) => {
                  const isSelected = selectedReport?.id === r.id;
                  return (
                    <div
                      key={r.id}
                      onClick={() => setSelectedReport(r)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition text-left space-y-2 ${
                        isSelected
                          ? 'bg-slate-800/90 border-cyan-500/80 shadow-lg shadow-cyan-950/30'
                          : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/90'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono text-cyan-400">#{r.id}</span>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              r.status === 'open'
                                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                : r.status === 'in_progress'
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            }`}
                          >
                            {r.status.replace('_', ' ')}
                          </span>
                          <span className="text-slate-500 text-[10px]">
                            {new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs font-semibold text-slate-200 line-clamp-2 leading-snug">
                        {r.user_description}
                      </p>

                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
                        <span className="px-1.5 py-0.5 bg-black/40 rounded border border-slate-800">
                          {r.route}
                        </span>
                        {r.mode && (
                          <span className="px-1.5 py-0.5 bg-cyan-950/60 text-cyan-300 rounded border border-cyan-900/50 uppercase font-mono">
                            {r.mode}
                          </span>
                        )}
                        {r.screenshot_url && (
                          <span className="text-emerald-400">📷 Screenshot</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Selected Report Detail */}
          <div className="lg:col-span-7">
            {selectedReport ? (
              <div className="p-6 bg-slate-900/70 border border-slate-800 rounded-2xl space-y-5">
                {/* Detail Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-white">Report #{selectedReport.id}</span>
                      <span className="text-xs text-slate-500">
                        {new Date(selectedReport.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-xs text-cyan-400 font-mono break-all">{selectedReport.url}</div>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={selectedReport.status}
                      disabled={updatingStatusId === selectedReport.id}
                      onChange={(e) => handleUpdateStatus(selectedReport.id, e.target.value)}
                      className="px-2.5 py-1 bg-slate-800 border border-slate-700 text-xs text-slate-200 rounded-lg focus:outline-none focus:border-cyan-500"
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                    </select>

                    <button
                      onClick={() => handleCopyPrompt(selectedReport)}
                      className="px-3 py-1 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg shadow transition flex items-center gap-1.5"
                      title="Copy ready-to-paste prompt with code pointers for Antigravity"
                    >
                      {copiedId === selectedReport.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-300" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy as prompt for Antigravity</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* User Observation */}
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">User Observation</span>
                  <div className="p-3 bg-black/40 border border-slate-800 rounded-xl text-sm text-slate-100">
                    {selectedReport.user_description}
                  </div>
                </div>

                {/* Expected Behavior */}
                {selectedReport.expected_behavior && (
                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Expected Behavior</span>
                    <div className="p-3 bg-black/40 border border-slate-800 rounded-xl text-sm text-slate-300">
                      {selectedReport.expected_behavior}
                    </div>
                  </div>
                )}

                {/* Screenshot */}
                {selectedReport.screenshot_url && (
                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Captured Viewport / 3D Canvas</span>
                    <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-black aspect-video max-h-72 flex items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={selectedReport.screenshot_url}
                        alt={`Screenshot for report #${selectedReport.id}`}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  </div>
                )}

                {/* Technical Environment Details */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">System State</span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-mono">
                    <div className="p-2 bg-slate-800/60 rounded border border-slate-700/60">
                      <span className="text-slate-500 block text-[10px]">ROUTE</span>
                      <span className="text-slate-200">{selectedReport.route}</span>
                    </div>
                    <div className="p-2 bg-slate-800/60 rounded border border-slate-700/60">
                      <span className="text-slate-500 block text-[10px]">MODE</span>
                      <span className="text-cyan-300 uppercase">{selectedReport.mode || 'N/A'}</span>
                    </div>
                    <div className="p-2 bg-slate-800/60 rounded border border-slate-700/60">
                      <span className="text-slate-500 block text-[10px]">HALL / SHOWTIME</span>
                      <span className="text-slate-200">
                        {selectedReport.auditorium_id ? `Hall ${selectedReport.auditorium_id}` : 'None'}
                        {selectedReport.showtime_id ? ` · Show ${selectedReport.showtime_id}` : ''}
                      </span>
                    </div>
                    <div className="p-2 bg-slate-800/60 rounded border border-slate-700/60">
                      <span className="text-slate-500 block text-[10px]">SEATS SELECTED</span>
                      <span className="text-purple-300">
                        {selectedReport.selected_seats && selectedReport.selected_seats.length > 0
                          ? selectedReport.selected_seats.join(', ')
                          : 'None'}
                      </span>
                    </div>
                    <div className="p-2 bg-slate-800/60 rounded border border-slate-700/60">
                      <span className="text-slate-500 block text-[10px]">QUALITY / FPS</span>
                      <span className="text-slate-200">
                        {selectedReport.render_metrics?.qualityTier || 'normal'} · {selectedReport.render_metrics?.fps || '~60'}fps
                      </span>
                    </div>
                    <div className="p-2 bg-slate-800/60 rounded border border-slate-700/60">
                      <span className="text-slate-500 block text-[10px]">VIEWPORT</span>
                      <span className="text-slate-200">
                        {selectedReport.browser_info?.viewportWidth || 1280}x{selectedReport.browser_info?.viewportHeight || 720}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Console Logs */}
                {selectedReport.console_logs && selectedReport.console_logs.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Recent Console Logs ({selectedReport.console_logs.length})
                    </span>
                    <div className="max-h-36 overflow-y-auto bg-black/60 p-2.5 rounded-xl border border-slate-800 text-[11px] font-mono space-y-1">
                      {selectedReport.console_logs.map((log, i) => (
                        <div
                          key={i}
                          className={`${
                            log.level === 'error'
                              ? 'text-red-400 font-semibold'
                              : log.level === 'warn'
                              ? 'text-amber-400'
                              : 'text-slate-400'
                          }`}
                        >
                          [{log.level.toUpperCase()}] {log.message}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Network Logs */}
                {selectedReport.network_requests && selectedReport.network_requests.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Failed / Slow Network Requests ({selectedReport.network_requests.length})
                    </span>
                    <div className="max-h-36 overflow-y-auto bg-black/60 p-2.5 rounded-xl border border-slate-800 text-[11px] font-mono space-y-1">
                      {selectedReport.network_requests.map((net, i) => (
                        <div key={i} className="flex items-center justify-between text-slate-300">
                          <span className={net.status >= 400 || net.status === 0 ? 'text-red-400' : 'text-amber-400'}>
                            {net.method} {net.url}
                          </span>
                          <span className="text-slate-500 ml-2 whitespace-nowrap">
                            {net.status} ({net.durationMs}ms)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-12 text-center text-slate-500 bg-slate-900/40 border border-slate-800 rounded-2xl">
                Select a report from the list to view full telemetry and Antigravity prompt.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function generateClientFallbackPrompt(r: ProblemReport): string {
  return `# Bug Report (CineVerse Problem Report #${r.id})
**Observed Issue**: ${r.user_description}
${r.expected_behavior ? `**Expected**: ${r.expected_behavior}\n` : ''}
**URL**: \`${r.url}\` (Route: \`${r.route}\`)
**Mode**: ${r.mode || 'N/A'} | **Hall**: ${r.auditorium_id || 'N/A'} | **Showtime**: ${r.showtime_id || 'N/A'}
**Selected Seats**: ${r.selected_seats?.join(', ') || 'None'}
`;
}

