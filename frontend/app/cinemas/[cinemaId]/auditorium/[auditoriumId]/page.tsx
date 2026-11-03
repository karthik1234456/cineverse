import { AuditoriumExperience } from '@/components/3d/AuditoriumExperience';
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
    title: `CineVerse 3D — ${params.cinemaId} / ${params.auditoriumId}`,
  };
}

export default function AuditoriumRoutePage({
  params,
  searchParams,
}: AuditoriumPageProps) {
  if (searchParams.mode === '2d') {
    return (
      <FallbackSeatList
        cinemaId={params.cinemaId}
        auditoriumId={params.auditoriumId}
        showtimeId={searchParams.showtime || '1'}
      />
    );
  }

  return (
    <AuditoriumExperience
      cinemaId={params.cinemaId}
      auditoriumId={params.auditoriumId}
      showtimeId={searchParams.showtime || '1'}
    />
  );
}

