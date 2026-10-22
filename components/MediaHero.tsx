'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import Link from "next/link";

/* ════════════════════════════════════════════════════════════════
   MediaHero · cinematic isometric sequencer → demo video
   Grid lives, wave sweeps, card rises from the plane.
   Fills its relative parent. Fully responsive.
   ════════════════════════════════════════════════════════════════ */

export type MediaHeroPhase = "grid" | "wave" | "video";

const COLS = 8;
const ROWS = 6;
const COLORS = ["#FF5CA1", "#FF8A3D", "#B47CFF", "#6C7CFF"] as const;

const GLOW = new Map<
  number,
  { delay: number; duration: number; color: string }
>();
for (let k = 0; k < 14; k++) {
  const row = (k * 3 + 1) % ROWS;
  const col = (k * 5 + 2) % COLS;
  GLOW.set(row * COLS + col, {
    delay: (k % 6) * 0.7,
    duration: 2.6 + (k % 3) * 0.6,
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

/* transforms */
const GRID_ACTIVE =
  "perspective(1400px) rotateX(56deg) rotateZ(-16deg) translate3d(0,-3%,0) scale(1.08)";
const GRID_BEHIND =
  "perspective(1400px) rotateX(22deg) rotateZ(-6deg) translate3d(0,-10%,0) scale(0.78)";
const CARD_HIDDEN =
  "perspective(1600px) rotateX(68deg) rotateZ(-16deg) translate3d(0,32%,-80px) scale(0.38)";
const CARD_SHOWN =
  "perspective(1600px) rotateX(0deg) rotateZ(0deg) translate3d(0,0,0) scale(1)";

const WAVE_MS = 920;
const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5CA1] focus-visible:ring-offset-2 focus-visible:ring-offset-black";

export default function MediaHero({
  videoSrc = "/airmidi-link-promo.mp4",
  poster = "/airmidi-link-poster.jpg",
  autoCycle = true,
  gridMs = 4800,
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

  /* environment */
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    setSaveData(
      !!(navigator as unknown as { connection?: { saveData?: boolean } })
        .connection?.saveData
    );
    return () => mq.removeEventListener("change", on);
  }, []);

  /* visibility */
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), {
      threshold: 0.22,
    });
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

  /* warm video */
  useEffect(() => {
    if (warm || !active || saveData || failed) return;
    const id = setTimeout(() => setWarm(true), 900);
    return () => clearTimeout(id);
  }, [active, saveData, failed, warm]);

  /* phase machine */
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
      id = setTimeout(() => setPhase("grid"), Math.max(22000, dur + 5000));
    }
    return () => {
      if (id) clearTimeout(id);
    };
  }, [phase, active, reduced, autoCycle, gridMs, saveData, failed]);

  /* play / pause */
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (inVideo && active && !failed) {
      const id = setTimeout(
        () => {
          v.currentTime = 0;
          v.play().catch(() => {});
        },
        reduced ? 0 : 380
      );
      return () => clearTimeout(id);
    }
    v.pause();
  }, [inVideo, active, reduced, failed]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  /* Esc */
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
      const flash = pad.querySelector<HTMLElement>("[data-flash]");
      flash?.animate(
        [
          { opacity: 1, transform: "scale(0.78)", filter: "brightness(1.4)" },
          { opacity: 0, transform: "scale(1.45)", filter: "brightness(1)" },
        ],
        { duration: 520, easing: "cubic-bezier(.15,.9,.2,1)" }
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
        @keyframes mh-pulse {
          0%, 100% { opacity: 0.03; transform: scale(1); }
          50%      { opacity: 0.78; transform: scale(1.06); }
        }
        @keyframes mh-wave {
          0%   { opacity: 0;    transform: scale(0.35); filter: blur(8px); }
          28%  { opacity: 1;    transform: scale(1.08); filter: blur(0); }
          100% { opacity: 0;    transform: scale(1.55); filter: blur(10px); }
        }
        @keyframes mh-border {
          0%   { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
        @keyframes mh-bloom {
          0%, 100% { opacity: 0.28; transform: scale(1); }
          50%      { opacity: 0.48; transform: scale(1.04); }
        }
        @keyframes mh-scan {
          0%   { transform: translateY(-120%) skewY(-8deg); opacity: 0; }
          15%  { opacity: 0.55; }
          85%  { opacity: 0.55; }
          100% { transform: translateY(220%) skewY(-8deg); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .mh-anim { animation: none !important; }
        }
      `}</style>

      {/* ambient color field */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[1] transition-opacity duration-[1.2s] ease-out"
        style={{
          opacity: inVideo ? 0.25 : 1,
          background: `
            radial-gradient(ellipse 70% 55% at 50% 38%, rgba(180,124,255,0.09) 0%, transparent 65%),
            radial-gradient(ellipse 50% 40% at 22% 65%, rgba(255,92,161,0.07) 0%, transparent 60%),
            radial-gradient(ellipse 45% 35% at 78% 58%, rgba(108,124,255,0.06) 0%, transparent 55%)
          `,
        }}
      />

      {/* ════════ ISOMETRIC GRID ════════ */}
      <div
        className="absolute inset-0 z-10 flex items-center justify-center transition-[transform,opacity] duration-[1300ms] ease-[cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none"
        style={{
          transform: inVideo ? GRID_BEHIND : GRID_ACTIVE,
          opacity: inVideo ? 0.14 : 0.94,
          pointerEvents: inVideo ? "none" : undefined,
        }}
      >
        <div
          aria-hidden
          onPointerDown={onGridPointerDown}
          className="relative grid h-[135vh] max-h-[1600px] w-[135vw] max-w-[1600px] grid-cols-8 grid-rows-6 gap-2 p-4 sm:gap-3.5 sm:p-6"
          style={{
            touchAction: "manipulation",
            WebkitMaskImage:
              "radial-gradient(ellipse 58% 52% at 50% 46%, #000 34%, transparent 100%)",
            maskImage:
              "radial-gradient(ellipse 58% 52% at 50% 46%, #000 34%, transparent 100%)",
          }}
        >
          {PADS.map((p) => (
            <div
              key={p.i}
              data-pad={p.i}
              className="group relative cursor-pointer overflow-hidden rounded-[5px] border border-white/[0.055] bg-white/[0.018] shadow-[inset_0_1px_0_rgba(255,255,255,0.045)] transition-all duration-200 active:scale-[0.94] sm:rounded-lg
                [@media(hover:hover)]:hover:border-white/22
                [@media(hover:hover)]:hover:bg-white/[0.09]
                [@media(hover:hover)]:hover:shadow-[0_0_24px_-6px_rgba(255,255,255,0.14),inset_0_1px_0_rgba(255,255,255,0.1)]"
            >
              {/* top edge light */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-50"
              />

              {/* idle glow */}
              {p.glow && (
                <div
                  className="mh-anim pointer-events-none absolute inset-0"
                  style={
                    {
                      background: `radial-gradient(circle at 50% 45%, ${p.glow.color} 0%, transparent 68%)`,
                      animation: `mh-pulse ${p.glow.duration}s ease-in-out infinite`,
                      animationDelay: `${p.glow.delay}s`,
                    } as CSSProperties
                  }
                />
              )}

              {/* wave sweep */}
              {phase === "wave" && (
                <div
                  className="mh-anim pointer-events-none absolute inset-0"
                  style={
                    {
                      background: `radial-gradient(circle at 50% 50%, ${p.color} 0%, transparent 65%)`,
                      animation:
                        "mh-wave 560ms cubic-bezier(.2,.85,.15,1) both",
                      animationDelay: `${(p.row + p.col) * 36}ms`,
                    } as CSSProperties
                  }
                />
              )}

              {/* press flash */}
              <div
                data-flash
                className="pointer-events-none absolute inset-0 opacity-0"
                style={{
                  background: `radial-gradient(circle at 50% 50%, ${p.color} 5%, transparent 68%)`,
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ════════ DEMO VIDEO CARD ════════ */}
      <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-4 pb-28 pt-20 sm:pb-32 sm:pt-24">
        <div
          className="relative will-change-transform transition-[transform,opacity] duration-[1150ms] ease-[cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none"
          style={{
            width:
              "max(280px, min(94vw, 960px, calc((100svh - 13.5rem) * 1.7778)))",
            transform: inVideo ? CARD_SHOWN : CARD_HIDDEN,
            opacity: inVideo ? 1 : 0,
            pointerEvents: inVideo ? "auto" : "none",
          }}
          aria-hidden={!inVideo}
        >
          {/* bloom behind card */}
          <div
            aria-hidden
            className="mh-anim pointer-events-none absolute -inset-10 rounded-[48px] blur-3xl"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(255,92,161,0.4) 0%, rgba(180,124,255,0.22) 38%, transparent 68%)",
              animation: inVideo
                ? "mh-bloom 5s ease-in-out infinite"
                : "none",
              opacity: inVideo ? undefined : 0,
            }}
          />

          {/* animated gradient border */}
          <div
            className="mh-anim relative rounded-[22px] p-[1.5px] shadow-[0_48px_120px_-28px_rgba(0,0,0,0.75),0_0_0_1px_rgba(255,255,255,0.04)]"
            style={{
              background:
                "linear-gradient(115deg,#FF5CA1 0%,#B47CFF 25%,#6C7CFF 50%,#FF8A3D 75%,#FF5CA1 100%)",
              backgroundSize: "240% 100%",
              animation: "mh-border 8s linear infinite",
            }}
          >
            <div className="relative aspect-video overflow-hidden rounded-[20.5px] bg-[#08090C]">
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

              {/* subtle scan line (only while playing) */}
              {inVideo && !reduced && (
                <div
                  aria-hidden
                  className="mh-anim pointer-events-none absolute inset-0 overflow-hidden"
                >
                  <div
                    className="absolute inset-x-0 h-16 bg-gradient-to-b from-transparent via-white/[0.04] to-transparent"
                    style={{ animation: "mh-scan 7.5s ease-in-out infinite" }}
                  />
                </div>
              )}

              {/* sound toggle */}
              <button
                type="button"
                onClick={() => setMuted((m) => !m)}
                aria-pressed={!muted}
                aria-label={muted ? "Turn sound on" : "Turn sound off"}
                tabIndex={inVideo ? 0 : -1}
                className={`absolute right-3 top-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/55 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/90 shadow-lg backdrop-blur-md transition-all hover:bg-black/75 hover:text-white ${FOCUS}`}
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

              {/* progress */}
              <div
                className="absolute inset-x-0 bottom-0 h-[2.5px] bg-white/10"
                aria-hidden
              >
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

      {/* soft bottom fade into page */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[25] h-56"
        style={{
          background: `linear-gradient(to top, ${fadeTo} 0%, ${fadeTo}e6 25%, transparent 100%)`,
        }}
      />

      {/* ════════ BUTTONS ════════ */}
      <div className="pointer-events-none absolute inset-x-0 bottom-6 z-30 mx-auto flex max-w-4xl items-center justify-center gap-3 px-5 sm:bottom-9 sm:gap-4">
        {inVideo ? (
          <>
            <Link
              href={ctaHref}
              className={`pointer-events-auto rounded-full bg-gradient-to-r from-[#FF5CA1] to-[#FF8A3D] px-6 py-3 text-xs font-bold uppercase tracking-widest text-white shadow-[0_10px_32px_-8px_rgba(255,92,161,0.6)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_36px_-8px_rgba(255,92,161,0.72)] active:translate-y-0 ${FOCUS}`}
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
              className={`group pointer-events-auto inline-flex items-center gap-2.5 rounded-full border border-white/20 bg-black/55 px-5 py-3 text-xs font-semibold uppercase tracking-widest text-white/90 backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-white/30 hover:bg-black/70 hover:text-white disabled:opacity-50 disabled:hover:translate-y-0 ${FOCUS}`}
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-[#FF5CA1] to-[#FF8A3D] text-[9px] text-white shadow-[0_0_14px_-2px_rgba(255,92,161,0.75)] transition-transform duration-300 group-hover:scale-110">
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