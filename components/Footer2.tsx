"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { openCookieSettings } from "@/components/CookieBanner";

// ==========================================
// 1. DEFINIȚII DE TIPURI (TYPES)
// ==========================================
type FooterLink = { 
  href: string; 
  label: string; 
  external?: boolean; 
  badge?: string 
};

type IslandSection = {
  id: string;
  title: string;
  iconPath: string;
  links: FooterLink[];
};

// ==========================================
// 2. CONFIGURARE DATE ORIGINALE (DATA)
// ==========================================
const VERSION = "v0.1.13";

const SECTIONS: IslandSection[] = [
  {
    id: "platform",
    title: "Platform",
    iconPath: "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V16zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V16z",
    links: [
      { href: "/products", label: "i-volution" },
      { href: "/airmidi-link", label: "AirMIDI Link" },
      { href: "/e-market", label: "Market" },
      { href: "/support/tool/wbank-studio", label: "wbank manager" },
      { href: "/sd-writer", label: "SD-Writer" },
      { href: "https://imidi.co.uk", label: "Docs", external: true },
    ],
  },
  {
    id: "company",
    title: "Company",
    iconPath: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0V11m0 0h4m-4 0h-4m4 0v3h4v-3m-4 0h4m-4 3h4m-4 0h4",
    links: [
      { href: "/hub-services", label: "HUB development" },
      { href: "/stiri", label: "Forum", badge: "new" },
      { href: "/support", label: "Contact" },
    ],
  },
  {
    id: "legal",
    title: "Legal",
    iconPath: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
    ],
  },
];

const FOCUS_CLASSES = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0202]";

// ==========================================
// 3. COMPONENTĂ PRINCIPALĂ (MAIN COMPONENT)
// ==========================================
export default function DynamicIslandDock() {
  const [activeIsland, setActiveIsland] = useState<string | null>(null);
  const [currentYear, setCurrentYear] = useState<number>(2026);

  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);

  const selectedColumn = SECTIONS.find((section) => section.id === activeIsland);

  const handleDockButtonPress = (id: string) => {
    setActiveIsland(activeIsland === id ? null : id);
  };

  return (
    <div 
      className="fixed bottom-5 inset-x-4 z-50 flex flex-col items-center gap-3 pointer-events-none font-sans select-none"
      onMouseLeave={() => setActiveIsland(null)}
    >
      {/* -------------------------------------- */}
      {/* CONTEXTUAL FLOATING ISLAND            */}
      {/* -------------------------------------- */}
      {selectedColumn && (
        <div className="pointer-events-auto w-full max-w-sm rounded-[24px] border border-white/10 bg-gradient-to-b from-red-950/95 via-[#110303]/98 to-[#060101]/99 p-5 text-white shadow-[0_25px_50px_-12px_rgba(239,68,68,0.15)] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
          
          {/* Header Panel */}
          <div className="flex items-center justify-between border-b border-white/5 pb-2.5 mb-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-red-500/80">
              {selectedColumn.title} Console
            </span>
            {activeIsland === "platform" && (
              <div className="text-[9px] font-mono text-white/40 flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
                <span>TS4X Engine Active</span>
              </div>
            )}
          </div>

          {/* Links Router Stack */}
          <ul className="flex flex-col gap-0.5">
            {selectedColumn.links.map((linkItem) => (
              <li key={linkItem.href}>
                <IslandLinkAnchor 
                  link={linkItem} 
                  onActionComplete={() => setActiveIsland(null)} 
                />
              </li>
            ))}
            
            {/* Inject Button Inside Legal Island */}
            {activeIsland === "legal" && (
              <li>
                <button
                  type="button"
                  onClick={() => { openCookieSettings(); setActiveIsland(null); }}
                  className="group flex w-full items-center px-3 py-2 rounded-xl hover:bg-white/5 transition-all duration-150 text-sm font-medium text-white/70 hover:text-white"
                >
                  Cookie settings
                </button>
              </li>
            )}
          </ul>

          {/* System Footer Metadata */}
          <div className="mt-4 pt-2.5 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-white/30">
            <span>© {currentYear} iMIDI Node</span>
            <span>{VERSION}</span>
          </div>

        </div>
      )}

      {/* -------------------------------------- */}
      {/* CYBER-DOCK CONTROLLER                 */}
      {/* -------------------------------------- */}
      <nav className="pointer-events-auto flex items-center justify-between rounded-full border border-white/10 bg-gradient-to-b from-red-950/80 via-[#110303]/90 to-[#050101]/95 px-3 py-2 text-white shadow-xl backdrop-blur-lg w-full max-w-md">
        
        {/* Core System Branding Button */}
        <Link 
          href="/" 
          onClick={() => setActiveIsland(null)} 
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full hover:bg-white/5 text-sm font-black tracking-tighter transition-all ${FOCUS_CLASSES}`}
        >
          <span className="flex h-2 w-2 rounded-full bg-red-500 relative">
            <span className="animate-ping absolute inset-0 rounded-full bg-red-400 opacity-75" />
          </span>
          iMIDI<span className="text-white/40 font-medium tracking-normal text-xs">.co.uk</span>
        </Link>

        {/* Dynamic Navigation Interface Trigger */}
        <div className="flex items-center gap-1">
          {SECTIONS.map((btn) => {
            const isTargetActive = activeIsland === btn.id;
            return (
              <button
                key={btn.id}
                type="button"
                onClick={() => handleDockButtonPress(btn.id)}
                className={`p-2.5 rounded-full transition-all duration-200 ${
                  isTargetActive 
                    ? "bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.4)] scale-105" 
                    : "text-white/60 hover:text-white hover:bg-white/5"
                } ${FOCUS_CLASSES}`}
                aria-label={`Toggle ${btn.title} console`}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={btn.iconPath} />
                </svg>
              </button>
            );
          })}
        </div>

      </nav>
    </div>
  );
}

// ==========================================
// 4. SUB-COMPONENTĂ LINK-URI (SUB-COMPONENT)
// ==========================================
function IslandLinkAnchor({ 
  link, 
  onActionComplete 
}: { 
  link: FooterLink; 
  onActionComplete: () => void 
}) {
  const contentWrapper = (
    <span className="flex w-full items-center justify-between py-1 text-sm font-medium text-white/70 group-hover:text-white transition-colors">
      <span className="truncate tracking-wide">{link.label}</span>
      
      {link.badge && (
        <span className="rounded bg-red-500/20 border border-red-500/40 px-1.5 py-0.5 text-[8px] font-mono font-bold text-red-400">
          {link.badge}
        </span>
      )}
      
      {link.external && (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="h-3 w-3 opacity-30 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
        </svg>
      )}
    </span>
  );

  const anchorClass = `group flex w-full items-center px-3 py-2 rounded-xl hover:bg-white/5 transition-all duration-150 ${FOCUS_CLASSES}`;

  if (link.external) {
    return (
      <a 
        href={link.href} 
        target="_blank" 
        rel="noopener noreferrer" 
        className={anchorClass} 
        onClick={onActionComplete}
      >
        {contentWrapper}
        <span className="sr-only">(opens in a new tab)</span>
      </a>
    );
  }

  return (
    <Link 
      href={link.href} 
      className={anchorClass} 
      onClick={onActionComplete}
    >
      {contentWrapper}
    </Link>
  );
}
