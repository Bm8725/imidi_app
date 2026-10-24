"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
// Ajustează calea în funcție de structura proiectului tău
import { openCookieSettings } from "@/components/CookieBanner";

type FooterLink = { href: string; label: string; external?: boolean; badge?: string };

const VERSION = "v0.1.13";

const COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: "Platform",
    links: [
      { href: "/products", label: "i-volution" },
      { href: "/airmidi-link", label: "AirMIDI Link" },
      { href: "/e-market", label: "Market" },
      { href: "/sd-writer", label: "SD-Writer" },
      { href: "https://imidi.co.uk", label: "Docs", external: true },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/hub-services", label: "HUB development" },
      { href: "/stiri", label: "Forum", badge: "new" },
      { href: "/support", label: "Contact" },
    ],
  },
];

const LEGAL: FooterLink[] = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

const FOCUS =
  "rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0A0A]";

const LINK =
  "group relative inline-flex items-center gap-2 py-1.5 text-[14px] font-medium text-[#BFAF9F] transition-colors duration-200 hover:text-[#E6E1D5] focus-visible:text-[#E6E1D5]";

function Underline() {
  return (
    <span
      aria-hidden
      className="absolute bottom-0.5 left-0 h-px w-0 bg-pink-400/60 transition-all duration-300 group-hover:w-full group-focus-visible:w-full"
    />
  );
}

function NewBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="relative inline-flex items-center justify-center overflow-hidden rounded px-1.5 py-0.5 text-[9px] font-bold lowercase text-pink-400 ring-1 ring-pink-400/30 transition-colors duration-300 group-hover:bg-pink-400 group-hover:text-[#0B0A0A]">
      <span aria-hidden className="absolute inset-0 animate-ping rounded bg-pink-400/20 motion-reduce:animate-none" />
      <span className="relative">{children}</span>
    </span>
  );
}

function FooterAnchor({ link }: { link: FooterLink }) {
  const inner = (
    <>
      {link.label}
      {link.badge && <NewBadge>{link.badge}</NewBadge>}
      {link.external && (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3 opacity-60" aria-hidden>
          <path d="M7 17 17 7M8 7h9v9" />
        </svg>
      )}
      <Underline />
    </>
  );

  if (link.external) {
    return (
      <a href={link.href} target="_blank" rel="noopener noreferrer" className={`${LINK} ${FOCUS}`}>
        {inner}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    );
  }
  return (
    <Link href={link.href} className={`${LINK} ${FOCUS}`}>
      {inner}
    </Link>
  );
}

export default function Footer() {
  const [year, setYear] = useState(2026);

  useEffect(() => {
    setYear(new Date().getFullYear());
  }, []);

  const backToTop = () => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <footer className="relative mt-auto w-full overflow-hidden bg-[#0B0A0A] text-[#BFAF9F] selection:bg-pink-400/20">
      <style>{`
        @keyframes ft-eq { 0%, 100% { transform: scaleY(0.3); } 50% { transform: scaleY(1); } }
        .ft-eq { animation: ft-eq 1.1s ease-in-out infinite; transform-origin: bottom; }
        @media (prefers-reduced-motion: reduce) { .ft-eq { animation: none; transform: scaleY(0.7); } }
      `}</style>

      {/* Top audio-waveform decorative line with dark-burgundy/pink fluid feel */}
      <div aria-hidden className="relative h-px w-full bg-gradient-to-r from-transparent via-pink-500/20 to-transparent">
        <div className="absolute left-1/2 top-0 h-px w-40 -translate-x-1/2 bg-gradient-to-r from-transparent via-pink-400 to-transparent blur-[1px]" />
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[40rem] max-w-full -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(244,63,94,0.06),transparent)]"
      />

      {/* Main container with bottom padding layout safe for PWA mobile navbars */}
      <div className="relative mx-auto w-full max-w-6xl px-6 pb-28 pt-14 md:px-8 md:pb-8">
        <div className="grid gap-12 md:grid-cols-12">
          
          {/* Brand & Identity Statement */}
          <div className="md:col-span-5">
            <div className="flex items-center gap-3">
              <Link
                href="/"
                aria-label="iMIDI home"
                className={`font-sans text-2xl font-extrabold tracking-tight text-[#E6E1D5] ${FOCUS}`}
              >
                iMIDI<span className="text-pink-400/90">.co.uk</span>
              </Link>
            </div>
            <p className="mt-4 max-w-sm text-[14px] leading-relaxed text-[#BFAF9F]/80">
              MIDI hardware, cloud space and live sessions, together in one platform.
            </p>
          </div>

          {/* Navigational Tree Structures */}
          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 md:col-span-7 md:justify-items-start lg:pl-8">
            {COLUMNS.map((col) => (
              <div key={col.title}>
                <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-pink-400/70">{col.title}</h2>
                <ul className="mt-3 flex flex-col">
                  {col.links.map((l) => (
                    <li key={l.href}>
                      <FooterAnchor link={l} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            <div>
              <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-pink-400/70">Legal</h2>
              <ul className="mt-3 flex flex-col">
                {LEGAL.map((l) => (
                  <li key={l.href}>
                    <FooterAnchor link={l} />
                  </li>
                ))}
                <li>
                  <button type="button" onClick={openCookieSettings} className={`${LINK} cursor-pointer ${FOCUS}`}>
                    Cookie settings
                    <Underline />
                  </button>
                </li>
              </ul>
            </div>
          </nav>
        </div>

        {/* System metadata & Execution controls bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-[#E6E1D5]/[0.05] pt-6 text-center sm:flex-row sm:text-left">
          <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5 font-mono text-[11px] tracking-tight text-[#BFAF9F]/60 sm:justify-start">
            <span>© {year} iMIDI.co.uk</span>
            <span aria-hidden className="text-[#BFAF9F]/20">
              ·
            </span>
            <span>
              Platform developed with <span className="font-semibold text-[#E6E1D5]">NI</span>
            </span>
            <span className="rounded border border-pink-400/20 bg-[#141211] px-1.5 py-0.5 text-[9px] font-bold text-pink-400">{VERSION}</span>
          </p>

          <button
            type="button"
            onClick={backToTop}
            className={`group inline-flex cursor-pointer items-center gap-2 px-1 py-1.5 font-mono text-[11px] text-[#BFAF9F] transition-colors hover:text-[#E6E1D5] ${FOCUS}`}
          >
            Back to top
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-y-0.5 motion-reduce:transition-none"
              aria-hidden
            >
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        </div>
      </div>
    </footer>
  );
}
