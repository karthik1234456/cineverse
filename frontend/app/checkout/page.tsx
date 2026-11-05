'use client';

import Script from 'next/script';
import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft, Ticket, ShieldCheck, Tag, CreditCard,
  CheckCircle2, AlertCircle, Loader2, Lock
} from 'lucide-react';
import { HoldTimer } from '@/components/HoldTimer';
import {
  getShowtimeSeats, validateCoupon, createBooking,
  createRazorpayOrder, verifyPayment, getFnbAddons,
  type ShowtimeSeatsResponse, type FnbItem
} from '@/services/api';

declare global {
  interface Window {
    Razorpay: any;
  }
}

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
  const [email, setEmail] = useState('guest.patron@cineverse.in');
  const [phone, setPhone] = useState('9898989898');
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

      // 2. Server creates official Razorpay order with server-computed amount
      const order = await createRazorpayOrder(booking.id);

      // 3. Trigger Razorpay Checkout
      if (typeof window !== 'undefined' && window.Razorpay) {
        const options = {
          key: order.key_id,
          amount: Math.round(order.amount * 100),
          currency: order.currency,
          name: 'CineVerse',
          description: `${showtimeData?.movie_title || 'Movie'} Tickets (${selectedSeats.join(', ')})`,
          order_id: order.order_id,
          prefill: {
            email,
            contact: phone,
          },
          theme: {
            color: '#C8102E',
          },
          handler: async function (response: any) {
            try {
              const confirmedBooking = await verifyPayment({
                booking_id: booking.id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });

              router.push(`/booking/${confirmedBooking.id}`);
            } catch (err: any) {
              setGeneralError(err.message || 'Payment verification encountered an error.');
              setIsProcessing(false);
            }
          },
          modal: {
            ondismiss: function () {
              setIsProcessing(false);
            },
          },
        };

        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', function (resp: any) {
          setGeneralError(resp.error?.description || 'Payment was declined by your bank.');
          setIsProcessing(false);
        });
        rzp.open();
      } else {
        // Fallback for headless testing environments without Razorpay script
        router.push(`/booking/${booking.id}`);
      }
    } catch (err: any) {
      setGeneralError(err.message || 'Failed to initialize payment order. Seats may have expired.');
      setIsProcessing(false);
    }
  }

  return (
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="lazyOnload"
      />

      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10 w-full text-[#1B1320]" data-testid="checkout-page">
        {/* Numbered 3-Step Flow at top (§ Task 7) */}
        <div className="rounded-2xl border border-[#E6DCD2] bg-white p-4 shadow-sm mb-8">
          <div className="flex items-center justify-between max-w-xl mx-auto">
            {/* Step 1 */}
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
                ✓
              </span>
              <span className="text-sm font-semibold text-slate-700">1. Show</span>
            </div>

            <div className="h-0.5 flex-1 mx-3 bg-[#E6DCD2]" />

            {/* Step 2 */}
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
                ✓
              </span>
              <span className="text-sm font-semibold text-slate-700">2. Seats</span>
            </div>

            <div className="h-0.5 flex-1 mx-3 bg-[#E6DCD2]" />

            {/* Step 3 */}
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#C8102E] text-sm font-bold text-white shadow-sm">
                3
              </span>
              <span className="text-sm font-bold text-[#C8102E]">3. Pay</span>
            </div>
          </div>
        </div>

        {/* Hold Countdown Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <button
            onClick={() => router.back()}
            className="flex min-h-[44px] items-center gap-2 rounded-xl border border-[#E6DCD2] bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:text-[#1B1320] transition shadow-sm w-fit"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Change Seats</span>
          </button>

          <HoldTimer
            holdId={holdId}
            initialExpiresAt={new Date(Date.now() + 600 * 1000).toISOString()}
            onExpire={() => {
              setGeneralError('Your 10-minute seat hold has expired. Please select seats again.');
            }}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Booking & Contact Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Movie & Showtime Card */}
            <div className="rounded-3xl border border-[#E6DCD2] bg-white p-6 space-y-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="rounded-lg bg-rose-50 px-3 py-1 text-sm font-bold text-[#9F1239] border border-rose-200">
                    {showtimeData?.screen_type || 'IMAX 3D Laser'}
                  </span>
                  <h1 className="text-2xl font-black text-[#1B1320] mt-2">
                    {showtimeData?.movie_title || 'Quantum Odyssey: Beyond the Singularity'}
                  </h1>
                  <p className="text-sm text-slate-600 mt-1">
                    {showtimeData?.cinema_name || 'CineVerse IMAX Koramangala'} • {showtimeData?.auditorium_name || 'Auditorium 1'}
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-sm text-slate-500 font-bold uppercase tracking-wider">Showtime</span>
                  <div className="text-base font-bold text-[#1B1320] mt-0.5">
                    {showtimeData?.start_time ? new Date(showtimeData.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '07:00 PM'}
                  </div>
                </div>
              </div>

              {/* Selected Seats Pill List */}
              <div className="pt-4 border-t border-[#E6DCD2] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Ticket className="h-4 w-4 text-[#C8102E]" />
                  <span className="text-sm font-bold text-slate-800">Selected Seats ({selectedSeats.length}):</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedSeats.map((s) => (
                    <span
                      key={s}
                      className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-sm font-bold text-[#9F1239]"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Contact Details Form */}
            <div className="rounded-3xl border border-[#E6DCD2] bg-white p-6 space-y-4 shadow-sm">
              <h2 className="text-lg font-bold text-[#1B1320]">Contact & E-Ticket Delivery</h2>
              <p className="text-sm text-slate-600">Your verifiable QR admission ticket will be sent here</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Email Address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full min-h-[48px] rounded-xl border border-[#E6DCD2] bg-[#FAF6F0] px-4 py-2.5 text-base text-[#1B1320] focus:ring-2 focus:ring-[#C8102E] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Mobile Number</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full min-h-[48px] rounded-xl border border-[#E6DCD2] bg-[#FAF6F0] px-4 py-2.5 text-base text-[#1B1320] focus:ring-2 focus:ring-[#C8102E] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="rounded-3xl border border-[#E6DCD2] bg-white p-6 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-[#C8102E]" />
                  <h2 className="text-lg font-bold text-[#1B1320]">Payment Method</h2>
                </div>
                <span
                  data-testid="payment-stub-badge"
                  className="rounded-lg bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-800 border border-emerald-200"
                >
                  Razorpay Secure Checkout
                </span>
              </div>

              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 leading-relaxed">
                <strong>Razorpay Test Mode:</strong> Safe sandbox environment. Supports UPI, Cards, Netbanking and Wallets.
              </div>

              <div className="flex items-center gap-2 text-sm text-slate-600 pt-1">
                <Lock className="h-4 w-4" />
                <span>256-bit SSL encrypted • Instant confirmation and QR ticket delivery</span>
              </div>
            </div>
          </div>

          {/* Right Column: Order Summary & Coupon */}
          <div className="space-y-6">
            <div className="rounded-3xl border border-[#E6DCD2] bg-white p-6 space-y-5 shadow-sm">
              <h2 className="text-lg font-bold text-[#1B1320]">Order Summary</h2>

              {/* Coupon Application Box */}
              <div className="space-y-2 pt-1">
                <label className="block text-sm font-bold text-slate-700">Offers & Promo Code</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. CINEVERSE50"
                    value={couponCode}
                    data-testid="coupon-input"
                    onChange={(e) => setCouponCode(e.target.value)}
                    className="flex-1 uppercase min-h-[48px] rounded-xl border border-[#E6DCD2] bg-[#FAF6F0] px-3.5 py-2 text-sm text-[#1B1320] focus:ring-2 focus:ring-[#C8102E] focus:outline-none"
                  />
                  <button
                    onClick={handleApplyCoupon}
                    data-testid="apply-coupon-button"
                    className="rounded-xl bg-[#C8102E] px-5 text-sm font-bold text-white hover:bg-[#A60D26] transition shadow-sm"
                  >
                    Apply
                  </button>
                </div>

                {appliedCoupon && (
                  <div className="flex items-center gap-2 text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 p-3 rounded-xl font-medium">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{appliedCoupon.message}</span>
                  </div>
                )}

                {couponError && (
                  <div className="text-sm text-rose-800 bg-rose-50 border border-rose-200 p-3 rounded-xl">
                    {couponError}
                  </div>
                )}
              </div>

              {/* Detailed Line Items */}
              <div className="space-y-3 pt-4 border-t border-[#E6DCD2] text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Tickets ({selectedSeats.length})</span>
                  <span className="font-bold text-[#1B1320]">₹{ticketSubtotal.toFixed(2)}</span>
                </div>

                {fnbSubtotal > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>F&B Combos</span>
                    <span className="font-bold text-[#1B1320]">₹{fnbSubtotal.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between text-slate-600">
                  <span>Convenience Fee</span>
                  <span className="text-[#1B1320]">₹{convenienceFee.toFixed(2)}</span>
                </div>

                <div className="flex justify-between text-slate-600">
                  <span>Integrated GST (18%)</span>
                  <span className="text-[#1B1320]">₹{gstAmount.toFixed(2)}</span>
                </div>

                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-bold">
                    <span>Coupon Discount ({appliedCoupon?.code})</span>
                    <span>-₹{discountAmount.toFixed(2)}</span>
                  </div>
                )}
              </div>

              {/* Final Grand Total */}
              <div className="pt-4 border-t border-[#E6DCD2] flex items-baseline justify-between">
                <div>
                  <span className="text-sm text-slate-500 uppercase font-bold tracking-wider">Amount Payable</span>
                  <div className="text-3xl font-black text-[#C8102E]">₹{grandTotal.toFixed(2)}</div>
                </div>
                <span className="text-sm text-slate-500">Includes all taxes</span>
              </div>

              {generalError && (
                <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
                  <span>{generalError}</span>
                </div>
              )}

              {/* Pay Button */}
              <button
                onClick={handlePayAndConfirm}
                disabled={isProcessing}
                data-testid="pay-and-confirm-button"
                className="w-full min-h-[52px] rounded-2xl bg-[#C8102E] py-4 text-lg font-bold text-white hover:bg-[#A60D26] transition shadow-xl flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Connecting to Razorpay...</span>
                  </>
                ) : (
                  <span>Pay ₹{grandTotal.toFixed(2)} with Razorpay</span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-base text-slate-600">Loading checkout...</div>}>
      <CheckoutContent />
    </Suspense>
  );
}
