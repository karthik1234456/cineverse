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
  // Deterministic local color for SVG placeholder posters if image is not loaded
  const posterPlaceholder = (
    <div className="absolute inset-0 flex flex-col justify-end p-4 bg-gradient-to-t from-black via-zinc-900/60 to-transparent">
      <div className="text-sm font-bold text-white line-clamp-2">{movie.title}</div>
      <div className="text-[11px] text-zinc-400 mt-1">{movie.genres?.join(', ')}</div>
    </div>
  );

  return (
    <Link
      href={`/movies/${movie.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/5 bg-[#12131a] transition duration-300 hover:-translate-y-1 hover:border-[#e50914]/40 hover:shadow-2xl hover:shadow-red-950/20"
    >
      {/* Poster image container */}
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-zinc-900">
        <img
          src={movie.poster_url}
          alt={movie.title}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          onError={(e) => {
            // Replace with stylized CSS poster fallback
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
        {posterPlaceholder}

        {/* Certificate Badge */}
        <div className="absolute left-2.5 top-2.5 rounded-md bg-black/60 backdrop-blur-md px-2 py-0.5 text-[10px] font-bold text-zinc-200 border border-white/10">
          {movie.certificate}
        </div>

        {/* Rating or Interested Badge */}
        <div className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-md bg-black/60 backdrop-blur-md px-2 py-0.5 text-[11px] font-bold border border-white/10">
          {movie.is_now_showing ? (
            <>
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              <span className="text-white">{movie.rating_avg.toFixed(1)}</span>
            </>
          ) : (
            <>
              <Heart className="h-3 w-3 fill-red-500 text-red-500" />
              <span className="text-zinc-300">{(movie.interested_count / 1000).toFixed(1)}k</span>
            </>
          )}
        </div>

        {/* Formats banner at bottom of poster */}
        <div className="absolute bottom-2 left-2 right-2 flex flex-wrap gap-1">
          {movie.formats?.slice(0, 2).map((fmt) => (
            <span
              key={fmt}
              className="rounded bg-black/70 backdrop-blur-sm px-1.5 py-0.5 text-[9px] font-semibold text-zinc-300 border border-white/5"
            >
              {fmt}
            </span>
          ))}
        </div>
      </div>

      {/* Details info */}
      <div className="flex flex-1 flex-col justify-between p-3.5">
        <div>
          <h3 className="text-sm font-bold text-white group-hover:text-[#e50914] transition line-clamp-1">
            {movie.title}
          </h3>
          <p className="text-[11px] text-zinc-400 mt-1 line-clamp-1">
            {movie.languages?.join(', ')}
          </p>
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-2 text-[11px] text-zinc-500">
          <span>{movie.duration_minutes}m</span>
          <span className="font-semibold text-zinc-300 group-hover:text-[#e50914] transition">
            Book Tickets →
          </span>
        </div>
      </div>
    </Link>
  );
}

