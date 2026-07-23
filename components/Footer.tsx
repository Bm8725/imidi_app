"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function Footer() {
  // Setează anul curent în mod dinamic pentru a evita erorile de tip Hydration în Next.js
  const [year, setYear] = useState(2026);
  const version = "v0.1.13"; // Poți actualiza manual versiunea aplicației aici
  useEffect(() => {
    setYear(new Date().getFullYear());
  }, []);

  return (
    <footer className="w-full max-w-5xl mx-auto px-6 md:px-8 mt-auto pt-8 pb-6 font-mono text-[11px] text-zinc-500 selection:bg-orange-500/20">
      
      {/* LINIE TRANSVERSALĂ SUBȚIRE */}
      <div className="w-full h-[1px] bg-white/[0.04] mb-6" />

      {/* REȚEAUA DE LINKURI PURE */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        
        {/* STRUCTURA STÂNGA: BRAND & COPYRIGHT */}
        <div className="flex items-center gap-4 text-zinc-400">
          <span className="text-pink-300 font-sans font-bold tracking-tight">iMIDI.co.uk</span>
          <span>© {year} Copyright. Platform developed by BM {version}</span>
        </div>

        {/* STRUCTURA DREAPTA: PAGINI ȘI DOCUMENTE COMPLIANCE */}
        <div className="flex items-center gap-6 text-[13px] uppercase tracking-wider flex-wrap justify-center">
          <Link href="/forum" className="hover:text-orange-400 transition-colors flex items-center gap-2 group">
            forum
            {/* BADGE NEON DISCRET "NEW" */}
            <span className="relative inline-flex items-center justify-center px-1.5 py-0.5 text-[8px] font-bold lowercase tracking-normal text-pink-600 bg-emerald-500/10 border">
              new
            </span>
          </Link>
          <Link href="/support" className="hover:text-orange-400 transition-colors">
            contact
          </Link>
          <Link href="/privacy" className="hover:text-orange-400 transition-colors">
            privacy
          </Link>
          <Link href="/terms" className="hover:text-orange-400 transition-colors">
            terms
          </Link>
        </div>

      </div>

    </footer>
  );
}
