"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";

/* ════════════════════════════════════════════════════════════════
   MediaHero · live-sequencer grid + "theater mode" demo video

   grid   : isometric pads, light follows the cursor, pads ripple when pressed
   wave   : a diagonal wave runs across the pads
   video  : the grid sinks back, the hero text steps aside, the demo rises on its own stage

   Fills its (relative) parent. While the video plays, the other children of
   that parent (your hero text and buttons) fade out so nothing overlaps the
   video, and come back when it ends. Set dimSiblings={false} to handle that
   yourself through onPhaseChange.
   ════════════════════════════════════════════════════════════════ */

export type MediaHeroPhase = "grid" | "wave" | "video";

const COLS = 8;
const ROWS = 6;
const COLORS = ["#FF5CA1", "#FF8A3D", "#B47CFF", "#6C7CFF"];

// a few pads pulse on their own in the idle grid
const GLOW = new Map<number, { delay: number; duration: number; color: string }>();
for (let k = 0; k < 16; k++) {
  const row = (k * 3 + 1) % ROWS;
  const col = (k * 4 + 2) % COLS;
  GLOW.set(row * COLS + col, { delay: (k % 7) * 0.8, duration: 2.5 + (k % 4) * 0.5, color: COLORS[k % COLORS.length] });
}

const PADS = Array.from({ length: COLS * ROWS }, (_, i) => {
  const row = Math.floor(i / COLS);
  const col = i % COLS;
  return {
    i,
    row,
    col,
    color: COLORS[(row + col) % COLORS.length],
    glow: GLOW.get(i),
    fromCenter: Math.hypot(col - (COLS - 1) / 2, row - (ROWS - 1) / 2),
  };
});

const GRID_ACTIVE = "perspective(1000px) rotateX(60deg) rotateZ(-20deg) translateY(-5%) scale(1.15)";
const GRID_BEHIND = "perspective(1000px) rotateX(48deg) rotateZ(-14deg) translateY(-10%) scale(0.8)";
const CARD_HIDDEN = "perspective(1200px) rotateX(58deg) rotateZ(-20deg) translateY(22%) scale(0.5)";
const CARD_SHOWN = "perspective(1200px) rotateX(0deg) rotateZ(0deg) translateY(0%) scale(1)";

const WAVE_MS = 950;
const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5CA1] focus-visible:ring-offset-2 focus-visible:ring-offset-black";

export default function MediaHero({
  videoSrc = "/airmidi-link-promo.mp4",
  poster = "/airmidi-link-poster.jpg",
  autoCycle = true,
  gridMs = 4500,
  ctaHref = "/airmidi-link",
  fadeTo = "#131316",
  dimSiblings = true,
  onPhaseChange,
  onPadTrigger,
}: {
  videoSrc?: string;
  poster?: string;
  autoCycle?: boolean;
  gridMs?: number;
  ctaHref?: string;
  fadeTo?: string;
  /** fade out the other children of the parent (hero text) while the video plays */
  dimSiblings?: boolean;
  onPhaseChange?: (phase: MediaHeroPhase) => void;
  /** called with the pad index (0-47) when a pad is pressed */
  onPadTrigger?: (index: number) => void;
}) {
  const [phase, setPhase] = useState<MediaHeroPhase>("grid");
  const [inView, setInView] = useState(true);
  const [tabVisible, setTabVisible] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [saveData, setSaveData] = useState(false);
  const [failed, setFailed] = useState(false);
  const [warm, setWarm] = useState(false);
  const [muted, setMuted] = useState(true);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const saved = useRef(new Map<HTMLElement, { o: string; p: string; t: string }>());

  const active = inView && tabVisible;
  const inVideo = phase === "video";

  /* environment */
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    setSaveData(!!(navigator as unknown as { connection?: { saveData?: boolean } }).connection?.saveData);
    return () => mq.removeEventListener("change", on);
  }, []);

  /* run only while visible */
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.25 });
    io.observe(el);
    const onVis = () => setTabVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  useEffect(() => {
    if (!active) setPhase("grid");
  }, [active]);

  useEffect(() => {
    onPhaseChange?.(phase);
  }, [phase, onPhaseChange]);

  useEffect(() => {
    if (warm || !active || saveData || failed) return;
    const id = setTimeout(() => setWarm(true), 1200);
    return () => clearTimeout(id);
  }, [active, saveData, failed, warm]);

  /* phase machine */
  useEffect(() => {
    if (!active) return;
    let id: ReturnType<typeof setTimeout> | undefined;
    if (phase === "grid") {
      if (autoCycle && !reduced && !saveData && !failed) id = setTimeout(() => setPhase("wave"), gridMs);
    } else if (phase === "wave") {
      id = setTimeout(() => setPhase("video"), reduced ? 0 : WAVE_MS);
    } else {
      const dur = (videoRef.current?.duration || 0) * 1000;
      id = setTimeout(() => setPhase("grid"), Math.max(20000, dur + 4000));
    }
    return () => {
      if (id) clearTimeout(id);
    };
  }, [phase, active, reduced, autoCycle, gridMs, saveData, failed]);

  /* video playback */
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (inVideo && active && !failed) {
      const id = setTimeout(
        () => {
          v.currentTime = 0;
          v.play().catch(() => {
            /* autoplay blocked: the poster stays visible */
          });
        },
        reduced ? 0 : 450
      );
      return () => clearTimeout(id);
    }
    v.pause();
  }, [inVideo, active, reduced, failed]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  useEffect(() => {
    if (!inVideo) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPhase("grid");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inVideo]);

  /* hero text steps aside while the video plays */
  useEffect(() => {
    if (!dimSiblings) return;
    const parent = rootRef.current?.parentElement;
    if (!parent) return;
    const sibs = Array.from(parent.children).filter((c) => c !== rootRef.current) as HTMLElement[];
    for (const el of sibs) {
      if (!saved.current.has(el)) saved.current.set(el, { o: el.style.opacity, p: el.style.pointerEvents, t: el.style.transition });
      const s = saved.current.get(el)!;
      el.style.transition = reduced ? "none" : "opacity 500ms ease";
      el.style.opacity = inVideo ? "0" : s.o;
      el.style.pointerEvents = inVideo ? "none" : s.p;
    }
  }, [inVideo, dimSiblings, reduced]);

  useEffect(() => {
    const map = saved.current;
    return () => {
      map.forEach((s, el) => {
        el.style.opacity = s.o;
        el.style.pointerEvents = s.p;
        el.style.transition = s.t;
      });
      map.clear();
    };
  }, []);

  /* cursor light: follows the pointer over the whole hero (even over the text) */
  useEffect(() => {
    const root = rootRef.current;
    const parent = root?.parentElement;
    if (!root || !parent || reduced || !active) return;
    let raf = 0;
    const move = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = root.getBoundingClientRect();
        root.style.setProperty("--mx", `${e.clientX - r.left}px`);
        root.style.setProperty("--my", `${e.clientY - r.top}px`);
      });
    };
    parent.addEventListener("pointermove", move);
    return () => {
      cancelAnimationFrame(raf);
      parent.removeEventListener("pointermove", move);
    };
  }, [reduced, active]);

  const goDemo = useCallback(() => {
    setWarm(true);
    setPhase((p) => (p === "grid" ? "wave" : p));
  }, []);
  const goGrid = useCallback(() => setPhase("grid"), []);

  const onTimeUpdate = () => {
    const v = videoRef.current;
    if (v && barRef.current && v.duration) barRef.current.style.transform = `scaleX(${v.currentTime / v.duration})`;
  };

  /* pressing a pad: it flashes, and a ripple spreads to the pads around it */
  const onGridPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const pad = (e.target as HTMLElement).closest<HTMLElement>("[data-pad]");
    if (!pad) return;
    const idx = Number(pad.dataset.pad);
    if (!reduced) {
      const origin = PADS[idx];
      for (const p of PADS) {
        const d = Math.hypot(p.row - origin.row, p.col - origin.col);
        if (d > 2.6) continue;
        rootRef.current
          ?.querySelector<HTMLElement>(`[data-pad="${p.i}"] [data-flash]`)
          ?.animate(
            [
              { opacity: d === 0 ? 0.95 : 0.55, transform: "scale(0.85)" },
              { opacity: 0, transform: "scale(1.2)" },
            ],
            { duration: 460, delay: d * 70, easing: "ease-out", fill: "backwards" }
          );
      }
    }
    onPadTrigger?.(idx);
  };

  return (
    <div
      ref={rootRef}
      className="absolute inset-0 z-0 isolate select-none overflow-hidden bg-transparent"
      style={{ "--mx": "50%", "--my": "42%" } as CSSProperties}
    >
      <style>{`
        @keyframes mh-pad-in { from { opacity: 0; transform: scale(.4); } to { opacity: 1; transform: scale(1); } }
        @keyframes mh-pad-pulse { 0%, 100% { opacity: 0.05; } 45%, 55% { opacity: 0.6; } }
        @keyframes mh-pad-wave {
          0%   { opacity: 0;    transform: scale(.55); }
          35%  { opacity: 0.95; transform: scale(1); }
          100% { opacity: 0;    transform: scale(1.15); }
        }
        @keyframes mh-border-flow { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } }
        @keyframes mh-ring { 0% { transform: scale(1); opacity: .5; } 100% { transform: scale(1.5); opacity: 0; } }
        @media (prefers-reduced-motion: reduce) { .mh-anim { animation: none !important; } }
      `}</style>

      {/* ISOMETRIC GRID */}
      <div
        className="absolute inset-0 z-10 flex items-center justify-center transition-[transform,opacity] duration-[1100ms] ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none"
        style={{
          transform: inVideo ? GRID_BEHIND : GRID_ACTIVE,
          opacity: inVideo ? 0.18 : 0.9,
          pointerEvents: inVideo ? "none" : undefined,
        }}
      >
        <div
          aria-hidden
          onPointerDown={onGridPointerDown}
          className="relative grid h-[130vh] max-h-[1500px] w-[130vw] max-w-[1500px] grid-cols-8 grid-rows-6 gap-3 p-6 sm:gap-5"
          style={{
            touchAction: "manipulation",
            WebkitMaskImage: "radial-gradient(ellipse 62% 56% at 50% 50%, #000 38%, transparent 100%)",
            maskImage: "radial-gradient(ellipse 62% 56% at 50% 50%, #000 38%, transparent 100%)",
          }}
        >
          {PADS.map((p) => (
            <div
              key={p.i}
              data-pad={p.i}
              className="mh-anim relative cursor-pointer overflow-hidden rounded-md border border-white/[0.06] bg-white/[0.02] transition-colors duration-150 active:bg-white/10 sm:rounded-lg [@media(hover:hover)]:hover:border-white/20 [@media(hover:hover)]:hover:bg-white/[0.08]"
              style={{ animation: "mh-pad-in 650ms cubic-bezier(.2,.8,.2,1) both", animationDelay: `${p.fromCenter * 70}ms` }}
            >
              {p.glow && (
                <div
                  className="mh-anim pointer-events-none absolute inset-0"
                  style={
                    {
                      background: `radial-gradient(circle at center, ${p.glow.color} 20%, transparent 80%)`,
                      animation: `mh-pad-pulse ${p.glow.duration}s ease-in-out infinite`,
                      animationDelay: `${p.glow.delay}s`,
                    } as CSSProperties
                  }
                />
              )}

              {phase === "wave" && (
                <div
                  className="mh-anim pointer-events-none absolute inset-0"
                  style={
                    {
                      background: `radial-gradient(circle at center, ${p.color} 15%, transparent 78%)`,
                      animation: "mh-pad-wave 450ms ease-out both",
                      animationDelay: `${(p.row + p.col) * 45}ms`,
                    } as CSSProperties
                  }
                />
              )}

              <div
                data-flash
                className="pointer-events-none absolute inset-0 opacity-0"
                style={{ background: `radial-gradient(circle at center, ${p.color} 25%, transparent 78%)` }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* cursor light over the grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[12] transition-opacity duration-700"
        style={{
          opacity: inVideo ? 0 : 1,
          mixBlendMode: "screen",
          background: "radial-gradient(circle 260px at var(--mx) var(--my), rgba(255,92,161,0.20), transparent 70%)",
        }}
      />

      {/* dark stage behind the video so it never competes with anything */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[15] transition-opacity duration-700 motion-reduce:transition-none"
        style={{
          opacity: inVideo ? 1 : 0,
          background: `radial-gradient(ellipse 80% 70% at 50% 45%, rgba(10,10,14,0.55), ${fadeTo} 100%)`,
        }}
      />

      {/* DEMO VIDEO */}
      <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-4 pb-28 pt-24 sm:pb-32 sm:pt-28">
        <div
          className="relative will-change-transform transition-[transform,opacity] duration-[1000ms] ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none"
          style={{
            width: "max(280px, min(92vw, 980px, calc((100svh - 14rem) * 1.7778)))",
            transform: inVideo ? CARD_SHOWN : CARD_HIDDEN,
            opacity: inVideo ? 1 : 0,
            pointerEvents: inVideo ? "auto" : "none",
          }}
          aria-hidden={!inVideo}
        >
          {/* glow under the card */}
          <div
            aria-hidden
            className="mh-anim pointer-events-none absolute -bottom-8 left-[8%] right-[8%] h-20 rounded-full bg-gradient-to-r from-[#FF5CA1]/40 via-[#B47CFF]/40 to-[#6C7CFF]/40 blur-3xl"
          />

          <div
            className="mh-anim relative rounded-[22px] p-[1.5px] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]"
            style={{
              background: "linear-gradient(90deg,#FF5CA1,#B47CFF,#6C7CFF,#FF8A3D,#FF5CA1)",
              backgroundSize: "200% 100%",
              animation: "mh-border-flow 6s linear infinite",
            }}
          >
            <div className="relative aspect-video overflow-hidden rounded-[20px] bg-[#0D0E12]">
              <video
                ref={videoRef}
                src={videoSrc}
                poster={poster}
                muted
                playsInline
                preload={warm ? "auto" : "none"}
                onEnded={goGrid}
                onError={() => {
                  setFailed(true);
                  setPhase("grid");
                }}
                onTimeUpdate={onTimeUpdate}
                aria-label="AirMIDI Link demo"
                className="h-full w-full object-cover"
              />

              {/* top gradient so the labels stay readable on any frame */}
              <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/60 to-transparent" />

              <div className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/45 px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-white backdrop-blur">
                <span className="relative flex h-2 w-2">
                  <span className="mh-anim absolute inset-0 rounded-full bg-[#FF5CA1]" style={{ animation: "mh-ring 1.6s ease-out infinite" }} />
                  <span className="relative h-2 w-2 rounded-full bg-[#FF5CA1]" />
                </span>
                Live demo · AirMIDI Link
              </div>

              <div className="absolute right-3 top-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMuted((m) => !m)}
                  aria-pressed={!muted}
                  aria-label={muted ? "Turn sound on" : "Turn sound off"}
                  tabIndex={inVideo ? 0 : -1}
                  className={`inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/55 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white backdrop-blur transition-colors hover:bg-black/70 ${FOCUS}`}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden>
                    <path d="M11 5 6 9H2v6h4l5 4V5z" />
                    {muted ? <path d="m22 9-6 6m0-6 6 6" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />}
                  </svg>
                  {muted ? "Sound off" : "Sound on"}
                </button>
                <button
                  type="button"
                  onClick={goGrid}
                  aria-label="Close demo"
                  tabIndex={inVideo ? 0 : -1}
                  className={`flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white backdrop-blur transition-colors hover:bg-black/70 ${FOCUS}`}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" className="h-3.5 w-3.5" aria-hidden>
                    <path d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </button>
              </div>

              <div className="absolute inset-x-0 bottom-0 h-[3px] bg-white/10" aria-hidden>
                <div ref={barRef} className="h-full origin-left bg-gradient-to-r from-[#FF5CA1] to-[#FF8A3D]" style={{ transform: "scaleX(0)" }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* soft fade into the page below */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[25] h-48"
        style={{ background: `linear-gradient(to top, ${fadeTo}, transparent)` }}
      />

      {/* BUTTONS */}
      <div className="pointer-events-none absolute inset-x-0 bottom-6 z-30 mx-auto flex max-w-4xl flex-col items-center gap-3 px-5 sm:bottom-8">
        {inVideo ? (
          <div className="flex items-center justify-center gap-3 sm:gap-4">
            <Link
              href={ctaHref}
              className={`pointer-events-auto rounded-full bg-gradient-to-r from-[#FF5CA1] to-[#FF8A3D] px-6 py-3 text-xs font-bold uppercase tracking-widest text-white shadow-lg transition-all hover:-translate-y-0.5 active:translate-y-0 ${FOCUS}`}
            >
              Try AirMIDI Link
            </Link>
            <button
              type="button"
              onClick={goGrid}
              className={`pointer-events-auto rounded-full border border-white/25 bg-black/50 px-5 py-3 text-xs font-semibold uppercase tracking-widest text-white backdrop-blur transition-colors hover:bg-black/65 ${FOCUS}`}
            >
              Back to the grid
            </button>
          </div>
        ) : (
          !failed && (
            <>
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/45">Tap the pads</p>
              <button
                type="button"
                onClick={goDemo}
                disabled={phase === "wave"}
                className={`group pointer-events-auto inline-flex items-center gap-2.5 rounded-full border border-white/25 bg-black/50 px-5 py-3 text-xs font-semibold uppercase tracking-widest text-white backdrop-blur transition-all hover:-translate-y-0.5 hover:bg-black/65 disabled:opacity-60 disabled:hover:translate-y-0 ${FOCUS}`}
              >
                <span className="relative flex h-5 w-5 items-center justify-center rounded-full bg-[#FF5CA1] text-[9px] text-white transition-transform group-hover:scale-110">
                  <span aria-hidden className="mh-anim absolute inset-0 rounded-full bg-[#FF5CA1]" style={{ animation: "mh-ring 2s ease-out infinite" }} />
                  <span className="relative">▶</span>
                </span>
                Watch the demo
              </button>
            </>
          )
        )}
      </div>

      <p className="sr-only" aria-live="polite">
        {inVideo ? "AirMIDI Link demo is playing. Press Escape to go back." : ""}
      </p>
    </div>
  );
}