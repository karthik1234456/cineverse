'use client';

import React, { useEffect, useState } from 'react';

export function PwaUpdatePrompt() {
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handleUpdate = () => {
      setShowPrompt(true);
    };

    window.addEventListener('cineverse-pwa-update-available', handleUpdate);
    return () => window.removeEventListener('cineverse-pwa-update-available', handleUpdate);
  }, []);

  if (!showPrompt) return null;

  const handleRefresh = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    }
    window.location.reload();
  };

  return (
    <aside
      role="status"
      aria-label="Application update"
      className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-[#181124] text-white border border-[#C8102E]/60 shadow-2xl rounded-full px-5 py-2.5 flex items-center gap-4 text-xs font-medium animate-in fade-in slide-in-from-bottom-4 duration-300"
    >
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-[#E50914] animate-ping" />
        <span>New version available</span>
      </div>
      <button
        onClick={handleRefresh}
        className="bg-[#C8102E] hover:bg-[#a00c24] text-white px-3 py-1 rounded-full font-semibold transition cursor-pointer"
      >
        Refresh
      </button>
      <button
        onClick={() => setShowPrompt(false)}
        className="text-[#9C93A8] hover:text-white px-1 cursor-pointer"
        aria-label="Dismiss update notification"
      >
        ✕
      </button>
    </aside>
  );
}
