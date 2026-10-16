"use client";

import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  type CSSProperties,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

/* ───────────────────────── types & constants ───────────────────────── */

type Own = { code: string; live: boolean } | null;

type Stats = {
  live_now: number;
  waiting: number;
  sessions_today: number;
  minutes_today: number;
  own: Own;
};

type Msg = {
  id: string;
  kind: "static" | "live" | "wait" | "stats" | "burst";
  node: ReactNode;
};

const STATIC_MESSAGES = [
  "Hey 👋 Meet AirMIDI Link",
  "Try new tech: MIDI over the cloud ☁️",
  "Stream your USB MIDI anywhere 🎹",
  "Pair any device with a 6-digit code ⚡",
  "No cables between you and your band 🎶",
];

const DISMISS_KEY = "airlink-teaser-dismissed";
const POLL_MS = 20_000; // how often live data is refreshed
const FRESH_MS = 60_000; // heartbeat newer than this = link is live
const PRIORITY_TTL_MS = 30_000; // a "just went live" bubble expires after this

/* ───────────────────────── small helpers ───────────────────────── */

function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      fromRef.current = value;
      setShown(value);
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    const dur = 900;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = Math.round(from + (value - from) * eased);
      fromRef.current = v;
      setShown(v);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <span className="tabular-nums">{shown}</span>;
}

function LiveDot({ color = "emerald", size = 2 }: { color?: "emerald" | "rose"; size?: 1.5 | 2 }) {
  const dim = size === 2 ? "h-2 w-2" : "h-1.5 w-1.5";
  const ping = color === "emerald" ? "bg-emerald-400" : "bg-rose-400";
  const core = color === "emerald" ? "bg-emerald-500" : "bg-rose-500";
  return (
    <span className={`relative flex shrink-0 ${dim}`}>
      <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 motion-safe:animate-ping ${ping}`} />
      <span className={`relative inline-flex rounded-full ${dim} ${core}`} />
    </span>
  );
}

function Stat({ label, value, live }: { label: string; value: number; live?: boolean }) {
  return (
    <div className="rounded-xl bg-zinc-50 border border-zinc-100 px-2 py-2 text-center">
      <div className="flex items-center justify-center gap-1 text-base font-extrabold text-zinc-900">
        {live && value > 0 && <LiveDot size={1.5} />}
        <CountUp value={value} />
      </div>
      <div className="text-[9px] uppercase tracking-widest text-zinc-400 mt-0.5">{label}</div>
    </div>
  );
}

function buildMessages(s: Stats | null): Msg[] {
  const dyn: Msg[] = [];

  if (s) {
    // the user's own link first
    if (s.own) {
      dyn.push(
        s.own.live
          ? { id: `own-live-${s.own.code}`, kind: "live", node: <>Your link <b>{s.own.code}</b> is live 🔴</> }
          : { id: `own-wait-${s.own.code}`, kind: "wait", node: <>Room <b>{s.own.code}</b> is waiting for a device ⚡</> }
      );
    }
    if (s.live_now > 0) {
      dyn.push({
        id: `live-${s.live_now}`,
        kind: "live",
        node: (
          <>
            <b><CountUp value={s.live_now} /></b>{" "}
            {s.live_now === 1 ? "MIDI link is" : "MIDI links are"} live right now
          </>
        ),
      });
    }
    if (s.waiting > 0) {
      dyn.push({
        id: `wait-${s.waiting}`,
        kind: "wait",
        node: (
          <>
            <b><CountUp value={s.waiting} /></b>{" "}
            {s.waiting === 1 ? "device is" : "devices are"} waiting to pair ⚡
          </>
        ),
      });
    }
    if (s.sessions_today > 0) {
      dyn.push({
        id: `today-${s.sessions_today}-${s.minutes_today}`,
        kind: "stats",
        node: (
          <>
            <b><CountUp value={s.sessions_today} /></b>{" "}
            {s.sessions_today === 1 ? "session" : "sessions"} today
            {s.minutes_today > 0 && (
              <>
                {" · "}
                <b><CountUp value={s.minutes_today} /></b> min of music 🎶
              </>
            )}
          </>
        ),
      });
    }
  }

  const stat: Msg[] = STATIC_MESSAGES.map((t, i) => ({ id: `s-${i}`, kind: "static", node: t }));

  // interleave: dynamic, static, dynamic, static...
  const out: Msg[] = [];
  const n = Math.max(dyn.length, stat.length);
  for (let i = 0; i < n; i++) {
    if (dyn[i]) out.push(dyn[i]);
    if (stat[i]) out.push(stat[i]);
  }
  return out;
}

/* ───────────────────────── component ───────────────────────── */

export default function AirLinkLauncher() {
  const pathname = usePathname();
  const hiddenPage = pathname?.startsWith("/airmidi-link") ?? false;

  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [dismissed, setDismissed] = useState(true); // start hidden until storage is read
  const [stats, setStats] = useState<Stats | null>(null);
  const [burstKey, setBurstKey] = useState(0);
  const [teaser, setTeaser] = useState<{ show: boolean; typing: boolean; msg: Msg | null }>({
    show: false,
    typing: false,
    msg: null,
  });

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const idxRef = useRef(0);
  const prevLiveRef = useRef<number | null>(null);
  const prevOwnLiveRef = useRef<boolean | null>(null);
  const priorityRef = useRef<{ msg: Msg; at: number } | null>(null);
  const fastStartRef = useRef(false);

  const messages = useMemo(() => buildMessages(stats), [stats]);
  const messagesRef = useRef<Msg[]>(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

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

  // new data arrived: detect "just went live" -> attention burst
  const applyStats = useCallback((s: Stats) => {
    const prevLive = prevLiveRef.current;
    const prevOwn = prevOwnLiveRef.current;
    prevLiveRef.current = s.live_now;
    prevOwnLiveRef.current = !!s.own?.live;

    let burst: Msg | null = null;
    if (prevOwn !== null && s.own?.live && !prevOwn) {
      burst = {
        id: `burst-own-${Date.now()}`,
        kind: "burst",
        node: <>Your link just connected! 🔴</>,
      };
    } else if (prevLive !== null && s.live_now > prevLive) {
      burst = {
        id: `burst-${Date.now()}`,
        kind: "burst",
        node: (
          <>
            New MIDI link just went live! <b><CountUp value={s.live_now} /></b> online 🔴
          </>
        ),
      };
    }
    if (burst) {
      priorityRef.current = { at: Date.now(), msg: burst };
      fastStartRef.current = true;
      setBurstKey((k) => k + 1);
    }
    setStats(s);
  }, []);

  // poll live data straight from the table (paused when tab hidden / on the AirMIDI page)
  useEffect(() => {
    if (hiddenPage) return;
    let alive = true;

    const load = async () => {
      if (document.hidden) return;
      const now = Date.now();
      const nowIso = new Date(now).toISOString();
      const freshMs = now - FRESH_MS;
      const dayStart = new Date();
      dayStart.setUTCHours(0, 0, 0, 0);

      const [todayRes, waitRes] = await Promise.all([
        supabase
          .from("airmidi_links")
          .select("connected_at, ended_at, duration_seconds, last_heartbeat_at")
          .gte("connected_at", dayStart.toISOString())
          .limit(500),
        supabase
          .from("airmidi_links")
          .select("id", { count: "exact", head: true })
          .is("connected_at", null)
          .is("ended_at", null)
          .gt("expires_at", nowIso),
      ]);

      // both failed (no access / offline): keep whatever we had, stay on static messages
      if (todayRes.error && waitRes.error) return;

      let live = 0;
      let seconds = 0;
      const rows = todayRes.data ?? [];
      for (const r of rows) {
        const start = r.connected_at ? Date.parse(r.connected_at) : NaN;
        if (Number.isNaN(start)) continue;
        const hb = r.last_heartbeat_at ? Date.parse(r.last_heartbeat_at) : NaN;
        if (r.ended_at) {
          seconds += r.duration_seconds ?? Math.max(0, (Date.parse(r.ended_at) - start) / 1000);
        } else {
          if (!Number.isNaN(hb) && hb >= freshMs) live++;
          seconds += Math.max(0, ((Number.isNaN(hb) ? now : hb) - start) / 1000);
        }
      }

      // the signed-in user's own open link (if any)
      let own: Own = null;
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user.id;
      if (uid) {
        const { data: mine } = await supabase
          .from("airmidi_links")
          .select("room_code, connected_at, expires_at, last_heartbeat_at")
          .eq("created_by", uid)
          .is("ended_at", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (mine) {
          const hb = mine.last_heartbeat_at ? Date.parse(mine.last_heartbeat_at) : NaN;
          if (mine.connected_at && !Number.isNaN(hb) && hb >= freshMs) {
            own = { code: mine.room_code, live: true };
          } else if (!mine.connected_at && Date.parse(mine.expires_at) > now) {
            own = { code: mine.room_code, live: false };
          }
        }
      }

      if (!alive) return;
      applyStats({
        live_now: live,
        waiting: waitRes.count ?? 0,
        sessions_today: rows.length,
        minutes_today: Math.round(seconds / 60),
        own,
      });
    };

    load();
    const id = setInterval(load, POLL_MS);
    const onVis = () => {
      if (!document.hidden) load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [hiddenPage, signedIn, applyStats]);

  // teaser loop: typing dots -> message -> hide -> next message
  useEffect(() => {
    if (open || dismissed || hiddenPage) {
      setTeaser((t) => ({ ...t, show: false, typing: false }));
      return;
    }
    let alive = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (fn: () => void, ms: number) => {
      timers.push(setTimeout(() => alive && fn(), ms));
    };

    const cycle = () => {
      let msg: Msg | null = null;
      const p = priorityRef.current;
      priorityRef.current = null;
      if (p && Date.now() - p.at < PRIORITY_TTL_MS) msg = p.msg;

      if (!msg) {
        const list = messagesRef.current;
        msg = list[idxRef.current % list.length];
        idxRef.current = (idxRef.current + 1) % list.length;
      }

      const typingMs = msg.kind === "burst" ? 500 : 900;
      const m = msg;
      setTeaser({ show: true, typing: true, msg: m });
      later(() => setTeaser({ show: true, typing: false, msg: m }), typingMs);
      later(() => setTeaser({ show: false, typing: false, msg: m }), typingMs + 4800);
      later(cycle, typingMs + 4800 + 5500);
    };

    const startDelay = fastStartRef.current ? 300 : 3500;
    fastStartRef.current = false;
    later(cycle, startDelay);

    return () => {
      alive = false;
      timers.forEach(clearTimeout);
    };
  }, [open, dismissed, hiddenPage, burstKey]);

  // know if the user is signed in (changes the button label + own-link lookup)
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
  if (hiddenPage) return null;

  const msg = teaser.msg;
  const isLive = msg?.kind === "live" || msg?.kind === "burst";
  const isBurst = msg?.kind === "burst";
  const showBubble = teaser.show && !open;
  const hasStats =
    !!stats && (stats.live_now > 0 || stats.sessions_today > 0 || stats.minutes_today > 0);

  const particles: { left: string; size: number; dx: string; delay: string }[] = [
    { left: "18%", size: 8, dx: "-10px", delay: "0s" },
    { left: "50%", size: 12, dx: "6px", delay: "0.18s" },
    { left: "74%", size: 6, dx: "14px", delay: "0.36s" },
    { left: "38%", size: 10, dx: "-4px", delay: "0.54s" },
  ];

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

        /* bubbles floating out of the icon */
        @keyframes al-float {
          0%   { opacity: 0; transform: translate(0, 0) scale(.3); }
          20%  { opacity: .95; }
          100% { opacity: 0; transform: translate(var(--dx, 0), -70px) scale(1.15); }
        }
        .al-float { animation: al-float 1.9s ease-out both; }

        /* the "just went live" bubble gives a little jolt + glow */
        @keyframes al-burst {
          0% { transform: scale(.7); }
          35% { transform: scale(1.1); }
          60% { transform: scale(.97); }
          100% { transform: scale(1); }
        }
        .al-burst { animation: al-burst .6s cubic-bezier(.34,1.56,.64,1) both; }
        @keyframes al-glow {
          0%,100% { box-shadow: 0 10px 30px rgba(16,185,129,.25); }
          50% { box-shadow: 0 10px 36px rgba(16,185,129,.55); }
        }
        .al-glow { animation: al-glow 1.6s ease-in-out infinite; }

        @media (prefers-reduced-motion: reduce) {
          .al-pop, .al-ring, .al-wiggle, .al-fade, .al-badge, .al-typing, .al-float, .al-burst, .al-glow { animation: none; }
        }
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
            {hasStats && stats && (
              <div className="grid grid-cols-3 gap-2">
                <Stat label="live now" value={stats.live_now} live />
                <Stat label="sessions today" value={stats.sessions_today} />
                <Stat label="min today" value={stats.minutes_today} />
              </div>
            )}

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

          {/* bubbles + note floating out of the icon when a message pops */}
          {showBubble && msg && (
            <span key={`p-${msg.id}`} aria-hidden className="pointer-events-none absolute inset-0">
              {particles.map((p, i) => (
                <span
                  key={i}
                  className={`al-float absolute top-1 rounded-full border ${
                    isLive ? "bg-emerald-300/60 border-emerald-200" : "bg-indigo-300/60 border-white/80"
                  }`}
                  style={
                    {
                      left: p.left,
                      width: p.size,
                      height: p.size,
                      animationDelay: p.delay,
                      "--dx": p.dx,
                    } as CSSProperties
                  }
                />
              ))}
              <span
                className="al-float absolute top-0 left-1/2 text-sm text-indigo-500"
                style={{ animationDelay: "0.1s", "--dx": "16px" } as CSSProperties}
              >
                ♪
              </span>
            </span>
          )}

          {open ? (
            <svg className="relative w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={teaser.typing ? `w-${msg?.id ?? "x"}` : "idle"}
              src="/airlink-icon.png"
              alt="AirLink"
              width={56}
              height={56}
              className={`relative w-14 h-14 rounded-full select-none ${teaser.show && teaser.typing ? "al-wiggle" : ""}`}
              draggable={false}
            />
          )}

          {/* notification badge while a message is showing */}
          {!open && teaser.show && (
            <span className="al-badge absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-pink-500 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-white">
              1
            </span>
          )}

          {/* quiet live counter when sessions are active (even if the teaser is dismissed) */}
          {!open && !teaser.show && stats && stats.live_now > 0 && (
            <span className="al-badge absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
              {stats.live_now}
            </span>
          )}
        </button>

        {/* teaser bubble */}
        <div
          aria-live="polite"
          className={`relative origin-left transition-all duration-500 ease-[cubic-bezier(.34,1.56,.64,1)] ${
            showBubble
              ? "opacity-100 translate-x-0 scale-100"
              : "opacity-0 -translate-x-3 scale-75 pointer-events-none"
          }`}
        >
          <span
            className={`absolute -left-1 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rotate-45 bg-white border-l border-b ${
              isLive ? "border-emerald-300" : "border-zinc-200"
            }`}
          />
          <div
            key={isBurst && !teaser.typing ? msg?.id : "static"}
            className={`relative flex items-center gap-1 pl-4 pr-2 py-2.5 rounded-2xl bg-white border max-w-[min(260px,calc(100vw-7rem))] ${
              isLive
                ? "border-emerald-300 al-glow shadow-[0_10px_30px_rgba(16,185,129,0.25)]"
                : "border-zinc-200 shadow-[0_10px_30px_rgba(79,70,229,0.18)]"
            } ${isBurst && !teaser.typing ? "al-burst" : ""}`}
          >
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
                <span key={msg?.id} className="al-fade flex items-center gap-2 text-xs font-semibold text-zinc-800 leading-snug">
                  {isLive && <LiveDot color={isBurst ? "rose" : "emerald"} />}
                  <span>{msg?.node}</span>
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