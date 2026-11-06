// app/booking/[id]/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  CheckCircle2, Printer, Calendar,
  ArrowLeft, ShieldCheck, MapPin, XCircle
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
    return <div className="p-16 text-center text-lg font-medium text-slate-600">Loading booking receipt...</div>;
  }

  if (!booking) {
    return (
      <div className="p-16 text-center text-slate-600">
        <p className="text-xl font-bold text-[#1B1320]">Booking not found</p>
        <Link href="/" className="mt-4 inline-block text-base font-bold text-[#C8102E] underline">
          Return Home
        </Link>
      </div>
    );
  }

  const isCancelled = booking.status === 'CANCELLED';

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8 w-full text-[#1B1320] space-y-8">
      {/* Top Status Banner */}
      <div className={`rounded-3xl border-2 p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm ${
        isCancelled
          ? 'border-rose-300 bg-rose-50 text-rose-900'
          : 'border-emerald-300 bg-emerald-50 text-emerald-900'
      }`}>
        <div className="flex items-center gap-4 text-center sm:text-left">
          <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${
            isCancelled ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-700'
          }`}>
            {isCancelled ? <XCircle className="h-7 w-7" /> : <CheckCircle2 className="h-7 w-7" />}
          </div>
          <div>
            <div className="text-sm font-bold uppercase tracking-wider">
              {isCancelled ? 'Booking Cancelled & Refunded' : 'Booking Confirmed'}
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[#1B1320] mt-0.5">
              Admission Code: {booking.booking_code}
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Confirmation sent to {booking.contact_email} and {booking.contact_phone}
            </p>
          </div>
        </div>

        {!isCancelled && (
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 border border-emerald-300 px-4 py-1.5 text-sm font-bold text-emerald-800">
            <ShieldCheck className="h-4 w-4" />
            <span>Gate Ready</span>
          </span>
        )}
      </div>

      {cancelNotice && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          {cancelNotice}
        </div>
      )}

      {/* Main E-Ticket Display */}
      <div className="rounded-3xl border border-[#E6DCD2] bg-white p-8 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row gap-6 items-center justify-between pb-6 border-b border-[#E6DCD2]">
          <div>
            <span className="rounded-lg bg-rose-50 px-3 py-1 text-sm font-bold text-[#9F1239] border border-rose-200">
              {booking.screen_type}
            </span>
            <h2 className="text-2xl font-black text-[#1B1320] mt-2">{booking.movie_title}</h2>
            <p className="text-sm text-slate-600 flex items-center gap-1.5 mt-1">
              <MapPin className="h-4 w-4 text-slate-400" />
              <span>{booking.cinema_name} • {booking.auditorium_name}</span>
            </p>
            <div className="text-sm font-bold text-slate-700 mt-2">
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
            <div className="flex flex-col items-center rounded-2xl border border-[#E6DCD2] bg-[#FAF6F0] p-4 text-center">
              <img
                src={booking.ticket.qr_code_url}
                alt="Ticket QR Code"
                className="h-36 w-36 rounded-xl border border-[#E6DCD2]"
              />
              <span className="font-mono text-sm font-bold text-slate-700 mt-2">
                {booking.ticket.ticket_number}
              </span>
              <span className="text-sm text-slate-500">Scan at entrance turnstile</span>
            </div>
          )}
        </div>

        {/* Seat breakdown & Pricing */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="space-y-1.5">
            <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Seats Confirmed ({booking.seats.length})</span>
            <div className="flex flex-wrap gap-2 pt-1">
              {booking.seats.map((s) => (
                <span
                  key={s.seat_id}
                  className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-bold text-[#9F1239]"
                >
                  {s.seat_id} ({s.category})
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-1 sm:text-right">
            <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Amount Paid</span>
            <div className="text-3xl font-black text-[#C8102E]">₹{Math.round(booking.final_total_amount)}</div>
            <div className="text-sm text-slate-500">Inclusive of taxes & convenience fee</div>
          </div>
        </div>

        {/* Addons if any */}
        {booking.addons && booking.addons.length > 0 && (
          <div className="pt-4 border-t border-[#E6DCD2]">
            <span className="text-sm text-slate-700 font-bold">Pre-Booked Concessions:</span>
            <div className="mt-2 space-y-1.5">
              {booking.addons.map((a) => (
                <div key={a.fnb_item_id} className="flex justify-between text-sm text-slate-600">
                  <span>{a.quantity}x {a.name}</span>
                  <span className="font-bold text-[#1B1320]">₹{Math.round(a.total_price)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions bar */}
        <div className="pt-6 border-t border-[#E6DCD2] flex flex-wrap items-center justify-between gap-4">
          <div className="flex gap-3">
            <a
              href={`/api/v1/tickets/${booking.booking_code}/print`}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-[44px] items-center gap-2 rounded-xl border border-[#E6DCD2] bg-[#FAF6F0] px-5 py-2.5 text-sm font-bold text-[#1B1320] hover:bg-slate-100 transition shadow-sm"
            >
              <Printer className="h-4 w-4" />
              <span>Print Ticket</span>
            </a>

            <button
              onClick={handleAddToCalendar}
              className="flex min-h-[44px] items-center gap-2 rounded-xl border border-[#E6DCD2] bg-[#FAF6F0] px-5 py-2.5 text-sm font-bold text-[#1B1320] hover:bg-slate-100 transition shadow-sm"
            >
              <Calendar className="h-4 w-4" />
              <span>Add to Calendar</span>
            </button>
          </div>

          {!isCancelled && (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="text-sm font-semibold text-slate-500 hover:text-rose-600 underline transition disabled:opacity-50"
            >
              {cancelling ? 'Cancelling...' : 'Cancel Booking & Refund'}
            </button>
          )}
        </div>
      </div>

      <div className="text-center pt-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-base font-bold text-[#C8102E] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Browse More Movies</span>
        </Link>
      </div>
    </div>
  );
}
