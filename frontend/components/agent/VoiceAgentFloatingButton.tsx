// frontend/components/agent/VoiceAgentFloatingButton.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Mic, Sparkles } from 'lucide-react';
import { VoiceAgentModal } from './VoiceAgentModal';

export function VoiceAgentFloatingButton() {
  const [isOpen, setIsOpen] = useState(false);

  // Global hotkey: Alt + V to toggle voice agent
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setIsOpen(true)}
          data-testid="voice-agent-floating-trigger"
          aria-label="Open CineVerse Voice Assistant (Shortcut: Alt+V)"
          className="group relative flex items-center gap-2.5 rounded-full bg-gradient-to-r from-[#e50914] to-red-700 px-4 py-3 text-white shadow-2xl shadow-red-950/60 transition-all duration-300 hover:scale-105 hover:shadow-red-600/40 active:scale-95 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-[#0b0c10]"
        >
          {/* Animated pulse ring */}
          <span className="absolute -inset-1 rounded-full bg-red-600/30 blur-sm group-hover:bg-red-600/50 transition animate-pulse" />

          <div className="relative flex items-center gap-2">
            <Mic className="h-5 w-5 text-white" />
            <span className="hidden sm:inline text-xs font-bold tracking-wide">Ask CineVerse</span>
            <div className="hidden lg:flex items-center gap-0.5 rounded bg-black/30 px-1.5 py-0.5 text-[9px] font-mono text-zinc-300 border border-white/10">
              Alt+V
            </div>
          </div>
        </button>
      </div>

      <VoiceAgentModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}

