'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { SlidersHorizontal, X, Check, Volume2, Film, Projector } from 'lucide-react';
import { getFilterFacets, type FilterFacetsResponse, type FilterFacetCount } from '@/services/api';

interface TechnicalSpecsFilterBarProps {
  cityId?: number;
  movieId?: number;
  cinemaId?: number;
  selectedFormats: string[];
  selectedSounds: string[];
  selectedProjections: string[];
  onChange: (filters: { formats: string[]; sounds: string[]; projections: string[] }) => void;
  storageKey?: string;
  className?: string;
}

export function TechnicalSpecsFilterBar({
  cityId,
  movieId,
  cinemaId,
  selectedFormats,
  selectedSounds,
  selectedProjections,
  onChange,
  storageKey = 'cineverse_tech_filters',
  className = '',
}: TechnicalSpecsFilterBarProps) {
  const [facets, setFacets] = useState<FilterFacetsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // Load facets from backend whenever cityId, movieId or cinemaId changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    getFilterFacets(cityId, movieId, cinemaId)
      .then((data) => {
        if (!cancelled) {
          setFacets(data);
        }
      })
      .catch((err) => {
        console.warn('Failed to load technical filter facets:', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cityId, movieId, cinemaId]);

  // Sync state with URL Search Params and LocalStorage
  const updateFilters = useCallback(
    (newFormats: string[], newSounds: string[], newProjections: string[]) => {
      onChange({ formats: newFormats, sounds: newSounds, projections: newProjections });

      // Save to localStorage for remembering
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(
            storageKey,
            JSON.stringify({ formats: newFormats, sounds: newSounds, projections: newProjections })
          );
        } catch {}
      }

      // Sync to URL
      const current = new URLSearchParams(searchParams ? searchParams.toString() : '');
      if (newFormats.length > 0) {
        current.set('format', newFormats.join(','));
      } else {
        current.delete('format');
      }

      if (newSounds.length > 0) {
        current.set('sound', newSounds.join(','));
      } else {
        current.delete('sound');
      }

      if (newProjections.length > 0) {
        current.set('projection', newProjections.join(','));
      } else {
        current.delete('projection');
      }

      const query = current.toString() ? `?${current.toString()}` : '';
      router.replace(`${pathname}${query}`, { scroll: false });
    },
    [onChange, pathname, router, searchParams, storageKey]
  );

  const toggleFormat = (name: string) => {
    const next = selectedFormats.includes(name)
      ? selectedFormats.filter((f) => f !== name)
      : [...selectedFormats, name];
    updateFilters(next, selectedSounds, selectedProjections);
  };

  const toggleSound = (name: string) => {
    const next = selectedSounds.includes(name)
      ? selectedSounds.filter((s) => s !== name)
      : [...selectedSounds, name];
    updateFilters(selectedFormats, next, selectedProjections);
  };

  const toggleProjection = (name: string) => {
    const next = selectedProjections.includes(name)
      ? selectedProjections.filter((p) => p !== name)
      : [...selectedProjections, name];
    updateFilters(selectedFormats, selectedSounds, next);
  };

  const clearAll = () => {
    updateFilters([], [], []);
  };

  const hasActiveFilters =
    selectedFormats.length > 0 || selectedSounds.length > 0 || selectedProjections.length > 0;

  return (
    <div
      className={`rounded-2xl border border-[#E6DCD2] bg-white p-4 shadow-sm space-y-4 ${className}`}
      data-testid="tech-specs-filter-bar"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E6DCD2]/60 pb-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-[#C8102E]" />
          <span className="text-sm font-bold text-[#1B1320] uppercase tracking-wider">
            Screen & Sound Specs
          </span>
          {hasActiveFilters && (
            <span className="rounded-full bg-rose-50 border border-rose-200 px-2 py-0.5 text-xs font-bold text-[#9F1239]">
              {selectedFormats.length + selectedSounds.length + selectedProjections.length} active
            </span>
          )}
        </div>

        {hasActiveFilters && (
          <button
            onClick={clearAll}
            className="flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-800 transition"
            data-testid="clear-tech-filters-btn"
          >
            <X className="h-3.5 w-3.5" />
            <span>Reset filters</span>
          </button>
        )}
      </div>

      {/* Screen Format Filter Chips */}
      {facets?.formats && facets.formats.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
            <Film className="h-3.5 w-3.5 text-slate-400" />
            <span>Screen Format</span>
          </div>
          <div className="flex flex-wrap gap-2" data-testid="format-chips-container">
            {facets.formats.map((fmt) => {
              const active = selectedFormats.includes(fmt.name);
              return (
                <button
                  key={fmt.name}
                  type="button"
                  onClick={() => toggleFormat(fmt.name)}
                  data-testid={`format-chip-${fmt.name.replace(/\s+/g, '-').toLowerCase()}`}
                  data-active={active}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition border ${
                    active
                      ? 'bg-[#C8102E] text-white border-[#C8102E] shadow-sm'
                      : 'bg-[#FAF6F0] text-slate-700 border-[#E6DCD2] hover:border-rose-300 hover:bg-rose-50/50'
                  }`}
                >
                  <span>{fmt.name}</span>
                  <span
                    className={`rounded-md px-1.5 py-0.2 text-[10px] font-semibold ${
                      active ? 'bg-white/20 text-white' : 'bg-white text-slate-500 border border-[#E6DCD2]'
                    }`}
                  >
                    {fmt.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Sound System Filter Chips */}
      {facets?.sounds && facets.sounds.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
            <Volume2 className="h-3.5 w-3.5 text-slate-400" />
            <span>Sound System</span>
          </div>
          <div className="flex flex-wrap gap-2" data-testid="sound-chips-container">
            {facets.sounds.map((snd) => {
              const active = selectedSounds.includes(snd.name);
              return (
                <button
                  key={snd.name}
                  type="button"
                  onClick={() => toggleSound(snd.name)}
                  data-testid={`sound-chip-${snd.name.replace(/\s+/g, '-').toLowerCase()}`}
                  data-active={active}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition border ${
                    active
                      ? 'bg-[#1E40AF] text-white border-[#1E40AF] shadow-sm'
                      : 'bg-[#FAF6F0] text-slate-700 border-[#E6DCD2] hover:border-blue-300 hover:bg-blue-50/50'
                  }`}
                >
                  <span>{snd.name}</span>
                  <span
                    className={`rounded-md px-1.5 py-0.2 text-[10px] font-semibold ${
                      active ? 'bg-white/20 text-white' : 'bg-white text-slate-500 border border-[#E6DCD2]'
                    }`}
                  >
                    {snd.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Projection Type Filter Chips */}
      {facets?.projections && facets.projections.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
            <Projector className="h-3.5 w-3.5 text-slate-400" />
            <span>Projection</span>
          </div>
          <div className="flex flex-wrap gap-2" data-testid="projection-chips-container">
            {facets.projections.map((prj) => {
              const active = selectedProjections.includes(prj.name);
              return (
                <button
                  key={prj.name}
                  type="button"
                  onClick={() => toggleProjection(prj.name)}
                  data-testid={`projection-chip-${prj.name.replace(/\s+/g, '-').toLowerCase()}`}
                  data-active={active}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition border ${
                    active
                      ? 'bg-[#0E8F8A] text-white border-[#0E8F8A] shadow-sm'
                      : 'bg-[#FAF6F0] text-slate-700 border-[#E6DCD2] hover:border-teal-300 hover:bg-teal-50/50'
                  }`}
                >
                  <span>{prj.name}</span>
                  <span
                    className={`rounded-md px-1.5 py-0.2 text-[10px] font-semibold ${
                      active ? 'bg-white/20 text-white' : 'bg-white text-slate-500 border border-[#E6DCD2]'
                    }`}
                  >
                    {prj.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Mandatory Trademark & Operational Disclaimer */}
      <div className="pt-2 border-t border-[#E6DCD2]/40 text-[11px] text-slate-400 italic">
        Format names belong to their owners and are shown to describe the screen.
      </div>
    </div>
  );
}
