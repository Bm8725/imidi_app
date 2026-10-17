'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";

// Concept: Interactive Isometric Live Sequencer Matrix (Launchpad / Grid Controller)
// Cycle: grid (isometric) -> diagonal light wave -> the grid "flips up" into the demo video -> back to the grid.
// Fully transparent background, no ambient shadows or massive gradients (except the video frame).

type Phase = "grid" | "wave" | "video";

const GLOW_PADS = Array.from({ length: 16 }, (_, i) => {
  const row = (i * 3 + 1) % 6;
  const col = (i * 4 + 2) % 8;
  const delay = (i % 7) * 0.8;
  const duration = 2.5 + (i % 4) * 0.5;
  const colors = ["#E2861A", "#0B7285", "#6B4FA0", "#C77313"];
  const color = colors[i % colors.length];
  return { row, col, delay, duration, color };
});

const WAVE_COLORS = ["#E2861A", "#0B7285", "#6B4FA0", "#C77313"];

const GRID_ACTIVE = "perspective(1000px) rotateX(60deg) rotateZ(-20deg) translateY(-5%) scale(1.2)";
const GRID_BEHIND = "perspective(1000px) rotateX(35deg) rotateZ(-10deg) translateY(-6%) scale(0.9)";
const CARD_HIDDEN = "perspective(1200px) rotateX(58deg) rotateZ(-20deg) translateY(22%) scale(0.5)";
const CARD_SHOWN = "perspective(1200px) rotateX(0deg) rotateZ(0deg) translateY(0%) scale(1)";

const WAVE_MS = 950; // how long the light wave runs before the video appears

export default function MediaHero({
  videoSrc = "/airmidi-link-promo.mp4",
  poster = "/airmidi-link-poster.jpg",
  autoCycle = true,
  gridMs = 4500, // how long the grid stays alone before the video comes up
  ctaHref = "/airmidi-link",
}: {
  videoSrc?: string;
  poster?: string;
  autoCycle?: boolean;
  gridMs?: number;
  ctaHref?: string;
}) {
  const [phase, setPhase] = useState<Phase>("grid");
  const [visible, setVisible] = useState(true);
  const [reduced, setReduced] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const handlePadClick = (index: number) => {
    console.log(`MIDI Note Triggered: Pad ${index}`);
  };

  // respect "reduce motion"
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  // only run the cycle (and the video) while the hero is on screen
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([e]) => {
        setVisible(e.isIntersecting);
        if (!e.isIntersecting) setPhase("grid");
      },
      { threshold: 0.25 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // grid -> wave -> video (the video itself calls setPhase("grid") when it ends)
  useEffect(() => {
    if (!visible || reduced || !autoCycle) return;
    let id: ReturnType<typeof setTimeout>;
    if (phase === "grid") id = setTimeout(() => setPhase("wave"), gridMs);
    else if (phase === "wave") id = setTimeout(() => setPhase("video"), WAVE_MS);
    else id = setTimeout(() => setPhase("grid"), 20000); // safety net if the video can't play
    return () => clearTimeout(id);
  }, [phase, visible, reduced, autoCycle, gridMs]);

  // start the video once the card has mostly settled; pause it otherwise
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (phase === "video" && visible) {
      const id = setTimeout(() => {
        v.currentTime = 0;
        v.play().catch(() => {
          /* autoplay blocked: the poster stays visible */
        });
      }, 450);
      return () => clearTimeout(id);
    }
    v.pause();
  }, [phase, visible]);

  const goDemo = useCallback(() => setPhase((p) => (p === "grid" ? "wave" : p)), []);
  const goGrid = useCallback(() => setPhase("grid"), []);

  const inVideo = phase === "video";

  return (
    <div ref={rootRef} className="absolute inset-0 overflow-hidden bg-transparent select-none">
      <style>{`
        @keyframes pad-pulse {
          0%, 100% { opacity: 0.05; }
          45%, 55% { opacity: 0.6; }
        }
        @keyframes pad-wave {
          0%   { opacity: 0;    transform: scale(.55); }
          35%  { opacity: 0.95; transform: scale(1); }
          100% { opacity: 0;    transform: scale(1.15); }
        }
        @keyframes border-flow {
          0%   { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
        @media (prefers-reduced-motion: reduce) {
          .mh-anim { animation: none !important; }
        }
      `}</style>

      {/* Transformarea Izometrică 3D a Consolei */}
      <div
        className="absolute inset-0 flex items-center justify-center z-10 transition-[transform,opacity] duration-[1100ms] ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none"
        style={{
          transform: inVideo ? GRID_BEHIND : GRID_ACTIVE,
          opacity: inVideo ? 0.28 : 0.9,
          pointerEvents: inVideo ? "none" : undefined,
        }}
      >
        {/* Rețeaua principală de Sequencer */}
        <div
          className="relative w-[140vw] h-[140vh] max-w-[1600px] max-h-[1600px] grid grid-cols-8 grid-rows-6 gap-3 sm:gap-5 p-6 rounded-3xl"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(255, 255, 255, 0.01) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(255, 255, 255, 0.01) 1px, transparent 1px)
            `,
            backgroundSize: "12.5% 16.666%",
          }}
        >
          {Array.from({ length: 48 }).map((_, i) => {
            const activePad = GLOW_PADS.find((p) => p.row * 8 + p.col === i);
            const row = Math.floor(i / 8);
            const col = i % 8;

            return (
              <button
                key={`pad-${i}`}
                onClick={() => handlePadClick(i)}
                aria-label={`MIDI Pad ${i + 1}`}
                className="w-full h-full rounded-md sm:rounded-lg border border-white/[0.03] bg-white/[0.01] backdrop-blur-[1px]
                           transition-all duration-150 hover:bg-white/[0.06] hover:border-white/10
                           active:scale-95 active:bg-white/10 pointer-events-auto cursor-pointer
                           relative overflow-hidden group focus:outline-none"
              >
                {/* Stratul de animație live dacă pad-ul este unul activ în secvență */}
                {activePad && (
                  <div
                    className="mh-anim absolute inset-0 pointer-events-none rounded-md sm:rounded-lg"
                    style={{
                      background: `radial-gradient(circle at center, ${activePad.color} 20%, transparent 80%)`,
                      animation: `pad-pulse ${activePad.duration}s ease-in-out infinite`,
                      animationDelay: `${activePad.delay}s`,
                    } as CSSProperties}
                  />
                )}

                {/* Valul diagonal care anunță tranziția spre video */}
                {phase === "wave" && (
                  <div
                    className="mh-anim absolute inset-0 pointer-events-none rounded-md sm:rounded-lg"
                    style={{
                      background: `radial-gradient(circle at center, ${WAVE_COLORS[(row + col) % 4]} 15%, transparent 78%)`,
                      animation: "pad-wave 450ms ease-out both",
                      animationDelay: `${(row + col) * 45}ms`,
                    } as CSSProperties}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Videoul de prezentare: se ridică din grilă (de la înclinat la plat) */}
      <div className="absolute inset-0 z-20 flex items-center justify-center px-4 pb-20 sm:pb-24 pointer-events-none">
        <div
          className="w-[min(92vw,980px)] will-change-transform transition-[transform,opacity] duration-[1000ms] ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none"
          style={{
            transform: inVideo ? CARD_SHOWN : CARD_HIDDEN,
            opacity: inVideo ? 1 : 0,
            pointerEvents: inVideo ? "auto" : "none",
          }}
          aria-hidden={!inVideo}
        >
          {/* bordură cu gradient animat (culorile padurilor tale) */}
          <div
            className="mh-anim rounded-[22px] p-[1.5px] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.5)]"
            style={{
              background: "linear-gradient(90deg,#E2861A,#6B4FA0,#0B7285,#E2861A)",
              backgroundSize: "200% 100%",
              animation: "border-flow 6s linear infinite",
            }}
          >
            <div className="relative aspect-video overflow-hidden rounded-[20px] bg-[#0D0E12]">
              <video
                ref={videoRef}
                src={videoSrc}
                poster={poster}
                muted
                playsInline
                preload="auto"
                onEnded={goGrid}
                aria-label="AirMIDI Link demo"
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </div>
      </div>

      {/* CTA-uri live ancorate peste grid */}
      <div className="absolute inset-x-0 bottom-10 sm:bottom-14 z-30 flex flex-row justify-center items-center gap-3 sm:gap-5 px-5 pointer-events-auto max-w-4xl mx-auto">
        {inVideo ? (
          <>
            <Link
              href={ctaHref}
              className="rounded-full bg-[#6B4FA0] px-6 py-3 text-xs font-bold uppercase tracking-widest text-white shadow-lg transition-all hover:-translate-y-0.5 hover:bg-[#5b4189] active:translate-y-0"
            >
              Try AirMIDI Link
            </Link>
            <button
              onClick={goGrid}
              className="rounded-full border border-white/25 bg-black/50 px-5 py-3 text-xs font-semibold uppercase tracking-widest text-white backdrop-blur transition-colors hover:bg-black/65"
            >
              Back to the grid
            </button>
          </>
        ) : (
          <button
            onClick={goDemo}
            className="group inline-flex items-center gap-2.5 rounded-full border border-white/25 bg-black/50 px-5 py-3 text-xs font-semibold uppercase tracking-widest text-white backdrop-blur transition-all hover:-translate-y-0.5 hover:bg-black/65"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#E2861A] text-[9px] text-white transition-transform group-hover:scale-110">
              ▶
            </span>
            Watch the demo
          </button>
        )}
        
      </div>
    </div>
  );
}