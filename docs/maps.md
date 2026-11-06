# CineVerse Theatre Maps Architecture & Provider Guide

## 1. Overview & Architecture

CineVerse provides an interactive geospatial map experience across the theatre discovery, cinema details, movie showtime selection, and ticket confirmation workflows.

To prevent vendor lock-in, eliminate API licensing costs during development and open-source deployments, and enable instantaneous switches to enterprise providers when requested, CineVerse implements the **Adapter Pattern** via `IMapAdapter` and `MapFactory`.

```
                    ┌─────────────────────────┐
                    │      MapFactory         │
                    └───────────┬─────────────┘
                                │ reads NEXT_PUBLIC_MAP_PROVIDER
         ┌──────────────────────┼──────────────────────┐
         ▼                      ▼                      ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  LeafletAdapter  │  │ GoogleMapAdapter │  │  MapboxAdapter   │
│ (OSM / Carto CDN)│  │ (JS SDK / Key)   │  │  (Vector / Token)│
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

### Core Interface Contract (`frontend/components/map/MapAdapter.ts`)

```typescript
export interface MapMarker {
  id: string | number;
  latitude: number;
  longitude: number;
  title: string;
  subtitle?: string;
  isUserLocation?: boolean;
  isActive?: boolean;
  onClick?: () => void;
}

export interface IMapInstance {
  setCenter(lat: number, lng: number, zoom?: number): void;
  fitBounds(bounds: [[number, number], [number, number]], padding?: [number, number]): void;
  setMarkers(markers: MapMarker[]): void;
  selectMarker(markerId: string | number): void;
  destroy(): void;
}

export interface IMapAdapter {
  createMap(element: HTMLElement, options: {
    center: [number, number];
    zoom: number;
    markers?: MapMarker[];
    onMarkerSelect?: (marker: MapMarker) => void;
    onClickCoordinates?: (coords: { lat: number; lng: number }) => void;
  }): Promise<IMapInstance>;
}
```

---

## 2. Configuration & Provider Switching

The active map provider is governed by the `NEXT_PUBLIC_MAP_PROVIDER` environment variable:

| Environment Variable | Allowed Values | Default | Purpose |
|----------------------|----------------|---------|---------|
| `NEXT_PUBLIC_MAP_PROVIDER` | `leaflet` \| `google-maps` \| `mapbox` | `leaflet` | Selects active rendering engine |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | string | *None* | Required only when provider is `google-maps` |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | string | *None* | Required only when provider is `mapbox` |

### Default Provider: Leaflet + OpenStreetMap
- **Dependencies**: `leaflet` (~40 KB gzipped) and CartoDB Voyager tiles.
- **API Keys**: Zero keys required. Works out of the box in development, test, and production builds.
- **Lazy Loading**: Loaded dynamically via Next.js dynamic imports (`ssr: false`) and initialized only upon explicit user mount. Initial SSR payload contains 0 KB map bundle.

---

## 3. Tile Attribution & Acceptable Use

Leaflet maps rendered in CineVerse use CartoDB Voyager raster tiles powered by OpenStreetMap contributors.

### Required Tile Attribution Notice
```
© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors, 
© <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>
```
This attribution is permanently visible in the bottom-right corner of every rendered map instance via the Leaflet attribution control.

---

## 4. Directions Integration Standard

All turn-by-turn directions links utilize Google's universal directions URL scheme:

```
https://www.google.com/maps/dir/?api=1&destination=<latitude>,<longitude>
```

### Benefits:
1. **Zero API Quota / Zero Cost**: Direct navigation opens natively in Google Maps App on mobile (iOS/Android) or Google Maps web on desktop.
2. **Deterministic Coordinates**: Direct routing by precise latitude and longitude eliminates ambiguity and geocoding latency.
3. **Omni-channel Availability**: Featured across:
   - Cinema Discovery pin popups and spotlight cards
   - Cinema Detail page transit headers
   - Movie Showtimes cinema location modals
   - Booking Confirmation page
   - Print Ticket HTML documents
   - CalDAV / `.ics` calendar appointment exports

---

## 5. Commercial Cost Analysis (100,000 Views / Month)

Below is the cost breakdown across providers for an estimated volume of 100,000 active map page views per month:

| Provider | Pricing Model (as of 2026) | Free Tier Allowance | Monthly Cost at 100,000 Views |
|---|---|---|---|
| **Leaflet + OpenStreetMap / Carto** | Open Data / Open Source | Unlimited fair use (non-bulk) | **\$0.00 / month** |
| **Mapbox GL JS** | \$5.00 per 1,000 map loads after free tier | 50,000 loads / month free | **\$250.00 / month** |
| **Google Maps JavaScript API** | \$7.00 per 1,000 dynamic map loads | \$200 monthly credit (~28,571 free loads) | **\$500.00 / month** |

### Recommendation
For self-hosted and cloud production deployments, **Leaflet with OSM / Carto** delivers 100% feature coverage (smooth panning, custom SVG pins, marker clustering, bounding-box auto-zoom, and responsive touch controls) at **\$0 ongoing operational cost**.

---

## 6. Privacy & DPDP Act Compliance

Under India's Digital Personal Data Protection (DPDP) Act and international privacy guidelines:

1. **Explicit Permission Only**: Geolocation is never requested automatically on page load. A visible `"Near Me"` button requires explicit user click/tap.
2. **Privacy Rounding**: Geolocation coordinates are truncated to **2 decimal places** ($\approx 1.1\text{ km}$ resolution) in the client browser before being sent in search queries (`user_lat`, `user_lng`). Exact street-level user coordinates are never transmitted.
3. **Zero Coordinate Logging**: Backend API endpoints (`GET /api/v1/cinemas/`, `GET /api/v1/movies/{id}/showtimes`) hold coordinates in request memory only to compute Haversine distances. User coordinates are never persisted to PostgreSQL or written to log files.
4. **Transparent User Disclaimer**: The UI clearly displays: *"Your location is used only to show nearby cinemas and is never stored."*
5. **Full Fallback Capabilities**: If geolocation is denied or unavailable, users can search by cinema name or select from the city list; full functionality remains available.
