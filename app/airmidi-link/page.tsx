"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { supabase } from "@/lib/supabase";
import { AirMidiLink, AirMidiStatus, AirMidiLogLevel, AirMidiPeer, VideoQuality, peerFromUser } from "@/lib/AirMidiLink";

/* ---------------------------------------------------------------------- */
/* Types & helpers                                                         */
/* ---------------------------------------------------------------------- */
type LogLevel = AirMidiLogLevel | "midi";
type LogEntry = { id: number; time: string; level: LogLevel; message: string };

const STATUS_META: Record<
  AirMidiStatus,
  { label: string; dot: string; pill: string; pulse: boolean }
> = {
  idle: { label: "Idle", dot: "bg-zinc-400", pill: "bg-zinc-100 text-zinc-600 border-zinc-200", pulse: false },
  initializing: { label: "Initializing", dot: "bg-amber-500", pill: "bg-amber-50 text-amber-700 border-amber-200", pulse: true },
  waiting: { label: "Waiting for receiver", dot: "bg-indigo-500", pill: "bg-indigo-50 text-indigo-700 border-indigo-200", pulse: true },
  connecting: { label: "Connecting", dot: "bg-amber-500", pill: "bg-amber-50 text-amber-700 border-amber-200", pulse: true },
  connected: { label: "Live", dot: "bg-emerald-500", pill: "bg-emerald-50 text-emerald-700 border-emerald-200", pulse: true },
  disconnected: { label: "Disconnected", dot: "bg-red-500", pill: "bg-red-50 text-red-700 border-red-200", pulse: false },
};

const LEVEL_STYLE: Record<LogLevel, { tag: string; color: string }> = {
  info: { tag: "INFO", color: "text-sky-400" },
  success: { tag: "OK", color: "text-emerald-400" },
  warn: { tag: "WARN", color: "text-amber-400" },
  error: { tag: "ERROR", color: "text-red-400" },
  midi: { tag: "MIDI", color: "text-violet-400" },
};

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const noteName = (n: number) => `${NOTE_NAMES[n % 12]}${Math.floor(n / 12) - 1}`;

function decodeMidi(d: Uint8Array): string {
  const s = d[0];
  if (s >= 0xf0) {
    switch (s) {
      case 0xf0: return `SysEx (${d.length} bytes)`;
      case 0xfa: return "Transport Start";
      case 0xfb: return "Transport Continue";
      case 0xfc: return "Transport Stop";
      case 0xff: return "System Reset";
      default: return `System 0x${s.toString(16).toUpperCase()}`;
    }
  }
  const type = s & 0xf0;
  const ch = (s & 0x0f) + 1;
  switch (type) {
    case 0x80: return `Note Off  ch${ch}  ${noteName(d[1])}  vel ${d[2]}`;
    case 0x90:
      return d[2] === 0
        ? `Note Off  ch${ch}  ${noteName(d[1])}`
        : `Note On   ch${ch}  ${noteName(d[1])}  vel ${d[2]}`;
    case 0xa0: return `Poly Aftertouch  ch${ch}  ${noteName(d[1])}  ${d[2]}`;
    case 0xb0: return `Control Change  ch${ch}  CC${d[1]} = ${d[2]}`;
    case 0xc0: return `Program Change  ch${ch}  #${d[1]}`;
    case 0xd0: return `Channel Pressure  ch${ch}  ${d[1]}`;
    case 0xe0: return `Pitch Bend  ch${ch}  ${((d[2] << 7) | d[1]) - 8192}`;
    default: return `Unknown 0x${s.toString(16).toUpperCase()}`;
  }
}

const toHex = (d: Uint8Array) =>
  Array.from(d).map((b) => b.toString(16).padStart(2, "0").toUpperCase()).join(" ");

// long messages (SysEx dumps) are shortened in the log
const toHexShort = (d: Uint8Array, max = 24) =>
  d.length <= max ? toHex(d) : `${toHex(d.subarray(0, max))} … (+${d.length - max} bytes)`;

const nowStamp = () => {
  const d = new Date();
  const p = (n: number, l = 2) => String(n).padStart(l, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
};

const formatElapsed = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

// viewport width, used to adapt the full screen overlay (phone / tablet / desktop)
function useViewportWidth() {
  const [w, setW] = useState(1024);
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    on();
    window.addEventListener("resize", on);
    window.addEventListener("orientationchange", on);
    return () => {
      window.removeEventListener("resize", on);
      window.removeEventListener("orientationchange", on);
    };
  }, []);
  return w;
}

/* ---------------------------------------------------------------------- */
/* Small UI pieces                                                         */
/* ---------------------------------------------------------------------- */
const Check = () => (
  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 13l4 4L19 7" />
  </svg>
);

// Horizontal stepper (mobile / tablet)
function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex items-center w-full mb-8 lg:hidden">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex items-center flex-1 last:flex-none">
            <div className="flex items-center gap-2">
              <span
                className={`relative flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-bold transition-all duration-500 ${
                  done
                    ? "bg-indigo-600 text-white"
                    : active
                    ? "bg-white text-indigo-600 border-2 border-indigo-600"
                    : "bg-white text-zinc-400 border border-zinc-300"
                }`}
              >
                {done ? <Check /> : i + 1}
                {active && <span className="absolute inset-0 rounded-full bg-indigo-500/30 am-ring" />}
              </span>
              <span className={`hidden sm:block text-[11px] font-semibold transition-colors ${done || active ? "text-zinc-900" : "text-zinc-400"}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <span className="flex-1 mx-3 h-px bg-zinc-200 relative overflow-hidden">
                <span className={`absolute inset-y-0 left-0 bg-indigo-600 transition-all duration-700 ${done ? "w-full" : "w-0"}`} />
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

// Vertical workflow (desktop left rail)
function VerticalSteps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol>
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="relative flex gap-3 pb-6 last:pb-0">
            {i < steps.length - 1 && (
              <span className="absolute left-[13px] top-8 bottom-0 w-px bg-zinc-200 overflow-hidden">
                <span className={`absolute inset-x-0 top-0 bg-indigo-600 transition-all duration-700 ${done ? "h-full" : "h-0"}`} />
              </span>
            )}
            <span
              className={`relative shrink-0 flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-bold transition-all duration-500 ${
                done
                  ? "bg-indigo-600 text-white"
                  : active
                  ? "bg-white text-indigo-600 border-2 border-indigo-600"
                  : "bg-white text-zinc-400 border border-zinc-300"
              }`}
            >
              {done ? <Check /> : i + 1}
              {active && <span className="absolute inset-0 rounded-full bg-indigo-500/30 am-ring" />}
            </span>
            <div className="pt-0.5">
              <p className={`text-xs font-bold transition-colors ${done || active ? "text-zinc-900" : "text-zinc-400"}`}>{label}</p>
              <p className="text-[10px] text-zinc-400 mt-0.5">{done ? "Completed" : active ? "In progress" : "Pending"}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function ScanBar({ label }: { label: string }) {
  return (
    <div className="space-y-3 py-2">
      <div className="relative h-1.5 w-full rounded-full bg-zinc-100 overflow-hidden">
        <span className="absolute inset-y-0 w-1/3 rounded-full bg-gradient-to-r from-transparent via-indigo-500 to-transparent am-scan" />
      </div>
      <p className="text-xs text-zinc-500 text-center">{label}</p>
    </div>
  );
}

const AVATAR_GRADIENTS = [
  "from-indigo-500 to-violet-500",
  "from-sky-500 to-indigo-500",
  "from-fuchsia-500 to-pink-500",
  "from-emerald-500 to-teal-500",
  "from-amber-500 to-orange-500",
];

function Avatar({ name, src, size = 56 }: { name: string; src?: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  const initial = (name.trim()[0] || "?").toUpperCase();
  const g = AVATAR_GRADIENTS[name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_GRADIENTS.length];
  const style = { width: size, height: size };
  if (src && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        style={style}
        className="rounded-full object-cover"
        draggable={false}
      />
    );
  }
  return (
    <span
      style={{ ...style, fontSize: size * 0.4 }}
      className={`rounded-full bg-gradient-to-br ${g} text-white font-bold flex items-center justify-center`}
    >
      {initial}
    </span>
  );
}

function PeerSide({
  p,
  label,
  isMe,
  dark = false,
}: {
  p: AirMidiPeer | null;
  label: string;
  isMe: boolean;
  dark?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2 min-w-0 w-[5.5rem] sm:w-36">
      <div className="relative">
        {p && <span className="absolute inset-0 rounded-full bg-emerald-400/30 am-ring" />}
        <div
          className={`relative rounded-full p-[3px] bg-gradient-to-br ${
            p ? "from-indigo-500 via-violet-500 to-fuchsia-500" : dark ? "from-white/20 to-white/10" : "from-zinc-200 to-zinc-300"
          }`}
        >
          <div className={`rounded-full p-0.5 ${dark ? "bg-[#0B1020]" : "bg-white"}`}>
            {p ? (
              <Avatar name={p.name} src={p.avatar} />
            ) : (
              <span
                className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold am-dot ${
                  dark ? "bg-white/10 text-white/40" : "bg-zinc-100 text-zinc-300"
                }`}
              >
                ?
              </span>
            )}
          </div>
        </div>
        {p && (
          <span
            className={`absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ${
              dark ? "ring-[#0B1020]" : "ring-white"
            }`}
          />
        )}
      </div>
      <div className="text-center min-w-0 w-full">
        <p className={`text-[10px] uppercase tracking-wider font-bold ${dark ? "text-white/40" : "text-zinc-400"}`}>
          {label}
          {isMe ? " · You" : ""}
        </p>
        <p
          key={p?.name || "none"}
          className={`am-fade-up text-sm font-bold truncate ${dark ? "text-white" : "text-zinc-900"}`}
        >
          {p ? p.name : "Identifying…"}
        </p>
        {p?.email && (
          <p className={`text-[10px] corp-mono truncate ${dark ? "text-white/40" : "text-zinc-400"}`}>{p.email}</p>
        )}
      </div>
    </div>
  );
}

// You <-> the other user, with data packets flowing sender -> receiver
function PeerLink({
  me,
  peer,
  myRole,
  active,
  dark = false,
}: {
  me: AirMidiPeer | null;
  peer: AirMidiPeer | null;
  myRole: "sender" | "receiver";
  active: boolean;
  dark?: boolean;
}) {
  const left = myRole === "sender" ? me : peer;
  const right = myRole === "sender" ? peer : me;
  return (
    <div className={dark ? "" : "bg-white border border-zinc-200 rounded-2xl p-4 sm:p-6 shadow-sm"}>
      <p
        className={`text-[10px] uppercase tracking-wider font-bold text-center mb-5 ${
          dark ? "text-white/40" : "text-zinc-400"
        }`}
      >
        {peer ? (myRole === "receiver" ? "Receiving from" : "Streaming to") : "Establishing link"}
      </p>
      <div className="flex items-center justify-center gap-1 sm:gap-4">
        <PeerSide p={left} label="Sender" isMe={myRole === "sender"} dark={dark} />
        <div className="relative flex-1 h-10 min-w-[40px] max-w-[220px]">
          <span
            className={`absolute left-0 right-0 top-1/2 -translate-y-1/2 border-t-2 border-dashed ${
              dark ? "border-white/20" : "border-indigo-200"
            }`}
          />
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{ animationDelay: `${i * 0.6}s`, animationDuration: active ? "0.9s" : "1.9s" }}
              className="am-flow absolute top-1/2 -translate-y-1/2 left-0 w-2.5 h-2.5 rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 shadow shadow-indigo-400/60"
            />
          ))}
        </div>
        <PeerSide p={right} label="Receiver" isMe={myRole === "receiver"} dark={dark} />
      </div>
    </div>
  );
}

/* ---- stage building blocks ---- */
const svgProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

const IcCamera = ({ off }: { off?: boolean }) => (
  <svg className="w-5 h-5" {...svgProps}>
    {off ? (
      <>
        <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </>
    ) : (
      <>
        <path d="M23 7l-7 5 7 5V7z" />
        <rect x="1" y="5" width="15" height="14" rx="2" />
      </>
    )}
  </svg>
);

const IcMic = ({ off }: { off?: boolean }) => (
  <svg className="w-5 h-5" {...svgProps}>
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
    {off && <line x1="1" y1="1" x2="23" y2="23" />}
  </svg>
);

const IcSpeaker = ({ muted }: { muted?: boolean }) => (
  <svg className="w-5 h-5" {...svgProps}>
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    {muted ? (
      <>
        <line x1="23" y1="9" x2="17" y2="15" />
        <line x1="17" y1="9" x2="23" y2="15" />
      </>
    ) : (
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    )}
  </svg>
);

const IcExpand = ({ exit }: { exit?: boolean }) => (
  <svg className="w-5 h-5" {...svgProps}>
    {exit ? (
      <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
    ) : (
      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
    )}
  </svg>
);

const IcEnd = () => (
  <svg className="w-5 h-5" {...svgProps}>
    <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
    <line x1="23" y1="1" x2="1" y2="23" />
  </svg>
);

function DockButton({
  onClick,
  label,
  active = false,
  danger = false,
  disabled = false,
  children,
}: {
  onClick: () => void;
  label: string;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`h-10 w-10 sm:h-12 sm:w-12 shrink-0 rounded-full border flex items-center justify-center transition-all duration-200 active:scale-90 disabled:opacity-50 ${
        danger
          ? "bg-red-600 border-red-400/60 text-white hover:bg-red-500"
          : active
          ? "bg-white border-white text-zinc-900"
          : "bg-white/10 border-white/15 text-white hover:bg-white/20"
      }`}
    >
      {children}
    </button>
  );
}

// MIDI is the priority: its activity is always visible on the stage
function MidiHud({
  active,
  last,
  channels,
  latency,
  path,
  throttled,
  className = "",
  textClass = "",
}: {
  active: boolean;
  last: string;
  channels: number[];
  latency: number | null;
  path: "direct" | "relay" | null;
  throttled: boolean;
  className?: string;
  textClass?: string;
}) {
  const color =
    latency === null ? "text-white/50" : latency < 30 ? "text-emerald-300" : latency < 80 ? "text-amber-300" : "text-red-300";
  return (
    <div
      className={`pointer-events-none absolute z-20 flex items-center gap-3 rounded-xl border border-white/10 bg-black/45 backdrop-blur-md px-3 py-2 ${className}`}
    >
      <span
        className={`shrink-0 w-2 h-2 rounded-full transition-colors duration-100 ${
          active ? "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,.9)]" : "bg-emerald-400"
        }`}
      />
      <div className="min-w-0">
        <p className="text-[9px] uppercase tracking-[0.14em] font-bold text-white/40">MIDI</p>
        <p className={`text-[11px] corp-mono text-white/90 truncate ${textClass}`}>{last}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[9px] uppercase tracking-[0.14em] font-bold text-white/40">
          {path === "relay" ? "Relay" : path === "direct" ? "Direct" : "Latency"}
        </p>
        <p className={`text-[11px] corp-mono font-semibold ${color}`}>
          {latency === null ? "…" : `≈${latency} ms`}
        </p>
      </div>
      {throttled && (
        <span className="shrink-0 text-[9px] font-bold text-amber-300 bg-amber-400/15 border border-amber-300/30 px-1.5 py-0.5 rounded-full">
          VIDEO ↓
        </span>
      )}
      <div className="hidden sm:flex items-end gap-[2px] h-6">
        {channels.map((v, i) => (
          <span
            key={i}
            className="w-[3px] rounded-sm bg-gradient-to-t from-indigo-500 to-fuchsia-400 transition-[height] duration-150"
            style={{ height: `${12 + v * 88}%`, opacity: 0.35 + v * 0.65 }}
          />
        ))}
      </div>
    </div>
  );
}

function Watermark({ className = "" }: { className?: string }) {
  return (
    <div
      className={`pointer-events-none select-none absolute z-20 flex items-center gap-1.5 text-[10px] sm:text-[11px] font-semibold tracking-wide text-white/75 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/airlink-icon.png" alt="" width={14} height={14} className="w-3.5 h-3.5 rounded-full opacity-90" draggable={false} />
      www.imidi.co.uk/airmidi-link
    </div>
  );
}

/* ---- piano keyboard: lights up with the MIDI notes in the link ---- */
const KB_RANGES: Record<number, [number, number]> = { 49: [36, 84], 61: [36, 96], 88: [21, 108] };
const BLACK_KEYS = new Set([1, 3, 6, 8, 10]);

const CHORDS: [string, number[]][] = [
  ["", [0, 4, 7]],
  ["m", [0, 3, 7]],
  ["dim", [0, 3, 6]],
  ["aug", [0, 4, 8]],
  ["sus2", [0, 2, 7]],
  ["sus4", [0, 5, 7]],
  ["maj7", [0, 4, 7, 11]],
  ["7", [0, 4, 7, 10]],
  ["m7", [0, 3, 7, 10]],
  ["m7♭5", [0, 3, 6, 10]],
  ["dim7", [0, 3, 6, 9]],
  ["mMaj7", [0, 3, 7, 11]],
  ["6", [0, 4, 7, 9]],
  ["m6", [0, 3, 7, 9]],
  ["add9", [0, 2, 4, 7]],
  ["m(add9)", [0, 2, 3, 7]],
  ["5", [0, 7]],
];

// notes: pressed MIDI notes, ascending. Returns e.g. "Cmaj7" or "Am/C" (inversion), or "".
function detectChord(notes: number[]): string {
  if (notes.length < 2) return "";
  const pcs = Array.from(new Set(notes.map((n) => n % 12))).sort((a, b) => a - b);
  const bass = notes[0] % 12;
  const roots = [bass, ...pcs.filter((x) => x !== bass)]; // the lowest note is tried first
  for (const root of roots) {
    const set = pcs.map((x) => (x - root + 12) % 12).sort((a, b) => a - b);
    for (const [name, iv] of CHORDS) {
      if (iv.length === set.length && iv.every((v, i) => v === set[i])) {
        return `${NOTE_NAMES[root]}${name}${root !== bass ? "/" + NOTE_NAMES[bass] : ""}`;
      }
    }
  }
  return "";
}

const IcKeys = () => (
  <svg className="w-5 h-5" {...svgProps}>
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="M7 4v8M12 4v16M17 4v8" />
  </svg>
);

// All drawing is done by direct DOM updates in its own animation loop (no React re-renders),
// so the keyboard never competes with the MIDI path.
function PianoKeyboard({
  size,
  vel,
  dir,
  sustain,
  dirty,
  variant = "light",
}: {
  size: number;
  vel: React.MutableRefObject<Uint8Array>;
  dir: React.MutableRefObject<Uint8Array>;
  sustain: React.MutableRefObject<number>;
  dirty: React.MutableRefObject<number>;
  variant?: "light" | "glass";
}) {
  const [lo, hi] = KB_RANGES[size] || KB_RANGES[61];
  const keyEls = useRef<(HTMLDivElement | null)[]>([]);
  const notesTextRef = useRef<HTMLSpanElement | null>(null);
  const chordTextRef = useRef<HTMLSpanElement | null>(null);
  const susRef = useRef<HTMLSpanElement | null>(null);

  const whites: number[] = [];
  const blacks: { n: number; at: number }[] = [];
  for (let n = lo; n <= hi; n++) {
    if (BLACK_KEYS.has(n % 12)) blacks.push({ n, at: whites.length });
    else whites.push(n);
  }
  const unit = 100 / whites.length;
  const blackW = unit * 0.62;

  useEffect(() => {
    const paint = (n: number, v: number, d: number) => {
      const el = keyEls.current[n];
      if (!el) return;
      if (!v) {
        el.style.background = "";
        el.style.boxShadow = "";
        el.style.transform = "";
        el.style.borderColor = "";
        return;
      }
      const black = BLACK_KEYS.has(n % 12);
      const c = d === 2 ? "217,70,239" : "99,102,241"; // remote: fuchsia, you: indigo
      const a = 0.5 + 0.5 * (v / 127); // harder hit = stronger colour
      el.style.background = black
        ? `linear-gradient(to bottom, rgba(${c},${a}), rgba(${c},${a * 0.65}))`
        : `linear-gradient(to bottom, rgba(${c},${a * 0.9}), rgba(${c},${a * 0.45}))`;
      el.style.boxShadow = `0 0 ${10 + 14 * a}px rgba(${c},${0.55 * a})`;
      el.style.transform = black ? "translateY(1px)" : "translateY(2px)";
      el.style.borderColor = `rgba(${c},0.9)`;
    };

    const prev = new Uint16Array(128).fill(0xffff); // force a first paint
    let prevSus = -1;
    let raf = 0;
    let seen = -1; // every keyboard instance tracks the version it has drawn

    const tick = () => {
      if (dirty.current !== seen) {
        seen = dirty.current;
        const pressed: number[] = [];
        for (let n = 0; n < 128; n++) {
          const v = vel.current[n];
          const sig = v ? (dir.current[n] << 8) | v : 0;
          if (v) pressed.push(n);
          if (prev[n] !== sig) {
            prev[n] = sig;
            paint(n, v, dir.current[n]);
          }
        }
        if (notesTextRef.current) notesTextRef.current.textContent = pressed.length ? pressed.map(noteName).join(" ") : "—";
        if (chordTextRef.current) chordTextRef.current.textContent = detectChord(pressed) || "—";
        const sus = sustain.current;
        if (susRef.current && sus !== prevSus) {
          prevSus = sus;
          susRef.current.style.opacity = sus ? "1" : "0.35";
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [lo, hi, vel, dir, sustain, dirty]);

  const glass = variant === "glass";
  return (
    <div>
      {glass && (
        <div className="flex items-end justify-between gap-3 px-1 pb-2">
          <span ref={notesTextRef} className="corp-mono text-[11px] font-semibold text-white/80 truncate max-w-[38%]">
            —
          </span>
          <span
            ref={chordTextRef}
            className="corp-mono text-2xl sm:text-4xl font-extrabold text-white leading-none drop-shadow-[0_0_18px_rgba(129,140,248,0.9)]"
          >
            —
          </span>
          <span
            ref={susRef}
            style={{ opacity: 0.35 }}
            className="px-2 py-0.5 rounded-md bg-white/20 text-white text-[10px] font-bold corp-mono transition-opacity"
          >
            SUS
          </span>
        </div>
      )}

      <div
        className={`relative flex select-none ${
          glass ? "h-16 sm:h-24 [@media(max-height:430px)]:!h-11" : "h-28 sm:h-40 rounded-b-lg overflow-visible"
        }`}
      >
        {whites.map((n) => (
          <div
            key={n}
            ref={(el) => {
              keyEls.current[n] = el;
            }}
            className={`relative flex-1 min-w-0 rounded-b-md border transition-[transform,box-shadow] duration-75 flex items-end justify-center pb-1 ${
              glass
                ? "border-white/40 bg-gradient-to-b from-white/90 to-white/55"
                : "border-zinc-300 bg-gradient-to-b from-white to-zinc-100"
            }`}
          >
            {n % 12 === 0 && (
              <span
                className={`text-[8px] sm:text-[9px] font-semibold corp-mono pointer-events-none ${
                  glass ? "text-zinc-600" : "text-zinc-400"
                }`}
              >
                C{Math.floor(n / 12) - 1}
              </span>
            )}
          </div>
        ))}
        {blacks.map(({ n, at }) => (
          <div
            key={n}
            ref={(el) => {
              keyEls.current[n] = el;
            }}
            style={{ left: `${at * unit - blackW / 2}%`, width: `${blackW}%` }}
            className={`absolute top-0 h-[62%] z-10 rounded-b-md bg-gradient-to-b shadow-md transition-[transform,box-shadow] duration-75 ${
              glass ? "from-zinc-900/95 to-black/85 border border-white/10" : "from-zinc-800 to-black"
            }`}
          />
        ))}
      </div>

      {!glass && (
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">Notes</span>
            <span ref={notesTextRef} className="corp-mono font-semibold text-zinc-800 truncate max-w-[14rem] sm:max-w-sm">
              —
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">Chord</span>
            <span ref={chordTextRef} className="corp-mono font-bold text-indigo-600">
              —
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">Pedal</span>
            <span
              ref={susRef}
              style={{ opacity: 0.35 }}
              className="inline-block px-2 py-0.5 rounded-md bg-zinc-900 text-white text-[10px] font-bold corp-mono transition-opacity"
            >
              SUS
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- MIDI controls: knobs, wheels and tempo derived from the live MIDI stream ---- */
const CC_TILES = [
  { id: "cc7", cc: 7, name: "Volume", short: "07", center: false },
  { id: "cc11", cc: 11, name: "Expression", short: "11", center: false },
  { id: "cc1", cc: 1, name: "Mod wheel", short: "01", center: false },
  { id: "cc10", cc: 10, name: "Pan", short: "10", center: true },
  { id: "cc74", cc: 74, name: "Brightness", short: "74", center: false },
  { id: "cc91", cc: 91, name: "Reverb", short: "91", center: false },
  { id: "cc93", cc: 93, name: "Chorus", short: "93", center: false },
];

const CTL_ITEMS = [
  ...CC_TILES.map((t) => ({ id: t.id, label: `${t.name} ${t.short}` })),
  { id: "bend", label: "Pitch bend" },
  { id: "press", label: "Aftertouch" },
  { id: "tempo", label: "Tempo" },
  { id: "prog", label: "Program" },
];

const IcSliders = () => (
  <svg className="w-5 h-5" {...svgProps}>
    <line x1="4" y1="21" x2="4" y2="14" />
    <line x1="4" y1="10" x2="4" y2="3" />
    <line x1="12" y1="21" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12" y2="3" />
    <line x1="20" y1="21" x2="20" y2="16" />
    <line x1="20" y1="12" x2="20" y2="3" />
    <line x1="1" y1="14" x2="7" y2="14" />
    <line x1="9" y1="8" x2="15" y2="8" />
    <line x1="17" y1="16" x2="23" y2="16" />
  </svg>
);

// Like the keyboard: values live in refs and are drawn by direct DOM updates in an animation loop,
// so this panel never adds work to the MIDI path.
function ControlsPanel({
  hidden,
  cc,
  bend,
  press,
  prog,
  transport,
  clkTimes,
  clkIdx,
  dirty,
}: {
  hidden: string[];
  cc: React.MutableRefObject<Int16Array>;
  bend: React.MutableRefObject<number>;
  press: React.MutableRefObject<number>;
  prog: React.MutableRefObject<number>;
  transport: React.MutableRefObject<number>;
  clkTimes: React.MutableRefObject<Float64Array>;
  clkIdx: React.MutableRefObject<number>;
  dirty: React.MutableRefObject<number>;
}) {
  const els = useRef<Record<string, any>>({});
  const reg = (k: string) => (n: any) => {
    els.current[k] = n;
  };
  const isOn = (id: string) => !hidden.includes(id);
  const R = 26;
  const C = 2 * Math.PI * R; // circle length
  const SW = 0.75 * C; // 270 degree sweep
  const hiddenKey = hidden.join(",");

  useEffect(() => {
    const E = els.current;
    const lastCc = new Int16Array(128).fill(-2);
    let lastBend = Number.NaN;
    let lastPress = -2;
    let lastProg = -3;
    let lastTransport = -1;
    let lastBeat = -1;
    let lastBpmAt = 0;
    let lastBpmShown = "";
    let bpmEma = 0;
    let beatFadeAt = 0;
    let first = true;
    let raf = 0;
    const hot: Record<string, number> = {};
    let seen = -1;

    const flash = (id: string, now: number) => {
      const b = E[id + ":box"];
      if (!b) return;
      hot[id] = now + 450;
      b.style.borderColor = "rgba(99,102,241,.55)";
      b.style.boxShadow = "0 0 18px rgba(99,102,241,.25)";
    };

    const tick = () => {
      const now = performance.now();

      if (dirty.current !== seen) {
        seen = dirty.current;

        for (const t of CC_TILES) {
          const v = cc.current[t.cc];
          if (v === lastCc[t.cc]) continue;
          lastCc[t.cc] = v;
          const arc = E[t.id + ":arc"];
          const txt = E[t.id + ":val"];
          if (!arc || !txt) continue;
          const f = v < 0 ? 0 : v / 127;
          let start = 0;
          let len = SW * f;
          if (t.center) {
            // pan: the arc grows from the middle to the left or to the right
            if (f >= 0.5) {
              start = SW * 0.5;
              len = SW * (f - 0.5);
            } else {
              start = SW * f;
              len = SW * (0.5 - f);
            }
          }
          arc.style.strokeDasharray = `${len} ${C}`;
          arc.style.strokeDashoffset = String(-start);
          txt.textContent = v < 0 ? "—" : t.center ? (v === 64 ? "C" : v < 64 ? `L${64 - v}` : `R${v - 64}`) : String(v);
          if (!first && v >= 0) flash(t.id, now);
        }

        const b = bend.current;
        if (b !== lastBend) {
          lastBend = b;
          const fill = E["bend:fill"];
          const txt = E["bend:val"];
          if (fill) {
            const w = (Math.abs(b) / 8192) * 50;
            fill.style.left = `${b >= 0 ? 50 : 50 - w}%`;
            fill.style.width = `${w}%`;
          }
          if (txt) txt.textContent = `${b > 0 ? "+" : ""}${b}`;
          if (!first) flash("bend", now);
        }

        const pr = press.current;
        if (pr !== lastPress) {
          lastPress = pr;
          const fill = E["press:fill"];
          const txt = E["press:val"];
          if (fill) fill.style.width = `${(pr / 127) * 100}%`;
          if (txt) txt.textContent = String(pr);
          if (!first) flash("press", now);
        }

        const pg = prog.current;
        if (pg !== lastProg) {
          lastProg = pg;
          const txt = E["prog:val"];
          if (txt) txt.textContent = pg < 0 ? "—" : `#${pg}`;
          if (!first && pg >= 0) flash("prog", now);
        }

        const tr = transport.current;
        if (tr !== lastTransport) {
          lastTransport = tr;
          const el = E["tempo:tr"];
          if (el) {
            el.textContent = tr === 1 ? "PLAY" : tr === 2 ? "STOP" : "—";
            el.style.background = tr === 1 ? "#10B981" : "#E4E4E7";
            el.style.color = tr === 1 ? "#fff" : "#52525B";
          }
        }
        first = false;
      }

      // tempo from the MIDI clock (24 ticks per quarter note), refreshed ~3 times a second
      if (now - lastBpmAt > 300) {
        lastBpmAt = now;
        const idx = clkIdx.current;
        const times = clkTimes.current;
        let shown = "—";
        if (idx >= 8 && now - times[(idx - 1) % 64] < 1000) {
          const count = Math.min(idx, 48);
          const span = times[(idx - 1) % 64] - times[(idx - count) % 64];
          if (span > 0) {
            const bpm = 60000 / ((span / (count - 1)) * 24);
            bpmEma = bpmEma ? bpmEma * 0.5 + bpm * 0.5 : bpm;
            shown = bpmEma.toFixed(1);
          }
        } else bpmEma = 0;
        if (shown !== lastBpmShown) {
          lastBpmShown = shown;
          const t = E["tempo:val"];
          if (t) t.textContent = shown;
        }
      }

      // beat light: blinks once per quarter note
      const beat = Math.floor(clkIdx.current / 24);
      if (beat !== lastBeat) {
        lastBeat = beat;
        const d = E["tempo:dot"];
        if (d && clkIdx.current > 0) {
          d.style.opacity = "1";
          beatFadeAt = now + 90;
        }
      }
      if (beatFadeAt && now > beatFadeAt) {
        beatFadeAt = 0;
        const d = E["tempo:dot"];
        if (d) d.style.opacity = "0.2";
      }

      // let highlighted tiles settle back
      for (const id in hot) {
        if (now > hot[id]) {
          const b = E[id + ":box"];
          if (b) {
            b.style.borderColor = "";
            b.style.boxShadow = "";
          }
          delete hot[id];
        }
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hiddenKey, cc, bend, press, prog, transport, clkTimes, clkIdx, dirty]);

  const tileBox =
    "rounded-2xl border border-zinc-200 bg-white p-3 transition-[border-color,box-shadow] duration-300";

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {CC_TILES.filter((t) => isOn(t.id)).map((t) => (
        <div key={t.id} ref={reg(t.id + ":box")} className={`${tileBox} flex flex-col items-center gap-1`}>
          <div className="relative w-16 h-16 sm:w-20 sm:h-20">
            <svg viewBox="0 0 64 64" className="w-full h-full">
              <circle
                cx="32"
                cy="32"
                r={R}
                fill="none"
                stroke="#E4E4E7"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${SW} ${C}`}
                transform="rotate(135 32 32)"
              />
              <circle
                ref={reg(t.id + ":arc")}
                cx="32"
                cy="32"
                r={R}
                fill="none"
                stroke={t.center ? "#D946EF" : "#6366F1"}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`0 ${C}`}
                transform="rotate(135 32 32)"
                style={{ transition: "stroke-dasharray .08s linear, stroke-dashoffset .08s linear" }}
              />
            </svg>
            <span
              ref={reg(t.id + ":val")}
              className="absolute inset-0 flex items-center justify-center text-sm font-bold corp-mono text-zinc-900"
            >
              —
            </span>
          </div>
          <p className="text-[11px] font-bold text-zinc-800 leading-tight">{t.name}</p>
          <p className="text-[9px] uppercase tracking-wider text-zinc-400 font-semibold">CC {t.short}</p>
        </div>
      ))}

      {isOn("bend") && (
        <div ref={reg("bend:box")} className={`${tileBox} col-span-2`}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-bold text-zinc-800">Pitch bend</p>
            <span ref={reg("bend:val")} className="text-sm font-bold corp-mono text-zinc-900">
              0
            </span>
          </div>
          <div className="relative mt-3 h-3 rounded-full bg-zinc-100 overflow-hidden">
            <span className="absolute inset-y-0 left-1/2 w-px bg-zinc-300" />
            <span
              ref={reg("bend:fill")}
              style={{ left: "50%", width: "0%" }}
              className="absolute inset-y-0 rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 transition-[left,width] duration-75"
            />
          </div>
        </div>
      )}

      {isOn("press") && (
        <div ref={reg("press:box")} className={`${tileBox} col-span-2`}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-bold text-zinc-800">Aftertouch</p>
            <span ref={reg("press:val")} className="text-sm font-bold corp-mono text-zinc-900">
              0
            </span>
          </div>
          <div className="relative mt-3 h-3 rounded-full bg-zinc-100 overflow-hidden">
            <span
              ref={reg("press:fill")}
              style={{ width: "0%" }}
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 transition-[width] duration-75"
            />
          </div>
        </div>
      )}

      {isOn("tempo") && (
        <div ref={reg("tempo:box")} className={`${tileBox} col-span-2`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span
                ref={reg("tempo:dot")}
                style={{ opacity: 0.2 }}
                className="w-2.5 h-2.5 rounded-full bg-indigo-500 transition-opacity duration-300"
              />
              <p className="text-[11px] font-bold text-zinc-800">Tempo</p>
            </div>
            <span
              ref={reg("tempo:tr")}
              style={{ background: "#E4E4E7", color: "#52525B" }}
              className="px-2 py-0.5 rounded-md text-[10px] font-bold corp-mono"
            >
              —
            </span>
          </div>
          <p className="mt-2 flex items-baseline gap-1.5">
            <span ref={reg("tempo:val")} className="text-2xl font-extrabold corp-mono text-zinc-900">
              —
            </span>
            <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">BPM · from MIDI clock</span>
          </p>
        </div>
      )}

      {isOn("prog") && (
        <div ref={reg("prog:box")} className={`${tileBox} flex flex-col justify-between`}>
          <p className="text-[11px] font-bold text-zinc-800">Program</p>
          <span ref={reg("prog:val")} className="mt-2 text-2xl font-extrabold corp-mono text-zinc-900">
            —
          </span>
        </div>
      )}
    </div>
  );
}

function estimateBpm(idx: number, times: Float64Array, now: number): number | null {
  if (idx < 8 || now - times[(idx - 1) % 64] >= 1000) return null;
  const count = Math.min(idx, 48);
  const span = times[(idx - 1) % 64] - times[(idx - count) % 64];
  return span > 0 ? 60000 / ((span / (count - 1)) * 24) : null;
}

const GLASS_CHIPS = [
  { id: "cc7", cc: 7, label: "VOL" },
  { id: "cc11", cc: 11, label: "EXP" },
  { id: "cc1", cc: 1, label: "MOD" },
  { id: "cc74", cc: 74, label: "BRT" },
  { id: "cc91", cc: 91, label: "REV" },
  { id: "cc93", cc: 93, label: "CHO" },
];

// Compact glass strip drawn over the video in full screen (same refs, own animation loop)
function GlassControls({
  hidden,
  cc,
  bend,
  clkTimes,
  clkIdx,
  dirty,
}: {
  hidden: string[];
  cc: React.MutableRefObject<Int16Array>;
  bend: React.MutableRefObject<number>;
  clkTimes: React.MutableRefObject<Float64Array>;
  clkIdx: React.MutableRefObject<number>;
  dirty: React.MutableRefObject<number>;
}) {
  const els = useRef<Record<string, any>>({});
  const reg = (k: string) => (n: any) => {
    els.current[k] = n;
  };
  const isOn = (id: string) => !hidden.includes(id);
  const hiddenKey = hidden.join(",");

  useEffect(() => {
    const E = els.current;
    const lastCc = new Int16Array(128).fill(-2);
    let lastBend = Number.NaN;
    let seen = -1;
    let lastBpmAt = 0;
    let lastShown = "";
    let ema = 0;
    let raf = 0;

    const tick = () => {
      const now = performance.now();
      if (dirty.current !== seen) {
        seen = dirty.current;
        for (const c of GLASS_CHIPS) {
          const v = cc.current[c.cc];
          if (v === lastCc[c.cc]) continue;
          lastCc[c.cc] = v;
          const bar = E[c.id + ":bar"];
          const txt = E[c.id + ":val"];
          if (bar) bar.style.width = `${v < 0 ? 0 : (v / 127) * 100}%`;
          if (txt) txt.textContent = v < 0 ? "—" : String(v);
        }
        const b = bend.current;
        if (b !== lastBend) {
          lastBend = b;
          const fill = E["bend:bar"];
          const txt = E["bend:val"];
          if (fill) {
            const w = (Math.abs(b) / 8192) * 50;
            fill.style.left = `${b >= 0 ? 50 : 50 - w}%`;
            fill.style.width = `${w}%`;
          }
          if (txt) txt.textContent = `${b > 0 ? "+" : ""}${b}`;
        }
      }
      if (now - lastBpmAt > 300) {
        lastBpmAt = now;
        const raw = estimateBpm(clkIdx.current, clkTimes.current, now);
        let shown = "—";
        if (raw === null) ema = 0;
        else {
          ema = ema ? ema * 0.5 + raw * 0.5 : raw;
          shown = ema.toFixed(1);
        }
        if (shown !== lastShown) {
          lastShown = shown;
          const t = E["tempo:val"];
          if (t) t.textContent = shown;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [hiddenKey, cc, bend, clkTimes, clkIdx, dirty]);

  const chip =
    "shrink-0 flex items-center gap-2 rounded-full border border-white/20 bg-black/35 backdrop-blur-xl px-3 py-1.5";
  return (
    <div className="pointer-events-auto no-scrollbar flex flex-nowrap sm:flex-wrap sm:justify-center gap-2 overflow-x-auto sm:overflow-visible">
      {GLASS_CHIPS.filter((c) => isOn(c.id)).map((c) => (
        <div key={c.id} className={chip}>
          <span className="text-[9px] font-bold tracking-[0.14em] text-white/60">{c.label}</span>
          <span className="relative w-10 sm:w-20 h-1.5 rounded-full bg-white/15 overflow-hidden">
            <span
              ref={reg(c.id + ":bar")}
              style={{ width: "0%" }}
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-indigo-400 to-fuchsia-400 transition-[width] duration-75"
            />
          </span>
          <span ref={reg(c.id + ":val")} className="text-[10px] corp-mono font-semibold text-white w-6 text-right">
            —
          </span>
        </div>
      ))}
      {isOn("bend") && (
        <div className={chip}>
          <span className="text-[9px] font-bold tracking-[0.14em] text-white/60">BEND</span>
          <span className="relative w-10 sm:w-20 h-1.5 rounded-full bg-white/15 overflow-hidden">
            <span className="absolute inset-y-0 left-1/2 w-px bg-white/40" />
            <span
              ref={reg("bend:bar")}
              style={{ left: "50%", width: "0%" }}
              className="absolute inset-y-0 rounded-full bg-gradient-to-r from-indigo-400 to-fuchsia-400 transition-[left,width] duration-75"
            />
          </span>
          <span ref={reg("bend:val")} className="text-[10px] corp-mono font-semibold text-white w-10 text-right">
            0
          </span>
        </div>
      )}
      {isOn("tempo") && (
        <div className={chip}>
          <span className="text-[9px] font-bold tracking-[0.14em] text-white/60">BPM</span>
          <span ref={reg("tempo:val")} className="text-[10px] corp-mono font-semibold text-white min-w-[2.5rem] text-right">
            —
          </span>
        </div>
      )}
    </div>
  );
}

function Panel({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm ${className}`}>
      <h2 className="text-[10px] uppercase tracking-[0.12em] font-semibold text-zinc-500 mb-4">{title}</h2>
      {children}
    </section>
  );
}

/* ---------------------------------------------------------------------- */
/* Page                                                                    */
/* ---------------------------------------------------------------------- */
export default function AirMidiPage() {
  const router = useRouter();
  const pathname = usePathname();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [me, setMe] = useState<AirMidiPeer | null>(null);
  const [peer, setPeer] = useState<AirMidiPeer | null>(null);
  const [isFs, setIsFs] = useState(false); // real browser fullscreen
  const [pseudoFs, setPseudoFs] = useState(false); // fallback "app mode" (e.g. iPhone)

  // join approval + optional video
  const [joinRequest, setJoinRequest] = useState<AirMidiPeer | null>(null);
  const [waitingApproval, setWaitingApproval] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [remoteVideoOn, setRemoteVideoOn] = useState(false);
  const [quality, setQuality] = useState<VideoQuality>("360p");
  const [cameraBusy, setCameraBusy] = useState(false);
  const cameraOn = !!localStream;
  const [localAudio, setLocalAudio] = useState<MediaStream | null>(null);
  const [remoteAudioStream, setRemoteAudioStream] = useState<MediaStream | null>(null);
  const [remoteMicOn, setRemoteMicOn] = useState(false);
  const [micBusy, setMicBusy] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [speakerMuted, setSpeakerMuted] = useState(false);
  const micOn = !!localAudio;
  const [sysexOn, setSysexOn] = useState<boolean | null>(null);
  const [showKeyboard, setShowKeyboard] = useState(true);
  const [kbSize, setKbSize] = useState(61);
  const [showControls, setShowControls] = useState(true);
  const [hiddenCtl, setHiddenCtl] = useState<string[]>([]);
  const [rtt, setRtt] = useState<number | null>(null);
  const [netPath, setNetPath] = useState<"direct" | "relay" | null>(null);
  const [throttled, setThrottled] = useState(false);

  // keyboard size used in full screen: 49 keys on phones, max 61 on tablets
  const vw = useViewportWidth();
  const stageKbSize = vw < 640 ? 49 : vw < 1024 ? Math.min(kbSize, 61) : kbSize;

  // video stage: full screen + auto-hiding controls
  const [stageFs, setStageFs] = useState(false); // native fullscreen on the stage element
  const [stagePseudo, setStagePseudo] = useState(false); // fallback (e.g. iPhone): covers the viewport
  const [controlsVisible, setControlsVisible] = useState(true);
  const stageFull = stageFs || stagePseudo;
  const stageRef = useRef<HTMLDivElement | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actionsRef = useRef<{
    connected: boolean;
    toggleMic: () => void;
    toggleCamera: () => void;
    toggleStage: () => void;
    toggleKeyboard: () => void;
    toggleControls: () => void;
  }>({
    connected: false,
    toggleMic: () => {},
    toggleCamera: () => {},
    toggleStage: () => {},
    toggleKeyboard: () => {},
    toggleControls: () => {},
  });

  const wakeControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControlsVisible(false), 3000);
  }, []);

  const [mode, setMode] = useState<"choose" | "sender" | "receiver">("choose");
  const [status, setStatus] = useState<AirMidiStatus>("idle");
  const [roomCode, setRoomCode] = useState("");
  const [inputCode, setInputCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [detectedDevices, setDetectedDevices] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(false);
  const [copied, setCopied] = useState(false);

  // log + live stats
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showLog, setShowLog] = useState(false); // mobile only: on desktop the log is always visible
  const [logMidi, setLogMidi] = useState(true);
  const [stats, setStats] = useState({ count: 0, last: "—" });
  const [channels, setChannels] = useState<number[]>(Array(16).fill(0));
  const [elapsed, setElapsed] = useState(0);

  const airMidiRef = useRef<AirMidiLink | null>(null);
  const ledTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logBoxRef = useRef<HTMLDivElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  const logIdRef = useRef(0);
  const logBufferRef = useRef<LogEntry[]>([]);
  const logMidiRef = useRef(true);
  const countRef = useRef(0);
  const lastMsgRef = useRef("—");
  const statsDirtyRef = useRef(false);
  const chRef = useRef<number[]>(Array(16).fill(0));
  const chShownRef = useRef(false);
  const activityRef = useRef<{ data: Uint8Array; dir: "in" | "out" }[]>([]);

  // keyboard state (written on every note, drawn in the piano's own animation loop)
  const kbVel = useRef(new Uint8Array(128));
  const kbDir = useRef(new Uint8Array(128)); // 1 = you, 2 = the other user
  const kbSus = useRef(0);
  const kbDirty = useRef(0);

  // MIDI controls state (same idea: written in the tiny MIDI callback, drawn elsewhere)
  const ccVal = useRef(new Int16Array(128).fill(-1)); // -1 = not received yet
  const bendRef = useRef(0);
  const pressRef = useRef(0);
  const progRef = useRef(-1);
  const transportRef = useRef(0); // 0 none, 1 play, 2 stop
  const clkTimes = useRef(new Float64Array(64));
  const clkIdx = useRef(0);
  const ctlDirty = useRef(0);

  const resetControls = () => {
    ccVal.current.fill(-1);
    bendRef.current = 0;
    pressRef.current = 0;
    progRef.current = -1;
    transportRef.current = 0;
    clkIdx.current = 0;
    ctlDirty.current += 1;
  };
  const ledUntilRef = useRef(0);
  const ledOnRef = useRef(false);

  const pushLog = useCallback((level: LogLevel, message: string) => {
    if (level === "midi" && !logMidiRef.current) return;
    logBufferRef.current.push({ id: ++logIdRef.current, time: nowStamp(), level, message });
  }, []);

  /* ---- auth guard: only signed-in users ---- */
  useEffect(() => {
    let active = true;
    const redirectToLogin = () =>
      router.replace(`/login?next=${encodeURIComponent(pathname || "/")}`);

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!active) return;
      if (!user) return redirectToLogin();
      setUserEmail(user.email || "");
      setMe(peerFromUser(user, "sender"));
      pushLog("success", `Signed in as ${user.email || user.id}`);
      setIsLoggedIn(true);
      setCheckingAuth(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        airMidiRef.current?.disconnect();
        setIsLoggedIn(false);
        redirectToLogin();
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- AirMIDI link instance ---- */
  useEffect(() => {
    const link = new AirMidiLink(supabase);
    airMidiRef.current = link;

    link.onStatusChange = (newStatus) => {
      setStatus(newStatus);
      if (newStatus === "connected") {
        setLoading(false);
        setError("");
      }
      if (newStatus === "disconnected") {
        setLoading(false);
        setError("The AirMIDI Link connection was interrupted.");
      }
    };

    link.onDevicesChange = (names) => setDetectedDevices(names);

    link.onPeerInfo = (p) => setPeer(p);
    link.onJoinRequest = (p) => setJoinRequest(p);
    link.onWaitingApproval = () => setWaitingApproval(true);
    link.onLocalVideo = (st) => setLocalStream(st);
    link.onRemoteStream = (st) => setRemoteStream(st);
    link.onRemoteVideoState = (on) => setRemoteVideoOn(on);
    link.onLocalAudio = (st) => setLocalAudio(st);
    link.onRemoteAudioStream = (st) => setRemoteAudioStream(st);
    link.onRemoteAudioState = (on) => setRemoteMicOn(on);
    link.onSysexState = (on) => setSysexOn(on);
    link.onLatency = (ms) => setRtt(ms);
    link.onPathInfo = (p) => setNetPath(p);
    link.onVideoThrottle = (on) => setThrottled(on);

    link.onError = (msg) => {
      setError(msg);
      setLoading(false);
      setMode("choose");
      setRoomCode("");
      setInputCode("");
      setPeer(null);
      setJoinRequest(null);
      setWaitingApproval(false);
    };

    link.onLog = (level, message) => pushLog(level, message);

    // Keep this callback tiny: MIDI timing matters more than the UI.
    // Decoding, logging and drawing happen later, in the flush loop below.
    link.onMidiActivity = (data, dir) => {
      const st = data[0];
      if (st === 0xf8) {
        // MIDI clock: only a timestamp is kept (tempo is derived later, in the controls loop)
        clkTimes.current[clkIdx.current % 64] = performance.now();
        clkIdx.current += 1;
        return;
      }
      if (st === 0xfe) return; // active sensing: too noisy
      countRef.current += 1;
      statsDirtyRef.current = true;
      if (st < 0xf0) chRef.current[st & 0x0f] = 1;
      // keyboard state: a few array writes only; the drawing happens elsewhere
      const ty = st & 0xf0;
      if (ty === 0x90 && data.length > 2 && data[2] > 0) {
        kbVel.current[data[1]] = data[2];
        kbDir.current[data[1]] = dir === "out" ? 1 : 2;
        kbDirty.current += 1;
      } else if (ty === 0x80 || (ty === 0x90 && data.length > 2 && data[2] === 0)) {
        kbVel.current[data[1]] = 0;
        kbDirty.current += 1;
      } else if (ty === 0xb0 && data.length > 2) {
        ccVal.current[data[1]] = data[2];
        ctlDirty.current += 1;
        if (data[1] === 64) {
          kbSus.current = data[2] >= 64 ? 1 : 0;
          kbDirty.current += 1;
        } else if (data[1] === 120 || data[1] === 123) {
          kbVel.current.fill(0); // all sound off / all notes off
          kbDirty.current += 1;
        }
      }
      if (ty === 0xe0 && data.length > 2) {
        bendRef.current = ((data[2] << 7) | data[1]) - 8192;
        ctlDirty.current += 1;
      } else if (ty === 0xd0 && data.length > 1) {
        pressRef.current = data[1];
        ctlDirty.current += 1;
      } else if (ty === 0xc0 && data.length > 1) {
        progRef.current = data[1];
        ctlDirty.current += 1;
      } else if (st === 0xfa || st === 0xfb) {
        transportRef.current = 1;
        ctlDirty.current += 1;
      } else if (st === 0xfc) {
        transportRef.current = 2;
        ctlDirty.current += 1;
      }
      activityRef.current.push({ data, dir });
      ledUntilRef.current = performance.now() + 90;
      if (!ledOnRef.current) {
        ledOnRef.current = true;
        setIsActive(true);
      }
    };

    return () => {
      if (ledTimeout.current) clearTimeout(ledTimeout.current);
      link.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- batched flush (log, stats, channel meters) every 150ms ---- */
  useEffect(() => {
    const t = setInterval(() => {
      if (activityRef.current.length) {
        const batch = activityRef.current;
        activityRef.current = [];
        const MAX = 40;
        if (batch.length > MAX) pushLog("midi", `… ${batch.length - MAX} more messages (showing the latest ${MAX})`);
        for (const m of batch.slice(-MAX)) {
          pushLog("midi", `${m.dir === "out" ? "TX" : "RX"}  ${decodeMidi(m.data)}   [${toHexShort(m.data)}]`);
        }
        lastMsgRef.current = decodeMidi(batch[batch.length - 1].data);
        statsDirtyRef.current = true;
      }
      if (ledOnRef.current && performance.now() > ledUntilRef.current) {
        ledOnRef.current = false;
        setIsActive(false);
      }
      if (logBufferRef.current.length) {
        const batch = logBufferRef.current;
        logBufferRef.current = [];
        setLogs((prev) => [...prev, ...batch].slice(-300));
      }
      if (statsDirtyRef.current) {
        statsDirtyRef.current = false;
        setStats({ count: countRef.current, last: lastMsgRef.current });
      }
      const any = chRef.current.some((v) => v > 0);
      if (any || chShownRef.current) {
        setChannels([...chRef.current]);
        chShownRef.current = any;
        chRef.current = chRef.current.map((v) => (v > 0.05 ? v * 0.6 : 0));
      }
    }, 150);
    return () => clearInterval(t);
  }, []);

  /* ---- session timer ---- */
  useEffect(() => {
    if (status !== "connected") {
      setElapsed(0);
      return;
    }
    const start = Date.now();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(t);
  }, [status]);

  /* ---- attach camera streams to <video> elements ---- */
  useEffect(() => {
    const el = localVideoRef.current;
    if (el) el.srcObject = localStream;
  }, [localStream, status, stagePseudo]);

  useEffect(() => {
    const el = remoteVideoRef.current;
    if (!el) return;
    el.srcObject = remoteStream;
    if (remoteStream) el.play().catch(() => {});
  }, [remoteStream, status, remoteVideoOn, stagePseudo]);

  /* ---- play the other user's voice ---- */
  useEffect(() => {
    const el = remoteAudioRef.current;
    if (!el) return;
    el.srcObject = remoteAudioStream;
    el.muted = speakerMuted;
    if (remoteAudioStream) {
      el.play().then(() => setAudioBlocked(false)).catch(() => setAudioBlocked(true));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteAudioStream, status]);

  useEffect(() => {
    const el = remoteAudioRef.current;
    if (el) el.muted = speakerMuted;
  }, [speakerMuted]);

  /* ---- keyboard: remembered on/off + size, and release every key when the link ends ---- */
  useEffect(() => {
    try {
      const on = localStorage.getItem("airmidi-kb-on");
      if (on !== null) setShowKeyboard(on === "1");
      const cOn = localStorage.getItem("airmidi-ctl-on");
      if (cOn !== null) setShowControls(cOn === "1");
      const cHidden = JSON.parse(localStorage.getItem("airmidi-ctl-hidden") || "[]");
      if (Array.isArray(cHidden)) setHiddenCtl(cHidden.filter((x) => typeof x === "string"));
      const sz = Number(localStorage.getItem("airmidi-kb-size"));
      if (sz === 49 || sz === 61 || sz === 88) setKbSize(sz);
      else if (window.innerWidth < 640) setKbSize(49);
    } catch {
      /* storage unavailable */
    }
  }, []);

  useEffect(() => {
    if (status !== "connected") {
      kbVel.current.fill(0);
      kbDir.current.fill(0);
      kbSus.current = 0;
      kbDirty.current += 1;
      resetControls();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  /* ---- stage: auto-hide controls while in full screen ---- */
  useEffect(() => {
    if (stageFull) wakeControls();
    else {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setControlsVisible(true);
    }
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [stageFull, wakeControls]);

  /* ---- stage: fallback full screen (Escape, no page scroll) ---- */
  useEffect(() => {
    if (!stagePseudo) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setStagePseudo(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [stagePseudo]);

  useEffect(() => {
    if (status !== "connected") setStagePseudo(false);
  }, [status]);

  /* ---- keyboard shortcuts: M mic, V camera, F full screen, K keyboard, C controls ---- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const a = actionsRef.current;
      if (!a.connected) return;
      const k = e.key.toLowerCase();
      if (k === "m") a.toggleMic();
      else if (k === "v") a.toggleCamera();
      else if (k === "f") a.toggleStage();
      else if (k === "k") a.toggleKeyboard();
      else if (k === "c") a.toggleControls();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ---- fullscreen state ---- */
  useEffect(() => {
    const onChange = () => {
      const fsEl = document.fullscreenElement || (document as any).webkitFullscreenElement || null;
      setIsFs(!!fsEl);
      setStageFs(!!fsEl && fsEl === stageRef.current);
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, []);

  useEffect(() => {
    if (!pseudoFs) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPseudoFs(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pseudoFs]);

  /* ---- keep the screen awake while the link is live (phones) ---- */
  useEffect(() => {
    if (status !== "connected") return;
    let lock: any = null;
    let cancelled = false;
    const request = async () => {
      try {
        lock = await (navigator as any).wakeLock?.request("screen");
        if (cancelled && lock) lock.release();
      } catch {
        /* not supported or denied */
      }
    };
    request();
    const onVisible = () => document.visibilityState === "visible" && request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      try {
        lock?.release();
      } catch {
        /* ignore */
      }
    };
  }, [status]);

  /* ---- log auto-scroll (box is always in the DOM) ---- */
  useEffect(() => {
    if (logBoxRef.current) {
      logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
    }
  }, [logs, showLog, isLoggedIn]);

  /* ---------------------------------------------------------------------- */
  /* Handlers                                                                */
  /* ---------------------------------------------------------------------- */
  // STEP 2: look for the USB MIDI adapter (user is already signed in)
  const scanAdapters = async () => {
    setError("");
    setScanning(true);
    try {
      const names = await airMidiRef.current?.scanInputs();
      setDetectedDevices(names || []);
    } catch (err: any) {
      setError(err.message);
      setMode("choose");
    }
    setScanning(false);
  };

  const handleChooseSender = async () => {
    setMode("sender");
    await scanAdapters();
  };

  // STEP 3: generate the code (only if an adapter exists)
  const handleStartBroadcasting = async () => {
    setError("");
    setLoading(true);
    try {
      const code = await airMidiRef.current?.startBroadcasting({ device: "Web iMIDI Hub" });
      if (code) setRoomCode(code);
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleConnectAsReceiver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputCode.length < 6) return setError("Enter the full 6-digit code.");
    setError("");
    setLoading(true);
    try {
      await airMidiRef.current?.connect(inputCode, { device: "Receiver iMIDI" });
    } catch (err: any) {
      setError(err.message);
      setMode("choose");
      setLoading(false);
    }
  };

  const handleReset = () => {
    airMidiRef.current?.disconnect();
    pushLog("info", "Session closed.");
    setMode("choose");
    setRoomCode("");
    setInputCode("");
    setError("");
    setLoading(false);
    setScanning(false);
    setDetectedDevices([]);
    setPeer(null);
    setJoinRequest(null);
    setWaitingApproval(false);
    setAudioBlocked(false);
    setSysexOn(null);
    setStagePseudo(false);
    kbVel.current.fill(0);
    kbDir.current.fill(0);
    kbSus.current = 0;
    kbDirty.current += 1;
    resetControls();
    setRtt(null);
    setNetPath(null);
    setThrottled(false);
    activityRef.current = [];
    countRef.current = 0;
    lastMsgRef.current = "—";
    chRef.current = Array(16).fill(0);
    setStats({ count: 0, last: "—" });
    setChannels(Array(16).fill(0));
  };

  const toggleMic = async () => {
    setError("");
    setMicBusy(true);
    try {
      if (micOn) await airMidiRef.current?.stopAudio();
      else await airMidiRef.current?.startAudio();
    } catch (err: any) {
      setError(err.message);
    }
    setMicBusy(false);
  };

  // browsers (especially iOS) may block autoplay: this runs inside a tap
  const enableSound = async () => {
    try {
      await remoteAudioRef.current?.play();
      setAudioBlocked(false);
    } catch {
      /* still blocked */
    }
  };

  const toggleCamera = async () => {
    setError("");
    setCameraBusy(true);
    try {
      if (cameraOn) await airMidiRef.current?.stopVideo();
      else await airMidiRef.current?.startVideo(quality);
    } catch (err: any) {
      setError(err.message);
    }
    setCameraBusy(false);
  };

  const changeQuality = async (q: VideoQuality) => {
    setQuality(q);
    if (!cameraOn) return;
    setCameraBusy(true);
    try {
      await airMidiRef.current?.startVideo(q);
    } catch (err: any) {
      setError(err.message);
    }
    setCameraBusy(false);
  };

  const acceptJoin = async () => {
    setJoinRequest(null);
    await airMidiRef.current?.approveJoin();
  };

  const declineJoin = () => {
    setJoinRequest(null);
    airMidiRef.current?.rejectJoin();
    setPeer(null);
  };

  const toggleControls = () => {
    const next = !showControls;
    setShowControls(next);
    try {
      localStorage.setItem("airmidi-ctl-on", next ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  const toggleCtlItem = (id: string) => {
    const next = hiddenCtl.includes(id) ? hiddenCtl.filter((x) => x !== id) : [...hiddenCtl, id];
    setHiddenCtl(next);
    try {
      localStorage.setItem("airmidi-ctl-hidden", JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const toggleKeyboard = () => {
    const next = !showKeyboard;
    setShowKeyboard(next);
    try {
      localStorage.setItem("airmidi-kb-on", next ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  const changeKbSize = (size: number) => {
    setKbSize(size);
    try {
      localStorage.setItem("airmidi-kb-size", String(size));
    } catch {
      /* ignore */
    }
  };

  const toggleStage = async () => {
    const el = stageRef.current;
    try {
      if (stagePseudo) {
        setStagePseudo(false);
        return;
      }
      const fsEl = document.fullscreenElement || (document as any).webkitFullscreenElement;
      if (fsEl && fsEl === el) {
        await (document.exitFullscreen?.() ?? (document as any).webkitExitFullscreen?.());
        return;
      }
      const req = el?.requestFullscreen || (el as any)?.webkitRequestFullscreen;
      if (el && req) await req.call(el);
      else setStagePseudo(true); // e.g. iPhone: no element fullscreen
    } catch {
      setStagePseudo(true);
    }
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      if (pseudoFs) {
        setPseudoFs(false);
        return;
      }
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      } else {
        setPseudoFs(true); // browsers without the Fullscreen API
      }
    } catch {
      setPseudoFs(true);
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const logAsText = () =>
    logs.map((l) => `${l.time} [${LEVEL_STYLE[l.level].tag}] ${l.message}`).join("\n");

  const copyLog = async () => {
    try {
      await navigator.clipboard.writeText(logAsText());
    } catch {
      /* clipboard unavailable */
    }
  };

  const downloadLog = () => {
    const blob = new Blob([logAsText()], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `airmidi-log-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ---------------------------------------------------------------------- */
  /* Render                                                                  */
  /* ---------------------------------------------------------------------- */
  actionsRef.current = {
    connected: status === "connected",
    toggleMic,
    toggleCamera,
    toggleStage,
    toggleKeyboard,
    toggleControls,
  };

  if (checkingAuth || !isLoggedIn) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-[#EEF2FF]">
        <span className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-xs text-zinc-500 font-medium">Verifying session…</p>
      </div>
    );
  }

  const meta = STATUS_META[status];
  const connected = status === "connected";
  const appMode = isFs || pseudoFs;
  const hasError = logs.some((l) => l.level === "error");

  const steps =
    mode === "sender"
      ? ["Signed in", "Detect adapter", "Share code", "Live"]
      : mode === "receiver"
      ? ["Signed in", "Enter code", "Connect", "Live"]
      : ["Signed in", "Choose role", "Pair", "Live"];

  let currentStep = 1;
  if (connected) currentStep = 4;
  else if (mode === "sender") currentStep = roomCode ? 2 : 1;
  else if (mode === "receiver") currentStep = loading ? 2 : 1;

  const roleLabel = mode === "sender" ? "Sender" : mode === "receiver" ? "Receiver" : "—";
  const myRole: "sender" | "receiver" = mode === "receiver" ? "receiver" : "sender";

  const stageNode = connected ? (
    <div
      ref={stageRef}
      onPointerMove={stageFull ? wakeControls : undefined}
      onPointerDown={stageFull ? wakeControls : undefined}
      className={`relative overflow-hidden bg-[#070B16] select-none ${
        stageFull
          ? `${stagePseudo ? "fixed inset-0 z-[80]" : "w-full h-full"} ${controlsVisible ? "" : "cursor-none"}`
          : "aspect-video w-full rounded-2xl ring-1 ring-black/10 shadow-[0_24px_60px_-12px_rgba(79,70,229,0.35)]"
      }`}
    >
      {/* remote video (always mounted so the stream never drops) */}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        muted
        className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-500 ${
          remoteVideoOn ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* idle state: the animated link between the two users */}
      <div
        className={`absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 px-4 transition-opacity duration-500 ${
          remoteVideoOn ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
        style={{ background: "radial-gradient(ellipse at center, rgba(99,102,241,.22), transparent 70%)" }}
      >
        <div className="w-full max-w-md scale-90 sm:scale-100">
          <PeerLink dark me={me} peer={peer} myRole={myRole} active={isActive} />
        </div>
        <p className="text-[11px] text-white/45 font-medium text-center">
          {peer ? `${peer.name}'s camera is off` : "Establishing link…"} · MIDI is live
        </p>
      </div>

      {/* top bar */}
      <div
        className={`absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 px-3 sm:px-4 pt-3 pb-10 bg-gradient-to-b from-black/60 to-transparent transition-opacity duration-300 ${
          stageFull && !controlsVisible ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
        style={
          stageFull
            ? {
                paddingTop: "max(0.75rem, env(safe-area-inset-top))",
                paddingLeft: "max(0.75rem, env(safe-area-inset-left))",
                paddingRight: "max(0.75rem, env(safe-area-inset-right))",
              }
            : undefined
        }
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {peer ? (
            <Avatar name={peer.name} src={peer.avatar} size={30} />
          ) : (
            <span className="w-[30px] h-[30px] rounded-full bg-white/10" />
          )}
          <div className="min-w-0 leading-tight">
            <p className="text-[13px] font-bold text-white truncate">{peer ? peer.name : "Connecting…"}</p>
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
              <span className="relative flex w-1.5 h-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
                <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-emerald-400" />
              </span>
              Live · {formatElapsed(elapsed)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {(cameraOn || micOn) && (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-white bg-red-600/90 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              {cameraOn && micOn ? "CAM + MIC" : cameraOn ? "CAM" : "MIC"}
            </span>
          )}
          <button
            onClick={toggleStage}
            title={stageFull ? "Exit full screen (F)" : "Full screen (F)"}
            aria-label={stageFull ? "Exit full screen" : "Enter full screen"}
            className="w-9 h-9 rounded-full bg-black/40 border border-white/15 text-white hover:bg-black/60 backdrop-blur flex items-center justify-center transition-colors"
          >
            <IcExpand exit={stageFull} />
          </button>
        </div>
      </div>

      {/* sound blocked by the browser: one tap fixes it */}
      {audioBlocked && (
        <button
          onClick={enableSound}
          className="am-fade-up absolute z-30 left-1/2 -translate-x-1/2 top-16 h-9 px-4 rounded-full bg-amber-400 text-black text-xs font-bold shadow-lg hover:bg-amber-300 transition-colors"
        >
          🔊 Tap to enable sound
        </button>
      )}

      {/* who is talking */}
      {remoteMicOn && (
        <span
          className={`absolute z-20 flex items-center gap-1.5 text-[11px] font-semibold text-white bg-black/50 backdrop-blur px-2.5 py-1 rounded-full ${
            stageFull ? "left-[max(0.75rem,env(safe-area-inset-left))] sm:left-5 top-28" : "left-3 top-14"
          }`}
        >
          <IcMic />
          {peer ? peer.name : "Remote"} is talking
        </span>
      )}

      {/* MIDI activity */}
      <MidiHud
        active={isActive}
        last={stats.last}
        channels={channels}
        latency={rtt === null ? null : Math.round(rtt / 2)}
        path={netPath}
        throttled={throttled}
        className={stageFull ? "left-[max(0.75rem,env(safe-area-inset-left))] sm:left-5 top-16" : "left-3 bottom-3"}
        textClass={stageFull ? "max-w-[55vw] sm:max-w-xs" : "max-w-[30vw] sm:max-w-[16rem]"}
      />

      {/* your own camera */}
      {cameraOn && (
        <div
          className={`am-fade-up absolute z-20 aspect-video rounded-lg overflow-hidden border-2 border-white/80 shadow-xl bg-black ${
            stageFull
              ? "top-16 right-[max(0.75rem,env(safe-area-inset-right))] sm:right-5 w-28 sm:w-44"
              : "right-3 bottom-8 w-24 sm:w-40"
          }`}
        >
          <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover -scale-x-100" />
          <span className="absolute left-1.5 top-1.5 flex items-center gap-1 text-[9px] font-bold text-white bg-red-600/90 px-1.5 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            YOU
          </span>
        </div>
      )}

      {/* glass overlay in full screen: MIDI controls + keyboard on top of the video */}
      {stageFull && (showKeyboard || showControls) && (
        <div
          className="pointer-events-none absolute z-20 flex flex-col gap-2 transition-[bottom] duration-300 ease-out"
          style={{
            left: "max(0.75rem, env(safe-area-inset-left))",
            right: "max(0.75rem, env(safe-area-inset-right))",
            bottom: controlsVisible
              ? "calc(6.5rem + env(safe-area-inset-bottom))"
              : "calc(2.25rem + env(safe-area-inset-bottom))",
          }}
        >
          {showControls && (
            <GlassControls
              hidden={hiddenCtl}
              cc={ccVal}
              bend={bendRef}
              clkTimes={clkTimes}
              clkIdx={clkIdx}
              dirty={ctlDirty}
            />
          )}
          {showKeyboard && (
            <div className="rounded-2xl border border-white/20 bg-black/30 backdrop-blur-2xl shadow-[0_8px_40px_rgba(0,0,0,0.35)] p-2 sm:p-3.5">
              <PianoKeyboard variant="glass" size={stageKbSize} vel={kbVel} dir={kbDir} sustain={kbSus} dirty={kbDirty} />
            </div>
          )}
        </div>
      )}

      {/* watermark */}
      <Watermark className="right-3 sm:right-4 bottom-2" />

      {/* full screen dock: controls on top of the video (scrolls sideways on small phones) */}
      {stageFull && (
        <div
          className={`absolute left-1/2 -translate-x-1/2 z-30 transition-all duration-300 max-w-[calc(100vw-1rem)] ${
            controlsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
          }`}
          style={{ bottom: "max(2rem, calc(env(safe-area-inset-bottom) + 1.5rem))" }}
        >
          <div className="no-scrollbar overflow-x-auto rounded-full border border-white/15 bg-black/50 backdrop-blur-2xl px-2 sm:px-3 py-2 shadow-2xl">
            <div className="flex items-center gap-1.5 sm:gap-3 w-max mx-auto">
              <DockButton onClick={toggleCamera} disabled={cameraBusy} active={cameraOn} label="Camera (V)">
                <IcCamera off={!cameraOn} />
              </DockButton>
              <DockButton onClick={toggleMic} disabled={micBusy} active={micOn} label="Microphone (M)">
                <IcMic off={!micOn} />
              </DockButton>
              <DockButton onClick={() => setSpeakerMuted((v) => !v)} label={speakerMuted ? "Unmute their voice" : "Mute their voice"}>
                <IcSpeaker muted={speakerMuted} />
              </DockButton>
              <span className="w-px h-6 bg-white/15 shrink-0" />
              <DockButton onClick={toggleKeyboard} active={showKeyboard} label="Keyboard (K)">
                <IcKeys />
              </DockButton>
              <DockButton onClick={toggleControls} active={showControls} label="MIDI controls (C)">
                <IcSliders />
              </DockButton>
              <button
                onClick={() => changeQuality(quality === "360p" ? "720p" : "360p")}
                disabled={cameraBusy}
                title="Video quality"
                className="h-10 sm:h-12 px-3 shrink-0 rounded-full border border-white/15 bg-white/10 text-white text-[11px] font-bold hover:bg-white/20 transition-all active:scale-95 disabled:opacity-50"
              >
                {quality}
              </button>
              <span className="w-px h-6 bg-white/15 shrink-0" />
              <DockButton onClick={toggleStage} label="Exit full screen (F)">
                <IcExpand exit />
              </DockButton>
              <DockButton onClick={handleReset} danger label="End session">
                <IcEnd />
              </DockButton>
            </div>
          </div>
        </div>
      )}
    </div>
  ) : null;

  return (
    <div className="am-grid bg-gradient-to-tr from-[#E0E7FF] via-[#EEF2FF] to-[#F5F3FF] text-[#111111] am-app flex flex-col antialiased relative overflow-x-hidden corp-sans">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
        .corp-sans { font-family: 'Inter', system-ui, sans-serif; }
        .corp-mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }
        .am-grid {
          background-image:
            linear-gradient(rgba(79,70,229,.035) 1px, transparent 1px),
            linear-gradient(90deg, rgba(79,70,229,.035) 1px, transparent 1px);
          background-size: 44px 44px;
        }
        @keyframes am-fade-up { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .am-fade-up { animation: am-fade-up .5s cubic-bezier(.2,.8,.2,1) both; }
        @keyframes am-ring { 0% { transform: scale(.7); opacity: .55; } 100% { transform: scale(2); opacity: 0; } }
        .am-ring { animation: am-ring 2.2s ease-out infinite; }
        @keyframes am-scan { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } }
        .am-scan { animation: am-scan 1.4s ease-in-out infinite; }
        @keyframes am-digit { from { opacity: 0; transform: translateY(10px) scale(.9); } to { opacity: 1; transform: none; } }
        .am-digit { animation: am-digit .45s cubic-bezier(.2,.8,.2,1) both; }
        @keyframes am-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
        .am-float { animation: am-float 3.2s ease-in-out infinite; }
        @keyframes am-dot { 0%,80%,100% { opacity: .25; transform: scale(.8); } 40% { opacity: 1; transform: scale(1.1); } }
        .am-dot { animation: am-dot 1.2s ease-in-out infinite; }
        .am-app { min-height: 100vh; min-height: 100dvh; }
        @media (min-width: 1024px) { .am-main { height: 100vh; height: 100dvh; } }
        @keyframes am-flow { 0% { left: 0; opacity: 0; } 15% { opacity: 1; } 85% { opacity: 1; } 100% { left: calc(100% - 10px); opacity: 0; } }
        .am-flow { animation: am-flow 1.9s linear infinite; }
        .am-scroll::-webkit-scrollbar { width: 8px; }
        .am-scroll::-webkit-scrollbar-thumb { background: rgba(120,120,140,.35); border-radius: 8px; }
        .no-scrollbar { scrollbar-width: none; -ms-overflow-style: none; -webkit-overflow-scrolling: touch; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        @media (prefers-reduced-motion: reduce) {
          .am-fade-up, .am-ring, .am-scan, .am-digit, .am-float, .am-dot, .am-flow { animation: none; }
        }
      `}</style>

      <div className="absolute top-[-10%] right-[-5%] w-[400px] sm:w-[800px] h-[400px] sm:h-[800px] bg-gradient-to-br from-[#4F46E5]/15 via-[#8B5CF6]/10 to-transparent rounded-full blur-[70px] sm:blur-[110px] pointer-events-none z-0" />
      <div className="absolute bottom-[5%] left-[-10%] w-[350px] sm:w-[700px] h-[350px] sm:h-[700px] bg-gradient-to-tr from-[#6366F1]/12 via-transparent to-transparent rounded-full blur-[80px] sm:blur-[120px] pointer-events-none z-0" />

      {/* JOIN REQUEST (sender must approve every new participant) */}
      {joinRequest && (
        <div
          className="am-fade-up fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Join request"
        >
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl text-center space-y-5">
            <div className="flex justify-center">
              <div className="relative">
                <span className="absolute inset-0 rounded-full bg-indigo-400/30 am-ring" />
                <div className="relative rounded-full p-[3px] bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500">
                  <div className="rounded-full bg-white p-0.5">
                    <Avatar name={joinRequest.name} src={joinRequest.avatar} size={64} />
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">Join request</p>
              <h3 className="text-lg font-bold text-zinc-900 truncate">{joinRequest.name}</h3>
              {joinRequest.email && <p className="text-xs corp-mono text-zinc-400">{joinRequest.email}</p>}
              <p className="text-sm text-zinc-500 pt-2">wants to join your session. Only accept people you know.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={declineJoin}
                className="flex-1 h-11 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-xs font-semibold transition-colors"
              >
                Decline
              </button>
              <button
                onClick={acceptJoin}
                className="flex-1 h-11 rounded-xl bg-black text-white text-xs font-bold uppercase tracking-widest hover:bg-neutral-800 active:scale-[0.98] transition-all"
              >
                Accept
              </button>
            </div>
          </div>
        </div>
      )}

      {!appMode && <Navbar />}

      {/* WORKSPACE: fills the whole viewport on desktop */}
      <main
        className={`am-main relative z-10 flex-1 w-full max-w-[1800px] mx-auto px-3 sm:px-4 lg:px-8 flex flex-col ${
          appMode ? "" : "pt-24"
        }`}
        style={{
          paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
          paddingTop: appMode ? "max(1rem, env(safe-area-inset-top))" : undefined,
        }}
      >
        {/* TOOLBAR */}
        <header className="shrink-0 mb-5 bg-white border border-zinc-200 rounded-2xl px-4 sm:px-5 py-4 flex flex-wrap items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-4 am-fade-up">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/airlink-icon.png" alt="" width={44} height={44} className="w-11 h-11 rounded-full shadow-md shadow-indigo-500/20" draggable={false} />
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 leading-tight">
                AirMIDI Link
              </h1>
              <p className="text-[11px] sm:text-xs text-zinc-500 max-w-[14rem] sm:max-w-none truncate sm:whitespace-normal">
                Encrypted MIDI transport over AirMIDI-Link V 0.1.13 concept MIDI 3.0
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {(cameraOn || micOn) && (
              <span className="inline-flex items-center gap-2 text-[11px] font-semibold px-3 py-1.5 rounded-full border border-red-200 bg-red-50 text-red-700">
                <span className="relative flex w-2 h-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-60 animate-ping" />
                  <span className="relative inline-flex w-2 h-2 rounded-full bg-red-500" />
                </span>
                {cameraOn && micOn ? "Camera & mic live" : cameraOn ? "Camera live" : "Mic live"}
              </span>
            )}
            {connected && (
              <span className="hidden sm:inline-flex items-center gap-2 text-[11px] font-semibold px-3 py-1.5 rounded-full border border-zinc-200 bg-white text-zinc-700 corp-mono">
                ⏱ {formatElapsed(elapsed)}
              </span>
            )}
            {userEmail && (
              <span className="hidden md:inline-flex items-center gap-2 text-[11px] font-medium px-3 py-1.5 rounded-full border border-zinc-200 bg-white text-zinc-500 corp-mono max-w-[240px] truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span className="truncate">{userEmail}</span>
              </span>
            )}
            <span
              className={`inline-flex items-center gap-2 text-[11px] font-semibold px-3 py-1.5 rounded-full border transition-colors duration-500 ${meta.pill}`}
            >
              <span className="relative flex w-2 h-2">
                {meta.pulse && (
                  <span className={`absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping ${meta.dot}`} />
                )}
                <span className={`relative inline-flex w-2 h-2 rounded-full ${meta.dot}`} />
              </span>
              {meta.label}
            </span>
            <button
              onClick={toggleFullscreen}
              aria-label={appMode ? "Exit full screen" : "Enter full screen"}
              title={appMode ? "Exit full screen" : "Full screen"}
              className="w-10 h-10 sm:w-9 sm:h-9 rounded-full border border-zinc-200 bg-white text-zinc-600 hover:text-indigo-600 hover:border-indigo-300 hover:shadow-md active:scale-95 transition-all flex items-center justify-center"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {appMode ? (
                  <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                ) : (
                  <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                )}
              </svg>
            </button>
          </div>
        </header>

        {/* ERROR */}
        {error && (
          <div className="am-fade-up shrink-0 mb-5 p-4 bg-red-50/90 border border-red-200 rounded-2xl text-xs text-red-700 flex items-start gap-3">
            <svg className="w-4 h-4 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
            </svg>
            <span className="flex-1 font-medium leading-relaxed">{error}</span>
            <button onClick={() => setError("")} className="text-red-400 hover:text-red-700 transition-colors" aria-label="Dismiss">
              ✕
            </button>
          </div>
        )}

        {/* DASHBOARD GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-[270px_minmax(0,1fr)] gap-5 lg:flex-1 lg:min-h-0">
          {/* ---------------- LEFT RAIL (desktop) ---------------- */}
          <aside className="hidden lg:flex flex-col gap-5 min-h-0 overflow-y-auto am-scroll pr-1">
            <Panel title="Workflow">
              <VerticalSteps steps={steps} current={currentStep} />
            </Panel>

            <Panel title="Session">
              <dl className="space-y-3 text-xs">
                {[
                  { k: "Role", v: roleLabel },
                  { k: "Peer", v: peer?.name || "—" },
                  { k: "Camera", v: cameraOn ? "On" : "Off" },
                  { k: "Mic", v: micOn ? "On" : "Off" },
                  { k: "SysEx", v: sysexOn === null ? "—" : sysexOn ? "Enabled" : "Blocked" },
                  { k: "Room", v: roomCode || "—", mono: true },
                  { k: "State", v: meta.label },
                  { k: "Uptime", v: connected ? formatElapsed(elapsed) : "—", mono: true },
                  { k: "Messages", v: stats.count.toLocaleString("en-US"), mono: true },
                  { k: mode === "receiver" ? "Outputs" : "Inputs", v: String(detectedDevices.length), mono: true },
                ].map((r) => (
                  <div key={r.k} className="flex items-center justify-between gap-3">
                    <dt className="text-zinc-400 font-medium">{r.k}</dt>
                    <dd className={`font-semibold text-zinc-900 truncate ${r.mono ? "corp-mono" : ""}`}>{r.v}</dd>
                  </div>
                ))}
              </dl>
            </Panel>

            <Panel title="Security">
              <ul className="space-y-2.5 text-xs text-zinc-600">
                {[
                  "Signed-in access only",
                  "DTLS-encrypted data channel",
                  "Pairing code expires in 15 min",
                ].map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                      <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
            </Panel>
          </aside>

          {/* ---------------- CENTER COLUMN: stage + compact log ---------------- */}
          <div className="flex flex-col gap-3 min-w-0 lg:min-h-0 lg:h-full">
          <section className="bg-white border border-zinc-200 rounded-2xl shadow-sm flex flex-col min-h-[420px] lg:min-h-0 lg:flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto am-scroll p-4 sm:p-8 lg:p-10">
              <div className="min-h-full flex flex-col justify-center">
                <Stepper steps={steps} current={currentStep} />

                {/* CHOOSE ROLE */}
                {mode === "choose" && (
                  <div key="choose" className="am-fade-up w-full max-w-3xl mx-auto space-y-8">
                    <div className="text-center space-y-2">
                      <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900">Start a session</h2>
                      <p className="text-sm text-zinc-500 max-w-md mx-auto">
                        Choose how this device takes part in the link.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                      <button
                        onClick={handleChooseSender}
                        disabled={loading || scanning}
                        className="group text-left p-6 sm:p-7 rounded-2xl border border-zinc-200 bg-white hover:border-indigo-400 hover:shadow-md transition-all duration-300 disabled:opacity-50"
                      >
                        <span className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-5 group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300">
                          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20V10m0 0l-4 4m4-4l4 4M5 5h14" />
                          </svg>
                        </span>
                        <span className="block text-base font-bold text-zinc-900">Sender</span>
                        <span className="block text-xs text-zinc-500 mt-1.5 leading-relaxed">
                          Stream MIDI from a USB adapter connected to this device.
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 mt-4">
                          Continue <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
                        </span>
                      </button>

                      <button
                        onClick={() => {
                          setError("");
                          setMode("receiver");
                        }}
                        className="group text-left p-6 sm:p-7 rounded-2xl border border-zinc-200 bg-white hover:border-sky-400 hover:shadow-md transition-all duration-300"
                      >
                        <span className="w-12 h-12 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center mb-5 group-hover:bg-sky-600 group-hover:text-white transition-colors duration-300">
                          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 4v10m0 0l-4-4m4 4l4-4M5 19h14" />
                          </svg>
                        </span>
                        <span className="block text-base font-bold text-zinc-900">Receiver</span>
                        <span className="block text-xs text-zinc-500 mt-1.5 leading-relaxed">
                          Join with a code and play incoming MIDI on this device.
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 mt-4">
                          Continue <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                {/* SENDER */}
                {mode === "sender" && !connected && (
                  <div key={`sender-${roomCode ? "code" : "setup"}`} className="am-fade-up w-full max-w-xl mx-auto text-center space-y-6">
                    {scanning && <ScanBar label="Scanning for USB MIDI adapters…" />}

                    {!scanning && !roomCode && detectedDevices.length === 0 && (
                      <>
                        <h2 className="text-xl font-bold text-zinc-900">Detect your adapter</h2>
                        <div className="text-xs bg-amber-50 border border-amber-200 p-4 rounded-xl text-amber-800 font-medium leading-relaxed text-left">
                          No USB MIDI adapter detected. Plug it into this device and allow MIDI access in your browser.
                        </div>
                        <button
                          onClick={scanAdapters}
                          className="h-11 px-6 bg-black text-white text-xs font-semibold rounded-xl hover:bg-neutral-800 active:scale-[0.98] transition-all"
                        >
                          Scan again
                        </button>
                      </>
                    )}

                    {!scanning && !roomCode && detectedDevices.length > 0 && (
                      <>
                        <h2 className="text-xl font-bold text-zinc-900">Adapter ready</h2>
                        <div className="text-left space-y-2">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Detected adapters</p>
                          <div className="flex flex-wrap gap-2">
                            {detectedDevices.map((d, i) => (
                              <span
                                key={d + i}
                                style={{ animationDelay: `${i * 80}ms` }}
                                className="am-digit inline-flex items-center gap-2 text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-full"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                {d}
                              </span>
                            ))}
                          </div>
                        </div>
                        <button
                          onClick={handleStartBroadcasting}
                          disabled={loading}
                          className="w-full h-12 bg-black text-white text-xs font-bold uppercase tracking-widest rounded-xl hover:bg-neutral-800 active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {loading ? (
                            <>
                              <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              Generating…
                            </>
                          ) : (
                            <>Generate code →</>
                          )}
                        </button>
                      </>
                    )}

                    {roomCode && (
                      <>
                        <h2 className="text-xl font-bold text-zinc-900">Share this code</h2>
                        <p className="text-xs text-zinc-500">Enter it on the receiver device to pair.</p>
                        <div className="flex justify-center gap-2 sm:gap-3">
                          {roomCode.split("").map((d, i) => (
                            <span
                              key={i}
                              style={{ animationDelay: `${i * 70}ms` }}
                              className="am-digit w-10 h-14 sm:w-16 sm:h-20 flex items-center justify-center rounded-xl bg-white border border-zinc-200 shadow-sm text-2xl sm:text-4xl font-bold text-zinc-900 corp-mono"
                            >
                              {d}
                            </span>
                          ))}
                        </div>
                        <button onClick={copyCode} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors py-2">
                          {copied ? "✓ Copied" : "Copy code"}
                        </button>
                        <div className="flex items-center justify-center gap-2 text-xs text-zinc-500">
                          <span className="flex gap-1">
                            {[0, 1, 2].map((i) => (
                              <span key={i} style={{ animationDelay: `${i * 0.2}s` }} className="am-dot w-1.5 h-1.5 rounded-full bg-indigo-500" />
                            ))}
                          </span>
                          Waiting for the receiver to join… (code valid for 15 min)
                        </div>
                      </>
                    )}

                    <button
                      onClick={handleReset}
                      className="text-xs font-semibold text-zinc-500 hover:text-black transition-colors pt-1 py-2 block mx-auto"
                    >
                      ← {roomCode ? "Stop session" : "Back"}
                    </button>
                  </div>
                )}

                {/* RECEIVER */}
                {mode === "receiver" && !connected && (
                  <form key="receiver" onSubmit={handleConnectAsReceiver} className="am-fade-up w-full max-w-md mx-auto space-y-6">
                    <div className="text-center space-y-1">
                      <h2 className="text-xl font-bold text-zinc-900">Join a session</h2>
                      <p className="text-xs text-zinc-500">Enter the 6-digit code shown on the sender device.</p>
                    </div>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      required
                      value={inputCode}
                      onChange={(e) => setInputCode(e.target.value.replace(/\D/g, ""))}
                      className="w-full h-20 bg-white border border-zinc-200 rounded-2xl px-4 text-4xl font-bold corp-mono text-center tracking-[0.5em] outline-none transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 placeholder:text-zinc-300 placeholder:tracking-[0.5em] disabled:opacity-60"
                      placeholder="000000"
                      disabled={loading}
                    />
                    {loading && <ScanBar label={waitingApproval ? "Waiting for the sender to approve…" : "Negotiating secure connection…"} />}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleReset}
                        className="h-12 px-6 bg-zinc-100 hover:bg-zinc-200 text-xs font-semibold rounded-xl transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={loading || inputCode.length < 6}
                        className="flex-1 h-12 bg-black text-white text-xs font-bold uppercase tracking-widest rounded-xl hover:bg-neutral-800 active:scale-[0.99] transition-all disabled:opacity-50"
                      >
                        {loading ? "Connecting…" : "Connect →"}
                      </button>
                    </div>
                  </form>
                )}

                {/* CONNECTED: live console */}
                {connected && (
                  <div key="connected" className="am-fade-up w-full max-w-4xl md:max-w-3xl lg:max-w-4xl mx-auto space-y-5">
                    <audio ref={remoteAudioRef} autoPlay playsInline />

                    {/* STAGE (video + MIDI HUD + watermark) */}
                    {stagePseudo && typeof document !== "undefined" ? createPortal(stageNode, document.body) : stageNode}

                    {/* CONTROLS */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={toggleCamera}
                        disabled={cameraBusy}
                        title="Camera (V)"
                        className={`h-11 px-4 rounded-xl text-xs font-bold border transition-all active:scale-[0.98] disabled:opacity-50 flex items-center gap-2 ${
                          cameraOn
                            ? "bg-zinc-900 text-white border-zinc-900"
                            : "bg-white text-zinc-700 border-zinc-200 hover:border-indigo-300 hover:text-indigo-600"
                        }`}
                      >
                        <IcCamera off={!cameraOn} />
                        {cameraBusy ? "…" : cameraOn ? "Camera on" : "Camera"}
                      </button>
                      <button
                        onClick={toggleMic}
                        disabled={micBusy}
                        title="Microphone (M)"
                        className={`h-11 px-4 rounded-xl text-xs font-bold border transition-all active:scale-[0.98] disabled:opacity-50 flex items-center gap-2 ${
                          micOn
                            ? "bg-zinc-900 text-white border-zinc-900"
                            : "bg-white text-zinc-700 border-zinc-200 hover:border-indigo-300 hover:text-indigo-600"
                        }`}
                      >
                        <IcMic off={!micOn} />
                        {micBusy ? "…" : micOn ? "Mic on" : "Mic"}
                      </button>
                      <button
                        onClick={() => setSpeakerMuted((v) => !v)}
                        aria-label={speakerMuted ? "Unmute speaker" : "Mute speaker"}
                        title={speakerMuted ? "Unmute their voice" : "Mute their voice"}
                        className={`h-11 w-11 rounded-xl border bg-white flex items-center justify-center transition-colors ${
                          speakerMuted ? "border-red-200 text-red-500" : "border-zinc-200 text-zinc-600 hover:text-indigo-600 hover:border-indigo-300"
                        }`}
                      >
                        <IcSpeaker muted={speakerMuted} />
                      </button>
                      <select
                        value={quality}
                        onChange={(e) => changeQuality(e.target.value as VideoQuality)}
                        disabled={cameraBusy}
                        className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-[16px] sm:text-xs font-semibold text-zinc-700 outline-none focus:border-indigo-400"
                      >
                        <option value="360p">360p · saves data</option>
                        <option value="720p">720p · sharper</option>
                      </select>
                      <button
                        onClick={toggleStage}
                        title="Full screen (F)"
                        className="h-11 px-4 rounded-xl text-xs font-bold border border-zinc-200 bg-white text-zinc-700 hover:border-indigo-300 hover:text-indigo-600 transition-all active:scale-[0.98] flex items-center gap-2"
                      >
                        <IcExpand />
                        Full screen
                      </button>
                      <span className="flex-1" />
                      <button
                        onClick={handleReset}
                        className="h-11 px-4 rounded-xl text-xs font-bold bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 transition-colors active:scale-[0.98] flex items-center gap-2"
                      >
                        <IcEnd />
                        End session
                      </button>
                    </div>
                    <p className="text-[11px] text-zinc-400 -mt-2">
                      Camera and microphone stay off until you start them. Use headphones to avoid echo. Shortcuts:{" "}
                      <kbd className="corp-mono">V</kbd> camera · <kbd className="corp-mono">M</kbd> mic ·{" "}
                      <kbd className="corp-mono">F</kbd> full screen · <kbd className="corp-mono">K</kbd> keyboard ·{" "}
                      <kbd className="corp-mono">C</kbd> controls
                    </p>

                    {/* KEYBOARD (on/off) */}
                    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
                      <div
                        className={`flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-3 ${
                          showKeyboard ? "border-b border-zinc-100" : ""
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                            <IcKeys />
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-zinc-900 leading-tight">Keyboard</p>
                            <p className="text-[11px] text-zinc-400 truncate">
                              {showKeyboard ? "Keys light up with the MIDI notes in the link" : "Off · no drawing, zero overhead"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {showKeyboard && (
                            <div className="hidden md:flex items-center gap-3 text-[11px] text-zinc-500 font-medium">
                              <span className="inline-flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                                You
                              </span>
                              <span className="inline-flex items-center gap-1.5 min-w-0">
                                <span className="w-2.5 h-2.5 rounded-full bg-fuchsia-500 shrink-0" />
                                <span className="truncate max-w-[8rem]">{peer ? peer.name : "Remote"}</span>
                              </span>
                            </div>
                          )}
                          {showKeyboard && (
                            <div className="flex rounded-lg border border-zinc-200 bg-zinc-50 p-0.5">
                              {[49, 61, 88].map((k) => (
                                <button
                                  key={k}
                                  onClick={() => changeKbSize(k)}
                                  title={`${k} keys`}
                                  className={`px-2.5 py-1.5 rounded-md text-[11px] font-bold transition-colors ${
                                    kbSize === k ? "bg-white text-indigo-600 shadow-sm" : "text-zinc-500 hover:text-zinc-800"
                                  }`}
                                >
                                  {k}
                                </button>
                              ))}
                            </div>
                          )}
                          <button
                            role="switch"
                            aria-checked={showKeyboard}
                            aria-label="Show keyboard"
                            onClick={toggleKeyboard}
                            className="flex items-center gap-2 text-[11px] font-bold text-zinc-500 py-1"
                          >
                            <span
                              className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                                showKeyboard ? "bg-indigo-600" : "bg-zinc-300"
                              }`}
                            >
                              <span
                                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
                                  showKeyboard ? "translate-x-5" : ""
                                }`}
                              />
                            </span>
                            {showKeyboard ? "ON" : "OFF"}
                          </button>
                        </div>
                      </div>
                      {showKeyboard && (
                        <div className="p-4 sm:p-5 bg-gradient-to-b from-zinc-50 to-white">
                          <PianoKeyboard size={kbSize} vel={kbVel} dir={kbDir} sustain={kbSus} dirty={kbDirty} />
                        </div>
                      )}
                    </div>

                    {/* MIDI CONTROLS (on/off + per-control) */}
                    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
                      <div
                        className={`flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-3 ${
                          showControls ? "border-b border-zinc-100" : ""
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                            <IcSliders />
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-zinc-900 leading-tight">MIDI controls</p>
                            <p className="text-[11px] text-zinc-400 truncate">
                              {showControls
                                ? "Volume, expression, mod wheel, tempo and more, live from the link"
                                : "Off · no drawing, zero overhead"}
                            </p>
                          </div>
                        </div>
                        <button
                          role="switch"
                          aria-checked={showControls}
                          aria-label="Show MIDI controls"
                          onClick={toggleControls}
                          className="flex items-center gap-2 text-[11px] font-bold text-zinc-500 py-1"
                        >
                          <span
                            className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                              showControls ? "bg-indigo-600" : "bg-zinc-300"
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
                                showControls ? "translate-x-5" : ""
                              }`}
                            />
                          </span>
                          {showControls ? "ON" : "OFF"}
                        </button>
                      </div>
                      {showControls && (
                        <div className="p-4 sm:p-5 bg-gradient-to-b from-zinc-50 to-white space-y-4">
                          <div className="flex flex-wrap gap-1.5">
                            {CTL_ITEMS.map((it) => {
                              const on = !hiddenCtl.includes(it.id);
                              return (
                                <button
                                  key={it.id}
                                  onClick={() => toggleCtlItem(it.id)}
                                  aria-pressed={on}
                                  className={`px-2.5 py-1.5 rounded-full text-[11px] font-bold border transition-colors ${
                                    on
                                      ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                      : "bg-white text-zinc-400 border-zinc-200 hover:text-zinc-600"
                                  }`}
                                >
                                  {it.label}
                                </button>
                              );
                            })}
                          </div>
                          <ControlsPanel
                            hidden={hiddenCtl}
                            cc={ccVal}
                            bend={bendRef}
                            press={pressRef}
                            prog={progRef}
                            transport={transportRef}
                            clkTimes={clkTimes}
                            clkIdx={clkIdx}
                            dirty={ctlDirty}
                          />
                        </div>
                      )}
                    </div>

                    {throttled && (
                      <div className="am-fade-up text-xs bg-amber-50 border border-amber-200 p-4 rounded-xl text-amber-800 font-medium leading-relaxed">
                        The connection is congested, so the video was reduced automatically to keep MIDI latency low.
                        It returns to normal when the network calms down.
                      </div>
                    )}

                    {/* STATS */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-zinc-100 rounded-2xl border border-zinc-200 bg-white overflow-hidden shadow-sm">
                      {[
                        { label: "Messages", value: stats.count.toLocaleString("en-US") },
                        { label: "Session", value: formatElapsed(elapsed) },
                        {
                          label: "Latency",
                          value: rtt === null ? "…" : `≈${Math.round(rtt / 2)} ms`,
                          sub: netPath ? (netPath === "relay" ? "via TURN relay" : "direct") : undefined,
                        },
                        { label: mode === "receiver" ? "Outputs" : "Inputs", value: String(detectedDevices.length) },
                      ].map((st, i) => (
                        <div key={st.label} className={`p-4 text-center ${i >= 2 ? "border-t border-zinc-100 sm:border-t-0" : ""}`}>
                          <p className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">{st.label}</p>
                          <p className="text-base font-bold text-zinc-900 corp-mono mt-1">{st.value}</p>
                          {(st as { sub?: string }).sub && (
                            <p className="text-[10px] text-zinc-400 mt-0.5">{(st as { sub?: string }).sub}</p>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* MIDI MONITOR */}
                    <div className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5 shadow-sm space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 mb-1">Last MIDI message</p>
                          <p className="text-sm corp-mono text-zinc-800 truncate">{stats.last}</p>
                        </div>
                        <span
                          className={`shrink-0 w-2.5 h-2.5 rounded-full transition-colors duration-100 ${
                            isActive ? "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,.9)]" : "bg-emerald-400"
                          }`}
                        />
                      </div>
                      <div>
                        <div className="flex items-end gap-1 sm:gap-1.5 h-20">
                          {channels.map((v, i) => (
                            <div key={i} className="flex-1 h-full flex items-end">
                              <div
                                className="w-full rounded-sm bg-gradient-to-t from-indigo-600 to-violet-400 transition-[height,opacity] duration-150"
                                style={{ height: `${6 + v * 94}%`, opacity: 0.3 + v * 0.7 }}
                              />
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-1 sm:gap-1.5 mt-1">
                          {channels.map((_, i) => (
                            <span key={i} className="flex-1 text-center text-[9px] text-zinc-400 corp-mono">
                              {i + 1}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* DEVICES */}
                    {detectedDevices.length > 0 ? (
                      <div className="text-xs bg-zinc-50 border border-zinc-100 p-4 rounded-xl text-zinc-500 font-medium">
                        {mode === "receiver" ? "MIDI outputs: " : "MIDI inputs: "}
                        <span className="text-zinc-900 corp-mono">{detectedDevices.join(", ")}</span>
                      </div>
                    ) : (
                      <div className="text-xs bg-amber-50 border border-amber-200 p-4 rounded-xl text-amber-800 font-medium leading-relaxed">
                        {mode === "receiver"
                          ? "No MIDI output found. Incoming data cannot be played here. Connect a USB MIDI adapter or use a browser that supports Web MIDI (Chrome / Edge / Opera)."
                          : "No MIDI input found. Plug in your USB adapter and allow MIDI access."}
                      </div>
                    )}

                    {sysexOn === false && (
                      <div className="text-xs bg-amber-50 border border-amber-200 p-4 rounded-xl text-amber-800 font-medium leading-relaxed">
                        SysEx is blocked on this device: you did not allow full MIDI access in the browser. Notes and
                        controllers still pass. To allow SysEx, enable MIDI permission for this site in the browser
                        settings and reconnect.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ---------------- ACTIVITY LOG (compact, collapsed by default) ---------------- */}
          <section className="shrink-0 rounded-2xl border border-zinc-200 bg-white overflow-hidden flex flex-col shadow-sm">
            <button
              onClick={() => setShowLog((v) => !v)}
              className="shrink-0 w-full flex items-center justify-between px-4 py-3 text-left hover:bg-zinc-50/70 transition-colors"
            >
              <span className="flex items-center gap-2 text-xs font-bold text-zinc-800 min-w-0 flex-1">
                <svg className="w-4 h-4 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 17l6-6-6-6M12 19h8" />
                </svg>
                Activity log
                <span className="text-[10px] font-semibold bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full corp-mono">
                  {logs.length}
                </span>
                {hasError && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />}
                {!showLog && logs.length > 0 && (
                  <span className="ml-1 truncate font-normal text-[11px] text-zinc-400 corp-mono min-w-0">
                    {logs[logs.length - 1].message}
                  </span>
                )}
              </span>
              <svg
                className={`shrink-0 ml-3 w-4 h-4 text-zinc-400 transition-transform duration-300 ${showLog ? "rotate-180" : ""}`}
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            <div className={`${showLog ? "flex" : "hidden"} flex-col border-t border-zinc-200`}>
              <div className="shrink-0 flex flex-wrap items-center gap-3 px-4 py-2 bg-zinc-50 border-b border-zinc-200">
                <label className="flex items-center gap-1.5 text-[11px] text-zinc-600 font-medium cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={logMidi}
                    onChange={(e) => {
                      setLogMidi(e.target.checked);
                      logMidiRef.current = e.target.checked;
                    }}
                    className="accent-indigo-600"
                  />
                  MIDI messages
                </label>
                <span className="flex-1" />
                <button onClick={copyLog} className="text-[11px] font-semibold text-zinc-600 hover:text-black transition-colors py-1">
                  Copy
                </button>
                <button onClick={downloadLog} className="text-[11px] font-semibold text-zinc-600 hover:text-black transition-colors py-1">
                  Download
                </button>
                <button onClick={() => setLogs([])} className="text-[11px] font-semibold text-zinc-600 hover:text-red-600 transition-colors py-1">
                  Clear
                </button>
              </div>

              <div
                ref={logBoxRef}
                className="am-scroll h-40 overflow-y-auto bg-[#0B1020] px-4 py-3 corp-mono text-[11px] leading-relaxed"
              >
                {logs.length === 0 ? (
                  <p className="text-zinc-500">No events yet.</p>
                ) : (
                  logs.map((l) => (
                    <div key={l.id} className="flex gap-3">
                      <span className="text-zinc-500 shrink-0">{l.time}</span>
                      <span className={`shrink-0 w-11 font-semibold ${LEVEL_STYLE[l.level].color}`}>
                        {LEVEL_STYLE[l.level].tag}
                      </span>
                      <span className="text-zinc-200 break-all whitespace-pre-wrap">{l.message}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
          </div>
        </div>
      </main>

         {/*    {!appMode && <Footer />}*/}    
    </div>
  );
}