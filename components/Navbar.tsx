'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
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

  const desktopLinks = [
    { href: "/ts4x", label: "try_ts4x", type: "bolt" },
    { href: "/download", label: "download", type: "arrow-down" },
    { href: "/mycloud", label: "mySpace", type: "cloud" },
  ];

  const mobileLinks = [
    { href: "/", label: "home", type: "home" },
    { href: "/ts4x", label: "try_ts4x", type: "bolt" },
    { href: "/download", label: "download", type: "arrow-down" },
    { href: "/mycloud", label: "mySpace", type: "cloud" },
  ];

  const Icon = ({ type, isActive }: { type: string; isActive: boolean }) => {
    const strokeColor = isActive ? "#f43f5e" : "#a1a1aa"; 
    const className = `w-5 h-5 transition-all duration-300 ${isActive ? "drop-shadow-[0_0_8px_#f43f5e]" : ""}`;

    if (type === "home") {
      return (
        <svg xmlns="http://w3.org" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke={strokeColor} className={className}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
        </svg>
      );
    }
    if (type === "bolt") {
      return (
        <svg xmlns="http://w3.org" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke={strokeColor} className={className}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
        </svg>
      );
    }
    if (type === "arrow-down") {
      return (
        <svg xmlns="http://w3.org" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke={strokeColor} className={className}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
      );
    }
    if (type === "cloud") {
      return (
        <svg xmlns="http://w3.org" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke={strokeColor} className={className}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
        </svg>
      );
    }
    return null;
  };

  return (
    <>
      {/* ========================================================================= */}
      {/* 1. NAVBAR DESKTOP                                                         */}
      {/* ========================================================================= */}
      <div 
        className={`hidden md:flex fixed top-5 left-0 right-0 z-50 w-full justify-center px-4 select-none pointer-events-none transition-transform duration-300 ease-in-out ${
          isVisible ? "translate-y-0" : "-translate-y-28"
        }`}
      >
        <nav className="w-full max-w-6xl h-20 bg-black/60 border border-white/[0.06] backdrop-blur-xl rounded-full flex items-center justify-between px-10 pointer-events-auto transition-all duration-500 hover:border-orange-500/30 hover:shadow-[0_0_60px_-10px_rgba(249,115,22,0.2)] group relative overflow-hidden">
          <div className="flex items-center gap-8 z-10">
            <Link href="/" className="font-sans font-black tracking-tight text-white text-xl uppercase flex items-center gap-3.5 group/logo">
              <div className="relative w-4 h-4 flex items-center justify-center">
                <span className="absolute inset-0 bg-orange-500 rotate-45 rounded-[2px] blur-[3px] opacity-50 group-hover/logo:opacity-100 transition-opacity" />
                <span className="w-full h-full bg-gradient-to-tr from-orange-500 via-amber-400 to-white rotate-45 block rounded-[2px] shadow-[0_0_12px_rgba(249,115,22,0.8)] transition-transform duration-1000 group-hover/logo:rotate-[225deg]" />
              </div>
              <span className="tracking-[-0.03em] bg-clip-text text-transparent bg-gradient-to-b from-white to-zinc-400 group-hover/logo:to-orange-200 transition-colors">
                iMIDI
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-3 z-10">
            {desktopLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative h-12 px-6 flex items-center justify-center text-[13px] font-mono tracking-widest uppercase transition-all duration-300 rounded-full active:scale-95 ${
                    isActive ? "text-orange-400 font-bold bg-white/[0.04] border border-white/[0.12]" : "text-zinc-300 hover:text-white hover:bg-white/[0.03]"
                  }`}
                >
                  <span className="mr-2.5 flex items-center justify-center scale-90">
                    <Icon type={link.type} isActive={isActive} />
                  </span>
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>

      {/* ========================================================================= */}
      {/* 2. LOGO FLOATING TOP MOBILE                                               */}
      {/* ========================================================================= */}
      <div className="md:hidden fixed top-4 left-0 right-0 z-50 w-full flex justify-center px-6 pointer-events-none select-none">
        <div className="h-10 px-5 bg-black/40 border border-white/[0.04] backdrop-blur-md rounded-full flex items-center justify-center pointer-events-auto">
          <span className="font-sans font-black tracking-wider text-white text-xs uppercase">iMIDI</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. MENU JOS MOBILE                                                        */}
      {/* ========================================================================= */}
      <div 
        className={`md:hidden fixed bottom-5 left-0 right-0 z-50 w-full flex justify-center px-5 select-none pointer-events-none transition-transform duration-300 ease-in-out ${
          isVisible ? "translate-y-0" : "translate-y-28"
        }`}
      >
        <nav className="w-full max-w-sm h-16 bg-neutral-900/90 border border-zinc-800 backdrop-blur-2xl rounded-xl flex items-center justify-between px-2 pointer-events-auto shadow-[0_10px_30px_rgba(0,0,0,0.8)] relative overflow-hidden">
          {mobileLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex flex-col items-center justify-center gap-0.5 w-[20vw] max-w-[75px] h-13 rounded-lg transition-all duration-300 active:scale-90 relative overflow-hidden ${
                  isActive ? "text-fuchsia-400 font-bold" : "text-zinc-400"
                }`}
              >
                {isActive && (
                  <span className="absolute inset-0 bg-gradient-to-t from-fuchsia-500/10 via-fuchsia-500/[0.02] to-transparent pointer-events-none rounded-lg animate-[pulse_2s_infinite]" />
                )}

                <span 
                  className={`absolute bottom-0 h-[2px] bg-fuchsia-500 rounded-full shadow-[0_0_8px_#f43f5e] transition-all duration-300 ease-out ${
                    isActive ? "w-4 opacity-100" : "w-0 opacity-0"
                  }`} 
                />

                <div className={`transition-all duration-300 ${isActive ? "-translate-y-1 scale-110" : "scale-95 opacity-70"}`}>
                  <Icon type={link.type} isActive={isActive} />
                </div>
                
                <span className={`text-[9px] font-mono tracking-wide uppercase transition-colors duration-300 ${isActive ? "text-fuchsia-400" : "text-zinc-500"}`}>
                  {link.label.replace('try_', '')}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
