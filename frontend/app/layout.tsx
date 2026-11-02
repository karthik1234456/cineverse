import type { Metadata } from 'next';
import './globals.css';
import { QueryProvider } from '@/components/providers/QueryProvider';

export const metadata: Metadata = {
  title: 'CineVerse 3D — Experience the theatre before booking your movie',
  description: 'Interactive 3D auditorium seat exploration and POV sightline viewer.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#07080a] text-slate-100 antialiased overflow-hidden select-none">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
