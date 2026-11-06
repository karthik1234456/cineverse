'use client';

import { useState, useCallback } from 'react';

export interface GeolocationState {
  coords: { lat: number; lng: number } | null;
  error: string | null;
  isRequesting: boolean;
  permissionState: 'prompt' | 'granted' | 'denied' | 'unavailable';
}

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    coords: null,
    error: null,
    isRequesting: false,
    permissionState: 'prompt',
  });

  const requestLocation = useCallback(async () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setState((prev) => ({
        ...prev,
        isRequesting: false,
        permissionState: 'unavailable',
        error: 'Geolocation is not supported by your browser.',
      }));
      return;
    }

    setState((prev) => ({ ...prev, isRequesting: true, error: null }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        // Privacy invariant: round coordinates to 2 decimal places (~1 km resolution)
        const lat = Math.round(position.coords.latitude * 100) / 100;
        const lng = Math.round(position.coords.longitude * 100) / 100;

        setState({
          coords: { lat, lng },
          error: null,
          isRequesting: false,
          permissionState: 'granted',
        });
      },
      (err) => {
        let msg = 'Could not determine location.';
        if (err.code === err.PERMISSION_DENIED) {
          msg = 'Location permission denied. Showing all cinemas in city.';
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg = 'Location position unavailable. Falling back to city center.';
        } else if (err.code === err.TIMEOUT) {
          msg = 'Location request timed out.';
        }

        setState({
          coords: null,
          error: msg,
          isRequesting: false,
          permissionState: err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable',
        });
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  }, []);

  const clearLocation = useCallback(() => {
    setState({
      coords: null,
      error: null,
      isRequesting: false,
      permissionState: 'prompt',
    });
  }, []);

  return {
    ...state,
    requestLocation,
    clearLocation,
  };
}
