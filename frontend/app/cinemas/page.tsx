'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  MapPin,
  Compass,
  ChevronRight,
  Navigation,
  Map as MapIcon,
  List as ListIcon,
  Phone,
  Clock,
  Car,
  Train,
  ExternalLink,
  ShieldCheck,
  Search,
  X,
} from 'lucide-react';
import { getCinemas, type Cinema } from '@/services/api';
import { CinemaMap } from '@/components/map/CinemaMap';
import { useGeolocation } from '@/hooks/useGeolocation';
import { getDirectionsUrl } from '@/components/map/MapAdapter';

const CITY_COORDINATES: Record<string, [number, number]> = {
  bengaluru: [12.9716, 77.5946],
  mumbai: [19.076, 72.8777],
  'delhi-ncr': [28.6139, 77.209],
  hyderabad: [17.385, 78.4867],
  chennai: [13.0827, 80.2707],
  pune: [18.5204, 73.8567],
  kolkata: [22.5726, 88.3639],
};

const CITY_NAMES: Record<number, string> = {
  1: 'bengaluru',
  2: 'mumbai',
  3: 'delhi-ncr',
  4: 'hyderabad',
  5: 'chennai',
  6: 'pune',
  7: 'kolkata',
};

export default function CinemasPage() {
  const [cinemas, setCinemas] = useState<Cinema[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [selectedCinemaId, setSelectedCinemaId] = useState<number | null>(null);
  const [cityId, setCityId] = useState<number>(1);
  const [formatFilter, setFormatFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const { coords: userCoords, error: geoError, isRequesting: isGeoRequesting, requestLocation, clearLocation } =
    useGeolocation();

  function loadCinemasData(cId: number, lat?: number, lng?: number) {
    setLoading(true);
    getCinemas({
      cityId: cId,
      userLat: lat,
      userLng: lng,
      sortBy: lat != null && lng != null ? 'distance' : 'name',
    })
      .then((data) => {
        setCinemas(data);
        if (data.length > 0 && !selectedCinemaId) {
          setSelectedCinemaId(data[0].id);
        }
      })
      .catch((err) => console.warn(err))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const storedCityId = typeof window !== 'undefined' ? localStorage.getItem('cineverse_city_id') : null;
    const initialCityId = storedCityId ? parseInt(storedCityId, 10) : 1;
    setCityId(initialCityId);
    loadCinemasData(initialCityId, userCoords?.lat, userCoords?.lng);

    function onCityChanged(e: any) {
      if (e.detail?.id) {
        setCityId(e.detail.id);
        loadCinemasData(e.detail.id, userCoords?.lat, userCoords?.lng);
      }
    }
    window.addEventListener('cityChanged', onCityChanged);
    return () => window.removeEventListener('cityChanged', onCityChanged);
  }, []);

  // Reload when geolocation changes
  useEffect(() => {
    if (userCoords) {
      loadCinemasData(cityId, userCoords.lat, userCoords.lng);
    }
  }, [userCoords]);

  const activeCitySlug = CITY_NAMES[cityId] || 'bengaluru';
  const cityCenter: [number, number] = CITY_COORDINATES[activeCitySlug] || [12.9716, 77.5946];

  // Filter cinemas by format and search query
  const filteredCinemas = useMemo(() => {
    return cinemas.filter((c) => {
      if (formatFilter !== 'ALL') {
        const hasFormat = c.facilities?.some((f) =>
          f.toLowerCase().includes(formatFilter.toLowerCase())
        );
        if (!hasFormat) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = c.name.toLowerCase().includes(q);
        const matchesAddress = c.address.toLowerCase().includes(q);
        const matchesPin = c.pincode?.includes(q);
        const matchesLandmark = c.landmark?.toLowerCase().includes(q);
        if (!matchesName && !matchesAddress && !matchesPin && !matchesLandmark) return false;
      }
      return true;
    });
  }, [cinemas, formatFilter, searchQuery]);

  const selectedCinema = useMemo(() => {
    if (!selectedCinemaId) return filteredCinemas[0] || null;
    return filteredCinemas.find((c) => c.id === selectedCinemaId) || filteredCinemas[0] || null;
  }, [filteredCinemas, selectedCinemaId]);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 w-full text-[#1B1320]" data-testid="cinemas-page">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl sm:text-4xl font-black text-[#1B1320] tracking-tight">
              Cinemas & Theatres
            </h1>
            <span
              className="px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#0E8F8A] bg-[#E6F6F0] rounded-full border border-[#0E8F8A]/30"
              data-testid="demo-data-badge"
            >
              Demo Network
            </span>
          </div>
          <p className="text-base text-[#4A4056] mt-2">
            Explore {cinemas.length} premium CineVerse destinations with Laser IMAX, Dolby Atmos, and 3D auditorium preview.
          </p>
        </div>

        {/* View Toggle & Near Me */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Near Me Geolocation Button */}
          <div className="flex flex-col">
            <button
              type="button"
              onClick={userCoords ? clearLocation : requestLocation}
              disabled={isGeoRequesting}
              className={`flex items-center gap-2 h-12 px-5 rounded-2xl font-bold text-base transition shadow-sm ${
                userCoords
                  ? 'bg-[#2563EB] text-white hover:bg-blue-700'
                  : 'bg-white border-2 border-[#E6DCD2] text-[#1B1320] hover:border-[#C8102E] hover:text-[#C8102E]'
              }`}
              data-testid="near-me-button"
              aria-label="Find cinemas near me using location"
            >
              <Navigation className={`h-5 w-5 ${isGeoRequesting ? 'animate-spin' : ''}`} />
              <span>{userCoords ? 'Near Me Active (Reset)' : isGeoRequesting ? 'Locating...' : 'Near Me'}</span>
            </button>
            <span className="text-[13px] text-[#4A4056] mt-1 text-center sm:text-left flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-[#0E8F8A] shrink-0" />
              <span>Your location is used only to show nearby cinemas and is never stored.</span>
            </span>
          </div>

          {/* Map / List Toggle */}
          <div className="flex items-center p-1 bg-[#FDEBD8] rounded-2xl border border-[#E6DCD2]" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'map'}
              onClick={() => setViewMode('map')}
              className={`flex items-center gap-2 h-10 px-4 rounded-xl font-bold text-sm transition ${
                viewMode === 'map'
                  ? 'bg-white text-[#C8102E] shadow-sm'
                  : 'text-[#4A4056] hover:text-[#1B1320]'
              }`}
              data-testid="view-map-toggle"
            >
              <MapIcon className="h-4 w-4" />
              <span>Map View</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'list'}
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-2 h-10 px-4 rounded-xl font-bold text-sm transition ${
                viewMode === 'list'
                  ? 'bg-white text-[#C8102E] shadow-sm'
                  : 'text-[#4A4056] hover:text-[#1B1320]'
              }`}
              data-testid="view-list-toggle"
            >
              <ListIcon className="h-4 w-4" />
              <span>List View</span>
            </button>
          </div>
        </div>
      </div>

      {/* Geolocation Notice Banner */}
      {geoError && (
        <div
          className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-between text-base"
          data-testid="geo-alert-banner"
        >
          <span>{geoError}</span>
          <button
            type="button"
            onClick={clearLocation}
            className="text-amber-800 hover:text-amber-950 font-bold ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filter Chips & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mb-6">
        {/* Format Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {['ALL', 'IMAX', 'Dolby Atmos', '4DX', 'Laser', 'Recliner'].map((fmt) => (
            <button
              key={fmt}
              type="button"
              onClick={() => setFormatFilter(fmt)}
              className={`h-11 px-4 rounded-xl text-sm font-bold transition border ${
                formatFilter === fmt
                  ? 'bg-[#C8102E] text-white border-[#C8102E] shadow-sm'
                  : 'bg-white text-[#4A4056] border-[#E6DCD2] hover:border-[#C8102E] hover:text-[#C8102E]'
              }`}
              data-testid={`filter-${fmt.toLowerCase().replace(/\s+/g, '-')}`}
            >
              {fmt === 'ALL' ? 'All Formats' : fmt}
            </button>
          ))}
        </div>

        {/* Search input for area / pincode */}
        <div className="relative min-w-[260px]">
          <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-[#4A4056]" />
          <input
            type="text"
            placeholder="Search by area, landmark or pincode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-11 pl-10 pr-9 rounded-xl border border-[#E6DCD2] bg-white text-base text-[#1B1320] focus:outline-none focus:border-[#C8102E]"
            data-testid="cinema-search-input"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-3.5 text-[#4A4056] hover:text-[#1B1320]"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {viewMode === 'map' ? (
        /* MAP VIEW: Split Screen on Desktop, Bottom Sheet on Mobile */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Map Pane (7 cols on desktop, top half on mobile) */}
          <div className="lg:col-span-7 h-[420px] lg:h-[680px] w-full rounded-2xl overflow-hidden shadow-sm relative">
            <CinemaMap
              cinemas={filteredCinemas}
              selectedCinemaId={selectedCinema?.id || null}
              onSelectCinema={(id) => setSelectedCinemaId(id)}
              userCoords={userCoords}
              cityCenter={cityCenter}
              className="w-full h-full"
            />
          </div>

          {/* Cinemas Card Panel (5 cols on desktop, bottom scroll on mobile) */}
          <div className="lg:col-span-5 space-y-4 max-h-[680px] overflow-y-auto pr-1">
            {/* Selected Cinema Spotlight Card */}
            {selectedCinema ? (
              <div
                className="rounded-3xl border-2 border-[#C8102E] bg-white p-6 shadow-md transition"
                data-testid="selected-cinema-card"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-[#C8102E] border border-rose-200">
                    Selected Cinema
                  </span>
                  {selectedCinema.distance_km != null && (
                    <span
                      className="text-sm font-bold text-[#2563EB] bg-[#EAF1FF] px-2.5 py-1 rounded-lg"
                      data-testid="cinema-distance-badge"
                    >
                      {selectedCinema.distance_km} km away
                    </span>
                  )}
                </div>

                <h2 className="text-2xl font-black text-[#1B1320]" data-testid="selected-cinema-name">
                  {selectedCinema.name}
                </h2>

                <p className="flex items-start gap-2 text-base text-[#4A4056] mt-2">
                  <MapPin className="h-4 w-4 text-[#C8102E] shrink-0 mt-1" />
                  <span>{selectedCinema.address}</span>
                </p>

                {selectedCinema.landmark && (
                  <p className="text-sm text-[#4A4056] mt-1 pl-6">
                    <span className="font-semibold text-[#1B1320]">Landmark:</span> {selectedCinema.landmark}
                  </p>
                )}

                {/* Transit & Parking Details */}
                <div className="mt-4 pt-4 border-t border-[#E6DCD2] grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  {selectedCinema.transit_stop && (
                    <div className="flex items-start gap-2 text-[#4A4056]">
                      <Train className="h-4 w-4 text-[#0E8F8A] shrink-0 mt-0.5" />
                      <span>{selectedCinema.transit_stop}</span>
                    </div>
                  )}
                  {selectedCinema.parking && (
                    <div className="flex items-center gap-2 text-[#4A4056]">
                      <Car className="h-4 w-4 text-amber-600 shrink-0" />
                      <span>Parking: {selectedCinema.parking}</span>
                    </div>
                  )}
                  {selectedCinema.phone && (
                    <div className="flex items-center gap-2 text-[#4A4056]">
                      <Phone className="h-4 w-4 text-slate-500 shrink-0" />
                      <span>{selectedCinema.phone}</span>
                    </div>
                  )}
                  {selectedCinema.opening_hours && (
                    <div className="flex items-center gap-2 text-[#4A4056]">
                      <Clock className="h-4 w-4 text-slate-500 shrink-0" />
                      <span>{selectedCinema.opening_hours}</span>
                    </div>
                  )}
                </div>

                {/* Facilities */}
                <div className="flex flex-wrap gap-1.5 mt-4">
                  {selectedCinema.facilities?.map((f) => (
                    <span
                      key={f}
                      className="rounded-lg bg-[#FFF8F1] border border-[#E6DCD2] px-2.5 py-1 text-xs font-semibold text-[#1B1320]"
                    >
                      {f}
                    </span>
                  ))}
                </div>

                {/* Actions */}
                <div className="mt-6 pt-4 border-t border-[#E6DCD2] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  {selectedCinema.latitude != null && selectedCinema.longitude != null && (
                    <a
                      href={getDirectionsUrl(selectedCinema.latitude, selectedCinema.longitude)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-[#0E8F8A] px-4 py-2.5 text-base font-bold text-[#0E8F8A] bg-[#E6F6F0] hover:bg-[#d4f2e7] transition"
                      data-testid="cinema-directions-btn"
                    >
                      <ExternalLink className="h-4 w-4" />
                      <span>Directions</span>
                    </a>
                  )}

                  <Link
                    href={`/cinemas/${selectedCinema.id}`}
                    className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#C8102E] px-6 py-2.5 text-base font-bold text-white hover:bg-[#A60D26] transition shadow-md"
                    data-testid="cinema-book-btn"
                  >
                    <span>Book Tickets</span>
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            ) : null}

            {/* Other Cinemas in City List */}
            <h3 className="text-base font-bold text-[#1B1320] pt-2">All {filteredCinemas.length} Cinemas in City</h3>
            <div className="space-y-3">
              {filteredCinemas.map((c) => {
                const isSelected = c.id === selectedCinema?.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedCinemaId(c.id)}
                    className={`cursor-pointer rounded-2xl border p-4 transition ${
                      isSelected
                        ? 'border-[#C8102E] bg-[#FFF8F1]'
                        : 'border-[#E6DCD2] bg-white hover:border-[#C8102E]'
                    }`}
                    data-testid="cinema-card"
                    data-cinema-id={c.id}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-bold text-base text-[#1B1320]">{c.name}</h4>
                      {c.distance_km != null && (
                        <span className="text-xs font-bold text-[#2563EB] bg-[#EAF1FF] px-2 py-0.5 rounded">
                          {c.distance_km} km
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[#4A4056] line-clamp-1 mt-1">{c.address}</p>
                    {c.facilities && c.facilities.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {c.facilities.slice(0, 3).map((f) => (
                          <span
                            key={f}
                            className="text-[11px] font-semibold text-[#1B1320] bg-white border border-[#E6DCD2] px-1.5 py-0.5 rounded"
                          >
                            {f}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* LIST VIEW: First-class Alternative */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" data-testid="cinemas-list-view">
          {filteredCinemas.map((c) => (
            <div
              key={c.id}
              className="flex flex-col justify-between rounded-3xl border border-[#E6DCD2] bg-white p-7 shadow-sm hover:shadow-md transition group"
              data-testid="cinema-card"
              data-cinema-id={c.id}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="rounded-full bg-rose-50 px-3.5 py-1 text-sm font-bold text-[#9F1239] border border-rose-200">
                    CineVerse Premium
                  </span>
                  {c.distance_km != null ? (
                    <span className="text-sm font-bold text-[#2563EB] bg-[#EAF1FF] px-2.5 py-1 rounded-lg">
                      {c.distance_km} km away
                    </span>
                  ) : (
                    <span className="text-sm font-semibold text-slate-500">M-Ticket Available</span>
                  )}
                </div>

                <h2 className="text-2xl font-bold text-[#1B1320] group-hover:text-[#C8102E] transition">
                  {c.name}
                </h2>

                <p className="flex items-start gap-2 text-base text-slate-600 mt-2.5">
                  <MapPin className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                  <span>{c.address}</span>
                </p>

                {c.landmark && (
                  <p className="text-sm text-slate-600 mt-1 pl-6">
                    <span className="font-semibold text-[#1B1320]">Landmark:</span> {c.landmark}
                  </p>
                )}

                {/* Transit & Parking Details */}
                <div className="mt-4 pt-3 border-t border-[#E6DCD2] space-y-1.5 text-sm text-slate-600">
                  {c.transit_stop && (
                    <div className="flex items-center gap-2">
                      <Train className="h-4 w-4 text-[#0E8F8A] shrink-0" />
                      <span>{c.transit_stop}</span>
                    </div>
                  )}
                  {c.parking && (
                    <div className="flex items-center gap-2">
                      <Car className="h-4 w-4 text-amber-600 shrink-0" />
                      <span>Parking: {c.parking}</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 mt-4">
                  {c.facilities?.map((f) => (
                    <span
                      key={f}
                      className="rounded-xl bg-[#FAF6F0] border border-[#E6DCD2] px-3 py-1 text-sm font-medium text-slate-700"
                    >
                      {f}
                    </span>
                  ))}
                </div>

                <div className="mt-5 rounded-2xl border border-[#E6DCD2] bg-[#FAF6F0] p-4 text-sm text-slate-600">
                  <span className="font-bold text-[#1B1320]">Cancellation Policy:</span> {c.cancellation_policy}
                </div>
              </div>

              <div className="mt-8 pt-5 border-t border-[#E6DCD2] flex flex-wrap items-center justify-between gap-3">
                {c.latitude != null && c.longitude != null && (
                  <a
                    href={getDirectionsUrl(c.latitude, c.longitude)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-[48px] items-center gap-1.5 text-sm font-bold text-[#0E8F8A] hover:underline"
                    data-testid={`list-directions-${c.id}`}
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span>Get Directions</span>
                  </a>
                )}

                <Link
                  href={`/cinemas/${c.id}`}
                  className="flex min-h-[48px] items-center gap-1.5 rounded-xl bg-[#C8102E] px-5 py-2.5 text-base font-bold text-white hover:bg-[#A60D26] transition shadow-sm ml-auto"
                >
                  <span>Browse Shows</span>
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
