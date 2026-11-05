import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'Refund & Cancellation Policy — CineVerse',
  description: 'Detailed cancellation timelines and refund settlement terms for CineVerse Cinemas India.',
};

export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-[#FFF8F1] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white rounded-3xl border border-[#E6DCD2] p-8 sm:p-12 shadow-sm">
        <div className="border-b border-[#E6DCD2] pb-6 mb-8">
          <span className="text-xs uppercase tracking-wider font-bold text-[#8C2A3E]">
            Consumer Protection
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#1B1320] mt-2">
            Refund &amp; Cancellation Policy
          </h1>
          <p className="text-sm text-[#70647C] mt-1">
            Last Updated: November 5, 2026 · Standard Commercial Terms
          </p>
        </div>

        <div className="prose prose-lg max-w-none text-[#332A3B] space-y-6 text-base leading-relaxed">
          <section>
            <h2 className="text-2xl font-bold text-[#1B1320] mb-3">1. Ticket Cancellation Guidelines</h2>
            <p>
              We understand that plans can change. Unless explicitly marked as non-refundable by the participating cinema, registered users may cancel their confirmed bookings subject to the following cutoff rules:
            </p>
            <div className="overflow-x-auto my-4">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-[#FAF4ED] border-b border-[#E6DCD2] text-[#1B1320]">
                    <th className="py-3 px-4 font-bold">Cancellation Window</th>
                    <th className="py-3 px-4 font-bold">Ticket Price Refund</th>
                    <th className="py-3 px-4 font-bold">Convenience Fee &amp; GST</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6DCD2]">
                  <tr>
                    <td className="py-3 px-4 font-medium">&gt; 2 Hours Before Showtime</td>
                    <td className="py-3 px-4 text-emerald-700 font-semibold">100% Refunded</td>
                    <td className="py-3 px-4 text-[#70647C]">Non-Refundable</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-medium">&lt; 2 Hours Before Showtime</td>
                    <td className="py-3 px-4 text-rose-700 font-semibold">No Refund Permitted</td>
                    <td className="py-3 px-4 text-[#70647C]">Non-Refundable</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-medium">Show Cancelled by Cinema</td>
                    <td className="py-3 px-4 text-emerald-700 font-semibold">100% Refunded</td>
                    <td className="py-3 px-4 text-emerald-700 font-semibold">100% Refunded</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-[#1B1320] mb-3">2. Automatic Refund on Expired Holds &amp; Double Bookings</h2>
            <p>
              In rare circumstances where your bank debits payment after a 5-minute seat hold has expired or in the event of an unexpected network interruption:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Our backend payment engine automatically detects the expired hold status upon webhook receipt.</li>
              <li>An <strong>automated reverse refund</strong> is immediately triggered through the Razorpay payment gateway (status code 410 Gone / Auto-Refund).</li>
              <li>You do not need to contact customer care; an email confirmation with the refund reference ID will be sent automatically.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-[#1B1320] mb-3">3. Refund Settlement Timelines</h2>
            <p>
              All refunds are credited strictly back to the <strong>original payment method</strong> used during checkout:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>UPI (Google Pay, PhonePe, Paytm, BHIM):</strong> Instant to 24–48 hours.</li>
              <li><strong>Credit / Debit Cards:</strong> 5 to 7 bank working days (dependent on your issuing bank).</li>
              <li><strong>Net Banking:</strong> 3 to 5 bank working days.</li>
            </ul>
          </section>

          <section className="bg-[#FAF4ED] p-6 rounded-2xl border border-[#E6DCD2]">
            <h2 className="text-xl font-bold text-[#1B1320] mb-2">Need Help with a Refund?</h2>
            <p className="text-sm text-[#4A4056] mb-4">
              If your refund has not reflected within 7 bank working days, please submit your booking reference ID and bank UTR to our customer desk:
            </p>
            <Link
              href="/support"
              className="inline-block px-6 py-3 bg-[#C8102E] text-white font-semibold rounded-xl hover:bg-[#A00D24] transition text-sm"
            >
              Open Support Ticket
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}

