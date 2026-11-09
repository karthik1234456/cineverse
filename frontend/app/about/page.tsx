'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Film, ShieldCheck, Database, Video } from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#FFF8F1] text-[#1B1320] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto w-full space-y-10">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-[#1B1320] transition"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Home</span>
        </Link>

        <div>
          <span className="text-xs font-black tracking-widest text-[#C8102E] uppercase">
            Platform Transparency & Compliance
          </span>
          <h1 className="text-3xl sm:text-5xl font-black text-[#1B1320] mt-2 tracking-tight">
            About CineVerse & Catalogue Licensing
          </h1>
          <p className="text-lg text-slate-600 mt-3 leading-relaxed">
            Experience the cinema theatre in 3D, compare sightlines, and book seats with confidence.
          </p>
        </div>

        {/* Demo Notice Banner */}
        <div
          data-testid="demo-showtimes-banner"
          className="rounded-3xl border-2 border-amber-300 bg-amber-50 p-6 sm:p-8 space-y-3"
        >
          <div className="flex items-center gap-2.5 text-amber-900 font-bold text-lg">
            <span className="text-xl">⚠️</span>
            <h2>Sample Demonstration Schedule Notice</h2>
          </div>
          <p className="text-base text-amber-900/90 leading-relaxed">
            All showtimes, auditoriums, seating layouts, and ticket prices displayed across CineVerse are
            <strong> sample demonstration schedules</strong> designed for testing and prototype evaluation.
            They do not represent live real-world theatre operating schedules.
          </p>
        </div>

        {/* TMDB Attribution Section */}
        <div className="rounded-3xl border border-[#E6DCD2] bg-white p-7 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-center gap-4">
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0d253f] text-white font-black text-sm tracking-wider"
              aria-label="TMDB Logo"
            >
              <span className="text-[#01b4e4]">THE</span>
              <span className="text-[#90cea1]">MOVIE</span>
              <span className="text-white">DB</span>
            </div>
            <h3 className="text-xl font-bold text-[#1B1320]">The Movie Database (TMDB) Attribution</h3>
          </div>

          <p className="text-base text-slate-700 leading-relaxed font-medium">
            This product uses the TMDB API but is not endorsed or certified by TMDB.
          </p>

          <p className="text-sm text-slate-600 leading-relaxed">
            Movie metadata, synopses, cast information, poster imagery, and backdrop links are fetched via the TMDB API
            under their developer terms of service. TMDB API keys are secured strictly on server environments and are never
            exposed in client bundles or public endpoints.
          </p>
        </div>

        {/* YouTube Trailers & Privacy Section */}
        <div className="rounded-3xl border border-[#E6DCD2] bg-white p-7 sm:p-8 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-100 text-[#C8102E]">
              <Video className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-[#1B1320]">Trailers & Third-Party Video</h3>
          </div>
          <p className="text-base text-slate-700 leading-relaxed">
            All official movie trailers are embedded strictly on user request through YouTube's privacy-enhanced domain
            (<code className="bg-slate-100 px-2 py-0.5 rounded text-sm text-[#C8102E]">youtube-nocookie.com</code>)
            inside a sandboxed, visible pop-up player. CineVerse does not download, re-host, or repurpose third-party videos
            as 3D textures or background loops.
          </p>
        </div>

        {/* Licensing Guard & Commercial Notice */}
        <div className="rounded-3xl border border-[#E6DCD2] bg-white p-7 sm:p-8 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-800">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-[#1B1320]">Licensing Guard</h3>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            The free TMDB tier is utilized strictly for non-commercial demonstration and educational development. A commercial
            production launch requires formal commercial licensing agreements with content distributors and cinema exhibitors.
          </p>
        </div>
      </div>
    </div>
  );
}

