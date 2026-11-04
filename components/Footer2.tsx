"use client";

import { useState } from "react";
import Link from "next/link";
import { openCookieSettings } from "@/components/CookieBanner";

const VERSION = "v0.1.13";
const FOCUS_CLASSES = "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500 focus-visible:ring-offset-1 focus-visible:ring-offset-zinc-900";

const SECTIONS = [
  {
    id: "platform",
    label: "Platform",
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
    label: "Company",
    links: [
      { href: "/hub-services", label: "HUB Development" },
      { href: "/stiri", label: "Forum" },
      { href: "/support", label: "Contact Support" },
    ],
  },
  {
    id: "legal",
    label: "Legal",
    links: [
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/terms", label: "Terms of Service" },
    ],
  },
];

export default function EnhancedDesktopFooter() {
  const [activeIsland, setActiveIsland] = useState<string | null>(null);
  const selectedColumn = SECTIONS.find((s) => s.id === activeIsland);

  return (
    <div 
      className="fixed bottom-0 inset-x-0 z-50 flex flex-col items-center pointer-events-none font-sans antialiased text-xs md:text-sm"
      onMouseLeave={() => setActiveIsland(null)}
    >
      {/* Contextual Sub-menu Panel */}
      {selectedColumn && (
        <div className="pointer-events-auto w-full border-t border-zinc-800 bg-zinc-900/90 px-4 md:px-10 py-2.5 md:py-4 backdrop-blur-md shadow-inner animate-in slide-in-from-bottom-1 duration-150">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center gap-2 md:gap-10">
            
            {/* Section Header */}
            <div className="flex items-center justify-between md:justify-start gap-4 border-b border-zinc-800 md:border-none pb-1 md:pb-0">
              <span className="text-[10px] md:text-xs font-semibold tracking-wider text-zinc-500 uppercase">
                {selectedColumn.label}
              </span>
              {/* Ultra-discrete close icon for mobile */}
              <button 
                type="button" 
                onClick={() => setActiveIsland(null)}
                className="md:hidden text-zinc-500 hover:text-zinc-300 text-sm px-1"
                aria-label="Close menu"
              >
                &times;
              </button>
            </div>
            
            <div className="hidden md:block h-4 w-px bg-zinc-800" />
            
            {/* Links Stack */}
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 md:flex md:flex-row md:flex-wrap md:gap-8 mt-1 md:mt-0">
              {selectedColumn.links.map((link) => (
                <li key={link.href}>
                  <Link 
                    href={link.href} 
                    target={link.external ? "_blank" : undefined}
                    onClick={() => setActiveIsland(null)}
                    className="block py-1 md:py-0 text-zinc-400 md:text-zinc-300 hover:text-white transition-colors duration-150 font-normal md:font-medium"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              
              {activeIsland === "legal" && (
                <li className="col-span-2 md:col-span-1">
                  <button
                    type="button"
                    onClick={() => { openCookieSettings(); setActiveIsland(null); }}
                    className="w-full text-left py-1 md:py-0 text-zinc-400 md:text-zinc-300 hover:text-white transition-colors duration-150 font-normal md:font-medium"
                  >
                    Cookie Settings
                  </button>
                </li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* Main Navigation Bar */}
      <nav className="pointer-events-auto w-full border-t border-zinc-800/60 bg-zinc-950/95 px-4 md:px-10 py-1.5 md:py-3 text-zinc-500 flex items-center justify-between shadow-xl select-none">
        
        {/* Branding Workspace Metadata */}
        <div className="flex items-center gap-2 md:gap-4">
          <Link 
            href="/" 
            onClick={() => setActiveIsland(null)} 
            className={`text-zinc-300 font-medium tracking-tight hover:text-white transition-colors text-xs md:text-base ${FOCUS_CLASSES}`}
          >
            iMIDI
          </Link>
          <span className="text-[10px] md:text-xs font-mono text-zinc-600 opacity-80">{VERSION}</span>
          <span className="hidden sm:inline text-zinc-800">|</span>
          <span className="hidden sm:inline text-[11px] md:text-xs text-zinc-500 tracking-wide">
            TS4X Core Workspace
          </span>
        </div>

        {/* Tab Interface Triggers */}
        <div className="flex items-center gap-1">
          {SECTIONS.map((btn) => {
            const isActive = activeIsland === btn.id;
            return (
              <button
                key={btn.id}
                type="button"
                onClick={() => setActiveIsland(isActive ? null : btn.id)}
                className={`px-2 md:px-4 py-0.5 md:py-1.5 rounded text-[11px] md:text-xs transition-all duration-150 ${
                  isActive 
                    ? "bg-zinc-800 text-zinc-100 shadow-sm font-medium md:font-semibold" 
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50"
                } ${FOCUS_CLASSES}`}
              >
                {btn.label}
              </button>
            );
          })}
        </div>

      </nav>
    </div>
  );
}
