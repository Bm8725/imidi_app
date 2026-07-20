"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function TryTS4XPage() {
  const [copied, setCopied] = useState(false);
  const betaLicenseKey = "TS4X-BETA-LIVE-2026-X99";

  const handleCopy = () => {
    navigator.clipboard.writeText(betaLicenseKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white text-[#171717] min-h-screen flex flex-col justify-between antialiased selection:bg-[#0070F3]/10 selection:text-[#0070F3]">
      <style>{`
        @import url('https://googleapis.com');
        .geist-sans { font-family: 'Inter', sans-serif; }
        .geist-mono { font-family: 'JetBrains Mono', monospace; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
      `}</style>

      <Navbar />

      <main className="geist-sans flex-1 w-full max-w-5xl mx-auto px-6 pt-32 pb-20 space-y-10 animate-fade-in">
        {/* HEADER SECTION */}
        <div className="border-b border-[#EEEEEE] pb-6 space-y-2">
          
          <h1 className="text-3xl font-bold tracking-tight text-black">TS4X Pro Engine</h1>
          <p className="text-sm text-[#666666] max-w-3xl leading-relaxed">
            Real-time audio processing system built for live stage and studio setups. Guarantees under <span className="font-semibold text-black underline underline-offset-4 decoration-[#0070f3]">1.8ms latency for .apk and desktop version</span>, intelligent velocity mapping, and absolute digital stability.
          </p>
        </div>

        {/* MIDDLE GRID */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8 items-start">
          {/* SANDBOX TESTING */}
          <div className="md:col-span-3 border border-[#EAEAEA] rounded-xl bg-white p-6 shadow-[0_2px_4px_rgba(0,0,0,0.01)] space-y-5 transition-all hover:border-[#CCCCCC] hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
            <div>
              <h2 className="text-base font-semibold text-black">Web Sandbox Testing TS4X synth</h2>
              <p className="text-xs text-[#666666]">Follow these simple steps to initialize your virtual environment handshake.</p>
            </div>
            <div className="space-y-3.5 border-t border-[#F1F1F1] pt-4">
              {[
                { step: "01", title: "Connect MIDI", desc: "Plug your USB-MIDI cable or wireless transmitter directly into your device." },
                { step: "02", title: "Map Channels", desc: "The sandbox terminal automatically detects registers and filters velocity data instantly." },
                { step: "03", title: "Execute Live Mode", desc: "Launch the environment window to trigger preloaded stage-ready soundbanks." }
              ].map((s) => (
                <div key={s.step} className="flex gap-4 group">
                  <span className="geist-mono text-xs font-semibold bg-[#FAFAFA] border border-[#EAEAEA] text-[#666666] w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-colors group-hover:bg-black group-hover:text-white duration-200">{s.step}</span>
                  <div>
                    <h3 className="text-xs font-semibold text-black group-hover:text-[#0070f3] transition-colors">{s.title}</h3>
                    <p className="text-xs text-[#666666] mt-0.5">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <a href="https://vi.imidi.ro/app_xyz2025magfshgXX/" target="_blank" rel="noopener noreferrer" className="block text-center w-full py-2.5 rounded-lg bg-black text-white hover:bg-white hover:text-black border border-black text-xs font-medium transition-all active:scale-[0.99] shadow-sm">Launch Browser TS4X ↗</a>
          </div>

          {/* CHECKOUT CARD */}
          <div className="md:col-span-2 border border-[#EAEAEA] rounded-xl bg-[#FAFAFA] p-6 space-y-5 flex flex-col justify-between min-h-[305px] transition-all hover:border-[#CCCCCC] hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
            <div className="space-y-3">
              <span className="text-[10px] font-bold text-[#666666] uppercase tracking-widest geist-mono">PRO STAGE</span>
              <h2 className="text-lg font-semibold text-black">Perpetual License</h2>
              <div className="flex items-baseline gap-1.5"><span className="text-3xl font-bold text-black">$249</span><span className="text-xs text-[#666666] font-medium">EUR/ single payment</span></div>
              <ul className="text-xs text-[#444444] space-y-1.5 border-t border-[#EAEAEA] pt-3 leading-relaxed">
                <li>✓ Lifetime priority firmware hotfixes</li>
                <li>✓ Fully optimized for live stage setups</li>
                <li>✓ 14-day hassle-free money-back</li>
              </ul>
            </div>
            <button onClick={() => alert("Redirecting to Stripe...")} className="w-full py-2.5 rounded-lg bg-[#0070F3] text-white hover:bg-[#0062d6] text-xs font-medium transition-all active:scale-[0.99] shadow-sm">Buy TS4X Pro License</button>
          </div>
        </div>

        {/* BETA SERIAL NODE */}
        <div className="border border-[#EAEAEA] rounded-xl p-5 bg-gradient-to-r from-[#FAFAFA] to-[#FFFFFF] flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:border-[#0070F3]/30">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0070F3] opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-[#0070F3]"></span></span>
              <h4 className="text-xs font-semibold text-black uppercase tracking-wider geist-mono">BETA Serial License Activation</h4>
            </div>
            <p className="text-xs text-[#666666] max-w-xl leading-normal">Use this developer node key inside the sandbox console window to uncap high-tier audio driver parameters.</p>
          </div>
          <div className="w-full sm:w-auto flex items-center border border-[#EAEAEA] rounded-lg bg-white overflow-hidden shadow-sm">
            <code className="geist-mono text-[11px] px-3 py-2 text-black font-medium select-all">{betaLicenseKey}</code>
            <button onClick={handleCopy} className="border-l border-[#EAEAEA] bg-[#FAFAFA] hover:bg-[#EEEEEE] text-xs font-medium px-4 py-2 text-black transition-colors min-w-[75px]">{copied ? "Copied!" : "Copy"}</button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
