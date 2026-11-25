// frontend/components/CancellationModal.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { X, AlertCircle, ShieldAlert, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';
import {
  getCancellationQuote, cancelBooking,
  type CancellationQuoteResponse
} from '@/services/api';

interface CancellationModalProps {
  bookingId: number;
  bookingCode: string;
  movieTitle?: string;
  onClose: () => void;
  onSuccess: (result: any) => void;
}

export default function CancellationModal({
  bookingId,
  bookingCode,
  movieTitle,
  onClose,
  onSuccess,
}: CancellationModalProps) {
  const [quote, setQuote] = useState<CancellationQuoteResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    getCancellationQuote(bookingId)
      .then((data) => {
        if (isMounted) setQuote(data);
      })
      .catch((err) => {
        if (isMounted) setError(err.message || 'Failed to retrieve cancellation policy and quote.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [bookingId]);

  async function handleConfirm() {
    if (isSubmitting) return; // Guard against rapid duplicate clicks
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await cancelBooking(bookingId);
      onSuccess(res);
    } catch (err: any) {
      setError(err.message || 'Cancellation could not be completed. Please try again.');
      setIsSubmitting(false);
    }
  }

  const breakdown = quote?.breakdown;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in"
    >
      <div className="w-full max-w-lg rounded-3xl border border-[#E6DCD2] bg-white p-6 sm:p-8 space-y-5 shadow-2xl my-auto text-[#1B1320]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E6DCD2] pb-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-rose-600 block">
              Ticket Cancellation
            </span>
            <h3 id="cancel-modal-title" className="text-xl font-black text-[#1B1320] flex items-center gap-2 mt-0.5">
              <span>Cancel {bookingCode}</span>
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close cancellation dialog"
            className="rounded-full p-2 text-slate-400 hover:text-[#1B1320] hover:bg-slate-100 transition disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {movieTitle && (
          <p className="text-sm font-semibold text-slate-700">
            Movie: <span className="text-[#1B1320] font-bold">{movieTitle}</span>
          </p>
        )}

        {/* Loading state */}
        {loading && (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-500">
            <Loader2 className="h-7 w-7 animate-spin text-[#C8102E]" />
            <span className="text-sm font-semibold">Calculating exact refund quote in paise...</span>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 flex items-start gap-2.5">
            <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            <p className="font-medium">{error}</p>
          </div>
        )}

        {/* Policy & Breakdown Content */}
        {!loading && quote && (
          <>
            {/* If Ineligible */}
            {!quote.can_cancel ? (
              <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-950">
                  <ShieldAlert className="h-5 w-5 text-amber-700" />
                  <span>Cancellation Unavailable</span>
                </div>
                <p className="text-xs text-amber-900">
                  {quote.reason_ineligible || 'This booking cannot be cancelled per cinema operations policy.'}
                </p>
                <button
                  onClick={onClose}
                  className="mt-3 w-full rounded-xl bg-amber-800 text-white font-bold py-2.5 text-sm hover:bg-amber-900 transition"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                {/* Plain-Language Policy Line */}
                <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 text-xs sm:text-sm text-rose-950 leading-relaxed font-medium">
                  {quote.policy_text}
                </div>

                {/* Exact Breakdown Table */}
                {breakdown && (
                  <div className="rounded-2xl border border-[#E6DCD2] bg-[#FAF6F0] p-4 space-y-2.5 text-xs text-slate-700">
                    <div className="font-bold text-[#1B1320] text-sm border-b border-[#E6DCD2] pb-2 flex justify-between">
                      <span>Item</span>
                      <span>Refund Credit</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">
                        Ticket Base ({breakdown.ticket_amount_display})
                      </span>
                      <span className="font-bold text-emerald-700">
                        +{breakdown.ticket_refund_display} <span className="text-[10px] text-slate-500 font-normal">(75%)</span>
                      </span>
                    </div>

                    {breakdown.addons_amount_paise > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600">
                          Pre-booked F&B ({breakdown.addons_amount_display})
                        </span>
                        <span className="font-bold text-emerald-700">
                          +{breakdown.addons_refund_display} <span className="text-[10px] text-slate-500 font-normal">(100%)</span>
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between items-center text-slate-500">
                      <span>Convenience Fee & Taxes ({breakdown.convenience_fee_display} + {breakdown.gst_amount_display})</span>
                      <span className="font-medium text-slate-400">Non-refundable</span>
                    </div>

                    <div className="flex justify-between items-center text-rose-700">
                      <span>Cancellation Charge</span>
                      <span className="font-semibold">-{breakdown.cancellation_fee_display}</span>
                    </div>

                    <div className="border-t border-[#E6DCD2] pt-2.5 flex justify-between items-baseline font-black">
                      <span className="text-sm text-[#1B1320]">Total Refund Initiated</span>
                      <div className="text-right">
                        <span className="text-xl text-[#C8102E] block">
                          {breakdown.total_refund_display}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {breakdown.total_refund_paise.toLocaleString('en-IN')} paise
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span>Your seats will be released immediately for other patrons.</span>
                </div>

                {/* Action Buttons with double-click protection */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isSubmitting}
                    className="min-h-[44px] rounded-xl border border-[#E6DCD2] bg-white px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 transition disabled:opacity-50"
                  >
                    Keep Booking
                  </button>

                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={isSubmitting}
                    className="min-h-[44px] rounded-xl bg-[#C8102E] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#A60D26] transition shadow-sm disabled:opacity-50 flex items-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Processing Cancellation...</span>
                      </>
                    ) : (
                      <>
                        <span>Confirm Cancellation ({breakdown?.total_refund_display || ''})</span>
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
