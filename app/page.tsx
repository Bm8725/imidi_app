// app/page.tsx
'use client';

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import MediaHero from "@/components/MediaHero";
import Footer from "@/components/Footer";

/* ------------------------------------------------------------------ */
/*  Content                                                           */
/* ------------------------------------------------------------------ */

const PINK = "#FF5CA1";
const ORANGE = "#FF8A3D";
const PURPLE = "#B47CFF";

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

const FAQ_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

const HERO_TAGS = ["Transfer fast", "Secure", "Cloud", "AI", "E-Market"];

const VALUES = [
  { t: "Innovative", d: "High-performance MIDI interfaces tailored for stage and studio setups.", c: "from-[#FF5CA1] to-[#FF8A3D]" },
  { t: "Ultra fast", d: "Guaranteed real-time response, with no deployment friction.", c: "from-[#FF8A3D] to-[#FFC24D]" },
  { t: "Connected", d: "Cloud-synced global access for files, presets and device templates.", c: "from-[#B47CFF] to-[#FF5CA1]" },
  { t: "AI intelligence", d: "Smart data handling that scales your workflow automation.", c: "from-[#FF5CA1] to-[#B47CFF]" },
];

const PILLARS = [

  {
    eyebrow: "Connectivity",
    title: "AirMIDI Link",
    desc: "Private video calls and live MIDI sessions in the browser. Play together in real time, anywhere.",
    chips: ["Low-latency MIDI", "Private sessions", "Works in the browser"],
    href: "/airmidi-link",
    cta: "Open AirMIDI Link",
    color: PURPLE, // sau culoarea pe care o folosești pentru AirMIDI
    icon: "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1.5-3-1-1-1.5-1.62-1.5-3a2.5 2.5 0 0 1 5 0c0 1.38-.5 2-1.5 3-1 1-1.5 1.62-1.5 3a2.5 2.5 0 0 0 2.5 2.5M12 20v-2M8 20h8M4.5 9.5c0-2 .8-3.5 2-4.5M19.5 9.5c0-2-.8-3.5-2-4.5",
  },
  {
    eyebrow: "Marketplace",
    title: "E-Market",
    desc: "Buy and sell presets, sound banks, scripts and instruments directly with other artists.",
    chips: ["Free to list for 14 days", "Found via AI Smith", "Direct messages"],
    href: "/e-market",
    cta: "Browse E-Market",
    color: ORANGE,
    icon: "M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007Z",
  },
  {
    eyebrow: "Hardware",
    title: "i-volution Controller",
    desc: "A universal MIDI controller purpose-built for accordion, on any MIDI channel.",
    chips: ["SOLO and BASS mapping", "Velocity-sensitive", "Any MIDI controller works"],
    href: "/products",
    cta: "See i-volution",
    color: PURPLE,
    icon: "M7 5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H7zM3 9h2M3 13h2M19 9h2M19 13h2M9 3v2M13 3v2M9 19v2M13 19v2",
  },
  {
    eyebrow: "Tools",
    title: "SD Writer",
    desc: "Paste a seller link and code, plug in the card, and write the package straight to the SD card with verification.",
    chips: ["One-time links", "Checksum verified", "Chrome & Edge"],
    href: "/sd-write",
    cta: "Open SD Writer",
    color: PINK, // sau ORANGE
    // SD card + download arrow
    icon: "M6 4a2 2 0 0 1 2-2h7l3 3v13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4zm9 0v2h2M12 10v6m0 0-2.5-2.5M12 16l2.5-2.5",
  },
];

const FLOW = [
  { label: "Input", title: "MIDI controller", desc: "i-volution, or any MIDI controller you already play.", hot: false },
  { label: "Processing", title: "TS4X Core DSP", desc: "Sub-1.8ms local processing, built for real-time stage use.", hot: true },
  { label: "Output", title: "Cloud platform", desc: "MyCloud sync and E-Market, available on every device.", hot: false },
];

const SPECS = [
  {
    label: "Processors",
    color: PINK,
    text: "Apple Silicon (M1/M2/M3), Intel x86_64 up to 4.0 GHz, or ARM Cortex-A72 (3nm architectural process).",
  },
  {
    label: "Memory and storage",
    color: ORANGE,
    text: "8GB LPDDR4/5 RAM minimum for stable core execution. 512GB NVMe SSD optimization tailored for high-speed patch loading.",
  },
  {
    label: "Audio output",
    color: PURPLE,
    text: "24-bit / 192kHz stereo DACs, native multi-channel USB audio interface compatibility, and ultra-low latency Bluetooth 5.0 IO.",
  },
];

const PLANS = [
  {
    eyebrow: "Airmidi Link",
    color: PURPLE,
    title: "AirMidi Link License",
    desc: "telemetry-learn application AirMIDI link available. Full responsive over cloud to local. Video+audio stream to see.",
    price: "€19.0",
    unit: "/ 30 h",
    cta: "Purchase license",
    href: "/airmidi-link",
    primary: true,
  },
  {
    eyebrow: "Creator hub",
    color: ORANGE,
    title: "Sell on E-Market",
    desc: "Distribute custom sound banks, MIDI maps, scripts, or physical units. Keep 100% of your earnings during your initial trial period.",
    price: "Free",
    unit: "for 14 days",
    cta: "Start selling",
    href: "/e-market",
    primary: false,
  },
  {
    eyebrow: "Cloud sync",
    color: PURPLE,
    title: "MyCloud Storage",
    desc: "Secure 30 GB container optimized for active audio profiles. Back up performance maps, synth patches, and system states directly from the stage.",
    price: "€49.90",
    unit: "/ year",
    cta: "Upgrade storage",
    href: "/mycloud",
    primary: false,
  },
];

/* ------------------------------------------------------------------ */
/*  Small building blocks                                             */
/* ------------------------------------------------------------------ */

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5CA1] focus-visible:ring-offset-2 focus-visible:ring-offset-[#131316]";

/** Fades content in when it scrolls into view. Content already on screen, or with reduced motion, is never hidden. */
function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return;

    setHidden(true);
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHidden(false);
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-[opacity,transform] duration-700 ease-out ${
        hidden ? "translate-y-5 opacity-0" : "translate-y-0 opacity-100"
      } ${className}`}
      style={{ transitionDelay: hidden ? "0ms" : `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function SectionHead({
  eyebrow,
  title,
  sub,
  color = PINK,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="mb-12 max-w-2xl">
      <p className="aw-mono text-xs uppercase tracking-[0.16em]" style={{ color }}>
        {eyebrow}
      </p>
      <h2 className="aw-display mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{title}</h2>
      {sub && <p className="mt-3 text-[15px] leading-relaxed text-[#9A9AA3]">{sub}</p>}
    </div>
  );
}

function Section({
  id,
  children,
  first = false,
}: {
  id?: string;
  children: React.ReactNode;
  first?: boolean;
}) {
  return (
    <section
      id={id}
      className={`relative scroll-mt-24 px-5 py-20 sm:px-6 sm:py-24 ${first ? "" : "border-t border-white/[0.06]"}`}
    >
      <div className="mx-auto w-full max-w-6xl">{children}</div>
    </section>
  );
}

function Arrow() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6 rotate-90 md:rotate-0"
      aria-hidden
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

export default function HomePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="aw-root flex min-h-screen flex-col bg-[#131316] text-[#F2F2F4] selection:bg-[#FF5CA1]/40 selection:text-white">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700;800&family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

        .aw-root { font-family: 'Inter', ui-sans-serif, system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
        .aw-display { font-family: 'Sora', ui-sans-serif, system-ui, sans-serif; }
        .aw-mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }

        @keyframes aw-fade-up { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes aw-float-a { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(20px, -24px); } }
        @keyframes aw-float-b { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(-24px, 18px); } }
        @keyframes aw-glow-pulse { 0%, 100% { box-shadow: 0 10px 30px -10px rgba(255,92,161,0.45); } 50% { box-shadow: 0 14px 40px -8px rgba(255,138,61,0.5); } }

        .aw-hero-item { opacity: 0; animation: aw-fade-up 0.7s ease-out forwards; }
        .aw-blob-a { animation: aw-float-a 14s ease-in-out infinite; }
        .aw-blob-b { animation: aw-float-b 17s ease-in-out infinite; }
        .aw-cta-glow { animation: aw-glow-pulse 3.5s ease-in-out infinite; }

        .aw-faq-wrap { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 0.35s ease; }
        .aw-faq-wrap.open { grid-template-rows: 1fr; }
        .aw-faq-inner { overflow: hidden; }

        @media (prefers-reduced-motion: reduce) {
          .aw-hero-item { opacity: 1; animation: none; }
          .aw-blob-a, .aw-blob-b, .aw-cta-glow { animation: none; }
          .aw-faq-wrap { transition: none; }
        }
      `}</style>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD).replace(/</g, "\\u003c") }}
      />

      <Navbar />

      <main id="main-content" className="flex-1 overflow-x-clip">
        {/* ================= HERO ================= */}
        <section className="relative isolate flex min-h-[max(600px,86svh)] items-center overflow-hidden pb-24 pt-28">
          <MediaHero />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-48 bg-gradient-to-t from-[#131316] to-transparent"
          />

          <div className="relative z-10 mx-auto w-full max-w-4xl space-y-9 px-5 text-center sm:space-y-10 sm:px-6">
            <h1
              className="aw-display aw-hero-item text-6xl font-semibold tracking-tight text-[#F2F2F4] sm:text-7xl md:text-8xl"
              style={{ animationDelay: "0.05s" }}
            >
              iMIDI
              <span className="bg-gradient-to-r from-[#FF5CA1] to-[#FF8A3D] bg-clip-text text-transparent">.</span>
            </h1>

            <div className="aw-hero-item mx-auto max-w-2xl space-y-5" style={{ animationDelay: "0.15s" }}>
              <p className="px-1 text-lg font-light leading-relaxed tracking-wide text-[#C4C4CC] sm:text-xl md:text-2xl">
                The global digital standard for modern digitalization e-market. Premium audio samples, presets and
                content delivered instantly anywhere in the world through the cloud, powered by AI.
              </p>

              <ul className="flex flex-wrap items-center justify-center gap-2" aria-label="Highlights">
                {HERO_TAGS.map((t) => (
                  <li
                    key={t}
                    className="aw-mono rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-wider text-[#B4B4BC] backdrop-blur-sm"
                  >
                    {t}
                  </li>
                ))}
              </ul>
            </div>

            <div
              className="aw-hero-item flex flex-col items-center justify-center gap-3 sm:flex-row"
              style={{ animationDelay: "0.25s" }}
            >
              <Link
                href="/register"
                className={`aw-cta-glow aw-mono flex h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#FF5CA1] to-[#FF8A3D] px-8 text-xs font-semibold uppercase tracking-wide text-white transition-transform duration-300 hover:scale-[1.03] active:scale-[0.98] sm:w-auto ${FOCUS}`}
              >
                Get started free
              </Link>
              <Link
                href="/e-market"
                className={`aw-mono flex h-12 w-full items-center justify-center rounded-xl border border-white/[0.12] bg-white/[0.04] px-8 text-xs font-semibold uppercase tracking-wide text-[#D4D4D9] backdrop-blur-sm transition-all duration-300 hover:border-white/25 hover:bg-white/[0.08] sm:w-auto ${FOCUS}`}
              >
                E-Market
              </Link>
            </div>
          </div>
        </section>

        {/* ================= VALUES STRIP ================= */}
        <section aria-label="Why iMIDI" className="border-y border-white/[0.07] bg-[#16161A]">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-8 px-5 py-10 sm:px-6 md:grid-cols-4">
            {VALUES.map((v, i) => (
              <Reveal key={v.t} delay={i * 70} className="space-y-2">
                <div className={`h-[2px] w-8 rounded-full bg-gradient-to-r ${v.c}`} />
                <h2 className="aw-display text-base font-medium text-[#F2F2F4]">{v.t}</h2>
                <p className="text-[13px] leading-relaxed text-[#9A9AA3]">{v.d}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ================= PLATFORM ================= */}
        <Section id="platform">
          <div
            aria-hidden
            className="aw-blob-b pointer-events-none absolute right-0 top-1/3 h-[260px] w-[260px] rounded-full bg-[#FF5CA1]/10 blur-[110px] sm:h-[420px] sm:w-[420px] sm:blur-[150px]"
          />
          <div className="relative">
            <SectionHead
              eyebrow="Platform"
              title="What you get with iMIDI"
              sub="One unified account giving you seamless access to three production-grade utilities."
            />

            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              {PILLARS.map((p, i) => (
                <Reveal key={p.title} delay={i * 90} className="h-full">
                  <Link
                    href={p.href}
                    className={`group relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 transition-all duration-300 hover:-translate-y-1 hover:bg-white/[0.04] motion-reduce:transform-none ${FOCUS}`}
                  >
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-x-0 top-0 h-px"
                      style={{ background: `linear-gradient(90deg, transparent, ${p.color}, transparent)` }}
                    />
                    <span
                      aria-hidden
                      className="pointer-events-none absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
                      style={{ background: `${p.color}33` }}
                    />

                    <div className="relative space-y-5">
                      <span
                        className="flex h-11 w-11 items-center justify-center rounded-xl"
                        style={{ background: `${p.color}1F`, color: p.color }}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.8}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-5 w-5"
                          aria-hidden
                        >
                          <path d={p.icon} />
                        </svg>
                      </span>

                      <div className="space-y-2">
                        <p className="aw-mono text-[11px] uppercase tracking-[0.16em]" style={{ color: p.color }}>
                          {p.eyebrow}
                        </p>
                        <h3 className="aw-display text-xl font-semibold tracking-tight text-white">{p.title}</h3>
                        <p className="text-sm leading-relaxed text-[#A1A1AA]">{p.desc}</p>
                      </div>

                      <ul className="flex flex-wrap gap-1.5">
                        {p.chips.map((c) => (
                          <li
                            key={c}
                            className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[11px] text-[#B4B4BC]"
                          >
                            {c}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <span className="relative mt-8 inline-flex items-center text-xs font-semibold uppercase tracking-wide text-white/90">
                      {p.cta}
                      <svg
                        className="ml-1.5 h-3.5 w-3.5 transition-transform duration-300 ease-out group-hover:translate-x-1 motion-reduce:transition-none"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="3"
                        aria-hidden
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </span>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </Section>

        {/* ================= ARCHITECTURE ================= */}
        <Section id="architecture">
          <SectionHead
            eyebrow="Architecture"
            title="The MIDI 3.0 interconnection concept"
            sub="A unified system redefining interaction. The architecture bridges physical controller articulation with next-gen local DSP processing, extending into cloud sharing channels."
            color={PURPLE}
          />

          <Reveal>
            <ol className="grid grid-cols-1 items-stretch gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:gap-4">
              {FLOW.map((n, i) => (
                <li key={n.title} className="contents">
                  {n.hot ? (
                    <div className="rounded-2xl bg-gradient-to-br from-[#FF5CA1] to-[#FF8A3D] p-px">
                      <div className="h-full rounded-[15px] bg-[#1A1A1F] p-5">
                        <p className="aw-mono text-[11px] uppercase tracking-[0.16em] text-[#FF8A3D]">{n.label}</p>
                        <h3 className="aw-display mt-2 text-lg font-semibold text-white">{n.title}</h3>
                        <p className="mt-1.5 text-[13px] leading-relaxed text-[#A1A1AA]">{n.desc}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-white/[0.08] bg-[#18181C] p-5">
                      <p className="aw-mono text-[11px] uppercase tracking-[0.16em] text-[#8E8E98]">{n.label}</p>
                      <h3 className="aw-display mt-2 text-lg font-semibold text-white">{n.title}</h3>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-[#A1A1AA]">{n.desc}</p>
                    </div>
                  )}
                  {i < FLOW.length - 1 && (
                    <div aria-hidden className="flex items-center justify-center text-[#4A4A52]">
                      <Arrow />
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </Reveal>

          <p className="mt-5 text-xs italic text-[#8E8E98]">
            *Concept developed by iMIDI.co.uk to fulfill modern architectural and performance ecosystem needs.
          </p>
        </Section>

        {/* ================= SPECS ================= */}
        <Section id="specs">
          <SectionHead
            eyebrow="Requirements"
            title="Engineered specs"
            sub="Recommended hardware architecture optimized for real-time TS4X signal processing."
            color={ORANGE}
          />

          <dl className="border-b border-white/10">
            {SPECS.map((s, i) => (
              <Reveal key={s.label} delay={i * 80}>
                <div className="grid grid-cols-1 gap-2 border-t border-white/10 py-6 md:grid-cols-4 md:gap-8">
                  <dt className="flex items-center gap-3 md:col-span-1">
                    <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: s.color }} />
                    <span className="aw-mono text-xs font-semibold uppercase tracking-widest" style={{ color: s.color }}>
                      {s.label}
                    </span>
                  </dt>
                  <dd className="text-base font-medium leading-relaxed tracking-tight text-[#E4E4E7] md:col-span-3">
                    {s.text}
                  </dd>
                </div>
              </Reveal>
            ))}
          </dl>
        </Section>

        {/* ================= PLANS ================= */}
        <Section id="plans">
          <div
            aria-hidden
            className="aw-blob-a pointer-events-none absolute left-0 top-1/4 h-[240px] w-[240px] rounded-full bg-[#FF8A3D]/10 blur-[100px] sm:h-[360px] sm:w-[360px] sm:blur-[130px]"
          />
          <div className="relative">
            <SectionHead
              eyebrow="Plans"
              title="Expand your iMIDI setup"
              sub="Start free, add what you need."
              color={PINK}
            />

            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              {PLANS.map((p, i) => (
                <Reveal key={p.title} delay={i * 90} className="h-full">
                  <div className="flex h-full flex-col justify-between rounded-2xl border border-white/[0.08] bg-[#18181C] p-6 transition-colors duration-300 hover:border-white/20">
                    <div className="space-y-4">
                      <p className="flex items-center gap-2 aw-mono text-[11px] uppercase tracking-[0.16em]" style={{ color: p.color }}>
                        <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: p.color }} />
                        {p.eyebrow}
                      </p>
                      <div className="space-y-2">
                        <h3 className="aw-display text-xl font-semibold tracking-tight text-white">{p.title}</h3>
                        <p className="text-sm leading-relaxed text-[#A1A1AA]">{p.desc}</p>
                      </div>
                    </div>

                    <div className="mt-8 space-y-4">
                      <p className="aw-display text-3xl font-semibold tracking-tight text-white">
                        {p.price}
                        <span className="ml-1.5 text-xs font-normal text-[#8E8E98]">{p.unit}</span>
                      </p>
                      <Link
                        href={p.href}
                        className={`flex h-11 w-full items-center justify-center rounded-lg text-xs font-bold uppercase tracking-wide transition-all duration-200 active:scale-[0.99] ${
                          p.primary
                            ? "bg-white text-black hover:bg-[#E4E4E7]"
                            : "border border-white/20 bg-transparent text-white hover:border-white/40 hover:bg-white/5"
                        } ${FOCUS}`}
                      >
                        {p.cta}
                      </Link>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </Section>

        {/* ================= FAQ ================= */}
        <Section id="faq">
          <div className="mx-auto max-w-3xl">
            <SectionHead eyebrow="Support" title="Frequently asked questions" color={PURPLE} />

            <div className="flex flex-col gap-3">
              {FAQS.map((item, i) => {
                const isOpen = openFaq === i;
                return (
                  <div
                    key={item.q}
                    className={`overflow-hidden rounded-2xl border transition-colors duration-300 ${
                      isOpen ? "border-[#FF5CA1]/30 bg-[#1A1A1F]" : "border-white/[0.07] bg-[#18181C]"
                    }`}
                  >
                    <h3>
                      <button
                        type="button"
                        onClick={() => setOpenFaq(isOpen ? null : i)}
                        aria-expanded={isOpen}
                        aria-controls={`faq-panel-${i}`}
                        id={`faq-trigger-${i}`}
                        className={`flex w-full cursor-pointer items-center justify-between gap-4 px-5 py-4 text-left ${FOCUS}`}
                      >
                        <span
                          className={`text-sm font-normal transition-colors sm:text-base ${
                            isOpen ? "text-[#F2F2F4]" : "text-[#B4B4BC]"
                          }`}
                        >
                          {item.q}
                        </span>
                        <span
                          aria-hidden
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/10 text-[#8E8E98] transition-transform duration-300"
                          style={{ transform: isOpen ? "rotate(135deg)" : "rotate(0deg)" }}
                        >
                          +
                        </span>
                      </button>
                    </h3>
                    <div
                      id={`faq-panel-${i}`}
                      role="region"
                      aria-labelledby={`faq-trigger-${i}`}
                      className={`aw-faq-wrap ${isOpen ? "open" : ""}`}
                    >
                      <div className="aw-faq-inner">
                        <p className="px-5 pb-5 text-sm font-light leading-relaxed text-[#A1A1AA]">{item.a}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Section>

        {/* ================= FINAL CTA ================= */}
        <section className="px-5 pb-24 sm:px-6 sm:pb-28">
          <Reveal>
            <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl border border-white/[0.08] bg-[#18181C] px-6 py-14 text-center sm:px-12 sm:py-16">
              <div
                aria-hidden
                className="pointer-events-none absolute -top-32 left-1/2 h-64 w-[36rem] max-w-full -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(255,92,161,0.22),transparent)]"
              />
              <div className="relative space-y-4">
                <h2 className="aw-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  Create your free iMIDI account.
                </h2>
                <p className="mx-auto max-w-xl text-[15px] leading-relaxed text-[#A1A1AA]">
                  One account for TS4X, E-Market, i-volution and MyCloud.
                </p>
                <div className="flex flex-col items-center justify-center gap-3 pt-3 sm:flex-row">
                  <Link
                    href="/register"
                    className={`aw-mono flex h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#FF5CA1] to-[#FF8A3D] px-8 text-xs font-semibold uppercase tracking-wide text-white transition-transform duration-300 hover:scale-[1.03] active:scale-[0.98] sm:w-auto ${FOCUS}`}
                  >
                    Get started free
                  </Link>
                  <Link
                    href="/e-market"
                    className={`aw-mono flex h-12 w-full items-center justify-center rounded-xl border border-white/[0.12] bg-white/[0.04] px-8 text-xs font-semibold uppercase tracking-wide text-[#D4D4D9] transition-all duration-300 hover:border-white/25 hover:bg-white/[0.08] sm:w-auto ${FOCUS}`}
                  >
                    Browse E-Market
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <Footer />
    </div>
  );
}