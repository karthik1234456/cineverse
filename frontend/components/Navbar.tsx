// components/Navbar.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MapPin, Search, User, LogOut, Ticket, ShieldCheck, Film, Compass } from 'lucide-react';
import { CityModal } from './CityModal';
import { AuthModal } from './AuthModal';
import type { City } from '@/services/api';
import { getCities, getStoredUser, logoutUser } from '@/services/api';

export function Navbar() {
  const router = useRouter();
  const [cities, setCities] = useState<City[]>([]);
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [isCityModalOpen, setIsCityModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // Load cities
    getCities()
      .then((data) => {
        setCities(data);
        const storedCitySlug = localStorage.getItem('cineverse_city');
        const matched = data.find((c) => c.slug === storedCitySlug);
        setSelectedCity(matched || data[0] || null);
      })
      .catch((err) => console.warn('Failed to load cities:', err));

    setCurrentUser(getStoredUser());
  }, []);

  function handleSelectCity(city: City) {
    setSelectedCity(city);
    localStorage.setItem('cineverse_city', city.slug);
    localStorage.setItem('cineverse_city_id', city.id.toString());
    // Trigger custom event so page components refresh data
    window.dispatchEvent(new CustomEvent('cityChanged', { detail: city }));
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) {
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
            >
              <MapPin className="h-3.5 w-3.5 text-[#e50914]" />
              <span>{selectedCity ? selectedCity.name : 'Select City'}</span>
            </button>
          </div>

          {/* Search bar */}
          <form onSubmit={handleSearchSubmit} className="hidden md:flex flex-1 max-w-md mx-6">
            <div className="relative w-full">
              <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Search movies, cinemas, genres..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-full border border-white/10 bg-[#16181f] py-2 pl-10 pr-4 text-xs text-white placeholder-zinc-500 focus:border-[#e50914] focus:outline-none transition shadow-inner"
              />
            </div>
          </form>

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
                className="flex items-center gap-1.5 rounded-lg bg-[#e50914] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-red-700 transition shadow-lg shadow-red-950/40"
              >
                <User className="h-3.5 w-3.5" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <CityModal
        isOpen={isCityModalOpen}
        onClose={() => setIsCityModalOpen(false)}
        cities={cities}
        selectedCity={selectedCity}
        onSelectCity={handleSelectCity}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={(user) => setCurrentUser(user)}
      />
    </>
  );
}

