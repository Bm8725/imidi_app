// app/page.tsx
'use client';

import { useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import MediaHero from "@/components/MediaHero";
import Footer from "@/components/Footer";
import AIChatWidget from "@/components/AIChatWidget";

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
    q: "What is E-Market and how does selling work?",
    a: "E-Market is our built-in marketplace for presets, sound banks, scripts and physical instruments. Listing is free for the first 14 days. After that you can promote a listing for a small fee to keep it featured. Buyers can find you through classic search or AI Smith, and message you directly to close the deal.",
  },
  {
    q: "How does MyCloud sync work across devices?",
    a: "MyCloud automatically backs up your sound banks, presets and custom maps (including KORG/Genos formats) to 30GB of secure storage, synced instantly across every device you're signed into.",
  },
  {
    q: "Which accordion controllers are compatible with i-volution?",
    a: "i-volution is a universal MIDI controller system — it works with any accordion fitted with standard MIDI channels, with full velocity mapping across both SOLO and BASS sections.",
  },
];

const PILLARS = [
  {
    eyebrow: "SOFTWARE",
    title: "TS4X Synth Engine",
    desc: "A live-performance synth built for the stage, not just the studio. Sub-1.8ms latency, standalone on desktop and mobile.",
    href: "/ts4x",
    cta: "Explore TS4X",
    color: "#FF5CA1",
  },
  {
    eyebrow: "MARKETPLACE",
    title: "E-Market",
    desc: "Buy and sell presets, sound banks, scripts and instruments directly with other artists. Free to list for 14 days.",
    href: "/e-market",
    cta: "Browse E-Market",
    color: "#FF8A3D",
  },
  {
    eyebrow: "HARDWARE",
    title: "i-volution Controller",
    desc: "A universal MIDI controller purpose-built for accordion — velocity-sensitive SOLO/BASS mapping on any MIDI channel.",
    href: "/products",
    cta: "See i-volution",
    color: "#B47CFF",
  },
];

export default function HomePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="aw-root bg-[#131316] text-[#F2F2F4] min-h-screen flex flex-col items-center px-5 sm:px-6 pt-28 pb-20 selection:bg-[#FF5CA1]/40 selection:text-white overflow-x-hidden relative">

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700;800&family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

        .aw-root { font-family: 'Inter', ui-sans-serif, system-ui, sans-serif; }
        .aw-display { font-family: 'Sora', ui-sans-serif, system-ui, sans-serif; }
        .aw-mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }

        @keyframes aw-fade-up { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes aw-float-a { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(20px, -24px); } }
        @keyframes aw-float-b { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(-24px, 18px); } }
        @keyframes aw-float-c { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(16px, 20px); } }
        @keyframes aw-glow-pulse { 0%, 100% { box-shadow: 0 10px 30px -10px rgba(255,92,161,0.45); } 50% { box-shadow: 0 14px 40px -8px rgba(255,138,61,0.5); } }

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

      {/* Glow ambiental — roz / portocaliu, jucăuș, în ton cu gri-ul de fundal */}
      <div className="aw-blob-b absolute top-[58%] right-0 w-[250px] sm:w-[450px] h-[250px] sm:h-[450px] bg-[#FF5CA1]/10 blur-[110px] sm:blur-[150px] rounded-full pointer-events-none" />
      <div className="aw-blob-c absolute top-[8%] left-0 w-[220px] sm:w-[350px] h-[220px] sm:h-[350px] bg-[#FF8A3D]/10 blur-[100px] sm:blur-[130px] rounded-full pointer-events-none" />

      {/* Main Container */}
      <div className="relative max-w-4xl w-full text-center z-10 space-y-20 sm:space-y-24">

        {/* HERO SECTION — full-bleed cu media de fundal */}
        <div className="relative left-1/2 -translate-x-1/2 w-screen min-h-[560px] sm:min-h-[680px] flex items-center overflow-hidden">
          <MediaHero />
          <div className="relative z-10 w-full max-w-4xl mx-auto px-5 sm:px-6 space-y-10 sm:space-y-12 py-16 sm:py-20">
            <div className="space-y-2 aw-hero-item" style={{ animationDelay: "0.05s" }}>
              <h1 className="aw-display text-5xl sm:text-6xl md:text-8xl font-semibold tracking-tight text-[#F2F2F4]">
                iMIDI
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#FF5CA1] to-[#FF8A3D]">.</span>
              </h1>
            </div>

            <div className="max-w-2xl mx-auto space-y-4 aw-hero-item" style={{ animationDelay: "0.15s" }}>
              <p className="text-lg sm:text-xl md:text-2xl font-light text-[#B4B4BC] tracking-wide leading-relaxed px-1">
               The global digital standard for modern digitalization e-market. Premium, audio samples/presets/content/ delivered 
               instantly anywhere in the world through the cloud  powered by AI.
              </p>

              <p className="aw-mono text-xs sm:text-sm text-[#7C7C86] tracking-widest uppercase">
                iMIDI app · E-Market marketplace · cloud synch
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 aw-hero-item" style={{ animationDelay: "0.25s" }}>
              <Link
                href="/register"
                className="aw-cta-glow w-full sm:w-auto h-12 px-8 bg-gradient-to-r from-[#FF5CA1] to-[#FF8A3D] text-white aw-mono text-xs font-semibold uppercase tracking-wide rounded-xl flex items-center justify-center hover:scale-[1.03] active:scale-[0.98] transition-transform duration-300"
              >
                Get Started Free
              </Link>
              <Link
                href="/e-market"
                className="w-full sm:w-auto h-12 px-8 bg-white/[0.04] text-[#D4D4D9] border border-white/[0.1] aw-mono text-xs font-semibold uppercase tracking-wide rounded-xl flex items-center justify-center hover:bg-white/[0.08] hover:border-white/[0.2] transition-all duration-300"
              >
                 E-Market
              </Link>
            </div>
          </div>
        </div>

        {/* ================= SECTION: THE 3 PILLARS — raspunde direct la "ce e iMIDI" ================= */}
        {/* ================= SECTION: PILLARS / BENEFITS ================= */}
        <div className="pt-20 border-t border-white/10 text-left max-w-7xl mx-auto px-4 sm:px-6">
          
          {/* Header */}
          <div className="mb-12">
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white">
              What you get with iMIDI
            </h2>
            <p className="mt-3 text-sm text-[#A1A1AA] max-w-xl leading-relaxed">
              One unified account giving you seamless access to three production-grade utilities.
            </p>
          </div>

          {/* Grilă cu animație de apariție la încărcare */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch animate-[fadeIn_0.6s_ease-out_both]">
            {PILLARS.map((p, index) => (
              <Link
                key={p.title}
                href={p.href}
                className="group relative bg-transparent pt-6 pb-4 flex flex-col justify-between h-full transition-all duration-300 overflow-hidden"
              >
                {/* LINIA DE SUS CU LUMINE FLUENTĂ AUTONOMĂ (Rulată în loop infinit pe rând) */}
                <div 
                  className="absolute top-0 left-0 h-[1.5px] bg-white/10 w-full overflow-hidden"
                >
                  <div 
                    className="h-full w-1/2 opacity-80 animate-[shimmerLine_4s_infinite_ease-in-out]"
                    style={{
                      background: `linear-gradient(90deg, transparent, ${p.color}, transparent)`,
                      animationDelay: `${index * 1.2}s` /* Pornește pe rând pentru fiecare card */
                    }}
                  />
                </div>

                {/* LUMINA AMBIENTALĂ AUTONOMĂ: Un puls discret din spate care pulsează în loop */}
                <div 
                  className="absolute inset-0 opacity-40 pointer-events-none blur-3xl animate-[pulseAmbient_6s_infinite_ease-in-out]"
                  style={{
                    background: `radial-gradient(300px circle at 50% 20%, ${p.color}06, transparent 50%)`,
                    animationDelay: `${index * 0.8}s`
                  }}
                />

                <div className="space-y-4 relative z-10">
                  {/* Eyebrow */}
                  <div className="text-xs font-bold uppercase tracking-widest" style={{ color: p.color }}>
                    {p.eyebrow}
                  </div>
                  
                  {/* Conținut */}
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-white tracking-tight">
                      {p.title}
                    </h3>
                    <p className="text-sm text-[#A1A1AA] font-normal leading-relaxed">
                      {p.desc}
                    </p>
                  </div>
                </div>

                {/* Buton Link cu micro-mișcare fluidă în loop */}
                <div className="pt-6 mt-8 relative z-10">
                  <span className="inline-flex items-center text-xs font-bold uppercase tracking-wide text-white/90">
                    {p.cta}
                    <svg 
                      className="w-3.5 h-3.5 ml-1.5 transform transition-transform duration-300 ease-out group-hover:translate-x-1" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor" 
                      strokeWidth="3"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </span>
                </div>
              </Link>
            ))}
          </div>

          {/* STYLE BLOCK NECESAR PENTRU TAILWIND (Adaugă-l în fișierul tău global CSS sau lasă-l aici) */}
          <style jsx global>{`
            @keyframes shimmerLine {
              0% { transform: translateX(-150%); }
              50%, 100% { transform: translateX(250%); }
            }
            @keyframes pulseAmbient {
              0%, 100% { opacity: 0.2; transform: scale(0.95); }
              50% { opacity: 0.6; transform: scale(1.05); }
            }
          `}</style>
        </div>



        {/* ================= SECTION: COMMERCE NODES ================= */}
        <div className="pt-20 border-t border-white/10 text-left max-w-7xl mx-auto px-4 sm:px-6">
          
          {/* Header complet curat, fără descrieri inutile */}
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white mb-12">
            Expand Your iMIDI Setup
          </h2>

          {/* Grilă curată, 100% transparentă, fără fundaluri gri care să se bată cu restul paginii */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">

            {/* CARD 1: TS4X LICENSE */}
            <div className="bg-transparent border-t border-white/20 pt-6 flex flex-col justify-between h-full transition-all duration-200 hover:border-white/40">
              <div className="space-y-4">
                <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-[#FF5CA1]">
                  <span>Core Engine</span>
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-white tracking-tight">
                    TS4X Synth Pro License
                  </h3>
                  <p className="text-sm text-[#A1A1AA] font-normal leading-relaxed">
                    Full access to the hardware-accelerated DSP core. Delivers multi-channel execution, sub-1.8ms latency, and priority firmware updates.
                  </p>
                </div>
              </div>

              <div className="space-y-4 pt-6 mt-8">
                <div className="text-2xl font-bold text-white tracking-tight">
                  $199.9<span className="text-xs text-[#71717A] font-normal ml-1">/ year</span>
                </div>
                <Link
                  href="/ts4x"
                  className="w-full h-11 bg-white text-black text-xs font-bold uppercase rounded-lg hover:bg-[#E4E4E7] transition-colors duration-200 active:scale-[0.99] flex items-center justify-center tracking-wide"
                >
                  Purchase License
                </Link>
              </div>
            </div>

            {/* CARD 2: E-MARKET */}
            <div className="bg-transparent border-t border-white/20 pt-6 flex flex-col justify-between h-full transition-all duration-200 hover:border-white/40">
              <div className="space-y-4">
                <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-[#FF8A3D]">
                  <span>Creator Hub</span>
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-white tracking-tight">
                    Sell on E-Market
                  </h3>
                  <p className="text-sm text-[#A1A1AA] font-normal leading-relaxed">
                    Distribute custom sound banks, MIDI maps, scripts, or physical units. Keep 100% of your earnings during your initial trial period.
                  </p>
                </div>
              </div>

              <div className="space-y-4 pt-6 mt-8">
                <div className="text-2xl font-bold text-white tracking-tight">
                  Free<span className="text-xs text-[#71717A] font-normal ml-1.5">for 14 days</span>
                </div>
                <Link
                  href="/e-market"
                  className="w-full h-11 bg-transparent text-white border border-white/20 text-xs font-bold uppercase rounded-lg hover:bg-white/5 hover:border-white/40 transition-all duration-200 active:scale-[0.99] flex items-center justify-center tracking-wide"
                >
                  Start Selling
                </Link>
              </div>
            </div>

            {/* CARD 3: CLOUD STORAGE */}
            <div className="bg-transparent border-t border-white/20 pt-6 flex flex-col justify-between h-full transition-all duration-200 hover:border-white/40">
              <div className="space-y-4">
                <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-[#B47CFF]">
                  <span>Cloud Sync</span>
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-white tracking-tight">
                    MyCloud Storage
                  </h3>
                  <p className="text-sm text-[#A1A1AA] font-normal leading-relaxed">
                    Secure 30 GB container optimized for active audio profiles. Backup performance maps, synth patches, and system states directly from the stage.
                  </p>
                </div>
              </div>

              <div className="space-y-4 pt-6 mt-8">
                <div className="text-2xl font-bold text-white tracking-tight">
                  $49.9<span className="text-xs text-[#71717A] font-normal ml-1">/ year</span>
                </div>
                <Link
                  href="/mycloud"
                  className="w-full h-11 bg-transparent text-white border border-white/20 text-xs font-bold uppercase rounded-lg hover:bg-white/5 hover:border-white/40 transition-all duration-200 active:scale-[0.99] flex items-center justify-center tracking-wide"
                >
                  Upgrade Storage
                </Link>
              </div>
            </div>

          </div>
        </div>


        {/* CORE ENGINE DETAILS — TS4X + i-volution sunt paralele, nu secventiale, deci fara numerotare [01]/[02] */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 sm:gap-12 pt-12 border-t border-white/[0.06] text-left">
          <div className="space-y-3">
            <span className="aw-mono text-xs text-[#FF5CA1] tracking-wider uppercase">Software</span>
            <h3 className="aw-display text-xl font-medium text-[#F2F2F4]">TS4X Synth Engine</h3>
            <p className="text-sm text-[#9A9AA3] font-light leading-relaxed">
              Ultra-low 1.8ms latency audio engine built for mobile and desktop systems. Features lossless cloud synchronization, integrated loopers, and step-based samplers.
            </p>
          </div>

          <div className="space-y-3">
            <span className="aw-mono text-xs text-[#FF8A3D] tracking-wider uppercase">Hardware</span>
            <h3 className="aw-display text-xl font-medium text-[#F2F2F4]">i-volution MIDI System</h3>
            <p className="text-sm text-[#9A9AA3] font-light leading-relaxed">
              Universal hardware controller designed specifically for accordions. Complete velocity-sensitive integration for both SOLO and BASS sections across all MIDI channels.
            </p>
          </div>
        </div>

        {/* CONCEPTUAL FLOW (MIDI 3.0 Ecosystem) — ordinea aici chiar conteaza (semnal audio), ramane cu sageti */}
        <div className="space-y-8 pt-12 border-t border-white/[0.06] text-left">
          <div className="space-y-2">
            <span className="aw-mono text-xs text-[#7C7C86] tracking-wider uppercase">Architecture // Flow</span>
            <h2 className="aw-display text-2xl sm:text-3xl font-semibold tracking-tight text-[#F2F2F4]">The MIDI 3.0 Interconnection Concept</h2>
          </div>
          <p className="text-sm text-[#9A9AA3] font-light leading-relaxed max-w-2xl">
            A unified system redefining interaction. The architecture bridges physical controller articulation with next-gen local DSP processing, extending into cloud sharing channels.
          </p>

          <div className="bg-[#18181C] border border-white/[0.06] p-6 rounded-2xl aw-mono text-xs text-[#9A9AA3] space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 sm:gap-4 text-center items-center">
              <div className="p-3 border border-white/[0.06] bg-white/[0.02] rounded-xl text-[#D4D4D9]">[MIDI Controller]</div>
              <div className="text-[#4A4A52] hidden md:block">→</div>
              <div className="p-3 border border-[#FF5CA1]/30 bg-gradient-to-br from-[#FF5CA1]/10 to-[#FF8A3D]/10 rounded-xl bg-clip-text text-transparent bg-gradient-to-r from-[#FF5CA1] to-[#FF8A3D] font-semibold">
                [TS4X Core DSP]
              </div>
              <div className="text-[#4A4A52] hidden md:block">→</div>
              <div className="p-3 border border-white/[0.06] bg-white/[0.02] rounded-xl text-[#D4D4D9]">[Cloud Platform]</div>
            </div>
            <p className="text-[11px] text-[#6A6A73] text-center pt-2 italic">
              *Concept developed by iMIDI.co.uk to fulfill modern architectural and performance ecosystem needs.
            </p>
          </div>
        </div>

        {/* ================= SECTION: ENGINEERED SPECS (Dashboard Approach) ================= */}
        <div className="pt-24 border-t border-white/10 text-left max-w-7xl mx-auto px-4 sm:px-6">
          
          {/* Header complet curat și clasic */}
          <div className="mb-14">
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white">
              Engineered Specs
            </h2>
            <p className="mt-3 text-sm text-[#A1A1AA] max-w-xl leading-relaxed">
              Recommended hardware architecture optimized for real-time TS4X signal processing.
            </p>
          </div>

          {/* Abordare Dashboard / Listă industrială — Fără cutii gri sau gradiente AI */}
          <div className="space-y-0 animate-[fadeIn_0.6s_ease-out_both]">
            
            {/* Rândul 1: PROCESSORS */}
            <div className="border-t border-white/10 py-6 grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-8 items-start relative group">
              {/* Mic punct tehnic care pulsează autonom în stânga */}
              <div className="absolute left-0 top-7 w-1 h-1 rounded-full bg-[#FF5CA1] opacity-60 animate-ping" />
              
              <div className="md:col-span-1 pl-4">
                <span className="aw-mono text-xs font-bold tracking-widest text-[#FF5CA1]/90 uppercase">
                  Processors
                </span>
              </div>
              <div className="md:col-span-3">
                <p className="text-base text-[#E4E4E7] font-medium leading-relaxed tracking-tight">
                  Apple Silicon (M1/M2/M3), Intel x86_64 up to 4.0 GHz, or ARM Cortex-A72 (3nm architectural process).
                </p>
              </div>
            </div>

            {/* Rândul 2: MEMORY & STORAGE */}
            <div className="border-t border-white/10 py-6 grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-8 items-start relative group">
              <div className="absolute left-0 top-7 w-1 h-1 rounded-full bg-[#FF8A3D] opacity-60 animate-ping [animation-delay:0.4s]" />
              
              <div className="md:col-span-1 pl-4">
                <span className="aw-mono text-xs font-bold tracking-widest text-[#FF8A3D]/90 uppercase">
                  Memory & Storage
                </span>
              </div>
              <div className="md:col-span-3">
                <p className="text-base text-[#E4E4E7] font-medium leading-relaxed tracking-tight">
                  8GB LPDDR4/5 RAM minimum for stable core execution. 512GB NVMe SSD optimization tailored for high-speed patch loading.
                </p>
              </div>
            </div>

            {/* Rândul 3: AUDIO OUT */}
            <div className="border-t border-b border-white/10 py-6 grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-8 items-start relative group">
              <div className="absolute left-0 top-7 w-1 h-1 rounded-full bg-[#B47CFF] opacity-60 animate-ping [animation-delay:0.8s]" />
              
              <div className="md:col-span-1 pl-4">
                <span className="aw-mono text-xs font-bold tracking-widest text-[#B47CFF]/90 uppercase">
                  Audio Output
                </span>
              </div>
              <div className="md:col-span-3">
                <p className="text-base text-[#E4E4E7] font-medium leading-relaxed tracking-tight">
                  24-bit / 192kHz stereo DACs, native multi-channel USB audio interface compatibility, and ultra-low latency Bluetooth 5.0 IO.
                </p>
              </div>
            </div>

          </div>
        </div>


        {/* ================= SECTION: FAQ ================= */}
        <div className="space-y-8 pt-12 border-t border-white/[0.06] text-left">
          <div className="space-y-2">
            <span className="aw-mono text-xs text-[#7C7C86] tracking-wider uppercase">Support // Answers</span>
            <h2 className="aw-display text-2xl sm:text-3xl font-semibold tracking-tight text-[#F2F2F4]">Frequently Asked Questions</h2>
          </div>

          <div className="flex flex-col gap-3">
            {FAQS.map((item, i) => {
              const isOpen = openFaq === i;
              return (
                <div
                  key={item.q}
                  className={`rounded-2xl border transition-colors duration-300 overflow-hidden ${
                    isOpen ? "border-[#FF5CA1]/30 bg-[#1A1A1F]" : "border-white/[0.06] bg-[#18181C]"
                  }`}
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                    className="w-full flex items-center justify-between gap-4 text-left px-5 py-4"
                  >
                    <span className={`text-sm sm:text-base font-normal transition-colors ${isOpen ? "text-[#F2F2F4]" : "text-[#B4B4BC]"}`}>
                      {item.q}
                    </span>
                    <span
                      className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full border border-white/[0.1] text-[#7C7C86] transition-transform duration-300"
                      style={{ transform: isOpen ? "rotate(135deg)" : "rotate(0deg)" }}
                    >
                      +
                    </span>
                  </button>
                  <div className={`aw-faq-wrap ${isOpen ? "open" : ""}`}>
                    <div className="aw-faq-inner">
                      <p className="px-5 pb-4 text-xs sm:text-sm text-[#9A9AA3] font-light leading-relaxed">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 pt-12 border-t border-white/[0.06] text-left">
          {[
            { t: "Innovative", d: "High-performance MIDI interfaces tailored for stage and studio setups.", c: "from-[#FF5CA1] to-[#FF8A3D]" },
            { t: "Ultra Fast", d: "Guaranteed real-time response parameters avoiding deployment friction.", c: "from-[#FF8A3D] to-[#FFC24D]" },
            { t: "Connected", d: "Cloud-synced global access nodes for files, presets, and device templates.", c: "from-[#B47CFF] to-[#FF5CA1]" },
            { t: "AI Intel", d: "Smart structural data handling to scale workflow automation boundaries.", c: "from-[#FF5CA1] to-[#B47CFF]" },
          ].map((item) => (
            <div key={item.t} className="space-y-1.5">
              <div className={`h-[2px] w-6 rounded-full bg-gradient-to-r ${item.c} mb-2`} />
              <div className="aw-display text-base text-[#F2F2F4]">{item.t}</div>
              <p className="text-xs text-[#8A8A93] font-light">{item.d}</p>
            </div>
          ))}
        </div>

        <Footer />
      </div>
    </div>
  );
}