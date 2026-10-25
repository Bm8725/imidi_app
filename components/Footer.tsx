"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
// adjust the path if CookieBanner lives elsewhere
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
      { href: "https://docs.imidi.co.uk", label: "Docs", external: true },
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

/* ---------- waves ---------- */
function wavePath(amp: number, periods: number, w = 1200, h = 80) {
  const pts: string[] = [];
  for (let x = 0; x <= w; x += 12) {
    const y = h / 2 + Math.sin((x / w) * Math.PI * 2 * periods) * amp;
    pts.push(`${x === 0 ? "M" : "L"}${x},${y.toFixed(1)}`);
  }
  return pts.join(" ");
}

const FOCUS =
  "rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B1528]";
const LINK =
  "group inline-flex items-center gap-2 py-1.5 text-[14px] font-medium text-[#9AA9C4] transition-all duration-200 hover:translate-x-1 hover:text-white focus-visible:text-white motion-reduce:transition-none motion-reduce:hover:translate-x-0";

function FooterAnchor({ link }: { link: FooterLink }) {
  const inner = (
    <>
      <span aria-hidden className="h-1 w-1 rounded-full bg-pink-300/0 transition-colors group-hover:bg-pink-300" />
      {link.label}
      {link.badge && (
        <span className="rounded-full bg-pink-300 px-1.5 py-0.5 text-[9px] font-bold lowercase text-[#0B1528]">{link.badge}</span>
      )}
      {link.external && (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3 opacity-60" aria-hidden>
          <path d="M7 17 17 7M8 7h9v9" />
        </svg>
      )}
    </>
  );
  if (link.external)
    return (
      <a href={link.href} target="_blank" rel="noopener noreferrer" className={`${LINK} ${FOCUS}`}>
        {inner}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    );
  return (
    <Link href={link.href} className={`${LINK} ${FOCUS}`}>
      {inner}
    </Link>
  );
}

export default function Footer() {
  const [year, setYear] = useState(2026);
  useEffect(() => setYear(new Date().getFullYear()), []);

  const waves = useMemo(() => [wavePath(26, 3), wavePath(16, 5), wavePath(34, 2)], []);

  const backToTop = () => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <footer className="relative mt-auto w-full overflow-hidden bg-[#070E1E] text-[#7E8FAD] selection:bg-pink-300/20">
      {/* top gradient + static waveforms */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-pink-300/15 via-[#12224A]/40 to-transparent" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-40 overflow-hidden [mask-image:linear-gradient(to_bottom,black,transparent)]">
        {waves.map((d, n) => (
          <svg
            key={n}
            viewBox="0 0 1200 80"
            preserveAspectRatio="none"
            className="absolute left-0 h-20 w-full text-pink-300"
            style={{ opacity: 0.55 - n * 0.14, top: `${8 + n * 14}px` }}
          >
            <path d={d} fill="none" stroke="currentColor" strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
          </svg>
        ))}
      </div>

      <div className="relative mx-auto w-full max-w-6xl px-6 pb-28 pt-24 md:px-8 md:pb-8">
        {/* headline */}
        <div className="text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-pink-300/80">Digitalization · MIDI · Market · Cloud · AI</p>
          <h2 className="mt-4 bg-gradient-to-b from-white to-[#7E8FAD] bg-clip-text text-4xl font-black tracking-tight text-transparent sm:text-6xl">
            Play the digital future.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-[#9AA9C4]">
            One account for TS4X, E-Market, i-volution and MyCloud. Hardware, cloud space and live sessions, together in one platform.
          </p>

        </div>

        {/* links in glass panel */}
        <nav
          aria-label="Footer"
          className="mt-16 grid grid-cols-2 gap-x-6 gap-y-10 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-6 backdrop-blur sm:grid-cols-4 sm:p-8"
        >
          <div className="col-span-2 sm:col-span-1">
            <Link href="/" aria-label="iMIDI home" className={`text-2xl font-extrabold tracking-tight text-white ${FOCUS}`}>
              iMIDI<span className="text-pink-300">.co.uk</span>
            </Link>
            <p className="mt-3 max-w-[16rem] text-[13px] leading-relaxed text-[#9AA9C4]">Concept developed for modern stage and studio.</p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-pink-300/80">{col.title}</h2>
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
            <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-pink-300/80">Legal</h2>
            <ul className="mt-3 flex flex-col">
              {LEGAL.map((l) => (
                <li key={l.href}>
                  <FooterAnchor link={l} />
                </li>
              ))}
              <li>
                <button type="button" onClick={openCookieSettings} className={`${LINK} cursor-pointer ${FOCUS}`}>
                  <span aria-hidden className="h-1 w-1 rounded-full bg-pink-300/0 transition-colors group-hover:bg-pink-300" />
                  Cookie settings
                </button>
              </li>
            </ul>
          </div>
        </nav>

        {/* giant wordmark */}
        <div aria-hidden className="pointer-events-none mt-10 select-none overflow-hidden text-center leading-[0.8]">
          <span className="block bg-gradient-to-b from-pink-300/40 via-pink-300/10 to-transparent bg-clip-text text-[26vw] font-black tracking-tighter text-transparent md:text-[19rem]">
            iMIDI
          </span>
        </div>

        {/* bottom bar */}
        <div className="mt-4 flex flex-col items-center justify-between gap-4 border-t border-white/[0.07] pt-6 text-center sm:flex-row sm:text-left">
          <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5 font-mono text-[11px] tracking-tight sm:justify-start">
            <span>© {year} iMIDI.co.uk</span>
            <span aria-hidden className="text-[#7E8FAD]/40">·</span>
            <span>
              Platform developed with <span className="font-semibold text-white">NI</span>
            </span>
            <span className="rounded border border-pink-300/20 bg-[#0F1D36] px-1.5 py-0.5 text-[9px] font-bold text-pink-300">{VERSION}</span>
          </p>
          <button
            type="button"
            onClick={backToTop}
            className={`group inline-flex cursor-pointer items-center gap-2 px-1 py-1.5 font-mono text-[11px] text-[#9AA9C4] transition-colors hover:text-white ${FOCUS}`}
          >
            Back to top
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 motion-reduce:transition-none" aria-hidden>
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        </div>
      </div>
    </footer>
  );
}