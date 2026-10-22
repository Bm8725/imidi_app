'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";

/* ════════════════════════════════════════════════════════════════
   MediaHero · isometric live-sequencer grid with a demo video
   Cycle: grid (isometric) -> diagonal light wave -> grid "flips up" into the demo video -> back to the grid.
   Meant to be the background of a hero section: it fills its (relative) parent.
   ════════════════════════════════════════════════════════════════ */

export type MediaHeroPhase = "grid" | "wave" | "video";

const COLS = 8;
const ROWS = 6;
const COLORS = ["#FF5CA1", "#FF8A3D", "#B47CFF", "#6C7CFF"];

// Static per-pad data, computed once. "glow" pads pulse on their own in the idle grid.
const GLOW = new Map<number, { delay: number; duration: number; color: string }>();
for (let k = 0; k < 16; k++) {
  const row = (k * 3 + 1) % ROWS;
  const col = (k * 4 + 2) % COLS;
  GLOW.set(row * COLS + col, { delay: (k % 7) * 0.8, duration: 2.5 + (k % 4) * 0.5, color: COLORS[k % COLORS.length] });
}

const PADS = Array.from({ length: COLS * ROWS }, (_, i) => {
  const row = Math.floor(i / COLS);
  const col = i % COLS;
  return { i, row, col, color: COLORS[(row + col) % COLORS.length], glow: GLOW.get(i) };
});

const GRID_ACTIVE = "perspective(1000px) rotateX(60deg) rotateZ(-20deg) translateY(-5%) scale(1.15)";
const GRID_BEHIND = "perspective(1000px) rotateX(35deg) rotateZ(-10deg) translateY(-6%) scale(0.9)";
const CARD_HIDDEN = "perspective(1200px) rotateX(58deg) rotateZ(-20deg) translateY(22%) scale(0.5)";
const CARD_SHOWN = "perspective(1200px) rotateX(0deg) rotateZ(0deg) translateY(0%) scale(1)";

const WAVE_MS = 950; // how long the light wave runs before the video appears
const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5CA1] focus-visible:ring-offset-2 focus-visible:ring-offset-black";

export default function MediaHero({
  videoSrc = "/airmidi-link-promo.mp4",
  poster = "/airmidi-link-poster.jpg",
  autoCycle = true,
  gridMs = 4500, // how long the grid stays alone before the video comes up
  ctaHref = "/airmidi-link",
  fadeTo = "#131316", // page background, used for the soft fade at the bottom edge
  onPhaseChange,
  onPadTrigger,
}: {
  videoSrc?: string;
  poster?: string;
  autoCycle?: boolean;
  gridMs?: number;
  ctaHref?: string;
  fadeTo?: string;
  /** lets the page react to the video (for example fade the hero text out while it plays) */
  onPhaseChange?: (phase: MediaHeroPhase) => void;
  /** called with the pad index (0-47) when a pad is pressed; hook your own MIDI/audio here */
  onPadTrigger?: (index: number) => void;
}) {
  const [phase, setPhase] = useState<MediaHeroPhase>("grid");
  const [inView, setInView] = useState(true);
  const [tabVisible, setTabVisible] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [saveData, setSaveData] = useState(false);
  const [failed, setFailed] = useState(false);
  const [warm, setWarm] = useState(false); // start fetching the video only once the hero has been on screen a moment
  const [muted, setMuted] = useState(true);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);

  const active = inView && tabVisible;
  const inVideo = phase === "video";

  /* environment: reduced motion, data saver */
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    setSaveData(!!(navigator as unknown as { connection?: { saveData?: boolean } }).connection?.saveData);
    return () => mq.removeEventListener("change", on);
  }, []);

  /* run only while the hero is on screen and the tab is in front */
  useEffect(() => {
    const el = rootRef.current;
    if (el && typeof IntersectionObserver !== "undefined") {
      const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.25 });
      io.observe(el);
      const onVis = () => setTabVisible(!document.hidden);
      document.addEventListener("visibilitychange", onVis);
      return () => {
        io.disconnect();
        document.removeEventListener("visibilitychange", onVis);
      };
    }
  }, []);

  useEffect(() => {
    if (!active) setPhase("grid");
  }, [active]);

  useEffect(() => {
    onPhaseChange?.(phase);
  }, [phase, onPhaseChange]);

  /* warm the video up shortly after the hero is seen (never on data saver) */
  useEffect(() => {
    if (warm || !active || saveData || failed) return;
    const id = setTimeout(() => setWarm(true), 1200);
    return () => clearTimeout(id);
  }, [active, saveData, failed, warm]);

  /* phase machine. Only grid -> wave is gated by autoCycle; once a demo is requested it always completes. */
  useEffect(() => {
    if (!active) return;
    let id: ReturnType<typeof setTimeout> | undefined;
    if (phase === "grid") {
      if (autoCycle && !reduced && !saveData && !failed) id = setTimeout(() => setPhase("wave"), gridMs);
    } else if (phase === "wave") {
      id = setTimeout(() => setPhase("video"), reduced ? 0 : WAVE_MS);
    } else {
      // safety net in case the video can never end (stalled network)
      const dur = (videoRef.current?.duration || 0) * 1000;
      id = setTimeout(() => setPhase("grid"), Math.max(20000, dur + 4000));
    }
    return () => {
      if (id) clearTimeout(id);
    };
  }, [phase, active, reduced, autoCycle, gridMs, saveData, failed]);

  /* play once the card has mostly settled; pause otherwise */
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

  /* Esc leaves the demo */
  useEffect(() => {
    if (!inVideo) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPhase("grid");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inVideo]);

  const goDemo = useCallback(() => {
    setWarm(true);
    setPhase((p) => (p === "grid" ? "wave" : p));
  }, []);
  const goGrid = useCallback(() => setPhase("grid"), []);

  const onTimeUpdate = () => {
    const v = videoRef.current;
    if (v && barRef.current && v.duration) barRef.current.style.transform = `scaleX(${v.currentTime / v.duration})`;
  };

  /* pads are decorative for assistive tech but react to mouse and touch (event delegation: one handler for 48 pads) */
  const onGridPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const pad = (e.target as HTMLElement).closest<HTMLElement>("[data-pad]");
    if (!pad) return;
    if (!reduced) {
      pad
        .querySelector<HTMLElement>("[data-flash]")
        ?.animate(
          [
            { opacity: 0.95, transform: "scale(0.85)" },
            { opacity: 0, transform: "scale(1.2)" },
          ],
          { duration: 420, easing: "ease-out" }
        );
    }
    onPadTrigger?.(Number(pad.dataset.pad));
  };

  return (
    <div ref={rootRef} className="absolute inset-0 z-0 isolate overflow-hidden bg-transparent select-none">
      <style>{`
        @keyframes mh-pad-pulse { 0%, 100% { opacity: 0.05; } 45%, 55% { opacity: 0.6; } }
        @keyframes mh-pad-wave {
          0%   { opacity: 0;    transform: scale(.55); }
          35%  { opacity: 0.95; transform: scale(1); }
          100% { opacity: 0;    transform: scale(1.15); }
        }
        @keyframes mh-border-flow { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } }
        @media (prefers-reduced-motion: reduce) { .mh-anim { animation: none !important; } }
      `}</style>

      {/* ISOMETRIC GRID */}
      <div
        className="absolute inset-0 z-10 flex items-center justify-center transition-[transform,opacity] duration-[1100ms] ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none"
        style={{
          transform: inVideo ? GRID_BEHIND : GRID_ACTIVE,
          opacity: inVideo ? 0.25 : 0.9,
          pointerEvents: inVideo ? "none" : undefined,
        }}
      >
        <div
          aria-hidden
          onPointerDown={onGridPointerDown}
          className="relative grid h-[130vh] max-h-[1500px] w-[130vw] max-w-[1500px] grid-cols-8 grid-rows-6 gap-3 p-6 sm:gap-5"
          style={{
            touchAction: "manipulation",
            // fades the pads out towards the edges so the hero text stays readable
            WebkitMaskImage: "radial-gradient(ellipse 62% 56% at 50% 50%, #000 38%, transparent 100%)",
            maskImage: "radial-gradient(ellipse 62% 56% at 50% 50%, #000 38%, transparent 100%)",
          }}
        >
          {PADS.map((p) => (
            <div
              key={p.i}
              data-pad={p.i}
              className="relative cursor-pointer overflow-hidden rounded-md border border-white/[0.05] bg-white/[0.015] transition-colors duration-150 active:bg-white/10 sm:rounded-lg [@media(hover:hover)]:hover:border-white/15 [@media(hover:hover)]:hover:bg-white/[0.07]"
            >
              {/* idle pulse on a few pads */}
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

              {/* diagonal wave announcing the video */}
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

              {/* flash when pressed */}
              <div
                data-flash
                className="pointer-events-none absolute inset-0 opacity-0"
                style={{ background: `radial-gradient(circle at center, ${p.color} 25%, transparent 78%)` }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* DEMO VIDEO: rises from the grid (from tilted to flat) */}
      <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-4 pb-28 pt-24 sm:pb-32 sm:pt-28">
        <div
          className="will-change-transform transition-[transform,opacity] duration-[1000ms] ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none"
          style={{
            // as wide as possible, but never taller than the space left under the navbar and above the buttons
            width: "max(280px, min(92vw, 980px, calc((100svh - 14rem) * 1.7778)))",
            transform: inVideo ? CARD_SHOWN : CARD_HIDDEN,
            opacity: inVideo ? 1 : 0,
            pointerEvents: inVideo ? "auto" : "none",
          }}
          aria-hidden={!inVideo}
        >
          <div
            className="mh-anim rounded-[22px] p-[1.5px] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.55)]"
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

              <button
                type="button"
                onClick={() => setMuted((m) => !m)}
                aria-pressed={!muted}
                aria-label={muted ? "Turn sound on" : "Turn sound off"}
                tabIndex={inVideo ? 0 : -1}
                className={`absolute right-3 top-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/55 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white backdrop-blur transition-colors hover:bg-black/70 ${FOCUS}`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden>
                  <path d="M11 5 6 9H2v6h4l5 4V5z" />
                  {muted ? <path d="m22 9-6 6m0-6 6 6" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />}
                </svg>
                {muted ? "Sound off" : "Sound on"}
              </button>

              <div className="absolute inset-x-0 bottom-0 h-[3px] bg-white/10" aria-hidden>
                <div
                  ref={barRef}
                  className="h-full origin-left bg-gradient-to-r from-[#FF5CA1] to-[#FF8A3D]"
                  style={{ transform: "scaleX(0)" }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* soft fade into the page below, sits under the buttons */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[25] h-48"
        style={{ background: `linear-gradient(to top, ${fadeTo}, transparent)` }}
      />

      {/* BUTTONS */}
      <div className="pointer-events-none absolute inset-x-0 bottom-6 z-30 mx-auto flex max-w-4xl items-center justify-center gap-3 px-5 sm:bottom-8 sm:gap-4">
        {inVideo ? (
          <>
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
          </>
        ) : (
          !failed && (
            <button
              type="button"
              onClick={goDemo}
              disabled={phase === "wave"}
              className={`group pointer-events-auto inline-flex items-center gap-2.5 rounded-full border border-white/25 bg-black/50 px-5 py-3 text-xs font-semibold uppercase tracking-widest text-white backdrop-blur transition-all hover:-translate-y-0.5 hover:bg-black/65 disabled:opacity-60 disabled:hover:translate-y-0 ${FOCUS}`}
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#FF5CA1] text-[9px] text-white transition-transform group-hover:scale-110">
                ▶
              </span>
              Watch the demo
            </button>
          )
        )}
      </div>

      <p className="sr-only" aria-live="polite">
        {inVideo ? "AirMIDI Link demo is playing. Press Escape to go back." : ""}
      </p>
    </div>
  );
}