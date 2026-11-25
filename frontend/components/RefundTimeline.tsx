// frontend/components/RefundTimeline.tsx
'use client';

import React from 'react';
import { CheckCircle2, Clock, AlertTriangle, ShieldCheck, Landmark } from 'lucide-react';
import { type RefundResponse, type RefundBreakdownPaise } from '@/services/api';

interface RefundTimelineProps {
  refund?: RefundResponse | null;
  breakdown?: RefundBreakdownPaise | null;
  bookingCode?: string;
}

export default function RefundTimeline({ refund, breakdown, bookingCode }: RefundTimelineProps) {
  const status = refund?.status || 'REQUESTED';
  const isStuck = Boolean(refund?.is_stuck);
  const timeline = refund?.timeline || [];

  const getStepStatus = (stepKey: 'REQUESTED' | 'PROCESSING' | 'REFUNDED') => {
    if (status === 'REFUNDED') return 'completed';
    if (status === 'FAILED') {
      if (stepKey === 'REFUNDED') return 'failed';
      return 'completed';
    }
    if (status === 'PROCESSING') {
      if (stepKey === 'REQUESTED') return 'completed';
      if (stepKey === 'PROCESSING') return 'active';
      return 'pending';
    }
    // status === 'REQUESTED'
    if (stepKey === 'REQUESTED') return 'completed';
    return 'pending';
  };

  const step1State = getStepStatus('REQUESTED');
  const step2State = getStepStatus('PROCESSING');
  const step3State = getStepStatus('REFUNDED');

  const getStepEvent = (stepKey: string) => {
    return timeline.find((t) => t.status === stepKey);
  };

  const reqEvent = getStepEvent('REQUESTED') || (timeline.length > 0 ? timeline[0] : null);
  const procEvent = getStepEvent('PROCESSING');
  const refEvent = getStepEvent('REFUNDED') || getStepEvent('FAILED');

  const amountDisplay = refund?.amount_display || breakdown?.total_refund_display || '₹0.00';

  return (
    <div className="rounded-3xl border border-[#E6DCD2] bg-white p-6 sm:p-8 space-y-6 shadow-sm">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#E6DCD2] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-[#9F1239] border border-rose-200">
              Booking Cancelled
            </span>
            <span className={`rounded-lg px-2.5 py-0.5 text-xs font-bold border ${
              status === 'REFUNDED'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : status === 'FAILED' || isStuck
                ? 'bg-amber-50 text-amber-900 border-amber-300'
                : 'bg-blue-50 text-blue-800 border-blue-200'
            }`}>
              Gateway Status: {status}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-[#1B1320] mt-1.5">
            Automated Refund Tracker
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Real-time status synchronized with payment gateway webhooks {bookingCode ? `· ${bookingCode}` : ''}
          </p>
        </div>

        <div className="sm:text-right bg-[#FAF6F0] sm:bg-transparent p-3 sm:p-0 rounded-2xl w-full sm:w-auto">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            Refund Amount Credited
          </span>
          <span className="text-2xl sm:text-3xl font-black text-[#C8102E]">
            {amountDisplay}
          </span>
          <span className="text-[11px] text-slate-500 block">
            {refund?.amount_paise ? `(${refund.amount_paise.toLocaleString('en-IN')} paise)` : ''}
          </span>
        </div>
      </div>

      {/* Stuck / Error Alert */}
      {isStuck && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-amber-950">Refund Processing Delayed</p>
            <p className="text-xs text-amber-900">
              {refund?.error_message || 'The banking gateway reported a temporary delay. Our operations team has been alerted and will re-dispatch your credit.'}
            </p>
          </div>
        </div>
      )}

      {/* 3-Step Refund Stepper */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
        {/* Step 1: Requested */}
        <div className={`rounded-2xl border p-4 space-y-2 transition ${
          step1State === 'completed'
            ? 'border-emerald-200 bg-emerald-50/50'
            : 'border-[#E6DCD2] bg-[#FAF6F0]'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Step 1
            </span>
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="text-base font-bold text-[#1B1320]">
            Cancellation Requested
          </div>
          <p className="text-xs text-slate-600">
            {reqEvent?.note || 'Customer cancelled reservation within policy window. Seats released.'}
          </p>
          {reqEvent?.timestamp && (
            <div className="text-[11px] font-mono text-slate-500 pt-1">
              {new Date(reqEvent.timestamp).toLocaleString()}
            </div>
          )}
        </div>

        {/* Step 2: Processing */}
        <div className={`rounded-2xl border p-4 space-y-2 transition ${
          step2State === 'completed'
            ? 'border-emerald-200 bg-emerald-50/50'
            : step2State === 'active'
            ? 'border-blue-300 bg-blue-50/50 ring-2 ring-blue-200'
            : 'border-[#E6DCD2] bg-[#FAF6F0]'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Step 2
            </span>
            {step2State === 'completed' ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            ) : step2State === 'active' ? (
              <Clock className="h-5 w-5 text-blue-600 animate-spin" />
            ) : (
              <Clock className="h-5 w-5 text-slate-300" />
            )}
          </div>
          <div className="text-base font-bold text-[#1B1320]">
            Gateway Processing
          </div>
          <p className="text-xs text-slate-600">
            {procEvent?.note || (step2State === 'completed' ? 'Processed by banking gateway' : 'Routing to customer card/UPI bank network')}
          </p>
          {procEvent?.timestamp && (
            <div className="text-[11px] font-mono text-slate-500 pt-1">
              {new Date(procEvent.timestamp).toLocaleString()}
            </div>
          )}
        </div>

        {/* Step 3: Refunded */}
        <div className={`rounded-2xl border p-4 space-y-2 transition ${
          step3State === 'completed'
            ? 'border-emerald-300 bg-emerald-50/70'
            : step3State === 'failed'
            ? 'border-rose-300 bg-rose-50/70'
            : 'border-[#E6DCD2] bg-[#FAF6F0]'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Step 3
            </span>
            {step3State === 'completed' ? (
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
            ) : step3State === 'failed' ? (
              <AlertTriangle className="h-5 w-5 text-rose-600" />
            ) : (
              <Landmark className="h-5 w-5 text-slate-300" />
            )}
          </div>
          <div className="text-base font-bold text-[#1B1320]">
            {step3State === 'completed' ? 'Refund Credited' : step3State === 'failed' ? 'Credit Attention Needed' : 'Account Credit'}
          </div>
          <p className="text-xs text-slate-600">
            {refEvent?.note || (step3State === 'completed' ? 'Successfully credited to source payment account.' : 'Expected in 3-5 business days per RBI guidelines.')}
          </p>
          {refEvent?.timestamp && (
            <div className="text-[11px] font-mono text-slate-500 pt-1">
              {new Date(refEvent.timestamp).toLocaleString()}
            </div>
          )}
        </div>
      </div>

      {/* Plain-language explanation breakdown */}
      {breakdown && (
        <div className="rounded-2xl border border-[#E6DCD2] bg-[#FAF6F0] p-4 sm:p-5 space-y-2 text-xs text-slate-700">
          <div className="font-bold text-[#1B1320] text-sm">Official Refund Breakdown (Audit Verified)</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-slate-600">
            <div>
              <span className="text-slate-400 block">Ticket Base:</span>
              <span className="font-semibold text-slate-800">{breakdown.ticket_amount_display}</span>
              <span className="text-emerald-700 block font-bold">Refund: {breakdown.ticket_refund_display} (75%)</span>
            </div>
            <div>
              <span className="text-slate-400 block">F&B Add-ons:</span>
              <span className="font-semibold text-slate-800">{breakdown.addons_amount_display}</span>
              <span className="text-emerald-700 block font-bold">Refund: {breakdown.addons_refund_display} (100%)</span>
            </div>
            <div>
              <span className="text-slate-400 block">Fee & GST:</span>
              <span className="font-semibold text-slate-800">{breakdown.convenience_fee_display} + {breakdown.gst_amount_display}</span>
              <span className="text-slate-500 block">Non-refundable</span>
            </div>
            <div>
              <span className="text-slate-400 block">Cancellation Fee:</span>
              <span className="font-semibold text-rose-700">{breakdown.cancellation_fee_display}</span>
              <span className="text-slate-500 block">25% ticket charge</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
