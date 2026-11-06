import type { IMapAdapter, IMapInstance, MapAdapterOptions, MapMarker } from './MapAdapter';

/**
 * Cluster markers when count > 20
 */
function clusterMarkers(markers: MapMarker[], thresholdDeg: number = 0.04): {
  singles: MapMarker[];
  clusters: { lat: number; lng: number; count: number; markers: MapMarker[] }[];
} {
  if (markers.length <= 20) {
    return { singles: markers, clusters: [] };
  }

  const visited = new Set<string | number>();
  const singles: MapMarker[] = [];
  const clusters: { lat: number; lng: number; count: number; markers: MapMarker[] }[] = [];

  for (let i = 0; i < markers.length; i++) {
    const m = markers[i];
    if (visited.has(m.id) || m.isUserLocation) {
      if (m.isUserLocation) singles.push(m);
      continue;
    }

    const group: MapMarker[] = [m];
    visited.add(m.id);

    for (let j = i + 1; j < markers.length; j++) {
      const other = markers[j];
      if (visited.has(other.id) || other.isUserLocation) continue;

      const dLat = Math.abs(m.lat - other.lat);
      const dLng = Math.abs(m.lng - other.lng);
      if (dLat < thresholdDeg && dLng < thresholdDeg) {
        group.push(other);
        visited.add(other.id);
      }
    }

    if (group.length > 1) {
      const avgLat = group.reduce((sum, g) => sum + g.lat, 0) / group.length;
      const avgLng = group.reduce((sum, g) => sum + g.lng, 0) / group.length;
      clusters.push({ lat: avgLat, lng: avgLng, count: group.length, markers: group });
    } else {
      singles.push(m);
    }
  }

  return { singles, clusters };
}

export class LeafletAdapter implements IMapAdapter {
  async init(options: MapAdapterOptions): Promise<IMapInstance> {
    const L = (await import('leaflet')).default;

    // Ensure Leaflet styles are loaded
    if (typeof document !== 'undefined' && !document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    const map = L.map(options.container, {
      center: options.center,
      zoom: options.zoom,
      zoomControl: options.interactive !== false,
      dragging: options.interactive !== false,
      scrollWheelZoom: options.interactive !== false,
      doubleClickZoom: options.interactive !== false,
      boxZoom: options.interactive !== false,
      keyboard: options.interactive !== false,
      attributionControl: true,
    });

    // OpenStreetMap tile layer (Free, 0 cost, 0 API keys)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
    }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);

    const renderMarkers = (markers: MapMarker[]) => {
      layerGroup.clearLayers();

      const { singles, clusters } = clusterMarkers(markers);

      // Render clusters
      clusters.forEach((cluster) => {
        const clusterIcon = L.divIcon({
          className: 'cineverse-cluster-pin',
          html: `
            <div role="button" tabindex="0" aria-label="Cluster of ${cluster.count} cinemas" style="
              display: flex;
              align-items: center;
              justify-content: center;
              width: 44px;
              height: 44px;
              background: #C8102E;
              color: #FFFFFF;
              font-family: inherit;
              font-size: 16px;
              font-weight: 700;
              border-radius: 50%;
              box-shadow: 0 4px 12px rgba(200, 16, 46, 0.4);
              border: 3px solid #FFFFFF;
              cursor: pointer;
            ">
              ${cluster.count}
            </div>
          `,
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        });

        const clusterMarker = L.marker([cluster.lat, cluster.lng], { icon: clusterIcon }).addTo(layerGroup);
        clusterMarker.on('click', () => {
          map.setView([cluster.lat, cluster.lng], map.getZoom() + 2);
        });
      });

      // Render single pins
      singles.forEach((m) => {
        if (m.isUserLocation) {
          // User location pulsing pin
          const userIcon = L.divIcon({
            className: 'cineverse-user-pin',
            html: `
              <div role="img" aria-label="Your location" style="
                position: relative;
                width: 24px;
                height: 24px;
              ">
                <div style="
                  position: absolute;
                  width: 24px;
                  height: 24px;
                  background: rgba(37, 99, 235, 0.35);
                  border-radius: 50%;
                  animation: pulse 2s infinite ease-in-out;
                "></div>
                <div style="
                  position: absolute;
                  top: 4px;
                  left: 4px;
                  width: 16px;
                  height: 16px;
                  background: #2563EB;
                  border: 2px solid #FFFFFF;
                  border-radius: 50%;
                  box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                "></div>
              </div>
            `,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          });
          L.marker([m.lat, m.lng], { icon: userIcon }).addTo(layerGroup);
          return;
        }

        const isSelected = m.isSelected;
        const bg = isSelected ? '#1B1320' : '#C8102E';
        const scale = isSelected ? 'scale(1.15)' : 'scale(1)';

        const pinIcon = L.divIcon({
          className: 'cineverse-cinema-pin',
          html: `
            <div role="button" tabindex="0" aria-label="${m.title}" style="
              display: flex;
              align-items: center;
              justify-content: center;
              width: 36px;
              height: 44px;
              cursor: pointer;
              transform: ${scale};
              transition: transform 180ms ease-out;
              outline: none;
            " onfocus="this.style.filter='drop-shadow(0 0 6px #C8102E)'" onblur="this.style.filter='none'">
              <svg width="36" height="44" viewBox="0 0 36 44" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 0C8.05887 0 0 8.05887 0 18C0 31.5 18 44 18 44C18 44 36 31.5 36 18C36 8.05887 27.9411 0 18 0Z" fill="${bg}"/>
                <circle cx="18" cy="17" r="9" fill="#FFFFFF"/>
                <circle cx="18" cy="17" r="5" fill="${bg}"/>
              </svg>
            </div>
          `,
          iconSize: [36, 44],
          iconAnchor: [18, 44],
        });

        const leafletMarker = L.marker([m.lat, m.lng], { icon: pinIcon }).addTo(layerGroup);

        leafletMarker.on('click', () => {
          if (options.onMarkerClick) {
            options.onMarkerClick(m);
          }
        });

        leafletMarker.on('keypress', (e: any) => {
          if (e.originalEvent?.key === 'Enter' || e.originalEvent?.key === ' ') {
            if (options.onMarkerClick) {
              options.onMarkerClick(m);
            }
          }
        });
      });
    };

    renderMarkers(options.markers);

    if (options.onMapClick) {
      map.on('click', (e: any) => {
        options.onMapClick!(e.latlng.lat, e.latlng.lng);
      });
    }

    return {
      setCenter: (lat: number, lng: number, zoom?: number) => {
        map.setView([lat, lng], zoom || map.getZoom());
      },
      fitBounds: (bounds: [number, number][]) => {
        if (bounds.length > 0) {
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
        }
      },
      updateMarkers: (newMarkers: MapMarker[]) => {
        renderMarkers(newMarkers);
      },
      destroy: () => {
        map.remove();
      },
    };
  }
}
