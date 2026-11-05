// components/HoldTimer.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Clock, RefreshCw, AlertTriangle } from 'lucide-react';
import { extendHold } from '@/services/api';

interface HoldTimerProps {
  holdId: string;
  initialExpiresAt: string;
  onExpire?: () => void;
}

export function HoldTimer({ holdId, initialExpiresAt, onExpire }: HoldTimerProps) {
  const [expiresAt, setExpiresAt] = useState<Date>(new Date(initialExpiresAt));
  const [secondsRemaining, setSecondsRemaining] = useState<number>(300);
  const [isExtending, setIsExtending] = useState(false);
  const [hasExtended, setHasExtended] = useState(false);

  useEffect(() => {
    setExpiresAt(new Date(initialExpiresAt));
  }, [initialExpiresAt]);

  useEffect(() => {
    function calculateRemaining() {
      const diff = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
      setSecondsRemaining(diff);
      if (diff === 0 && onExpire) {
        onExpire();
      }
    }

    calculateRemaining();
    const interval = setInterval(calculateRemaining, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, onExpire]);

  async function handleExtend() {
    setIsExtending(true);
    try {
      const res = await extendHold(holdId);
      setExpiresAt(new Date(res.new_expires_at));
      setHasExtended(true);
    } catch (err) {
      console.warn('Failed to extend hold:', err);
    } finally {
      setIsExtending(false);
    }
  }

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const isUrgent = secondsRemaining < 60;

  return (
    <div
      className={`flex items-center justify-between rounded-2xl border px-4 py-3 shadow-sm ${
        isUrgent
          ? 'border-red-300 bg-red-50 text-red-900 animate-pulse'
          : 'border-amber-200 bg-amber-50 text-amber-900'
      }`}
      data-testid="hold-countdown-timer"
    >
      <div className="flex items-center gap-2">
        {isUrgent ? (
          <AlertTriangle className="h-5 w-5 text-red-500" />
        ) : (
          <Clock className="h-5 w-5 text-amber-600" />
        )}
        <div>
          <div className="text-sm font-bold text-slate-800">
            {isUrgent ? 'Seats releasing soon!' : 'Seats locked for you'}
          </div>
          <div className="text-sm text-slate-500">Complete booking within time limit</div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="font-mono text-base font-black tracking-wider text-[#1B1320]" data-testid="hold-timer-digits">
          {formattedTime}
        </div>

        {!hasExtended && secondsRemaining > 0 && (
          <button
            onClick={handleExtend}
            disabled={isExtending}
            data-testid="extend-hold-button"
            className="flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[#E6DCD2] bg-white px-3 py-1.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm disabled:opacity-50"
            title="Extend countdown by 3 minutes"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isExtending ? 'animate-spin' : ''}`} />
            <span>+3m</span>
          </button>
        )}
      </div>
    </div>
  );
}

