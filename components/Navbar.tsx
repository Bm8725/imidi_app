'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Home", icon: "M2.25 12 11.204 3.045a1.125 1.125 0 0 1 1.592 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21.75h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21.75h2.25" },
  { href: "/ts4x", label: "TS4X", icon: "M3.75 13.5 14.25 2.25 12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" },
  { href: "/e-market", label: "Market", icon: "M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z", isNew: true },
  { href: "/download", label: "Download", icon: "M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" },
  { href: "/dashboard/cloud-db", label: "mySpace", icon: "M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setScrolled(currentScrollY > 15);
      
      if (currentScrollY > lastScrollY && currentScrollY > 60) {
        setIsVisible(false);
        setIsMenuOpen(false);
      } else {
        setIsVisible(true);
      }
      setLastScrollY(currentScrollY);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsMenuOpen(false);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [lastScrollY]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      document.body.style.overflow = isMenuOpen ? "hidden" : "unset";
    }
  }, [isMenuOpen]);

  return (
    <>
      {/* DESKTOP NAV: CORPORATE CLASSIC */}
      <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 hidden md:block ${scrolled ? "bg-white border-b border-slate-200 shadow-sm h-16" : "bg-slate-50/50 border-b border-transparent h-20"}`}>
        <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between">
          <Link href="/" className="text-xl font-black tracking-tight text-slate-950 group relative py-1">
            <span>iMIDI</span><span className="text-blue-600 ml-0.5 inline-block group-hover:scale-125 transition-transform duration-200">.</span>
          </Link>

          <div className="flex items-center space-x-2">
            {links.slice(1).map((l) => {
              const active = pathname === l.href;
              return (
                <Link key={l.href} href={l.href} className={`text-xs font-semibold uppercase tracking-wider transition-all duration-200 relative py-2 px-4 rounded-full ${active ? "text-blue-600 bg-blue-50" : "text-slate-500 hover:text-slate-950 hover:bg-slate-100"}`}>
                  <span className="relative z-10">{l.label}</span>
                  {l.isNew && <span className="ml-1.5 px-1.5 py-0.5 text-[8px] font-bold bg-emerald-100 text-emerald-700 rounded-md">NEW</span>}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center space-x-4">
            <Link href="/login" className="text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-950 transition-colors">Sign In</Link>
            <Link href="/register" className="text-xs font-bold uppercase tracking-wider bg-blue-600 text-white px-5 py-2.5 rounded-full hover:bg-blue-700 transition-all transform active:scale-95 shadow-sm">Get Started</Link>
          </div>
        </div>
      </nav>

      {/* MOBILE HEADER: SUS CU BUTON HAMBURGER PENTRU LOGIN ACCOUNT */}
      <div className={`md:hidden fixed top-0 inset-x-0 h-14 bg-white/90 backdrop-blur-md border-b border-slate-200 z-50 flex items-center px-5 justify-between transition-transform duration-300 ${isVisible ? "translate-y-0" : "-translate-y-full"}`}>
        <Link href="/" onClick={() => setIsMenuOpen(false)} className="text-lg font-black tracking-tight text-slate-950">iMIDI<span className="text-blue-600">.</span></Link>
        
        {/* HAMBURGER CU LINII FINE DOAR PENTRU ACCOUNT OVERLAY */}
        <button 
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="p-2 text-slate-600 hover:text-slate-900 focus:outline-none transition-colors"
          aria-label="Toggle Account Menu"
        >
          <div className="w-5 h-4 flex flex-col justify-between items-center relative">
            <span className={`w-5 h-0.5 bg-current rounded-full transition-all duration-300 origin-left ${isMenuOpen ? "rotate-45 translate-x-0.5" : ""}`} />
            <span className={`w-5 h-0.5 bg-current rounded-full transition-all duration-200 ${isMenuOpen ? "opacity-0" : ""}`} />
            <span className={`w-5 h-0.5 bg-current rounded-full transition-all duration-300 origin-left ${isMenuOpen ? "-rotate-45 translate-x-0.5" : ""}`} />
          </div>
        </button>
      </div>

      {/* MOBILE OVERLAY: LOGIN & REGISTER FULLSCREEN CORPORATE */}
      <div 
        className={`md:hidden fixed inset-0 bg-white/98 backdrop-blur-2xl z-40 px-6 flex flex-col justify-center transition-all duration-500 ease-in-out transform ${
          isMenuOpen ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 pointer-events-none"
        }`}
      >
        <div className="absolute top-24 left-6 right-6 border-b border-slate-100 pb-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">iMIDI Gateway</p>
        </div>

        <div className="flex flex-col space-y-6 w-full max-w-sm mx-auto">
          <div className="text-center space-y-1">
            <h2 className="text-2xl font-black tracking-tight text-slate-950">Welcome Back<span className="text-blue-600">.</span></h2>
            <p className="text-xs font-medium text-slate-500">Access your cloud studio space</p>
          </div>

          <div className="flex flex-col space-y-3">
            <Link 
              href="/login" 
              onClick={() => setIsMenuOpen(false)} 
              className="w-full text-center py-3.5 rounded-full text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 active:scale-[0.98] transition-all"
            >
              Sign In
            </Link>
            <Link 
              href="/register" 
              onClick={() => setIsMenuOpen(false)} 
              className="w-full text-center py-3.5 rounded-full text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98] transition-all shadow-sm"
            >
              Get Started
            </Link>
          </div>
        </div>

        <div className="absolute bottom-24 left-6 right-6 text-center">
          <p className="text-[9px] font-medium text-slate-300 uppercase tracking-widest">Secure encrypted session</p>
        </div>
      </div>

      {/* MOBILE NAV: BARA DE JOS RĂMÂNE PENTRU NAVIGARE CU SOLID FILL LA ACTIVE */}
      <nav className={`md:hidden fixed bottom-5 inset-x-4 z-50 transition-all duration-300 ${isVisible ? "translate-y-0 opacity-100" : "translate-y-28 opacity-0 pointer-events-none"}`}>
        <div className="bg-white/95 border border-slate-200 backdrop-blur-xl rounded-2xl p-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between relative">
            {links.map((l) => {
              const cur = pathname === l.href;
              return (
                <Link 
                  key={l.href} 
                  href={l.href} 
                  className="flex flex-col items-center justify-center py-1.5 flex-1 relative group active:scale-95 transition-transform" 
                  onClick={() => setIsMenuOpen(false)}
                >
                  {/* ICONIȚA CU SOLID FILL LA ACTIVE */}
                  <div className={`p-2 rounded-xl transition-all duration-200 ${cur ? 'text-blue-600 bg-blue-50/60 scale-105' : 'text-slate-400 hover:text-slate-900'}`}>
                    <svg 
                      viewBox="0 0 24 24" 
                      strokeWidth={cur ? "1.5" : "2.5"} 
                      stroke="currentColor" 
                      fill={cur ? "currentColor" : "none"} 
                      className="w-4 h-4"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d={l.icon} />
                    </svg>
                  </div>
                  
                  <span className={`text-[8px] font-semibold uppercase tracking-wider mt-1 transition-colors duration-200 ${cur ? 'text-blue-600 font-bold' : 'text-slate-400'}`}>
                    {l.label === "Market" ? "Market" : l.label}
                  </span>

                  {l.isNew && !cur && (
                    <span className="absolute top-1.5 right-4 px-1.5 py-0.5 text-[6px] font-bold bg-emerald-100 text-emerald-700 rounded-md scale-90">NEW</span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
}
