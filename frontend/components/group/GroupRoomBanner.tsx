'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Users, Clock, ShieldCheck, CheckCircle2, Ticket, CreditCard, ChevronRight, AlertCircle, RefreshCw } from 'lucide-react';
import { useCinemaStore } from '@/store/useCinemaStore';
import { apiFetch } from '@/services/api';
import { GroupTicketsModal } from './GroupTicketsModal';

interface GroupRoomBannerProps {
  showtimeId: number;
  onRefreshSeats?: () => void;
}

export function GroupRoomBanner({ showtimeId, onRefreshSeats }: GroupRoomBannerProps) {
  const activeGroup = useCinemaStore((s) => s.activeGroup);
  const setActiveGroup = useCinemaStore((s) => s.setActiveGroup);
  const updateGroupMemberSeats = useCinemaStore((s) => s.updateGroupMemberSeats);
  const selectedSeats = useCinemaStore((s) => s.selectedSeats);

  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [timerAnnouncement, setTimerAnnouncement] = useState<string>('');
  const [isExtending, setIsExtending] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [isTicketsOpen, setIsTicketsOpen] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);

  const currentUserId = useMemo(() => {
    if (typeof window === 'undefined') return 0;
    try {
      const userStr = localStorage.getItem('cineverse_user');
      if (userStr) {
        const u = JSON.parse(userStr);
        return u.user_id || u.id || 0;
      }
    } catch {
      // ignore
    }
    return 0;
  }, []);

  const isHost = activeGroup && activeGroup.host_user_id === currentUserId;
  const currentMember = activeGroup?.members?.find((m: any) => m.user_id === currentUserId);

  // WebSocket sync for real-time presence and group events
  useEffect(() => {
    if (!activeGroup?.id) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const token = localStorage.getItem('cineverse_token') || '';
    const wsUrl = `${protocol}//${host}/api/v1/groups/ws/${activeGroup.id}?token=${token}`;

    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'SEATS_PROPOSED') {
            updateGroupMemberSeats(msg.user_id, msg.seat_ids);
          } else if (msg.type === 'MEMBER_JOINED' || msg.type === 'HOLD_LOCKED' || msg.type === 'HOLD_EXTENDED' || msg.type === 'MEMBER_PAID' || msg.type === 'BOOKING_CONFIRMED' || msg.type === 'GROUP_EXPIRED') {
            // Re-fetch full group state to stay completely in sync
            apiFetch<any>(`/groups/${activeGroup.group_code}`).then((updated) => {
              setActiveGroup(updated);
              if (onRefreshSeats) onRefreshSeats();
            }).catch(() => {});
          }
        } catch {
          // ignore
        }
      };
    } catch {
      // ignore
    }

    return () => {
      if (ws) ws.close();
    };
  }, [activeGroup?.id, activeGroup?.group_code, setActiveGroup, updateGroupMemberSeats, onRefreshSeats]);

  // Propose seats automatically when current user's selectedSeats change in FORMATION
  useEffect(() => {
    if (!activeGroup?.id || activeGroup.status !== 'FORMATION' || selectedSeats.length === 0) return;
    apiFetch(`/groups/${activeGroup.id}/propose-seats`, {
      method: 'POST',
      body: JSON.stringify({ seat_ids: selectedSeats }),
    }).catch(() => {});
  }, [selectedSeats, activeGroup?.id, activeGroup?.status]);

  // Hold expiration countdown
  useEffect(() => {
    if (!activeGroup?.hold_expires_at || (activeGroup.status !== 'HELD' && activeGroup.status !== 'PARTIALLY_PAID')) {
      setTimeLeft(null);
      return;
    }

    const target = new Date(activeGroup.hold_expires_at).getTime();
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((target - Date.now()) / 1000));
      setTimeLeft(remaining);

      // Throttled screen reader announcement at key milestones (WCAG 4.1.3)
      if (remaining === 300 || remaining === 120 || remaining === 60 || remaining === 30) {
        setTimerAnnouncement(`Group seat hold expires in ${formatTimer(remaining)}.`);
      }

      if (remaining <= 0 && (activeGroup.status === 'HELD' || activeGroup.status === 'PARTIALLY_PAID')) {
        // Trigger timeout check on backend
        apiFetch(`/groups/${activeGroup.id}/timeout`, { method: 'POST' })
          .then((updated) => setActiveGroup(updated))
          .catch(() => {});
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeGroup?.hold_expires_at, activeGroup?.id, activeGroup?.status, setActiveGroup]);

  if (!activeGroup) return null;

  const handleHostConfirmHold = async () => {
    setBannerError(null);
    try {
      // Build allocation map
      const allocations: Record<number, string[]> = {};
      for (const m of activeGroup.members) {
        allocations[m.id] = m.proposed_seats && m.proposed_seats.length > 0 ? m.proposed_seats : (m.user_id === currentUserId ? selectedSeats : []);
      }

      // If host only selected via local selectedSeats, ensure host member gets them
      const hostMember = activeGroup.members.find((m: any) => m.role === 'HOST');
      if (hostMember && (!allocations[hostMember.id] || allocations[hostMember.id].length === 0)) {
        allocations[hostMember.id] = selectedSeats;
      }

      const updated = await apiFetch<any>(`/groups/${activeGroup.id}/confirm`, {
        method: 'POST',
        body: JSON.stringify({ seat_allocations: allocations }),
      });
      setActiveGroup(updated);
      if (onRefreshSeats) onRefreshSeats();
    } catch (err: any) {
      setBannerError(err?.message || 'Failed to lock seats and initiate hold.');
    }
  };

  const handleExtendHold = async () => {
    setIsExtending(true);
    setBannerError(null);
    try {
      await apiFetch(`/groups/${activeGroup.id}/extend`, { method: 'POST' });
      const updated = await apiFetch<any>(`/groups/${activeGroup.group_code}`);
      setActiveGroup(updated);
    } catch (err: any) {
      setBannerError(err?.message || 'Could not extend hold.');
    } finally {
      setIsExtending(false);
    }
  };

  const handlePayShare = async () => {
    if (!currentMember) return;
    setIsPaying(true);
    setBannerError(null);
    try {
      // Create Razorpay order
      const order = await apiFetch<any>(`/groups/${activeGroup.id}/order`, { method: 'POST' });
      // Simulate/complete payment capture with exact share in paise
      const updated = await apiFetch<any>(`/groups/${activeGroup.id}/pay-share`, {
        method: 'POST',
        body: JSON.stringify({
          payment_id: `pay_grp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          amount_paise: order.amount_paise,
        }),
      });
      setActiveGroup(updated);
      if (onRefreshSeats) onRefreshSeats();
    } catch (err: any) {
      setBannerError(err?.message || 'Payment failed.');
    } finally {
      setIsPaying(false);
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <>
      <aside aria-label="Group booking session banner" className="rounded-3xl border border-[#E6DCD2] bg-white p-4 shadow-sm space-y-3 mb-4 text-[#1B1320]" data-testid="group-room-banner">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#C8102E]/10 text-[#C8102E]">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm">{activeGroup.group_code}</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  {activeGroup.status}
                </span>
                <span className="text-[11px] font-semibold text-slate-500">
                  Policy: {activeGroup.timeout_policy === 'HOST_COVERS' ? 'Host Covers' : 'Auto-Refund All'}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {activeGroup.status === 'FORMATION' && 'Friends picking seats in real-time. Host finalizes.'}
                {(activeGroup.status === 'HELD' || activeGroup.status === 'PARTIALLY_PAID') && 'Seats held. Each member pays their exact share.'}
                {activeGroup.status === 'CONFIRMED' && 'All members paid! Bookings and individual tickets confirmed.'}
                {activeGroup.status === 'EXPIRED' && 'Session expired. Payments refunded and seats released.'}
              </p>
            </div>
          </div>

          {/* Members Roster Pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-400 mr-1">Roster:</span>
            {activeGroup.members?.map((m: any) => (
              <div
                key={m.id}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[#E6DCD2] bg-[#FAF6F0] text-xs font-bold"
                title={`${m.user_name} (${m.role}) — ${m.payment_status}`}
              >
                <span
                  className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-black text-white"
                  style={{ backgroundColor: m.color }}
                >
                  {m.initials}
                </span>
                <span className="text-slate-800">{m.user_name.split(' ')[0]}</span>
                {m.payment_status === 'PAID' && (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                )}
              </div>
            ))}
          </div>
        </div>

        {bannerError && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            <span>{bannerError}</span>
          </div>
        )}

        {/* Action Controls by Status */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E6DCD2]/60 pt-3">
          {activeGroup.status === 'FORMATION' && (
            <>
              <div className="text-xs text-slate-600">
                Select your seats on the map. All members can see your picks with your initials.
              </div>
              {isHost ? (
                <button
                  onClick={handleHostConfirmHold}
                  data-testid="lock-and-split-btn"
                  className="flex min-h-[44px] items-center gap-2 px-5 py-2 rounded-xl bg-[#C8102E] text-white font-bold text-sm shadow hover:bg-[#a50d26] transition active:scale-95"
                >
                  <ShieldCheck className="h-4 w-4" />
                  <span>Lock Selection & Split Payment</span>
                </button>
              ) : (
                <span className="text-xs font-semibold text-slate-500 italic">
                  Waiting for host to lock seats...
                </span>
              )}
            </>
          )}

          {(activeGroup.status === 'HELD' || activeGroup.status === 'PARTIALLY_PAID') && (
            <>
              <div className="flex items-center gap-3">
                {timeLeft !== null && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 font-mono text-xs font-bold">
                    <Clock className="h-3.5 w-3.5 text-amber-700 animate-pulse" />
                    <span>Hold Expires: {formatTimer(timeLeft)}</span>
                  </div>
                )}
                {isHost && activeGroup.hold_extended_count < 1 && (
                  <button
                    onClick={handleExtendHold}
                    disabled={isExtending}
                    data-testid="extend-group-hold-btn"
                    className="flex min-h-[40px] items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E6DCD2] bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition"
                  >
                    <RefreshCw className={`h-3 w-3 ${isExtending ? 'animate-spin' : ''}`} />
                    <span>Extend Hold (+5m)</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3">
                {currentMember && currentMember.payment_status === 'PAID' ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Your share (₹{currentMember.share_amount.toFixed(2)}) is Paid</span>
                  </span>
                ) : currentMember ? (
                  <button
                    onClick={handlePayShare}
                    disabled={isPaying}
                    data-testid="pay-group-share-btn"
                    className="flex min-h-[44px] items-center gap-2 px-5 py-2 rounded-xl bg-emerald-700 text-white font-bold text-sm shadow hover:bg-emerald-800 transition active:scale-95 disabled:opacity-50"
                  >
                    <CreditCard className="h-4 w-4" />
                    <span>{isPaying ? 'Processing...' : `Pay My Share (₹${currentMember.share_amount.toFixed(2)})`}</span>
                  </button>
                ) : null}
              </div>
            </>
          )}

          {activeGroup.status === 'CONFIRMED' && (
            <>
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                <span>Group Booking Confirmed. All shares paid and tickets issued!</span>
              </div>
              <button
                onClick={() => setIsTicketsOpen(true)}
                data-testid="view-group-tickets-btn"
                className="flex min-h-[44px] items-center gap-2 px-5 py-2 rounded-xl bg-[#C8102E] text-white font-bold text-sm shadow hover:bg-[#a50d26] transition active:scale-95"
              >
                <Ticket className="h-4 w-4" />
                <span>View Member Tickets & QR</span>
              </button>
            </>
          )}
        </div>
      </aside>

      <GroupTicketsModal
        isOpen={isTicketsOpen}
        onClose={() => setIsTicketsOpen(false)}
        groupId={activeGroup.id}
      />

      {/* Screen Reader Hold Timer Milestone Announcements */}
      <div role="status" aria-live="polite" className="sr-only">
        {timerAnnouncement}
      </div>
    </>
  );
}
