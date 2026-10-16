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
type LiveItem = { id: string; name: string | null };
type LastEnded = { at: number; seconds: number | null } | null;

type Stats = {
  live_now: number;
  waiting: number;
  sessions_today: number;
  minutes_today: number;
  liveList: LiveItem[];
  lastEnded: LastEnded;
  own: Own;
};

type Msg = {
  id: string;
  kind: "static" | "live" | "wait" | "stats" | "idle" | "burst";
  node: ReactNode;
  sub?: ReactNode; // optional second line shown in the ON AIR card
};

const STATIC_MESSAGES = [
  "Hey 👋 Meet AirMIDI Link",
  "Try new tech: MIDI over the cloud ☁️",
  "Stream your USB MIDI anywhere 🎹",
  "Pair any device with a 6-digit code ⚡",
  "No cables between you and your band 🎶",
];

const DISMISS_KEY = "airlink-teaser-dismissed"; // silences promo messages only
const MUTE_KEY = "airlink-live-muted-until"; // silences live announcements temporarily
const MUTE_CLOSE_MS = 10 * 60_000; // after ✕ on the ON AIR card
const MUTE_OPEN_MS = 3 * 60_000; // after the user opened the panel
const POLL_MS = 15_000;
const FRESH_MS = 60_000; // heartbeat newer than this = link is live
const PRIORITY_TTL_MS = 30_000;
const LIVE_REPEAT_MS = 20_000;
const SHOW_NAMES = true; // show the device name of live senders (false = anonymous)

// ?al=demo  -> simulated sessions (clearly a preview, only for you), animations forced
// ?al=debug -> real data + console diagnostics + reduce-motion warning
const qp = (k: string) =>
  typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get(k);
const isDemo = () => qp("al") === "demo";
const isDebug = () => qp("al") !== null;

const CONFETTI_COLORS = ["#10b981", "#f43f5e", "#f59e0b", "#6366f1", "#22d3ee", "#ffffff"];
const CONFETTI = Array.from({ length: 16 }, (_, i) => {
  const a = (i / 16) * Math.PI * 2;
  const r = 56 + (i % 3) * 12;
  return {
    tx: `${Math.round(Math.cos(a) * r)}px`,
    ty: `${Math.round(Math.sin(a) * r)}px`,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    delay: `${(i % 4) * 0.04}s`,
  };
});

/* ───────────────────────── small helpers ───────────────────────── */

function timeAgo(ts: number): string {
  const m = Math.max(1, Math.round((Date.now() - ts) / 60_000));
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

// pulls a readable device name out of the jsonb, whatever its shape
function deviceName(info: unknown): string | null {
  if (!SHOW_NAMES || !info || typeof info !== "object") return null;
  const o = info as Record<string, unknown>;
  const keys = [
    "name", "deviceName", "device_name", "midiDevice", "midi_device",
    "device", "label", "model", "product", "manufacturer",
  ];
  const clean = (v: unknown): string | null => {
    if (typeof v !== "string") return null;
    const t = v.trim();
    if (!t) return null;
    return t.length > 28 ? t.slice(0, 27) + "…" : t;
  };
  for (const k of keys) {
    const direct = clean(o[k]);
    if (direct) return direct;
    const nested = o[k];
    if (nested && typeof nested === "object") {
      const n = clean((nested as Record<string, unknown>).name);
      if (n) return n;
    }
  }
  for (const k of ["inputs", "devices", "midi"]) {
    const arr = o[k];
    if (Array.isArray(arr) && arr[0]) {
      const first = arr[0] as Record<string, unknown> | string;
      const n = typeof first === "string" ? clean(first) : clean(first?.name);
      if (n) return n;
    }
  }
  return null;
}

function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
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

function LiveDot() {
  return (
    <span className="relative flex shrink-0 h-1.5 w-1.5">
      <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping bg-emerald-400" />
      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
    </span>
  );
}

function Stat({ label, value, live }: { label: string; value: number; live?: boolean }) {
  return (
    <div className="rounded-xl bg-zinc-50 border border-zinc-100 px-2 py-2 text-center">
      <div className="flex items-center justify-center gap-1 text-base font-extrabold text-zinc-900">
        {live && value > 0 && <LiveDot />}
        <CountUp value={value} />
      </div>
      <div className="text-[9px] uppercase tracking-widest text-zinc-400 mt-0.5">{label}</div>
    </div>
  );
}

function liveNameMsg(item: LiveItem, i: number, total: number): Msg | null {
  if (!item.name) return null;
  const variants = [
    <><b>{item.name}</b> is live right now 🎹</>,
    <><b>{item.name}</b> is streaming MIDI 🔴</>,
    <>Listen up: <b>{item.name}</b> is on air 📡</>,
  ];
  return {
    id: `who-${item.id}-${i % variants.length}`,
    kind: "live",
    node: variants[i % variants.length],
    sub: total > 1 ? `Now ${total} live` : undefined,
  };
}

function buildMessages(s: Stats | null): Msg[] {
  const dyn: Msg[] = [];

  if (s) {
    const nobodyLive = s.live_now === 0 && s.liveList.length === 0;

    if (s.own) {
      dyn.push(
        s.own.live
          ? { id: `own-live-${s.own.code}`, kind: "live", node: <>Your link <b>{s.own.code}</b> is live 🔴</> }
          : { id: `own-wait-${s.own.code}`, kind: "wait", node: <>Room <b>{s.own.code}</b> is waiting for a device ⚡</> }
      );
    }

    // who is live + the running count
    s.liveList.slice(0, 3).forEach((item, i) => {
      const m = liveNameMsg(item, i, s.live_now);
      if (m) dyn.push(m);
    });
    if (s.live_now > 0) {
      dyn.push({
        id: `count-${s.live_now}`,
        kind: "live",
        node: (
          <>
            Now <b><CountUp value={s.live_now} /></b> live 🔴
          </>
        ),
        sub: s.live_now === 1 ? "Join the jam 🎶" : "The room is heating up 🔥",
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

    // honest "quiet" messages when nobody is live (real data only, nothing faked)
    if (nobodyLive) {
      if (s.lastEnded) {
        const mins = s.lastEnded.seconds ? Math.max(1, Math.round(s.lastEnded.seconds / 60)) : null;
        dyn.push({
          id: `last-${Math.floor(s.lastEnded.at / 60_000)}`,
          kind: "idle",
          node: (
            <>
              Last link ended <b>{timeAgo(s.lastEnded.at)}</b>
              {mins ? <> · {mins} min of music</> : null} 🎹
            </>
          ),
        });
      }
      dyn.push({
        id: "idle-invite",
        kind: "idle",
        node:
          s.sessions_today > 0
            ? "All quiet right now. Start a link in 10 seconds ⚡"
            : "No links yet today. Be the first to go live 🎹",
      });
    }
  }

  const stat: Msg[] = STATIC_MESSAGES.map((t, i) => ({ id: `s-${i}`, kind: "static", node: t }));

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
  const [dismissed, setDismissed] = useState(true); // promo messages off until storage is read
  const [mutedUntil, setMutedUntil] = useState(0); // live announcements off until this time
  const [demo, setDemo] = useState(false);
  const [debug, setDebug] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [burstKey, setBurstKey] = useState(0);
  const [teaser, setTeaser] = useState<{ show: boolean; typing: boolean; msg: Msg | null }>({
    show: false,
    typing: false,
    msg: null,
  });

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const idxRef = useRef(0);
  const liveIdxRef = useRef(0);
  const lastLiveAtRef = useRef(0);
  const prevIdsRef = useRef<Set<string> | null>(null);
  const prevCountRef = useRef<number | null>(null);
  const prevOwnLiveRef = useRef<boolean | null>(null);
  const priorityRef = useRef<{ msg: Msg; at: number } | null>(null);
  const fastStartRef = useRef(false);

  const messages = useMemo(() => buildMessages(stats), [stats]);
  const messagesRef = useRef<Msg[]>(messages);
  const statsRef = useRef<Stats | null>(null);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  useEffect(() => {
    statsRef.current = stats;
  }, [stats]);

  const hideTeaser = () => setTeaser((t) => ({ ...t, show: false, typing: false }));

  // ✕ on a normal bubble / opening the panel: silence promo messages for this session
  const rememberDismiss = () => {
    setDismissed(true);
    hideTeaser();
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* storage unavailable */
    }
  };

  // silence live announcements for a while (never forever)
  const muteLive = (ms: number) => {
    const dur = isDemo() ? 15_000 : ms;
    const until = Date.now() + dur;
    setMutedUntil(until);
    hideTeaser();
    if (isDemo()) return;
    try {
      sessionStorage.setItem(MUTE_KEY, String(until));
    } catch {
      /* storage unavailable */
    }
  };

  // read modes + stored state (demo ignores it)
  useEffect(() => {
    setDemo(isDemo());
    setDebug(isDebug());
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    if (isDemo()) {
      setDismissed(false);
      setMutedUntil(0);
      return;
    }
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
      setMutedUntil(Number(sessionStorage.getItem(MUTE_KEY)) || 0);
    } catch {
      setDismissed(false);
    }
  }, []);

  // new data arrived: detect who just went live, count changes, and sessions ending
  const applyStats = useCallback((s: Stats) => {
    const ids = new Set(s.liveList.map((l) => l.id));
    const prevIds = prevIdsRef.current;
    const prevCount = prevCountRef.current;
    const prevOwn = prevOwnLiveRef.current;
    prevIdsRef.current = ids;
    prevCountRef.current = s.live_now;
    prevOwnLiveRef.current = !!s.own?.live;

    const nowSub = s.live_now > 0 ? `Now ${s.live_now} live` : undefined;
    let burst: Msg | null = null;

    if (prevOwn !== null && s.own?.live && !prevOwn) {
      burst = {
        id: `burst-own-${Date.now()}`,
        kind: "burst",
        node: <>Your link just connected! 🔴</>,
        sub: nowSub,
      };
    } else if (prevIds) {
      const fresh = s.liveList.filter((l) => !prevIds.has(l.id));
      if (fresh.length > 0) {
        const first = fresh[0];
        const extra = fresh.length - 1;
        burst = {
          id: `burst-${first.id}-${Date.now()}`,
          kind: "burst",
          node: first.name ? (
            <>
              <b className="text-base">{first.name}</b>
              {extra > 0 && <> +{extra} more</>} 🔴
            </>
          ) : (
            <>New MIDI link just went live! 🔴</>
          ),
          sub: nowSub,
        };
      } else if (prevCount !== null && s.live_now < prevCount) {
        // someone left
        burst =
          s.live_now > 0
            ? {
                id: `down-${s.live_now}-${Date.now()}`,
                kind: "live",
                node: (
                  <>
                    Now <b>{s.live_now}</b> live 🔴
                  </>
                ),
                sub: "A session just ended",
              }
            : {
                id: `quiet-${Date.now()}`,
                kind: "idle",
                node: <>Session ended. All quiet now 🎹</>,
              };
      }
    }

    if (burst) {
      priorityRef.current = { at: Date.now(), msg: burst };
      fastStartRef.current = true;
      setBurstKey((k) => k + 1);
    }
    setStats(s);
  }, []);

  // poll live data (paused when tab hidden / on the AirMIDI page); ?al=demo simulates instead
  useEffect(() => {
    if (hiddenPage) return;
    let alive = true;

    // ---------- DEMO MODE (preview for you only; visitors never see simulated data) ----------
    if (isDemo()) {
      const names = ["Roland A-49", "Korg Minilogue", "Akai MPK Mini", "Novation Launchkey"];
      const seq = [1, 2, 3, 2, 1, 0, 1]; // goes up, down, and to zero
      let n = 0;
      const mk = (count: number): Stats => ({
        live_now: count,
        waiting: count === 0 ? 0 : 2,
        sessions_today: 7 + n,
        minutes_today: 93 + n * 3,
        liveList: names.slice(0, count).map((name, i) => ({ id: `demo-${i}`, name })),
        lastEnded: { at: Date.now() - 12 * 60_000, seconds: 34 * 60 },
        own: null,
      });
      applyStats(mk(0)); // baseline, so the next one counts as "just went live"
      const tick = () => {
        applyStats(mk(seq[n % seq.length]));
        n++;
      };
      const t = setTimeout(tick, 2500);
      const id = setInterval(tick, 12000);
      return () => {
        alive = false;
        clearTimeout(t);
        clearInterval(id);
      };
    }

    // ---------- REAL DATA ----------
    const load = async () => {
      if (document.hidden) return;
      const now = Date.now();
      const nowIso = new Date(now).toISOString();
      const freshMs = now - FRESH_MS;
      const freshIso = new Date(freshMs).toISOString();
      const dayStart = new Date();
      dayStart.setUTCHours(0, 0, 0, 0);

      const [todayRes, waitRes, liveRes, lastRes] = await Promise.all([
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
        supabase
          .from("airmidi_links")
          .select("id, sender_device_info")
          .not("connected_at", "is", null)
          .is("ended_at", null)
          .gte("last_heartbeat_at", freshIso)
          .order("connected_at", { ascending: false })
          .limit(5),
        supabase
          .from("airmidi_links")
          .select("connected_at, ended_at, duration_seconds")
          .not("connected_at", "is", null)
          .not("ended_at", "is", null)
          .order("ended_at", { ascending: false })
          .limit(1),
      ]);

      if (isDebug()) {
        if (todayRes.error) console.warn("[AirLink] today query:", todayRes.error.message);
        if (waitRes.error) console.warn("[AirLink] waiting query:", waitRes.error.message);
        if (liveRes.error) console.warn("[AirLink] live query:", liveRes.error.message);
        if (lastRes.error) console.warn("[AirLink] last-ended query:", lastRes.error.message);
      }

      // everything failed (no access / offline): keep what we had, stay on static messages
      if (todayRes.error && waitRes.error && liveRes.error) return;

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

      const liveList: LiveItem[] = (liveRes.data ?? []).map((r) => ({
        id: String(r.id),
        name: deviceName(r.sender_device_info),
      }));
      if (live === 0 && liveList.length > 0) live = liveList.length;

      // the most recent finished session (real data, used for the quiet-state message)
      let lastEnded: LastEnded = null;
      const lr = lastRes.data?.[0];
      if (lr?.ended_at) {
        const endedAt = Date.parse(lr.ended_at);
        const startedAt = lr.connected_at ? Date.parse(lr.connected_at) : NaN;
        if (!Number.isNaN(endedAt)) {
          lastEnded = {
            at: endedAt,
            seconds:
              lr.duration_seconds ??
              (Number.isNaN(startedAt) ? null : Math.max(0, (endedAt - startedAt) / 1000)),
          };
        }
      }

      if (isDebug()) {
        console.info("[AirLink] data", {
          live,
          waiting: waitRes.count,
          sessionsToday: rows.length,
          liveRows: liveRes.data,
          names: liveList.map((l) => l.name),
          lastEnded,
        });
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
        liveList,
        lastEnded,
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

  // teaser loop. Live announcements run even when promo is dismissed;
  // they only stop while muted (✕ on the ON AIR card) or while the panel is open.
  useEffect(() => {
    if (open || hiddenPage) {
      hideTeaser();
      return;
    }
    let alive = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (fn: () => void, ms: number) => {
      timers.push(setTimeout(() => alive && fn(), ms));
    };

    const cycle = () => {
      const now = Date.now();
      const liveOk = now >= mutedUntil;
      let msg: Msg | null = null;

      // 1) a fresh change (just went live / count changed / session ended) goes first
      const p = priorityRef.current;
      priorityRef.current = null;
      if (p && liveOk && now - p.at < PRIORITY_TTL_MS) msg = p.msg;

      // 2) while someone is live, (re)announce who it is and the running count
      if (!msg && liveOk) {
        const st = statsRef.current;
        if (st && st.live_now > 0 && now - lastLiveAtRef.current > LIVE_REPEAT_MS) {
          const named = st.liveList.filter((l) => l.name);
          if (named.length > 0) {
            const i = liveIdxRef.current++;
            msg = liveNameMsg(named[i % named.length], i, st.live_now);
          } else {
            msg = {
              id: `live-repeat-${now}`,
              kind: "live",
              node: (
                <>
                  Now <b>{st.live_now}</b> live 📡
                </>
              ),
              sub: st.live_now === 1 ? "Join the jam 🎶" : "The room is heating up 🔥",
            };
          }
        }
      }

      // 3) promo rotation, only if not dismissed
      if (!msg && !dismissed) {
        const all = messagesRef.current;
        const list = liveOk ? all : all.filter((m) => m.kind !== "live" && m.kind !== "burst");
        if (list.length > 0) {
          msg = list[idxRef.current % list.length];
          idxRef.current = (idxRef.current + 1) % list.length;
        }
      }

      // nothing to show right now: check again soon
      if (!msg) {
        later(cycle, 4000);
        return;
      }

      if (msg.kind === "live" || msg.kind === "burst") lastLiveAtRef.current = now;

      const typingMs = msg.kind === "burst" ? 400 : 900;
      const showMs = msg.kind === "burst" ? 7000 : msg.kind === "live" ? 5500 : 4800;
      const m = msg;
      setTeaser({ show: true, typing: true, msg: m });
      later(() => setTeaser({ show: true, typing: false, msg: m }), typingMs);
      later(() => setTeaser({ show: false, typing: false, msg: m }), typingMs + showMs);
      later(cycle, typingMs + showMs + (m.kind === "live" || m.kind === "burst" ? 3500 : 5500));
    };

    const startDelay = fastStartRef.current ? 300 : 3500;
    fastStartRef.current = false;
    later(cycle, startDelay);

    return () => {
      alive = false;
      timers.forEach(clearTimeout);
    };
  }, [open, dismissed, mutedUntil, hiddenPage, burstKey]);

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

  const openPanelFromTeaser = () => {
    setOpen(true);
    rememberDismiss();
    muteLive(MUTE_OPEN_MS);
  };

  const msg = teaser.msg;
  const isLive = msg?.kind === "live" || msg?.kind === "burst";
  const isBurst = msg?.kind === "burst";
  const showBubble = teaser.show && !open;
  const onAir = showBubble && isLive && !teaser.typing; // the spectacular state
  const hasStats =
    !!stats && (stats.live_now > 0 || stats.sessions_today > 0 || stats.minutes_today > 0);

  const particles: { left: string; size: number; dx: string; delay: string }[] = [
    { left: "18%", size: 8, dx: "-10px", delay: "0s" },
    { left: "50%", size: 12, dx: "6px", delay: "0.18s" },
    { left: "74%", size: 6, dx: "14px", delay: "0.36s" },
    { left: "38%", size: 10, dx: "-4px", delay: "0.54s" },
  ];

  const ringColor = isBurst ? "border-rose-400" : "border-emerald-400";
  const cardGradient = isBurst
    ? "bg-gradient-to-br from-rose-500 via-fuchsia-500 to-indigo-600 shadow-[0_14px_44px_rgba(244,63,94,0.6)]"
    : "bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 shadow-[0_14px_44px_rgba(16,185,129,0.6)]";

  return (
    <div
      ref={wrapRef}
      data-motion={demo ? "force" : "safe"}
      className="fixed left-4 md:left-5 bottom-[calc(6rem+env(safe-area-inset-bottom))] md:bottom-5 z-[60] flex flex-col items-start gap-3"
    >
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

        @keyframes al-float {
          0%   { opacity: 0; transform: translate(0, 0) scale(.3); }
          20%  { opacity: .95; }
          100% { opacity: 0; transform: translate(var(--dx, 0), -70px) scale(1.15); }
        }
        .al-float { animation: al-float 1.9s ease-out both; }

        /* the ON AIR card shoots out of the icon with a springy overshoot */
        @keyframes al-emerge {
          0%   { opacity: 0; transform: translateX(-48px) scale(.2); }
          55%  { opacity: 1; transform: translateX(6px) scale(1.1); }
          100% { opacity: 1; transform: none; }
        }
        .al-emerge { animation: al-emerge .75s cubic-bezier(.2,.9,.3,1.15) both; transform-origin: left center; }

        /* light sweep across the card */
        @keyframes al-shine {
          0%   { transform: translateX(-130%) skewX(-20deg); }
          55%,100% { transform: translateX(420%) skewX(-20deg); }
        }
        .al-shine { animation: al-shine 2s ease-in-out infinite; }

        /* equalizer bars */
        @keyframes al-eq { 0%,100% { transform: scaleY(.2); } 50% { transform: scaleY(1); } }
        .al-eq { animation: al-eq .8s ease-in-out infinite; transform-origin: bottom; }

        /* signal waves radiating from the card */
        @keyframes al-signal {
          0%   { transform: scale(1); opacity: .9; }
          100% { transform: scale(1.5, 2.4); opacity: 0; }
        }
        .al-signal { animation: al-signal 1.8s cubic-bezier(.2,.6,.3,1) infinite; }

        /* sonar rings radiating from the icon */
        @keyframes al-sonar {
          0%   { transform: scale(1); opacity: .85; }
          100% { transform: scale(3); opacity: 0; }
        }
        .al-sonar { animation: al-sonar 2.1s cubic-bezier(.2,.6,.3,1) infinite; }

        /* icon heartbeat */
        @keyframes al-heart {
          0%,100% { transform: scale(1); }
          15% { transform: scale(1.18); }
          30% { transform: scale(1); }
          45% { transform: scale(1.1); }
        }
        .al-heart { animation: al-heart 1.1s ease-in-out infinite; }

        /* confetti */
        @keyframes al-confetti {
          0%   { opacity: 1; transform: translate(0,0) scale(.4); }
          100% { opacity: 0; transform: translate(var(--tx), var(--ty)) scale(1.1) rotate(200deg); }
        }
        .al-confetti { animation: al-confetti 1.3s cubic-bezier(.15,.8,.3,1) both; }

        /* OS "reduce motion" only applies when NOT in ?al=demo */
        @media (prefers-reduced-motion: reduce) {
          [data-motion="safe"] .al-pop, [data-motion="safe"] .al-ring, [data-motion="safe"] .al-wiggle,
          [data-motion="safe"] .al-fade, [data-motion="safe"] .al-badge, [data-motion="safe"] .al-typing,
          [data-motion="safe"] .al-float, [data-motion="safe"] .al-emerge, [data-motion="safe"] .al-shine,
          [data-motion="safe"] .al-eq, [data-motion="safe"] .al-signal, [data-motion="safe"] .al-sonar,
          [data-motion="safe"] .al-heart, [data-motion="safe"] .al-confetti { animation: none; }
        }
      `}</style>

      {debug && reduced && !demo && (
        <div className="max-w-[260px] rounded-lg bg-rose-600 text-white text-[10px] font-semibold px-2.5 py-1.5 leading-snug">
          Your OS has &quot;reduce motion&quot; ON, so animations are off. Add ?al=demo to force them.
        </div>
      )}

      {demo && (
        <div className="max-w-[260px] rounded-lg bg-zinc-900 text-white text-[10px] font-semibold px-2.5 py-1.5 leading-snug">
          Preview mode: simulated sessions, only visible to you.
        </div>
      )}

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
            if (open) {
              setOpen(false);
            } else {
              openPanelFromTeaser();
            }
          }}
          aria-label="Open AirLink"
          aria-expanded={open}
          className={`relative w-14 h-14 rounded-full shadow-lg shadow-indigo-500/40 hover:scale-105 active:scale-95 transition-transform duration-200 flex items-center justify-center ${
            open ? "bg-gradient-to-br from-indigo-600 to-violet-600 text-white" : ""
          }`}
        >
          {!open && !onAir && <span className="absolute inset-0 rounded-full bg-indigo-500/40 al-ring" />}

          {/* SONAR: big rings radiating from the icon while someone is live */}
          {onAir && (
            <span aria-hidden className="pointer-events-none absolute inset-0">
              {[0, 0.7, 1.4].map((d) => (
                <span
                  key={d}
                  className={`al-sonar absolute inset-0 rounded-full border-[3px] ${ringColor} ${
                    isBurst ? "bg-rose-400/20" : "bg-emerald-400/20"
                  }`}
                  style={{ animationDelay: `${d}s` }}
                />
              ))}
            </span>
          )}

          {/* CONFETTI: explosion when someone just went live */}
          {onAir && isBurst && msg && (
            <span key={`c-${msg.id}`} aria-hidden className="pointer-events-none absolute left-1/2 top-1/2">
              {CONFETTI.map((c, i) => (
                <span
                  key={i}
                  className="al-confetti absolute -ml-[4px] -mt-[4px] w-[8px] h-[8px] rounded-sm"
                  style={
                    {
                      background: c.color,
                      animationDelay: c.delay,
                      "--tx": c.tx,
                      "--ty": c.ty,
                    } as CSSProperties
                  }
                />
              ))}
            </span>
          )}

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
              className={`relative w-14 h-14 rounded-full select-none ${
                teaser.show && teaser.typing ? "al-wiggle" : onAir ? "al-heart" : ""
              }`}
              draggable={false}
            />
          )}

          {/* notification badge while a normal message is showing */}
          {!open && teaser.show && !onAir && (
            <span className="al-badge absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-pink-500 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-white">
              1
            </span>
          )}

          {/* LIVE pill: visible whenever someone is live and the card is not on screen */}
          {!open && !onAir && stats && stats.live_now > 0 && (
            <span className="al-badge absolute -top-2 -right-3 flex items-center gap-1 rounded-full bg-emerald-500 text-white text-[9px] font-extrabold tracking-wider pl-1.5 pr-2 h-[18px] ring-2 ring-white shadow-md">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-white opacity-80 animate-ping" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
              </span>
              {stats.live_now} LIVE
            </span>
          )}
        </button>

        {/* message area */}
        <div
          aria-live="polite"
          className={`relative origin-left transition-all duration-500 ease-[cubic-bezier(.34,1.56,.64,1)] ${
            showBubble
              ? "opacity-100 translate-x-0 scale-100"
              : "opacity-0 -translate-x-3 scale-75 pointer-events-none"
          }`}
        >
          {onAir && msg ? (
            /* ───────── ON AIR CARD (live / just went live / count changed) ───────── */
            <div key={msg.id} className="relative">
              <span aria-hidden className="pointer-events-none absolute inset-0">
                {[0, 0.6, 1.2].map((d) => (
                  <span
                    key={d}
                    className={`al-signal absolute inset-0 rounded-2xl border-[3px] ${ringColor}`}
                    style={{ animationDelay: `${d}s` }}
                  />
                ))}
              </span>

              <span
                className={`absolute -left-1 top-1/2 -translate-y-1/2 w-3 h-3 rotate-45 ${
                  isBurst ? "bg-rose-500" : "bg-emerald-500"
                }`}
              />

              <button
                onClick={openPanelFromTeaser}
                className={`al-emerge relative overflow-hidden text-left rounded-2xl px-4 py-3 text-white min-w-[210px] max-w-[min(270px,calc(100vw-7rem))] ${cardGradient}`}
              >
                <span aria-hidden className="al-shine pointer-events-none absolute inset-y-0 left-0 w-1/4 bg-white/35" />

                <span className="relative flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 rounded-full bg-black/25 px-2 py-0.5 text-[10px] font-extrabold tracking-widest">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-white opacity-80 animate-ping" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                    </span>
                    {isBurst ? "JUST WENT LIVE" : "ON AIR"}
                  </span>
                  <span className="flex items-end gap-[3px] h-4" aria-hidden>
                    {[0, 0.15, 0.3, 0.1, 0.25].map((d, i) => (
                      <span
                        key={i}
                        className="al-eq w-[3px] h-full rounded-full bg-white/90"
                        style={{ animationDelay: `${d}s` }}
                      />
                    ))}
                  </span>
                </span>

                <span className="relative block mt-2 text-sm font-bold leading-snug">{msg.node}</span>
                {msg.sub && (
                  <span className="relative block mt-0.5 text-xs font-semibold text-white/90">{msg.sub}</span>
                )}
                <span className="relative block mt-1 text-[10px] uppercase tracking-widest text-white/80">
                  Tap to listen →
                </span>
              </button>

              <button
                onClick={() => muteLive(MUTE_CLOSE_MS)}
                aria-label="Dismiss live alerts for 10 minutes"
                className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-white text-zinc-600 text-[10px] shadow-md flex items-center justify-center hover:bg-zinc-100"
              >
                ✕
              </button>
            </div>
          ) : (
            /* ───────── normal small bubble ───────── */
            <>
              <span className="absolute -left-1 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rotate-45 bg-white border-l border-b border-zinc-200" />
              <div className="relative flex items-center gap-1 pl-4 pr-2 py-2.5 rounded-2xl bg-white border border-zinc-200 shadow-[0_10px_30px_rgba(79,70,229,0.18)] max-w-[min(260px,calc(100vw-7rem))]">
                <button onClick={openPanelFromTeaser} className="text-left min-h-[1rem]">
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
                    <span key={msg?.id} className="al-fade block text-xs font-semibold text-zinc-800 leading-snug">
                      {msg?.node}
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}