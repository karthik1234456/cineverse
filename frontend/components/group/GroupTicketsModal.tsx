'use client';

import React, { useState, useEffect } from 'react';
import { X, Ticket, QrCode, ShieldCheck, CheckCircle2, Download, Printer } from 'lucide-react';
import { apiFetch } from '@/services/api';

interface GroupTicketsModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: number;
}

export function GroupTicketsModal({ isOpen, onClose, groupId }: GroupTicketsModalProps) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    apiFetch<any[]>(`/groups/${groupId}/tickets`)
      .then((data) => setTickets(data))
      .catch((err) => setError(err?.message || 'Failed to load member tickets'))
      .finally(() => setLoading(false));
  }, [isOpen, groupId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl rounded-3xl bg-[#FFF8F1] border border-[#E6DCD2] p-6 shadow-2xl relative text-[#1B1320] max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute right-5 top-5 p-2 rounded-full hover:bg-black/5 text-slate-500 hover:text-black transition"
          aria-label="Close group tickets modal"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800">
            <Ticket className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Group Booking Tickets</h2>
            <p className="text-sm text-slate-600">Individual QR tickets with Ed25519 offline verification</p>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm font-semibold text-slate-600">
            Loading your tickets...
          </div>
        ) : error ? (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-sm text-rose-800 mb-4">
            {error}
          </div>
        ) : tickets.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-600">
            No tickets found for this group booking session.
          </div>
        ) : (
          <div className="space-y-4">
            {tickets.map((t) => (
              <div
                key={t.member_id}
                className="rounded-2xl bg-white border border-[#E6DCD2] p-5 shadow-sm space-y-4"
              >
                <div className="flex items-start justify-between border-b border-[#E6DCD2]/70 pb-3">
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                      Ticket Holder
                    </span>
                    <h3 className="text-base font-extrabold text-[#1B1320]">{t.user_name}</h3>
                  </div>
                  <span className="text-xs font-mono px-2 py-1 rounded-md bg-slate-100 text-slate-700 font-bold border border-slate-200">
                    {t.ticket_number}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-500 block mb-0.5">Movie</span>
                    <span className="font-bold text-slate-800">{t.movie_title}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-0.5">Cinema</span>
                    <span className="font-bold text-slate-800">{t.cinema_name}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-0.5">Assigned Seats</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {t.seats.map((s: string) => (
                        <span key={s} className="px-2 py-0.5 rounded bg-[#C8102E] text-white font-extrabold text-xs">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-0.5">Payment</span>
                    <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Paid & Confirmed
                    </span>
                  </div>
                </div>

                {t.qr_code_url && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-[#FAF6F0] border border-[#E6DCD2]/80">
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`data:image/png;base64,${t.qr_code_url}`}
                        alt={`QR code for ticket ${t.ticket_number}`}
                        className="h-24 w-24 rounded-lg border border-[#E6DCD2] bg-white p-1"
                      />
                      <div className="text-xs text-slate-600 space-y-1">
                        <div className="flex items-center gap-1 text-slate-900 font-bold">
                          <ShieldCheck className="h-4 w-4 text-emerald-600" />
                          <span>Turnstile Verified</span>
                        </div>
                        <p>Scan this QR at the cinema scanner for contact-free entry.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#E6DCD2] bg-white hover:bg-slate-50 text-sm font-bold text-slate-800 transition"
          >
            <Printer className="h-4 w-4" />
            <span>Print Tickets</span>
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-[#C8102E] text-white text-sm font-bold hover:bg-[#a50d26] transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
