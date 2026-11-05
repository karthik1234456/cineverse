import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'Terms of Use — CineVerse',
  description: 'Terms of Service and admission guidelines for CineVerse Cinemas India.',
};

export default function TermsOfUsePage() {
  return (
    <div className="min-h-screen bg-[#FFF8F1] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white rounded-3xl border border-[#E6DCD2] p-8 sm:p-12 shadow-sm">
        <div className="border-b border-[#E6DCD2] pb-6 mb-8">
          <span className="text-xs uppercase tracking-wider font-bold text-[#8C2A3E]">
            User Agreement
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#1B1320] mt-2">
            Terms of Use
          </h1>
          <p className="text-sm text-[#70647C] mt-1">
            Effective Date: November 5, 2026 · CineVerse Cinemas India
          </p>
        </div>

        <div className="prose prose-lg max-w-none text-[#332A3B] space-y-6 text-base leading-relaxed">
          <section>
            <h2 className="text-2xl font-bold text-[#1B1320] mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing the CineVerse platform, selecting seats via our 2D/3D interface, or purchasing tickets, you agree to be bound by these Terms of Use and all applicable laws and regulations of the Republic of India.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-[#1B1320] mb-3">2. Central Board of Film Certification (CBFC) Ratings</h2>
            <p>
              All movie tickets issued through CineVerse are subject to the age restrictions and certifications assigned by the Central Board of Film Certification (CBFC):
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>&lsquo;U&rsquo; (Universal):</strong> Unrestricted public exhibition suitable for all age groups.</li>
              <li><strong>&lsquo;UA&rsquo; (Parental Guidance):</strong> Parental guidance recommended for children under 12 years of age.</li>
              <li><strong>&lsquo;A&rsquo; (Adults Only):</strong> Strictly restricted to individuals aged 18 years and above. Patrons must present valid government photo ID (Aadhaar, Driving Licence, Voter ID, Passport) at the cinema entry gate. CineVerse and its cinema partners will deny admission without refund to minors presenting &lsquo;A&rsquo;-rated tickets.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-[#1B1320] mb-3">3. 3D Theatre Sightline &amp; Heatmap Disclaimer</h2>
            <div className="bg-[#FAF4ED] p-5 rounded-2xl border border-[#E6DCD2] text-sm">
              <p className="font-semibold text-[#1B1320] mb-2">Honest Representation Policy:</p>
              <p>
                Our interactive 3D auditorium preview, comfortable field of view calculations, and raycast obstruction ratings are <strong>geometric estimates based on static architectural models</strong>. They serve as general consumer guidance and do not model live audience members, physical heads, or temporary auditorium fixtures. CineVerse does not warrant that your physical line of sight will be 100% unobstructed during any live screening.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-[#1B1320] mb-3">4. Anti-Scalping &amp; Prohibition of Ticket Resale</h2>
            <p>
              Tickets purchased via CineVerse are intended solely for personal, non-commercial use by the purchaser and their party. Any unauthorized resale, black-marketing, or offering of tickets above face value is strictly prohibited under Indian law and local state entertainment regulations. CineVerse reserves the right to void any ticket detected on unauthorized resale platforms without refund.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-[#1B1320] mb-3">5. Cinema Admission &amp; Venue Rules</h2>
            <p>
              Admission to the auditorium remains subject to the venue operator&rsquo;s standard regulations:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Outside food and beverages are not permitted inside theatre premises per state cinema regulations.</li>
              <li>Cinema management reserves the right of admission and may conduct security screenings (bag checks, metal detectors).</li>
              <li>Entry is granted upon scanning the valid Ed25519 digital QR code presented on your mobile device or printed ticket.</li>
            </ul>
          </section>

          <section className="pt-4 border-t border-[#E6DCD2]">
            <p className="text-sm text-[#70647C]">
              For inquiries regarding these terms, contact <a href="mailto:legal@cineverse.in" className="text-[#C8102E] underline">legal@cineverse.in</a> or visit our <Link href="/support" className="text-[#C8102E] underline">Support Page</Link>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

