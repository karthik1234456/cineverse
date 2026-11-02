// services/seatStatusService.ts
// Connects to FastAPI /api/v1/showtimes/{id}/seats to fetch live seat statuses.

import type { SeatStatus } from '@/lib/types';
import { getShowtimeSeats } from './api';

export async function fetchSeatStatuses(showtimeId: string): Promise<Record<string, SeatStatus>> {
  try {
    const data = await getShowtimeSeats(showtimeId);
    const map: Record<string, SeatStatus> = {};
    for (const s of data.seats) {
      let st: SeatStatus = 'available';
      if (s.status === 'BOOKED') {
        st = 'booked';
      } else if (s.status === 'HELD' || s.status === 'PAYMENT_PENDING') {
        st = 'held';
      }
      map[s.seat_id] = st;
    }
    return map;
  } catch (err) {
    console.warn(`Falling back to local seats endpoint: ${err}`);
    const res = await fetch(`/api/showtimes/${encodeURIComponent(showtimeId)}/seats`);
    if (res.ok) {
      const fallbackData = await res.json();
      const map: Record<string, SeatStatus> = {};
      for (const s of fallbackData.seats) {
        map[s.seatId] = s.status;
      }
      return map;
    }
    return {};
  }
}
