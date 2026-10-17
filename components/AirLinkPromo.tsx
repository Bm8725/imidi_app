"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

/**
 * Intermittent promo for the "Start a session" screen (only shown when NOT in a session).
 *
 *  - always visible: a slim strip with mini launch pads
 *  - now and then (max `maxAuto` times per visit): the pads light up in a diagonal wave,
 *    then the demo video unfolds below the strip, plays once and folds back
 *  - never while `paused` (modals open), never in a hidden tab, never off screen
 *
 * Test URLs:  ?promo=now  (quick first preview, ignores stored state)   ?motion=full  (ignore OS "reduce motion")
 */

type Phase = "idle" | "wave" | "video";

const KEY_OFF = "airlink-promo-off"; // previews stopped by the visitor (this visit)
const KEY_N = "airlink-promo-n"; // how many previews already ran (this visit)
const COLORS = ["#2563EB", "#0D9488", "#F59E0B", "#6366F1"];
const WAVE_MS = 900;
const EASE = "cubic-bezier(.2,.8,.2,1)";
const CARD_HIDDEN = "perspective(900px) rotateX(38deg) translateY(28px) scale(0.9)";
const CARD_SHOWN = "perspective(900px) rotateX(0deg) translateY(0px) scale(1)";

export default function AirLinkPromo({
  src = "/airmidi-link-promo.mp4",
  poster = "/airmidi-link-poster.jpg",
  firstDelayMs = 6000, // first preview after this long on the screen
  gapMs = 25000, // pause between previews
  maxAuto = 3, // automatic previews per visit
  paused = false, // pass true while a modal is open
}: {
  src?: string;
  poster?: string;
  firstDelayMs?: number;
  gapMs?: number;
  maxAuto?: number;
  paused?: boolean;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [autoOff, setAutoOff] = useState(false);
  const [plays, setPlays] = useState(0);
  const [tabVisible, setTabVisible] = useState(true);
  const [inView, setInView] = useState(true);
  const [osReduced, setOsReduced] = useState(false);
  const [forced, setForced] = useState(false);
  const [fast, setFast] = useState(false);
  const [videoOk, setVideoOk] = useState(true);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const full = !osReduced || forced;
  const open = phase === "video";

  // stored state, URL flags, OS motion preference, tab visibility
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const quick = q.get("promo") === "now";
    setFast(quick);
    setForced(q.get("motion") === "full");
    if (quick) {
      try {
        sessionStorage.removeItem(KEY_OFF);
        sessionStorage.removeItem(KEY_N);
      } catch {
        /* storage unavailable */
      }
    } else {
      try {
        setAutoOff(sessionStorage.getItem(KEY_OFF) === "1");
        setPlays(Number(sessionStorage.getItem(KEY_N)) || 0);
      } catch {
        /* storage unavailable */
      }
    }
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setOsReduced(mq.matches);
    const onMq = () => setOsReduced(mq.matches);
    mq.addEventListener("change", onMq);
    const onVis = () => setTabVisible(!document.hidden);
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      mq.removeEventListener("change", onMq);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // only while on screen
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const finish = useCallback(() => {
    setPhase("idle");
    setPlays((p) => {
      const n = p + 1;
      try {
        sessionStorage.setItem(KEY_N, String(n));
      } catch {
        /* storage unavailable */
      }
      return n;
    });
  }, []);

  // never run while a modal is open or the tab is hidden
  useEffect(() => {
    if (phase !== "idle" && (paused || !tabVisible)) setPhase("idle");
  }, [paused, tabVisible, phase]);

  // idle -> wave -> video (the video calls finish() when it ends)
  useEffect(() => {
    if (!videoOk) return;
    let id: ReturnType<typeof setTimeout> | undefined;
    if (phase === "idle") {
      const canAuto = full && !autoOff && !paused && tabVisible && inView && plays < maxAuto;
      if (canAuto) {
        const wait = plays === 0 ? (fast ? 1200 : firstDelayMs) : fast ? 8000 : gapMs;
        id = setTimeout(() => setPhase("wave"), wait);
      }
    } else if (phase === "wave") {
      id = setTimeout(() => setPhase("video"), WAVE_MS);
    } else {
      id = setTimeout(finish, 20000); // safety net if the video can't play
    }
    return () => {
      if (id) clearTimeout(id);
    };
  }, [phase, videoOk, full, autoOff, paused, tabVisible, inView, plays, maxAuto, fast, firstDelayMs, gapMs, finish]);

  // play when the card has mostly unfolded; pause otherwise
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (phase === "video" && tabVisible) {
      const id = setTimeout(() => {
        v.muted = true;
        v.currentTime = 0;
        v.play().catch(() => {
          /* autoplay blocked: the poster stays, controls are shown in calm mode */
        });
      }, full ? 450 : 100);
      return () => clearTimeout(id);
    }
    v.pause();
  }, [phase, tabVisible, full]);

  const playNow = () => setPhase((p) => (p === "idle" ? (full ? "wave" : "video") : p));
  const closeNow = () => setPhase("idle");
  const stopAuto = () => {
    setAutoOff(true);
    try {
      sessionStorage.setItem(KEY_OFF, "1");
    } catch {
      /* storage unavailable */
    }
    setPhase("idle");
  };

  if (!videoOk) return null; // video file missing: show nothing instead of a broken box

  return (
    <div ref={rootRef} data-ap={forced ? "force" : "safe"} className="w-full">
      <style>{`
        @keyframes ap-pulse { 0%,100% { opacity:.2 } 50% { opacity:.9 } }
        @keyframes ap-wave { 0% { opacity:.2; transform:scale(.7) } 40% { opacity:1; transform:scale(1.3) } 100% { opacity:.35; transform:scale(1) } }
        @keyframes ap-eq { 0%,100% { transform:scaleY(.25) } 50% { transform:scaleY(1) } }
        @keyframes ap-flow { 0% { background-position:0% 50% } 100% { background-position:200% 50% } }
        @media (prefers-reduced-motion: reduce) {
          [data-ap="safe"] .ap-a { animation: none !important; }
        }
      `}</style>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        {/* strip */}
        <div className="flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3">
          <div className="grid grid-cols-8 gap-[3px] shrink-0" aria-hidden>
            {Array.from({ length: 16 }).map((_, i) => {
              const row = Math.floor(i / 8);
              const col = i % 8;
              const style: CSSProperties = {
                background: COLORS[(row + col) % 4],
                opacity: 0.22,
                animation:
                  phase === "wave"
                    ? `ap-wave 450ms ease-out ${(row + col) * 45}ms both`
                    : i % 3 === 0
                    ? `ap-pulse ${2 + (i % 4) * 0.5}s ease-in-out ${(i % 5) * 0.4}s infinite`
                    : undefined,
              };
              return <span key={i} className="ap-a w-2.5 h-2.5 rounded-[3px]" style={style} />;
            })}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
              {open ? "Now playing: AirMIDI Link in 15 seconds" : "See AirMIDI Link in 15 seconds"}
            </p>
            <p className="text-[11px] text-slate-500 truncate">Real-time MIDI, video and voice · just a 6-digit code</p>
          </div>

          {open ? (
            <>
              <span className="hidden sm:flex items-end gap-[3px] h-4" aria-hidden>
                {[0, 0.15, 0.3, 0.1].map((d, i) => (
                  <span
                    key={i}
                    className="ap-a w-[3px] h-full rounded-full bg-blue-600 origin-bottom"
                    style={{ animation: `ap-eq .8s ease-in-out ${d}s infinite` }}
                  />
                ))}
              </span>
              <button
                onClick={closeNow}
                className="shrink-0 h-9 px-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-colors"
              >
                Close
              </button>
            </>
          ) : (
            <>
              <button
                onClick={playNow}
                className="shrink-0 inline-flex items-center gap-2 h-9 px-3.5 rounded-lg bg-[#0F1B2D] text-white text-xs font-bold hover:bg-[#1E3050] active:scale-95 transition-all"
              >
                <span className="flex w-4 h-4 rounded-full bg-white/20 items-center justify-center text-[8px]">▶</span>
                Watch
              </button>
              {!autoOff && (
                <button
                  onClick={stopAuto}
                  aria-label="Stop automatic previews"
                  title="Stop automatic previews"
                  className="shrink-0 w-8 h-8 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors text-xs"
                >
                  ✕
                </button>
              )}
            </>
          )}
        </div>

        {/* the video unfolds under the strip */}
        <div
          style={{
            display: "grid",
            gridTemplateRows: open ? "1fr" : "0fr",
            transition: full ? `grid-template-rows 700ms ${EASE}` : "none",
          }}
        >
          <div style={{ overflow: "hidden", minHeight: 0 }}>
            <div className="px-3 sm:px-4 pb-3 sm:pb-4">
              <div
                style={{
                  transform: full ? (open ? CARD_SHOWN : CARD_HIDDEN) : CARD_SHOWN,
                  opacity: open ? 1 : 0,
                  transition: full ? `transform 800ms ${EASE}, opacity 600ms ease` : "opacity 400ms ease",
                  transformOrigin: "50% 0%",
                }}
                aria-hidden={!open}
              >
                <div
                  className="ap-a rounded-xl p-[1.5px]"
                  style={{
                    background: "linear-gradient(90deg,#2563EB,#0D9488,#F59E0B,#2563EB)",
                    backgroundSize: "200% 100%",
                    animation: "ap-flow 6s linear infinite",
                  }}
                >
                  <div className="relative aspect-video overflow-hidden rounded-[10px] bg-[#0D0E12]">
                    <video
                      ref={videoRef}
                      src={src}
                      poster={poster}
                      muted
                      playsInline
                      preload="auto"
                      controls={!full}
                      onEnded={finish}
                      onError={() => setVideoOk(false)}
                      aria-label="AirMIDI Link demo"
                      className="h-full w-full object-cover"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}