// components/Navbar.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  MapPin, Search, User, LogOut, Ticket, ShieldCheck,
  Film, Compass, History, X, Star, Building2
} from 'lucide-react';
import { CityModal } from './CityModal';
import { AuthModal } from './AuthModal';
import type { City, SearchResult } from '@/services/api';
import { getCities, getStoredUser, logoutUser, globalSearch } from '@/services/api';

export function Navbar() {
  const router = useRouter();
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
          // Prompt city modal if never selected
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

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-[#0b0c10]/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo & City Selector */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 group">
              <span className="text-2xl font-black tracking-wider text-[#e50914] drop-shadow-[0_0_12px_rgba(229,9,20,0.5)]">
                CINEVERSE
              </span>
            </Link>

            <button
              onClick={() => setIsCityModalOpen(true)}
              className="hidden sm:flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:border-white/25 hover:bg-white/10 transition"
              data-testid="city-selector-button"
            >
              <MapPin className="h-3.5 w-3.5 text-[#e50914]" />
              <span>{selectedCity ? selectedCity.name : 'Select City'}</span>
            </button>
          </div>

          {/* Interactive Search Bar with Autocomplete Dropdown */}
          <div ref={searchContainerRef} className="relative hidden md:flex flex-1 max-w-md mx-6">
            <form onSubmit={handleSearchSubmit} className="w-full">
              <div className="relative w-full">
                <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search movies, cinemas, genres..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  className="w-full rounded-full border border-white/10 bg-[#16181f] py-2 pl-10 pr-9 text-xs text-white placeholder-zinc-500 focus:border-[#e50914] focus:outline-none transition shadow-inner"
                  data-testid="global-search-input"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSearchResults(null);
                    }}
                    className="absolute right-3 top-2.5 text-zinc-500 hover:text-zinc-300"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </form>

            {/* Suggestions / Recent Searches Dropdown */}
            {searchFocused && (
              <div
                className="absolute left-0 right-0 top-11 rounded-2xl border border-white/10 bg-[#14161f] p-3 shadow-2xl backdrop-blur-xl z-50 overflow-hidden"
                data-testid="search-suggestions-dropdown"
              >
                {searchLoading ? (
                  <div className="p-3 text-center text-xs text-zinc-400">Searching catalog...</div>
                ) : searchResults ? (
                  <div className="space-y-3">
                    {/* Movies Section */}
                    {searchResults.movies && searchResults.movies.length > 0 && (
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-2 py-1 flex items-center gap-1">
                          <Film className="h-3 w-3 text-[#e50914]" />
                          <span>Movies</span>
                        </div>
                        <div className="space-y-1 mt-1">
                          {searchResults.movies.map((m) => (
                            <Link
                              key={m.id}
                              href={`/movies/${m.slug}`}
                              onClick={() => {
                                saveRecentSearch(m.title);
                                setSearchFocused(false);
                              }}
                              className="flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 hover:bg-white/10 transition group"
                            >
                              <div className="h-10 w-7 rounded bg-zinc-800 shrink-0 overflow-hidden">
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
                                <div className="text-xs font-bold text-white group-hover:text-[#e50914] truncate">
                                  {m.title}
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                                  <span>{m.certificate}</span>
                                  <span>•</span>
                                  <span>{m.languages?.slice(0, 2).join(', ')}</span>
                                  {m.rating_avg > 0 && (
                                    <>
                                      <span>•</span>
                                      <span className="flex items-center gap-0.5 text-amber-400 font-bold">
                                        <Star className="h-2.5 w-2.5 fill-amber-400" />
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
                      <div className="pt-2 border-t border-white/5">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-2 py-1 flex items-center gap-1">
                          <Building2 className="h-3 w-3 text-amber-400" />
                          <span>Cinemas</span>
                        </div>
                        <div className="space-y-1 mt-1">
                          {searchResults.cinemas.map((c) => (
                            <Link
                              key={c.id}
                              href={`/cinemas/${c.id}`}
                              onClick={() => {
                                saveRecentSearch(c.name);
                                setSearchFocused(false);
                              }}
                              className="flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 hover:bg-white/10 transition group"
                            >
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-600/10 text-red-400 shrink-0">
                                <Building2 className="h-4 w-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold text-white group-hover:text-red-400 truncate">
                                  {c.name}
                                </div>
                                <div className="text-[10px] text-zinc-400 truncate">{c.address}</div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    {searchResults.total_results === 0 && (
                      <div className="p-4 text-center text-xs text-zinc-400">
                        No matches found for &ldquo;{searchQuery}&rdquo;
                      </div>
                    )}
                  </div>
                ) : recentSearches.length > 0 ? (
                  <div>
                    <div className="flex items-center justify-between px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      <span className="flex items-center gap-1">
                        <History className="h-3 w-3" />
                        Recent Searches
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setRecentSearches([]);
                          localStorage.removeItem('cineverse_recent_searches');
                        }}
                        className="text-zinc-500 hover:text-zinc-300 lowercase text-[10px]"
                      >
                        clear
                      </button>
                    </div>
                    <div className="mt-1 space-y-0.5">
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
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-zinc-300 hover:bg-white/10 hover:text-white transition"
                        >
                          <Search className="h-3 w-3 text-zinc-500" />
                          <span>{item}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 text-center text-xs text-zinc-500">
                    Type a movie title, cinema name, or genre...
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Nav links & Account */}
          <div className="flex items-center gap-3">
            <Link
              href="/movies"
              className="text-xs font-medium text-zinc-300 hover:text-white px-2 py-1 transition"
            >
              Movies
            </Link>

            <Link
              href="/cinemas"
              className="hidden sm:inline-block text-xs font-medium text-zinc-300 hover:text-white px-2 py-1 transition"
            >
              Cinemas
            </Link>

            <Link
              href="/cinemas/1/auditorium/1?showtime=1"
              className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-red-600/30 to-amber-600/30 border border-[#e50914]/40 px-3 py-1 text-xs font-semibold text-white hover:from-red-600/50 hover:to-amber-600/50 transition shadow-[0_0_15px_rgba(229,9,20,0.25)]"
            >
              <Compass className="h-3.5 w-3.5 text-amber-400" />
              <span>3D Preview</span>
            </Link>

            {currentUser ? (
              <div className="flex items-center gap-2 pl-2 border-l border-white/10">
                <Link
                  href="/profile"
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-zinc-200 hover:bg-white/10 transition"
                  title="My Profile & Bookings"
                >
                  <Ticket className="h-3.5 w-3.5 text-[#e50914]" />
                  <span className="hidden md:inline">{currentUser.full_name?.split(' ')[0] || 'Profile'}</span>
                </Link>

                {currentUser.role === 'admin' && (
                  <Link
                    href="/admin"
                    className="flex items-center gap-1 rounded-lg bg-red-950/80 border border-red-500/40 px-2 py-1.5 text-xs font-medium text-red-200 hover:bg-red-900 transition"
                    title="Admin Portal"
                  >
                    <ShieldCheck className="h-3.5 w-3.5 text-red-400" />
                  </Link>
                )}

                <button
                  onClick={handleLogout}
                  className="rounded-lg p-1.5 text-zinc-400 hover:text-white hover:bg-white/5 transition"
                  title="Sign Out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="flex items-center gap-1.5 rounded-full bg-[#e50914] px-4 py-1.5 text-xs font-bold text-white hover:bg-red-700 transition shadow-lg shadow-red-950/50"
              >
                <User className="h-3.5 w-3.5" />
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
