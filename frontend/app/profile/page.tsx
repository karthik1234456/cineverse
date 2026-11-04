// app/profile/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Ticket, MapPin, LogOut, Share2, Sparkles, Send, ChevronRight
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
      setTransferMsg(`Error: ${err.message}`);
    }
  }

  function handleLogout() {
    logoutUser();
    router.push('/');
  }

  const now = new Date();
  const filteredBookings = bookings.filter((b) => {
    if (activeTab === 'cancelled') return b.status === 'CANCELLED';
    if (activeTab === 'upcoming') return b.status === 'CONFIRMED' && new Date(b.start_time) >= now;
    return true; // all
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8 w-full text-[#1B1320] space-y-8">
      {/* Profile Header */}
      <div className="rounded-3xl border border-[#E6DCD2] bg-white p-7 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-5 text-center sm:text-left">
          <div className="h-16 w-16 rounded-full bg-rose-50 border-2 border-[#C8102E] flex items-center justify-center text-2xl font-black text-[#C8102E]">
            {currentUser?.full_name ? currentUser.full_name.charAt(0) : 'P'}
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#1B1320]">
              {currentUser?.full_name || 'CineVerse Patron'}
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Role: <span className="text-[#1B1320] capitalize font-bold">{currentUser?.role || 'Customer'}</span> • {loyalty ? `${loyalty.tier} Member` : 'CineVerse Rewards'}
            </p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex min-h-[44px] items-center gap-2 rounded-xl border border-[#E6DCD2] bg-[#FAF6F0] px-5 py-2.5 text-sm font-bold text-slate-700 hover:text-[#C8102E] hover:bg-rose-50 transition shadow-sm"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign Out</span>
        </button>
      </div>

      {/* Loyalty & CinePass Section */}
      {loyalty && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Points & Tier Card */}
          <div className="rounded-3xl border border-[#E6DCD2] bg-white p-6 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">LOYALTY BALANCE</span>
              <span className="rounded-full bg-amber-50 border border-amber-300 px-3 py-1 text-xs font-bold text-amber-900">
                {loyalty.tier}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-[#1B1320]">{loyalty.points_balance}</span>
              <span className="text-sm text-slate-500">pts (₹{(loyalty.points_balance * 0.5).toFixed(0)} value)</span>
            </div>
            <p className="text-xs text-slate-600">
              Earn 1 pt per ₹10 spent. Redeem 100 pts for ₹50 at checkout.
            </p>
          </div>

          {/* CinePass Subscription Card */}
          <div className="rounded-3xl border border-[#E6DCD2] bg-white p-6 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">CINEPASS PASS</span>
              <Sparkles className="h-5 w-5 text-[#C8102E]" />
            </div>
            {loyalty.cinepass ? (
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-emerald-700 font-bold">Active Subscription</span>
                  <span className="text-slate-600">{loyalty.cinepass.tickets_remaining} tickets left</span>
                </div>
                <button
                  onClick={handleCancelCinePass}
                  className="text-xs text-slate-500 hover:text-rose-600 underline"
                >
                  Cancel subscription (No dark patterns)
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-700">4 movie admissions / month for only ₹899.</p>
                <button
                  onClick={handleSubscribeCinePass}
                  className="rounded-xl bg-[#C8102E] hover:bg-[#A60D26] px-4 py-2 text-sm font-bold text-white transition shadow-sm"
                >
                  Join CinePass
                </button>
              </div>
            )}
          </div>

          {/* Referral Card */}
          <div className="rounded-3xl border border-[#E6DCD2] bg-white p-6 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">INVITE FRIENDS</span>
              <Share2 className="h-5 w-5 text-slate-400" />
            </div>
            <div>
              <span className="text-xs text-slate-500 block">YOUR REFERRAL CODE</span>
              <span className="font-mono text-lg font-bold text-[#1B1320] select-all">{loyalty.referral_code}</span>
            </div>
            <form onSubmit={handleClaimReferral} className="flex gap-2">
              <input
                type="text"
                placeholder="Enter referral code"
                value={referralInput}
                onChange={(e) => setReferralInput(e.target.value)}
                className="flex-1 rounded-xl bg-[#FAF6F0] border border-[#E6DCD2] px-3 py-1.5 text-sm text-[#1B1320] uppercase font-mono"
              />
              <button
                type="submit"
                className="rounded-xl bg-slate-100 hover:bg-slate-200 px-3.5 py-1.5 text-sm font-bold text-[#1B1320] transition border border-[#E6DCD2]"
              >
                Claim
              </button>
            </form>
            {referralMsg && <p className="text-xs text-amber-800 font-semibold">{referralMsg}</p>}
          </div>
        </div>
      )}

      {/* Bookings Section */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E6DCD2] pb-4">
          <div>
            <h2 className="text-2xl font-black text-[#1B1320]">Your Bookings & E-Tickets</h2>
            <p className="text-sm text-slate-600 mt-0.5">Show these digital QR passes at cinema turnstiles for entry</p>
          </div>

          <div className="flex rounded-2xl bg-white p-1 border border-[#E6DCD2] shadow-sm">
            <button
              onClick={() => setActiveTab('upcoming')}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                activeTab === 'upcoming' ? 'bg-[#C8102E] text-white shadow' : 'text-slate-600 hover:text-[#1B1320]'
              }`}
            >
              Upcoming
            </button>
            <button
              onClick={() => setActiveTab('all')}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                activeTab === 'all' ? 'bg-[#C8102E] text-white shadow' : 'text-slate-600 hover:text-[#1B1320]'
              }`}
            >
              All Shows
            </button>
            <button
              onClick={() => setActiveTab('cancelled')}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                activeTab === 'cancelled' ? 'bg-[#C8102E] text-white shadow' : 'text-slate-600 hover:text-[#1B1320]'
              }`}
            >
              Cancelled
            </button>
          </div>
        </div>

        {/* Bookings Cards List */}
        {loading ? (
          <div className="p-12 text-center text-slate-600">Loading your reservations...</div>
        ) : filteredBookings.length > 0 ? (
          <div className="space-y-4">
            {filteredBookings.map((b) => (
              <div
                key={b.id}
                className="flex flex-col md:flex-row items-start md:items-center justify-between rounded-3xl border border-[#E6DCD2] bg-white p-6 gap-4 shadow-sm hover:shadow-md transition group"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      {b.booking_code}
                    </span>
                    <span className={`rounded-md px-2.5 py-0.5 text-xs font-bold ${
                      b.status === 'CONFIRMED'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}>
                      {b.status}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-[#1B1320] group-hover:text-[#C8102E] transition">
                    {b.movie_title}
                  </h3>

                  <p className="text-sm text-slate-600 flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-slate-400" />
                    <span>{b.cinema_name} • {b.auditorium_name}</span>
                  </p>

                  <div className="text-sm font-semibold text-slate-700">
                    {new Date(b.start_time).toLocaleString('en-US', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true,
                    })}
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    {b.seats.map((s) => (
                      <span key={s.seat_id} className="rounded-lg bg-[#FAF6F0] border border-[#E6DCD2] px-2.5 py-1 text-xs font-bold text-slate-800">
                        {s.seat_id} ({s.category})
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-5 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 border-[#E6DCD2] pt-4 md:pt-0">
                  <div className="text-right">
                    <div className="text-xs text-slate-500 font-bold uppercase">PAID</div>
                    <div className="text-xl font-black text-[#C8102E]">₹{b.final_total_amount}</div>
                  </div>

                  <div className="flex items-center gap-3">
                    {b.status === 'CONFIRMED' && new Date(b.start_time) >= now && (
                      <button
                        onClick={() => {
                          setTransferringTicketId(b.id);
                          setRecipientEmail('');
                          setTransferMsg(null);
                        }}
                        className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#E6DCD2] bg-[#FAF6F0] hover:bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 transition shadow-sm"
                      >
                        <Send className="h-4 w-4" />
                        <span>Transfer</span>
                      </button>
                    )}

                    <Link
                      href={`/booking/${b.id}`}
                      className="flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[#C8102E] px-5 py-2 text-sm font-bold text-white hover:bg-[#A60D26] transition shadow-sm"
                    >
                      <span>View E-Ticket</span>
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-[#E6DCD2] bg-white p-12 text-center text-slate-600 shadow-sm">
            <Ticket className="mx-auto h-10 w-10 text-slate-400 mb-3" />
            <p className="text-lg font-bold text-[#1B1320]">No bookings found in this category</p>
            <p className="text-sm mt-1">Book your next movie experience inside our 3D auditorium</p>
            <Link
              href="/movies"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#C8102E] px-6 py-3 text-sm font-bold text-white hover:bg-[#A60D26] transition shadow"
            >
              <span>Explore Movies</span>
            </Link>
          </div>
        )}
      </div>

      {/* Transfer Ticket Modal */}
      {transferringTicketId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-[#E6DCD2] bg-white p-7 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E6DCD2] pb-3">
              <h3 className="text-lg font-bold text-[#1B1320] flex items-center gap-2">
                <Send className="h-5 w-5 text-[#C8102E]" />
                <span>Transfer Ticket</span>
              </h3>
              <button
                onClick={() => setTransferringTicketId(null)}
                className="text-slate-500 hover:text-[#1B1320] text-sm font-bold"
              >
                Cancel
              </button>
            </div>

            <p className="text-sm text-slate-600">
              Transfer this ticket safely to a registered friend. The original QR pass will be permanently invalidated, and a new signed QR code will be generated for the recipient.
            </p>

            <form onSubmit={handleTransferSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-bold text-slate-700 block mb-1">
                  Recipient CineVerse Email
                </label>
                <input
                  type="email"
                  required
                  placeholder="friend@cineverse.in"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  className="w-full min-h-[48px] rounded-xl bg-[#FAF6F0] border border-[#E6DCD2] px-3.5 py-2 text-sm text-[#1B1320] focus:ring-2 focus:ring-[#C8102E] focus:outline-none"
                />
              </div>

              {transferMsg && (
                <div className={`p-3 rounded-xl text-sm font-medium ${
                  transferMsg.includes('successfully') ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}>
                  {transferMsg}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setTransferringTicketId(null)}
                  className="flex-1 min-h-[44px] rounded-xl bg-slate-100 hover:bg-slate-200 text-sm font-bold text-slate-700 transition"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="flex-1 min-h-[44px] rounded-xl bg-[#C8102E] hover:bg-[#A60D26] text-sm font-bold text-white transition shadow"
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
