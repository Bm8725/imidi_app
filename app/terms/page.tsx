"use client";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

// Terms of Service data structure in English
const TERMS_SECTIONS = [
  {
    id: "acceptance",
    title: "1. Acceptance of Terms",
    content: "By accessing the imidi.ro website and utilizing our hardware products (TS4X, i-volution) or MyCloud services, you agree to comply with and be bound by these terms and conditions. If you do not agree, please refrain from using our services.",
  },
  {
    id: "licensing",
    title: "2. Licensing and Hardware Usage",
    content: "Licenses for the software associated with TS4X and i-volution are intended for use strictly according to the purchased package. Unauthorized resale, source code modification, or reverse engineering of the equipment is strictly prohibited without prior written consent from IMIDI.",
  },
  {
    id: "accounts",
    title: "3. MyCloud Services and User Accounts",
    content: "You are solely responsible for maintaining the confidentiality of your MyCloud account credentials. We reserve the right to suspend accounts that violate fair use guidelines or compromise the security of our infrastructure.",
  },
  {
    id: "liability",
    title: "4. Limitation of Liability",
    content: "IMIDI provides all products and services on an 'as is' basis. While we make every effort to ensure the continuous availability of MyCloud and the proper functioning of our hardware, we cannot be held liable for any data loss or commercial disruptions caused by external factors.",
  },
  {
    id: "bulk-orders",
    title: "5. Bulk Orders and Billing",
    content: "Any volume orders (bulk orders) or custom pricing requests must be managed through our sales department at licensing@imidi.ro. Prices and commercial terms become binding only upon contract signature or the issuance of a proforma invoice.",
  },
  {
    id: "modifications",
    title: "6. Changes to Terms",
    content: "We reserve the right to modify these terms at any time to reflect legislative updates or changes to our TS4X and i-volution product lines. Continued use of our services constitutes acceptance of the updated terms.",
  },
];

export default function TermsPage() {
  return (
    <div className="bg-[#FAFAFA] text-[#111111] min-h-screen flex flex-col antialiased selection:bg-[#0070F3]/10 selection:text-[#0070F3]">
      <style>{`
        @import url('https://googleapis.com');
        .corp-sans { font-family: 'Inter', sans-serif; }
        .corp-mono { font-family: 'JetBrains Mono', monospace; }
      `}</style>

      <Navbar />

      {/* Hero Header Minimalist */}
      <div className="corp-sans bg-white border-b border-[#EAEAEA] pt-32 pb-12 text-left">
        <div className="w-full max-w-3xl mx-auto px-6 space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-black">Terms of Service</h1>
          <p className="text-sm text-[#666666] leading-relaxed">
            Last updated: July 2026. Legal rules, rights, and obligations regarding the use of the IMIDI ecosystem (TS4X, i-volution, MyCloud).
          </p>
        </div>
      </div>

      {/* Main Content Terms */}
      <main className="corp-sans flex-1 w-full max-w-3xl mx-auto px-6 py-10 space-y-6">
        <div className="bg-white border border-[#EAEAEA] rounded-xl p-6 sm:p-8 shadow-[0_1px_2px_rgba(0,0,0,0.02)] space-y-8">
          
          {TERMS_SECTIONS.map((section) => (
            <div key={section.id} className="space-y-2 border-b border-[#EAEAEA] last:border-0 pb-6 last:pb-0">
              <h2 className="text-base font-semibold text-black tracking-tight">
                {section.title}
              </h2>
              <p className="text-sm text-[#666666] leading-relaxed">
                {section.content}
              </p>
            </div>
          ))}

        </div>

        {/* Discrete Commercial Contact Box */}
        <div className="bg-[#FAFAFA] border border-[#EAEAEA] border-dashed rounded-xl p-5 text-left flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <h4 className="text-xs font-semibold text-black">Commercial or licensing questions?</h4>
            <p className="text-xs text-[#666666]">
              For details about volume contracts or specific software usage rights, please contact our sales team.
            </p>
          </div>
          <a 
            href="mailto:licensing@imidi.ro" 
            className="corp-mono text-xs font-semibold text-[#0070F3] hover:underline shrink-0"
          >
            licensing@imidi.ro →
          </a>
        </div>
      </main>

      <Footer />
    </div>
  );
}
