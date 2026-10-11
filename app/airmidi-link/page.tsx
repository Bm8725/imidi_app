"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { supabase } from "@/lib/supabase";
import { AirMidiLink, AirMidiStatus, AirMidiLogLevel } from "@/lib/AirMidiLink";

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
function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex items-center w-full mb-8">
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
                {done ? (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  i + 1
                )}
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

/* ---------------------------------------------------------------------- */
/* Page                                                                    */
/* ---------------------------------------------------------------------- */
export default function AirMidiPage() {
  const router = useRouter();
  const pathname = usePathname();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState("");

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
  const [showLog, setShowLog] = useState(false);
  const [logMidi, setLogMidi] = useState(true);
  const [stats, setStats] = useState({ count: 0, last: "—" });
  const [channels, setChannels] = useState<number[]>(Array(16).fill(0));
  const [elapsed, setElapsed] = useState(0);

  const airMidiRef = useRef<AirMidiLink | null>(null);
  const ledTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logBoxRef = useRef<HTMLDivElement | null>(null);

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

    link.onError = (msg) => {
      setError(msg);
      setLoading(false);
      setMode("choose");
      setRoomCode("");
      setInputCode("");
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

      pushLog("midi", `${dir === "out" ? "TX" : "RX"}  ${text}   [${toHex(data)}]`);
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

  /* ---- log auto-scroll ---- */
  useEffect(() => {
    if (showLog && logBoxRef.current) {
      logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
    }
  }, [logs, showLog]);

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
    countRef.current = 0;
    lastMsgRef.current = "—";
    chRef.current = Array(16).fill(0);
    setStats({ count: 0, last: "—" });
    setChannels(Array(16).fill(0));
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

  return (
    <div className="bg-gradient-to-tr from-[#E0E7FF] via-[#EEF2FF] to-[#F5F3FF] text-[#111111] min-h-screen flex flex-col antialiased relative overflow-x-hidden corp-sans">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
        .corp-sans { font-family: 'Inter', system-ui, sans-serif; }
        .corp-mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }
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
        @media (prefers-reduced-motion: reduce) {
          .am-fade-up, .am-ring, .am-scan, .am-digit, .am-float, .am-dot { animation: none; }
        }
      `}</style>

      <div className="absolute top-[-10%] right-[-5%] w-[400px] sm:w-[800px] h-[400px] sm:h-[800px] bg-gradient-to-br from-[#4F46E5]/35 via-[#8B5CF6]/30 to-transparent rounded-full blur-[70px] sm:blur-[110px] pointer-events-none z-0 animate-pulse duration-[5000ms]" />
      <div className="absolute bottom-[5%] left-[-10%] w-[350px] sm:w-[700px] h-[350px] sm:h-[700px] bg-gradient-to-tr from-[#6366F1]/25 via-[#EC4899]/10 to-transparent rounded-full blur-[80px] sm:blur-[120px] pointer-events-none z-0" />

      <Navbar />

      {/* HEADER */}
      <div className="bg-white/70 backdrop-blur-md border-b border-[#EAEAEA] pt-32 pb-8 relative z-10">
        <div className="max-w-2xl mx-auto px-6 flex flex-wrap justify-between items-center gap-4">
          <div className="am-fade-up">
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-500 bg-clip-text text-transparent py-1">
              AirMIDI Link 
            </h1>
            <p className="text-xs text-zinc-500">
              Encrypted  MIDI transport over AirMIDI-Link V 0.1.13  concept MIDI 3.0
            </p>
            {userEmail && (
              <p className="text-[11px] text-zinc-400 mt-1 corp-mono">Signed in as {userEmail}</p>
            )}
          </div>

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
        </div>
      </div>

      <main className="flex-1 w-full max-w-2xl mx-auto px-6 py-10 relative z-10">
        {/* ERROR */}
        {error && (
          <div className="am-fade-up mb-6 p-4 bg-red-50/90 border border-red-200 rounded-2xl text-xs text-red-700 flex items-start gap-3">
            <svg className="w-4 h-4 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
            </svg>
            <span className="flex-1 font-medium leading-relaxed">{error}</span>
            <button onClick={() => setError("")} className="text-red-400 hover:text-red-700 transition-colors" aria-label="Dismiss">
              ✕
            </button>
          </div>
        )}

        {/* MAIN CARD */}
        <div className="bg-white/80 backdrop-blur-xl border border-white/80 sm:border-[#EAEAEA] rounded-3xl p-6 sm:p-10 shadow-[0_8px_32px_rgba(0,0,0,0.04)]">
          <Stepper steps={steps} current={currentStep} />

          {/* CHOOSE ROLE */}
          {mode === "choose" && (
            <div key="choose" className="am-fade-up grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={handleChooseSender}
                disabled={loading || scanning}
                className="group text-left p-5 rounded-2xl border border-zinc-200 bg-white hover:border-indigo-400 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50"
              >
                <span className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20V10m0 0l-4 4m4-4l4 4M5 5h14" />
                  </svg>
                </span>
                <span className="block text-sm font-bold text-zinc-900">Sender</span>
                <span className="block text-xs text-zinc-500 mt-1 leading-relaxed">
                  Stream MIDI from a USB adapter connected to this device.
                </span>
              </button>

              <button
                onClick={() => {
                  setError("");
                  setMode("receiver");
                }}
                className="group text-left p-5 rounded-2xl border border-zinc-200 bg-white hover:border-sky-400 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
              >
                <span className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center mb-4 group-hover:bg-sky-600 group-hover:text-white transition-colors duration-300">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 4v10m0 0l-4-4m4 4l4-4M5 19h14" />
                  </svg>
                </span>
                <span className="block text-sm font-bold text-zinc-900">Receiver</span>
                <span className="block text-xs text-zinc-500 mt-1 leading-relaxed">
                  Join with a code and play incoming MIDI on this device.
                </span>
              </button>
            </div>
          )}

          {/* SENDER */}
          {mode === "sender" && !connected && (
            <div key={`sender-${roomCode ? "code" : "setup"}`} className="am-fade-up text-center space-y-5">
              {scanning && <ScanBar label="Scanning for USB MIDI adapters…" />}

              {!scanning && !roomCode && detectedDevices.length === 0 && (
                <>
                  <div className="text-xs bg-amber-50 border border-amber-200 p-4 rounded-xl text-amber-800 font-medium leading-relaxed text-left">
                    No USB MIDI adapter detected. Plug it into this device and allow MIDI access in your browser.
                  </div>
                  <button
                    onClick={scanAdapters}
                    className="h-10 px-5 bg-black text-white text-xs font-semibold rounded-xl hover:bg-neutral-800 active:scale-[0.98] transition-all"
                  >
                    Scan again
                  </button>
                </>
              )}

              {!scanning && !roomCode && detectedDevices.length > 0 && (
                <>
                  <div className="text-left space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                      Detected adapters
                    </p>
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
                    className="w-full h-11 bg-black text-white text-xs font-bold uppercase tracking-widest rounded-xl hover:bg-neutral-800 active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
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
                  <p className="text-xs text-zinc-500">Share this code with the receiver</p>
                  <div className="flex justify-center gap-2 sm:gap-3">
                    {roomCode.split("").map((d, i) => (
                      <span
                        key={i}
                        style={{ animationDelay: `${i * 70}ms` }}
                        className="am-digit w-11 h-14 sm:w-14 sm:h-[4.5rem] flex items-center justify-center rounded-xl bg-white border border-zinc-200 shadow-sm text-2xl sm:text-3xl font-extrabold text-zinc-900 corp-mono"
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={copyCode}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                  >
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
            <form key="receiver" onSubmit={handleConnectAsReceiver} className="am-fade-up space-y-5">
              <div className="text-center space-y-1">
                <p className="text-sm font-bold text-zinc-900">Join a session</p>
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
                className="w-full h-16 bg-white border border-zinc-200 rounded-2xl px-4 text-3xl font-extrabold corp-mono text-center tracking-[0.5em] outline-none transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 placeholder:text-zinc-300 placeholder:tracking-[0.5em] disabled:opacity-60"
                placeholder="000000"
                disabled={loading}
              />
              {loading && <ScanBar label="Negotiating secure connection…" />}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="h-11 px-5 bg-zinc-100 hover:bg-zinc-200 text-xs font-semibold rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || inputCode.length < 6}
                  className="flex-1 h-11 bg-black text-white text-xs font-bold uppercase tracking-widest rounded-xl hover:bg-neutral-800 active:scale-[0.99] transition-all disabled:opacity-50"
                >
                  {loading ? "Connecting…" : "Connect →"}
                </button>
              </div>
            </form>
          )}

          {/* CONNECTED */}
          {connected && (
            <div key="connected" className="am-fade-up space-y-6">
              <div className="text-center space-y-3">
                <div className="relative w-20 h-20 mx-auto am-float">
                  <span className="absolute inset-0 rounded-full bg-emerald-400/30 am-ring" />
                  <span className="absolute inset-0 rounded-full bg-emerald-400/20 am-ring" style={{ animationDelay: "1.1s" }} />
                  <span
                    className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-150 ${
                      isActive
                        ? "bg-amber-400 text-black scale-110 shadow-lg shadow-amber-400/40"
                        : "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                    }`}
                  >
                    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      {isActive ? <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" /> : <path d="M5 13l4 4L19 7" />}
                    </svg>
                  </span>
                </div>
                <h3 className="text-base font-bold text-zinc-900">Link active</h3>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto leading-relaxed">
                  {mode === "receiver"
                    ? "Incoming MIDI is being played on this device's MIDI output."
                    : "MIDI from your USB adapter is being streamed directly to the receiver."}
                </p>
              </div>

              {/* stats */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Messages", value: stats.count.toLocaleString("en-US") },
                  { label: "Session", value: formatElapsed(elapsed) },
                  { label: "Role", value: mode === "receiver" ? "Receiver" : "Sender" },
                ].map((s) => (
                  <div key={s.label} className="bg-zinc-50 border border-zinc-100 rounded-xl p-3 text-center">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">{s.label}</p>
                    <p className="text-sm font-bold text-zinc-900 corp-mono mt-0.5">{s.value}</p>
                  </div>
                ))}
              </div>

              {/* last message */}
              <div className="bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3">
                <p className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 mb-1">Last message</p>
                <p className="text-xs corp-mono text-zinc-800 truncate">{stats.last}</p>
              </div>

              {/* channel meters */}
              <div>
                <p className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 mb-2">Channel activity</p>
                <div className="flex items-end gap-1 h-12">
                  {channels.map((v, i) => (
                    <div key={i} className="flex-1 h-full flex items-end">
                      <div
                        className="w-full rounded-sm bg-gradient-to-t from-indigo-600 to-violet-400 transition-[height,opacity] duration-150"
                        style={{ height: `${8 + v * 92}%`, opacity: 0.3 + v * 0.7 }}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex gap-1 mt-1">
                  {channels.map((_, i) => (
                    <span key={i} className="flex-1 text-center text-[8px] text-zinc-400 corp-mono">
                      {i + 1}
                    </span>
                  ))}
                </div>
              </div>

              {/* devices */}
              {detectedDevices.length > 0 ? (
                <div className="text-xs bg-zinc-50 border border-zinc-100 p-3 rounded-xl text-zinc-500 font-medium">
                  {mode === "receiver" ? "MIDI outputs: " : "MIDI inputs: "}
                  <span className="text-zinc-900 corp-mono">{detectedDevices.join(", ")}</span>
                </div>
              ) : (
                <div className="text-xs bg-amber-50 border border-amber-200 p-3 rounded-xl text-amber-800 font-medium leading-relaxed">
                  {mode === "receiver"
                    ? "No MIDI output found. Incoming data cannot be played here. Connect a USB MIDI adapter or use a browser that supports Web MIDI (Chrome / Edge / Opera)."
                    : "No MIDI input found. Plug in your USB adapter and allow MIDI access."}
                </div>
              )}

              <button
                onClick={handleReset}
                className="w-full h-10 rounded-xl text-xs font-semibold bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 transition-colors"
              >
                Disconnect
              </button>
            </div>
          )}
        </div>

        {/* ACTIVITY LOG */}
        <div className="mt-6 rounded-2xl border border-zinc-200 bg-white/80 backdrop-blur overflow-hidden">
          <button
            onClick={() => setShowLog((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-zinc-50/70 transition-colors"
          >
            <span className="flex items-center gap-2 text-xs font-bold text-zinc-800">
              <svg className="w-4 h-4 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 17l6-6-6-6M12 19h8" />
              </svg>
              Activity log
              <span className="text-[10px] font-semibold bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full corp-mono">
                {logs.length}
              </span>
              {hasError && <span className="w-2 h-2 rounded-full bg-red-500" />}
            </span>
            <svg
              className={`w-4 h-4 text-zinc-400 transition-transform duration-300 ${showLog ? "rotate-180" : ""}`}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {showLog && (
            <div className="am-fade-up border-t border-zinc-200">
              <div className="flex flex-wrap items-center gap-3 px-4 py-2 bg-zinc-50 border-b border-zinc-200">
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
                className="h-60 overflow-y-auto bg-[#0B1020] px-4 py-3 corp-mono text-[11px] leading-relaxed"
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
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}