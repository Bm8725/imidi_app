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
  const [dismissed, setDismissed] = useState(true);
  const [teaser, setTeaser] = useState({ show: false, typing: false, idx: 0 });
  const [activeConnections, setActiveConnections] = useState<number>(0);
  
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const idxRef = useRef(0);

  const rememberDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch (e) {
      console.warn("Storage unavailable", e);
    }
  };

  // 1. REALTIME SUBSCRIPTION FOR LIVE OPEN STREAMS
  useEffect(() => {
    const fetchInitialCount = async () => {
      const { count, error } = await supabase
        .from("airmidi_links")
        .select("*", { count: "exact", head: true })
        .not("connected_at", "is", null)
        .is("ended_at", null);
      
      if (!error && count !== null) {
        setActiveConnections(count);
      }
    };

    fetchInitialCount();

    const channel = supabase
      .channel("public:airmidi_links_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "airmidi_links" },
        () => { fetchInitialCount(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // 2. CHECK DISMISSAL STATE ON COMPONENT MOUNT
  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  // 3. TEASER MESSAGES ROTATION ENGINE
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
      
      later(() => { setTeaser({ show: true, typing: false, idx }); }, 900);
      later(() => { setTeaser({ show: false, typing: false, idx }); }, 5700);
      later(() => {
        idxRef.current = (idx + 1) % MESSAGES.length;
        cycle();
      }, 11200);
    };
    
    later(cycle, 3500);
    return () => {
      alive = false;
      timers.forEach(clearTimeout);
    };
  }, [open, dismissed]);

  // 4. SUPABASE USER AUTHENTICATION STATE TRACKING
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSignedIn(!!data.session); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setSignedIn(!!session);
    });
    return () => { sub.subscription.unsubscribe(); };
  }, []);

  // 5. EVENT LISTENERS FOR CLOSING DIALOG ON OUTSIDE CLICK AND ESCAPE
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // 6. AUTO-CLOSE ON ROUTE NAVIGATION CHANGED
  useEffect(() => { setOpen(false); }, [pathname]);

  if (pathname?.startsWith("/airmidi-link")) return null;

  return (
    <div 
      ref={wrapRef} 
      className="fixed left-4 md:left-5 bottom-[calc(2rem+env(safe-area-inset-bottom))] md:bottom-5 z-[9999] flex flex-col-reverse items-start gap-4 select-none pointer-events-none"
    >
      {/* BUTONUL PRINCIPAL (Rămâne mereu la bază) */}
      <div className="relative flex items-center gap-3 pointer-events-auto">
        {open && <div className="absolute -inset-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 rounded-full blur opacity-40 animate-pulse -z-10" />}

        <button
          onClick={() => { setOpen((v) => !v); rememberDismiss(); }}
          className={`relative w-14 h-14 rounded-full shadow-xl border border-zinc-100 flex items-center justify-center overflow-hidden transition-all duration-200 active:scale-95 ${open ? "bg-gradient-to-br from-indigo-600 to-violet-600" : "bg-white"}`}
        >
          {!open && <span className="absolute animate-ping inline-flex h-full w-full rounded-full bg-indigo-400/20 opacity-75" />}
          <img src="/airlink-icon.png" alt="" width={56} height={56} className={`w-full h-full object-cover transition-transform duration-300 ${open ? "scale-90 rotate-6" : ""}`} draggable={false} />
          {activeConnections > 0 && !open && (
            <span className="absolute top-1 right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border border-white"></span>
            </span>
          )}
        </button>

        {teaser.show && (
          <div className="bg-white px-3 py-2 rounded-xl shadow-md border border-zinc-100 text-xs text-zinc-700 max-w-[200px] relative transition-all duration-200">
            {activeConnections > 0 && <span className="absolute -top-2 -right-2 bg-emerald-500 text-white font-black text-[8px] px-1.5 py-0.5 rounded-full uppercase tracking-wider animate-bounce">Live</span>}
            {teaser.typing ? (
              <div className="flex gap-1 py-1">
                <span className="animate-bounce w-1 h-1 bg-zinc-400 rounded-full [animation-delay:-0.3s]" />
                <span className="animate-bounce w-1 h-1 bg-zinc-400 rounded-full [animation-delay:-0.15s]" />
                <span className="animate-bounce w-1 h-1 bg-zinc-400 rounded-full" />
              </div>
            ) : MESSAGES[teaser.idx]}
          </div>
        )}
      </div>

      {/* DIALOGUL PRINCIPAL (Se deschide în sus, deasupra butonului) */}
      {open && (
        <div role="dialog" className="pointer-events-auto transition-all duration-300 transform scale-100 origin-bottom-left w-[min(300px,calc(100vw-2.5rem))] bg-white/95 backdrop-blur-xl border border-zinc-200 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden">
          <div className="px-5 pt-5 pb-4 bg-gradient-to-br from-indigo-50 via-violet-50 to-white border-b border-zinc-100">
            <div className="flex items-start justify-between">
              <img src="/airlink-icon.png" alt="" width={40} height={40} className="w-10 h-10 rounded-xl shadow-md shadow-indigo-500/30" draggable={false} />
              <button onClick={() => setOpen(false)} className="text-zinc-400 hover:text-zinc-700 transition-colors text-sm">✕</button>
            </div>
            <h3 className="mt-3 text-sm font-extrabold text-zinc-900">AirMIDI Link</h3>
            <p className="text-xs text-zinc-500 mt-1 leading-relaxed">Stream MIDI from a USB adapter to any device, live and peer-to-peer.</p>
          </div>

          <div className="px-5 py-4 space-y-3">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-50/50 border border-emerald-100 w-fit">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                {activeConnections} {activeConnections === 1 ? "active stream" : "active streams"} now
              </span>
            </div>

            <ul className="space-y-2 text-xs text-zinc-600">
              {["Detects your USB MIDI adapter", "Pair with a 6-digit code", "Encrypted WebRTC transport"].map((textItem) => (
                <li key={textItem} className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 text-[10px]">✓</span>
                  {textItem}
                </li>
              ))}
            </ul>

            <Link href="/airmidi-link" className="group w-full h-10 bg-black text-white text-xs font-bold uppercase tracking-widest rounded-xl hover:bg-neutral-800 transition-all flex items-center justify-center gap-1.5">
              {signedIn ? "Open AirMIDI Link" : "Sign in to continue"} →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
