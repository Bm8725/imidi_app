'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";

/* ════════════════════════════════════════════════════════════════
   MediaHero · isometric live-sequencer grid with a demo video
   Cycle: grid (isometric) → diagonal light wave → grid "flips up"
   into the demo video → back to the grid.
   Meant to be the background of a hero section: it fills its
   (relative) parent.
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
  GLOW.set(row * COLS + col, {
    delay: (k % 7) * 0.75,
    duration: 2.4 + (k % 4) * 0.55,
    color: COLORS[k % COLORS.length],
  });
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
  };
});

const GRID_ACTIVE =
  "perspective(1200px) rotateX(58deg) rotateZ(-18deg) translateY(-4%) scale(1.12)";
const GRID_BEHIND =
  "perspective(1200px) rotateX(28deg) rotateZ(-8deg) translateY(-8%) scale(0.82)";
const CARD_HIDDEN =
  "perspective(1400px) rotateX(62deg) rotateZ(-18deg) translateY(28%) scale(0.42)";
const CARD_SHOWN =
  "perspective(1400px) rotateX(0deg) rotateZ(0deg) translateY(0%) scale(1)";

const WAVE_MS = 880;
const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5CA1] focus-visible:ring-offset-2 focus-visible:ring-offset-black";

export default function MediaHero({
  videoSrc = "/airmidi-link-promo.mp4",
  poster = "/airmidi-link-poster.jpg",
  autoCycle = true,
  gridMs = 4500,
  ctaHref = "/airmidi-link",
  fadeTo = "#131316",
  onPhaseChange,
  onPadTrigger,
}: {
  videoSrc?: string;
  poster?: string;
  autoCycle?: boolean;
  gridMs?: number;
  ctaHref?: string;
  fadeTo?: string;
  onPhaseChange?: (phase: MediaHeroPhase) => void;
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

  const active = inView && tabVisible;
  const inVideo = phase === "video";

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    setSaveData(
      !!(navigator as unknown as { connection?: { saveData?: boolean } }).connection
        ?.saveData
    );
    return () => mq.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (el && typeof IntersectionObserver !== "undefined") {
      const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), {
        threshold: 0.25,
      });
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

  useEffect(() => {
    if (warm || !active || saveData || failed) return;
    const id = setTimeout(() => setWarm(true), 1100);
    return () => clearTimeout(id);
  }, [active, saveData, failed, warm]);

  useEffect(() => {
    if (!active) return;
    let id: ReturnType<typeof setTimeout> | undefined;
    if (phase === "grid") {
      if (autoCycle && !reduced && !saveData && !failed)
        id = setTimeout(() => setPhase("wave"), gridMs);
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

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (inVideo && active && !failed) {
      const id = setTimeout(
        () => {
          v.currentTime = 0;
          v.play().catch(() => {});
        },
        reduced ? 0 : 420
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

  const goDemo = useCallback(() => {
    setWarm(true);
    setPhase((p) => (p === "grid" ? "wave" : p));
  }, []);
  const goGrid = useCallback(() => setPhase("grid"), []);

  const onTimeUpdate = () => {
    const v = videoRef.current;
    if (v && barRef.current && v.duration)
      barRef.current.style.transform = `scaleX(${v.currentTime / v.duration})`;
  };

  const onGridPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const pad = (e.target as HTMLElement).closest<HTMLElement>("[data-pad]");
    if (!pad) return;
    if (!reduced) {
      pad
        .querySelector<HTMLElement>("[data-flash]")
        ?.animate(
          [
            { opacity: 0.95, transform: "scale(0.82)" },
            { opacity: 0, transform: "scale(1.35)" },
          ],
          { duration: 480, easing: "cubic-bezier(.2,.9,.2,1)" }
        );
    }
    onPadTrigger?.(Number(pad.dataset.pad));
  };

  return (
    <div
      ref={rootRef}
      className="absolute inset-0 z-0 isolate overflow-hidden bg-transparent select-none"
    >
      <style>{`
        @keyframes mh-pad-pulse {
          0%, 100% { opacity: 0.04; transform: scale(1); }
          48%, 52% { opacity: 0.72; transform: scale(1.04); }
        }
        @keyframes mh-pad-wave {
          0%   { opacity: 0;    transform: scale(0.4); filter: blur(4px); }
          32%  { opacity: 1;    transform: scale(1.05); filter: blur(0); }
          100% { opacity: 0;    transform: scale(1.4); filter: blur(6px); }
        }
        @keyframes mh-border-flow {
          0%   { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
        @keyframes mh-glow-breathe {
          0%, 100% { opacity: 0.35; }
          50%      { opacity: 0.55; }
        }
        @media (prefers-reduced-motion: reduce) {
          .mh-anim { animation: none !important; }
        }
      `}</style>

      {/* ambient color wash behind everything */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background:
            "radial-gradient(ellipse 55% 45% at 50% 42%, rgba(180,124,255,0.07) 0%, transparent 70%), radial-gradient(ellipse 40% 35% at 30% 60%, rgba(255,92,161,0.05) 0%, transparent 65%)",
          opacity: inVideo ? 0.4 : 1,
          transition: "opacity 1.1s ease",
        }}
      />

      {/* ISOMETRIC GRID */}
      <div
        className="absolute inset-0 z-10 flex items-center justify-center transition-[transform,opacity] duration-[1200ms] ease-[cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none"
        style={{
          transform: inVideo ? GRID_BEHIND : GRID_ACTIVE,
          opacity: inVideo ? 0.18 : 0.92,
          pointerEvents: inVideo ? "none" : undefined,
        }}
      >
        <div
          aria-hidden
          onPointerDown={onGridPointerDown}
          className="relative grid h-[130vh] max-h-[1500px] w-[130vw] max-w-[1500px] grid-cols-8 grid-rows-6 gap-2.5 p-5 sm:gap-4 sm:p-6"
          style={{
            touchAction: "manipulation",
            WebkitMaskImage:
              "radial-gradient(ellipse 60% 54% at 50% 48%, #000 36%, transparent 100%)",
            maskImage:
              "radial-gradient(ellipse 60% 54% at 50% 48%, #000 36%, transparent 100%)",
          }}
        >
          {PADS.map((p) => (
            <div
              key={p.i}
              data-pad={p.i}
              className="group relative cursor-pointer overflow-hidden rounded-[6px] border border-white/[0.06] bg-white/[0.02] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-200 active:scale-[0.96] sm:rounded-lg [@media(hover:hover)]:hover:border-white/20 [@media(hover:hover)]:hover:bg-white/[0.08] [@media(hover:hover)]:hover:shadow-[0_0_20px_-4px_rgba(255,255,255,0.12),inset_0_1px_0_rgba(255,255,255,0.08)]"
            >
              {/* subtle top highlight for depth */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-40"
              />

              {/* idle pulse */}
              {p.glow && (
                <div
                  className="mh-anim pointer-events-none absolute inset-0"
                  style={
                    {
                      background: `radial-gradient(circle at 50% 50%, ${p.glow.color} 0%, transparent 72%)`,
                      animation: `mh-pad-pulse ${p.glow.duration}s ease-in-out infinite`,
                      animationDelay: `${p.glow.delay}s`,
                    } as CSSProperties
                  }
                />
              )}

              {/* diagonal wave */}
              {phase === "wave" && (
                <div
                  className="mh-anim pointer-events-none absolute inset-0"
                  style={
                    {
                      background: `radial-gradient(circle at 50% 50%, ${p.color} 0%, transparent 70%)`,
                      animation: "mh-pad-wave 520ms cubic-bezier(.2,.8,.2,1) both",
                      animationDelay: `${(p.row + p.col) * 38}ms`,
                    } as CSSProperties
                  }
                />
              )}

              {/* press flash */}
              <div
                data-flash
                className="pointer-events-none absolute inset-0 opacity-0"
                style={{
                  background: `radial-gradient(circle at 50% 50%, ${p.color} 10%, transparent 70%)`,
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* DEMO VIDEO */}
      <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-4 pb-28 pt-24 sm:pb-32 sm:pt-28">
        <div
          className="will-change-transform transition-[transform,opacity] duration-[1100ms] ease-[cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none"
          style={{
            width:
              "max(280px, min(92vw, 980px, calc((100svh - 14rem) * 1.7778)))",
            transform: inVideo ? CARD_SHOWN : CARD_HIDDEN,
            opacity: inVideo ? 1 : 0,
            pointerEvents: inVideo ? "auto" : "none",
          }}
          aria-hidden={!inVideo}
        >
          {/* outer glow bloom */}
          <div
            aria-hidden
            className="mh-anim pointer-events-none absolute -inset-8 rounded-[40px] opacity-40 blur-2xl"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(255,92,161,0.35) 0%, rgba(180,124,255,0.2) 40%, transparent 70%)",
              animation: inVideo ? "mh-glow-breathe 4s ease-in-out infinite" : "none",
            }}
          />

          <div
            className="mh-anim relative rounded-[22px] p-[1.5px] shadow-[0_40px_100px_-24px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.04)]"
            style={{
              background:
                "linear-gradient(105deg,#FF5CA1,#B47CFF,#6C7CFF,#FF8A3D,#FF5CA1)",
              backgroundSize: "220% 100%",
              animation: "mh-border-flow 7s linear infinite",
            }}
          >
            <div className="relative aspect-video overflow-hidden rounded-[20.5px] bg-[#0A0B0F]">
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

              {/* sound toggle */}
              <button
                type="button"
                onClick={() => setMuted((m) => !m)}
                aria-pressed={!muted}
                aria-label={muted ? "Turn sound on" : "Turn sound off"}
                tabIndex={inVideo ? 0 : -1}
                className={`absolute right-3 top-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/60 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/90 shadow-lg backdrop-blur-md transition-all hover:bg-black/75 hover:text-white ${FOCUS}`}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-3.5 w-3.5"
                  aria-hidden
                >
                  <path d="M11 5 6 9H2v6h4l5 4V5z" />
                  {muted ? (
                    <path d="m22 9-6 6m0-6 6 6" />
                  ) : (
                    <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
                  )}
                </svg>
                {muted ? "Sound off" : "Sound on"}
              </button>

              {/* progress bar */}
              <div className="absolute inset-x-0 bottom-0 h-[2.5px] bg-white/10" aria-hidden>
                <div
                  ref={barRef}
                  className="h-full origin-left bg-gradient-to-r from-[#FF5CA1] via-[#B47CFF] to-[#FF8A3D]"
                  style={{ transform: "scaleX(0)" }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* soft fade into page */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[25] h-52"
        style={{
          background: `linear-gradient(to top, ${fadeTo} 0%, ${fadeTo}cc 30%, transparent 100%)`,
        }}
      />

      {/* BUTTONS */}
      <div className="pointer-events-none absolute inset-x-0 bottom-6 z-30 mx-auto flex max-w-4xl items-center justify-center gap-3 px-5 sm:bottom-8 sm:gap-4">
        {inVideo ? (
          <>
            <Link
              href={ctaHref}
              className={`pointer-events-auto rounded-full bg-gradient-to-r from-[#FF5CA1] to-[#FF8A3D] px-6 py-3 text-xs font-bold uppercase tracking-widest text-white shadow-[0_8px_28px_-6px_rgba(255,92,161,0.55)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_32px_-6px_rgba(255,92,161,0.65)] active:translate-y-0 ${FOCUS}`}
            >
              Try AirMIDI Link
            </Link>
            <button
              type="button"
              onClick={goGrid}
              className={`pointer-events-auto rounded-full border border-white/20 bg-black/55 px-5 py-3 text-xs font-semibold uppercase tracking-widest text-white/90 backdrop-blur-md transition-all hover:border-white/30 hover:bg-black/70 hover:text-white ${FOCUS}`}
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
              className={`group pointer-events-auto inline-flex items-center gap-2.5 rounded-full border border-white/20 bg-black/55 px-5 py-3 text-xs font-semibold uppercase tracking-widest text-white/90 backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-white/30 hover:bg-black/70 hover:text-white disabled:opacity-55 disabled:hover:translate-y-0 ${FOCUS}`}
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-[#FF5CA1] to-[#FF8A3D] text-[9px] text-white shadow-[0_0_12px_-2px_rgba(255,92,161,0.7)] transition-transform duration-300 group-hover:scale-110">
                ▶
              </span>
              Watch the demo
            </button>
          )
        )}
      </div>

      <p className="sr-only" aria-live="polite">
        {inVideo
          ? "AirMIDI Link demo is playing. Press Escape to go back."
          : ""}
      </p>
    </div>
  );
}