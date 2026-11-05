// components/Navbar.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  MapPin, Search, User, LogOut, Ticket, ShieldCheck,
  Film, History, X, Star, Building2
} from 'lucide-react';
import { CityModal } from './CityModal';
import { AuthModal } from './AuthModal';
import type { City, SearchResult } from '@/services/api';
import { getCities, getStoredUser, logoutUser, globalSearch } from '@/services/api';

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [cities, setCities] = useState<City[]>([]);
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [isCityModalOpen, setIsCityModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load cities
    getCities()
      .then((data) => {
        setCities(data);
        const storedCitySlug = localStorage.getItem('cineverse_city');
        const matched = data.find((c) => c.slug === storedCitySlug);
        if (matched) {
          setSelectedCity(matched);
        } else if (data.length > 0) {
          setSelectedCity(data[0]);
          if (!storedCitySlug) {
            setIsCityModalOpen(true);
          }
        }
      })
      .catch((err) => console.warn('Failed to load cities:', err));

    setCurrentUser(getStoredUser());

    // Load recent searches
    try {
      const recents = JSON.parse(localStorage.getItem('cineverse_recent_searches') || '[]');
      setRecentSearches(recents);
    } catch {
      // ignore
    }

    // Click outside listener for search suggestions
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setSearchFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounce search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    const timer = setTimeout(() => {
      globalSearch(searchQuery.trim(), 5)
        .then((res) => setSearchResults(res))
        .catch((err) => console.warn('Search failed:', err))
        .finally(() => setSearchLoading(false));
    }, 220);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  function saveRecentSearch(q: string) {
    if (!q.trim()) return;
    const trimmed = q.trim();
    const updated = [trimmed, ...recentSearches.filter((item) => item !== trimmed)].slice(0, 5);
    setRecentSearches(updated);
    try {
      localStorage.setItem('cineverse_recent_searches', JSON.stringify(updated));
    } catch {
      // ignore
    }
  }

  function handleSelectCity(city: City) {
    setSelectedCity(city);
    localStorage.setItem('cineverse_city', city.slug);
    localStorage.setItem('cineverse_city_id', city.id.toString());
    window.dispatchEvent(new CustomEvent('cityChanged', { detail: city }));
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) {
      saveRecentSearch(searchQuery.trim());
      setSearchFocused(false);
      router.push(`/movies?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  }

  function handleLogout() {
    logoutUser();
    setCurrentUser(null);
    router.refresh();
  }

  if (pathname?.includes('/auditorium/')) {
    return null;
  }

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-[#E6DCD2] bg-white/95 backdrop-blur-md shadow-sm">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo & City Selector */}
          <div className="flex items-center gap-5">
            <Link href="/" className="flex items-center gap-2 group">
              <span className="text-3xl font-black tracking-tight text-[#C8102E]">
                CINEVERSE
              </span>
            </Link>

            <button
              onClick={() => setIsCityModalOpen(true)}
              className="flex items-center gap-2 rounded-full border border-[#E6DCD2] bg-[#FDEBD8] px-3.5 py-2 text-sm font-semibold text-[#1B1320] hover:bg-[#fbdcb9] hover:border-[#d4c2b0] transition shadow-sm min-h-[44px]"
              data-testid="city-selector-button"
              aria-label="Select City"
            >
              <MapPin className="h-4 w-4 text-[#C8102E]" />
              <span>{selectedCity ? selectedCity.name : 'Select City'}</span>
            </button>
          </div>

          {/* Interactive Search Bar with Autocomplete Dropdown */}
          <div ref={searchContainerRef} className="relative hidden md:flex flex-1 max-w-md mx-6">
            <form onSubmit={handleSearchSubmit} className="w-full">
              <div className="relative w-full">
                <Search className="absolute left-4 top-3.5 h-5 w-5 text-[#4A4056]" />
                <input
                  type="text"
                  placeholder="Search movies, cinemas, genres..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  className="w-full rounded-full border border-[#E6DCD2] bg-[#FFF8F1] py-2.5 pl-12 pr-10 text-base text-[#1B1320] placeholder-[#4A4056] focus:border-[#C8102E] focus:bg-white focus:outline-none transition shadow-inner min-h-[48px]"
                  data-testid="global-search-input"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSearchResults(null);
                    }}
                    className="absolute right-3.5 top-3.5 text-[#4A4056] hover:text-[#1B1320]"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </form>

            {/* Suggestions / Recent Searches Dropdown */}
            {searchFocused && (
              <div
                className="absolute left-0 right-0 top-14 rounded-2xl border border-[#E6DCD2] bg-white p-4 shadow-dropdown z-50 overflow-hidden"
                data-testid="search-suggestions-dropdown"
              >
                {searchLoading ? (
                  <div className="p-4 text-center text-sm text-[#4A4056]">Searching catalog...</div>
                ) : searchResults ? (
                  <div className="space-y-4">
                    {/* Movies Section */}
                    {searchResults.movies && searchResults.movies.length > 0 && (
                      <div>
                        <div className="text-sm font-bold uppercase tracking-wider text-[#4A4056] px-2 py-1 flex items-center gap-1.5">
                          <Film className="h-4 w-4 text-[#C8102E]" />
                          <span>Movies</span>
                        </div>
                        <div className="space-y-1 mt-1.5">
                          {searchResults.movies.map((m) => (
                            <Link
                              key={m.id}
                              href={`/movies/${m.slug}`}
                              onClick={() => {
                                saveRecentSearch(m.title);
                                setSearchFocused(false);
                              }}
                              className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-[#FDEBD8] transition group"
                            >
                              <div className="h-12 w-9 rounded-lg bg-[#E6DCD2] shrink-0 overflow-hidden border border-[#E6DCD2]">
                                <img
                                  src={m.poster_url}
                                  alt={m.title}
                                  className="h-full w-full object-cover"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = 'none';
                                  }}
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-base font-bold text-[#1B1320] group-hover:text-[#C8102E] truncate">
                                  {m.title}
                                </div>
                                <div className="flex items-center gap-2 text-sm text-[#4A4056]">
                                  <span>{m.certificate}</span>
                                  <span>•</span>
                                  <span>{m.languages?.slice(0, 2).join(', ')}</span>
                                  {m.rating_avg > 0 && (
                                    <>
                                      <span>•</span>
                                      <span className="flex items-center gap-1 text-[#F2A900] font-bold">
                                        <Star className="h-3.5 w-3.5 fill-[#F2A900]" />
                                        {m.rating_avg.toFixed(1)}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Cinemas Section */}
                    {searchResults.cinemas && searchResults.cinemas.length > 0 && (
                      <div className="pt-2 border-t border-[#E6DCD2]">
                        <div className="text-sm font-bold uppercase tracking-wider text-[#4A4056] px-2 py-1 flex items-center gap-1.5">
                          <Building2 className="h-4 w-4 text-[#F2A900]" />
                          <span>Cinemas</span>
                        </div>
                        <div className="space-y-1 mt-1.5">
                          {searchResults.cinemas.map((c) => (
                            <Link
                              key={c.id}
                              href={`/cinemas/${c.id}`}
                              onClick={() => {
                                saveRecentSearch(c.name);
                                setSearchFocused(false);
                              }}
                              className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-[#FDEBD8] transition group"
                            >
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FDEBD8] text-[#C8102E] shrink-0">
                                <Building2 className="h-5 w-5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-base font-bold text-[#1B1320] group-hover:text-[#C8102E] truncate">
                                  {c.name}
                                </div>
                                <div className="text-sm text-[#4A4056] truncate">{c.address}</div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    {searchResults.total_results === 0 && (
                      <div className="p-4 text-center text-sm text-[#4A4056]">
                        No matches found for &ldquo;{searchQuery}&rdquo;
                      </div>
                    )}
                  </div>
                ) : recentSearches.length > 0 ? (
                  <div>
                    <div className="flex items-center justify-between px-2 py-1 text-sm font-bold uppercase tracking-wider text-[#4A4056]">
                      <span className="flex items-center gap-1.5">
                        <History className="h-4 w-4" />
                        Recent Searches
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setRecentSearches([]);
                          localStorage.removeItem('cineverse_recent_searches');
                        }}
                        className="text-[#C8102E] hover:underline text-sm font-semibold"
                      >
                        clear
                      </button>
                    </div>
                    <div className="mt-1.5 space-y-1">
                      {recentSearches.map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => {
                            setSearchQuery(item);
                            saveRecentSearch(item);
                            setSearchFocused(false);
                            router.push(`/movies?search=${encodeURIComponent(item)}`);
                          }}
                          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-[#1B1320] hover:bg-[#FDEBD8] transition"
                        >
                          <Search className="h-4 w-4 text-[#4A4056]" />
                          <span>{item}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 text-center text-sm text-[#4A4056]">
                    Type a movie title, cinema name, or genre...
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Simple Navigation Links & Account (< 6 visible items) */}
          <div className="flex items-center gap-4">
            <Link
              href="/movies"
              className="text-base font-semibold text-[#1B1320] hover:text-[#C8102E] px-3 py-2 rounded-lg transition min-h-[44px] flex items-center"
            >
              Movies
            </Link>

            <Link
              href="/cinemas"
              className="hidden sm:flex text-base font-semibold text-[#1B1320] hover:text-[#C8102E] px-3 py-2 rounded-lg transition min-h-[44px] items-center"
            >
              Cinemas
            </Link>

            <Link
              href="/profile"
              className="hidden sm:flex text-base font-semibold text-[#1B1320] hover:text-[#C8102E] px-3 py-2 rounded-lg transition min-h-[44px] items-center"
            >
              My Tickets
            </Link>

            {currentUser ? (
              <div className="flex items-center gap-2 pl-2 border-l border-[#E6DCD2]">
                <Link
                  href="/profile"
                  className="flex items-center gap-2 rounded-xl border border-[#E6DCD2] bg-[#FDEBD8] px-3.5 py-2 text-sm font-bold text-[#1B1320] hover:bg-[#fbdcb9] transition min-h-[44px]"
                  title="My Profile"
                >
                  <Ticket className="h-4 w-4 text-[#C8102E]" />
                  <span>{currentUser.full_name?.split(' ')[0] || 'Profile'}</span>
                </Link>

                {currentUser.role === 'admin' && (
                  <Link
                    href="/admin"
                    className="flex items-center justify-center rounded-xl bg-red-100 border border-red-300 p-2 text-[#C8102E] hover:bg-red-200 transition min-w-[44px] min-h-[44px]"
                    title="Admin Portal"
                  >
                    <ShieldCheck className="h-5 w-5" />
                  </Link>
                )}

                <button
                  onClick={handleLogout}
                  className="rounded-xl p-2.5 text-[#4A4056] hover:text-[#C8102E] hover:bg-[#FDEBD8] transition min-w-[44px] min-h-[44px] flex items-center justify-center"
                  title="Sign Out"
                  aria-label="Sign Out"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-[#C8102E] px-5 py-2.5 text-base font-bold text-white hover:bg-[#A60D26] active:bg-[#8B0A20] transition shadow-md min-h-[48px]"
              >
                <User className="h-5 w-5" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* City Modal */}
      <CityModal
        isOpen={isCityModalOpen}
        onClose={() => setIsCityModalOpen(false)}
        cities={cities}
        selectedCity={selectedCity}
        onSelectCity={handleSelectCity}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => {
          setIsAuthModalOpen(false);
          setCurrentUser(getStoredUser());
        }}
        onSuccess={(u) => {
          setCurrentUser(u);
          setIsAuthModalOpen(false);
        }}
      />
    </>
  );
}
