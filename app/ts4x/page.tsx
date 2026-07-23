"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

// Extras din JSX pentru a elimina eroarea de parsare Turbopack
const BLACK_KEYS = [2, 5, 7, 10, 12, 15, 17, 20, 22, 25, 27, 30, 32, 35];

export default function TryTS4XPage() {
  const [copied, setCopied] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const betaLicenseKey = "TS4X-BETA-LIVE-2026-X99";

  const handleCopy = () => {
    navigator.clipboard.writeText(betaLicenseKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    const interval = setInterval(() => setActiveStep((prev) => (prev + 1) % 3), 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-[#F5F5F7] text-[#1D1D1F] min-h-screen flex flex-col antialiased selection:bg-[#FF4500]/10 selection:text-[#FF4500] relative overflow-x-hidden">
      <style>{`
        @import url('https://googleapis.com');
        .corp-sans { font-family: 'Inter', sans-serif; } .corp-mono { font-family: 'JetBrains Mono', monospace; }
        .scene-3d { perspective: 1000px; perspective-origin: 50% 0%; }
        .keyboard-3d { transform-style: preserve-3d; transform: rotateX(55deg) rotateY(0deg) rotateZ(-25deg); animation: float3D 8s ease-in-out infinite alternate; }
        @keyframes float3D { 0% { transform: rotateX(50deg) rotateY(-2deg) rotateZ(-20deg) translateY(0px); } 100% { transform: rotateX(58deg) rotateY(2deg) rotateZ(-28deg) translateY(-15px); } }
      `}</style>
      
      {/* BACKGROUND AREA: 3D MATRIX ENGINE */}
      <div className="absolute top-20 right-[-100px] md:right-10 w-full max-w-[650px] h-[500px] pointer-events-none select-none z-0 scene-3d opacity-40 md:opacity-70 border-t border-l border-black/5">
        <div className="keyboard-3d absolute inset-0 flex items-center justify-center pt-20">
          <div className="flex bg-[#EAEAEA] p-4 rounded-xl border border-black/5 shadow-[0_10px_30px_rgba(0,0,0,0.05)] gap-[2px]">
            {[...Array(14)].map((_, i) => (
              <div key={i} className="relative w-7 h-40 bg-gradient-to-b from-[#EAEAEA] via-[#FFF] to-[#D5D5D5] rounded-b border-b-[6px] border-[#B5B5B5] shadow-sm flex-shrink-0">
                {BLACK_KEYS.includes(i) && (
                  <div className="absolute top-0 right-[-8px] w-4 h-24 bg-gradient-to-b from-[#444] via-[#111] to-[#222] rounded-b border-b-[4px] border-[#000] z-20 shadow-md border-x border-zinc-700" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <Navbar />

      <main className="corp-sans flex-1 w-full max-w-5xl mx-auto px-6 pt-32 pb-20 space-y-6 relative z-10">
        {/* HERO TITLE BLOCK */}
        <div className="relative border-b border-[#E5E5E7] bg-white/80 backdrop-blur-xl -mx-6 px-6 pt-6 pb-8 border-t rounded-xl sm:rounded-none shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <h1 className="text-2xl font-bold tracking-tight text-[#1D1D1F] flex items-center gap-2">
            <span className="bg-gradient-to-r from-[#FF3333] via-[#FF6A00] to-[#FFAA00] bg-clip-text text-transparent">TS4X Pro Engine</span>
          </h1>
          <p className="text-sm text-[#515154] max-w-2xl leading-relaxed mt-1.5">
            Real-time audio processing system built for live stage setups. Guarantees under <span className="font-semibold text-[#1D1D1F] underline underline-offset-4 decoration-[#FF4500]">1.8ms latency for .apk and desktop version</span>, intelligent velocity mapping, and absolute digital stability.
          </p>
        </div>

        {/* WORKSPACE ARCHITECTURE GRID */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-start">
          {/* SANDBOX TESTING WITH LIVE ANIMATED STEPS */}
          <section className="md:col-span-3 border border-[#E5E5E7] rounded-xl bg-white/90 backdrop-blur-md p-5 space-y-5 shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:border-[#FF4500]/30 transition-all duration-300">
            <div>
              <h2 className="text-sm font-semibold text-[#1D1D1F]">Web Sandbox Testing TS4X synth</h2>
              <p className="text-xs text-[#515154]">Follow these simple steps to initialize your virtual environment handshake.</p>
            </div>
            
            <div className="space-y-3.5 border-t border-[#E5E5E7] pt-4">
              {[
                { idx: 0, step: "01", title: "Connect MIDI", desc: "Plug your USB-MIDI cable or wireless transmitter directly into your device." },
                { idx: 1, step: "02", title: "Map Channels", desc: "The sandbox terminal automatically detects registers and filters velocity data instantly." },
                { idx: 2, step: "03", title: "Load Set & Live Mode", desc: "Launch the environment window to trigger preloaded stage-ready soundbanks." }
              ].map((s) => {
                const isCurrent = activeStep === s.idx;
                return (
                  <div key={s.step} className={`flex gap-4 p-2 rounded-xl transition-all duration-500 ${isCurrent ? "bg-[#FF4500]/5 border border-[#FF4500]/10 translate-x-1" : "border border-transparent"}`}>
                    <span className={`corp-mono text-xs font-semibold w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-all duration-500 ${isCurrent ? "bg-gradient-to-r from-[#FF4500] to-[#E60000] text-white shadow-[0_2px_10px_rgba(255,69,0,0.2)] scale-110" : "bg-[#F5F5F7] border border-[#E5E5E7] text-[#515154]"}`}>{s.step}</span>
                    <div>
                      <h3 className={`text-xs font-semibold transition-colors duration-500 ${isCurrent ? "text-[#FF4500]" : "text-[#1D1D1F]"}`}>{s.title}</h3>
                      <p className="text-xs text-[#86868B] mt-0.5">{s.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <a href="https://vi.imidi.ro/app_xyz2025magfshgXX/" target="_blank" rel="noopener noreferrer" className="block text-center w-full py-2.5 rounded-lg bg-gradient-to-r from-[#FF4500] to-[#E60000] text-white hover:opacity-95 text-xs font-semibold transition-all shadow-[0_4px_15px_rgba(255,69,0,0.15)]">Launch Browser TS4X ↗</a>
          </section>

          {/* CHECKOUT CARD */}
          <section className="md:col-span-2 border border-[#E5E5E7] rounded-xl bg-white/90 backdrop-blur-md p-5 space-y-5 flex flex-col justify-between shadow-[0_4px_20px_rgba(0,0,0,0.02)] relative overflow-hidden group hover:border-[#FF8800]/30 transition-all duration-300">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#E60000] via-[#FF4500] to-[#FF8800]" />
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-[#1D1D1F]">TS4x License</h2>
              <div className="flex items-baseline gap-1"><span className="text-3xl font-bold tracking-tight text-[#1D1D1F]">$249</span><span className="text-xs text-[#515154] font-medium uppercase corp-mono">EUR / single payment</span></div>
              <ul className="text-xs text-[#515154] space-y-2.5 border-t border-[#E5E5E7] pt-4 leading-normal">
                <li className="flex items-center gap-2"><span className="text-[#FF4500] font-semibold">✓</span> Lifetime priority firmware hotfixes</li>
                <li className="flex items-center gap-2"><span className="text-[#FF4500] font-semibold">✓</span> Fully optimized for live stage setups</li>
                <li className="flex items-center gap-2"><span className="text-[#FF4500] font-semibold">✓</span> 14-day hassle-free money-back</li>
              </ul>
            </div>
            <a href="/api/checkout/ts4x" className="w-full bg-[#1D1D1F] text-white hover:bg-black border border-transparent text-xs font-semibold py-2.5 px-4 rounded-lg transition-all shadow-sm text-center block">Buy TS4X Pro License</a>
          </section>
        </div>

        {/* BETA SERIAL NODE (AICI TE DUCE LA GET LICENCE ACCESIBIL ȘI CORECT POZITIONAT) */}
        <div className="border border-[#E5E5E7] rounded-xl p-5 bg-white/90 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-[0_4px_20px_rgba(0,0,0,0.01)] hover:border-[#FF4500]/20 transition-all duration-300">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-[#1D1D1F]">Get Free Beta License</h3>
              <span className="bg-[#FF4500]/10 text-[#FF4500] text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md corp-mono animate-pulse">Live testing</span>
            </div>
            <p className="text-xs text-[#515154]">Initialize your environment block with our temporary community handshake node.</p>
          </div>
          
          <div className="flex items-center gap-2 bg-[#F5F5F7] border border-[#E5E5E7] p-1.5 rounded-xl max-w-full overflow-hidden sm:max-w-xs shrink-0">
            <span className="text-xs font-bold text-[#1D1D1F] corp-mono px-3 truncate select-all">{betaLicenseKey}</span>
            <button 
              onClick={handleCopy}
              className={`h-8 px-4 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all ${
                copied 
                  ? "bg-green-600 text-white shadow-sm" 
                  : "bg-black text-white hover:bg-zinc-800"
              }`}
            >
              {copied ? "Copied!" : "Copy Node"}
            </button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
