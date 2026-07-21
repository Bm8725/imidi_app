"use client";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

// Privacy Policy data structure in English
const PRIVACY_SECTIONS = [
  {
    id: "data-collection",
    title: "1. Data Collection",
    content: "We collect information you provide directly to us when using our services (TS4X, i-volution, and MyCloud). This includes your email address when contacting us for support (contact@imidi.ro) and billing information required for licensing and bulk hardware orders (licensing@imidi.ro).",
  },
  {
    id: "data-usage",
    title: "2. How We Use Your Information",
    content: "The data we collect is used exclusively to deliver the requested services, process bulk orders, provide dedicated technical support, and continuously improve our hardware products and cloud infrastructure.",
  },
  {
    id: "data-sharing",
    title: "3. Third-Party Sharing",
    content: "We do not sell, trade, or otherwise transfer your personal data to outside parties. This does not include trusted third parties who assist us in operating our website or servicing you, so long as those parties agree to keep this information confidential.",
  },
  {
    id: "data-security",
    title: "4. Information Security",
    content: "We implement a variety of industry-standard security measures to maintain the safety of your personal information. Connections are encrypted, and databases are strictly accessible only by a limited number of persons with special access rights.",
  },
  {
    id: "user-rights",
    title: "5. Your Rights",
    content: "You have the right to request access to, rectification of, or permanent deletion of your personal data from our systems. For any data protection requests or inquiries, you can contact us at any time at contact@imidi.ro.",
  },
];

export default function PrivacyPolicyPage() {
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
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-black">Privacy Policy</h1>
          <p className="text-sm text-[#666666] leading-relaxed">
            Last updated: July 2026. Your data security is our priority at IMIDI. Read below to understand how we handle information across the TS4X, i-volution, and MyCloud ecosystems.
          </p>
        </div>
      </div>

      {/* Main Content Privacy */}
      <main className="corp-sans flex-1 w-full max-w-3xl mx-auto px-6 py-10 space-y-6">
        <div className="bg-white border border-[#EAEAEA] rounded-xl p-6 sm:p-8 shadow-[0_1px_2px_rgba(0,0,0,0.02)] space-y-8">
          
          {PRIVACY_SECTIONS.map((section) => (
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

        {/* Discrete Contact Box */}
        <div className="bg-[#FAFAFA] border border-[#EAEAEA] border-dashed rounded-xl p-5 text-left flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <h4 className="text-xs font-semibold text-black">Questions about our privacy policy?</h4>
            <p className="text-xs text-[#666666]">
              Our data protection team is here to clarify any concerns.
            </p>
          </div>
          <a 
            href="mailto:contact@imidi.ro" 
            className="corp-mono text-xs font-semibold text-[#0070F3] hover:underline shrink-0"
          >
            contact@imidi.ro →
          </a>
        </div>
      </main>

      <Footer />
    </div>
  );
}
