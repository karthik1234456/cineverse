// app/admin/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  TrendingUp, Users, Ticket, BarChart3,
  Calendar, ShieldCheck, Film, ArrowRight
} from 'lucide-react';
import { getAdminAnalytics, getStoredUser, type AdminAnalytics } from '@/services/api';

export default function AdminDashboardPage() {
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAdminAnalytics()
      .then((data) => setAnalytics(data))
      .catch((err) => {
        setError(err.message || 'Access restricted. Admin credentials required.');
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 w-full text-white space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-red-600/20 px-3 py-1 text-xs font-bold text-red-400 mb-2 border border-red-500/30">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>EXECUTIVE CONSOLE</span>
          </div>
          <h1 className="text-3xl font-black text-white">CineVerse Platform Analytics</h1>
          <p className="text-xs text-zinc-400 mt-1">Live booking velocity, screen occupancy, and revenue telemetry</p>
        </div>

        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-semibold text-emerald-400">Live Telemetry Active</span>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-950/20 p-8 text-center space-y-3">
          <p className="text-base font-bold text-red-300">{error}</p>
          <p className="text-xs text-zinc-400">
            Please sign in with an Administrator or Cinema Manager account (e.g. <span className="text-zinc-200">admin@cineverse.in</span> / <span className="text-zinc-200">Admin@123</span>).
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#e50914] px-4 py-2 text-xs font-bold text-white hover:bg-red-700 transition"
          >
            <span>Return to CineVerse</span>
          </Link>
        </div>
      ) : loading ? (
        <div className="p-12 text-center text-zinc-400">Loading platform metrics...</div>
      ) : analytics ? (
        <div className="space-y-8">
          {/* Key Metric Tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-white/5 bg-[#12131a] p-5 space-y-2">
              <div className="flex items-center justify-between text-zinc-400 text-xs">
                <span>Gross Revenue</span>
                <TrendingUp className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-black text-white">₹{analytics.total_revenue.toLocaleString()}</div>
              <div className="text-[11px] text-emerald-400 font-semibold">+18.4% vs last week</div>
            </div>

            <div className="rounded-2xl border border-white/5 bg-[#12131a] p-5 space-y-2">
              <div className="flex items-center justify-between text-zinc-400 text-xs">
                <span>Confirmed Bookings</span>
                <Ticket className="h-4 w-4 text-[#e50914]" />
              </div>
              <div className="text-2xl font-black text-white">{analytics.total_bookings}</div>
              <div className="text-[11px] text-zinc-500">Across 7 metropolitan cities</div>
            </div>

            <div className="rounded-2xl border border-white/5 bg-[#12131a] p-5 space-y-2">
              <div className="flex items-center justify-between text-zinc-400 text-xs">
                <span>Tickets Issued</span>
                <Users className="h-4 w-4 text-amber-400" />
              </div>
              <div className="text-2xl font-black text-white">{analytics.total_tickets_sold}</div>
              <div className="text-[11px] text-zinc-500">Admissions with signed QR</div>
            </div>

            <div className="rounded-2xl border border-white/5 bg-[#12131a] p-5 space-y-2">
              <div className="flex items-center justify-between text-zinc-400 text-xs">
                <span>Seat Occupancy Rate</span>
                <BarChart3 className="h-4 w-4 text-sky-400" />
              </div>
              <div className="text-2xl font-black text-white">{analytics.overall_occupancy_percentage}%</div>
              <div className="text-[11px] text-sky-400 font-semibold">3D Auditoriums trending highest</div>
            </div>
          </div>

          {/* Top Movies & Recent Bookings Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Top Movies */}
            <div className="rounded-2xl border border-white/5 bg-[#12131a] p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/5">
                <h2 className="text-base font-bold text-white">Top Grossing Movies</h2>
                <Film className="h-4 w-4 text-[#e50914]" />
              </div>

              <div className="space-y-3">
                {analytics.top_movies.map((m, idx) => (
                  <div
                    key={m.title}
                    className="flex items-center justify-between rounded-xl border border-white/5 bg-[#0f1014] p-3 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-zinc-500 w-4">0{idx + 1}</span>
                      <span className="font-bold text-white">{m.title}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-black text-amber-400">₹{m.revenue.toLocaleString()}</span>
                      <div className="text-[10px] text-zinc-500">{m.bookings} bookings</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Bookings Feed */}
            <div className="rounded-2xl border border-white/5 bg-[#12131a] p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/5">
                <h2 className="text-base font-bold text-white">Recent Real-Time Bookings</h2>
                <Calendar className="h-4 w-4 text-emerald-400" />
              </div>

              <div className="space-y-3">
                {analytics.recent_bookings.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between rounded-xl border border-white/5 bg-[#0f1014] p-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[#e50914]">{b.booking_code}</span>
                        <span className="font-medium text-white">{b.movie}</span>
                      </div>
                      <span className="text-[10px] text-zinc-500">{b.seats_count} seats reserved</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-emerald-400">₹{b.amount}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

