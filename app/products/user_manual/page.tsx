"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bricolage_Grotesque, Pixelify_Sans } from "next/font/google";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { supabase } from "@/lib/supabase";

const sans = Bricolage_Grotesque({ subsets: ["latin"] });
const pixel = Pixelify_Sans({ subsets: ["latin"] });

type Param = { name: string; sub?: boolean; what: string; unit: string; v?: string; eeprom?: string; note?: string };
type Page = { title: string; items: Param[] };

// Everything below is taken from firmware V 5.3.13 (variable names, EEPROM addresses, ranges).
const PAGES: Page[] = [
  { title: "Bass & Bellows", items: [
    { name: "BASS_EN", what: "Turns the left-hand (bass) section on or off. The main screen shows BASS EN when on and SOLO when off.", unit: "EN / DIS", v: "LH_EN", eeprom: "0x160" },
    { name: "Bell_low_pull", what: "Dead zone of the bellows sensor on the pull side. Expression (CC 11) starts only after the sensor moves this far from its centre.", unit: "0 – 64", v: "lower_bellows_pull", eeprom: "0x130" },
    { name: "Bell_GAIN", what: "Multiplier applied to the treble expression coming from the bellows.", unit: "1 – 4", v: "bellows_gain", eeprom: "0x140" },
    { name: "Bell_low_push", what: "Dead zone of the bellows sensor on the push side.", unit: "0 – 64", v: "lower_bellows_push", eeprom: "0x120" } ] },
  { title: "Channels & programs", items: [
    { name: "TREB_CH", what: "MIDI channel for the right-hand keys, and for the treble volume and expression.", unit: "channel 1–16", v: "R_key_ch", eeprom: "0x150" },
    { name: "BASS_CH", what: "MIDI channel for the first 12 left-hand keys (and their volume and expression).", unit: "channel 1–16", v: "L_key_ch", eeprom: "0x151" },
    { name: "TREB_PG", what: "MIDI channel on which Program Changes for the treble registers are sent.", unit: "channel 1–16", v: "R_PG_ch", eeprom: "0x152" },
    { name: "BASS_PG", what: "MIDI channel for Program Changes in the left-hand bank (L).", unit: "channel 1–16", v: "L_PG_ch", eeprom: "0x153" } ] },
  { title: "Velocity & keys", items: [
    { name: "Vel_treb", what: "Velocity (note strength) for the right-hand keys.", unit: "0–127", v: "Velocity_treble", eeprom: "0x170" },
    { name: "Vel_bass", what: "Velocity (note strength) for the left-hand keys.", unit: "0–127", v: "Velocity_bass", eeprom: "0x171" },
    { name: "Config_key", sub: true, what: "Opens the treble key-assignment screen (CONFIG KEY screen). Turn the encoder to 5 or higher to enter.", unit: "submenu" },
    { name: "bass_key", what: "Opens the bass key-assignment screen (BASS KEY, 24 keys). Turn the encoder to 5 or higher to enter.", unit: "submenu" } ] },
  { title: "Registers & chords", items: [
    { name: "REG_ASSG_C", what: "Gives each of the 15 registers a number, shown as S: on the main screen. Select a register, turn the encoder to the number, then press TR to save; “saved” appears.", unit: "register 1–15 → 0–16", v: "shift_register1 … 15", eeprom: "0x000 – 0x00E" },
    { name: "PG_REG", what: "How registers are chosen. EN: with the register switches (15 combinations). DIS: with the encoder.", unit: "EN / DIS", v: "REG_EN", eeprom: "0x161" },
    { name: "offest_LH_BL", what: "Offset added to the bellows expression: left-hand channels get +offset, the treble channel gets offset − 20 (before gain).", unit: "0 – 127", v: "off_LH", eeprom: "0x172" },
    { name: "ACHORD_CH", what: "MIDI channel for the last 12 left-hand keys (chords) and their volume and expression.", unit: "channel 1–16", v: "L_key_ch2", eeprom: "0x154" } ] },
];
const TOTAL = 16;
const pad = (s: string) => s.padEnd(15, " ");

const CSS = `
@keyframes sheen{from{background-position:100% 0}to{background-position:0 0}}
@keyframes line{0%{opacity:0;transform:translateX(-10px);filter:blur(3px)}60%{opacity:1}100%{opacity:1;transform:none;filter:none}}
@keyframes glow{50%{box-shadow:inset 0 0 26px rgba(120,190,255,.2),0 0 28px rgba(120,190,255,.25)}}
@keyframes pop{from{opacity:.4;transform:translateY(6px)}}
@keyframes drift{from{background-position:0% 0%,100% 0%,100% 100%,0% 100%,50% 50%}to{background-position:100% 100%,0% 100%,0% 0%,100% 0%,50% 50%}}
.bgfx{background:radial-gradient(ellipse 45% 40% at 20% 15%,rgba(200,50,59,.55),transparent 70%),radial-gradient(ellipse 45% 45% at 80% 20%,rgba(40,120,190,.45),transparent 70%),radial-gradient(ellipse 50% 45% at 75% 85%,rgba(232,194,106,.28),transparent 70%),radial-gradient(ellipse 45% 45% at 15% 85%,rgba(110,60,190,.4),transparent 70%),linear-gradient(160deg,#171a21,#0b0d12);background-size:200% 200%,200% 200%,200% 200%,200% 200%,100% 100%;animation:drift 22s ease-in-out infinite alternate}
.sheen{background:linear-gradient(100deg,#f4f0e8 20%,#f1d58a 40%,#ff8087 55%,#f4f0e8 75%);background-size:250% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:sheen 7s ease-in-out infinite alternate}
.glow{animation:glow 3s ease-in-out infinite}
.orow{animation:line .4s both}.orow:nth-child(2){animation-delay:.07s}.orow:nth-child(3){animation-delay:.14s}.orow:nth-child(4){animation-delay:.21s}
.pop{animation:pop .35s both}
.knob{background:conic-gradient(#2a2e36,#3f4651,#2a2e36,#3f4651,#2a2e36);transition:transform .5s cubic-bezier(.3,1.6,.5,1)}
html{scroll-behavior:smooth}
@media(prefers-reduced-motion:reduce){.sheen,.glow,.orow,.pop,.bgfx{animation:none}.knob{transition:none}html{scroll-behavior:auto}}
`;

const panel = "rounded-2xl border border-white/10 bg-[#12141a]/90 backdrop-blur-md";
const btn = "min-h-11 cursor-pointer rounded-lg border border-[#3a404a] bg-[#262a31] px-4 py-2 text-[#f4f0e8] transition hover:border-[#c9cdd5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bfe6ff]";
const btnRed = "min-h-11 cursor-pointer rounded-lg border border-[#c8323b] bg-[#c8323b] px-4 py-2 text-white transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bfe6ff]";
function BootDemo({ px }: { px: string }) {
  const [run, setRun] = useState(0);
  const [stage, setStage] = useState(0);
  const [bar, setBar] = useState(0);
  useEffect(() => {
    setStage(0); setBar(0);
    const ids: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i <= 10; i++) ids.push(setTimeout(() => setBar(i * 10), i * 130));
    ids.push(setTimeout(() => setStage(1), 1900));
    ids.push(setTimeout(() => setStage(2), 3000));
    return () => ids.forEach(clearTimeout);
  }, [run]);
  return (
    <div>
      <div className={`${px} relative aspect-[2/1] w-full max-w-md overflow-hidden rounded-md border-[3px] border-[#0b0f14] bg-[#04080c] text-[#cfeaff] shadow-[inset_0_0_22px_rgba(120,190,255,.12)]`} role="img" aria-label="Boot sequence on the OLED screen">
        {stage === 0 && (<>
          <div className="absolute left-[3%] top-[5%] text-[clamp(1.3rem,6.5vw,2.1rem)] leading-none">i-VOLUTION</div>
          <div className="absolute left-[3%] top-[30%] text-[clamp(1.3rem,6.5vw,2.1rem)] leading-none">TS4x synth</div>
          <div className="absolute left-[8%] top-[70%] h-[12%] w-[78%] border border-[#cfeaff]/70"><div className="h-full bg-[#cfeaff] transition-[width] duration-100" style={{ width: `${bar}%` }} /></div>
          <div className="absolute bottom-[4%] left-[4%] text-[clamp(.6rem,2.6vw,.85rem)]">www.imidi.co.uk</div>
        </>)}
        {stage === 1 && (<>
          <div className="absolute left-[16%] top-[8%] text-[clamp(1.5rem,7vw,2.4rem)] leading-none">HI!</div>
          <div className="absolute inset-x-0 bottom-0 flex h-[31%]">
            {Array.from({ length: 8 }, (_, i) => <div key={i} className="flex-1 border border-[#cfeaff]/80" />)}
          </div>
          {[0, 1, 3, 4, 5].map((i) => <div key={i} className="absolute bottom-[12%] h-[19%] w-[6%] -translate-x-1/2 bg-[#cfeaff]" style={{ left: `${((i + 1) / 8) * 100}%` }} />)}
        </>)}
        {stage === 2 && (
          <div className="absolute left-[3%] top-[5%] space-y-[3%] text-[clamp(.8rem,3.4vw,1.1rem)]">
            <div>INFO</div><div className="pt-[6%]">REV 4.0</div><div>V 5.3.13</div>
          </div>
        )}
      </div>
      <button className={`${btn} mt-3`} onClick={() => setRun((r) => r + 1)}>↻ Replay boot sequence</button>
    </div>
  );
}

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const COUNT = { treble: 45, bass: 24 } as const; // maximum number of keys per hand
const DEFAULT_TREBLE = 41; // keys on the standard treble keyboard
const START = { treble: 49, bass: 28 } as const; // first note shown by the on-device key screens
type Hand = keyof typeof COUNT;
type KeyMap = Record<Hand, number[]>;
const fillNotes = (h: Hand, from: number) => Array.from({ length: COUNT[h] }, (_, i) => Math.min(127, from + i));
const initialMap = (): KeyMap => ({ treble: fillNotes("treble", START.treble), bass: fillNotes("bass", START.bass) });
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, Math.round(v) || a));
const noteName = (n: number) => NOTES[n % 12] + (Math.floor(n / 12) - 1);
const hex = (n: number) => n.toString(16).toUpperCase().padStart(2, "0");
const inputCls = "h-11 w-full rounded-lg border border-[#3a404a] bg-[#0f1116] px-3 text-[#f4f0e8] outline-none focus:border-[#bfe6ff]";

// ---- USB-serial link (Web Serial, 31250 baud = MIDI speed) ----
type SerialPortLike = { open(o: { baudRate: number }): Promise<void>; close(): Promise<void>; readable: ReadableStream<Uint8Array> | null; writable: WritableStream<Uint8Array> | null };
type SerialLike = { requestPort(): Promise<SerialPortLike>; addEventListener(t: "disconnect", f: () => void): void; removeEventListener(t: "disconnect", f: () => void): void };
const BAUD = 31250;
const HANDSHAKE = [0xf0, 0x7d, 0x01, 0x02, 0x01, 0x02, 0xf7]; // same bytes the firmware answers to (SysEx_Config)
const LIVE_MS = 6000; // no bytes for this long = controller considered silent
type Parser = { st: number; d: number[]; sys: number[] | null };
const describeMsg = (st: number, d: number[]) => {
  const k = st >> 4, ch = (st & 15) + 1;
  if (k === 9) return d[1] === 0 ? `Note Off ${noteName(d[0])} ch ${ch}` : `Note On ${noteName(d[0])} vel ${d[1]} ch ${ch}`;
  if (k === 8) return `Note Off ${noteName(d[0])} ch ${ch}`;
  if (k === 11) return `CC ${d[0]} = ${d[1]} ch ${ch}${d[0] === 11 ? " (expression)" : d[0] === 7 ? " (volume)" : ""}`;
  if (k === 12) return `Program ${d[0]} ch ${ch}`;
  return [st, ...d].map(hex).join(" ");
};
const feedByte = (p: Parser, b: number, out: string[]) => {
  if (b === 0xf0) { p.sys = [b]; return; }
  if (p.sys) {
    p.sys.push(b);
    if (b === 0xf7) {
      const m = p.sys; p.sys = null;
      out.push(m.length === HANDSHAKE.length && m.every((x, i) => x === HANDSHAKE[i]) ? "Handshake reply from controller" : `SysEx ${m.map(hex).join(" ")}`);
    } else if (p.sys.length > 32) p.sys = null;
    return;
  }
  if (b >= 0xf8) return; // MIDI real-time bytes (clock etc.)
  if (b & 0x80) { p.st = b; p.d = []; return; }
  if (!p.st) return;
  p.d.push(b);
  const need = (p.st >> 4) === 0xc || (p.st >> 4) === 0xd ? 1 : 2;
  if (p.d.length === need) { out.push(describeMsg(p.st, p.d)); p.d = []; }
};

// PC utility: edits the key map in the browser, exports/imports JSON, and watches the controller over USB-serial.
// Sending the map is disabled until the firmware handles the key-config SysEx commands.
function KeyConfigurator({ px }: { px: string }) {
  const [map, setMap] = useState<KeyMap>(initialMap);
  const [hand, setHand] = useState<Hand>("treble");
  const [idx, setIdx] = useState(0);
  const [trebleKeys, setTrebleKeys] = useState(DEFAULT_TREBLE);
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState(false);
  const [live, setLive] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [err, setErr] = useState("");
  const portRef = useRef<SerialPortLike | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const writerRef = useRef<WritableStreamDefaultWriter<Uint8Array> | null>(null);
  const lastRx = useRef(0);
  const serial = () => (navigator as unknown as { serial?: SerialLike }).serial;

  const closePort = useCallback(async () => {
    const port = portRef.current;
    if (!port) return;
    portRef.current = null;
    try { await readerRef.current?.cancel(); } catch {}
    try { readerRef.current?.releaseLock(); } catch {}
    try { writerRef.current?.releaseLock(); } catch {}
    try { await port.close(); } catch {}
    readerRef.current = null; writerRef.current = null;
    setOpen(false); setLive(false);
  }, []);

  const ping = () => { writerRef.current?.write(new Uint8Array(HANDSHAKE)).catch(() => {}); };

  const connect = async () => {
    setErr("");
    const sp = serial();
    if (!sp) { setErr("This browser has no Web Serial. Use Chrome or Edge on a PC."); return; }
    try {
      const port = await sp.requestPort();
      await port.open({ baudRate: BAUD });
      if (!port.readable || !port.writable) throw new Error("The port has no data streams.");
      portRef.current = port; lastRx.current = 0; setLog([]); setOpen(true);
      writerRef.current = port.writable.getWriter();
      const reader = port.readable.getReader();
      readerRef.current = reader;
      ping();
      const parser: Parser = { st: 0, d: [], sys: null };
      (async () => {
        try {
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            if (!value?.length) continue;
            lastRx.current = Date.now();
            const lines: string[] = [];
            value.forEach((b) => feedByte(parser, b, lines));
            if (lines.length) setLog((l) => [...lines.reverse(), ...l].slice(0, 8));
          }
        } catch {} finally { closePort(); }
      })();
    } catch (e) {
      if (e instanceof Error && e.name !== "NotFoundError") setErr(e.message);
    }
  };

  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => {
      const isLive = Date.now() - lastRx.current < LIVE_MS;
      setLive(isLive);
      if (!isLive) ping();
    }, 1000);
    return () => clearInterval(id);
  }, [open]);

  useEffect(() => {
    const sp = serial();
    const onGone = () => { closePort(); };
    sp?.addEventListener("disconnect", onGone);
    return () => { sp?.removeEventListener("disconnect", onGone); closePort(); };
  }, [closePort]);

  const status = !open
    ? { c: "#e0434c", t: "Not connected", d: "No adapter selected." }
    : live
      ? { c: "#3ecf6e", t: "Controller connected", d: "Live MIDI is coming in from the controller." }
      : { c: "#e8b73a", t: "Adapter connected, no controller detected", d: "The port is open but nothing is answering. Check power and cables, then play a key." };

  const shown = hand === "treble" ? trebleKeys : COUNT.bass;
  const notes = map[hand].slice(0, shown);
  const note = notes[idx];
  const setNote = (v: number) => setMap((m) => ({ ...m, [hand]: m[hand].map((x, j) => (j === idx ? clamp(v, 0, 127) : x)) }));
  const fill = () => setMap((m) => ({ ...m, [hand]: fillNotes(hand, Math.max(0, note - idx)) }));
  const channelFor = (h: Hand, i: number) => (h === "treble" ? "TREB_CH" : i < 12 ? "BASS_CH" : "ACHORD_CH");

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ device: "i-VOLUTION TS4x", firmware: "5.3.13", treble: map.treble.slice(0, trebleKeys), bass: map.bass }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "ivolution-keys.json"; a.click();
    URL.revokeObjectURL(a.href); setMsg("Exported ivolution-keys.json");
  };
  const importJson = async (f?: File) => {
    if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      const ok = (a: unknown, min: number, max: number) => Array.isArray(a) && a.length >= min && a.length <= max && a.every((x) => Number.isInteger(x) && x >= 0 && x <= 127);
      if (ok(d.treble, 1, COUNT.treble) && ok(d.bass, COUNT.bass, COUNT.bass)) {
        const t: number[] = d.treble;
        setMap({ treble: [...t, ...fillNotes("treble", Math.min(127, t[t.length - 1] + 1)).slice(0, COUNT.treble - t.length)], bass: d.bass });
        setTrebleKeys(t.length); setIdx(0); setMsg("Imported.");
      } else setMsg("Not a valid key map: it needs 1–45 treble notes and 24 bass notes (0–127).");
    } catch { setMsg("That file is not valid JSON."); }
  };

  return (
    <div className="space-y-5">
      <div className="space-y-3 rounded-xl border border-white/10 bg-black/25 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span role="status" className="inline-flex items-center gap-3 text-base font-semibold">
            <span className="h-4 w-4 shrink-0 rounded-full" style={{ background: status.c, boxShadow: `0 0 12px ${status.c}` }} />
            {status.t}
          </span>
          {open
            ? <button className={`${btn} ml-auto`} onClick={closePort}>Disconnect</button>
            : <button className={`${btnRed} ml-auto`} onClick={connect}>Connect USB adapter</button>}
        </div>
        <p className="text-sm text-[#d5d9e0]">{status.d} Port settings: {BAUD} baud, 8 data bits, no parity.</p>
        {err && <p className="text-sm text-[#ff9aa0]">{err}</p>}
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-[#c9cdd5]">
          <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-[#3ecf6e]" />green: controller answers or sends MIDI</span>
          <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-[#e8b73a]" />yellow: adapter open, controller silent</span>
          <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-[#e0434c]" />red: not connected</span>
        </div>
        {open && (
          <div className="rounded-lg bg-[#0f1116] p-3">
            <div className="mb-1 text-sm text-[#c9cdd5]">Live monitor (last 8 messages)</div>
            <ul className={`${px} min-h-[5.5rem] space-y-0.5 text-sm text-[#cfeaff]`}>
              {log.length ? log.map((l, i) => <li key={i} className="break-all">{l}</li>) : <li className="text-[#c9cdd5]">Waiting for data…</li>}
            </ul>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {(["treble", "bass"] as const).map((h) => (
          <button key={h} aria-pressed={hand === h} onClick={() => { setHand(h); setIdx(0); }}
            className={`${btn} ${hand === h ? "!border-[#f4f0e8] !bg-[#f4f0e8] !text-[#14161a]" : ""}`}>
            {h === "treble" ? `Treble · ${trebleKeys} keys` : "Bass · 24 keys"}
          </button>
        ))}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8" role="group" aria-label="Keys">
          {notes.map((n, j) => (
            <button key={j} onClick={() => setIdx(j)} aria-pressed={j === idx} aria-label={`Key ${j + 1}, note ${noteName(n)}`}
              className={`min-h-14 cursor-pointer rounded-lg border px-1 py-1.5 text-center transition-colors ${j === idx ? "border-[#e0434c] bg-[#c8323b]/30" : "border-[#3a404a] bg-[#1b1e25] hover:border-[#c9cdd5]"}`}>
              <span className="block text-xs text-[#c9cdd5]">{j + 1}</span>
              <span className={`${px} block text-base`}>{noteName(n)}</span>
            </button>
          ))}
        </div>

        <div className="space-y-3 rounded-xl border border-white/10 bg-black/25 p-4">
          <h3 className={`${px} text-xl text-[#cfeaff]`}>Key {idx + 1} · {noteName(note)}</h3>
          <label className="block text-sm">MIDI note (0–127)
            <input type="number" min={0} max={127} value={note} onChange={(e) => setNote(+e.target.value)} className={`${inputCls} mt-1`} /></label>
          <p className="text-sm text-[#d5d9e0]">Sent on the <b>{channelFor(hand, idx)}</b> channel.</p>
          {hand === "treble" && (
            <label className="block text-sm">Number of treble keys (1–45)
              <input type="number" min={1} max={COUNT.treble} value={trebleKeys}
                onChange={(e) => { const n = clamp(+e.target.value, 1, COUNT.treble); setTrebleKeys(n); setIdx((i) => Math.min(i, n - 1)); }} className={`${inputCls} mt-1`} /></label>
          )}
          <button className={`${btn} w-full`} onClick={fill}>Fill from key 1 = {noteName(Math.max(0, note - idx))}</button>
          <button className={`${btn} w-full`} onClick={() => { setMap(initialMap()); setTrebleKeys(DEFAULT_TREBLE); setIdx(0); setMsg("Reset to the on-device starting notes."); }}>Reset both hands</button>
          <div className="rounded-lg bg-[#0f1116] p-3 text-sm">
            <div className="text-[#c9cdd5]">Proposed message for this key (not yet in the firmware):</div>
            <code className={`${px} mt-1 block break-all text-[#cfeaff]`}>F0 7D 01 {hand === "treble" ? "03" : "04"} {hex(idx)} {hex(note)} F7</code>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button className={btnRed} onClick={exportJson}>Export JSON</button>
        <label className={`${btn} inline-flex cursor-pointer items-center`}>Import JSON
          <input type="file" accept="application/json" className="sr-only" onChange={(e) => { importJson(e.target.files?.[0]); e.target.value = ""; }} /></label>
        <button disabled className={`${btn} cursor-not-allowed opacity-50`}>Send to controller · coming soon</button>
        <span aria-live="polite" className="text-sm text-[#c9cdd5]">{msg}</span>
      </div>
    </div>
  );
}

const h2 = "mb-2 text-2xl font-semibold sm:text-3xl";
const lead = "mb-6 max-w-[62ch] text-lg text-[#d5d9e0]";

export default function ManualPage() {
  const [auth, setAuth] = useState<"loading" | "in" | "out">("loading");
  const [sel, setSel] = useState(1);
  const [tab, setTab] = useState(0);
  const move = useCallback((d: number) => setSel((s) => ((s - 1 + d + TOTAL) % TOTAL) + 1), []);

  // Show the manual only to signed-in users.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuth(data.session ? "in" : "out"));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setAuth(session ? "in" : "out"));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (auth !== "in") return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); move(1); }
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); move(-1); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [move, auth]);

  const pageIdx = Math.floor((sel - 1) / 4);
  const line = (sel - 1) % 4;
  const cur = PAGES[pageIdx].items[line];
  const px = pixel.className;
  const chip = "rounded-full border border-[#3a404a] px-3 py-0.5 text-sm text-[#d5d9e0]";

  return (
    <div className={`${sans.className} relative flex min-h-screen flex-col overflow-x-hidden bg-[#14161a] text-[17px] leading-relaxed text-[#f4f0e8]`}>
      <style>{CSS}</style>
      <div aria-hidden className="bgfx pointer-events-none fixed inset-0 z-0" />

      <Navbar />

      <main className="relative z-[1] mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 pb-12 pt-28 sm:px-5 sm:pt-32">
        <header className={`${panel} p-6 sm:p-10`}>
          <h1 className="sheen text-[clamp(2.2rem,8vw,4.2rem)] font-bold leading-[1.05]">i-VOLUTION user manual</h1>
          <p className="mt-3 max-w-[60ch] text-lg text-[#d5d9e0]">
            TS4x synth · configurable MIDI controller for accordion · www.imidi.co.uk. Turn the encoder in the simulator to see how the menu looks on the OLED screen and what each setting does.
          </p>
        </header>

        {auth === "loading" && <p className="text-[#c9cdd5]">Checking your session...</p>}

        {auth === "out" && (
          <div className={`${panel} mx-auto max-w-xl space-y-4 p-8 text-center`}>
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#c8323b]/20 text-lg">🔒</div>
            <h2 className="text-2xl font-semibold">Sign in to read the manual</h2>
            <p className="text-[#d5d9e0]">The i-olution manual is available to registered users.</p>
            <div className="flex flex-wrap justify-center gap-3 pt-1">
              <Link href="/login" className={`${btnRed} inline-flex items-center`}>Sign in</Link>
              <Link href="/register" className={`${btn} inline-flex items-center`}>Create an account</Link>
            </div>
          </div>
        )}

        {auth === "in" && (
          <>
            <section id="simulator" className="scroll-mt-28">
              <div className="grid items-start gap-6 lg:grid-cols-[1.15fr_1fr]">
                <div className={`${panel} p-4 sm:p-6`}>
                  <div key={pageIdx} role="img" aria-label={`OLED screen, page ${pageIdx + 1}, ${cur.name} selected`}
                    className={`glow min-h-[150px] overflow-hidden rounded-md border-[3px] border-[#0b0f14] bg-[#04080c] px-3 py-3 sm:px-4 ${px} text-[clamp(.95rem,4vw,1.35rem)] leading-normal text-[#cfeaff] shadow-[inset_0_0_22px_rgba(120,190,255,.12),0_0_0_1px_#2f343d]`}>
                    {PAGES[pageIdx].items.map((p, i) => (
                      <div key={p.name} className={`orow whitespace-pre px-1 ${i === line ? "bg-[#cfeaff] text-[#04080c]" : "[text-shadow:0_0_6px_rgba(150,210,255,.55)]"}`}>
                        {pad(`${i === line ? "> " : "  "}${p.name}${p.sub ? ": >>" : ":"}`)}
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex gap-2" role="group" aria-label="Jump to menu page">
                    {PAGES.map((p, i) => (
                      <button key={p.title} onClick={() => setSel(i * 4 + 1)} aria-label={`Page ${i + 1}: ${p.title}`} aria-pressed={pageIdx === i}
                        className={`h-2.5 flex-1 cursor-pointer rounded-full transition-colors ${pageIdx === i ? "bg-[#c8323b]" : "bg-[#3a404a] hover:bg-[#5a616c]"}`} />
                    ))}
                  </div>
                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <div aria-hidden className="knob relative h-16 w-16 shrink-0 rounded-full border-2 border-[#3a404a] sm:h-[76px] sm:w-[76px]" style={{ transform: `rotate(${sel * 22.5}deg)` }}>
                      <span className="absolute left-1/2 top-[7px] -ml-0.5 h-4 w-1 rounded-sm bg-[#e0434c]" />
                    </div>
                    <button className={btn} onClick={() => move(-1)} aria-label="Turn the encoder back">◀ Back</button>
                    <button className={btnRed} onClick={() => move(1)} aria-label="Turn the encoder forward">Forward ▶</button>
                  </div>
                  <p className="mt-3 text-sm text-[#c9cdd5]">Position {sel} of {TOTAL} · page {pageIdx + 1} of 4 · arrow keys work too.</p>
                </div>

                <div key={sel} aria-live="polite" className={`${panel} pop border-l-4 !border-l-[#e0434c] p-5 sm:p-6`}>
                  <h3 className={`${px} text-2xl text-[#cfeaff]`}>{cur.name}</h3>
                  <span className="text-[#c9cdd5]">{PAGES[pageIdx].title}</span>
                  <p className="mt-3 text-lg">{cur.what}</p>
                  {cur.note && <p className="mt-2 text-[#d5d9e0]">{cur.note}</p>}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className={chip}>{cur.unit}</span>
                    {cur.v && <span className={`${chip} ${px}`}>{cur.v}</span>}
                    {cur.eeprom && <span className={`${chip} ${px}`}>EEPROM {cur.eeprom}</span>}
                  </div>
                </div>
              </div>
            </section>

            <section id="menu" className={`${panel} p-5 sm:p-8`}>
              <h2 className={h2}>Menu map</h2>
              <p className={lead}>The menu has 16 positions, grouped into 4 pages of 4 lines. Pick a page:</p>
              <div className="mb-5 flex flex-wrap gap-2">
                {PAGES.map((p, i) => (
                  <button key={p.title} aria-pressed={tab === i} onClick={() => setTab(i)}
                    className={`${btn} ${tab === i ? "!border-[#f4f0e8] !bg-[#f4f0e8] !text-[#14161a]" : ""}`}>{p.title}</button>
                ))}
              </div>
              <div className="hidden grid-cols-[11rem_5rem_1fr_11rem] gap-x-4 border-b border-white/15 pb-2 text-[#c9cdd5] md:grid">
                <span>Parameter</span><span>Position</span><span>What it does</span><span>Values</span>
              </div>
              <ul className="divide-y divide-white/10">
                {PAGES[tab].items.map((p, i) => (
                  <li key={p.name} className="grid gap-x-4 gap-y-1 py-4 md:grid-cols-[11rem_5rem_1fr_11rem]">
                    <span className={`${px} break-all text-lg text-[#cfeaff]`}>{p.name}</span>
                    <span className="text-[#c9cdd5]"><span className="md:hidden">Position </span>{tab * 4 + i + 1}</span>
                    <span>{p.what}{p.v && <span className={`${px} mt-1 block text-sm text-[#c9cdd5]`}>{p.v}{p.eeprom ? ` · EEPROM ${p.eeprom}` : ""}</span>}</span>
                    <span className="text-[#d5d9e0]">{p.unit}</span>
                  </li>
                ))}
              </ul>
              <button className={`${btn} mt-3`} onClick={() => { setSel(tab * 4 + 1); document.getElementById("simulator")?.scrollIntoView(); }}>
                Show this page in the simulator
              </button>
            </section>

            <section id="controls" className={`${panel} p-5 sm:p-8`}>
              <h2 className={h2}>Playing controls</h2>
              <p className={lead}>The main screen shows the register number (S:), the bank (BNK:), the transpose (T) and the volume (V:). The <b>TR</b> button chooses what the encoder controls; the marker “&gt;” shows the active one.</p>
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[10rem_1fr]">
                {[
                  ["1 · Volume", "±7 per click, 0–127. Sent as CC 7 to the treble channel, and to both bass channels when BASS_EN is on. Remembered after power-off."],
                  ["2 · Transpose", "−8 to +8 semitones, shown as >+03, >-05 and so on. Sent as a Master Coarse Tuning SysEx message. Not remembered."],
                  ["3 · Bank", "Selects bank A, B, C or D, and L for the left hand (only when BASS_EN is on)."],
                  ["4 · Register", "Only when PG_REG is DIS: pick the register with the encoder instead of the register switches."],
                ].map(([k, v]) => (<div key={k} className="contents"><dt className="font-semibold text-[#cfeaff]">{k}</dt><dd className="mb-2 sm:mb-0">{v}</dd></div>))}
              </dl>
              <p className="mt-3 text-[#d5d9e0]">TR steps through 1–3, or 1–4 when PG_REG is DIS.</p>
              <h3 className="mb-2 mt-6 text-lg font-semibold">Banks and program numbers</h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {[["A", "1 – 15"], ["B", "16 – 30"], ["C", "33 – 47"], ["D", "48 – 62"], ["L", "80 – 94"]].map(([b, r]) => (
                  <div key={b} className="rounded-lg border border-white/10 bg-black/25 p-3 text-center">
                    <div className={`${px} text-2xl text-[#cfeaff]`}>{b}</div><div className="text-sm text-[#d5d9e0]">programs {r}</div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[#d5d9e0]">Each register (1–15) sends a Program Change equal to the bank offset plus the register number, on the TREB_PG channel. Bank L sends on BASS_PG and ACHORD_CH.</p>
            </section>

            <section id="service" className={`${panel} p-5 sm:p-8`}>
              <h2 className={h2}>Service mode</h2>
              <ol className="max-w-[65ch] list-decimal space-y-3 pl-6 text-lg">
                <li>Hold <b>TR</b> while powering on. After the splash screen the controller waits 2 seconds and shows <code className={px}>SERVICE</code>.</li>
                <li>Press <b>TR</b> to go to the next position. The position (for example 5/16) shows at the top right.</li>
                <li>Turn the encoder to change the value. It is saved at once, except <code className={px}>REG_ASSG_C</code>, where you press TR to save.</li>
                <li>To assign key notes, go to <code className={px}>Config_key</code> or <code className={px}>bass_key</code> and turn the encoder to 5 or higher (see Key assignment).</li>
                <li>There is no exit button. Power-cycle the controller to go back to playing.</li>
              </ol>
            </section>

            <section id="keys" className={`${panel} p-5 sm:p-8`}>
              <h2 className={h2}>Key assignment <span className="ml-2 align-middle rounded-full border border-[#c9a24a] px-3 py-0.5 text-sm font-normal text-[#f0dcb4]">PC utility · preview</span></h2>
              <p className={lead}>On the controller, the CONFIG KEY screen (treble, up to 45 keys) and the BASS KEY screen (bass, 24 keys) work the same way: press TR to move to the next key, turn the encoder to set its note (0–127). Each change is saved immediately. The utility below prepares the same map on your PC. It can already connect to the controller through a USB-serial adapter and show live MIDI; sending the map needs a firmware update first.</p>
              <KeyConfigurator px={px} />
            </section>

            <section id="boot" className={`${panel} p-5 sm:p-8`}>
              <h2 className={h2}>Boot sequence</h2>
              <p className={lead}>On power-up the display runs three short screens. Replay them here:</p>
              <div className="grid items-start gap-6 md:grid-cols-[minmax(0,28rem)_1fr]">
                <BootDemo px={px} />
                <ol className="list-decimal space-y-3 pl-6 text-lg">
                  <li><b>Splash</b> — “i-VOLUTION / TS4x synth”, the web address and a loading bar.</li>
                  <li><b>Hello</b> — a short piano animation with “HI!”.</li>
                  <li><b>Info</b> — hardware REV 4.0 and firmware V 5.3.13.</li>
                </ol>
              </div>
              <p className="mt-4 text-[#d5d9e0]">Holding TR during power-up enters Service mode after the splash screen.</p>
            </section>

            <section id="midi" className={`${panel} p-5 sm:p-8`}>
              <h2 className={h2}>MIDI messages</h2>
              <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-[14rem_1fr]">
                {[
                  ["Note On / Note Off", "0x9n and 0x8n. Treble keys use TREB_CH; the first 12 bass keys use BASS_CH, the last 12 use ACHORD_CH."],
                  ["Control Change 11", "Expression from the bellows, using the dead zones, gain and offset set in Service mode."],
                  ["Control Change 7", "Volume from the encoder."],
                  ["Program Change", "0xCn: bank offset + register number, on TREB_PG (bank L: BASS_PG and ACHORD_CH)."],
                  ["Transpose", "F0 7F 7F 04 04 00 xx F7, where xx runs from 0x38 (−8) to 0x48 (+8) and 0x40 means no transpose."],
                  ["Bank + program (Korg PA)", "Available in the firmware but not used by the main screen: CC 0, CC 32, then Program Change. A preset 0–16383 splits into bank MSB (preset ÷ 128) and program (preset mod 128)."],
                ].map(([k, v]) => (<div key={k} className="contents"><dt className="font-semibold text-[#cfeaff]">{k}</dt><dd className="mb-2 sm:mb-0">{v}</dd></div>))}
              </dl>
              <p className="mt-4 text-[#c9cdd5]">n is the MIDI channel (0–15 in the message, shown as 1–16 on screen).</p>
            </section>

            <section id="notes" className="rounded-2xl border border-[#6b5230] bg-[#2a2119]/95 p-5 text-[#f0dcb4] sm:p-8">
              <h2 className={h2}>Notes</h2>
              <div className="max-w-[65ch] space-y-3 text-lg">
                <p>This manual describes firmware V 5.3.13 (04-09-2025) on hardware REV 4.0. At start-up the controller loads every setting from its internal EEPROM.</p>
                <p>The code names the display option <code className={px}>OLED_127x32</code>, but the driver is set up for an  128×64 screen.</p>
                <p>Not covered yet: where the key notes are stored and their default values (they are handled in <code className={px}>config.h</code>), the stored setting <code className={px}>trans_type</code> (EEPROM 0x121), and PC configuration over SysEx. The firmware has a disabled <code className={px}>SysEx_Config</code> block: a handshake (F0 7D 01 02 01 02 F7, answered with the same bytes and "PC&gt;" on screen) and command codes 03 and 04 for treble and bass keys, which are not handled yet.</p>
                <p>MIDI for Accordions · www.imidi.ro · www.imidi.co.uk. Firmware © Balcangiu Marius Valentin, all rights reserved.</p>
              </div>
            </section>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}