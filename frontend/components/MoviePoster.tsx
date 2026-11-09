'use client';

import React, { useState } from 'react';
import { Film } from 'lucide-react';

interface MoviePosterProps {
  src?: string | null;
  alt: string;
  title?: string;
  certificate?: string;
  className?: string;
  containerClassName?: string;
  sizes?: string;
  priority?: boolean;
}

/**
 * Builds TMDB image srcset when a TMDB image path or URL is used.
 */
function buildSrcSet(url: string): string | undefined {
  if (!url) return undefined;

  // TMDB image CDN matching: /t/p/wXXX/path.jpg or just path.jpg
  const tmdbMatch = url.match(/image\.tmdb\.org\/t\/p\/(w\d+|original)(\/[^?#]+)/);
  if (tmdbMatch) {
    const imgPath = tmdbMatch[2];
    return `https://image.tmdb.org/t/p/w342${imgPath} 342w, https://image.tmdb.org/t/p/w500${imgPath} 500w, https://image.tmdb.org/t/p/w780${imgPath} 780w`;
  }

  // If someone passed bare TMDB poster path like /abc123xyz.jpg
  if (url.startsWith('/') && (url.endsWith('.jpg') || url.endsWith('.png')) && !url.startsWith('/posters/')) {
    return `https://image.tmdb.org/t/p/w342${url} 342w, https://image.tmdb.org/t/p/w500${url} 500w, https://image.tmdb.org/t/p/w780${url} 780w`;
  }

  return undefined;
}

function resolvePosterUrl(url?: string | null): string {
  if (!url) return '';
  if (url.startsWith('/') && !url.startsWith('/posters/') && (url.endsWith('.jpg') || url.endsWith('.png'))) {
    return `https://image.tmdb.org/t/p/w500${url}`;
  }
  return url;
}

export function MoviePoster({
  src,
  alt,
  title,
  certificate,
  className = 'h-full w-full object-cover',
  containerClassName = 'relative aspect-[2/3] w-full overflow-hidden bg-[#FDEBD8]',
  sizes = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
  priority = false,
}: MoviePosterProps) {
  const [hasError, setHasError] = useState(false);
  const resolvedUrl = resolvePosterUrl(src);
  const srcSet = resolvedUrl ? buildSrcSet(resolvedUrl) : undefined;

  // If no URL or error, render branded SVG / stylized fallback
  if (!resolvedUrl || hasError) {
    return (
      <div
        className={`${containerClassName} flex flex-col items-center justify-center p-4 text-center select-none border border-[#E6DCD2]`}
        data-testid="movie-poster-fallback"
        role="img"
        aria-label={alt || title || 'Movie Poster'}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm border border-[#E6DCD2] mb-3">
          <Film className="h-7 w-7 text-[#C8102E]" aria-hidden="true" />
        </div>
        <p className="text-sm font-bold text-[#1B1320] line-clamp-2 leading-snug px-1">
          {title || alt || 'CineVerse'}
        </p>
        <span
          data-testid="no-poster-badge"
          className="mt-1.5 inline-block rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700 border border-rose-200"
        >
          No Poster Available
        </span>
        {certificate && (
          <span className="mt-1.5 inline-block rounded-md bg-white/90 px-2 py-0.5 text-xs font-bold text-[#4A4056] border border-[#E6DCD2]">
            {certificate}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={containerClassName}>
      <img
        src={resolvedUrl}
        srcSet={srcSet}
        sizes={srcSet ? sizes : undefined}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        className={className}
        data-testid="movie-poster-img"
        onError={() => setHasError(true)}
      />
    </div>
  );
}

