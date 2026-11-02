// app/booking/[id]/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  CheckCircle2, Ticket, QrCode, Printer, Calendar,
  Share2, ArrowLeft, ShieldCheck, MapPin, AlertCircle, XCircle
} from 'lucide-react';
import { getBooking, cancelBooking, type BookingResponse } from '@/services/api';

export default function BookingConfirmationPage() {
  const params = useParams();
  const bookingId = params.id as string;

  const [booking, setBooking] = useState<BookingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [cancelNotice, setCancelNotice] = useState<string | null>(null);

  useEffect(() => {
    getBooking(bookingId)
      .then((b) => setBooking(b))
      .catch((err) => console.warn(err))
      .finally(() => setLoading(false));
  }, [bookingId]);

  async function handleCancel() {
    if (!confirm('Are you sure you want to cancel this booking? A 75% refund will be credited per cinema policy.')) {
      return;
    }

    setCancelling(true);
    try {
      const res = await cancelBooking(bookingId);
      setCancelNotice(res.message);
      // Reload booking
      const updated = await getBooking(bookingId);
      setBooking(updated);
    } catch (err: any) {
      alert(err.message || 'Cancellation failed.');
    } finally {
      setCancelling(false);
    }
  }

  function handleAddToCalendar() {
    if (!booking) return;
    const startDate = new Date(booking.start_time);
    const endDate = new Date(startDate.getTime() + 2.5 * 60 * 60 * 1000);

    const pad = (n: number) => String(n).padStart(2, '0');
    const formatIcs = (d: Date) =>
      `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      `SUMMARY:${booking.movie_title} at ${booking.cinema_name}`,
      `DESCRIPTION:Seats: ${booking.seats.map((s) => s.seat_id).join(', ')}. Booking Code: ${booking.booking_code}`,
      `LOCATION:${booking.cinema_address}`,
      `DTSTART:${formatIcs(startDate)}`,
      `DTEND:${formatIcs(endDate)}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${booking.booking_code}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  if (loading && !booking) {
    return <div className="p-12 text-center text-zinc-400">Loading booking receipt...</div>;
  }

  if (!booking) {
    return (
      <div className="p-12 text-center text-zinc-400">
        Booking not found. <Link href="/" className="text-[#e50914] underline">Return Home</Link>
      </div>
    );
  }

  const isCancelled = booking.status === 'CANCELLED';

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8 w-full text-white space-y-8">
      {/* Top Status Banner */}
      <div className={`rounded-2xl border p-6 flex flex-col sm:flex-row items-center justify-between gap-4 ${
        isCancelled
          ? 'border-red-500/40 bg-red-950/20 text-red-200'
          : 'border-emerald-500/40 bg-emerald-950/20 text-emerald-200'
      }`}>
        <div className="flex items-center gap-4 text-center sm:text-left">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
            isCancelled ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
          }`}>
            {isCancelled ? <XCircle className="h-6 w-6" /> : <CheckCircle2 className="h-6 w-6" />}
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider">
              {isCancelled ? 'Booking Cancelled & Refunded' : 'Booking Confirmed'}
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white mt-0.5">
              Admission Code: {booking.booking_code}
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              Confirmation sent to {booking.contact_email} and {booking.contact_phone}
            </p>
          </div>
        </div>

        {!isCancelled && (
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 px-3 py-1 text-xs font-bold text-emerald-400">
            <ShieldCheck className="h-4 w-4" />
            <span>Gate Ready</span>
          </span>
        )}
      </div>

      {cancelNotice && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/30 p-4 text-xs text-amber-300">
          {cancelNotice}
        </div>
      )}

      {/* Main E-Ticket Display */}
      <div className="rounded-2xl border border-white/10 bg-[#12131a] p-8 shadow-2xl space-y-6">
        <div className="flex flex-col md:flex-row gap-6 items-center justify-between pb-6 border-b border-white/10">
          <div>
            <span className="rounded bg-red-600/20 px-2.5 py-0.5 text-[10px] font-bold text-red-400 border border-red-500/30">
              {booking.screen_type}
            </span>
            <h2 className="text-2xl font-black text-white mt-2">{booking.movie_title}</h2>
            <p className="text-xs text-zinc-400 flex items-center gap-1.5 mt-1">
              <MapPin className="h-3.5 w-3.5 text-zinc-500" />
              <span>{booking.cinema_name} • {booking.auditorium_name}</span>
            </p>
            <div className="text-xs font-semibold text-zinc-300 mt-2">
              {new Date(booking.start_time).toLocaleString('en-US', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
              })}
            </div>
          </div>

          {/* QR Code Container */}
          {booking.ticket && (
            <div className="flex flex-col items-center rounded-2xl border border-white/10 bg-[#0f1014] p-4 text-center">
              <img
                src={booking.ticket.qr_code_url}
                alt="Ticket QR Code"
                className="h-36 w-36 rounded-xl"
              />
              <span className="font-mono text-[11px] font-bold text-zinc-400 mt-2">
                {booking.ticket.ticket_number}
              </span>
              <span className="text-[10px] text-zinc-500">Scan at entrance turnstile</span>
            </div>
          )}
        </div>

        {/* Seat breakdown & Pricing */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="space-y-1">
            <span className="text-zinc-500">SEATS CONFIRMED ({booking.seats.length})</span>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {booking.seats.map((s) => (
                <span
                  key={s.seat_id}
                  className="rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-1 text-xs font-bold text-red-200"
                >
                  {s.seat_id} ({s.category})
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-1 text-right">
            <span className="text-zinc-500">AMOUNT PAID</span>
            <div className="text-2xl font-black text-white">₹{booking.final_total_amount}</div>
            <div className="text-[10px] text-zinc-500">Inclusive of taxes & convenience fee</div>
          </div>
        </div>

        {/* Addons if any */}
        {booking.addons && booking.addons.length > 0 && (
          <div className="pt-4 border-t border-white/5">
            <span className="text-xs text-zinc-500 font-semibold">PRE-BOOKED CONCESSIONS:</span>
            <div className="mt-2 space-y-1">
              {booking.addons.map((a) => (
                <div key={a.fnb_item_id} className="flex justify-between text-xs text-zinc-300">
                  <span>{a.quantity}x {a.name}</span>
                  <span className="font-bold">₹{a.total_price}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions bar */}
        <div className="pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <a
              href={`/api/v1/tickets/${booking.booking_code}/print`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white hover:bg-white/10 transition"
            >
              <Printer className="h-4 w-4" />
              <span>Print Ticket</span>
            </a>

            <button
              onClick={handleAddToCalendar}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white hover:bg-white/10 transition"
            >
              <Calendar className="h-4 w-4" />
              <span>Add to Calendar</span>
            </button>
          </div>

          {!isCancelled && (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="text-xs text-zinc-500 hover:text-red-400 underline transition disabled:opacity-50"
            >
              {cancelling ? 'Cancelling...' : 'Cancel Booking & Refund'}
            </button>
          )}
        </div>
      </div>

      <div className="text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-bold text-[#e50914] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Browse More Movies</span>
        </Link>
      </div>
    </div>
  );
}

