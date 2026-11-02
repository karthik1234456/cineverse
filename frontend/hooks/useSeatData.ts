'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchSeatStatuses } from '@/services/seatStatusService';
import { useCinemaStore } from '@/store/useCinemaStore';
import { useSeatSocket } from './useSeatSocket';

export function useSeatData(showtimeId: string = 'showtime-101') {
  const setSeatStatuses = useCinemaStore((s) => s.setSeatStatuses);
  const updateSeatStatus = useCinemaStore((s) => s.updateSeatStatus);

  // TanStack Query for seat data
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['seats', showtimeId],
    queryFn: () => fetchSeatStatuses(showtimeId),
  });

  // Sync with Zustand store
  useEffect(() => {
    if (data) {
      setSeatStatuses(data);
    }
  }, [data, setSeatStatuses]);

  // Hook up WebSocket stub for live updates
  const socket = useSeatSocket({
    showtimeId,
    onSeatStatusChange: (seatId, status) => {
      updateSeatStatus(seatId, status);
    },
  });

  return {
    isLoading,
    error,
    refetch,
    socket,
  };
}

