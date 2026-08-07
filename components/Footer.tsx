"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function Footer() {
  const [year, setYear] = useState(2026);
  const version = "v0.1.13";

  useEffect(() => {
    setYear(new Date().getFullYear());
  }, []);

  return (
    <footer className="w-full max-w-5xl mx-auto px-6 md:px-8 mt-auto pt-12 pb-6 font-mono text-[11px] text-[#7E8FAD] selection:bg-pink-300/20 overflow-hidden relative">
      
      {/* LINIE TRANSVERSALĂ GLOWING - Stil Waveform Audio Roz */}
      <div className="relative w-full h-[1px] bg-gradient-to-r from-transparent via-pink-300/30 to-transparent mb-8">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-[1px] bg-pink-300 blur-[1px]" />
      </div>

      {/* STRUCUTRA PRINCIPALĂ */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 relative z-10">
        
        {/* STRUCTURA STÂNGA: BRAND & COPYRIGHT CYBER ROZ */}
        <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-center sm:text-left">
          <div className="relative group">
            <span className="text-pink-300 font-sans font-extrabold tracking-tight text-xs transition-colors duration-300 group-hover:text-white">
              iMIDI.co.uk
            </span>
            <span className="absolute -bottom-1 left-0 w-0 h-[1px] bg-pink-300 transition-all duration-300 group-hover:w-full" />
          </div>
          <span className="hidden sm:inline text-[#7E8FAD]/40">|</span>
          <span className="text-[#7E8FAD]/80 tracking-tight">
            © {year} Copyright. Platform developed with{" "}
            <span className="text-white font-semibold">NI</span>{" "}
            <span className="inline-block px-1.5 py-0.5 ml-1 rounded bg-[#0B1528] text-pink-300 text-[9px] border border-pink-300/20 font-bold">
              {version}
            </span>
          </span>
        </div>

        {/* STRUCTURA DREAPTA: PAGINI ȘI DOCUMENTE COMPLIANCE */}
        <div className="flex items-center gap-6 text-[12px] lowercase tracking-normal flex-wrap justify-center font-sans font-medium">
          
          {/* LINK FORUM CU BADGE ANIMAT ROZ */}
          <Link href="/forum" className="text-[#7E8FAD] hover:text-pink-300 transition-all duration-300 flex items-center gap-2 group relative">
            forum
            <span className="relative inline-flex items-center justify-center px-1.5 py-0.5 text-[8px] font-bold lowercase tracking-normal text-pink-400 bg-pink-500/10 border border-pink-400/30 rounded-sm overflow-hidden group-hover:bg-pink-300 group-hover:text-[#0B1528] transition-colors duration-300">
              {/* Puls discret pe fundalul badge-ului */}
              <span className="absolute inset-0 bg-pink-400/20 animate-ping rounded-sm" />
              <span className="relative z-10">new</span>
            </span>
          </Link>

          <Link href="/support" className="text-[#7E8FAD] hover:text-pink-300 transition-all duration-300 relative group py-1">
            contact
            <span className="absolute bottom-0 left-0 w-0 h-[1px] bg-pink-300/50 transition-all duration-300 group-hover:w-full" />
          </Link>

          <Link href="/privacy" className="text-[#7E8FAD] hover:text-pink-300 transition-all duration-300 relative group py-1">
            privacy
            <span className="absolute bottom-0 left-0 w-0 h-[1px] bg-pink-300/50 transition-all duration-300 group-hover:w-full" />
          </Link>

          <Link href="/terms" className="text-[#7E8FAD] hover:text-pink-300 transition-all duration-300 relative group py-1">
            terms
            <span className="absolute bottom-0 left-0 w-0 h-[1px] bg-pink-300/50 transition-all duration-300 group-hover:w-full" />
          </Link>

        </div>

      </div>

    </footer>
  );
}
