'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Ticket, Lock } from 'lucide-react';

function CheckoutContent() {
  const searchParams = useSearchParams();
  const seatsParam = searchParams.get('seats') || '';
  const totalParam = searchParams.get('total') || '0';
  const seats = seatsParam ? seatsParam.split(',') : [];

  return (
    <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-[#0e1117] p-8 shadow-2xl">
      <div className="mb-6 flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#e50914] shadow-[0_0_8px_#e50914]" />
          <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">
            CineVerse 3D
          </span>
        </div>

        <span className="rounded-full bg-amber-950/60 border border-amber-600/40 px-2.5 py-1 text-[11px] font-semibold text-amber-300">
          Phase 4 Next-Phase Stub
        </span>
      </div>

      <h1 className="text-2xl font-black text-white">Checkout Handoff</h1>
      <p className="mt-2 text-xs leading-relaxed text-slate-400">
        This checkout page is the designated boundary for <strong>Phase 3 (3D Auditorium Experience)</strong>.
        Payments, customer authentication, and ticket issuance will be built in Phase 4.
      </p>

      {/* Selected Seats summary from state */}
      <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1.5 font-medium">
            <Ticket className="h-4 w-4 text-[#e50914]" />
            Selected Seats ({seats.length})
          </span>
          <span className="font-bold text-white text-base">₹{totalParam}</span>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {seats.length > 0 ? (
            seats.map((id) => (
              <span
                key={id}
                className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-1 text-xs font-bold text-red-200"
              >
                {id}
              </span>
            ))
          ) : (
            <span className="text-xs text-slate-500 italic">No seats in query state</span>
          )}
        </div>
      </div>

      <div className="mt-6 flex items-center gap-2 text-xs text-slate-500">
        <Lock className="h-3.5 w-3.5 text-slate-400" />
        <span>Payment gateways (Razorpay/Stripe) and order creation disabled in this phase.</span>
      </div>

      <div className="mt-8 flex gap-3">
        <Link
          href="/3d"
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 py-3 text-xs font-semibold text-slate-200 transition hover:bg-slate-700 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Return to 3D Auditorium</span>
        </Link>
      </div>
    </div>
  );
}

export default function CheckoutStubPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#07080a] p-6 text-white">
      <Suspense fallback={<div className="text-slate-400 text-sm">Loading checkout...</div>}>
        <CheckoutContent />
      </Suspense>
    </div>
  );
}
