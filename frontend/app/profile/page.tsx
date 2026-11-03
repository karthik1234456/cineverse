// app/profile/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Ticket, User as UserIcon, Calendar, MapPin,
  Clock, ShieldCheck, ChevronRight, XCircle, LogOut,
  Award, Share2, Sparkles, Send
} from 'lucide-react';
import {
  getMyBookings, getStoredUser, logoutUser,
  getLoyaltyAccount, subscribeCinePass, cancelCinePass, claimReferral, transferTicket,
  type BookingResponse
} from '@/services/api';

export default function ProfilePage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [bookings, setBookings] = useState<BookingResponse[]>([]);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'all' | 'cancelled'>('upcoming');
  const [loading, setLoading] = useState(true);

  // Loyalty & CinePass state
  const [loyalty, setLoyalty] = useState<any | null>(null);
  const [referralInput, setReferralInput] = useState<string>('');
  const [referralMsg, setReferralMsg] = useState<string | null>(null);

  // Ticket Transfer modal state
  const [transferringTicketId, setTransferringTicketId] = useState<number | null>(null);
  const [recipientEmail, setRecipientEmail] = useState<string>('');
  const [transferMsg, setTransferMsg] = useState<string | null>(null);

  useEffect(() => {
    const user = getStoredUser();
    setCurrentUser(user);

    getMyBookings()
      .then((data) => setBookings(data))
      .catch((err) => console.warn(err))
      .finally(() => setLoading(false));

    loadLoyalty();
  }, []);

  async function loadLoyalty() {
    try {
      const data = await getLoyaltyAccount();
      setLoyalty(data);
    } catch {
      // not logged in or offline
    }
  }

  async function handleSubscribeCinePass() {
    try {
      await subscribeCinePass();
      loadLoyalty();
      alert('Congratulations! CinePass subscribed. You have 4 free movie tickets this month.');
    } catch (err: any) {
      alert(err.message || 'Subscription failed');
    }
  }

  async function handleCancelCinePass() {
    if (!confirm('Are you sure you want to cancel your CinePass subscription? You will retain benefits until period end.')) return;
    try {
      await cancelCinePass();
      loadLoyalty();
    } catch (err: any) {
      alert(err.message || 'Cancellation failed');
    }
  }

  async function handleClaimReferral(e: React.FormEvent) {
    e.preventDefault();
    if (!referralInput.trim()) return;
    try {
      const res = await claimReferral(referralInput.trim());
      setReferralMsg(`Success! Awarded ${res.points_awarded} loyalty points.`);
      setReferralInput('');
      loadLoyalty();
    } catch (err: any) {
      setReferralMsg(`Error: ${err.message}`);
    }
  }

  async function handleTransferSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!transferringTicketId || !recipientEmail.trim()) return;
    try {
      const res = await transferTicket(transferringTicketId, recipientEmail.trim());
      setTransferMsg(`Ticket transferred successfully to ${recipientEmail}!`);
      setTimeout(() => {
        setTransferringTicketId(null);
        setRecipientEmail('');
        setTransferMsg(null);
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      setTransferMsg(`Transfer failed: ${err.message}`);
    }
  }

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
              Role: <span className="text-zinc-200 capitalize font-medium">{currentUser?.role || 'Customer'}</span> • {loyalty ? `${loyalty.tier} Member` : 'CineVerse Rewards'}
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

      {/* Loyalty & CinePass Section */}
      {loyalty && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Points & Tier Card */}
          <div className="rounded-2xl border border-white/10 bg-[#12131a] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-400">LOYALTY BALANCE</span>
              <span className="rounded-full bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                {loyalty.tier}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-white">{loyalty.points_balance}</span>
              <span className="text-xs text-zinc-400">pts (₹{(loyalty.points_balance * 0.5).toFixed(0)} value)</span>
            </div>
            <p className="text-[11px] text-zinc-400">
              Earn 1 pt per ₹10 spent. Redeem 100 pts for ₹50 at checkout.
            </p>
          </div>

          {/* CinePass Subscription Card */}
          <div className="rounded-2xl border border-white/10 bg-[#12131a] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-400">CINEPASS PASS</span>
              <Sparkles className="h-4 w-4 text-red-500" />
            </div>
            {loyalty.cinepass ? (
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-emerald-400 font-bold">ACTIVE SUBSCRIPTION</span>
                  <span className="text-zinc-400">{loyalty.cinepass.tickets_remaining} tickets left</span>
                </div>
                <button
                  onClick={handleCancelCinePass}
                  className="text-[11px] text-zinc-400 hover:text-red-400 underline"
                >
                  Cancel subscription (No dark patterns)
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-zinc-300">4 movie admissions / month for only ₹899.</p>
                <button
                  onClick={handleSubscribeCinePass}
                  className="rounded-xl bg-red-600 hover:bg-red-700 px-3 py-1.5 text-xs font-bold text-white transition"
                >
                  Join CinePass
                </button>
              </div>
            )}
          </div>

          {/* Referral Card */}
          <div className="rounded-2xl border border-white/10 bg-[#12131a] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-400">INVITE FRIENDS</span>
              <Share2 className="h-4 w-4 text-zinc-400" />
            </div>
            <div>
              <span className="text-[10px] text-zinc-500 block">YOUR REFERRAL CODE</span>
              <span className="font-mono text-base font-bold text-white select-all">{loyalty.referral_code}</span>
            </div>
            <form onSubmit={handleClaimReferral} className="flex gap-1.5">
              <input
                type="text"
                placeholder="Enter referral code"
                value={referralInput}
                onChange={(e) => setReferralInput(e.target.value)}
                className="flex-1 rounded-lg bg-black/40 border border-white/15 px-2.5 py-1 text-xs text-white uppercase font-mono"
              />
              <button
                type="submit"
                className="rounded-lg bg-white/10 hover:bg-white/20 px-2.5 py-1 text-xs font-bold text-white transition"
              >
                Claim
              </button>
            </form>
            {referralMsg && <p className="text-[10px] text-amber-300">{referralMsg}</p>}
          </div>
        </div>
      )}

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

                  <div className="flex items-center gap-2">
                    {b.status === 'CONFIRMED' && new Date(b.start_time) >= now && (
                      <button
                        onClick={() => {
                          setTransferringTicketId(b.id);
                          setRecipientEmail('');
                          setTransferMsg(null);
                        }}
                        className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2 text-xs font-semibold text-zinc-300 hover:text-white transition"
                      >
                        <Send className="h-3.5 w-3.5" />
                        <span>Transfer</span>
                      </button>
                    )}

                    <Link
                      href={`/booking/${b.id}`}
                      className="flex items-center gap-1.5 rounded-xl bg-[#e50914] px-4 py-2 text-xs font-bold text-white hover:bg-red-700 transition"
                    >
                      <span>View E-Ticket</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
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

      {/* Transfer Ticket Modal */}
      {transferringTicketId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#161822] p-6 space-y-4 shadow-2xl animate-fadeIn">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Send className="h-4 w-4 text-red-500" />
                <span>Transfer Ticket</span>
              </h3>
              <button
                onClick={() => setTransferringTicketId(null)}
                className="text-zinc-400 hover:text-white text-xs"
              >
                Cancel
              </button>
            </div>

            <p className="text-xs text-zinc-300">
              Transfer this ticket safely to a registered friend. The original QR pass will be permanently invalidated, and a new signed QR code will be generated for the recipient.
            </p>

            <form onSubmit={handleTransferSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-1">
                  Recipient CineVerse Email
                </label>
                <input
                  type="email"
                  required
                  placeholder="friend@cineverse.in"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  className="w-full rounded-xl bg-black/40 border border-white/15 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
                />
              </div>

              {transferMsg && (
                <div className={`p-2.5 rounded-lg text-xs ${
                  transferMsg.includes('successfully') ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/30' : 'bg-red-950/40 text-red-300 border border-red-500/30'
                }`}>
                  {transferMsg}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTransferringTicketId(null)}
                  className="flex-1 rounded-xl bg-white/10 hover:bg-white/20 py-2 text-xs font-semibold text-zinc-300 transition"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-red-600 hover:bg-red-700 py-2 text-xs font-bold text-white transition"
                >
                  Confirm Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

