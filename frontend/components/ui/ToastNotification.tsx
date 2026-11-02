'use client';

import React from 'react';
import { useCinemaStore } from '@/store/useCinemaStore';
import { AlertCircle, X } from 'lucide-react';

export function ToastNotification() {
  const toastMessage = useCinemaStore((s) => s.toastMessage);
  const clearToast = useCinemaStore((s) => s.clearToast);

  if (!toastMessage) return null;

  return (
    <div className="fixed top-6 left-1/2 z-50 -translate-x-1/2 max-w-md w-full px-4 animate-in fade-in slide-in-from-top-4 duration-200">
      <div className="flex items-center justify-between gap-3 rounded-xl border border-red-900/80 bg-[#160b0d]/95 p-3.5 shadow-2xl backdrop-blur-md text-red-200">
        <div className="flex items-center gap-2.5">
          <AlertCircle className="h-5 w-5 text-[#e50914] shrink-0" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
        <button
          onClick={clearToast}
          className="rounded-lg p-1 text-red-400 hover:bg-red-950 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

