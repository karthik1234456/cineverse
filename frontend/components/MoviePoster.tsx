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
  containerClassName = 'relative aspect-[2/3] w-full overflow-hidden bg-[#181124]',
  sizes = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
  priority = false,
}: MoviePosterProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const resolvedUrl = resolvePosterUrl(src);
  const srcSet = resolvedUrl ? buildSrcSet(resolvedUrl) : undefined;

  const hasBg = containerClassName.includes('bg-');
  const fallbackBg = hasBg ? '' : 'bg-[#181124] text-white';

  // If no URL or error, render branded SVG / stylized fallback (never an empty box)
  if (!resolvedUrl || hasError) {
    return (
      <div
        className={`${containerClassName} ${fallbackBg} flex flex-col items-center justify-center p-4 text-center select-none border border-white/15 shadow-inner`}
        data-testid="movie-poster-fallback"
        role="img"
        aria-label={alt || title || 'Movie Poster'}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-md shadow-sm border border-white/20 mb-3 text-[#C8102E]">
          <Film className="h-7 w-7" aria-hidden="true" />
        </div>
        <p className="text-sm font-bold text-white line-clamp-2 leading-snug px-1">
          {title || alt || 'CineVerse'}
        </p>
        <span
          data-testid="no-poster-badge"
          className="mt-2 inline-block rounded-md bg-amber-500/20 px-2.5 py-0.5 text-[11px] font-bold text-amber-300 border border-amber-500/30"
        >
          Artwork Pending
        </span>
        {certificate && (
          <span className="mt-1.5 inline-block rounded-md bg-white/15 px-2 py-0.5 text-xs font-bold text-white/90 border border-white/20">
            {certificate}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`${containerClassName} relative overflow-hidden bg-[#181124]`}>
      {/* Subtle skeleton shimmer placeholder while loading */}
      {!isLoaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#231733] to-[#120B1C] animate-pulse">
          <Film className="h-8 w-8 text-white/30" />
        </div>
      )}
      <img
        src={resolvedUrl}
        srcSet={srcSet}
        sizes={srcSet ? sizes : undefined}
        alt={alt || title || 'Movie Poster'}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        className={`${className} transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
        data-testid="movie-poster-img"
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
      />
    </div>
  );
}
