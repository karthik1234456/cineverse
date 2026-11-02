// app/profile/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Ticket, User as UserIcon, Calendar, MapPin,
  Clock, ShieldCheck, ChevronRight, XCircle, LogOut
} from 'lucide-react';
import { getMyBookings, getStoredUser, logoutUser, type BookingResponse } from '@/services/api';

export default function ProfilePage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [bookings, setBookings] = useState<BookingResponse[]>([]);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'all' | 'cancelled'>('upcoming');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = getStoredUser();
    setCurrentUser(user);

    getMyBookings()
      .then((data) => setBookings(data))
      .catch((err) => console.warn(err))
      .finally(() => setLoading(false));
  }, []);

  function handleLogout() {
    logoutUser();
    router.push('/');
  }

  const now = new Date();
  const filteredBookings = bookings.filter((b) => {
    if (activeTab === 'cancelled') return b.status === 'CANCELLED';
    if (activeTab === 'upcoming') {
      return b.status === 'CONFIRMED' && new Date(b.start_time) >= now;
    }
    return true;
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8 w-full text-white space-y-8">
      {/* Profile Header */}
      <div className="rounded-2xl border border-white/10 bg-[#12131a] p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 text-center sm:text-left">
          <div className="h-16 w-16 rounded-full bg-red-600/20 border border-[#e50914]/40 flex items-center justify-center text-2xl font-black text-[#e50914]">
            {currentUser?.full_name ? currentUser.full_name.charAt(0) : 'P'}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white">
              {currentUser?.full_name || 'CineVerse Patron'}
            </h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              Role: <span className="text-zinc-200 capitalize font-medium">{currentUser?.role || 'Customer'}</span> • CineVerse Rewards Active
            </p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/10 transition"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign Out</span>
        </button>
      </div>

      {/* Bookings Section */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h2 className="text-xl font-black text-white">Your Bookings & E-Tickets</h2>
            <p className="text-xs text-zinc-400 mt-0.5">Show these digital QR passes at cinema turnstiles for entry</p>
          </div>

          <div className="flex rounded-xl bg-[#16181f] p-1 border border-white/5">
            <button
              onClick={() => setActiveTab('upcoming')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeTab === 'upcoming' ? 'bg-[#e50914] text-white shadow' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Upcoming
            </button>
            <button
              onClick={() => setActiveTab('all')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeTab === 'all' ? 'bg-[#e50914] text-white shadow' : 'text-zinc-400 hover:text-white'
              }`}
            >
              All Shows
            </button>
            <button
              onClick={() => setActiveTab('cancelled')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeTab === 'cancelled' ? 'bg-[#e50914] text-white shadow' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Cancelled
            </button>
          </div>
        </div>

        {/* Bookings Cards List */}
        {loading ? (
          <div className="p-8 text-center text-zinc-400">Loading your reservations...</div>
        ) : filteredBookings.length > 0 ? (
          <div className="space-y-4">
            {filteredBookings.map((b) => (
              <div
                key={b.id}
                className="flex flex-col md:flex-row items-start md:items-center justify-between rounded-2xl border border-white/5 bg-[#12131a] p-5 gap-4 hover:border-white/15 transition group"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-amber-400">
                      {b.booking_code}
                    </span>
                    <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                      b.status === 'CONFIRMED'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-red-500/20 text-red-400 border border-red-500/30'
                    }`}>
                      {b.status}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-white group-hover:text-[#e50914] transition">
                    {b.movie_title}
                  </h3>

                  <p className="text-xs text-zinc-400 flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-zinc-500" />
                    <span>{b.cinema_name} • {b.auditorium_name}</span>
                  </p>

                  <div className="text-xs font-medium text-zinc-300">
                    {new Date(b.start_time).toLocaleString('en-US', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true,
                    })}
                  </div>

                  <div className="flex flex-wrap gap-1 pt-1">
                    {b.seats.map((s) => (
                      <span key={s.seat_id} className="rounded bg-white/5 px-2 py-0.5 text-[10px] font-bold text-zinc-200">
                        {s.seat_id} ({s.category})
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 border-white/5 pt-3 md:pt-0">
                  <div className="text-right">
                    <div className="text-[10px] text-zinc-500">PAID</div>
                    <div className="text-base font-black text-white">₹{b.final_total_amount}</div>
                  </div>

                  <Link
                    href={`/booking/${b.id}`}
                    className="flex items-center gap-1.5 rounded-xl bg-[#e50914] px-4 py-2 text-xs font-bold text-white hover:bg-red-700 transition"
                  >
                    <span>View E-Ticket</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-white/5 bg-[#12131a] p-12 text-center text-zinc-400">
            <Ticket className="mx-auto h-8 w-8 text-zinc-600 mb-2" />
            <p className="text-base font-bold text-white">No bookings found in this category</p>
            <p className="text-xs mt-1">Book your next movie experience inside our 3D auditorium</p>
            <Link
              href="/movies"
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#e50914] px-4 py-2 text-xs font-bold text-white hover:bg-red-700 transition"
            >
              <span>Explore Movies</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

