// hooks/useSeatSocket.ts
// Real-time WebSocket hook connecting to FastAPI backend /ws/showtimes/{id}.

import { useEffect, useCallback, useRef, useState } from 'react';
import type { SeatStatus } from '@/lib/types';

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
  const [isConnected, setIsConnected] = useState(false);
  const callbackRef = useRef(onSeatStatusChange);
  callbackRef.current = onSeatStatusChange;
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!enabled || !showtimeId) return;

    // Connect to real backend WebSocket
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://127.0.0.1:8002/ws';
    const socket = new WebSocket(`${wsUrl}/showtimes/${showtimeId}`);
    wsRef.current = socket;

    socket.onopen = () => {
      console.info(`[SeatSocket] Connected to live showtime channel ${showtimeId}`);
      setIsConnected(true);
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const { event: evtType, seat_ids, status } = data;
        if (seat_ids && Array.isArray(seat_ids) && callbackRef.current) {
          let mappedStatus: SeatStatus = 'available';
          if (status === 'HELD') mappedStatus = 'held';
          else if (status === 'BOOKED') mappedStatus = 'booked';
          else if (status === 'AVAILABLE') mappedStatus = 'available';

          for (const sId of seat_ids) {
            callbackRef.current(sId, mappedStatus);
          }
        }
      } catch (err) {
        console.warn(`[SeatSocket] Failed to parse message: ${err}`);
      }
    };

    socket.onerror = (err) => {
      console.warn(`[SeatSocket] Connection error on showtime ${showtimeId}`);
    };

    socket.onclose = () => {
      setIsConnected(false);
    };

    // Heartbeat ping
    const pingInterval = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send('ping');
      }
    }, 25000);

    return () => {
      clearInterval(pingInterval);
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }
    };
  }, [showtimeId, enabled]);

  const sendHoldRequest = useCallback((seatId: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'hold', seat_id: seatId }));
    }
  }, []);

  const sendReleaseRequest = useCallback((seatId: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'release', seat_id: seatId }));
    }
  }, []);

  const simulateRemoteHold = useCallback((seatId: string) => {
    console.info(`[SeatSocket] Simulating external user holding seat ${seatId}`);
    if (callbackRef.current) {
      callbackRef.current(seatId, 'held');
    }
  }, []);

  return {
    isConnected,
    sendHoldRequest,
    sendReleaseRequest,
    simulateRemoteHold,
  };
}
