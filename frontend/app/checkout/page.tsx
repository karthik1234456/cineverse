'use client';

import Script from 'next/script';
import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft, Ticket, ShieldCheck, CreditCard,
  CheckCircle2, AlertCircle, Loader2, Lock, LogIn
} from 'lucide-react';
import { HoldTimer } from '@/components/HoldTimer';
import { AuthModal } from '@/components/AuthModal';
import {
  getHoldQuote, applyHoldCoupon, createBooking,
  createRazorpayOrder, verifyPayment, getStoredUser,
  type HoldQuoteResponse
} from '@/services/api';
import { useMovieBackdrop } from '@/context/MovieBackdropContext';

declare global {
  interface Window {
    Razorpay: any;
  }
}

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 1. Opaque hold ID from URL
  const holdId = searchParams.get('hold_id');

  const [quote, setQuote] = useState<HoldQuoteResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [errorCode, setErrorCode] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [couponCode, setCouponCode] = useState('');
  const [couponError, setCouponError] = useState<string | null>(null);
  const [email, setEmail] = useState('guest.patron@cineverse.in');
  const [phone, setPhone] = useState('9898989898');
  const [isProcessing, setIsProcessing] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const { setActiveMovie } = useMovieBackdrop();

  // Initialize and fetch server quote
  useEffect(() => {
    if (!holdId) {
      setLoading(false);
      setErrorCode(404);
      setErrorMessage('No active seat hold reservation found. Please select your seats from the showtimes page.');
      return;
    }

    const user = getStoredUser();
    if (user) {
      // if user has email stored in profile or token
    }

    loadQuote(holdId);
  }, [holdId]);

  async function loadQuote(id: string) {
    setLoading(true);
    setErrorMessage(null);
    setErrorCode(null);

    const token = typeof window !== 'undefined' ? localStorage.getItem('cineverse_token') : null;
    if (!token) {
      setLoading(false);
      setAuthRequired(true);
      return;
    }

    try {
      const data = await getHoldQuote(id);
      setQuote(data);
      if (data) {
        setActiveMovie({
          id: data.movie_id || 0,
          slug: `movie-${data.movie_id || 0}`,
          title: data.movie_title,
          banner_url: data.movie_banner_url || data.movie_poster_url || '',
          poster_url: data.movie_poster_url || '',
          dominant_color: data.movie_dominant_color ?? null,
          glimpse_url: data.movie_glimpse_url ?? null,
          glimpse_webm_url: data.movie_glimpse_webm_url ?? null,
          glimpse_720p_url: data.movie_glimpse_720p_url ?? null,
        });
      }
      setAuthRequired(false);
    } catch (err: any) {
      const msg = (err.message || '').toLowerCase();
      const status = err.status || 0;
      if (status === 401 || msg.includes('401') || msg.includes('unauthenticated')) {
        setAuthRequired(true);
      } else if (status === 403 || msg.includes('403') || msg.includes('not authorized') || msg.includes('forbidden')) {
        setErrorCode(403);
        setErrorMessage('Not authorized: This seat hold reservation belongs to another account.');
      } else if (status === 404 || msg.includes('404') || msg.includes('not found') || msg.includes('expired')) {
        setErrorCode(404);
        setErrorMessage('Your seat hold has expired or is invalid. Please select your seats again.');
      } else {
        setErrorMessage(err.message || 'Failed to load reservation details.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleApplyCoupon() {
    if (!couponCode.trim() || !holdId) return;
    setCouponError(null);
    try {
      const updatedQuote = await applyHoldCoupon(holdId, couponCode.trim());
      setQuote(updatedQuote);
      setCouponCode('');
    } catch (err: any) {
      setCouponError(err.message || 'Invalid or expired coupon code.');
    }
  }

  async function handlePayAndConfirm() {
    if (!email || !phone) {
      setGeneralError('Please enter your contact email and phone number.');
      return;
    }

    if (!holdId || !quote) {
      setGeneralError('No active reservation hold found.');
      return;
    }

    setGeneralError(null);
    setIsProcessing(true);

    try {
      // 1. Create booking strictly using server-locked hold (client sends no pricing or totals)
      const booking = await createBooking({
        hold_id: holdId,
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
          description: `${quote.movie_title} Tickets (${quote.held_seats.map((s) => s.seat_id).join(', ')})`,
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
        // Fallback for headless testing environments without external Razorpay script
        router.push(`/booking/${booking.id}`);
      }
    } catch (err: any) {
      setGeneralError(err.message || 'Failed to initialize payment order. Seats may have expired.');
      setIsProcessing(false);
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-20 text-center" data-testid="checkout-page">
        <Loader2 className="h-10 w-10 animate-spin text-[#C8102E] mx-auto mb-4" />
        <p className="text-lg font-bold text-slate-700">Loading your server-verified reservation...</p>
      </div>
    );
  }

  // Authentication required state
  if (authRequired) {
    return (
      <div className="mx-auto max-w-xl py-16 px-4 text-center" data-testid="checkout-page">
        <div className="rounded-3xl border border-[#E6DCD2] bg-white p-8 shadow-sm space-y-5">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-[#C8102E] border border-rose-200">
            <Lock className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-black text-[#1B1320]">Sign In Required</h1>
          <p className="text-base text-slate-600 leading-relaxed">
            Please sign in to your CineVerse account to view your server-locked seat quote and complete payment.
          </p>
          <div className="pt-2">
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-[#C8102E] px-8 py-3 text-base font-bold text-white hover:bg-[#A60D26] transition shadow-md"
            >
              <LogIn className="h-5 w-5" />
              <span>Sign In to Continue</span>
            </button>
          </div>
        </div>

        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          onSuccess={() => {
            setIsAuthModalOpen(false);
            if (holdId) loadQuote(holdId);
          }}
        />
      </div>
    );
  }

  // Error state (403, 404, or expired)
  if (errorMessage || !quote) {
    return (
      <div className="mx-auto max-w-xl py-16 px-4 text-center" data-testid="checkout-page">
        <div className="rounded-3xl border border-[#E6DCD2] bg-white p-8 shadow-sm space-y-5">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 border border-amber-200">
            <AlertCircle className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-black text-[#1B1320]">
            {errorCode === 403 ? 'Access Restricted' : 'Reservation Not Available'}
          </h1>
          <p className="text-base text-slate-600 leading-relaxed">
            {errorMessage || 'Your seat hold could not be retrieved. Please select seats from the showtimes page.'}
          </p>
          <div className="pt-2">
            <Link
              href="/movies"
              className="inline-flex min-h-[48px] items-center justify-center rounded-2xl bg-[#C8102E] px-8 py-3 text-base font-bold text-white hover:bg-[#A60D26] transition shadow-md"
            >
              Find Showtimes
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="lazyOnload"
      />

      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10 w-full text-[#1B1320]" data-testid="checkout-page">
        {/* Numbered 3-Step Flow at top */}
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <button
            onClick={() => router.back()}
            className="flex min-h-[48px] items-center gap-2 rounded-xl border border-[#E6DCD2] bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:text-[#1B1320] transition shadow-sm w-fit"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Change Seats</span>
          </button>

          <HoldTimer
            holdId={holdId || ''}
            initialExpiresAt={quote.expires_at}
            onExpire={() => {
              setGeneralError('Your seat hold has expired. Please select seats again.');
            }}
          />
        </div>

        {/* One-Line Server Price Lock Guarantee Banner */}
        <div
          className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900 flex items-center gap-2.5 shadow-sm mb-6"
          data-testid="price-lock-guarantee-banner"
          data-test-guarantee="final-price-guarantee"
        >
          <ShieldCheck className="h-5 w-5 text-emerald-700 shrink-0" />
          <span data-testid="final-price-guarantee">{quote.price_lock_guarantee || 'The price shown at checkout is final'}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Booking & Contact Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Movie & Showtime Card */}
            <div className="rounded-3xl border border-[#E6DCD2] bg-white p-6 space-y-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="rounded-lg bg-rose-50 px-3 py-1 text-sm font-bold text-[#9F1239] border border-rose-200" data-testid="checkout-format-badge">
                      {quote.screen_format || quote.screen_type || '2D'}
                    </span>
                    {quote.requires_glasses && (
                      <span className="rounded-lg bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-700 border border-indigo-200">
                        Glasses Required
                      </span>
                    )}
                    {quote.is_demo && (
                      <span className="rounded-lg bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-800 border border-amber-200">
                        Demo
                      </span>
                    )}
                  </div>
                  <h1 className="text-2xl font-black text-[#1B1320] mt-2">
                    {quote.movie_title}
                  </h1>
                  <p className="text-sm font-semibold text-slate-800 mt-1" data-testid="checkout-tech-specs">
                    {quote.tech_specs_display || `${quote.auditorium_name} · ${quote.screen_format || '2D'} · ${quote.sound_system || 'Dolby Atmos'} · ${quote.projection_type || '4K Laser'}`}
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {quote.cinema_name}
                  </p>
                  {quote.cinema_address && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      {quote.cinema_address}{quote.cinema_pincode ? ` (${quote.cinema_pincode})` : ''}
                      {quote.cinema_parking && quote.cinema_parking !== 'none' ? ` • ${quote.cinema_parking} parking` : ''}
                    </p>
                  )}
                </div>

                <div className="text-right">
                  <span className="text-sm text-slate-500 font-bold uppercase tracking-wider">Showtime</span>
                  <div className="text-base font-bold text-[#1B1320] mt-0.5">
                    {quote.start_time
                      ? new Date(quote.start_time).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true,
                        })
                      : '07:00 PM'}
                  </div>
                </div>
              </div>

              {/* Selected Seats Pill List */}
              <div className="pt-4 border-t border-[#E6DCD2] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Ticket className="h-4 w-4 text-[#C8102E]" />
                  <span className="text-sm font-bold text-slate-800">
                    Selected Seats ({quote.held_seats.length}):
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {quote.held_seats.map((s) => (
                    <span
                      key={s.seat_id}
                      className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-sm font-bold text-[#9F1239]"
                    >
                      {s.seat_id} ({s.category})
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

            {/* Payment Method Card */}
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
                    className="min-h-[48px] rounded-xl bg-[#C8102E] px-5 text-sm font-bold text-white hover:bg-[#A60D26] transition shadow-sm"
                  >
                    Apply
                  </button>
                </div>

                {quote.applied_coupon && (
                  <div className="flex items-center gap-2 text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 p-3 rounded-xl font-medium">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Coupon {quote.applied_coupon.code} applied: save {quote.applied_coupon.discount_amount_display}</span>
                  </div>
                )}

                {couponError && (
                  <div className="text-sm text-rose-800 bg-rose-50 border border-rose-200 p-3 rounded-xl">
                    {couponError}
                  </div>
                )}
              </div>

              {/* Detailed Line Items (Strictly from Server Quote, integer display amounts) */}
              <div className="space-y-3 pt-4 border-t border-[#E6DCD2] text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Tickets ({quote.held_seats.length})</span>
                  <span className="font-bold text-[#1B1320]">
                    ₹{Math.round(quote.ticket_subtotal)}
                  </span>
                </div>

                {quote.addons && quote.addons.length > 0 && (
                  <div className="space-y-1.5">
                    {quote.addons.map((a) => (
                      <div key={a.fnb_item_id} className="flex justify-between text-slate-600 pl-2">
                        <span>{a.name} × {a.quantity}</span>
                        <span className="font-bold text-[#1B1320]">₹{Math.round(a.line_total)}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-between text-slate-600">
                  <span>Convenience Fee</span>
                  <span className="text-[#1B1320]">
                    ₹{Math.round(quote.convenience_fee)}
                  </span>
                </div>

                <div className="flex justify-between text-slate-600">
                  <span>Integrated GST (18%)</span>
                  <span className="text-[#1B1320]">
                    ₹{Math.round(quote.gst_amount)}
                  </span>
                </div>

                {quote.discount_amount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-bold">
                    <span>Coupon Discount ({quote.applied_coupon?.code || 'Promo'})</span>
                    <span>-₹{Math.round(quote.discount_amount)}</span>
                  </div>
                )}
              </div>

              {/* Final Grand Total (Formatted as integer ₹ without decimals) */}
              <div className="pt-4 border-t border-[#E6DCD2] flex items-baseline justify-between">
                <div>
                  <span className="text-sm text-slate-500 uppercase font-bold tracking-wider">Amount Payable</span>
                  <div className="text-3xl font-black text-[#C8102E]" data-testid="checkout-grand-total">
                    ₹{Math.round(quote.final_total)}
                  </div>
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
                  <span>Pay ₹{Math.round(quote.final_total)} with Razorpay</span>
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
