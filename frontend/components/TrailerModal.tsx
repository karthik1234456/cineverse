// components/TrailerModal.tsx
'use client';

import React from 'react';
import { X } from 'lucide-react';

interface TrailerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  trailerUrl?: string;
}

export function TrailerModal({ isOpen, onClose, title, trailerUrl }: TrailerModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
      <div className="relative w-full max-w-4xl rounded-2xl border border-white/10 bg-[#16181f] p-4 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
          <h3 className="text-base font-bold text-white">{title} — Official Trailer</h3>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
          {/* Lazy iframe embed */}
          <iframe
            src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1"
            title={`${title} Trailer`}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
}

