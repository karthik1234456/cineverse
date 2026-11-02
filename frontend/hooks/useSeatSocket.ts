// hooks/useSeatSocket.ts
// WebSocket hook stub with interface for FastAPI/backend real-time seat synchronization.
// Provides live state updates and event emission for dev simulation.

import { useEffect, useCallback, useRef } from 'react';
import type { SeatStatus } from '@/lib/types';

export interface SeatSocketEvent {
  type: 'SEAT_HELD' | 'SEAT_RELEASED' | 'SEAT_BOOKED';
  seatId: string;
  showtimeId: string;
  userId?: string;
  expiresAt?: string;
}

export interface UseSeatSocketOptions {
  showtimeId: string;
  onSeatStatusChange?: (seatId: string, status: SeatStatus) => void;
  enabled?: boolean;
}

export interface SeatSocketClient {
  isConnected: boolean;
  sendHoldRequest: (seatId: string) => void;
  sendReleaseRequest: (seatId: string) => void;
  simulateRemoteHold: (seatId: string) => void;
}

export function useSeatSocket({
  showtimeId,
  onSeatStatusChange,
  enabled = true,
}: UseSeatSocketOptions): SeatSocketClient {
  const callbackRef = useRef(onSeatStatusChange);
  callbackRef.current = onSeatStatusChange;

  useEffect(() => {
    if (!enabled) return;
    // Log WebSocket stub initialization
    console.info(`[SeatSocket] Initialized mock socket for showtime ${showtimeId}`);

    // In future phases: connect to ws://...
    return () => {
      console.info(`[SeatSocket] Disconnected mock socket for showtime ${showtimeId}`);
    };
  }, [showtimeId, enabled]);

  const sendHoldRequest = useCallback((seatId: string) => {
    console.info(`[SeatSocket STUB] sendHoldRequest: seat=${seatId}`);
  }, []);

  const sendReleaseRequest = useCallback((seatId: string) => {
    console.info(`[SeatSocket STUB] sendReleaseRequest: seat=${seatId}`);
  }, []);

  const simulateRemoteHold = useCallback((seatId: string) => {
    console.info(`[SeatSocket] Simulating external user holding seat ${seatId}`);
    if (callbackRef.current) {
      callbackRef.current(seatId, 'held');
    }
  }, []);

  return {
    isConnected: true,
    sendHoldRequest,
    sendReleaseRequest,
    simulateRemoteHold,
  };
}
