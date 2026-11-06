/**
 * CineVerse Map Provider Adapter Pattern
 *
 * Provides a uniform abstraction over map providers:
 * - Leaflet + OpenStreetMap (Default for development - 0 API keys, 0 tile charges)
 * - Google Maps (Configurable via NEXT_PUBLIC_MAP_PROVIDER=google-maps)
 * - Mapbox GL (Configurable via NEXT_PUBLIC_MAP_PROVIDER=mapbox)
 *
 * Universal Directions Scheme:
 * https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>
 */

export interface MapMarker {
  id: string | number;
  lat: number;
  lng: number;
  title: string;
  subtitle?: string;
  isSelected?: boolean;
  isUserLocation?: boolean;
  count?: number; // for cluster markers
}

export interface MapAdapterOptions {
  container: HTMLElement;
  center: [number, number];
  zoom: number;
  markers: MapMarker[];
  onMarkerClick?: (marker: MapMarker) => void;
  onMapClick?: (lat: number, lng: number) => void;
  interactive?: boolean;
}

export interface IMapInstance {
  setCenter(lat: number, lng: number, zoom?: number): void;
  fitBounds(bounds: [number, number][]): void;
  updateMarkers(markers: MapMarker[]): void;
  destroy(): void;
}

export interface IMapAdapter {
  init(options: MapAdapterOptions): Promise<IMapInstance>;
}

export function getDirectionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
