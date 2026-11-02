import { AuditoriumExperience } from '@/components/3d/AuditoriumExperience';

export const metadata = {
  title: 'CineVerse 3D — Dev Viewport',
};

export default function ThreeDevPage({
  searchParams,
}: {
  searchParams: { showtime?: string; hq?: string };
}) {
  return (
    <AuditoriumExperience
      cinemaId="cineverse-central"
      auditoriumId="auditorium-1"
      showtimeId={searchParams.showtime || 'showtime-101'}
    />
  );
}
