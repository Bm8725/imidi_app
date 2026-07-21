"use client";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppWidget from "@/components/WhatsAppWidget";

// Adresele de contact — simplu, doar email. Adaugă/scoate aici dacă mai apare vreuna.
const CONTACT_EMAILS = [
  {
    label: "General Support",
    email: "contact@imidi.ro",
    note: "TS4X, i-volution, MyCloud — any questions or issues",
  },
  {
    label: "Sales / Licensing",
    email: "licensing@imidi.ro",
    note: "Price, licences, and bulk orders for TS4X or i-volution hardware",
  },
];

export default function ContactPage() {
  return (
    <div className="bg-[#FAFAFA] text-[#111111] min-h-screen flex flex-col antialiased selection:bg-[#0070F3]/10 selection:text-[#0070F3]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        .corp-sans { font-family: 'Inter', sans-serif; }
        .corp-mono { font-family: 'JetBrains Mono', monospace; }
      `}</style>

      <Navbar />

      {/* Hero Header Minimalist */}
      <div className="corp-sans bg-white border-b border-[#EAEAEA] pt-32 pb-12 text-left">
        <div className="w-full max-w-3xl mx-auto px-6 space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-black">Contact us</h1>
          <p className="text-sm text-[#666666] leading-relaxed">
            Write an message to our team and we will get back to you as soon as possible. You can also reach us on WhatsApp using the widget in the bottom right corner.
          </p>
        </div>
      </div>

      <main className="corp-sans flex-1 w-full max-w-3xl mx-auto px-6 py-10 space-y-4">
        {CONTACT_EMAILS.map((c) => (
          <a
            key={c.email}
            href={`mailto:${c.email}`}
            className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-[#EAEAEA] rounded-xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-all hover:border-[#0070F3]/40 hover:shadow-[0_4px_16px_rgba(0,112,243,0.06)]"
          >
            <div className="space-y-1 min-w-0">
              <h3 className="text-sm font-semibold text-black tracking-tight">{c.label}</h3>
              <p className="text-xs text-[#666666]">{c.note}</p>
            </div>
            <span className="corp-mono shrink-0 text-sm sm:text-base font-semibold text-[#0070F3] group-hover:underline">
              {c.email} →
            </span>
          </a>
        ))}

        {/* Footer discret — alternativă rapidă */}
        <div className="bg-[#FAFAFA] border border-[#EAEAEA] border-dashed rounded-xl p-5 text-center">
          <p className="text-xs text-[#666666]">
            Prefer to last minute? Reach us on WhatsApp using the widget in the bottom right corner of the page.
          </p>
        </div>
      </main>

  
      <Footer />
    </div>
  );
}