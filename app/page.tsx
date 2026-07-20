// app/page.tsx
'use client';

import { useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import MediaHero from "@/components/MediaHero";
import Footer from "@/components/Footer";


const FAQS = [
  {
    q: "What is TS4X and how is it different from a standard VST synth?",
    a: "TS4X is a live-performance-first synth engine — built around sub-1.8ms latency and .wav-sample playback, tuned specifically for real-time stage use rather than studio-only production plugins.",
  },
  {
    q: "Do I need special hardware to use TS4X?",
    a: "No. TS4X runs standalone on desktop and mobile. The i-volution controller is optional — it adds velocity-sensitive SOLO/BASS integration for accordion players, but any MIDI controller works.",
  },
  {
    q: "Is the Pro License a one-time purchase or a subscription?",
    a: "The $249 Pro License is a one-time, perpetual purchase. It includes the full DSP core engine and priority firmware hotfixes for life — no recurring fee.",
  },
  {
    q: "How does MyCloud sync work across devices?",
    a: "MyCloud automatically backs up your sound banks, presets and custom maps (including KORG/Genos formats) to 30GB of secure storage, synced instantly across every device you're signed into.",
  },
  {
    q: "Which accordion controllers are compatible with i-volution?",
    a: "i-volution is a universal MIDI controller system — it works with any accordion fitted with standard MIDI channels, with full velocity mapping across both SOLO and BASS sections.",
  },
  {
    q: "Do you offer refunds?",
    a: "Yes — TS4X Pro License purchases are covered by a 14-day money-back guarantee if the engine doesn't fit your setup, no questions asked.",
  },
];

export default function HomePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="bg-black text-white min-h-screen flex flex-col items-center px-5 sm:px-6 pt-28 pb-20 selection:bg-fuchsia-900/60 selection:text-white overflow-x-hidden relative">

      <style>{`
        @keyframes aw-fade-up { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes aw-float-a { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(20px, -24px); } }
        @keyframes aw-float-b { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(-24px, 18px); } }
        @keyframes aw-float-c { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(16px, 20px); } }
        @keyframes aw-glow-pulse { 0%, 100% { box-shadow: 0 10px 30px -10px rgba(217,70,239,0.6); } 50% { box-shadow: 0 14px 40px -8px rgba(249,115,22,0.7); } }

        .aw-hero-item { opacity: 0; animation: aw-fade-up 0.7s ease-out forwards; }
        .aw-blob-a { animation: aw-float-a 14s ease-in-out infinite; }
        .aw-blob-b { animation: aw-float-b 17s ease-in-out infinite; }
        .aw-blob-c { animation: aw-float-c 12s ease-in-out infinite; }
        .aw-cta-glow { animation: aw-glow-pulse 3.5s ease-in-out infinite; }

        .aw-faq-wrap { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 0.35s ease; }
        .aw-faq-wrap.open { grid-template-rows: 1fr; }
        .aw-faq-inner { overflow: hidden; }
      `}</style>

      {/* Meniul premium AWOWO cu efect de sticlă */}
      <Navbar />

      {/* Glow ambiental — portocaliu / fuchsia, plutitor */}
      <div className="aw-blob-b absolute top-[58%] right-0 w-[250px] sm:w-[450px] h-[250px] sm:h-[450px] bg-fuchsia-600/10 blur-[110px] sm:blur-[150px] rounded-full pointer-events-none" />
      <div className="aw-blob-c absolute top-[8%] left-0 w-[220px] sm:w-[350px] h-[220px] sm:h-[350px] bg-rose-600/10 blur-[100px] sm:blur-[130px] rounded-full pointer-events-none" />

      {/* Main Container */}
      <div className="relative max-w-4xl w-full text-center z-10 space-y-20 sm:space-y-24">

        {/* HERO SECTION — full-bleed cu media de fundal */}
        <div className="relative left-1/2 -translate-x-1/2 w-screen min-h-[560px] sm:min-h-[680px] flex items-center overflow-hidden">
          <MediaHero />
          <div className="relative z-10 w-full max-w-4xl mx-auto px-5 sm:px-6 space-y-10 sm:space-y-12 py-16 sm:py-20">
          <div className="space-y-2 aw-hero-item" style={{ animationDelay: "0.05s" }}>
            <h1 className="text-5xl sm:text-6xl md:text-8xl font-normal tracking-tighter text-white">
              iMIDI
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-fuchsia-500">.</span>
            </h1>
          </div>

          <div className="max-w-2xl mx-auto space-y-4 aw-hero-item" style={{ animationDelay: "0.15s" }}>
            <p className="text-lg sm:text-xl md:text-2xl font-light text-zinc-300 tracking-wide font-sans leading-relaxed px-1">
              The standard for modern synth LIVE performance, based on audio samples (.wav) at high quality and low latency.
            </p>
            <p className="text-xs sm:text-sm font-mono text-zinc-500 tracking-widest uppercase">
              Powered by TS-CORE DSP & LIVE PERFORMANCE
            </p>
          </div>


          </div>
        </div>

        {/* ================= SECTION: COMMERCE NODES ================= */}
        <div className="space-y-8 pt-12 border-t border-zinc-900 text-left">
          <div className="space-y-1">
            <h2 className="text-2xl sm:text-3xl font-light tracking-tight text-white pt-2">Expand Your iMIDI Setup</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-sans">

            {/* CARD 1: TS4X LICENSE — bordură gradient portocaliu */}
            <div className="relative rounded-2xl p-[1px] bg-gradient-to-br from-orange-500/40 via-zinc-800 to-zinc-800 hover:from-orange-500/70 hover:via-fuchsia-500/20 transition-all duration-500 hover:-translate-y-1 group">
              <div className="bg-zinc-950/90 backdrop-blur-sm p-6 rounded-2xl flex flex-col justify-between items-start space-y-6 h-full">
                <div className="space-y-2 w-full">
                  <div className="flex justify-between items-center w-full flex-wrap gap-2">
                    <span className="text-[9px] font-mono text-zinc-500 tracking-wider uppercase">PERPETUAL_CORE</span>
                    <span className="text-lg font-mono font-bold text-white">$249.00</span>
                  </div>
                  <h3 className="text-lg font-normal text-zinc-100 group-hover:text-orange-400 transition-colors">TS4X Synth Pro License</h3>
                  <p className="text-xs text-zinc-400 font-light leading-relaxed">
                    Unlock the complete DSP core engine for life. Features advanced multi-channel execution, guaranteed sub-1.8ms latency, and priority firmware hotfixes.
                  </p>
                </div>
                <Link
                  href="/ts4x"
                  className="w-full h-10 bg-white text-black font-mono text-xs font-bold uppercase rounded-xl hover:bg-gradient-to-r hover:from-orange-500 hover:to-fuchsia-500 hover:text-white transition-all duration-300 active:scale-[0.99] flex items-center justify-center"
                >
                  Purchase License
                </Link>
              </div>
            </div>

            {/* CARD 2: CLOUD STORAGE — bordură gradient fuchsia */}
            <div className="relative rounded-2xl p-[1px] bg-gradient-to-br from-fuchsia-500/40 via-zinc-800 to-zinc-800 hover:from-fuchsia-500/70 hover:via-orange-500/20 transition-all duration-500 hover:-translate-y-1 group">
              <div className="bg-zinc-950/90 backdrop-blur-sm p-6 rounded-2xl flex flex-col justify-between items-start space-y-6 h-full">
                <div className="space-y-2 w-full">
                  <div className="flex justify-between items-center w-full flex-wrap gap-2">
                    <span className="text-[9px] font-mono text-zinc-500 tracking-wider uppercase">CLOUD_EXPANSION</span>
                    <span className="text-lg font-mono font-bold text-white">$49.9<span className="text-xs text-zinc-600 font-light">/year</span></span>
                  </div>
                  <h3 className="text-lg font-normal text-zinc-100 group-hover:text-fuchsia-400 transition-colors">MyCloud Preset Storage</h3>
                  <p className="text-xs text-zinc-400 font-light leading-relaxed">
                    Expand your private space to 30 GB of secure storage. Back up thousands of sound banks, performance presets, TS4x and KORG/Genos custom maps straight from the stage.
                  </p>
                </div>
                <Link
                  href="/mycloud"
                  className="w-full h-10 bg-zinc-900 text-zinc-200 border border-zinc-800 font-mono text-xs font-bold uppercase rounded-xl hover:bg-gradient-to-r hover:from-fuchsia-500 hover:to-rose-500 hover:text-white hover:border-transparent transition-all duration-300 active:scale-[0.99] flex items-center justify-center"
                >
                  Upgrade space Storage
                </Link>
              </div>
            </div>

          </div>
        </div>

        {/* CORE CORE_ENGINE DETAILS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 sm:gap-12 pt-12 border-t border-zinc-900 text-left">
          <div className="space-y-3">
            <span className="text-xs font-mono text-orange-400 tracking-wider uppercase">[01 / SOFTWARE]</span>
            <h3 className="text-xl font-normal text-zinc-100">TS4X Synth Engine</h3>
            <p className="text-sm font-sans text-zinc-400 font-light leading-relaxed">
              Ultra-low 1.8ms latency audio engine built for mobile and desktop systems. Features lossless cloud synchronization, integrated loopers, and step-based samplers.
            </p>
          </div>

          <div className="space-y-3">
            <span className="text-xs font-mono text-fuchsia-400 tracking-wider uppercase">[02 / HARDWARE]</span>
            <h3 className="text-xl font-normal text-zinc-100">i-volution MIDI System</h3>
            <p className="text-sm font-sans text-zinc-400 font-light leading-relaxed">
              Universal hardware controller designed specifically for accordions. Complete velocity-sensitive integration for both SOLO and BASS sections across all MIDI channels.
            </p>
          </div>
        </div>

        {/* CONCEPTUAL FLOW (MIDI 3.0 Ecosystem) */}
        <div className="space-y-8 pt-12 border-t border-zinc-900 text-left">
          <div className="space-y-2">
            <span className="text-xs font-mono text-zinc-500 tracking-wider uppercase">Architecture // Flow</span>
            <h2 className="text-2xl sm:text-3xl font-light tracking-tight text-white">The MIDI 3.0 Interconnection Concept</h2>
          </div>
          <p className="text-sm font-sans text-zinc-400 font-light leading-relaxed max-w-2xl">
            A unified system redefining interaction. The architecture bridges physical controller articulation with next-gen local DSP processing, extending into cloud sharing channels.
          </p>

          <div className="bg-zinc-950/50 border border-zinc-900 p-6 rounded-2xl font-mono text-xs text-zinc-400 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 sm:gap-4 text-center items-center">
              <div className="p-3 border border-zinc-800 bg-zinc-900/30 rounded-xl text-zinc-200">[MIDI Controller]</div>
              <div className="text-zinc-600 hidden md:block">→</div>
              <div className="p-3 border border-fuchsia-500/30 bg-gradient-to-br from-orange-500/10 to-fuchsia-500/10 rounded-xl bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-fuchsia-400 font-bold">
                [TS4X Core DSP]
              </div>
              <div className="text-zinc-600 hidden md:block">→</div>
              <div className="p-3 border border-zinc-800 bg-zinc-900/30 rounded-xl text-zinc-200">[Cloud Platform]</div>
            </div>
            <p className="text-[11px] font-sans text-zinc-500 text-center pt-2 italic">
              *Concept developed by iMIDI.co.uk to fulfill modern architectural and performance ecosystem needs.
            </p>
          </div>
        </div>

        {/* HARDWARE & APPLICATION SPECIFICATIONS */}
        <div className="space-y-8 pt-12 border-t border-zinc-900 text-left">
          <div className="space-y-2">
            <span className="text-xs font-mono text-zinc-500 tracking-wider uppercase">System Requirements</span>
            <h2 className="text-2xl sm:text-3xl font-light tracking-tight text-white">Engineered Specs</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-sans">
            <div className="border border-zinc-900 bg-zinc-950/30 p-6 rounded-2xl space-y-2 hover:border-orange-500/30 hover:-translate-y-1 transition-all duration-300">
              <div className="text-xs font-mono text-zinc-500">PROCESSORS</div>
              <p className="text-sm font-medium text-zinc-200">Apple Silicon (M1/M2), Intel x86_64 up to 4.0 GHz, or ARM Cortex-A72 (3nm process).</p>
            </div>

            <div className="border border-zinc-900 bg-zinc-950/30 p-6 rounded-2xl space-y-2 hover:border-fuchsia-500/30 hover:-translate-y-1 transition-all duration-300">
              <div className="text-xs font-mono text-zinc-500">MEMORY & STORAGE</div>
              <p className="text-sm font-medium text-zinc-200">8GB LPDDR4 RAM ensures stable execution. 512GB NVMe SSD optimization for rapid patch loading.</p>
            </div>

            <div className="border border-zinc-900 bg-zinc-950/30 p-6 rounded-2xl space-y-2 hover:border-rose-500/30 hover:-translate-y-1 transition-all duration-300">
              <div className="text-xs font-mono text-zinc-500">AUDIO OUT</div>
              <p className="text-sm font-medium text-zinc-200">24-bit/192kHz stereo DACs, native external USB sound card compatibility, and Bluetooth 5.0 IO.</p>
            </div>
          </div>
        </div>

        {/* ================= SECTION: FAQ ================= */}
        <div className="space-y-8 pt-12 border-t border-zinc-900 text-left">
          <div className="space-y-2">
            <span className="text-xs font-mono text-zinc-500 tracking-wider uppercase">Support // Answers</span>
            <h2 className="text-2xl sm:text-3xl font-light tracking-tight text-white">Frequently Asked Questions</h2>
          </div>

          <div className="flex flex-col gap-3 font-sans">
            {FAQS.map((item, i) => {
              const isOpen = openFaq === i;
              return (
                <div
                  key={item.q}
                  className={`rounded-2xl border transition-colors duration-300 overflow-hidden ${
                    isOpen ? "border-fuchsia-500/30 bg-zinc-950/60" : "border-zinc-900 bg-zinc-950/30"
                  }`}
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                    className="w-full flex items-center justify-between gap-4 text-left px-5 py-4"
                  >
                    <span className={`text-sm sm:text-base font-normal transition-colors ${isOpen ? "text-white" : "text-zinc-200"}`}>
                      {item.q}
                    </span>
                    <span
                      className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full border border-zinc-700 text-zinc-400 transition-transform duration-300"
                      style={{ transform: isOpen ? "rotate(135deg)" : "rotate(0deg)" }}
                    >
                      +
                    </span>
                  </button>
                  <div className={`aw-faq-wrap ${isOpen ? "open" : ""}`}>
                    <div className="aw-faq-inner">
                      <p className="px-5 pb-4 text-xs sm:text-sm text-zinc-400 font-light leading-relaxed">
                        {item.a}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* MISSION STATEMENTS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 pt-12 border-t border-zinc-900 text-left font-sans">
          {[
            { t: "Innovative", d: "High-performance MIDI interfaces tailored for stage and studio setups.", c: "from-orange-400 to-amber-400" },
            { t: "Ultra Fast", d: "Guaranteed real-time response parameters avoiding deployment friction.", c: "from-fuchsia-400 to-rose-400" },
            { t: "Connected", d: "Cloud-synced global access nodes for files, presets, and device templates.", c: "from-rose-400 to-orange-400" },
            { t: "AI Intel", d: "Smart structural data handling to scale workflow automation boundaries.", c: "from-amber-400 to-fuchsia-400" },
          ].map((item) => (
            <div key={item.t} className="space-y-1.5">
              <div className={`h-[2px] w-6 rounded-full bg-gradient-to-r ${item.c} mb-2`} />
              <div className="text-base text-white">{item.t}</div>
              <p className="text-xs text-zinc-400 font-light">{item.d}</p>
            </div>
          ))}
        </div>
        <Footer />
      </div>
    </div>
  );
}