"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AirLinkLauncher() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // know if the user is signed in (only changes the button label)
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
    <div ref={wrapRef} className="fixed right-4 top-1/2 -translate-y-1/2 z-[60] flex flex-row items-center gap-3">
      <style>{`
        @keyframes al-pop { from { opacity: 0; transform: translateY(10px) scale(.96); } to { opacity: 1; transform: none; } }
        .al-pop { animation: al-pop .28s cubic-bezier(.2,.8,.2,1) both; transform-origin: center right; }
        @keyframes al-ring { 0% { transform: scale(.9); opacity: .5; } 100% { transform: scale(1.8); opacity: 0; } }
        .al-ring { animation: al-ring 2.4s ease-out infinite; }
        @media (prefers-reduced-motion: reduce) { .al-pop, .al-ring { animation: none; } }
      `}</style>

      {open && (
        <div
          role="dialog"
          aria-label="AirLink"
          className="al-pop w-[min(300px,calc(100vw-6rem))] bg-white/95 backdrop-blur-xl border border-zinc-200 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden"
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

      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Open AirLink"
        aria-expanded={open}
        className={`relative w-14 h-14 rounded-full shadow-lg shadow-indigo-500/40 hover:scale-105 active:scale-95 transition-transform duration-200 flex items-center justify-center ${
          open ? "bg-gradient-to-br from-indigo-600 to-violet-600 text-white" : ""
        }`}
      >
        {!open && <span className="absolute inset-0 rounded-full bg-indigo-500/40 al-ring" />}
        {open ? (
          <svg className="relative w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/airlink-icon.png" alt="AirLink" width={56} height={56} className="relative w-14 h-14 rounded-full select-none" draggable={false} />
        )}
      </button>
    </div>
  );
}