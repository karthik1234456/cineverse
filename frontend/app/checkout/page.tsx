// app/checkout/page.tsx
'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft, Ticket, ShieldCheck, Tag, CreditCard,
  CheckCircle2, AlertCircle, Loader2, Lock, Sparkles
} from 'lucide-react';
import { HoldTimer } from '@/components/HoldTimer';
import {
  getShowtimeSeats, validateCoupon, createBooking,
  createRazorpayOrder, verifyPayment, getFnbAddons,
  type ShowtimeSeatsResponse, type FnbItem
} from '@/services/api';

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const showtimeIdStr = searchParams.get('showtime') || '1';
  const showtimeId = parseInt(showtimeIdStr, 10) || 1;
  const seatsParam = searchParams.get('seats') || '';
  const holdId = searchParams.get('hold_id') || `hold_test_${Date.now()}`;
  const addonsParam = searchParams.get('addons');

  const selectedSeats = seatsParam ? seatsParam.split(',').filter(Boolean) : [];
  const selectedAddons: { fnb_item_id: number; quantity: number }[] = addonsParam
    ? JSON.parse(decodeURIComponent(addonsParam))
    : [];

  const [showtimeData, setShowtimeData] = useState<ShowtimeSeatsResponse | null>(null);
  const [fnbItems, setFnbItems] = useState<FnbItem[]>([]);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number; message: string } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [email, setEmail] = useState('patron@example.com');
  const [phone, setPhone] = useState('9876543212');
  const [isProcessing, setIsProcessing] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  useEffect(() => {
    // Load showtime and addons info
    getShowtimeSeats(showtimeId)
      .then((data) => setShowtimeData(data))
      .catch((err) => console.warn(err));

    getFnbAddons()
      .then((items) => setFnbItems(items))
      .catch((err) => console.warn(err));
  }, [showtimeId]);

  // Compute pricing
  const ticketPrices = selectedSeats.map((sId) => {
    const s = showtimeData?.seats.find((item) => item.seat_id === sId);
    return s ? s.price : 380.0;
  });

  const ticketSubtotal = ticketPrices.reduce((a, b) => a + b, 0);
  const convenienceFee = selectedSeats.length * 35.0;
  const gstAmount = Math.round((convenienceFee * 0.18) * 100) / 100;

  const fnbSubtotal = selectedAddons.reduce((acc, addon) => {
    const item = fnbItems.find((i) => i.id === addon.fnb_item_id);
    return acc + (item ? item.price * addon.quantity : 0);
  }, 0);

  const discountAmount = appliedCoupon ? appliedCoupon.discount : 0.0;
  const grandTotal = Math.max(0, ticketSubtotal + convenienceFee + gstAmount + fnbSubtotal - discountAmount);

  async function handleApplyCoupon() {
    if (!couponCode.trim()) return;
    setCouponError(null);
    try {
      const res = await validateCoupon(couponCode.trim().toUpperCase(), ticketSubtotal);
      if (res.valid) {
        setAppliedCoupon({ code: res.code, discount: res.discount_amount, message: res.message });
      } else {
        setCouponError(res.message || 'Invalid or expired coupon');
      }
    } catch (err: any) {
      setCouponError(err.message || 'Error checking coupon');
    }
  }

  async function handlePayAndConfirm() {
    if (!email || !phone) {
      setGeneralError('Please enter your contact email and phone number.');
      return;
    }

    setGeneralError(null);
    setIsProcessing(true);

    try {
      // 1. Create booking in pending status
      const booking = await createBooking({
        showtime_id: showtimeId,
        hold_id: holdId,
        seat_ids: selectedSeats,
        addons: selectedAddons,
        coupon_code: appliedCoupon ? appliedCoupon.code : undefined,
        contact_email: email,
        contact_phone: phone,
      });

      // 2. Create Razorpay order
      const order = await createRazorpayOrder(booking.id);

      // 3. Verify Payment (using Razorpay test mode signature)
      const confirmedBooking = await verifyPayment({
        booking_id: booking.id,
        razorpay_order_id: order.order_id,
        razorpay_payment_id: `pay_test_${Date.now()}`,
        razorpay_signature: 'test_signature_valid',
      });

      // 4. Redirect to confirmation ticket page
      router.push(`/booking/${confirmedBooking.id}`);
    } catch (err: any) {
      console.error('Checkout error:', err);
      setGeneralError(err.message || 'Payment processing failed. Please try again.');
      setIsProcessing(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 w-full text-white">
      {/* Back button */}
      <div className="mb-6">
        <Link
          href={`/cinemas/1/auditorium/1?showtime=${showtimeId}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-white transition"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to 3D Auditorium</span>
        </Link>
      </div>

      {/* Active Hold Countdown Timer */}
      <div className="mb-6">
        <HoldTimer
          holdId={holdId}
          initialExpiresAt={new Date(Date.now() + 5 * 60 * 1000).toISOString()}
          onExpire={() => {
            setGeneralError('Your seat hold has expired. Please reselect your seats.');
          }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Booking & Contact Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Movie & Showtime Card */}
          <div className="rounded-2xl border border-white/10 bg-[#12131a] p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="rounded bg-red-600/20 px-2.5 py-0.5 text-[10px] font-bold text-red-400 border border-red-500/30">
                  {showtimeData?.screen_type || 'IMAX 3D Laser'}
                </span>
                <h1 className="text-2xl font-black text-white mt-1">
                  {showtimeData?.movie_title || 'Quantum Odyssey: Beyond the Singularity'}
                </h1>
                <p className="text-xs text-zinc-400 mt-1">
                  {showtimeData?.cinema_name || 'CineVerse IMAX Koramangala'} • {showtimeData?.auditorium_name || 'Auditorium 1'}
                </p>
              </div>

              <div className="text-right">
                <span className="text-xs text-zinc-400">Showtime</span>
                <div className="text-sm font-bold text-white">
                  {showtimeData?.start_time ? new Date(showtimeData.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '07:00 PM'}
                </div>
              </div>
            </div>

            {/* Selected Seats Pill List */}
            <div className="pt-4 border-t border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Ticket className="h-4 w-4 text-[#e50914]" />
                <span className="text-xs font-semibold text-zinc-300">Selected Seats ({selectedSeats.length}):</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selectedSeats.map((s) => (
                  <span
                    key={s}
                    className="rounded-lg border border-red-500/40 bg-red-950/40 px-2.5 py-1 text-xs font-bold text-red-200"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Contact Details Form */}
          <div className="rounded-2xl border border-white/10 bg-[#12131a] p-6 space-y-4">
            <h2 className="text-base font-bold text-white">Contact & E-Ticket Delivery</h2>
            <p className="text-xs text-zinc-400">Your verifiable QR admission ticket will be sent here</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#0f1014] px-3.5 py-2.5 text-xs text-white placeholder-zinc-600 focus:border-[#e50914] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Mobile Number (for SMS & WhatsApp)</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#0f1014] px-3.5 py-2.5 text-xs text-white placeholder-zinc-600 focus:border-[#e50914] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="rounded-2xl border border-white/10 bg-[#12131a] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-[#e50914]" />
                <h2 className="text-base font-bold text-white">Payment Method</h2>
              </div>
              <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                Razorpay Sandbox Active
              </span>
            </div>

            <div className="rounded-xl border border-[#e50914]/40 bg-red-950/20 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#e50914] text-white font-black text-xs">
                  RZP
                </div>
                <div>
                  <div className="text-sm font-bold text-white">Razorpay Secure Checkout</div>
                  <div className="text-[11px] text-zinc-400">UPI, Credit/Debit Cards, NetBanking, Wallets</div>
                </div>
              </div>
              <CheckCircle2 className="h-5 w-5 text-[#e50914]" />
            </div>

            <div className="flex items-center gap-2 text-[11px] text-zinc-500 pt-1">
              <Lock className="h-3 w-3" />
              <span>256-bit SSL encrypted • Instant cancellation policy applies</span>
            </div>
          </div>
        </div>

        {/* Right Column: Order Summary & Coupon */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-[#12131a] p-6 space-y-4">
            <h2 className="text-base font-bold text-white">Order Summary</h2>

            {/* Coupon Application Box */}
            <div className="space-y-2 pt-1">
              <label className="block text-xs font-semibold text-zinc-300">Offers & Promo Code</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. CINEVERSE50"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  className="flex-1 uppercase rounded-xl border border-white/10 bg-[#0f1014] px-3 py-2 text-xs text-white placeholder-zinc-600 focus:border-[#e50914] focus:outline-none"
                />
                <button
                  onClick={handleApplyCoupon}
                  className="rounded-xl bg-white/10 border border-white/15 px-4 text-xs font-bold text-white hover:bg-white/20 transition"
                >
                  Apply
                </button>
              </div>

              {appliedCoupon && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 p-2 rounded-lg">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{appliedCoupon.message}</span>
                </div>
              )}

              {couponError && (
                <div className="text-xs text-red-400 bg-red-950/40 border border-red-500/30 p-2 rounded-lg">
                  {couponError}
                </div>
              )}
            </div>

            {/* Detailed Line Items */}
            <div className="space-y-2.5 pt-4 border-t border-white/10 text-xs">
              <div className="flex justify-between text-zinc-400">
                <span>Tickets ({selectedSeats.length})</span>
                <span className="font-semibold text-white">₹{ticketSubtotal.toFixed(2)}</span>
              </div>

              {fnbSubtotal > 0 && (
                <div className="flex justify-between text-zinc-400">
                  <span>F&B Combos</span>
                  <span className="font-semibold text-white">₹{fnbSubtotal.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between text-zinc-400">
                <span>Convenience Fee</span>
                <span className="text-zinc-300">₹{convenienceFee.toFixed(2)}</span>
              </div>

              <div className="flex justify-between text-zinc-400">
                <span>Integrated GST (18%)</span>
                <span className="text-zinc-300">₹{gstAmount.toFixed(2)}</span>
              </div>

              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-400 font-bold">
                  <span>Coupon Discount ({appliedCoupon?.code})</span>
                  <span>-₹{discountAmount.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Final Grand Total */}
            <div className="pt-4 border-t border-white/10 flex items-baseline justify-between">
              <div>
                <span className="text-xs text-zinc-400">Amount Payable</span>
                <div className="text-2xl font-black text-white">₹{grandTotal.toFixed(2)}</div>
              </div>
              <span className="text-[11px] text-zinc-500">Includes all taxes</span>
            </div>

            {generalError && (
              <div className="rounded-xl border border-red-500/40 bg-red-950/40 p-3 text-xs text-red-300 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
                <span>{generalError}</span>
              </div>
            )}

            {/* Pay Button */}
            <button
              onClick={handlePayAndConfirm}
              disabled={isProcessing}
              className="w-full rounded-xl bg-[#e50914] py-3.5 text-sm font-black text-white hover:bg-red-700 transition shadow-xl shadow-red-950/50 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Authorizing Payment...</span>
                </>
              ) : (
                <>
                  <span>Pay ₹{grandTotal.toFixed(2)} & Get E-Ticket</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-zinc-400">Loading checkout...</div>}>
      <CheckoutContent />
    </Suspense>
  );
}
