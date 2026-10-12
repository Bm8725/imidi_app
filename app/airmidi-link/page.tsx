"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
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

function PeerSide({ p, label, isMe }: { p: AirMidiPeer | null; label: string; isMe: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 min-w-0 w-[5.5rem] sm:w-36">
      <div className="relative">
        {p && <span className="absolute inset-0 rounded-full bg-emerald-400/30 am-ring" />}
        <div
          className={`relative rounded-full p-[3px] bg-gradient-to-br ${
            p ? "from-indigo-500 via-violet-500 to-fuchsia-500" : "from-zinc-200 to-zinc-300"
          }`}
        >
          <div className="rounded-full bg-white p-0.5">
            {p ? (
              <Avatar name={p.name} src={p.avatar} />
            ) : (
              <span className="w-14 h-14 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-300 text-xl font-bold am-dot">
                ?
              </span>
            )}
          </div>
        </div>
        {p && (
          <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-white" />
        )}
      </div>
      <div className="text-center min-w-0 w-full">
        <p className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">
          {label}
          {isMe ? " · You" : ""}
        </p>
        <p key={p?.name || "none"} className="am-fade-up text-sm font-bold text-zinc-900 truncate">
          {p ? p.name : "Identifying…"}
        </p>
        {p?.email && <p className="text-[10px] text-zinc-400 corp-mono truncate">{p.email}</p>}
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
}: {
  me: AirMidiPeer | null;
  peer: AirMidiPeer | null;
  myRole: "sender" | "receiver";
  active: boolean;
}) {
  const left = myRole === "sender" ? me : peer;
  const right = myRole === "sender" ? peer : me;
  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-6 shadow-sm">
      <p className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 text-center mb-5">
        {peer ? (myRole === "receiver" ? "Receiving from" : "Streaming to") : "Establishing link"}
      </p>
      <div className="flex items-center justify-center gap-1 sm:gap-4">
        <PeerSide p={left} label="Sender" isMe={myRole === "sender"} />
        <div className="relative flex-1 h-10 min-w-[40px] max-w-[220px]">
          <span className="absolute left-0 right-0 top-1/2 -translate-y-1/2 border-t-2 border-dashed border-indigo-200" />
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{ animationDelay: `${i * 0.6}s`, animationDuration: active ? "0.9s" : "1.9s" }}
              className="am-flow absolute top-1/2 -translate-y-1/2 left-0 w-2.5 h-2.5 rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 shadow shadow-indigo-400/60"
            />
          ))}
        </div>
        <PeerSide p={right} label="Receiver" isMe={myRole === "receiver"} />
      </div>
    </div>
  );
}

function Panel({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`bg-white/80 backdrop-blur-xl border border-white/80 lg:border-[#EAEAEA] rounded-2xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.03)] ${className}`}>
      <h2 className="text-[10px] uppercase tracking-[0.14em] font-bold text-zinc-400 mb-4">{title}</h2>
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

    link.onMidiActivity = (data, dir) => {
      const s = data[0];
      if (s === 0xf8 || s === 0xfe) return; // clock / active sensing: too noisy

      setIsActive(true);
      if (ledTimeout.current) clearTimeout(ledTimeout.current);
      ledTimeout.current = setTimeout(() => setIsActive(false), 90);

      countRef.current += 1;
      const text = decodeMidi(data);
      lastMsgRef.current = text;
      statsDirtyRef.current = true;
      if (s < 0xf0) chRef.current[s & 0x0f] = 1;

      pushLog("midi", `${dir === "out" ? "TX" : "RX"}  ${text}   [${toHexShort(data)}]`);
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
  }, [localStream, status]);

  useEffect(() => {
    const el = remoteVideoRef.current;
    if (!el) return;
    el.srcObject = remoteStream;
    if (remoteStream) el.play().catch(() => {});
  }, [remoteStream, status, remoteVideoOn]);

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

  /* ---- fullscreen state ---- */
  useEffect(() => {
    const onChange = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
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

  return (
    <div className="am-grid bg-gradient-to-tr from-[#E0E7FF] via-[#EEF2FF] to-[#F5F3FF] text-[#111111] am-app flex flex-col antialiased relative overflow-x-hidden corp-sans">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
        .corp-sans { font-family: 'Inter', system-ui, sans-serif; }
        .corp-mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }
        .am-grid {
          background-image:
            linear-gradient(rgba(79,70,229,.045) 1px, transparent 1px),
            linear-gradient(90deg, rgba(79,70,229,.045) 1px, transparent 1px);
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
        @media (prefers-reduced-motion: reduce) {
          .am-fade-up, .am-ring, .am-scan, .am-digit, .am-float, .am-dot, .am-flow { animation: none; }
        }
      `}</style>

      <div className="absolute top-[-10%] right-[-5%] w-[400px] sm:w-[800px] h-[400px] sm:h-[800px] bg-gradient-to-br from-[#4F46E5]/35 via-[#8B5CF6]/30 to-transparent rounded-full blur-[70px] sm:blur-[110px] pointer-events-none z-0 animate-pulse duration-[5000ms]" />
      <div className="absolute bottom-[5%] left-[-10%] w-[350px] sm:w-[700px] h-[350px] sm:h-[700px] bg-gradient-to-tr from-[#6366F1]/25 via-[#EC4899]/10 to-transparent rounded-full blur-[80px] sm:blur-[120px] pointer-events-none z-0" />

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
              <h3 className="text-lg font-extrabold text-zinc-900 truncate">{joinRequest.name}</h3>
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
        <header className="shrink-0 mb-5 bg-white/75 backdrop-blur-xl border border-white/80 lg:border-[#EAEAEA] rounded-2xl px-5 py-4 flex flex-wrap items-center justify-between gap-4 shadow-[0_8px_32px_rgba(0,0,0,0.03)]">
          <div className="flex items-center gap-4 am-fade-up">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/airlink-icon.png" alt="" width={44} height={44} className="w-11 h-11 rounded-full shadow-md shadow-indigo-500/30" draggable={false} />
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-500 bg-clip-text text-transparent leading-tight">
                AirMIDI Link
              </h1>
              <p className="text-[11px] sm:text-xs text-zinc-500 max-w-[14rem] sm:max-w-none truncate sm:whitespace-normal">
                Encrypted MIDI transport over AirMIDI-Link V 0.1.13 concept MIDI 3.0
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
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
              className="w-9 h-9 rounded-full border border-zinc-200 bg-white text-zinc-600 hover:text-indigo-600 hover:border-indigo-300 hover:shadow-md active:scale-95 transition-all flex items-center justify-center"
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
          <section className="bg-white/80 backdrop-blur-xl border border-white/80 lg:border-[#EAEAEA] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] flex flex-col min-h-[420px] lg:min-h-0 lg:flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto am-scroll p-4 sm:p-10">
              <div className="min-h-full flex flex-col justify-center">
                <Stepper steps={steps} current={currentStep} />

                {/* CHOOSE ROLE */}
                {mode === "choose" && (
                  <div key="choose" className="am-fade-up w-full max-w-3xl mx-auto space-y-8">
                    <div className="text-center space-y-2">
                      <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900">Start a session</h2>
                      <p className="text-sm text-zinc-500 max-w-md mx-auto">
                        Choose how this device takes part in the link.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <button
                        onClick={handleChooseSender}
                        disabled={loading || scanning}
                        className="group text-left p-6 sm:p-7 rounded-2xl border border-zinc-200 bg-white hover:border-indigo-400 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 disabled:opacity-50"
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
                        className="group text-left p-6 sm:p-7 rounded-2xl border border-zinc-200 bg-white hover:border-sky-400 hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
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
                        <h2 className="text-xl font-extrabold text-zinc-900">Detect your adapter</h2>
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
                        <h2 className="text-xl font-extrabold text-zinc-900">Adapter ready</h2>
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
                        <h2 className="text-xl font-extrabold text-zinc-900">Share this code</h2>
                        <p className="text-xs text-zinc-500">Enter it on the receiver device to pair.</p>
                        <div className="flex justify-center gap-2 sm:gap-3">
                          {roomCode.split("").map((d, i) => (
                            <span
                              key={i}
                              style={{ animationDelay: `${i * 70}ms` }}
                              className="am-digit w-10 h-14 sm:w-16 sm:h-20 flex items-center justify-center rounded-xl bg-white border border-zinc-200 shadow-sm text-2xl sm:text-4xl font-extrabold text-zinc-900 corp-mono"
                            >
                              {d}
                            </span>
                          ))}
                        </div>
                        <button onClick={copyCode} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">
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
                      className="text-xs font-semibold text-zinc-500 hover:text-black transition-colors pt-1 block mx-auto"
                    >
                      ← {roomCode ? "Stop session" : "Back"}
                    </button>
                  </div>
                )}

                {/* RECEIVER */}
                {mode === "receiver" && !connected && (
                  <form key="receiver" onSubmit={handleConnectAsReceiver} className="am-fade-up w-full max-w-md mx-auto space-y-6">
                    <div className="text-center space-y-1">
                      <h2 className="text-xl font-extrabold text-zinc-900">Join a session</h2>
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
                      className="w-full h-20 bg-white border border-zinc-200 rounded-2xl px-4 text-4xl font-extrabold corp-mono text-center tracking-[0.5em] outline-none transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 placeholder:text-zinc-300 placeholder:tracking-[0.5em] disabled:opacity-60"
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

                {/* CONNECTED */}
                {connected && (
                  <div key="connected" className="am-fade-up w-full max-w-3xl mx-auto space-y-7">
                    <div className="text-center space-y-3">
                      <div className="relative w-24 h-24 mx-auto am-float">
                        <span className="absolute inset-0 rounded-full bg-emerald-400/30 am-ring" />
                        <span className="absolute inset-0 rounded-full bg-emerald-400/20 am-ring" style={{ animationDelay: "1.1s" }} />
                        <span
                          className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-150 ${
                            isActive
                              ? "bg-amber-400 text-black scale-110 shadow-lg shadow-amber-400/40"
                              : "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                          }`}
                        >
                          <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            {isActive ? <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" /> : <path d="M5 13l4 4L19 7" />}
                          </svg>
                        </span>
                      </div>
                      <h2 className="text-2xl font-extrabold tracking-tight text-zinc-900">Link active</h2>
                      <p className="text-sm text-zinc-500 max-w-md mx-auto leading-relaxed">
                        {mode === "receiver"
                          ? "Incoming MIDI is being played on this device's MIDI output."
                          : "MIDI from your USB adapter is being streamed directly to the receiver."}
                      </p>
                    </div>

                    {/* who am I connected with */}
                    <PeerLink me={me} peer={peer} myRole={mode === "receiver" ? "receiver" : "sender"} active={isActive} />

                    {/* optional video + voice (bidirectional) */}
                    <div className="bg-white border border-zinc-200 rounded-2xl p-3 sm:p-4 shadow-sm space-y-3">
                      <audio ref={remoteAudioRef} autoPlay playsInline />
                      {audioBlocked && (
                        <button
                          onClick={enableSound}
                          className="am-fade-up w-full h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold hover:bg-amber-100 transition-colors"
                        >
                          🔊 Tap to enable sound
                        </button>
                      )}
                      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-[#0B1020]">
                        <video
                          ref={remoteVideoRef}
                          autoPlay
                          playsInline
                          muted
                          className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-500 ${
                            remoteVideoOn ? "opacity-100" : "opacity-0"
                          }`}
                        />
                        {!remoteVideoOn && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-zinc-500 px-4 text-center">
                            <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" />
                              <line x1="1" y1="1" x2="23" y2="23" />
                            </svg>
                            <p className="text-xs font-medium">
                              {peer ? `${peer.name}'s camera is off` : "Remote camera is off"}
                            </p>
                          </div>
                        )}
                        {remoteVideoOn && peer && (
                          <span className="absolute left-3 bottom-3 text-[11px] font-semibold text-white bg-black/50 backdrop-blur px-2.5 py-1 rounded-full">
                            {peer.name}
                          </span>
                        )}
                        {remoteMicOn && (
                          <span className="absolute left-3 top-3 flex items-center gap-1.5 text-[11px] font-semibold text-white bg-black/50 backdrop-blur px-2.5 py-1 rounded-full">
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                            </svg>
                            {peer ? peer.name : "Remote"} is talking
                          </span>
                        )}
                        {cameraOn && (
                          <div className="am-fade-up absolute right-3 bottom-3 w-28 sm:w-40 aspect-video rounded-lg overflow-hidden border-2 border-white/80 shadow-lg bg-black">
                            <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover -scale-x-100" />
                            <span className="absolute left-1.5 top-1.5 flex items-center gap-1 text-[9px] font-bold text-white bg-red-600/90 px-1.5 py-0.5 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                              LIVE
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={toggleCamera}
                          disabled={cameraBusy}
                          className={`h-10 px-4 rounded-xl text-xs font-bold transition-all active:scale-[0.98] disabled:opacity-50 flex items-center gap-2 ${
                            cameraOn
                              ? "bg-red-50 text-red-600 border border-red-100 hover:bg-red-100"
                              : "bg-black text-white hover:bg-neutral-800"
                          }`}
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M23 7l-7 5 7 5V7z" />
                            <rect x="1" y="5" width="15" height="14" rx="2" />
                          </svg>
                          {cameraBusy ? "…" : cameraOn ? "Stop camera" : "Start camera"}
                        </button>
                        <button
                          onClick={toggleMic}
                          disabled={micBusy}
                          className={`h-10 px-4 rounded-xl text-xs font-bold transition-all active:scale-[0.98] disabled:opacity-50 flex items-center gap-2 ${
                            micOn
                              ? "bg-red-50 text-red-600 border border-red-100 hover:bg-red-100"
                              : "bg-zinc-900 text-white hover:bg-black"
                          }`}
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                            <line x1="12" y1="19" x2="12" y2="23" />
                            <line x1="8" y1="23" x2="16" y2="23" />
                          </svg>
                          {micBusy ? "…" : micOn ? "Stop mic" : "Start mic"}
                        </button>
                        <button
                          onClick={() => setSpeakerMuted((v) => !v)}
                          aria-label={speakerMuted ? "Unmute speaker" : "Mute speaker"}
                          title={speakerMuted ? "Unmute their voice" : "Mute their voice"}
                          className={`h-10 w-10 rounded-xl border bg-white flex items-center justify-center transition-colors ${
                            speakerMuted ? "border-red-200 text-red-500" : "border-zinc-200 text-zinc-600 hover:text-indigo-600"
                          }`}
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                            {speakerMuted ? (
                              <>
                                <line x1="23" y1="9" x2="17" y2="15" />
                                <line x1="17" y1="9" x2="23" y2="15" />
                              </>
                            ) : (
                              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                            )}
                          </svg>
                        </button>
                        <select
                          value={quality}
                          onChange={(e) => changeQuality(e.target.value as VideoQuality)}
                          disabled={cameraBusy}
                          className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 outline-none focus:border-indigo-400"
                        >
                          <option value="360p">360p · saves data</option>
                          <option value="720p">720p · sharper</option>
                        </select>
                        <p className="text-[11px] text-zinc-400 w-full sm:w-auto sm:ml-auto">
                          Camera and microphone stay off until you start them. Use headphones to avoid echo.
                        </p>
                      </div>
                    </div>

                    {/* stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: "Messages", value: stats.count.toLocaleString("en-US") },
                        { label: "Session", value: formatElapsed(elapsed) },
                        { label: "Role", value: roleLabel },
                        { label: mode === "receiver" ? "Outputs" : "Inputs", value: String(detectedDevices.length) },
                      ].map((s) => (
                        <div key={s.label} className="bg-zinc-50 border border-zinc-100 rounded-xl p-4 text-center">
                          <p className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">{s.label}</p>
                          <p className="text-base font-bold text-zinc-900 corp-mono mt-1">{s.value}</p>
                        </div>
                      ))}
                    </div>

                    {/* last message */}
                    <div className="bg-zinc-50 border border-zinc-100 rounded-xl px-5 py-4">
                      <p className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 mb-1">Last message</p>
                      <p className="text-sm corp-mono text-zinc-800 truncate">{stats.last}</p>
                    </div>

                    {/* channel meters */}
                    <div>
                      <p className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 mb-2">Channel activity</p>
                      <div className="flex items-end gap-1 sm:gap-1.5 h-24">
                        {channels.map((v, i) => (
                          <div key={i} className="flex-1 h-full flex items-end">
                            <div
                              className="w-full rounded-sm bg-gradient-to-t from-indigo-600 to-violet-400 transition-[height,opacity] duration-150"
                              style={{ height: `${6 + v * 94}%`, opacity: 0.3 + v * 0.7 }}
                            />
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-1.5 mt-1">
                        {channels.map((_, i) => (
                          <span key={i} className="flex-1 text-center text-[9px] text-zinc-400 corp-mono">
                            {i + 1}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* devices */}
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

                    <button
                      onClick={handleReset}
                      className="w-full h-11 rounded-xl text-xs font-semibold bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 transition-colors"
                    >
                      Disconnect
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ---------------- ACTIVITY LOG (compact, collapsed by default) ---------------- */}
          <section className="shrink-0 rounded-2xl border border-zinc-200 bg-white/80 backdrop-blur overflow-hidden flex flex-col">
            <button
              onClick={() => setShowLog((v) => !v)}
              className="shrink-0 w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-zinc-50/70 transition-colors"
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
                <button onClick={copyLog} className="text-[11px] font-semibold text-zinc-600 hover:text-black transition-colors">
                  Copy
                </button>
                <button onClick={downloadLog} className="text-[11px] font-semibold text-zinc-600 hover:text-black transition-colors">
                  Download
                </button>
                <button onClick={() => setLogs([])} className="text-[11px] font-semibold text-zinc-600 hover:text-red-600 transition-colors">
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

      {!appMode && <Footer />}
    </div>
  );
}