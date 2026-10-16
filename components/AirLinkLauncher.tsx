'use client';

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
  const [teaser, setTeaser] = useState({ show: false, typing: false, text: "" });
  const [liveCount, setLiveCount] = useState<number>(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const idxRef = useRef(0);

  // 1. Interogare live count bazat pe indexul tău parțial
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

  // 2. Realtime Postgres Subscriptions
  useEffect(() => {
    fetchLiveCount();
    const channel = supabase
      .channel('airmidi-links-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'airmidi_links' }, fetchLiveCount)
      .subscribe();

    try { setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1"); } catch { setDismissed(false); }
    return () => { supabase.removeChannel(channel); };
  }, []);

  // 3. Buclă Teaser: mesaje sporadice + statistici live (40% șanse)
  useEffect(() => {
    if (open || dismissed) { setTeaser({ show: false, typing: false, text: "" }); return; }
    let alive = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (fn: () => void, ms: number) => timers.push(setTimeout(() => alive && fn(), ms));

    const cycle = () => {
      const idx = idxRef.current;
      let text = MESSAGES[idx];
      if (liveCount > 0 && Math.random() > 0.6) {
        text = `🔥 ${liveCount} ${liveCount === 1 ? 'person is' : 'people are'} live streaming MIDI right now!`;
      }
      setTeaser({ show: true, typing: true, text });
      later(() => setTeaser({ show: true, typing: false, text }), 900);
      later(() => setTeaser({ show: false, typing: false, text }), 5700);
      later(() => { idxRef.current = (idx + 1) % MESSAGES.length; cycle(); }, 11200);
    };

    later(cycle, 3500);
    return () => { alive = false; timers.forEach(clearTimeout); };
  }, [open, dismissed, liveCount]);

  // Auth Status & Listeners
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_, session) => setSignedIn(!!session));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Click Outside / Escape / Navigation Events
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onClick); document.removeEventListener("keydown", onKey); };
  }, [open]);

  useEffect(() => setOpen(false), [pathname]);

  if (pathname?.startsWith("/airmidi-link")) return null;

  return (
    <div ref={wrapRef} className="fixed left-4 md:left-5 bottom-[calc(6rem+env(safe-area-inset-bottom))] md:bottom-5 z-[60] flex flex-col items-start gap-3 select-none">
      
      {/* 💬 Teaser Bubble */}
      {teaser.show && (
        <div className="max-w-[240px] px-3.5 py-2.5 bg-[#18181C]/90 backdrop-blur-md border border-indigo-500/30 rounded-xl shadow-lg text-white text-xs font-medium">
          {teaser.typing ? (
            <div className="flex gap-1 py-1 items-center">
              <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-[bounce_1s_infinite_100ms]"></span>
              <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-[bounce_1s_infinite_200ms]"></span>
              <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-[bounce_1s_infinite_300ms]"></span>
            </div>
          ) : ( <p className="leading-normal">{teaser.text}</p> )}
        </div>
      )}

      {/* 📦 Main Dialog Window */}
      {open && (
        <div role="dialog" className="w-[min(300px,calc(100vw-2.5rem))] bg-white/95 backdrop-blur-xl border border-zinc-200 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden">
          <div className="px-5 pt-5 pb-4 bg-gradient-to-br from-indigo-50 via-violet-50 to-white border-b border-zinc-100">
            <div className="flex items-start justify-between">
              <img src="/airlink-icon.png" alt="" className="w-10 h-10 rounded-xl shadow-md shadow-indigo-500/30 object-contain" draggable={false} />
              <button onClick={() => setOpen(false)} className="text-zinc-400 hover:text-zinc-700 text-sm p-1">✕</button>
            </div>
            <h3 className="mt-3 text-sm font-extrabold text-zinc-900">AirMIDI Link</h3>
            <p className="text-xs text-zinc-500 mt-1 leading-relaxed">Stream MIDI from a USB adapter to any device, live and peer-to-peer.</p>
            {liveCount > 0 && (
              <span className="inline-flex items-center gap-1.5 mt-2.5 px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>{liveCount} Active {liveCount === 1 ? 'Stream' : 'Streams'}
              </span>
            )}
          </div>
          <div className="px-5 py-4 space-y-3 text-xs text-zinc-600">
            <ul className="space-y-2">
              {["Detects your USB MIDI adapter", "Pair with a 6-digit code", "Encrypted WebRTC transport"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                  </span>{t}
                </li>
              ))}
            </ul>
            <Link href="/airmidi-link" className="group w-full h-10 bg-black text-white text-[11px] font-bold uppercase tracking-widest rounded-xl hover:bg-neutral-800 flex items-center justify-center gap-1.5">
              {signedIn ? "Open AirMIDI Link" : "Sign in to continue"}<span className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
            </Link>
          </div>
        </div>
      )}

      {/* 🔘 Trigger Button */}
      <button
        onClick={() => { setOpen(!open); setDismissed(true); try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch {} }}
        className="relative w-14 h-14 rounded-full shadow-lg shadow-indigo-500/40 hover:scale-105 active:scale-95 transition-transform duration-200 flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 text-white"
      >
        {liveCount > 0 && !open && (
          <span className="absolute -top-1 -right-1 bg-rose-500 text-white font-bold text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-sm animate-bounce">
            {liveCount}
          </span>
        )}
        <svg className={`w-6 h-6 transition-transform duration-200 ${open ? 'rotate-45' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  );
}
