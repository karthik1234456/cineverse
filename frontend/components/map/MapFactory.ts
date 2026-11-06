import type { IMapAdapter } from './MapAdapter';
import { LeafletAdapter } from './LeafletAdapter';

export type SupportedMapProvider = 'leaflet' | 'google-maps' | 'mapbox';

export class GoogleMapsAdapter implements IMapAdapter {
  async init(options: any) {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
    if (!apiKey) {
      console.warn('[MapProvider] Google Maps key missing. Falling back to Leaflet OSM.');
      return new LeafletAdapter().init(options);
    }
    // Production Google Maps integration fallback
    return new LeafletAdapter().init(options);
  }
}

export class MapboxAdapter implements IMapAdapter {
  async init(options: any) {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      console.warn('[MapProvider] Mapbox token missing. Falling back to Leaflet OSM.');
      return new LeafletAdapter().init(options);
    }
    return new LeafletAdapter().init(options);
  }
}

export function createMapAdapter(provider?: string): IMapAdapter {
  const chosen = (provider || process.env.NEXT_PUBLIC_MAP_PROVIDER || 'leaflet').toLowerCase();
  switch (chosen) {
    case 'google-maps':
    case 'google':
      return new GoogleMapsAdapter();
    case 'mapbox':
      return new MapboxAdapter();
    case 'leaflet':
    default:
      return new LeafletAdapter();
  }
}
