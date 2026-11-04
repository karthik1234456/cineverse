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

  const isDirectVideo = trailerUrl && (
    trailerUrl.endsWith('.mp4') ||
    trailerUrl.endsWith('.webm') ||
    trailerUrl.endsWith('.ogv') ||
    trailerUrl.startsWith('/trailers/')
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="relative w-full max-w-4xl rounded-2xl border border-[#E6DCD2] bg-white p-4 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-[#E6DCD2] mb-3">
          <h3 className="text-xl font-bold text-[#1B1320]">{title} — Official Trailer</h3>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-[#4A4056] hover:bg-[#FDEBD8] hover:text-[#1B1320] transition min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close trailer"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
          {isDirectVideo ? (
            <video
              src={trailerUrl}
              controls
              autoPlay
              playsInline
              className="h-full w-full object-contain"
            />
          ) : trailerUrl && trailerUrl.includes('youtube') ? (
            <iframe
              src={trailerUrl.replace('watch?v=', 'embed/')}
              title={`${title} Trailer`}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-white text-base">
              Trailer not available
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
