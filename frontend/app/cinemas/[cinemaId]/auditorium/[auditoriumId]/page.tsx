import { AuditoriumExperience } from '@/components/3d/AuditoriumExperience';

interface AuditoriumPageProps {
  params: {
    cinemaId: string;
    auditoriumId: string;
  };
  searchParams: {
    showtime?: string;
    hq?: string;
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
  return (
    <AuditoriumExperience
      cinemaId={params.cinemaId}
      auditoriumId={params.auditoriumId}
      showtimeId={searchParams.showtime || 'showtime-101'}
    />
  );
}
