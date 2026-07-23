'use client';

// app/products/i-volution/page.tsx

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppWidget from "@/components/WhatsAppWidget";

// Contact real pentru comenzi — schimbă aici dacă vrei alt email/număr
const ORDER_EMAIL = "contact@imidi.ro";
const ORDER_WHATSAPP_NUMBER = "40765354998"; // același număr ca în WhatsAppWidget

// ============================================================================
// Poza reală a acordeonului (pune fișierul în /public/accordion.webp).
// Glow-ul din spate + badge-urile SOLO/BASS se animă în funcție de variantă,
// suprapuse peste poză — nu mai desenăm acordeonul, folosim imaginea reală.
// ============================================================================
function AccordionPhoto({ className = "", bassIncluded = true }: { className?: string; bassIncluded?: boolean }) {
  const soloColor = "#E2861A";
  const bassColor = bassIncluded ? "#0B7285" : "#D8D5C9";

  return (
    <div className={`relative ${className}`}>
      {/* glow ambiental, animat */}
      <div
        className="absolute inset-0 -z-10 rounded-[40%] blur-[60px] transition-opacity duration-500"
        style={{
          background: `radial-gradient(circle at 30% 50%, ${bassColor}55, transparent 60%), radial-gradient(circle at 75% 50%, ${soloColor}55, transparent 60%)`,
        }}
      />

      <div className="relative rounded-2xl overflow-hidden bg-white border border-[#E7E5DB] aspect-[4/3]">
        <Image
          src="/bass.jpg"
          alt="i-VOLUTION accordion"
          fill
          sizes="(max-width: 640px) 100vw, 440px"
          className="object-contain p-4"
          priority
        />
      </div>

      {/* badge-uri SOLO / BASS, suprapuse peste poză */}
      <span
        className="absolute bottom-3 right-3 aw-mono text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full text-white shadow-md transition-colors duration-500"
        style={{ backgroundColor: soloColor }}
      >
        SOLO
      </span>
      <span
        className="absolute bottom-3 left-3 aw-mono text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full text-white shadow-md transition-all duration-500"
        style={{ backgroundColor: bassColor, opacity: bassIncluded ? 1 : 0.5 }}
      >
        BASS {!bassIncluded && "(not included)"}
      </span>
    </div>
  );
}

// Mic wrapper care re-declanșează animația de "pop" de fiecare dată când
// se schimbă varianta selectată (remount pe schimbarea key-ului).
function AnimatedAccordion({ variantId, bassIncluded, className = "" }: { variantId: string; bassIncluded: boolean; className?: string }) {
  return (
    <div key={variantId} className={`variant-switch-pop ${className}`}>
      <AccordionPhoto className="w-full" bassIncluded={bassIncluded} />
    </div>
  );
}

// Mic mock de ecran OLED — pentru cardul de feature dedicat, cu "meniu" care se schimbă
function OledPreview() {
  const [line, setLine] = useState(0);
  const rows = [
    ["BANK", "A · 03"],
    ["BELLOWS", "CC11  92%"],
    ["VOLUME", "CC07  118"],
    ["TRANSPOSE", "+0"],
  ];
  return (
    // bezel — carcasă gri-închis în jurul ecranului, ca la un dispozitiv real
    <div className="w-full aspect-[3/2] rounded-2xl bg-[#1C1C1F] p-2.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]">
      <div
        className="relative w-full h-full rounded-lg bg-[#04070A] overflow-hidden cursor-pointer select-none"
        onClick={() => setLine((l) => (l + 1) % rows.length)}
        style={{ boxShadow: "inset 0 0 24px rgba(0,0,0,0.9), inset 0 0 2px rgba(57,255,176,0.4)" }}
      >
        {/* glow difuz de fosfor OLED, în spatele textului */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(57,255,176,0.10),_transparent_70%)]" />

        {/* scanlines subtile */}
        <div
          className="absolute inset-0 opacity-[0.15] pointer-events-none"
          style={{ backgroundImage: "repeating-linear-gradient(to bottom, rgba(0,0,0,0.5) 0px, rgba(0,0,0,0.5) 1px, transparent 1px, transparent 3px)" }}
        />

        {/* conținut ecran */}
        <div className="relative w-full h-full p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between aw-mono text-[9px]" style={{ color: "#39FFB0", textShadow: "0 0 6px rgba(57,255,176,0.7)" }}>
            <span className="opacity-70">i-VOLUTION</span>
            <span className="flex items-center gap-1 opacity-70">
              <span className="w-1.5 h-1.5 rounded-full bg-[#39FFB0] animate-pulse" style={{ boxShadow: "0 0 6px #39FFB0" }} />
              OLED 1.8&quot;
            </span>
          </div>
          <div className="text-center">
            <div className="aw-mono text-[10px] tracking-widest opacity-70" style={{ color: "#39FFB0", textShadow: "0 0 6px rgba(57,255,176,0.6)" }}>
              {rows[line][0]}
            </div>
            <div
              className="aw-mono text-2xl font-bold tracking-tight mt-1"
              style={{ color: "#6BFFCB", textShadow: "0 0 10px rgba(57,255,176,0.85), 0 0 22px rgba(57,255,176,0.4)" }}
            >
              {rows[line][1]}
              <span className="inline-block w-[2px] h-[1em] bg-[#6BFFCB] ml-1 align-middle animate-pulse" />
            </div>
          </div>
          <div className="aw-mono text-[8px] text-center opacity-40" style={{ color: "#39FFB0" }}>
            tap to preview menu →
          </div>
        </div>

        {/* reflexie de sticlă peste ecran */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-white/[0.06] via-transparent to-transparent" />
      </div>
    </div>
  );
}

const FEATURES = [
  {
    title: "Bellow Real Emulation",
    desc: "EMA (Exponential Moving Average) filtering delivers smooth, realistic pressure response — minimizing sensor noise for a natural bellows feel, close to Advanced Physical Behavior Modeling (APBM).",
    accent: "#E2861A",
  },
  {
    title: "Ultra-Low Latency MIDI",
    desc: "Ultra-low latency MIDI communication, tuned for live performance — no lag between bellows and sound.",
    accent: "#0B7285",
  },
  {
    title: "Broad Synth Compatibility",
    desc: "Compatible with major digital synths, including the KORG PA series and TS4X.",
    accent: "#C77313",
  },
  {
    title: "Efficient Power Design",
    desc: "Ultra-low power consumption via TPS63061 PM for long battery life — no need for firmware updates.",
    accent: "#0B7285",
  },
];

const MIDI_MAPPING = [
  { label: "Transpose", value: "General MIDI via SysEx" },
  { label: "Compatible with", value: "KORG PA series, TS4X" },
  { label: "Performance Change", value: "Up to 11, via registers" },
  { label: "Bank Select", value: "A, B, C, D (default) + L (BASS), up to 127 — saves 11×127" },
  { label: "Volume Control", value: "CC07" },
  { label: "Expression Bellows", value: "CC11" },
];

const SPECS = [
  { label: "Display", value: "1.8\" OLED, digital multi-function encoder, intuitive menu" },
  { label: "Power", value: "TPS63061 PM — ultra-low consumption, long battery life" },
  { label: "Firmware", value: "No update required" },
  { label: "Latency", value: "Ultra-low, tuned for live use" },
  { label: "Compatibility", value: "KORG PA series, TS4X, major digital synths" },
];

const GALLERY_SLOTS = [
  { label: "PCB i-volution mount", src: "/PCB.jpg" },
  { label: "OLED display close-up", src: "/oled.jpg" },
  { label: "Mounted on accordion", src: "/ds1.jpg" },
  { label: "Full bass", src: "/bass.jpg" },
  { label: "Accordion ", src: "/111.jpg" },
  { label: "P Stanga accordion", src: "/paul-stanga.jpg" },
];

const VARIANTS = [
  {
    id: "solo",
    name: "SOLO",
    tag: "Right hand",
    price: "949.9",
    color: "#E2861A",
    bassIncluded: false,
    features: ["Right-hand (SOLO) MIDI section", "1.8\" OLED display", "Bellow Real Emulation (EMA)", "2-year warranty"],
  },
  {
    id: "solo-bass",
    name: "R + L",
    tag: "Full BASS included",
    price: "1299.9",
    color: "#0B7285",
    bassIncluded: true,
    features: ["Right + Left hand (SOLO + BASS)", "1.8\" OLED display", "Bellow Real Emulation (EMA)", "2-year warranty"],
  },
];

const FAQS = [
  {
    q: "What's the difference between SOLO and R+L?",
    a: "SOLO covers the right-hand (treble/melody) manual only. R+L adds the full left-hand BASS section, with independent bank select (+L up to 127, saves 11×127) — the complete two-hand setup.",
  },
  {
    q: "Which synths is it compatible with?",
    a: "i-VOLUTION is compatible with major digital synths, explicitly including the KORG PA series and TS4X, using General MIDI over SysEx for transpose and standard CC07/CC11 for volume and bellows expression.",
  },
  {
    q: "Do I need to update the firmware?",
    a: "No — i-VOLUTION is designed to work out of the box with no firmware update required.",
  },
  {
    q: "How do I order?",
    a: "Send us an email or message us on WhatsApp with the variant you want (SOLO or R+L) — we'll confirm availability, shipping and payment details directly.",
  },
];

export default function IVolutionProductPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [selectedVariant, setSelectedVariant] = useState("solo-bass");
  const variant = VARIANTS.find((v) => v.id === selectedVariant) ?? VARIANTS[1];

  const mailtoHref = `mailto:${ORDER_EMAIL}?subject=${encodeURIComponent(
    `i-VOLUTION order — ${variant.name}`
  )}&body=${encodeURIComponent(
    `Hi,\n\nI'd like to order the i-VOLUTION MIDI System — ${variant.name} ($${variant.price}).\n\nName:\nShipping address:\nPhone:\n\nThanks!`
  )}`;

  const waHref = `https://wa.me/${ORDER_WHATSAPP_NUMBER}?text=${encodeURIComponent(
    `Hi! I'd like to order the i-VOLUTION MIDI System — ${variant.name} ($${variant.price}).`
  )}`;

  return (
    <div className="aw-root bg-[#F1F1EC] text-[#14181D] min-h-screen flex flex-col items-center px-5 sm:px-6 pt-28 pb-20 selection:bg-amber-200 overflow-x-hidden relative">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        .aw-root { font-family: 'Inter', ui-sans-serif, system-ui, sans-serif; }
        .aw-display { font-family: 'Space Grotesk', ui-sans-serif, system-ui, sans-serif; }
        .aw-mono { font-family: 'IBM Plex Mono', ui-monospace, monospace; }

        @keyframes aw-fade-up { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        .aw-hero-item { opacity: 0; animation: aw-fade-up 0.7s ease-out forwards; }

        @keyframes iv-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        .iv-float { animation: iv-float 5s ease-in-out infinite; }

        @keyframes variant-switch-pop {
          0% { opacity: 0; transform: scale(0.96) translateY(6px); }
          60% { opacity: 1; transform: scale(1.015) translateY(0); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .variant-switch-pop { animation: variant-switch-pop 0.5s cubic-bezier(0.16,1,0.3,1) forwards; }

        .aw-faq-wrap { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 0.35s ease; }
        .aw-faq-wrap.open { grid-template-rows: 1fr; }
        .aw-faq-inner { overflow: hidden; }
      `}</style>

      <Navbar />

      <div className="relative max-w-5xl w-full z-10 space-y-20 sm:space-y-24">

        {/* ================= HERO ================= */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center pt-4">
          <div className="space-y-6 text-center lg:text-left aw-hero-item" style={{ animationDelay: "0.05s" }}>
   
            <h1 className="aw-display text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-[#14181D] leading-tight">
              i-VOLUTION MIDI System for Accordion
            </h1>
            <p className="text-base text-[#5B5F66] font-light leading-relaxed max-w-lg mx-auto lg:mx-0">
              A professional-grade MIDI integration built specifically for accordionists who need precision and reliability on stage and in the studio.
            </p>
            <p className="text-sm text-[#7A7F87] font-light leading-relaxed max-w-lg mx-auto lg:mx-0">
              Cutting-edge tech ensures low latency, seamless compatibility, and durability — so you can focus on your artistry, not the technical distractions.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-4 pt-2 justify-center lg:justify-start">
              <Link
                href="#pricing"
                className="w-full sm:w-auto h-12 inline-flex items-center justify-center bg-[#E2861A] text-white font-medium text-sm px-8 rounded-full transition-all duration-300 hover:bg-[#C77313] hover:scale-[1.02] active:scale-[0.99]"
              >
                Choose Your Version
              </Link>
              <Link
                href="#specs"
                className="w-full sm:w-auto h-12 inline-flex items-center justify-center border border-[#D8D5C9] bg-white text-[#3A3F47] font-medium text-sm px-8 rounded-full transition-all duration-300 hover:bg-[#F7F6F1]"
              >
                View Specs
              </Link>
            </div>
          </div>

          <div className="aw-hero-item flex justify-center" style={{ animationDelay: "0.2s" }}>
            <AccordionPhoto className="iv-float w-full max-w-[440px]" bassIncluded />
          </div>
        </div>

        {/* ================= FEATURES + OLED ================= */}
        <div className="space-y-8 pt-4 border-t border-[#DEDCD3]">
          <h2 className="aw-display text-2xl sm:text-3xl font-semibold tracking-tight">Precision engineering, built to disappear</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-white border border-[#E7E5DB] rounded-2xl p-6 space-y-3 hover:-translate-y-1 transition-transform duration-300">
                <div className="h-[3px] w-8 rounded-full" style={{ backgroundColor: f.accent }} />
                <h3 className="aw-display text-base font-medium text-[#14181D]">{f.title}</h3>
                <p className="text-sm text-[#5B5F66] font-light leading-relaxed">{f.desc}</p>
              </div>
            ))}

            {/* Card special — mini OLED interactiv, "wow" tactil */}
            <div className="bg-white border border-[#E7E5DB] rounded-2xl p-6 space-y-3 sm:col-span-2">
              <div className="flex items-center justify-between">
                <h3 className="aw-display text-base font-medium text-[#14181D]">1.8&quot; OLED Display</h3>
                <span className="aw-mono text-[10px] text-[#9A9EA4] uppercase tracking-wide">Digital encoder · intuitive menu</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[240px_1fr] gap-5 items-center">
                <OledPreview />
                <p className="text-sm text-[#5B5F66] font-light leading-relaxed">
                  Real-time readout of bank, bellows expression, volume and transpose — controlled through a single multifunction digital encoder. No hidden menus, no manual required.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ================= MIDI MAPPING ================= */}
        <div className="space-y-8 pt-4 border-t border-[#DEDCD3]">
          <div className="space-y-2">
            <span className="aw-mono text-xs text-[#9A9EA4] tracking-wider uppercase">MIDI Mapping</span>
            <h2 className="aw-display text-2xl sm:text-3xl font-semibold tracking-tight">Every parameter, mapped</h2>
          </div>
          <div className="rounded-2xl border border-[#E7E5DB] bg-white overflow-hidden">
            {MIDI_MAPPING.map((s, i) => (
              <div
                key={s.label}
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-1 px-5 py-3.5 text-sm ${i !== MIDI_MAPPING.length - 1 ? "border-b border-[#EFEDE4]" : ""}`}
              >
                <span className="aw-mono text-[#9A9EA4] text-xs uppercase tracking-wide">{s.label}</span>
                <span className="text-[#3A3F47] text-right sm:text-left">{s.value}</span>
              </div>
            ))}
          </div>
        </div>

 {/* ================= PHOTO GALLERY ================= */}
        <div className="space-y-8 pt-4 border-t border-[#DEDCD3]">
          <div className="space-y-2">
            <span className="aw-mono text-xs text-[#9A9EA4] tracking-wider uppercase">Gallery</span>
            <h2 className="aw-display text-2xl sm:text-3xl font-semibold tracking-tight">See it up close</h2>
            <p className="text-sm text-[#5B5F66] font-light">Hardware overview from our production facility.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {/* Schimbat (label) în ({ label, src }) ca să citească textul și ruta corect */}
            {GALLERY_SLOTS.map(({ label, src }) => (
              <div
                key={label}
                className="group relative aspect-square rounded-2xl border border-[#D8D5C9] bg-white overflow-hidden shadow-sm hover:border-amber-400/60 transition-colors"
              >
                {/* Înlocuit SVG-ul cu imaginea reală din folderul tău public */}
                <Image
                  src={src}
                  alt={label}
                  fill
                  unoptimized
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                
                {/* Overlay text care apare doar la hover */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3 pointer-events-none">
                  <span className="aw-mono text-[9px] text-white uppercase tracking-wider">{label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ================= SPECS ================= */}
        <div id="specs" className="space-y-8 pt-4 border-t border-[#DEDCD3] scroll-mt-24">
          <div className="space-y-2">
            <span className="aw-mono text-xs text-[#9A9EA4] tracking-wider uppercase">Technical</span>
            <h2 className="aw-display text-2xl sm:text-3xl font-semibold tracking-tight">Specifications</h2>
          </div>
          <div className="rounded-2xl border border-[#E7E5DB] bg-white overflow-hidden">
            {SPECS.map((s, i) => (
              <div
                key={s.label}
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-1 px-5 py-3.5 text-sm ${i !== SPECS.length - 1 ? "border-b border-[#EFEDE4]" : ""}`}
              >
                <span className="aw-mono text-[#9A9EA4] text-xs uppercase tracking-wide">{s.label}</span>
                <span className="text-[#3A3F47] text-right sm:text-left">{s.value}</span>
              </div>
            ))}
          </div>
        </div>

  {/* ================= PRICING — ULTRA RESPONSIVE MOBILE ================= */}
        <div id="pricing" className="space-y-6 pt-6 border-t border-[#DEDCD3] scroll-mt-20 w-full">
          <div className="space-y-1">
            <span className="aw-mono text-[10px] text-[#9A9EA4] tracking-wider uppercase">[ Choose your build ]</span>
            <h2 className="aw-display text-2xl sm:text-3xl font-semibold tracking-tight">SOLO or R + L</h2>
          </div>

          {/* Preview live — Responsive hardware wrap */}
          <div className="bg-white border border-[#E7E5DB] rounded-2xl p-4 sm:p-8 flex flex-col items-center justify-center">
            <div className="w-full max-w-[420px] mx-auto">
              <AnimatedAccordion
                variantId={variant.id}
                bassIncluded={variant.bassIncluded}
                className="w-full h-auto"
              />
            </div>
            <p className="aw-mono text-center text-[9px] text-[#9A9EA4] uppercase tracking-wider mt-3">
              {variant.bassIncluded ? "SOLO + BASS active" : "SOLO only"}
            </p>
          </div>

          {/* Grid de variante - se transformă automat din 1 coloană pe mobil în 2 pe ecrane sm */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {VARIANTS.map((v) => {
              const isSelected = v.id === selectedVariant;
              return (
                <button
                  key={v.id}
                  onClick={() => setSelectedVariant(v.id)}
                  className={`relative text-left rounded-2xl p-5 sm:p-6 space-y-4 border-2 transition-all duration-300 bg-white active:scale-[0.99] ${
                    isSelected ? "shadow-md -translate-y-0.5" : "hover:-translate-y-0.5"
                  }`}
                  style={{ borderColor: isSelected ? v.color : "#E7E5DB" }}
                >
                  {v.id === "solo-bass" && (
                    <span className="absolute -top-2.5 left-4 sm:left-6 aw-mono text-[8px] sm:text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: v.color }}>
                      Full BASS included
                    </span>
                  )}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="aw-mono text-[9px] uppercase tracking-wider" style={{ color: v.color }}>{v.tag}</div>
                      <h3 className="aw-display text-lg sm:text-xl font-semibold text-[#14181D] leading-tight">{v.name}</h3>
                    </div>
                    <span
                      className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5"
                      style={{ borderColor: isSelected ? v.color : "#D8D5C9" }}
                    >
                      {isSelected && <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: v.color }} />}
                    </span>
                  </div>

                  <div className="aw-display text-2xl sm:text-3xl font-bold text-[#14181D]">
                    ${v.price}
                  </div>
                  <ul className="space-y-2 border-t border-zinc-50 pt-3">
                    {v.features.map((f) => (
                      <li key={f} className="text-xs sm:text-sm text-[#5B5F66] flex items-start gap-2 leading-tight">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5" style={{ backgroundColor: v.color }} />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </button>
              );
            })}
          </div>

          {/* Zona de butoane - flex-col pe mobil ca să nu iasă textul în afară, sm:flex-row pe desktop */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2 w-full">
            <a
              href={mailtoHref}
              className="w-full sm:flex-1 h-12 inline-flex items-center justify-center gap-2 text-white font-semibold text-xs sm:text-sm rounded-full transition-transform active:scale-[0.98] px-4 text-center"
              style={{ backgroundColor: variant.color }}
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current shrink-0"><path d="M2 5.5A2.5 2.5 0 0 1 4.5 3h15A2.5 2.5 0 0 1 22 5.5v13a2.5 2.5 0 0 1-2.5 2.5h-15A2.5 2.5 0 0 1 2 18.5v-13Zm2.2.3 7.8 6.1 7.8-6.1H4.2ZM20 7.9l-7.4 5.8a1 1 0 0 1-1.2 0L4 7.9v10.6c0 .3.2.5.5.5h15c.3 0 .5-.2.5-.5V7.9Z"/></svg>
              <span className="truncate">Order {variant.name} — ${variant.price}</span>
            </a>

          </div>
        </div>

        {/* ================= FAQ ================= */}
        <div className="space-y-8 pt-4 border-t border-[#DEDCD3]">
          <div className="space-y-2">
            <span className="aw-mono text-xs text-[#9A9EA4] tracking-wider uppercase">Support</span>
            <h2 className="aw-display text-2xl sm:text-3xl font-semibold tracking-tight">Frequently Asked Questions</h2>
          </div>

          <div className="flex flex-col gap-3">
            {FAQS.map((item, i) => {
              const isOpen = openFaq === i;
              return (
                <div
                  key={item.q}
                  className={`rounded-2xl border transition-colors duration-300 overflow-hidden ${
                    isOpen ? "border-amber-400/50 bg-white" : "border-[#E7E5DB] bg-[#F7F6F1]"
                  }`}
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                    className="w-full flex items-center justify-between gap-4 text-left px-5 py-4"
                  >
                    <span className={`text-sm sm:text-base font-normal transition-colors ${isOpen ? "text-[#14181D]" : "text-[#3A3F47]"}`}>
                      {item.q}
                    </span>
                    <span
                      className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full border border-[#D8D5C9] text-[#7A7F87] transition-transform duration-300"
                      style={{ transform: isOpen ? "rotate(135deg)" : "rotate(0deg)" }}
                    >
                      +
                    </span>
                  </button>
                  <div className={`aw-faq-wrap ${isOpen ? "open" : ""}`}>
                    <div className="aw-faq-inner">
                      <p className="px-5 pb-4 text-xs sm:text-sm text-[#5B5F66] font-light leading-relaxed">
                        {item.a}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <Footer />
      </div>

      <WhatsAppWidget />
    </div>
  );
}