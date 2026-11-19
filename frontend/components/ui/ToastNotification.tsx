'use client';

import React from 'react';
import { useCinemaStore } from '@/store/useCinemaStore';
import { AlertCircle, Info, CheckCircle2, X } from 'lucide-react';

export function ToastNotification() {
  const toastMessage = useCinemaStore((s) => s.toastMessage);
  const clearToast = useCinemaStore((s) => s.clearToast);

  if (!toastMessage) return null;

  const isWarning = toastMessage.includes('booked') || toastMessage.includes('held') || toastMessage.includes('already');
  const isSuccess = toastMessage.includes('Selected') || toastMessage.includes('added');

  const borderClass = isWarning
    ? 'border-red-900/80 bg-[#160b0d]/95 text-red-200'
    : isSuccess
      ? 'border-emerald-900/80 bg-[#0d1611]/95 text-emerald-200'
      : 'border-amber-900/70 bg-[#17120a]/95 text-amber-200';

  const Icon = isWarning ? AlertCircle : isSuccess ? CheckCircle2 : Info;
  const iconColor = isWarning ? 'text-[#e50914]' : isSuccess ? 'text-emerald-400' : 'text-amber-400';

  return (
    <div className="fixed top-6 left-1/2 z-50 -translate-x-1/2 max-w-md w-full px-4 animate-in fade-in slide-in-from-top-4 duration-200 pointer-events-auto">
      <div className={`flex items-center justify-between gap-3 rounded-xl border ${borderClass} p-3.5 shadow-2xl backdrop-blur-md`}>
        <div className="flex items-center gap-2.5">
          <Icon className={`h-5 w-5 ${iconColor} shrink-0`} />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
        <button
          onClick={clearToast}
          className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white transition"
          aria-label="Dismiss message"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

