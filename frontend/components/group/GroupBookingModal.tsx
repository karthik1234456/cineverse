'use client';

import React, { useState } from 'react';
import { Users, X, Copy, Check, Clock, ShieldCheck, AlertCircle } from 'lucide-react';
import { apiFetch } from '@/services/api';
import { useCinemaStore } from '@/store/useCinemaStore';

interface GroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  showtimeId: number;
}

export function GroupBookingModal({ isOpen, onClose, showtimeId }: GroupModalProps) {
  const [loading, setLoading] = useState(false);
  const [group, setGroup] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [policy, setPolicy] = useState<'AUTO_REFUND' | 'HOST_COVERS'>('AUTO_REFUND');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCreateGroup = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<any>('/groups', {
        method: 'POST',
        body: JSON.stringify({
          showtime_id: showtimeId,
          timeout_policy: policy,
          max_members: 8
        })
      });
      setGroup(res);
      useCinemaStore.getState().setActiveGroup(res);
    } catch (err: any) {
      setError(err?.message || 'Failed to create group session. Please make sure you are signed in.');
    } finally {
      setLoading(false);
    }
  };

  const inviteFullUrl = group ? `${typeof window !== 'undefined' ? window.location.origin : ''}${group.invite_url}` : '';

  const handleCopyLink = () => {
    if (!inviteFullUrl) return;
    navigator.clipboard.writeText(inviteFullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-3xl bg-[#FFF8F1] border border-[#E6DCD2] p-6 shadow-2xl relative text-[#1B1320]">
        <button
          onClick={onClose}
          className="absolute right-5 top-5 p-2 rounded-full hover:bg-black/5 text-slate-500 hover:text-black transition"
          aria-label="Close group booking modal"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#C8102E]/10 text-[#C8102E]">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Book With Friends</h2>
            <p className="text-sm text-slate-600">Pick seats together and split the payment effortlessly</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-800 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!group ? (
          <div className="space-y-4">
            <div className="rounded-2xl bg-white p-4 border border-[#E6DCD2]">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
                Unpaid Timeout Policy
              </span>
              <div className="space-y-2">
                <label className="flex items-start gap-3 p-3 rounded-xl border border-[#E6DCD2] cursor-pointer hover:bg-slate-50 transition">
                  <input
                    type="radio"
                    name="policy"
                    checked={policy === 'AUTO_REFUND'}
                    onChange={() => setPolicy('AUTO_REFUND')}
                    className="mt-1 text-[#C8102E] focus:ring-[#C8102E]"
                  />
                  <div>
                    <div className="text-sm font-bold">Auto-Refund All</div>
                    <div className="text-xs text-slate-500">If anyone doesn&apos;t pay in time, all payments are refunded and seats released.</div>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 rounded-xl border border-[#E6DCD2] cursor-pointer hover:bg-slate-50 transition">
                  <input
                    type="radio"
                    name="policy"
                    checked={policy === 'HOST_COVERS'}
                    onChange={() => setPolicy('HOST_COVERS')}
                    className="mt-1 text-[#C8102E] focus:ring-[#C8102E]"
                  />
                  <div>
                    <div className="text-sm font-bold">Host Covers Remainder</div>
                    <div className="text-xs text-slate-500">Host automatically covers any unpaid shares so seats are never lost.</div>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-600">
              <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Money conservation guaranteed: exact shares in paise, zero payment loss.</span>
            </div>

            <button
              onClick={handleCreateGroup}
              disabled={loading}
              data-testid="create-group-btn"
              className="w-full min-h-[48px] rounded-2xl bg-[#C8102E] text-white font-bold hover:bg-[#a50d26] transition shadow-md disabled:opacity-50"
            >
              {loading ? 'Starting Group Session...' : 'Create Group Session'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl bg-white p-4 border border-[#E6DCD2]">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Share Invite Link
              </span>
              <p className="text-xs text-slate-600 mb-3">Friends who open this link join your group room in real-time.</p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={inviteFullUrl}
                  className="flex-1 rounded-xl bg-slate-50 border border-[#E6DCD2] px-3 py-2 text-xs text-slate-700 font-mono select-all focus:outline-none"
                />
                <button
                  onClick={handleCopyLink}
                  data-testid="copy-group-invite-btn"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-4 border border-[#E6DCD2]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Group Members ({group.members.length}/{group.max_members})
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                  {group.status}
                </span>
              </div>

              <div className="space-y-2">
                {group.members.map((m: any) => (
                  <div key={m.id} className="flex items-center justify-between p-2 rounded-xl bg-[#FAF6F0] border border-[#E6DCD2]/60 text-xs">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black text-white"
                        style={{ backgroundColor: m.color }}
                      >
                        {m.initials}
                      </div>
                      <span className="font-bold">{m.user_name}</span>
                      {m.role === 'HOST' && <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded font-bold">HOST</span>}
                    </div>
                    <span className="font-mono text-slate-600">{m.payment_status}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full min-h-[44px] rounded-2xl bg-slate-100 text-slate-800 font-bold hover:bg-slate-200 transition text-sm"
            >
              Continue to Seat Map
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
