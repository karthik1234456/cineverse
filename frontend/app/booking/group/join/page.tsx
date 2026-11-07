'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Users, AlertCircle, Loader2, LogIn, ArrowRight, ShieldCheck } from 'lucide-react';
import { apiFetch, getShowtimeSeats } from '@/services/api';
import { useCinemaStore } from '@/store/useCinemaStore';

function GroupJoinContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const setActiveGroup = useCinemaStore((s) => s.setActiveGroup);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('cineverse_token');
      setIsAuthenticated(!!stored);
    }
  }, []);

  const handleJoinGroup = async () => {
    if (!token) {
      setError('Missing invite token in URL.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const group = await apiFetch<any>('/groups/join', {
        method: 'POST',
        body: JSON.stringify({ invite_token: token }),
      });

      setActiveGroup(group);

      // Fetch showtime details to get cinema and auditorium for redirection
      let cinemaId = 1;
      let auditoriumId = 1;
      try {
        const st = await getShowtimeSeats(group.showtime_id);
        if (st.cinema_id) cinemaId = st.cinema_id;
        if (st.auditorium_id) auditoriumId = st.auditorium_id;
      } catch {
        // Fallback to defaults
      }

      router.push(`/cinemas/${cinemaId}/auditorium/${auditoriumId}?showtime=${group.showtime_id}&groupId=${group.id}`);
    } catch (err: any) {
      setError(err?.message || 'Failed to join group booking session.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && token) {
      handleJoinGroup();
    }
  }, [isAuthenticated, token]);

  const handleQuickLogin = async (email: string, pass: string) => {
    setAuthLoading(true);
    setError(null);
    try {
      const res = await apiFetch<any>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password: pass }),
      });
      if (res.access_token && typeof window !== 'undefined') {
        localStorage.setItem('cineverse_token', res.access_token);
        localStorage.setItem('cineverse_user', JSON.stringify(res));
        setIsAuthenticated(true);
      }
    } catch (err: any) {
      setError(err?.message || 'Login failed.');
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF8F1] text-[#1B1320] flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl bg-white border border-[#E6DCD2] p-8 shadow-xl text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#C8102E]/10 text-[#C8102E] mb-4">
          <Users className="h-8 w-8" />
        </div>

        <h1 className="text-2xl font-black mb-2">Join Group Booking</h1>
        <p className="text-sm text-slate-600 mb-6">
          You have been invited to pick seats and split payments together with your friends!
        </p>

        {error && (
          <div className="mb-6 rounded-2xl bg-rose-50 border border-rose-200 p-4 text-sm text-rose-800 flex items-start gap-3 text-left">
            <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!isAuthenticated ? (
          <div className="space-y-4 text-left">
            <div className="p-4 rounded-2xl bg-[#FAF6F0] border border-[#E6DCD2] text-xs text-slate-700 space-y-1">
              <span className="font-bold block text-slate-900">Sign In Required</span>
              <p>Please sign in so your friends can see your seat picks and you receive your ticket.</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Email</label>
                <input
                  type="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E6DCD2] text-sm focus:outline-none focus:ring-2 focus:ring-[#C8102E]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Password</label>
                <input
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E6DCD2] text-sm focus:outline-none focus:ring-2 focus:ring-[#C8102E]"
                />
              </div>

              <button
                onClick={() => handleQuickLogin(authEmail, authPassword)}
                disabled={authLoading || !authEmail || !authPassword}
                className="w-full min-h-[48px] rounded-xl bg-[#C8102E] text-white font-bold hover:bg-[#a50d26] transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {authLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
                <span>Sign In & Join Group</span>
              </button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#E6DCD2]" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-slate-500 font-bold">Or Demo One-Click</span>
                </div>
              </div>

              <button
                onClick={() => handleQuickLogin('patron@example.com', 'Patron@123')}
                disabled={authLoading}
                className="w-full min-h-[48px] rounded-xl border border-[#E6DCD2] bg-slate-50 hover:bg-slate-100 text-slate-800 font-bold text-sm transition flex items-center justify-center gap-2"
              >
                <span>Continue as Patron User</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col items-center justify-center p-6 space-y-3">
              <Loader2 className="h-8 w-8 text-[#C8102E] animate-spin" />
              <p className="text-sm font-bold text-slate-700">Connecting you to group room...</p>
            </div>

            <div className="flex items-center justify-center gap-2 text-xs text-emerald-700 bg-emerald-50 py-2.5 px-4 rounded-xl border border-emerald-200">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span>Signed in. Loading your live group seat map.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function GroupJoinPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#FFF8F1] flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-[#C8102E] animate-spin" />
      </div>
    }>
      <GroupJoinContent />
    </Suspense>
  );
}
