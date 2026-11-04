// components/MovieCard.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { Star, Heart } from 'lucide-react';
import type { Movie } from '@/services/api';

interface MovieCardProps {
  movie: Movie;
}

export function MovieCard({ movie }: MovieCardProps) {
  return (
    <Link
      href={`/movies/${movie.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-[#E6DCD2] bg-white transition duration-200 hover:-translate-y-1 hover:shadow-dropdown shadow-card text-[#1B1320]"
    >
      {/* Poster image container */}
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-[#FDEBD8]">
        <img
          src={movie.poster_url}
          alt={movie.title}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          onError={(e) => {
            (e.target as HTMLElement).style.display = 'none';
          }}
        />

        {/* Certificate Badge (>= 14px text) */}
        <div className="absolute left-3 top-3 rounded-lg bg-white/95 backdrop-blur-md px-2.5 py-1 text-sm font-bold text-[#1B1320] border border-[#E6DCD2] shadow-sm">
          {movie.certificate}
        </div>

        {/* Rating or Interested Badge (>= 14px text) */}
        <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-lg bg-white/95 backdrop-blur-md px-2.5 py-1 text-sm font-bold border border-[#E6DCD2] shadow-sm">
          {movie.is_now_showing ? (
            <>
              <Star className="h-4 w-4 fill-[#F2A900] text-[#F2A900]" />
              <span className="text-[#1B1320]">{movie.rating_avg.toFixed(1)}</span>
            </>
          ) : (
            <>
              <Heart className="h-4 w-4 fill-[#C8102E] text-[#C8102E]" />
              <span className="text-[#1B1320]">{(movie.interested_count / 1000).toFixed(1)}k</span>
            </>
          )}
        </div>

        {/* Formats banner at bottom of poster */}
        {movie.formats && movie.formats.length > 0 && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 pt-6 flex items-center gap-2">
            {movie.formats.slice(0, 2).map((fmt) => (
              <span
                key={fmt}
                className="rounded-md bg-white/90 px-2 py-0.5 text-sm font-bold text-[#1B1320]"
              >
                {fmt}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Card Details (all text >= 14px, title >= 18px) */}
      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-xl font-bold text-[#1B1320] group-hover:text-[#C8102E] transition line-clamp-1">
          {movie.title}
        </h3>

        <p className="mt-1 text-sm font-medium text-[#4A4056] line-clamp-1">
          {movie.genres?.join(', ')} · {movie.languages?.[0]}
        </p>

        <div className="mt-4 pt-3 border-t border-[#E6DCD2] flex items-center justify-between">
          <span className="text-sm font-medium text-[#4A4056]">{movie.duration_minutes} mins</span>
          <span
            data-testid="movie-card-book-btn"
            className="inline-flex items-center justify-center rounded-xl bg-[#C8102E] px-4 py-2 text-sm font-bold text-white group-hover:bg-[#A60D26] transition shadow-sm min-h-[40px]"
          >
            Book
          </span>
        </div>
      </div>
    </Link>
  );
}
