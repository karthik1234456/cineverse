'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';

interface CachedBannerCheck {
  timestamp: number;
  banner: string | null;
}

let bannerCache: CachedBannerCheck | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

export function isBookingPath(pathname: string | null): boolean {
  if (!pathname) return false;
  // Auditorium seat selection (2D / 3D)
  if (pathname.includes('/auditorium/')) return true;
  // Checkout & payment flow
  if (pathname.startsWith('/checkout')) return true;
  // Booking confirmation & ticket details
  if (pathname.startsWith('/booking')) return true;
  return false;
}

export function shouldShowBanner(pathname: string | null, isDev: boolean): boolean {
  if (isBookingPath(pathname)) return false;
  const isReadinessPage = Boolean(pathname?.startsWith('/dev/readiness'));
  if (!isDev && !isReadinessPage) return false;
  return true;
}

export function TmdbReadinessBanner() {
  const pathname = usePathname();
  const [banner, setBanner] = useState<string | null>(() => {
    if (bannerCache && Date.now() - bannerCache.timestamp < CACHE_TTL_MS) {
      return bannerCache.banner;
    }
    return null;
  });

  useEffect(() => {
    const isDev = process.env.NODE_ENV !== 'production';
    if (!shouldShowBanner(pathname, isDev)) {
      return;
    }

    // Check 5-minute cache
    if (bannerCache && Date.now() - bannerCache.timestamp < CACHE_TTL_MS) {
      setBanner(bannerCache.banner);
      return;
    }

    // 4. Short timeout non-blocking check (2.5s)
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';
    const apiBase = `${backendUrl}/api/v1`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    fetch(`${apiBase}/movies/catalog-info`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        clearTimeout(timeoutId);
        const bannerText = data?.readiness_banner || null;
        bannerCache = { timestamp: Date.now(), banner: bannerText };
        setBanner(bannerText);
      })
      .catch(() => {
        clearTimeout(timeoutId);
        // Fallback banner reflects real reason: TMDB unreachable
        const fallback = 'Real posters unavailable: TMDB unreachable';
        bannerCache = { timestamp: Date.now(), banner: fallback };
        setBanner(fallback);
      });

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [pathname]);

  // Never render on booking path or outside allowed environments
  const isDev = process.env.NODE_ENV !== 'production';
  if (!shouldShowBanner(pathname, isDev)) {
    return null;
  }

  if (!banner) return null;

  return (
    <div
      data-testid="tmdb-readiness-banner"
      role="alert"
      className="w-full bg-[#C8102E] text-white px-4 py-2.5 text-center text-sm font-bold shadow-md flex items-center justify-center gap-2 z-40 sticky top-0"
    >
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{banner}</span>
    </div>
  );
}
