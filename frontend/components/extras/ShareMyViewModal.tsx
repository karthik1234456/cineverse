'use client';

import React, { useState } from 'react';
import { X, Share2, Copy, Download, Check, ShieldCheck } from 'lucide-react';

interface ShareMyViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  seatId: string;
  movieTitle?: string;
  cinemaName?: string;
  auditoriumName?: string;
  showtime?: string;
}

export function ShareMyViewModal({
  isOpen,
  onClose,
  seatId,
  movieTitle = 'Quantum Odyssey',
  cinemaName = 'CineVerse Astral Koramangala',
  auditoriumName = 'Auditorium 1 (IMAX Laser)',
  showtime = 'Today, 7:30 PM',
}: ShareMyViewModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    const text = `Checked out the view from Seat ${seatId} for ${movieTitle} at ${cinemaName}! Experience the theatre in 3D: https://cineverse.in/cinemas/1/auditorium/1?seat=${seatId}`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-view-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      data-testid="share-my-view-modal"
    >
      <div className="w-full max-w-lg bg-white rounded-3xl border border-[#E6DCD2] p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E6DCD2] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-rose-50 text-[#C8102E]">
              <Share2 className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h3 id="share-view-title" className="text-xl font-bold text-[#1B1320]">
                Share My Seat Sightline View
              </h3>
              <p className="text-xs text-slate-500">
                Direct POV snapshot with movie and show captions (zero personal data).
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 transition min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Close share view modal"
            data-testid="close-share-view-btn"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Snapshot Card Preview (Zero Personal Data / PII) */}
        <div
          className="rounded-2xl border-2 border-[#E6DCD2] bg-gradient-to-b from-[#1B1320] to-[#0A070D] p-5 text-white space-y-4 shadow-inner"
          data-testid="share-view-snapshot-card"
        >
          {/* Simulated Screen View */}
          <div className="h-44 rounded-xl bg-black border border-white/20 flex flex-col items-center justify-center text-center p-4 relative overflow-hidden">
            <div className="w-48 h-10 border border-amber-400/80 rounded-md flex items-center justify-center bg-amber-400/10 text-xs font-bold text-amber-300 shadow-md">
              THEATRE SCREEN
            </div>
            <span className="text-[11px] text-slate-400 mt-3">Eye-Level POV from Seat {seatId}</span>
            <div className="absolute top-3 left-3 bg-white/10 px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white tracking-widest uppercase">
              CINEVERSE 3D POV
            </div>
          </div>

          {/* Clean metadata captions */}
          <div className="space-y-1 text-sm border-t border-white/10 pt-3">
            <div className="flex items-center justify-between font-black text-base text-white">
              <span>{movieTitle}</span>
              <span className="text-[#C8102E] bg-white px-2 py-0.5 rounded-md font-bold text-xs">Seat {seatId}</span>
            </div>
            <p className="text-xs text-slate-300">{cinemaName} • {auditoriumName}</p>
            <p className="text-xs text-slate-400">{showtime}</p>
          </div>

          {/* Privacy badge */}
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium pt-1">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>DPDP Privacy Safe: Contains zero customer names, account IDs, or personal data.</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={handleCopy}
            className="flex-1 flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#FAF6F0] border border-[#E6DCD2] px-4 py-2.5 text-sm font-bold text-[#1B1320] hover:bg-rose-50 hover:border-[#C8102E] transition"
            data-testid="copy-share-view-link-btn"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Link Copied!' : 'Copy Share Link'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              alert(`Downloaded POV snapshot for Seat ${seatId}`);
              onClose();
            }}
            className="flex-1 flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#C8102E] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#A60D26] transition shadow"
            data-testid="download-share-view-btn"
          >
            <Download className="w-4 h-4" />
            <span>Download Card</span>
          </button>
        </div>
      </div>
    </div>
  );
}

