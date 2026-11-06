import { AuditoriumViewRouter } from '@/components/AuditoriumViewRouter';
import { FallbackSeatList } from '@/components/2d/FallbackSeatList';

interface AuditoriumPageProps {
  params: {
    cinemaId: string;
    auditoriumId: string;
  };
  searchParams: {
    showtime?: string;
    hq?: string;
    mode?: string;
  };
}

export async function generateMetadata({ params }: AuditoriumPageProps) {
  return {
    title: `CineVerse Seat Map — ${params.cinemaId} / ${params.auditoriumId}`,
  };
}

export default function AuditoriumRoutePage({
  params,
  searchParams,
}: AuditoriumPageProps) {
  if (searchParams.mode === 'fallback_stub') {
    return (
      <FallbackSeatList
        cinemaId={params.cinemaId}
        auditoriumId={params.auditoriumId}
        showtimeId={searchParams.showtime || '1'}
      />
    );
  }

  return (
    <AuditoriumViewRouter
      cinemaId={params.cinemaId}
      auditoriumId={params.auditoriumId}
      showtimeId={searchParams.showtime || '1'}
      initialMode={searchParams.mode === '3d' ? '3d' : '2d'}
    />
  );
}

