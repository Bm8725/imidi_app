"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

const MESSAGES = [
  "Hey 👋 Meet AirMIDI Link",
  "Try new tech: MIDI over the cloud ☁️",
  "Stream your USB MIDI anywhere 🎹",
  "Pair any device with a 6-digit code ⚡",
  "No cables between you and your band 🎶",
];

const DISMISS_KEY = "airlink-teaser-dismissed";

export default function AirLinkLauncher() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [dismissed, setDismissed] = useState(true); // start hidden until storage is read
  const [teaser, setTeaser] = useState({ show: false, typing: false, idx: 0 });
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const idxRef = useRef(0);

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

  // teaser loop: typing dots -> message -> hide -> next message
  useEffect(() => {
    if (open || dismissed) {
      setTeaser((t) => ({ ...t, show: false, typing: false }));
      return;
    }
    let alive = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (fn: () => void, ms: number) => {
      timers.push(setTimeout(() => alive && fn(), ms));
    };
    const cycle = () => {
      const idx = idxRef.current;
      setTeaser({ show: true, typing: true, idx });
      later(() => setTeaser({ show: true, typing: false, idx }), 900);
      later(() => setTeaser({ show: false, typing: false, idx }), 900 + 4800);
      later(() => {
        idxRef.current = (idx + 1) % MESSAGES.length;
        cycle();
      }, 900 + 4800 + 5500);
    };
    later(cycle, 3500);
    return () => {
      alive = false;
      timers.forEach(clearTimeout);
    };
  }, [open, dismissed]);

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
    <div ref={wrapRef} className="fixed left-4 md:left-5 bottom-[calc(6rem+env(safe-area-inset-bottom))] md:bottom-5 z-[60] flex flex-col items-start gap-3">
      <style>{`
        @keyframes al-pop { from { opacity: 0; transform: translateY(10px) scale(.96); } to { opacity: 1; transform: none; } }
        .al-pop { animation: al-pop .28s cubic-bezier(.2,.8,.2,1) both; transform-origin: bottom left; }
        @keyframes al-ring { 0% { transform: scale(.9); opacity: .5; } 100% { transform: scale(1.8); opacity: 0; } }
        .al-ring { animation: al-ring 2.4s ease-out infinite; }
        @keyframes al-wiggle { 0%,100% { transform: rotate(0) translateY(0); } 20% { transform: rotate(-10deg) translateY(-4px); } 40% { transform: rotate(8deg) translateY(-2px); } 60% { transform: rotate(-5deg) translateY(-3px); } 80% { transform: rotate(3deg); } }
        .al-wiggle { animation: al-wiggle .8s ease-in-out; }
        @keyframes al-fade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
        .al-fade { animation: al-fade .35s ease-out both; }
        @keyframes al-badge { 0% { transform: scale(0); } 70% { transform: scale(1.25); } 100% { transform: scale(1); } }
        .al-badge { animation: al-badge .4s cubic-bezier(.2,.8,.2,1) both; }
        @keyframes al-typing { 0%,80%,100% { opacity: .25; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-3px); } }
        .al-typing { animation: al-typing 1s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .al-pop, .al-ring, .al-wiggle, .al-fade, .al-badge, .al-typing { animation: none; } }
      `}</style>

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

      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            setOpen((v) => !v);
            rememberDismiss(); // once opened, stop teasing for this session
          }}
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
            <img
              key={teaser.typing ? `w-${teaser.idx}` : "idle"}
              src="/airlink-icon.png"
              alt="AirLink"
              width={56}
              height={56}
              className={`relative w-14 h-14 rounded-full select-none ${teaser.show && teaser.typing ? "al-wiggle" : ""}`}
              draggable={false}
            />
          )}
          {/* notification badge */}
          {!open && teaser.show && (
            <span className="al-badge absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-pink-500 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-white">
              1
            </span>
          )}
        </button>

        {/* teaser bubble */}
        <div
          aria-live="polite"
          className={`relative origin-left transition-all duration-500 ease-out ${
            teaser.show && !open
              ? "opacity-100 translate-x-0 scale-100"
              : "opacity-0 -translate-x-3 scale-90 pointer-events-none"
          }`}
        >
          <span className="absolute -left-1 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rotate-45 bg-white border-l border-b border-zinc-200" />
          <div className="relative flex items-center gap-1 pl-4 pr-2 py-2.5 rounded-2xl bg-white border border-zinc-200 shadow-[0_10px_30px_rgba(79,70,229,0.18)] max-w-[min(240px,calc(100vw-7rem))]">
            <button
              onClick={() => {
                setOpen(true);
                rememberDismiss();
              }}
              className="text-left min-h-[1rem]"
            >
              {teaser.typing ? (
                <span className="flex items-center gap-1 py-1">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      style={{ animationDelay: `${i * 0.15}s` }}
                      className="al-typing w-1.5 h-1.5 rounded-full bg-indigo-500"
                    />
                  ))}
                </span>
              ) : (
                <span key={teaser.idx} className="al-fade block text-xs font-semibold text-zinc-800 leading-snug">
                  {MESSAGES[teaser.idx]}
                </span>
              )}
            </button>
            <button
              onClick={rememberDismiss}
              aria-label="Dismiss"
              className="text-zinc-300 hover:text-zinc-600 transition-colors text-[11px] px-1.5 self-start"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}