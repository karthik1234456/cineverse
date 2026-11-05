import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy — CineVerse',
  description: 'Digital Personal Data Protection Act (DPDP Act, 2023) compliant privacy policy for CineVerse Cinemas India.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[#FFF8F1] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white rounded-3xl border border-[#E6DCD2] p-8 sm:p-12 shadow-sm">
        <div className="border-b border-[#E6DCD2] pb-6 mb-8">
          <span className="text-xs uppercase tracking-wider font-bold text-[#8C2A3E]">
            DPDP Act, 2023 Compliant Notice
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#1B1320] mt-2">
            Privacy Policy & Data Protection
          </h1>
          <p className="text-sm text-[#70647C] mt-1">
            Last Updated: November 5, 2026 · Effective Immediately for all CineVerse Platforms
          </p>
        </div>

        <div className="prose prose-lg max-w-none text-[#332A3B] space-y-6 text-base leading-relaxed">
          <section>
            <h2 className="text-2xl font-bold text-[#1B1320] mb-3">1. Overview & Statutory Commitment</h2>
            <p>
              CineVerse Cinemas India Private Limited (&ldquo;CineVerse&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) is committed to protecting your personal data in full compliance with the <strong>Digital Personal Data Protection Act, 2023 (DPDP Act)</strong>, the Information Technology Act, 2000, and corresponding Indian data protection rules.
            </p>
            <p>
              This policy describes how we collect, process, retain, and safeguard personal data when you use our website, mobile interface, 3D auditorium preview engines, or book tickets through CineVerse.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-[#1B1320] mb-3">2. Specified Legitimate Purposes</h2>
            <p>We process personal data strictly for specified, lawful, and transparent purposes:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Ticketing & Seat Allocation:</strong> Reserving selected seats, generating cryptographically signed digital entry tickets (Ed25519 QR codes), and processing venue admission.</li>
              <li><strong>Payment Processing:</strong> Facilitating secure, PCI-DSS compliant payment processing through authorized RBI-regulated gateways (e.g., Razorpay). CineVerse does not store complete credit card or debit card numbers on its servers.</li>
              <li><strong>Transactional Notifications:</strong> Transmitting booking confirmations, showtime schedule alerts, tax invoices, and cancellation receipts via SMS, WhatsApp, and email through DLT-registered telecom channels.</li>
              <li><strong>Customer Support:</strong> Resolving refund disputes, ticket adjustments, and technical inquiries.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-[#1B1320] mb-3">3. Personal Data Collected</h2>
            <div className="bg-[#FAF4ED] p-5 rounded-2xl border border-[#E6DCD2] text-sm">
              <p className="font-semibold text-[#1B1320] mb-2">We collect only necessary information:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Identity & Contact:</strong> Full name, verified mobile phone number, and email address.</li>
                <li><strong>Transaction Details:</strong> Booking ID, selected auditorium/showtime/seats, GST invoice data, and gateway payment reference IDs.</li>
                <li><strong>Technical & Session Data:</strong> IP address, device type, and session cookies strictly required for seat hold locking and security verification.</li>
              </ul>
              <p className="mt-3 text-xs text-[#70647C]">
                <strong>No Personal Data Dynamic Pricing:</strong> CineVerse does not use your personal demographic information, browsing history, or device identity to dynamically alter ticket prices. All pricing rules are aggregate and rule-based.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-[#1B1320] mb-3">4. Data Retention & Deletion Rights</h2>
            <p>
              We retain personal data only for as long as necessary to fulfill the ticketing purpose or comply with statutory requirements under Indian law (including GST invoice retention mandates under the Central Goods and Services Tax Act, 2017).
            </p>
            <p>
              Under the DPDP Act, you have the right to request erasure of your personal data when the original purpose is fulfilled. To exercise this right, submit a deletion request via our <Link href="/support" className="text-[#C8102E] font-medium underline">Support Portal</Link> or contact our Grievance Officer.
            </p>
          </section>

          <section className="bg-[#FFFDF9] border-2 border-[#C8102E]/20 p-6 rounded-2xl">
            <h2 className="text-xl font-bold text-[#C8102E] mb-2">5. Data Protection Grievance Officer</h2>
            <p className="text-sm text-[#4A4056] mb-4">
              In accordance with Section 13(2) of the Digital Personal Data Protection Act, 2023 and Rule 3(2) of the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, the designated Grievance Officer for CineVerse is:
            </p>
            <div className="text-sm space-y-1 text-[#1B1320]">
              <p><strong>Designation:</strong> Data Protection & Grievance Officer</p>
              <p><strong>Company:</strong> CineVerse Cinemas India Private Limited</p>
              <p><strong>Office Address:</strong> CineVerse Tech Hub, Indiranagar, Bengaluru, Karnataka 560038, India</p>
              <p><strong>Email:</strong> <a href="mailto:grievance@cineverse.in" className="text-[#C8102E] underline">grievance@cineverse.in</a></p>
              <p><strong>Statutory SLA:</strong> Acknowledgment within <strong>24 hours</strong>; Resolution within <strong>15 calendar days</strong>.</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

