'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setScrolled(currentScrollY > 8);
      
      if (currentScrollY > lastScrollY && currentScrollY > 50) {
        setIsMenuOpen(false);
      }

      if (currentScrollY < 10) {
        setIsVisible(true);
        setLastScrollY(currentScrollY);
        return;
      }
      setIsVisible(currentScrollY <= lastScrollY);
      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  useEffect(() => setIsMenuOpen(false), [pathname]);

  const links = [
    { href: "/", label: "home", icon: "m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21.75h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21.75h2.25" },
    { href: "/ts4x", label: "try_ts4x", icon: "m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" },
    { href: "/download", label: "download", icon: "M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" },
    { href: "/mycloud", label: "mySpace", icon: "M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" },
  ];

  const Icon = ({ path, active }: { path: string; active: boolean }) => (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke={active ? "#FF5CA1" : "#8A8A93"} className={`w-5 h-5 transition-all duration-300 ${active ? "drop-shadow-[0_0_8px_rgba(255,92,161,0.6)]" : ""}`}>
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  );

  return (
    <>
      {/* ========================================================================= */}
      {/* BARĂ SUS: VALABILĂ PE DESKTOP ȘI PE MOBILE (iMIDI + HAMBURGER PE MOB)      */}
      {/* ========================================================================= */}
      <nav
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          isVisible ? "translate-y-0" : "-translate-y-full"
        } ${
          scrolled 
            ? "bg-black/90 backdrop-blur-2xl border-b border-neutral-800/80 shadow-[0_4px_30px_rgba(0,0,0,0.5)]" 
            : "bg-black/40 backdrop-blur-xl border-b border-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          
          {/* BRANDING */}
          <Link href="/" className="text-xl font-black tracking-wider text-white">
            iMIDI<span className="text-[#FF5CA1]">.</span>
          </Link>

          {/* DESKTOP ONLY: LINK-URI DE NAVIGARE */}
          <div className="hidden md:flex items-center space-x-1 bg-neutral-900/60 p-1.5 rounded-full border border-neutral-800/60 backdrop-blur-md">
            {links.slice(1).map((link) => (
              <Link 
                key={link.href} 
                href={link.href} 
                className={`flex items-center space-x-2 px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wider transition-all ${
                  pathname === link.href ? "bg-white text-black" : "text-neutral-400 hover:text-white"
                }`}
              >
                <Icon path={link.icon} active={pathname === link.href} />
                <span>{link.label}</span>
              </Link>
            ))}
          </div>

          {/* DESKTOP ONLY: AUTENTIFICARE */}
          <div className="hidden md:flex items-center space-x-4">
            <Link href="/login" className="text-xs font-bold uppercase tracking-wider text-neutral-400 hover:text-white">
              Sign In
            </Link>
            <Link href="/register" className="text-xs font-bold uppercase tracking-wider bg-white text-black px-5 py-2.5 rounded-full hover:bg-[#FF5CA1] hover:text-white transition-all shadow-md">
              Get Started
            </Link>
          </div>

          {/* MOBILE ONLY: BUTON HAMBURGER CU 3 LINII PENTRU LOGIN */}
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)} 
            className="md:hidden flex items-center justify-center w-10 h-10 rounded-xl bg-neutral-900/80 border border-neutral-800/80 focus:outline-none shadow-inner"
            aria-label="Toggle login menu"
          >
            <div className="w-5 h-5 flex flex-col justify-center items-center relative">
              <span className={`w-5 h-0.5 bg-neutral-200 rounded transition-all duration-300 absolute ${isMenuOpen ? "rotate-45 bg-[#FF5CA1]" : "-translate-y-1.5"}`} />
              <span className={`w-5 h-0.5 bg-neutral-200 rounded transition-all duration-300 absolute ${isMenuOpen ? "opacity-0" : ""}`} />
              <span className={`w-5 h-0.5 bg-neutral-200 rounded transition-all duration-300 absolute ${isMenuOpen ? "-rotate-45 bg-[#FF5CA1]" : "translate-y-1.5"}`} />
            </div>
          </button>

        </div>
      </nav>

      {/* ========================================================================= */}
      {/* MOBILE ONLY: SERTAR PENTRU LOGIN (APARE SUB BARA DE SUS)                 */}
      {/* ========================================================================= */}
      <div 
        className={`md:hidden fixed inset-0 bg-black/70 backdrop-blur-xs z-40 transition-opacity duration-300 ${
          isMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`} 
        onClick={() => setIsMenuOpen(false)} 
      />
      
      <div
        className={`md:hidden fixed top-24 inset-x-4 bg-neutral-950/95 border border-neutral-800/90 p-5 rounded-2xl z-40 shadow-2xl transition-all duration-300 ease-out transform ${
          isMenuOpen ? "translate-y-0 opacity-100 scale-100" : "-translate-y-4 opacity-0 scale-95 pointer-events-none"
        }`}
      >
        <div className="text-center mb-4">
          <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">iMIDI Account</p>
        </div>
        <div className="flex flex-col space-y-2.5">
          <Link
            href="/login"
            className="w-full text-center py-3 rounded-xl font-bold text-xs uppercase tracking-wider text-white bg-neutral-900 border border-neutral-800 active:bg-neutral-800"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="w-full text-center py-3 rounded-xl font-bold text-xs uppercase tracking-wider bg-[#FF5CA1] text-white active:bg-[#e04b8b] shadow-lg"
          >
            Create Free Account
          </Link>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MOBILE ONLY: BARA DE JOS (NAVIGARE CLASICĂ PRIN SITE)                     */}
      {/* ========================================================================= */}
      <nav
        className={`md:hidden fixed bottom-4 inset-x-4 z-40 transition-all duration-300 ${
          isVisible ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0"
        }`}
      >
        <div className="bg-neutral-950/90 backdrop-blur-xl border border-neutral-800/80 rounded-2xl px-2 py-2.5 flex items-center justify-between shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
          {links.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="flex flex-col items-center justify-center flex-1 py-1"
              >
                <Icon path={link.icon} active={isActive} />
                <span className={`text-[9px] mt-1 font-bold uppercase tracking-wider transition-colors ${isActive ? "text-[#FF5CA1]" : "text-neutral-500"}`}>
                  {link.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
