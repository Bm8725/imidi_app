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
  const [liveCount, setLiveCount] = useState<number>(0); // State pentru contor live
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const idxRef = useRef(0);

  // Calculează numărul de stream-uri active bazat pe indecșii tăi din DB
  const fetchLiveCount = async () => {
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { count, error } = await supabase
      .from('airmidi_links')
      .select('*', { count: 'exact', head: true })
      .not('connected_at', 'is', null)
      .is('ended_at', null)
      .gte('last_heartbeat_at', twoMinutesAgo);

    if (!error && count !== null) setLiveCount(count);
  };

  useEffect(() => {
    fetchLiveCount();
    // Realtime Postgres Subscriptions
    const channel = supabase
      .channel('airmidi-links-changes')
      .on('postgres_changes', { event: '*', scheme: 'public', table: 'airmidi_links' }, fetchLiveCount)
      .subscribe();

    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }

    return () => { supabase.removeChannel(channel); };
  }, []);

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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      setSignedIn(!!session)
    );
    return () => sub.subscription.unsubscribe();
  }, []);

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

  useEffect(() => setOpen(false), [pathname]);

  if (pathname?.startsWith("/airmidi-link")) return null;

  // Intercalează mesajul de live stream printre celelalte mesaje (la index par)
  let activeText = MESSAGES[teaser.idx];
  if (liveCount > 0 && teaser.idx % 2 === 0) {
    activeText = `🔥 ${liveCount} ${liveCount === 1 ? 'person is' : 'people are'} live streaming MIDI right now!`;
  }

  return (
    <div ref={wrapRef} className="fixed left-4 md:left-5 bottom-[calc(6rem+env(safe-area-inset-bottom))] md:bottom-5 z-[60] flex flex-col items-start gap-3 select-none">
      
      {/* Bulă mesaje sporadice */}
      {teaser.show && (
        <div className="animate-[al-fade_0.35s_ease-out_both] max-w-[240px] px-3.5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl shadow-lg text-white font-sans text-xs">
          {teaser.typing ? (
            <div className="flex gap-1 py-1 items-center">
              <span className="animate-[al-typing_1s_ease-in-out_infinite] w-1.5 h-1.5 bg-zinc-400 rounded-full"></span>
              <span className="animate-[al-typing_1s_ease-in-out_infinite_0.2s] w-1.5 h-1.5 bg-zinc-400 rounded-full"></span>
              <span className="animate-[al-typing_1s_ease-in-out_infinite_0.4s] w-1.5 h-1.5 bg-zinc-400 rounded-full"></span>
            </div>
          ) : (
            <p className="leading-normal font-medium">{activeText}</p>
          )}
        </div>
      )}

      {/* Fereastra Dialog */}
      {open && (
        <div role="dialog" aria-label="AirLink" className="animate-[al-pop_0.28s_cubic-bezier(0.2,0.8,0.2,1)_both] origin-bottom-left w-[min(300px,calc(100vw-2.5rem))] bg-white/95 backdrop-blur-xl border border-zinc-200 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden">
          <div className="px-5 pt-5 pb-4 bg-gradient-to-br from-indigo-50 via-violet-50 to-white border-b border-zinc-100">
            <div className="flex items-start justify-between">
              <img src="/airlink-icon.png" alt="" width={40} height={40} className="w-10 h-10 rounded-xl shadow-md shadow-indigo-500/30" draggable={false} />
              <button onClick={() => setOpen(false)} className="text-zinc-400 hover:text-zinc-700 transition-colors text-sm" aria-label="Close">✕</button>
            </div>
            <h3 className="mt-3 text-sm font-extrabold text-zinc-900">AirMIDI Link</h3>
            <p className="text-xs text-zinc-500 mt-1 leading-relaxed">Stream MIDI from a USB adapter to any device, live and peer-to-peer.</p>
            
            {/* Badge live în interiorul ferestrei */}
            {liveCount > 0 && (
              <span className="inline-flex items-center gap-1.5 mt-2.5 px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                {liveCount} Live Now
              </span>
            )}
          </div>

          <div className="px-5 py-4 space-y-3">
            <ul className="space-y-2 text-xs text-zinc-600">
              {["Detects your USB MIDI adapter", "Pair with a 6-digit code", "Encrypted WebRTC transport"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                  </span>
                  {t}
                </li>
              ))}
            </ul>
            <Link href="/airmidi-link" className="group w-full h-10 bg-black text-white text-xs font-bold uppercase tracking-widest rounded-xl hover:bg-neutral-800 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5">
              {signedIn ? "Open AirMIDI Link" : "Sign in to continue"}
              <span className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
            </Link>
          </div>
        </div>
      )}

      {/* Butonul Trigger de jos */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => { setOpen((v) => !v); rememberDismiss(); }}
          aria-label="Open AirLink"
          aria-expanded={open}
          className={`relative w-14 h-14 rounded-full shadow-lg shadow-indigo-500/40 hover:scale-105 active:scale-95 transition-transform duration-200 flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 text-white`}
        >
          {/* Badge roșu cu numărul de oameni conectați peste buton */}
          {liveCount > 0 && !open && (
            <span className="absolute -top-1 -right-1 bg-rose-500 text-white font-bold font-sans text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-sm animate-[al-badge_0.4s_cubic-bezier(0.2,0.8,0.2,1)_both]">
              {liveCount}
            </span>
          )}
          <svg className={`w-6 h-6 transition-transform duration-200 ${open ? 'rotate-45' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>
    </div>
  );
}
