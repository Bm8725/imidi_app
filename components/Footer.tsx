"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function Footer() {
  // Setează anul curent în mod dinamic pentru a evita erorile de tip Hydration în Next.js
  const [year, setYear] = useState(2026);

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
          <span className="text-white font-sans font-bold tracking-tight">iMIDI.co.uk</span>
          <span>© {year} all rights reserved</span>
        </div>

        {/* STRUCTURA DREAPTA: PAGINI ȘI DOCUMENTE COMPLIANCE */}
        <div className="flex items-center gap-6 text-[10px] uppercase tracking-wider flex-wrap justify-center">
          <Link href="/forum" className="hover:text-white transition-colors">
            forum
          </Link>
          <Link href="/support" className="hover:text-white transition-colors">
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
