// services/seatStatusService.ts
// Handles fetching and live updates for seat statuses.
// MOCK - replaced by FastAPI / backend WebSocket service in Phase 4.

import type { SeatStatus } from '@/lib/types';

export interface SeatStatusResponse {
  showtimeId: string;
  timestamp: string;
  seats: { seatId: string; status: 'available' | 'booked' | 'held' }[];
}

export async function fetchSeatStatuses(showtimeId: string): Promise<Record<string, SeatStatus>> {
  const res = await fetch(`/api/showtimes/${encodeURIComponent(showtimeId)}/seats`);
  if (!res.ok) {
    throw new Error(`Failed to fetch seat statuses: ${res.statusText}`);
  }
  const data: SeatStatusResponse = await res.json();
  const map: Record<string, SeatStatus> = {};
  for (const s of data.seats) {
    map[s.seatId] = s.status;
  }
  return map;
}
