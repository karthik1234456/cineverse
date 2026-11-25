// app/admin/security/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ShieldAlert,
  ShieldCheck,
  Ban,
  Unlock,
  AlertTriangle,
  RefreshCw,
  Clock,
  ArrowLeft,
  Activity,
  Layers,
  Filter,
} from 'lucide-react';
import {
  getSecurityMetrics,
  blockSecurityTarget,
  unblockSecurityTarget,
  type SecurityMetrics,
} from '@/services/api';

export default function AdminSecurityConsolePage() {
  const [metrics, setMetrics] = useState<SecurityMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Block Form state
  const [targetType, setTargetType] = useState<'ip' | 'user'>('ip');
  const [targetVal, setTargetVal] = useState('');
  const [blockMinutes, setBlockMinutes] = useState(60);
  const [blockReason, setBlockReason] = useState('Repeated rate limit and bot abuse');
  const [submitting, setSubmitting] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getSecurityMetrics();
      setMetrics(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load security metrics. Admin rights required.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000); // refresh every 15s
    return () => clearInterval(interval);
  }, [loadData]);

  async function handleBlock(e: React.FormEvent) {
    e.preventDefault();
    if (!targetVal.trim()) return;

    try {
      setSubmitting(true);
      await blockSecurityTarget(targetType, targetVal.trim(), blockMinutes, blockReason);
      setActionNotice(`Successfully blocked ${targetType} '${targetVal}' for ${blockMinutes}m.`);
      setTargetVal('');
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to block target');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUnblock(type: 'ip' | 'user', target: string) {
    try {
      await unblockSecurityTarget(type, target);
      setActionNotice(`Successfully unblocked ${type} '${target}'.`);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to unblock target');
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 w-full text-white space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-white transition"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Dashboard</span>
            </Link>
            <span className="text-zinc-600">/</span>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-rose-600/20 px-3 py-0.5 text-xs font-bold text-rose-400 border border-rose-500/30">
              <ShieldAlert className="h-3.5 w-3.5" />
              <span>SECURITY & ANTI-BOT TELEMETRY</span>
            </div>
          </div>
          <h1 className="text-3xl font-black text-white">Bot Shield & Fraud Prevention</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Real-time Redis sliding-window monitoring, seat hoarding defense, and IP/account blocks
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-zinc-200 border border-white/10 transition active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {actionNotice && (
        <div className="flex items-center justify-between rounded-2xl border border-emerald-500/30 bg-emerald-950/20 px-4 py-3 text-xs font-semibold text-emerald-300">
          <span>{actionNotice}</span>
          <button onClick={() => setActionNotice(null)} className="text-emerald-400 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {error ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-950/20 p-8 text-center space-y-3">
          <p className="text-base font-bold text-red-300">{error}</p>
          <p className="text-xs text-zinc-400">
            Sign in as Administrator (<span className="text-zinc-200">admin@cineverse.in</span>) to inspect security telemetry.
          </p>
        </div>
      ) : loading && !metrics ? (
        <div className="p-16 text-center text-zinc-400">Loading security telemetry...</div>
      ) : metrics ? (
        <div className="space-y-8">
          {/* Key Metric Tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-white/5 bg-[#12131a] p-5 space-y-2">
              <div className="flex items-center justify-between text-zinc-400 text-xs">
                <span>Rate Limits Triggered</span>
                <ShieldAlert className="h-4 w-4 text-rose-400" />
              </div>
              <div className="text-2xl font-black text-white">
                {metrics.global_counters['RATE_LIMITED'] || 0}
              </div>
              <div className="text-[11px] text-zinc-500">429 sliding window throttle</div>
            </div>

            <div className="rounded-2xl border border-white/5 bg-[#12131a] p-5 space-y-2">
              <div className="flex items-center justify-between text-zinc-400 text-xs">
                <span>Seat Hoarding Blocks</span>
                <Layers className="h-4 w-4 text-amber-400" />
              </div>
              <div className="text-2xl font-black text-white">
                {metrics.global_counters['HOARDING_ATTEMPT'] || 0}
              </div>
              <div className="text-[11px] text-amber-400 font-semibold">Multiple show/seat abuses</div>
            </div>

            <div className="rounded-2xl border border-white/5 bg-[#12131a] p-5 space-y-2">
              <div className="flex items-center justify-between text-zinc-400 text-xs">
                <span>Auth Failures Logged</span>
                <Ban className="h-4 w-4 text-purple-400" />
              </div>
              <div className="text-2xl font-black text-white">
                {metrics.global_counters['AUTH_FAILED'] || 0}
              </div>
              <div className="text-[11px] text-zinc-500">Brute force & credential protection</div>
            </div>

            <div className="rounded-2xl border border-white/5 bg-[#12131a] p-5 space-y-2">
              <div className="flex items-center justify-between text-zinc-400 text-xs">
                <span>Active Entity Blocks</span>
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-black text-white">
                {metrics.active_blocks_count}
              </div>
              <div className="text-[11px] text-emerald-400 font-semibold">IPs & accounts suspended</div>
            </div>
          </div>

          {/* Active Alerts section */}
          {metrics.recent_alerts.length > 0 && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-950/10 p-6 space-y-4">
              <div className="flex items-center gap-2 text-amber-400 text-sm font-bold">
                <AlertTriangle className="h-4 w-4" />
                <span>Security Anomaly Alerts (Threshold Crossed)</span>
              </div>
              <div className="space-y-2">
                {metrics.recent_alerts.map((alt) => (
                  <div
                    key={alt.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-amber-500/20 bg-black/40 p-3.5 text-xs"
                  >
                    <div>
                      <div className="font-bold text-white">{alt.reason}</div>
                      <div className="text-zinc-400 text-[11px] mt-0.5">
                        Target: {alt.masked_ip} {alt.user_id ? `· User #${alt.user_id}` : ''} ·{' '}
                        {new Date(alt.timestamp * 1000).toLocaleTimeString()}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setTargetType('ip');
                        setTargetVal(alt.client_ip);
                        setBlockReason('Automated anomaly alert threshold exceeded');
                      }}
                      className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-lg bg-rose-600/30 border border-rose-500/40 px-3 py-1 text-[11px] font-bold text-rose-300 hover:bg-rose-600/50 transition"
                    >
                      <Ban className="h-3 w-3" />
                      <span>Block IP</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Block Target Form & Active Blocks Table */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Block Target Card */}
            <div className="rounded-2xl border border-white/5 bg-[#12131a] p-6 space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-white/5">
                <Ban className="h-4 w-4 text-rose-500" />
                <h2 className="text-base font-bold text-white">Temporary Security Block</h2>
              </div>

              <form onSubmit={handleBlock} className="space-y-4 text-xs">
                <div>
                  <label className="block text-zinc-400 font-bold mb-1">Target Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTargetType('ip')}
                      className={`py-2 text-center rounded-xl font-bold transition border ${
                        targetType === 'ip'
                          ? 'bg-rose-600/30 border-rose-500 text-white'
                          : 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10'
                      }`}
                    >
                      IP Address
                    </button>
                    <button
                      type="button"
                      onClick={() => setTargetType('user')}
                      className={`py-2 text-center rounded-xl font-bold transition border ${
                        targetType === 'user'
                          ? 'bg-rose-600/30 border-rose-500 text-white'
                          : 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10'
                      }`}
                    >
                      User Account ID
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-zinc-400 font-bold mb-1">
                    {targetType === 'ip' ? 'Target IP Address' : 'Target User ID'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={targetType === 'ip' ? '192.168.1.10' : '42'}
                    value={targetVal}
                    onChange={(e) => setTargetVal(e.target.value)}
                    className="w-full rounded-xl bg-black/50 border border-white/10 px-3 py-2 text-white placeholder-zinc-600 focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 font-bold mb-1">Duration (Minutes)</label>
                  <select
                    value={blockMinutes}
                    onChange={(e) => setBlockMinutes(Number(e.target.value))}
                    className="w-full rounded-xl bg-black/50 border border-white/10 px-3 py-2 text-white focus:outline-none focus:border-rose-500"
                  >
                    <option value={15}>15 Minutes (Short cooldown)</option>
                    <option value={60}>1 Hour (Standard)</option>
                    <option value={360}>6 Hours (High abuse)</option>
                    <option value={1440}>24 Hours (Severe bot)</option>
                    <option value={10080}>7 Days (Extended)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-400 font-bold mb-1">Reason</label>
                  <input
                    type="text"
                    value={blockReason}
                    onChange={(e) => setBlockReason(e.target.value)}
                    className="w-full rounded-xl bg-black/50 border border-white/10 px-3 py-2 text-white placeholder-zinc-600 focus:outline-none focus:border-rose-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl bg-gradient-to-r from-red-600 to-rose-600 py-2.5 font-bold text-white shadow hover:from-red-500 hover:to-rose-500 transition active:scale-95 disabled:opacity-50"
                >
                  {submitting ? 'Applying Block...' : 'Enforce Immediate Block'}
                </button>
              </form>
            </div>

            {/* Currently Blocked Targets */}
            <div className="lg:col-span-2 rounded-2xl border border-white/5 bg-[#12131a] p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-amber-400" />
                  <h2 className="text-base font-bold text-white">
                    Actively Suspended Entities ({metrics.blocked_targets.length})
                  </h2>
                </div>
                <span className="text-xs text-zinc-500">Auto-expires via Redis TTL</span>
              </div>

              {metrics.blocked_targets.length === 0 ? (
                <div className="py-12 text-center text-zinc-500 text-xs">
                  No entities currently blocked. Platform traffic is operating normally.
                </div>
              ) : (
                <div className="space-y-3">
                  {metrics.blocked_targets.map((blk) => (
                    <div
                      key={`${blk.target_type}-${blk.target}`}
                      className="flex items-center justify-between rounded-xl border border-white/5 bg-[#0e0f14] p-3 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-rose-400 uppercase text-[11px] bg-rose-950/40 border border-rose-800/40 px-2 py-0.5 rounded">
                            {blk.target_type}
                          </span>
                          <span className="font-mono text-white font-bold">{blk.target}</span>
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-1">{blk.reason}</p>
                        <span className="text-[10px] text-zinc-500 flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3" />
                          <span>Expires in {blk.expires_in_minutes} min ({blk.ttl_seconds}s)</span>
                        </span>
                      </div>

                      <button
                        onClick={() => handleUnblock(blk.target_type as any, blk.target)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-zinc-200 hover:bg-white/10 transition"
                      >
                        <Unlock className="h-3.5 w-3.5 text-emerald-400" />
                        <span>Unblock</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent Fraud Signals Stream (No PII) */}
          <div className="rounded-2xl border border-white/5 bg-[#12131a] p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-cyan-400" />
                <h2 className="text-base font-bold text-white">Live Anomaly Signals (Privacy Preserving)</h2>
              </div>
              <span className="text-xs text-zinc-500">IPs masked, zero PII logged</span>
            </div>

            {metrics.recent_events.length === 0 ? (
              <div className="py-8 text-center text-zinc-500 text-xs">
                No recent anomaly events captured.
              </div>
            ) : (
              <div className="space-y-2">
                {metrics.recent_events.slice(0, 15).map((ev, i) => (
                  <div
                    key={i}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 rounded-xl border border-white/5 bg-[#0b0c10] px-4 py-2 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded border ${
                        ev.event_type === 'RATE_LIMITED'
                          ? 'bg-rose-950/40 text-rose-400 border-rose-800/40'
                          : ev.event_type === 'HOARDING_ATTEMPT'
                            ? 'bg-amber-950/40 text-amber-400 border-amber-800/40'
                            : 'bg-slate-800/40 text-slate-300 border-slate-700/40'
                      }`}>
                        {ev.event_type}
                      </span>
                      <span className="text-zinc-300">
                        {ev.masked_ip} {ev.user_id ? `(User #${ev.user_id})` : ''}
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-500 flex items-center gap-2">
                      <span>{JSON.stringify(ev.metadata)}</span>
                      <span>·</span>
                      <span>{new Date(ev.timestamp * 1000).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
