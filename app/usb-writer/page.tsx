// app/pa-connect/page.tsx  ·  connect to a Korg Pa (or any USB MIDI keyboard) straight from the browser
// Uses the Web MIDI API: Chrome / Edge on a computer, HTTPS. No install, no extra packages.
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

/* ════════════════════════════════════════════════════════════════
   helpers
   ════════════════════════════════════════════════════════════════ */
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const noteName = (n: number) => `${NOTE_NAMES[n % 12]}${Math.floor(n / 12) - 1}`; // C4 = 60
const isBlack = (n: number) => [1, 3, 6, 8, 10].includes(n % 12);
const hex = (n: number) => n.toString(16).toUpperCase().padStart(2, "0");

const CC_NAMES: Record<number, string> = {
  0: "Bank select MSB", 1: "Modulation", 7: "Volume", 10: "Pan", 11: "Expression", 32: "Bank select LSB",
  64: "Sustain", 91: "Reverb send", 93: "Chorus send", 120: "All sound off", 121: "Reset controllers", 123: "All notes off",
};

const PA_RE = /korg|\bpa[\s-]?\d|\bpa\d|pa\d{3,4}/i; // names like "KORG Pa5X", "Pa700", "Pa1000"

type Kind = "note" | "cc" | "pc" | "bend" | "sysex" | "other" | "out";
type Line = { id: number; t: string; text: string; kind: Kind };
type PortInfo = { id: string; name: string; manufacturer: string; state: string };

function decode(d: Uint8Array): { text: string; kind: Kind; timing?: boolean } {
  const st = d[0];
  const ch = (st & 0x0f) + 1;
  const a = d[1] ?? 0;
  const b = d[2] ?? 0;
  switch (st & 0xf0) {
    case 0x80: return { kind: "note", text: `Note off   ch ${ch}  ${noteName(a)}` };
    case 0x90: return b === 0 ? { kind: "note", text: `Note off   ch ${ch}  ${noteName(a)}` } : { kind: "note", text: `Note on    ch ${ch}  ${noteName(a)}  vel ${b}` };
    case 0xa0: return { kind: "other", text: `Aftertouch ch ${ch}  ${noteName(a)}  ${b}` };
    case 0xb0: return { kind: "cc", text: `CC ${a}${CC_NAMES[a] ? ` (${CC_NAMES[a]})` : ""}  ch ${ch}  = ${b}` };
    case 0xc0: return { kind: "pc", text: `Program    ch ${ch}  ${a + 1}  (raw ${a})` };
    case 0xd0: return { kind: "other", text: `Pressure   ch ${ch}  ${a}` };
    case 0xe0: return { kind: "bend", text: `Pitch bend ch ${ch}  ${(b << 7 | a) - 8192}` };
  }
  switch (st) {
    case 0xf0: return { kind: "sysex", text: `SysEx  ${d.length} bytes  ${Array.from(d.slice(0, 10)).map(hex).join(" ")}${d.length > 10 ? " …" : ""}` };
    case 0xf8: return { kind: "other", text: "Timing clock", timing: true };
    case 0xfe: return { kind: "other", text: "Active sensing", timing: true };
    case 0xfa: return { kind: "other", text: "Start" };
    case 0xfb: return { kind: "other", text: "Continue" };
    case 0xfc: return { kind: "other", text: "Stop" };
  }
  return { kind: "other", text: Array.from(d).map(hex).join(" ") };
}

function parseIdentity(d: Uint8Array) {
  let i = 5;
  let man: string;
  if (d[i] === 0) {
    man = [d[i], d[i + 1], d[i + 2]].map(hex).join(" ");
    i += 3;
  } else {
    man = hex(d[i]);
    i += 1;
  }
  const rest = Array.from(d.slice(i, d.length - 1));
  return {
    maker: d[5] === 0x42 ? "KORG" : "Unknown",
    manufacturer: man,
    family: rest.slice(0, 2).map(hex).join(" ") || "–",
    model: rest.slice(2, 4).map(hex).join(" ") || "–",
    version: rest.slice(4, 8).map(hex).join(" ") || "–",
  };
}

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5CA1] focus-visible:ring-offset-2 focus-visible:ring-offset-[#131316]";
const BTN = `h-11 rounded-xl border border-white/20 px-5 text-xs font-bold uppercase tracking-wide text-white transition-colors enabled:hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS}`;

const COMPUTER_KEYS = "awsedftgyhujkolp;".split(""); // C4 upwards

const KB_FROM = 48; // C3
const KB_TO = 71; // B4

function Card({ title, hint, children, id }: { title: string; hint?: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="rounded-2xl border border-white/[0.08] bg-[#18181C] p-5 sm:p-7">
      <h2 className="aw-display text-lg font-semibold text-white">{title}</h2>
      {hint && <p className="mt-1 text-[13px] leading-relaxed text-[#A1A1AA]">{hint}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

const selectCls = `mt-1.5 h-11 w-full rounded-xl border border-white/[0.12] bg-[#131316] px-3 text-sm text-white outline-none focus:border-[#FF5CA1]/60 disabled:opacity-50`;

/* ════════════════════════════════════════════════════════════════
   page
   ════════════════════════════════════════════════════════════════ */
export default function PaConnectPage() {
  const [supported, setSupported] = useState(true);
  const [status, setStatus] = useState<"idle" | "asking" | "ready" | "denied">("idle");
  const [sysexOk, setSysexOk] = useState(false);
  const [inputs, setInputs] = useState<PortInfo[]>([]);
  const [outputs, setOutputs] = useState<PortInfo[]>([]);
  const [selIn, setSelIn] = useState("");
  const [selOut, setSelOut] = useState("");
  const [channel, setChannel] = useState(1);
  const [velocity, setVelocity] = useState(100);
  const [toast, setToast] = useState("");

  const [lines, setLines] = useState<Line[]>([]);
  const [paused, setPaused] = useState(false);
  const [showTiming, setShowTiming] = useState(false);
  const [ident, setIdent] = useState<ReturnType<typeof parseIdentity> | null>(null);
  const [identWait, setIdentWait] = useState(false);
  const [bank, setBank] = useState({ msb: 0, lsb: 0, prog: 1 });
  const [rawHex, setRawHex] = useState("F0 7E 7F 06 01 F7");
  const [down, setDown] = useState<Set<number>>(new Set());

  const accessRef = useRef<any>(null);
  const bufRef = useRef<Line[]>([]);
  const idRef = useRef(0);
  const pausedRef = useRef(false);
  const timingRef = useRef(false);
  const activeNotes = useRef<Set<number>>(new Set());
  const identTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  pausedRef.current = paused;
  timingRef.current = showTiming;

  const flash = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? "" : t)), 2600);
  }, []);

  useEffect(() => {
    setSupported("requestMIDIAccess" in navigator && window.isSecureContext);
  }, []);

  /* the log is filled in batches, so a busy keyboard doesn't make the page stutter */
  const push = useCallback((text: string, kind: Kind) => {
    bufRef.current.push({ id: ++idRef.current, t: new Date().toLocaleTimeString("en-GB"), text, kind });
  }, []);
  useEffect(() => {
    const id = setInterval(() => {
      if (!bufRef.current.length || pausedRef.current) return;
      const add = bufRef.current.splice(0).reverse();
      setLines((l) => [...add, ...l].slice(0, 300));
    }, 120);
    return () => clearInterval(id);
  }, []);

  const readPorts = useCallback(() => {
    const acc = accessRef.current;
    if (!acc) return;
    const map = (p: any): PortInfo => ({ id: p.id, name: p.name || "Unnamed port", manufacturer: p.manufacturer || "", state: p.state });
    const ins: PortInfo[] = Array.from(acc.inputs.values()).map(map);
    const outs: PortInfo[] = Array.from(acc.outputs.values()).map(map);
    setInputs(ins);
    setOutputs(outs);
    setSelIn((cur) => (cur && ins.some((p) => p.id === cur) ? cur : (ins.find((p) => PA_RE.test(`${p.name} ${p.manufacturer}`)) ?? ins[0])?.id ?? ""));
    setSelOut((cur) => (cur && outs.some((p) => p.id === cur) ? cur : (outs.find((p) => PA_RE.test(`${p.name} ${p.manufacturer}`)) ?? outs[0])?.id ?? ""));
  }, []);

  /* ---------- connect ---------- */
  const connect = async () => {
    setStatus("asking");
    let acc: any = null;
    try {
      acc = await (navigator as any).requestMIDIAccess({ sysex: true });
      setSysexOk(true);
    } catch {
      try {
        acc = await (navigator as any).requestMIDIAccess({ sysex: false });
        setSysexOk(false);
      } catch {
        setStatus("denied");
        return;
      }
    }
    accessRef.current = acc;
    acc.onstatechange = (e: any) => {
      const p = e.port;
      push(`${p.type === "input" ? "In" : "Out"} port “${p.name}” ${p.state}`, "other");
      readPorts();
    };
    readPorts();
    setStatus("ready");
  };

  /* ---------- listen to the chosen input ---------- */
  const onMessage = useCallback(
    (e: any) => {
      const d: Uint8Array = e.data;
      if (!d?.length) return;
      if (d[0] === 0xf0 && d[1] === 0x7e && d[3] === 0x06 && d[4] === 0x02) {
        setIdent(parseIdentity(d));
        setIdentWait(false);
        if (identTimer.current) clearTimeout(identTimer.current);
      }
      const m = decode(d);
      if (m.timing && !timingRef.current) return;
      push(m.text, m.kind);
    },
    [push]
  );

  useEffect(() => {
    const acc = accessRef.current;
    if (!acc || status !== "ready") return;
    acc.inputs.forEach((i: any) => (i.onmidimessage = null));
    const input = acc.inputs.get(selIn);
    if (input) input.onmidimessage = onMessage;
    return () => {
      if (input) input.onmidimessage = null;
    };
  }, [selIn, status, onMessage, inputs]);

  /* ---------- send ---------- */
  const send = useCallback(
    (bytes: number[], note?: string) => {
      const out = accessRef.current?.outputs.get(selOut);
      if (!out) {
        flash("Choose an output port first.");
        return false;
      }
      try {
        out.send(bytes);
        if (note) push(`→ ${note}`, "out");
        return true;
      } catch {
        flash("The keyboard didn't accept that message.");
        return false;
      }
    },
    [selOut, push, flash]
  );

  const noteOn = useCallback(
    (n: number) => {
      if (activeNotes.current.has(n)) return;
      if (send([0x90 | (channel - 1), n, velocity])) {
        activeNotes.current.add(n);
        setDown(new Set(activeNotes.current));
      }
    },
    [send, channel, velocity]
  );
  const noteOff = useCallback(
    (n: number) => {
      if (!activeNotes.current.has(n)) return;
      send([0x80 | (channel - 1), n, 0]);
      activeNotes.current.delete(n);
      setDown(new Set(activeNotes.current));
    },
    [send, channel]
  );

  const panic = () => {
    for (let c = 0; c < 16; c++) {
      send([0xb0 | c, 123, 0]);
      send([0xb0 | c, 120, 0]);
    }
    activeNotes.current.clear();
    setDown(new Set());
    push("→ Panic: all notes and sound off, 16 channels", "out");
    flash("Panic sent.");
  };

  const testNote = () => {
    const ch = channel - 1;
    if (send([0x90 | ch, 60, velocity], `Test note C4 on ch ${channel}`)) setTimeout(() => send([0x80 | ch, 60, 0]), 600);
  };

  const askIdentity = () => {
    if (!sysexOk) return flash("SysEx was not allowed. Reconnect and allow it.");
    setIdent(null);
    if (send([0xf0, 0x7e, 0x7f, 0x06, 0x01, 0xf7], "Device inquiry")) {
      setIdentWait(true);
      identTimer.current = setTimeout(() => {
        setIdentWait(false);
        flash("No answer. This keyboard may not reply to device inquiry, or the input port is not the Pa.");
      }, 2200);
    }
  };

  const sendProgram = () => {
    const c = channel - 1;
    send([0xb0 | c, 0, bank.msb & 0x7f]);
    send([0xb0 | c, 32, bank.lsb & 0x7f]);
    send([0xc0 | c, (bank.prog - 1) & 0x7f], `Bank ${bank.msb}/${bank.lsb}, program ${bank.prog}, ch ${channel}`);
  };

  const sendRaw = () => {
    if (!sysexOk) return flash("SysEx was not allowed. Reconnect and allow it.");
    const bytes = (rawHex.match(/[0-9a-fA-F]{2}/g) ?? []).map((h) => parseInt(h, 16));
    if (bytes.length < 3 || bytes[0] !== 0xf0 || bytes[bytes.length - 1] !== 0xf7) return flash("A SysEx message starts with F0 and ends with F7.");
    if (bytes.slice(1, -1).some((b) => b > 0x7f)) return flash("Data bytes in SysEx must be 00 to 7F.");
    send(bytes, `SysEx ${bytes.length} bytes`);
  };

  /* computer keyboard plays notes too */
  useEffect(() => {
    if (status !== "ready") return;
    const typing = (t: EventTarget | null) => t instanceof HTMLElement && /input|textarea|select/i.test(t.tagName);
    const dn = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
      const i = COMPUTER_KEYS.indexOf(e.key.toLowerCase());
      if (i >= 0) noteOn(60 + i);
    };
    const up = (e: KeyboardEvent) => {
      const i = COMPUTER_KEYS.indexOf(e.key.toLowerCase());
      if (i >= 0) noteOff(60 + i);
    };
    window.addEventListener("keydown", dn);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", dn);
      window.removeEventListener("keyup", up);
    };
  }, [status, noteOn, noteOff]);

  /* never leave a note hanging */
  useEffect(
    () => () => {
      activeNotes.current.forEach((n) => accessRef.current?.outputs.get(selOut)?.send([0x80, n, 0]));
    },
    [selOut]
  );

  const paIn = useMemo(() => inputs.find((p) => p.id === selIn), [inputs, selIn]);
  const paDetected = !!paIn && PA_RE.test(`${paIn.name} ${paIn.manufacturer}`);

  const whites = useMemo(() => Array.from({ length: KB_TO - KB_FROM + 1 }, (_, i) => KB_FROM + i).filter((n) => !isBlack(n)), []);

  return (
    <div className="aw-root flex min-h-screen flex-col bg-[#131316] text-[#F2F2F4] selection:bg-[#FF5CA1]/40 selection:text-white">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700&family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        .aw-root { font-family: 'Inter', ui-sans-serif, system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
        .aw-display { font-family: 'Sora', ui-sans-serif, system-ui, sans-serif; }
        .aw-mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }
      `}</style>

      <Navbar />

      <main id="main-content" className="relative flex-1 overflow-x-clip px-5 pb-20 pt-28 sm:px-6">
        <div aria-hidden className="pointer-events-none absolute -top-20 right-0 h-[320px] w-[320px] rounded-full bg-[#FF5CA1]/10 blur-[120px] sm:h-[460px] sm:w-[460px]" />

        <div className="relative mx-auto w-full max-w-4xl">
          <p className="aw-mono text-xs uppercase tracking-[0.16em] text-[#FF5CA1]">iMIDI · USB connect</p>
          <h1 className="aw-display mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Connect your Korg Pa by USB</h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[#A1A1AA]">
            Plug the keyboard into your computer, press connect, and play it, watch its MIDI, and send it commands, straight from the browser. Nothing to install.
          </p>

          {!supported && (
            <p role="alert" className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
              This needs Chrome or Edge on a computer, over HTTPS. Safari and Firefox don&apos;t support Web MIDI.
            </p>
          )}

          <div className="mt-8 space-y-4">
            {/* CONNECT */}
            <Card
              title="Connection"
              hint="Use a USB cable from the keyboard's USB Device port (the square type-B one, marked for a computer) to your computer. Switch the keyboard on first."
            >
              {status !== "ready" ? (
                <>
                  <button type="button" onClick={connect} disabled={!supported || status === "asking"} className={`h-12 rounded-xl bg-gradient-to-r from-[#FF5CA1] to-[#FF8A3D] px-8 text-xs font-bold uppercase tracking-wide text-white transition-transform enabled:hover:scale-[1.02] enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS}`}>
                    {status === "asking" ? "Waiting for permission…" : "Connect via USB"}
                  </button>
                  {status === "denied" && (
                    <p role="alert" className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                      MIDI access was blocked. Click the lock icon in the address bar, allow MIDI devices for this site, and try again.
                    </p>
                  )}
                </>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${paDetected ? "bg-emerald-500/15 text-emerald-300" : "bg-white/[0.07] text-[#B4B4BC]"}`}>
                      <span className={`h-2 w-2 rounded-full ${paDetected ? "bg-emerald-400" : "bg-[#8E8E98]"}`} />
                      {paDetected ? `Korg detected: ${paIn!.name}` : inputs.length ? "Connected, no Korg found" : "Connected, no MIDI devices found"}
                    </span>
                    {!sysexOk && <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-200">SysEx not allowed</span>}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm font-medium text-white">
                      From the keyboard (input)
                      <select className={selectCls} value={selIn} onChange={(e) => setSelIn(e.target.value)} disabled={!inputs.length}>
                        {!inputs.length && <option>No input found</option>}
                        {inputs.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-sm font-medium text-white">
                      To the keyboard (output)
                      <select className={selectCls} value={selOut} onChange={(e) => setSelOut(e.target.value)} disabled={!outputs.length}>
                        {!outputs.length && <option>No output found</option>}
                        {outputs.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {!inputs.length && (
                    <p className="rounded-xl border border-white/[0.1] bg-white/[0.03] p-4 text-sm leading-relaxed text-[#B4B4BC]">
                      No keyboard found. Check the cable is in the USB Device port and the keyboard is on. Close any other program using it (a DAW, for example), because it can hold the port. If your computer still
                      doesn&apos;t list it, install the KORG USB-MIDI driver from Korg&apos;s website.
                    </p>
                  )}
                </div>
              )}
            </Card>

            {status === "ready" && (
              <>
                {/* PLAY */}
                <Card title="Play" hint="Click or touch the keys, or use your computer keyboard (A W S E D F T G Y H U J K …). Sound comes from the Pa.">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm font-medium text-white">
                      Channel: <span className="aw-mono text-[#FF8FBF]">{channel}</span>
                      <input type="range" min={1} max={16} value={channel} onChange={(e) => setChannel(+e.target.value)} className="mt-3 w-full accent-[#FF5CA1]" />
                    </label>
                    <label className="block text-sm font-medium text-white">
                      Velocity: <span className="aw-mono text-[#FF8FBF]">{velocity}</span>
                      <input type="range" min={1} max={127} value={velocity} onChange={(e) => setVelocity(+e.target.value)} className="mt-3 w-full accent-[#FF5CA1]" />
                    </label>
                  </div>

                  <div className="relative mt-5 h-36 select-none touch-none sm:h-44" role="group" aria-label="On-screen keyboard">
                    <div className="flex h-full overflow-hidden rounded-xl border border-white/10">
                      {whites.map((n) => (
                        <button
                          key={n}
                          type="button"
                          aria-label={noteName(n)}
                          onPointerDown={(e) => {
                            e.currentTarget.setPointerCapture(e.pointerId);
                            noteOn(n);
                          }}
                          onPointerUp={() => noteOff(n)}
                          onPointerCancel={() => noteOff(n)}
                          className={`relative flex-1 border-r border-black/30 last:border-r-0 transition-colors ${down.has(n) ? "bg-[#FFB3D1]" : "bg-[#F2F2F4] hover:bg-white"} ${FOCUS}`}
                        >
                          {n % 12 === 0 && <span className="aw-mono absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-[#555]">{noteName(n)}</span>}
                        </button>
                      ))}
                    </div>
                    {whites.map((n, i) =>
                      isBlack(n + 1) && n + 1 <= KB_TO ? (
                        <button
                          key={n + 1}
                          type="button"
                          aria-label={noteName(n + 1)}
                          onPointerDown={(e) => {
                            e.currentTarget.setPointerCapture(e.pointerId);
                            noteOn(n + 1);
                          }}
                          onPointerUp={() => noteOff(n + 1)}
                          onPointerCancel={() => noteOff(n + 1)}
                          className={`absolute top-0 z-10 h-[62%] rounded-b-md ${down.has(n + 1) ? "bg-[#FF5CA1]" : "bg-[#18181C] hover:bg-[#2A2A30]"} ${FOCUS}`}
                          style={{ left: `${((i + 1) / whites.length) * 100}%`, width: `${(100 / whites.length) * 0.62}%`, transform: "translateX(-50%)" }}
                        />
                      ) : null
                    )}
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button type="button" onClick={testNote} className={BTN}>Test note</button>
                    <button type="button" onClick={panic} className={`${BTN} border-red-400/40 text-red-200 enabled:hover:bg-red-500/10`}>Panic: silence everything</button>
                  </div>
                </Card>

                {/* MONITOR */}
                <Card title="MIDI monitor" hint="Everything the keyboard sends. Press keys, buttons and pedals on the Pa to see them here.">
                  <div className="mb-3 flex flex-wrap items-center gap-3">
                    <button type="button" onClick={() => setPaused((p) => !p)} className={BTN}>{paused ? "Resume" : "Pause"}</button>
                    <button type="button" onClick={() => { setLines([]); bufRef.current = []; }} className={BTN}>Clear</button>
                    <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm text-[#B4B4BC]">
                      <input type="checkbox" checked={showTiming} onChange={(e) => setShowTiming(e.target.checked)} className="accent-[#FF5CA1]" />
                      Show clock and active sensing
                    </label>
                  </div>
                  <div className="aw-mono h-64 overflow-y-auto rounded-xl border border-white/[0.08] bg-[#131316] p-3 text-[12px] leading-relaxed" role="log" aria-live="off">
                    {lines.length === 0 ? (
                      <p className="text-[#8E8E98]">Waiting for MIDI…</p>
                    ) : (
                      lines.map((l) => (
                        <div key={l.id} className="flex gap-3 whitespace-pre">
                          <span className="shrink-0 text-[#6A6A73]">{l.t}</span>
                          <span className={l.kind === "out" ? "text-[#FF8A3D]" : l.kind === "note" ? "text-[#FF8FBF]" : l.kind === "cc" ? "text-[#B47CFF]" : l.kind === "pc" ? "text-emerald-300" : l.kind === "sysex" ? "text-cyan-300" : "text-[#D4D4D9]"}>{l.text}</span>
                        </div>
                      ))
                    )}
                  </div>
                </Card>

                {/* DEVICE + TOOLS */}
                <Card title="Device and tools">
                  <div className="flex flex-wrap items-center gap-3">
                    <button type="button" onClick={askIdentity} disabled={identWait} className={BTN}>{identWait ? "Asking…" : "Ask the keyboard who it is"}</button>
                  </div>
                  {ident && (
                    <dl className="aw-mono mt-4 grid gap-x-8 gap-y-2 rounded-xl border border-white/[0.08] bg-[#131316] p-4 text-[12px] sm:grid-cols-2">
                      <div><dt className="text-[#8E8E98]">Maker</dt><dd className="text-white">{ident.maker} ({ident.manufacturer})</dd></div>
                      <div><dt className="text-[#8E8E98]">Family code</dt><dd className="text-white">{ident.family}</dd></div>
                      <div><dt className="text-[#8E8E98]">Model code</dt><dd className="text-white">{ident.model}</dd></div>
                      <div><dt className="text-[#8E8E98]">Version bytes</dt><dd className="text-white">{ident.version}</dd></div>
                    </dl>
                  )}

                  <div className="mt-6 border-t border-white/[0.07] pt-5">
                    <p className="text-sm font-semibold text-white">Select a sound</p>
                    <p className="mt-1 text-[13px] text-[#A1A1AA]">Sends bank select and program change on channel {channel}. What each number means depends on the Pa&apos;s own sound list.</p>
                    <div className="mt-3 grid grid-cols-3 gap-3 sm:max-w-md">
                      {([["Bank MSB", "msb", 0, 127], ["Bank LSB", "lsb", 0, 127], ["Program", "prog", 1, 128]] as const).map(([label, key, min, max]) => (
                        <label key={key} className="block text-xs font-medium text-[#B4B4BC]">
                          {label}
                          <input
                            type="number"
                            min={min}
                            max={max}
                            value={bank[key]}
                            onChange={(e) => setBank((b) => ({ ...b, [key]: Math.min(max, Math.max(min, +e.target.value || min)) }))}
                            className="mt-1.5 h-11 w-full rounded-xl border border-white/[0.12] bg-[#131316] px-3 text-sm text-white outline-none focus:border-[#FF5CA1]/60"
                          />
                        </label>
                      ))}
                    </div>
                    <button type="button" onClick={sendProgram} className={`${BTN} mt-4`}>Send</button>
                  </div>

                  <details className="group mt-6 border-t border-white/[0.07] pt-4">
                    <summary className={`flex cursor-pointer list-none items-center justify-between rounded text-sm font-semibold text-[#D4D4D9] hover:text-white ${FOCUS}`}>
                      Advanced: send SysEx
                      <span aria-hidden className="text-[#8E8E98] transition-transform group-open:rotate-180">⌄</span>
                    </summary>
                    <p className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/[0.07] p-3 text-[13px] text-amber-100">
                      SysEx can change settings on the keyboard. Only send messages you know, ideally from Korg&apos;s MIDI documentation for your model.
                    </p>
                    <textarea
                      value={rawHex}
                      onChange={(e) => setRawHex(e.target.value)}
                      rows={3}
                      spellCheck={false}
                      aria-label="SysEx bytes in hexadecimal"
                      className="aw-mono mt-3 w-full rounded-xl border border-white/[0.12] bg-[#131316] p-3 text-[13px] text-white outline-none focus:border-[#FF5CA1]/60"
                    />
                    <button type="button" onClick={sendRaw} disabled={!sysexOk} className={`${BTN} mt-3`}>Send SysEx</button>
                  </details>
                </Card>
              </>
            )}
          </div>

          <details className="mt-6 rounded-2xl border border-white/[0.08] bg-[#18181C] p-5 text-sm text-[#A1A1AA]">
            <summary className={`cursor-pointer rounded font-medium text-[#D4D4D9] hover:text-white ${FOCUS}`}>The keyboard doesn&apos;t show up</summary>
            <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed">
              <li>Use the USB Device port (type B) on the keyboard, not the USB Host port where you plug a memory stick.</li>
              <li>Use a data cable, not a charge-only one, and try another USB port of the computer.</li>
              <li>Close other programs that may hold the keyboard (DAWs, other MIDI tools), then reload this page.</li>
              <li>If the computer doesn&apos;t see the keyboard at all, install the KORG USB-MIDI driver.</li>
              <li>If you blocked MIDI access before, allow it again from the lock icon in the address bar.</li>
            </ul>
          </details>
        </div>

        {toast && (
          <div role="status" className="fixed bottom-24 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-[#111] px-4 py-2.5 text-[13px] font-medium text-white shadow-lg md:bottom-8">
            {toast}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}