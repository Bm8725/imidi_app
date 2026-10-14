"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

const DISMISS_KEY = "airlink-teaser-dismissed";

export default function AirLinkLauncher() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [dismissed, setDismissed] = useState(true); // start hidden until storage is read
  const [isExpandingTeaser, setIsExpandingTeaser] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const rememberDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* storage unavailable */
    }
  };

  // read once whether the teaser was already dismissed in this session
  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  // Widget transformation loop (Circle -> Pill with "use client" -> Circle)
  useEffect(() => {
    if (open || dismissed) {
      setIsExpandingTeaser(false);
      return;
    }

    let alive = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (fn: () => void, ms: number) => {
      timers.push(setTimeout(() => alive && fn(), ms));
    };

    const cycle = () => {
      // Step 1: Expand into pill showing "use client"
      setIsExpandingTeaser(true);
      
      // Step 2: After 5 seconds, shrink back down to a circle
      later(() => {
        setIsExpandingTeaser(false);
      }, 5000);

      // Step 3: Wait 8 seconds in circle mode before transforming again
      later(() => {
        cycle();
      }, 5000 + 8000);
    };

    // First animation triggers after 3.5 seconds
    later(cycle, 3500);

    return () => {
      alive = false;
      timers.forEach(clearTimeout);
    };
  }, [open, dismissed]);

  // know if the user is signed in
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      setSignedIn(!!session)
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  // close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // close when navigating
  useEffect(() => setOpen(false), [pathname]);

  // don't show on the AirMIDI page itself
  if (pathname?.startsWith("/airmidi-link")) return null;

  return (
    <div ref={wrapRef} className="fixed left-4 md:left-5 bottom-[calc(6rem+env(safe-area-inset-bottom))] md:bottom-5 z-[60] flex flex-col items-start gap-3 select-none">
      <style>{`
        @keyframes al-pop { from { opacity: 0; transform: translateY(10px) scale(.96); } to { opacity: 1; transform: none; } }
        .al-pop { animation: al-pop .28s cubic-bezier(.2,.8,.2,1) both; transform-origin: bottom left; }
        
        @keyframes al-sonar {
          0% { transform: scale(1); opacity: 0.5; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        .al-sonar { animation: al-sonar 2s cubic-bezier(0.16, 1, 0.3, 1) infinite; }
        
        @media (prefers-reduced-motion: reduce) { .al-pop, .al-sonar { animation: none; } }
      `}</style>

      {/* Dialog/Popup Menu */}
      {open && (
        <div
          role="dialog"
          aria-label="AirLink"
          className="al-pop w-[min(300px,calc(100vw-2.5rem))] bg-white/95 backdrop-blur-xl border border-zinc-200 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden"
        >
          <div className="px-5 pt-5 pb-4 bg-gradient-to-br from-indigo-50 via-violet-50 to-white border-b border-zinc-100">
            <div className="flex items-start justify-between">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/airlink-icon.png" alt="" width={40} height={40} className="w-10 h-10 rounded-xl shadow-md shadow-indigo-500/30" draggable={false} />
              <button
                onClick={() => setOpen(false)}
                className="text-zinc-400 hover:text-zinc-700 transition-colors text-sm"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <h3 className="mt-3 text-sm font-extrabold text-zinc-900">AirMIDI Link</h3>
            <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
              Stream MIDI from a USB adapter to any device, live and peer-to-peer.
            </p>
          </div>

          <div className="px-5 py-4 space-y-3">
            <ul className="space-y-2 text-xs text-zinc-600">
              {[
                "Detects your USB MIDI adapter",
                "Pair with a 6-digit code",
                "Encrypted WebRTC transport",
              ].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                  {t}
                </li>
              ))}
            </ul>

            <Link
              href="/airmidi-link"
              className="group w-full h-10 bg-black text-white text-xs font-bold uppercase tracking-widest rounded-xl hover:bg-neutral-800 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
            >
              {signedIn ? "Open AirMIDI Link" : "Sign in to continue"}
              <span className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
            </Link>
          </div>
        </div>
      )}

      {/* Interactive Transforming Trigger Button */}
      <div className="relative">
        {/* Sonar Glow Effect - only active when closed and expanding */}
        {!open && isExpandingTeaser && (
          <div className="al-sonar absolute inset-0 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-full pointer-events-none" />
        )}
        
        <button
          onClick={() => {
            setOpen((v) => !v);
            rememberDismiss();
          }}
          aria-label={open ? "Close AirLink" : "Open AirLink"}
          aria-expanded={open}
          className={`relative h-14 rounded-full shadow-lg transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1) flex items-center shadow-indigo-500/20 overflow-hidden ${
            open 
              ? "w-14 bg-zinc-900 text-white justify-center shadow-zinc-950/20" 
              : isExpandingTeaser 
                ? "w-44 bg-gradient-to-br from-indigo-600 via-indigo-500 to-violet-600 text-white px-4 justify-between"
                : "w-14 bg-gradient-to-br from-indigo-600 via-indigo-500 to-violet-600 text-white justify-center hover:scale-105 active:scale-95"
          }`}
        >
          {open ? (
            /* Closed state icon (X) */
            <svg className="w-5 h-5 min-w-[20px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            /* Default State & Dynamic Transformation */
            <>
              {/* Left element: The Main Icon */}
              <div className="flex items-center justify-center min-w-[24px]">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>

              {/* Center element: Revealed text code string */}
              <div 
                className={`text-[12px] font-mono font-bold tracking-tight whitespace-nowrap transition-all duration-300 delay-100 flex items-center gap-1.5 ${
                  isExpandingTeaser ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 pointer-events-none absolute"
                }`}
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                </span>
                "use client";
              </div>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
