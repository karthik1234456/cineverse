'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getShowtimeSeats, type ShowtimeSeatsResponse } from '@/services/api';
import type { SeatStatus } from '@/lib/types';
import { useCinemaStore } from '@/store/useCinemaStore';
import { generateProceduralAuditorium } from '@/lib/proceduralAuditorium';
import { useSeatSocket } from './useSeatSocket';

export function useSeatData(showtimeId: string = '1') {
  const setSeatStatuses = useCinemaStore((s) => s.setSeatStatuses);
  const setSeatPrices = useCinemaStore((s) => s.setSeatPrices);
  const setTiers = useCinemaStore((s) => s.setTiers);
  const updateSeatStatus = useCinemaStore((s) => s.updateSeatStatus);
  const setTrailerState = useCinemaStore((s) => s.setTrailerState);
  const setAuditoriumData = useCinemaStore((s) => s.setAuditoriumData);

  // TanStack Query for showtime seats and movie trailer info
  const { data, isLoading, error, refetch } = useQuery<ShowtimeSeatsResponse>({
    queryKey: ['seats', showtimeId],
    queryFn: async () => {
      try {
        return await getShowtimeSeats(showtimeId);
      } catch (err) {
        console.warn(`[useSeatData] Failed to fetch showtime seats from API: ${err}`);
        // Fallback mock
        return {
          showtime_id: parseInt(showtimeId, 10) || 1,
          movie_id: 1,
          movie_title: 'Quantum Odyssey',
          cinema_id: 1,
          cinema_name: 'CineVerse IMAX',
          auditorium_id: 1,
          auditorium_name: 'Audi 1',
          screen_type: 'IMAX 3D',
          has_3d_preview: true,
          format: 'IMAX 3D',
          language: 'English',
          start_time: new Date().toISOString(),
          glb_path: '/models/cineverse_auditorium_v2.web.glb',
          layout_path: '/models/seat_layout_v2.json',
          trailer_url: '/trailers/quantum_odyssey.webm',
          poster_url: '/posters/quantum_odyssey.png',
          seats: [],
        };
      }
    },
  });

  // Sync with Zustand store
  useEffect(() => {
    if (data) {
      if (data.seats && data.seats.length > 0) {
        const statusMap: Record<string, SeatStatus> = {};
        const priceMap: Record<string, { price: number; category: string; currency?: string; quote_id?: string }> = {};

        for (const s of data.seats) {
          let st: SeatStatus = 'available';
          if (s.status === 'BOOKED') {
            st = 'booked';
          } else if (s.status === 'HELD' || s.status === 'PAYMENT_PENDING') {
            st = 'held';
          }
          statusMap[s.seat_id] = st;
          priceMap[s.seat_id] = {
            price: s.price,
            category: s.category,
            currency: s.currency || 'INR',
            quote_id: s.quote_id,
          };
        }
        setSeatStatuses(statusMap);
        setSeatPrices(priceMap);
        if (data.tiers && data.tiers.length > 0) {
          setTiers(data.tiers);
        }
      }

      // Generate procedural 3D auditorium for all halls (except Auditorium 1 which uses the bespoke GLB by default)
      const audId = String(data.auditorium_id || '1');
      let isProceduralRequested = false;
      if (typeof window !== 'undefined') {
        const p = new URLSearchParams(window.location.search);
        isProceduralRequested = p.get('procedural') === '1';
      }

      if (audId !== '1' || isProceduralRequested) {
        if (data.layout_data && data.layout_data.rows) {
          const proceduralData = generateProceduralAuditorium({
            ...data.layout_data,
            screen_type: data.screen_type,
            total_seats: data.seats && data.seats.length > 0 ? data.seats.length : (data.layout_data.rows.length * (data.layout_data.seats_per_row || 10)),
            base_price: data.seats && data.seats[0] ? data.seats[0].price : 280,
            theatre_type: (data.layout_data as any).theatre_type,
            arrangement_pattern: (data.layout_data as any).arrangement_pattern,
            blocks_pattern: (data.layout_data as any).blocks_pattern,
            sweet_spot: (data.layout_data as any).sweet_spot,
            sofa_pairs: (data.layout_data as any).sofa_pairs,
            balcony_rows: data.layout_data.balcony_rows || data.layout_data.levels?.balcony?.rows,
            recliner_pairs: data.layout_data.recliner_pairs as [string, string][] | undefined,
          });
          setAuditoriumData(audId, proceduralData, {
            name: data.auditorium_name,
            screenType: data.screen_type,
            screenFormat: data.screen_format || data.screen_type,
            soundSystem: data.sound_system || 'Dolby Atmos',
            projectionType: data.projection_type || '4K Laser',
            techSpecsDisplay: data.tech_specs_display || `${data.auditorium_name} · ${data.screen_format || data.screen_type} · ${data.sound_system || 'Dolby Atmos'} · ${data.projection_type || '4K Laser'}`,
            requiresGlasses: data.requires_glasses ?? false,
            confirmedWithCinema: data.confirmed_with_cinema ?? false,
            isDemo: data.is_demo ?? true,
          });
        }
      } else {
        setAuditoriumData('1', null, {
          name: data.auditorium_name,
          screenType: data.screen_type,
          screenFormat: data.screen_format || data.screen_type,
          soundSystem: data.sound_system || 'Dolby Atmos',
          projectionType: data.projection_type || '4K Laser',
          techSpecsDisplay: data.tech_specs_display || `${data.auditorium_name} · ${data.screen_format || data.screen_type} · ${data.sound_system || 'Dolby Atmos'} · ${data.projection_type || '4K Laser'}`,
          requiresGlasses: data.requires_glasses ?? false,
          confirmedWithCinema: data.confirmed_with_cinema ?? false,
          isDemo: data.is_demo ?? true,
        });
      }

      // Configure screen trailer from showtime movie data
      setTrailerState({
        trailerUrl: data.trailer_url || '',
        posterUrl: data.poster_url || '',
        movieTitle: data.movie_title || '',
        isPlaying: !!data.trailer_url,
        isMuted: true,
      });
    }
  }, [data, setSeatStatuses, setSeatPrices, setTiers, setTrailerState]);

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

