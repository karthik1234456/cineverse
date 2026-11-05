'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function SupportPage() {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    bookingRef: '',
    category: 'booking',
    message: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In production, posts to backend /api/v1/support/tickets
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-[#FFF8F1] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <span className="inline-block px-3 py-1 bg-[#F5EBE1] text-[#8C2A3E] text-sm font-semibold rounded-full mb-3">
            Customer Assistance & Help Desk
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#1B1320] tracking-tight">
            How can we help you today?
          </h1>
          <p className="mt-3 text-lg text-[#5A4E65] max-w-2xl mx-auto">
            Have questions about your booking, refund, or 3D theatre view? Our support team is here to help.
          </p>
        </div>

        {/* SLA & Quick Contact Banner */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-white p-6 rounded-2xl border border-[#E6DCD2] shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-[#FEE2E2] text-[#C8102E] flex items-center justify-center font-bold text-xl mb-3">
              ⚡
            </div>
            <h2 className="text-lg font-bold text-[#1B1320]">Response SLA</h2>
            <p className="text-sm text-[#5A4E65] mt-1">
              Under <strong>4 hours</strong> during operational cinema hours (09:00 AM – 11:00 PM IST daily).
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-[#E6DCD2] shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-[#EDE9FE] text-[#7C3AED] flex items-center justify-center font-bold text-xl mb-3">
              ✉️
            </div>
            <h2 className="text-lg font-bold text-[#1B1320]">Direct Email</h2>
            <p className="text-sm text-[#5A4E65] mt-1">
              <a href="mailto:support@cineverse.in" className="text-[#C8102E] font-medium hover:underline">
                support@cineverse.in
              </a>
              <br />
              Monitored around the clock for urgent inquiries.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-[#E6DCD2] shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-[#CCFBF1] text-[#0F766E] flex items-center justify-center font-bold text-xl mb-3">
              📍
            </div>
            <h2 className="text-lg font-bold text-[#1B1320]">At The Cinema</h2>
            <p className="text-sm text-[#5A4E65] mt-1">
              Show your digital QR ticket at the CineVerse Entrance or visit the Box Office assistance counter.
            </p>
          </div>
        </div>

        {/* Contact Form Card */}
        <div className="bg-white rounded-3xl border border-[#E6DCD2] shadow-sm p-6 sm:p-10 mb-10">
          {submitted ? (
            <div className="text-center py-10" data-testid="support-success-message">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-3xl mb-4">
                ✓
              </div>
              <h2 className="text-2xl font-bold text-[#1B1320]">Support Ticket Received</h2>
              <p className="text-lg text-[#5A4E65] mt-2 max-w-md mx-auto">
                Thank you! We have logged your request under reference #{Math.floor(100000 + Math.random() * 900000)}. A support specialist will respond to <strong>{formData.email}</strong> shortly.
              </p>
              <button
                type="button"
                onClick={() => setSubmitted(false)}
                className="mt-6 px-6 py-3 bg-[#C8102E] text-white font-semibold rounded-xl hover:bg-[#A00D24] transition"
              >
                Send Another Message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <h2 className="text-xl font-bold text-[#1B1320] border-b border-[#E6DCD2] pb-3">
                Send Us a Message
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-semibold text-[#1B1320] mb-2">
                    Your Full Name *
                  </label>
                  <input
                    id="name"
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-[#D5C7B8] focus:ring-2 focus:ring-[#C8102E] focus:outline-none text-base bg-[#FFFDF9]"
                    placeholder="Aditi Sharma"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-semibold text-[#1B1320] mb-2">
                    Email Address *
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-[#D5C7B8] focus:ring-2 focus:ring-[#C8102E] focus:outline-none text-base bg-[#FFFDF9]"
                    placeholder="aditi@example.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="phone" className="block text-sm font-semibold text-[#1B1320] mb-2">
                    Mobile Number (Optional)
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-[#D5C7B8] focus:ring-2 focus:ring-[#C8102E] focus:outline-none text-base bg-[#FFFDF9]"
                    placeholder="+91 98765 43210"
                  />
                </div>

                <div>
                  <label htmlFor="bookingRef" className="block text-sm font-semibold text-[#1B1320] mb-2">
                    Booking Reference (if applicable)
                  </label>
                  <input
                    id="bookingRef"
                    type="text"
                    value={formData.bookingRef}
                    onChange={(e) => setFormData({ ...formData, bookingRef: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-[#D5C7B8] focus:ring-2 focus:ring-[#C8102E] focus:outline-none text-base bg-[#FFFDF9]"
                    placeholder="CV-2026-XXXX"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="category" className="block text-sm font-semibold text-[#1B1320] mb-2">
                  Inquiry Topic *
                </label>
                <select
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-[#D5C7B8] focus:ring-2 focus:ring-[#C8102E] focus:outline-none text-base bg-[#FFFDF9]"
                >
                  <option value="booking">Ticket & Booking Assistance</option>
                  <option value="payment">Payment Issue or Deducted Money</option>
                  <option value="cancellation">Cancellation & Refund Status</option>
                  <option value="3d-tech">3D Theatre Viewer / Visual Glitch</option>
                  <option value="voice-agent">Voice Assistant Inquiry</option>
                  <option value="general">General Feedback / Cinema Partnership</option>
                </select>
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-semibold text-[#1B1320] mb-2">
                  Detailed Message *
                </label>
                <textarea
                  id="message"
                  required
                  rows={4}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-[#D5C7B8] focus:ring-2 focus:ring-[#C8102E] focus:outline-none text-base bg-[#FFFDF9]"
                  placeholder="Please describe what happened and how we can assist..."
                />
              </div>

              <button
                type="submit"
                className="w-full py-4 bg-[#C8102E] text-white font-bold text-lg rounded-xl hover:bg-[#A00D24] shadow-md transition"
              >
                Submit Support Request
              </button>
            </form>
          )}
        </div>

        {/* Helpful Links */}
        <div className="bg-[#FAF4ED] p-6 rounded-2xl border border-[#E6DCD2] text-center">
          <h3 className="text-base font-bold text-[#1B1320] mb-2">Looking for policies and legal information?</h3>
          <div className="flex flex-wrap justify-center gap-4 text-sm font-medium text-[#8C2A3E]">
            <Link href="/legal/refunds" className="hover:underline">Refund & Cancellation Policy</Link>
            <span>·</span>
            <Link href="/legal/terms" className="hover:underline">Terms of Service</Link>
            <span>·</span>
            <Link href="/legal/privacy" className="hover:underline">Privacy Policy (DPDP Act)</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

