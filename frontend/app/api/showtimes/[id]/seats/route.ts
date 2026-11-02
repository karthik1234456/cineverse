// MOCK – replaced by FastAPI later
// GET /api/showtimes/[id]/seats
// Deterministic seeded seat status generator for CineVerse 3D

import { NextResponse } from 'next/server';

function pseudoRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const showtimeId = params.id || 'default';
  
  // Hash showtime ID to create a numeric seed
  let seed = 0;
  for (let i = 0; i < showtimeId.length; i++) {
    seed = (seed << 5) - seed + showtimeId.charCodeAt(i);
    seed |= 0;
  }

  const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  const seats: { seatId: string; status: 'available' | 'booked' | 'held' }[] = [];

  let idx = 0;
  for (const row of rows) {
    for (let num = 1; num <= 10; num++) {
      const seatId = `${row}${num.toString().padStart(2, '0')}`;
      const rand = pseudoRandom(seed + idx * 7919);

      let status: 'available' | 'booked' | 'held' = 'available';

      // Keep specific showcase / test seats (like F05, A05, E05, J10) predictable
      if (seatId === 'F05' || seatId === 'A05' || seatId === 'E05' || seatId === 'J10') {
        status = 'available';
      } else if (seatId === 'C04' || seatId === 'D06') {
        // Guaranteed held seats for testing rejection
        status = 'held';
      } else if (seatId === 'B03' || seatId === 'G07') {
        // Guaranteed booked seats for testing rejection
        status = 'booked';
      } else {
        // ~28% booked, ~4% held, 68% available
        if (rand < 0.28) {
          status = 'booked';
        } else if (rand < 0.32) {
          status = 'held';
        } else {
          status = 'available';
        }
      }

      seats.push({ seatId, status });
      idx++;
    }
  }

  return NextResponse.json({
    showtimeId,
    timestamp: new Date().toISOString(),
    seats,
  });
}
