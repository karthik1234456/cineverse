import type { Metadata, Viewport } from 'next';
import './globals.css';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { Navbar } from '@/components/Navbar';
import { VoiceAgentFloatingButton } from '@/components/agent/VoiceAgentFloatingButton';
import { TrailerPlayer } from '@/components/TrailerPlayer';
import { MiniPlayerDock } from '@/components/MiniPlayerDock';
import { MovieBackdropProvider } from '@/context/MovieBackdropContext';
import { MovieBackdrop } from '@/components/backdrop/MovieBackdrop';

export const metadata: Metadata = {
  title: 'CineVerse — Experience The Theatre Before Booking Your Movie',
  description: 'Book movie tickets with real-time 3D seat preview, sightline POV comparison, and instant entry QR tickets.',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#C8102E',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="bg-[#FFF8F1] text-[#1B1320] text-base antialiased min-h-screen flex flex-col font-sans">
        <QueryProvider>
          <MovieBackdropProvider>
            {/* Fixed behind all content */}
            <MovieBackdrop />
            {/* Page chrome: z-10 so it sits above backdrop */}
            <Navbar />
            <main className="flex-1 flex flex-col relative z-10">{children}</main>
            {/* Footer */}
            <footer className="mt-auto border-t border-[#E6DCD2] bg-white py-8 px-4 text-center text-sm text-[#4A4056] relative z-10">
              <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl font-black text-[#C8102E]">CINEVERSE</span>
                  <span className="text-sm">· Experience the theatre before booking</span>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-medium">
                  <a href="/movies" className="hover:text-[#C8102E] transition">Movies</a>
                  <a href="/cinemas" className="hover:text-[#C8102E] transition">Cinemas</a>
                  <a href="/profile" className="hover:text-[#C8102E] transition">My Tickets</a>
                  <a href="/support" className="hover:text-[#C8102E] transition">Support</a>
                  <a href="/legal/terms" className="hover:text-[#C8102E] transition">Terms</a>
                  <a href="/legal/privacy" className="hover:text-[#C8102E] transition">Privacy (DPDP)</a>
                  <a href="/legal/refunds" className="hover:text-[#C8102E] transition">Refunds</a>
                  <span className="text-[#E6DCD2] hidden md:inline">|</span>
                  <span>© 2026 CineVerse Cinemas India</span>
                </div>
              </div>
            </footer>
            <VoiceAgentFloatingButton />
            <TrailerPlayer />
            <MiniPlayerDock />
          </MovieBackdropProvider>
        </QueryProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function(err) {
                    console.debug('ServiceWorker registration omitted:', err);
                  });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
