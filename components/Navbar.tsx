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

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  return (
    <>
      {/* DESKTOP NAV: HIGH CONTRAST CLASSIC */}
      <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 hidden md:block ${scrolled ? "bg-white border-b border-slate-300 shadow-md h-16" : "bg-slate-50 border-b border-slate-200 h-20"}`}>
        <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between">
          <Link href="/" className="text-xl font-black tracking-tight text-slate-950 group relative py-1">
            <span>iMIDI</span><span className="text-blue-600 ml-0.5 inline-block group-hover:scale-125 transition-transform duration-200">.</span>
          </Link>

          <div className="flex items-center space-x-6">
            {links.slice(1).map((l) => {
              const active = pathname === l.href;
              return (
                <Link key={l.href} href={l.href} className={`text-xs font-black uppercase tracking-widest transition-all duration-200 relative py-1.5 px-3 rounded-md ${active ? "text-white bg-blue-600" : "text-slate-600 hover:text-slate-950 hover:bg-slate-200/60"}`}>
                  <span className="relative z-10">{l.label}</span>
                  {l.isNew && <span className="ml-1.5 px-1 py-0.5 text-[8px] font-black bg-emerald-600 text-white rounded">NEW</span>}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center space-x-4">
            <Link href="/login" className="text-xs font-black uppercase tracking-widest text-slate-600 hover:text-slate-950 transition-colors">Sign In</Link>
            <Link href="/register" className="text-xs font-black uppercase tracking-widest bg-slate-950 text-white px-5 py-2.5 rounded-md hover:bg-blue-600 transition-all transform active:scale-95 shadow-md">Get Started</Link>
          </div>
        </div>
      </nav>

      {/* MOBILE HEADER: TOP SOLID BRANDING */}
      <div className={`md:hidden fixed top-0 inset-x-0 h-14 bg-white border-b-2 border-slate-950 z-50 flex items-center px-5 justify-between transition-transform duration-300 ${isVisible ? "translate-y-0" : "-translate-y-full"}`}>
        <Link href="/" className="text-lg font-black tracking-tight text-slate-950">iMIDI<span className="text-blue-600">.</span></Link>
        <span className="text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-800 px-2 py-1 rounded-md border border-slate-300">Menu</span>
      </div>

      {/* SOLID OVERLAY FOR ACCOUNT DRAWER */}
      <div className={`md:hidden fixed inset-0 bg-slate-950/40 z-40 transition-opacity duration-300 ${isMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`} onClick={() => setIsMenuOpen(false)} />

      {/* MOBILE NAV: THE HIGH-CONTRAST SNAP DOCK */}
      <nav className={`md:hidden fixed bottom-5 inset-x-4 z-50 transition-all duration-300 ${isVisible ? "translate-y-0 opacity-100" : "translate-y-28 opacity-0 pointer-events-none"}`}>
        <div className="bg-white border-2 border-slate-950 rounded-2xl p-1.5 shadow-[0_12px_24px_rgba(0,0,0,0.15)] overflow-hidden">
          
          {/* POP-UP CONT CONTRASTAT */}
          <div className={`transition-all duration-300 overflow-hidden ${isMenuOpen ? "max-h-24 opacity-100 mb-2 p-1" : "max-h-0 opacity-0 pointer-events-none"}`}>
            <div className="grid grid-cols-2 gap-2 border-b-2 border-dashed border-slate-200 pb-2">
              <Link href="/login" className="text-center py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider text-slate-900 bg-slate-100 border-2 border-slate-950 active:bg-slate-200 transition-all">Sign In</Link>
              <Link href="/register" className="text-center py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider bg-blue-600 text-white border-2 border-slate-950 active:bg-blue-700 transition-all shadow-md">Get Started</Link>
            </div>
          </div>

          {/* RÂNDUL DE NAVIGARE CU EFECT HIGH-CONTRAST SELECT */}
          <div className="flex items-center justify-between relative">
            {links.map((l) => {
              const cur = pathname === l.href;
              return (
                <Link key={l.href} href={l.href} className="flex flex-col items-center justify-center py-1.5 flex-1 relative group active:scale-95 transition-transform">
                  {/* Pastila activă de fundal este acum solidă, cu contrast maxim */}
                  <div className={`p-2 rounded-xl transition-all duration-200 ${cur ? 'text-white bg-slate-950 scale-105 shadow-sm' : 'text-slate-500 hover:text-slate-950'}`}>
                    <svg fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d={l.icon} />
                    </svg>
                  </div>
                  <span className={`text-[8px] font-black uppercase tracking-wider mt-1 transition-colors duration-200 ${cur ? 'text-slate-950' : 'text-slate-400'}`}>
                    {l.label === "Market" ? "Market" : l.label}
                  </span>
                  {l.isNew && !cur && (
                    <span className="absolute top-1.5 right-4 px-1 py-0.2 text-[6px] font-black bg-emerald-600 text-white rounded">NEW</span>
                  )}
                </Link>
              );
            })}

            {/* BUTON CONT ANIMAT PRIN ROTAȚIE ȘI CONTRAST INVERSAT */}
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)} 
              className={`flex flex-col items-center justify-center py-1.5 flex-1 focus:outline-none transition-transform`}
            >
              <div className={`p-2 rounded-xl transition-all duration-200 ${isMenuOpen ? 'bg-blue-600 text-white scale-105 rotate-90' : 'bg-slate-100 text-slate-950 border border-slate-300'}`}>
                <svg fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4">
                  {isMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  )}
                </svg>
              </div>
              <span className={`text-[8px] font-black uppercase tracking-wider mt-1 ${isMenuOpen ? "text-blue-600" : "text-slate-400"}`}>
                {isMenuOpen ? "Close" : "Account"}
              </span>
            </button>
          </div>

        </div>
      </nav>
    </>
  );
}
