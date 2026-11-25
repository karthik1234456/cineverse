'use client';

import React, { useState } from 'react';
import { X, SplitSquareHorizontal, CheckCircle2, ChevronRight } from 'lucide-react';

interface SeatCompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableSeats: string[];
  initialSeats?: string[];
  onSelectSeat?: (seatId: string) => void;
}

export function SeatCompareModal({
  isOpen,
  onClose,
  availableSeats,
  initialSeats = ['E05', 'F06', 'A02'],
  onSelectSeat,
}: SeatCompareModalProps) {
  const [selectedToCompare, setSelectedToCompare] = useState<string[]>(
    initialSeats.slice(0, 3)
  );

  if (!isOpen) return null;

  // Comparison metrics mock
  const comparisonData: Record<string, { view: string; offset: string; score: number; tier: string; verdict: string }> = {
    E05: { view: 'Centred, eye-level at 36° FOV', offset: '2° left', score: 92, tier: 'Prime', verdict: 'Optimal centre view with zero neck strain.' },
    F06: { view: 'Slightly elevated, panoramic', offset: '4° right', score: 88, tier: 'Prime', verdict: 'Balanced distance, ideal for full-screen action.' },
    A02: { view: 'Forward rake, immersive scale', offset: '14° left', score: 68, tier: 'Front', verdict: 'Closer to screen, upward neck angle of ~18°.' },
  };

  const seatsToDisplay = selectedToCompare.map((sId) => ({
    id: sId,
    ...(comparisonData[sId] || {
      view: 'Standard sightline rake',
      offset: '5° offset',
      score: 80,
      tier: 'Standard',
      verdict: 'Good viewing angle across all screen zones.',
    }),
  }));

  // Plain verdict line comparing the options
  const bestSeat = seatsToDisplay.slice().sort((a, b) => b.score - a.score)[0];
  const verdictLine = `${bestSeat.id} (${bestSeat.tier}) offers the most balanced viewing angle and lowest neck inclination compared to other selections.`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="seat-compare-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      data-testid="seat-compare-modal"
    >
      <div className="w-full max-w-4xl bg-white rounded-3xl border border-[#E6DCD2] p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E6DCD2] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-rose-50 text-[#C8102E]">
              <SplitSquareHorizontal className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h3 id="seat-compare-title" className="text-xl font-bold text-[#1B1320]">
                Side-by-Side Seat Sightline Comparison
              </h3>
              <p className="text-sm text-slate-500">
                Compare up to 3 seats with trailer playback in synchronized single-canvas perspective.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 transition min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Close seat comparison"
            data-testid="close-seat-compare-btn"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Comparison Grid (Single Viewport Layout) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4" data-testid="compare-seats-grid">
          {seatsToDisplay.map((s) => (
            <div
              key={s.id}
              className="p-5 rounded-2xl border-2 border-[#E6DCD2] hover:border-[#C8102E] bg-[#FFF8F1] transition space-y-3 relative flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-black text-[#1B1320]">Seat {s.id}</span>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-rose-100 text-[#C8102E]">
                    {s.tier}
                  </span>
                </div>
                <div className="h-32 my-3 rounded-xl bg-slate-900 border border-slate-700 flex flex-col items-center justify-center text-white/70 text-xs text-center p-3">
                  <div className="w-16 h-8 border border-amber-400/60 rounded flex items-center justify-center text-[10px] text-amber-300 font-bold mb-1">
                    SCREEN
                  </div>
                  <span>POV Sightline Simulation</span>
                  <span className="text-[10px] text-slate-400 mt-1">Offset: {s.offset}</span>
                </div>
                <div className="space-y-1 text-xs text-slate-600">
                  <p><span className="font-bold text-[#1B1320]">Field of View:</span> {s.view}</p>
                  <p><span className="font-bold text-[#1B1320]">Viewing Comfort Score:</span> {s.score}/100</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (onSelectSeat) onSelectSeat(s.id);
                  onClose();
                }}
                className="w-full mt-3 min-h-[44px] py-2 rounded-xl bg-white border border-[#E6DCD2] hover:bg-[#C8102E] hover:text-white hover:border-[#C8102E] font-bold text-sm text-[#1B1320] transition shadow-xs flex items-center justify-center gap-1.5"
                data-testid={`select-compared-seat-${s.id}`}
              >
                <span>Select Seat {s.id}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Plain Verdict Line */}
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-sm space-y-1">
          <div className="flex items-center gap-2 text-emerald-800 font-bold">
            <CheckCircle2 className="w-4 h-4" />
            <span>Summary Verdict</span>
          </div>
          <p className="text-emerald-950 font-medium leading-relaxed" data-testid="compare-verdict-line">
            {verdictLine}
          </p>
          <p className="text-[11px] text-slate-500 pt-1">
            Sightline estimates are mathematical approximations based on auditorium geometry. Screen perception may vary with viewer posture and personal preference.
          </p>
        </div>
      </div>
    </div>
  );
}

