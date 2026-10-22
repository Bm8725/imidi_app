'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";

/* ════════════════════════════════════════════════════════════════
   MediaHero · isometric live-sequencer grid with a demo video
   Cycle: grid (isometric) -> diagonal light wave -> grid "flips up" into the demo video -> back to the grid.
   Meant to be the background of a hero section: it fills its (relative) parent.
   ════════════════════════════════════════════════════════════════ */

export type MediaHeroPhase = "grid" | "wave" | "video";

// Constante de configurare plasate clar în exterior
const COLS = 8;
const ROWS = 6;
const COLORS = ["#FF5CA1", "#FF8A3D", "#B47CFF", "#6C7CFF"];

const GRID_ACTIVE = "perspective(1000px) rotateX(60deg) rotateZ(-20deg) translateY(-5%) scale(1.15)";
const GRID_BEHIND = "perspective(1000px) rotateX(35deg) rotateZ(-10deg) translateY(-6%) scale(0.9)";
const CARD_HIDDEN = "perspective(1200px) rotateX(58deg) rotateZ(-20deg) translateY(22%) scale(0.5)";
const CARD_SHOWN = "perspective(1200px) rotateX(0deg) rotateZ(0deg) translateY(0%) scale(1)";

const WAVE_MS = 950; 
const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5CA1] focus-visible:ring-offset-2 focus-visible:ring-offset-black";

// Generare memoizată/statică instanțiată o singură dată la runtime
const GLOW = new Map<number, { delay: number; duration: number; color: string }>();
for (let k = 0; k < 16; k++) {
  const row = (k * 3 + 1) % ROWS;
  const col = (k * 4 + 2) % COLS;
  GLOW.set(row * COLS + col, { 
    delay: (k % 7) * 0.8, 
    duration: 2.5 + (k % 4) * 0.5, 
    color: COLORS[k % COLORS.length] 
  });
}

const PADS = Array.from({ length: COLS * ROWS }, (_, i) => {
  const row = Math.floor(i / COLS);
  const col = i % COLS;
  return { i, row, col, color: COLORS[(row + col) % COLORS.length], glow: GLOW.get(i) };
});

interface MediaHeroProps {
  videoSrc?: string;
  poster?: string;
  autoCycle?: boolean;
  gridMs?: number;
  ctaHref?: string;
  fadeTo?: string;
  onPhaseChange?: (phase: MediaHeroPhase) => void;
  onPadTrigger?: (index: number) => void;
}

export default function MediaHero({
  videoSrc = "/airmidi-link-promo.mp4",
  poster = "/airmidi-link-poster.jpg",
  autoCycle = true,
  gridMs = 4500, 
  ctaHref = "/airmidi-link",
  fadeTo = "#131316", 
  onPhaseChange,
  onPadTrigger,
}: MediaHeroProps) {
  // 1. State-uri combinate logic pentru a reduce re-randările
  const [phase, setPhase] = useState<MediaHeroPhase>("grid");
  const [env, setEnv] = useState({ reduced: false, saveData: false });
  const [visibility, setVisibility] = useState({ inView: true, tabVisible: true });
  const [videoState, setVideoState] = useState({ warm: false, failed: false, muted: true });

  const rootRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);

  const active = visibility.inView && visibility.tabVisible;
  const inVideo = phase === "video";

  // 2. Sincronizare mediu (Prefers-reduced-motion & Data saver)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (navigator as any).connection;
    
    setEnv({
      reduced: mq.matches,
      saveData: !!connection?.saveData
    });

    const handleChange = () => setEnv(prev => ({ ...prev, reduced: mq.matches }));
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, []);

  // 3. Monitorizare vizibilitate (IntersectionObserver & Tab Visibility)
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const io = new IntersectionObserver(([entry]) => {
      setVisibility(prev => ({ ...prev, inView: entry.isIntersecting }));
    }, { threshold: 0.25 });
    
    io.observe(el);

    const handleVisibility = () => {
      setVisibility(prev => ({ ...prev, tabVisible: !document.hidden }));
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  // 4. Efect pentru controlul fazelor (Phase Machine)
  useEffect(() => {
    if (!active) {
      setPhase("grid");
      return;
    }

    let timerId: NodeJS.Timeout;

    if (phase === "grid") {
      if (autoCycle && !env.reduced && !env.saveData && !videoState.failed) {
        timerId = setTimeout(() => setPhase("wave"), gridMs);
      }
    } else if (phase === "wave") {
      timerId = setTimeout(() => setPhase("video"), env.reduced ? 0 : WAVE_MS);
    } else if (phase === "video") {
      const duration = (videoRef.current?.duration || 0) * 1000;
      timerId = setTimeout(() => setPhase("grid"), Math.max(20000, duration + 4000));
    }

    return () => clearTimeout(timerId);
  }, [phase, active, env.reduced, env.saveData, videoState.failed, autoCycle, gridMs]);

  // 5. Pre-încălzire video (Warm up)
  useEffect(() => {
    if (videoState.warm || !active || env.saveData || videoState.failed) return;
    const timerId = setTimeout(() => {
      setVideoState(prev => ({ ...prev, warm: true }));
    }, 1200);
    return () => clearTimeout(timerId);
  }, [active, env.saveData, videoState.failed, videoState.warm]);

  // 6. Callback-uri pentru evenimente de fază
  useEffect(() => {
    onPhaseChange?.(phase);
  }, [phase, onPhaseChange]);

  // 7. Control redare Video (Play / Pause)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (inVideo && active && !videoState.failed) {
      const timerId = setTimeout(() => {
        video.currentTime = 0;
        video.play().catch(() => {
          setVideoState(prev => ({ ...prev, failed: true }));
        });
      }, env.reduced ? 0 : 450);
      return () => clearTimeout(timerId);
    }

    video.pause();
  }, [inVideo, active, env.reduced, videoState.failed]);

  // 8. Control Mute selectiv
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = videoState.muted;
    }
  }, [videoState.muted]);

  // 9. Închidere prin tasta Escape
  useEffect(() => {
    if (!inVideo) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPhase("grid");
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [inVideo]);

  // 10. Handlers acțiuni utilizator
  const goDemo = useCallback(() => {
    setVideoState(prev => ({ ...prev, warm: true }));
    setPhase(prev => (prev === "grid" ? "wave" : prev));
  }, []);

  const goGrid = useCallback(() => setPhase("grid"), []);

  const onTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (video && barRef.current && video.duration) {
      barRef.current.style.transform = `scaleX(${video.currentTime / video.duration})`;
    }
  }, []);

  const onGridPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const pad = (e.target as HTMLElement).closest<HTMLElement>("[data-pad]");
    if (!pad) return;

    if (!env.reduced) {
      pad.querySelector<HTMLElement>("[data-flash]")?.animate(
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
      `}</style>
      {/* Restul codului tău JSX vine aici (a fost tăiat în cererea inițială) */}
    </div>
  );
}
