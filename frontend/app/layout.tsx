import type { Metadata } from 'next';
import './globals.css';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { Navbar } from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'CineVerse — Movie Tickets & Real 3D Auditorium Seat Preview',
  description: 'Book movie tickets with real-time 3D seat preview, sightline POV comparison, and instant entry QR tickets.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0b0c10] text-slate-100 antialiased min-h-screen flex flex-col">
        <QueryProvider>
          <Navbar />
          <main className="flex-1 flex flex-col">{children}</main>
        </QueryProvider>
      </body>
    </html>
  );
}
