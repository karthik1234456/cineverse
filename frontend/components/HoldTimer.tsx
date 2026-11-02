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
    <div className={`flex items-center justify-between rounded-xl border p-3 ${
      isUrgent
        ? 'border-red-500/50 bg-red-950/20 text-red-200 animate-pulse'
        : 'border-amber-500/30 bg-amber-950/20 text-amber-200'
    }`}>
      <div className="flex items-center gap-2">
        {isUrgent ? (
          <AlertTriangle className="h-4 w-4 text-red-400" />
        ) : (
          <Clock className="h-4 w-4 text-amber-400" />
        )}
        <div>
          <div className="text-xs font-semibold">
            {isUrgent ? 'Seats releasing soon!' : 'Seats locked for you'}
          </div>
          <div className="text-[11px] text-zinc-400">Complete booking within time limit</div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="font-mono text-base font-black tracking-wider text-white">
          {formattedTime}
        </div>

        {!hasExtended && secondsRemaining > 0 && (
          <button
            onClick={handleExtend}
            disabled={isExtending}
            className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-zinc-300 hover:bg-white/10 transition disabled:opacity-50"
            title="Extend countdown by 3 minutes"
          >
            <RefreshCw className={`h-3 w-3 ${isExtending ? 'animate-spin' : ''}`} />
            <span>+3m</span>
          </button>
        )}
      </div>
    </div>
  );
}

