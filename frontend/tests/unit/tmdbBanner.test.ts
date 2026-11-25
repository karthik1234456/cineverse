import { describe, it, expect } from 'vitest';
import { isBookingPath, shouldShowBanner } from '@/components/TmdbReadinessBanner';

describe('TMDB Readiness Banner Policy', () => {
  describe('isBookingPath', () => {
    it('identifies auditorium seat selection pages as booking path', () => {
      expect(isBookingPath('/cinemas/11/auditorium/36')).toBe(true);
      expect(isBookingPath('/cinemas/11/auditorium/36?showtime=737')).toBe(true);
      expect(isBookingPath('/cinemas/11/auditorium/36?showtime=737&mode=3d')).toBe(true);
    });

    it('identifies checkout pages as booking path', () => {
      expect(isBookingPath('/checkout')).toBe(true);
      expect(isBookingPath('/checkout?hold_id=hold_12345')).toBe(true);
      expect(isBookingPath('/checkout/confirmation')).toBe(true);
    });

    it('identifies booking flow and confirmation pages as booking path', () => {
      expect(isBookingPath('/booking/123')).toBe(true);
      expect(isBookingPath('/booking/group')).toBe(true);
      expect(isBookingPath('/booking/group/join')).toBe(true);
    });

    it('returns false for non-booking pages', () => {
      expect(isBookingPath('/')).toBe(false);
      expect(isBookingPath('/movies')).toBe(false);
      expect(isBookingPath('/movies/clayface')).toBe(false);
      expect(isBookingPath('/cinemas')).toBe(false);
      expect(isBookingPath('/cinemas/11')).toBe(false);
      expect(isBookingPath('/dev/readiness')).toBe(false);
      expect(isBookingPath(null)).toBe(false);
    });
  });

  describe('shouldShowBanner', () => {
    it('NEVER shows banner on any booking path, even in development', () => {
      // In dev mode
      expect(shouldShowBanner('/cinemas/11/auditorium/36', true)).toBe(false);
      expect(shouldShowBanner('/checkout', true)).toBe(false);
      expect(shouldShowBanner('/booking/101', true)).toBe(false);

      // In production mode
      expect(shouldShowBanner('/cinemas/11/auditorium/36', false)).toBe(false);
      expect(shouldShowBanner('/checkout', false)).toBe(false);
      expect(shouldShowBanner('/booking/101', false)).toBe(false);
    });

    it('allows banner on developer readiness page in BOTH dev and production', () => {
      expect(shouldShowBanner('/dev/readiness', true)).toBe(true);
      expect(shouldShowBanner('/dev/readiness', false)).toBe(true);
      expect(shouldShowBanner('/dev/readiness/diagnostics', true)).toBe(true);
      expect(shouldShowBanner('/dev/readiness/diagnostics', false)).toBe(true);
    });

    it('allows banner on general pages ONLY in development, NEVER in production', () => {
      // Development: allowed on general pages
      expect(shouldShowBanner('/', true)).toBe(true);
      expect(shouldShowBanner('/movies', true)).toBe(true);
      expect(shouldShowBanner('/movies/clayface', true)).toBe(true);
      expect(shouldShowBanner('/cinemas', true)).toBe(true);

      // Production: NEVER allowed on customer-facing pages
      expect(shouldShowBanner('/', false)).toBe(false);
      expect(shouldShowBanner('/movies', false)).toBe(false);
      expect(shouldShowBanner('/movies/clayface', false)).toBe(false);
      expect(shouldShowBanner('/cinemas', false)).toBe(false);
    });
  });
});
