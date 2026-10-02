"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
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
@keyframes winin{from{opacity:0;transform:translateY(16px) scale(.96)}}
@keyframes fadein{from{opacity:0}}
.win{animation:winin .28s cubic-bezier(.2,.9,.3,1) both}
.scrim{animation:fadein .2s both}
.knob{background:conic-gradient(#2a2e36,#3f4651,#2a2e36,#3f4651,#2a2e36);transition:transform .5s cubic-bezier(.3,1.6,.5,1)}
html{scroll-behavior:smooth}
@media(prefers-reduced-motion:reduce){.sheen,.glow,.orow,.pop,.bgfx,.win,.scrim{animation:none}.knob{transition:none}html{scroll-behavior:auto}}
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

// ---- Accordion keyboards ----
const BLACK = [1, 3, 6, 8, 10];
// Physical layout of the treble keyboard: key 1 sits on F (pitch class 5), so 41 keys run F..A like a standard
// piano accordion. White/black pattern follows the key NUMBER only; the MIDI note you assign never moves a key.
const LAYOUT_PC = 5;

// Right-hand keyboard: vertical, lowest note at the bottom, like on a piano accordion.
function VerticalKeys({ notes, idx, onPick, px }: { notes: number[]; idx: number; onPick: (i: number) => void; px: string }) {
  const H = 44, BH = 28, PAD = 22;
  const box = useRef<HTMLDivElement>(null);
  let w = 0;
  const keys = notes.map((n, j) => {
    const black = BLACK.includes((LAYOUT_PC + j) % 12); // fixed physical layout, independent of the assigned MIDI note
    const bottom = black ? w * H - BH / 2 : w * H;
    if (!black) w++;
    return { n, j, black, bottom };
  });
  const total = Math.max(w, 1) * H + PAD * 2;

  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, []);
  useEffect(() => {
    const c = box.current; if (!c) return;
    const k = keys[idx]; if (!k) return;
    const top = total - PAD - k.bottom - (k.black ? BH : H);
    if (top < c.scrollTop) c.scrollTop = top - 8;
    else if (top + H > c.scrollTop + c.clientHeight) c.scrollTop = top + H - c.clientHeight + 8;
  }, [idx]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="rounded-xl border border-white/10 bg-black/25 p-3">
      <div className="mb-2 flex justify-between text-xs text-[#c9cdd5]"><span>↑ high notes</span><span>low notes ↓ (key 1 at the bottom)</span></div>
      <div ref={box} className="max-h-[620px] overflow-y-auto rounded-lg bg-[#0b0d12] shadow-[inset_0_0_18px_rgba(0,0,0,.7)]">
        <div className="relative mx-auto w-44 sm:w-56" style={{ height: total }}>
          {keys.map(({ n, j, black, bottom }) => {
            const on = j === idx;
            return (
              <button key={j} onClick={() => onPick(j)} aria-pressed={on} aria-label={`Key ${j + 1}, note ${noteName(n)}`}
                className={`absolute flex cursor-pointer items-center justify-between rounded-md px-2 transition-all duration-100 ease-out ${black ? "right-0 z-[2] w-[55%] text-[#f4f0e8]" : "left-0 z-[1] w-full text-[#14161a]"}`}
                style={{
                  bottom: bottom + PAD, height: black ? BH : H - 2,
                  background: on
                    ? (black ? "linear-gradient(90deg,#8e1f26,#c8323b)" : "linear-gradient(90deg,#f0b4b8,#e8858b)")
                    : (black ? "linear-gradient(90deg,#0c0d10,#2b2f37)" : "linear-gradient(90deg,#d9d6cd,#fbf8f0)"),
                  transform: on ? "translateX(6px) scale(.985)" : "none",
                  boxShadow: on
                    ? "inset 0 3px 8px rgba(0,0,0,.55), 0 0 18px rgba(224,67,76,.7)"
                    : (black ? "3px 3px 0 #000, 0 4px 6px rgba(0,0,0,.6)" : "4px 0 0 #9a968c, 0 2px 4px rgba(0,0,0,.4)"),
                  border: on ? "1px solid #e0434c" : "1px solid rgba(0,0,0,.35)",
                }}>
                <span className={`${px} ${black ? "text-sm" : "text-lg"} font-bold`}>{j + 1}</span>
                <span className={`${px} ${black ? "text-xs" : "text-sm"} opacity-80`}>{noteName(n)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Stradella bass: 2 columns of round buttons (12 bass + 12 chords), row 1 at the bottom.
function BassButtons({ notes, idx, onPick, px }: { notes: number[]; idx: number; onPick: (i: number) => void; px: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/25 p-4">
      <div className="mb-2 grid grid-cols-2 text-center text-xs text-[#c9cdd5]"><span>BASS_CH (1–12)</span><span>ACHORD_CH (13–24)</span></div>
      <div className="mx-auto grid max-w-xs grid-cols-2 gap-x-6 gap-y-2">
        {Array.from({ length: 12 }, (_, r) => 11 - r).flatMap((r) => [r, r + 12]).map((j) => {
          const on = j === idx;
          return (
            <button key={j} onClick={() => onPick(j)} aria-pressed={on} aria-label={`Button ${j + 1}, note ${noteName(notes[j])}`}
              className="mx-auto flex h-14 w-14 cursor-pointer flex-col items-center justify-center rounded-full transition-all duration-100"
              style={{
                background: on ? "radial-gradient(circle at 50% 60%,#c8323b,#7a1a20)" : "radial-gradient(circle at 35% 30%,#f4f0e8,#a9a59a)",
                color: on ? "#fff" : "#14161a",
                transform: on ? "translateY(4px) scale(.94)" : "none",
                boxShadow: on ? "inset 0 4px 8px rgba(0,0,0,.6), 0 0 18px rgba(224,67,76,.7)" : "0 5px 0 #6d6a62, 0 7px 8px rgba(0,0,0,.5)",
              }}>
              <span className={`${px} text-base font-bold leading-none`}>{j + 1}</span>
              <span className={`${px} text-[11px] leading-none opacity-80`}>{noteName(notes[j])}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

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

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_1fr]">
        {hand === "treble"
          ? <VerticalKeys key="t" notes={notes} idx={idx} onPick={setIdx} px={px} />
          : <BassButtons key="b" notes={notes} idx={idx} onPick={setIdx} px={px} />}

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
        <button disabled className={`${btn} cursor-not-allowed opacity-50`}>Send to controller ·...</button>
        <span aria-live="polite" className="text-sm text-[#c9cdd5]">{msg}</span>
      </div>
    </div>
  );
}

// ---- Setup: the 16 Service-mode positions, edited on the PC (not sent to the controller yet) ----
type Spec = { kind: "bool" | "num"; min: number; max: number; init: number };
const SPEC: Record<string, Spec> = {
  BASS_EN: { kind: "bool", min: 0, max: 1, init: 1 },
  Bell_low_pull: { kind: "num", min: 0, max: 64, init: 10 },
  Bell_GAIN: { kind: "num", min: 1, max: 4, init: 1 },
  Bell_low_push: { kind: "num", min: 0, max: 64, init: 10 },
  TREB_CH: { kind: "num", min: 1, max: 16, init: 1 },
  BASS_CH: { kind: "num", min: 1, max: 16, init: 2 },
  TREB_PG: { kind: "num", min: 1, max: 16, init: 1 },
  BASS_PG: { kind: "num", min: 1, max: 16, init: 2 },
  Vel_treb: { kind: "num", min: 0, max: 127, init: 100 },
  Vel_bass: { kind: "num", min: 0, max: 127, init: 100 },
  PG_REG: { kind: "bool", min: 0, max: 1, init: 1 },
  offest_LH_BL: { kind: "num", min: 0, max: 127, init: 20 },
  ACHORD_CH: { kind: "num", min: 1, max: 16, init: 3 },
};
const initVals = () => Object.fromEntries(Object.entries(SPEC).map(([k, s]) => [k, s.init])) as Record<string, number>;
const initRegs = () => Array.from({ length: 15 }, (_, i) => i + 1);

function SetupPanel({ px, goKeys }: { px: string; goKeys: () => void }) {
  const [vals, setVals] = useState<Record<string, number>>(initVals);
  const [regs, setRegs] = useState<number[]>(initRegs);
  const [msg, setMsg] = useState("");
  const set = (k: string, v: number) => setVals((o) => ({ ...o, [k]: clamp(v, SPEC[k].min, SPEC[k].max) }));

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ device: "i-VOLUTION TS4x", firmware: "5.3.13", settings: vals, registers: regs }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "ivolution-setup.json"; a.click();
    URL.revokeObjectURL(a.href); setMsg("Exported ivolution-setup.json");
  };
  const importJson = async (f?: File) => {
    if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      const nv = { ...vals };
      let ok = !!d && typeof d.settings === "object" && Array.isArray(d.registers) && d.registers.length === 15 && d.registers.every((x: unknown) => Number.isInteger(x) && (x as number) >= 0 && (x as number) <= 16);
      for (const [k, s] of Object.entries(SPEC)) {
        const v = d?.settings?.[k];
        if (!Number.isInteger(v) || v < s.min || v > s.max) ok = false; else nv[k] = v;
      }
      if (ok) { setVals(nv); setRegs(d.registers); setMsg("Imported."); } else setMsg("Not a valid setup file (a value is missing or out of range).");
    } catch { setMsg("That file is not valid JSON."); }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[#6b5230] bg-[#2a2119]/95 p-4 text-sm text-[#f0dcb4]">
        These are the same 16 positions as Service mode, in the same order. Values are edited here on your PC only: the starting values are placeholders (nothing is read from the controller) and sending needs a firmware update. Save a copy with Export.
      </div>

      {PAGES.map((pg, pi) => (
        <section key={pg.title} className="space-y-3">
          <h3 className={`${px} text-xl text-[#cfeaff]`}>Page {pi + 1} · {pg.title}</h3>
          {pg.items.map((p, i) => {
            const s = SPEC[p.name];
            const isReg = p.name === "REG_ASSG_C";
            return (
              <div key={p.name} className="grid gap-3 rounded-xl border border-white/10 bg-black/25 p-4 md:grid-cols-[1fr_17rem]">
                <div>
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <span className={`${px} text-lg text-[#cfeaff]`}>{p.name}</span>
                    <span className="text-sm text-[#c9cdd5]">position {pi * 4 + i + 1} · {p.unit}{p.eeprom ? ` · EEPROM ${p.eeprom}` : ""}</span>
                  </div>
                  <p className="mt-1 text-sm text-[#d5d9e0]">{p.what}</p>
                </div>
                <div className="self-center">
                  {s?.kind === "bool" && (
                    <div className="flex gap-2" role="group" aria-label={p.name}>
                      {([["EN", 1], ["DIS", 0]] as const).map(([l, v]) => (
                        <button key={l} aria-pressed={vals[p.name] === v} onClick={() => set(p.name, v)}
                          className={`${btn} flex-1 ${vals[p.name] === v ? "!border-[#f4f0e8] !bg-[#f4f0e8] !text-[#14161a]" : ""}`}>{l}</button>
                      ))}
                    </div>
                  )}
                  {s?.kind === "num" && (
                    <div className="flex items-center gap-3">
                      <input type="range" min={s.min} max={s.max} value={vals[p.name]} onChange={(e) => set(p.name, +e.target.value)} aria-label={p.name} className="h-11 min-w-0 flex-1 accent-[#e0434c]" />
                      <input type="number" min={s.min} max={s.max} value={vals[p.name]} onChange={(e) => set(p.name, +e.target.value)} aria-label={`${p.name} value`} className={`${inputCls} !w-20 shrink-0`} />
                    </div>
                  )}
                  {p.sub !== undefined || p.name === "bass_key" ? (
                    <button className={`${btn} w-full`} onClick={goKeys}>Assign keys →</button>
                  ) : null}
                </div>
                {isReg && (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:col-span-2">
                    {regs.map((r, j) => (
                      <label key={j} className="block text-xs text-[#c9cdd5]">Register {j + 1}
                        <input type="number" min={0} max={16} value={r} aria-label={`Register ${j + 1} number`}
                          onChange={(e) => setRegs((a) => a.map((x, k) => (k === j ? clamp(+e.target.value, 0, 16) : x)))} className={`${inputCls} mt-1`} /></label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      ))}

      <div className="flex flex-wrap items-center gap-3">
        <button className={btnRed} onClick={exportJson}>Export setup</button>
        <label className={`${btn} inline-flex cursor-pointer items-center`}>Import setup
          <input type="file" accept="application/json" className="sr-only" onChange={(e) => { importJson(e.target.files?.[0]); e.target.value = ""; }} /></label>
        <button className={btn} onClick={() => { setVals(initVals()); setRegs(initRegs()); setMsg("Reset to the placeholder values."); }}>Reset</button>
        <button disabled className={`${btn} cursor-not-allowed opacity-50`}>Send to controller · coming soon</button>
        <span aria-live="polite" className="text-sm text-[#c9cdd5]">{msg}</span>
      </div>
    </div>
  );
}

// Tabs inside the utility window. Both panels stay mounted so nothing is lost when switching.
function UtilityApp({ px }: { px: string }) {
  const [t, setT] = useState<"setup" | "keys">("setup");
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Utility sections">
        {([["setup", "Setup · Service mode"], ["keys", "Keys · note assignment"]] as const).map(([id, l]) => (
          <button key={id} aria-pressed={t === id} onClick={() => setT(id)}
            className={`${btn} ${t === id ? "!border-[#f4f0e8] !bg-[#f4f0e8] !text-[#14161a]" : ""}`}>{l}</button>
        ))}
      </div>
      <div className={t === "setup" ? "" : "hidden"}><SetupPanel px={px} goKeys={() => setT("keys")} /></div>
      <div className={t === "keys" ? "" : "hidden"}><KeyConfigurator px={px} /></div>
    </div>
  );
}

// Native-app style window. Children stay mounted while it is closed, so the key map and the USB connection survive.
function UtilityWindow({ open, onClose, px, font, children }: { open: boolean; onClose: () => void; px: string; font: string; children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open, onClose]);

  // Rendered in <body>: an ancestor with backdrop-filter would otherwise become the containing block of "fixed".
  if (!mounted) return null;
  return createPortal(
    <div className={`${font} text-[17px] leading-relaxed text-[#f4f0e8] ${open ? "" : "hidden"}`}>
      <div className="scrim fixed inset-0 z-[100] flex items-stretch justify-center bg-black/75 backdrop-blur-md sm:items-center sm:p-6"
        onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div role="dialog" aria-modal="true" aria-label="i-VOLUTION Utility"
          className="win flex h-full w-full max-w-6xl flex-col overflow-hidden border border-white/15 bg-[#14161a] shadow-[0_40px_120px_rgba(0,0,0,.85),0_0_0_1px_rgba(0,0,0,.6)] sm:h-[92vh] sm:rounded-2xl">
          <div className="flex h-12 shrink-0 items-center gap-3 border-b border-black/60 bg-gradient-to-b from-[#31353e] to-[#1d2026] px-4">
            <div className="flex gap-2" aria-hidden>
              <span className="h-3 w-3 rounded-full bg-[#e0434c]" /><span className="h-3 w-3 rounded-full bg-[#e8b73a]" /><span className="h-3 w-3 rounded-full bg-[#3ecf6e]" />
            </div>
            <div className={`${px} flex-1 truncate text-center text-base text-[#cfeaff]`}>🎹 i-VOLUTION Utility v1.0.13</div>
            <button onClick={onClose} aria-label="Close the utility" className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-xl text-[#c9cdd5] transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-[#bfe6ff]">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto bg-[#12141a] p-4 sm:p-6">{children}</div>
          <div className="flex h-9 shrink-0 items-center justify-between border-t border-black/60 bg-[#1b1e25] px-4 text-xs text-[#c9cdd5]">
            <span>t-K22 (i-volution)· firmware 5.13.1 · up{BAUD} baud</span>
            <span>Esc to close</span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

const h2 = "mb-2 text-2xl font-semibold sm:text-3xl";
const lead = "mb-6 max-w-[62ch] text-lg text-[#d5d9e0]";

export default function ManualPage() {
  const [auth, setAuth] = useState<"loading" | "in" | "out">("loading");
  const [sel, setSel] = useState(1);
  const [tab, setTab] = useState(0);
  const [util, setUtil] = useState(false);
  const closeUtil = useCallback(() => setUtil(false), []);
  const move = useCallback((d: number) => setSel((s) => ((s - 1 + d + TOTAL) % TOTAL) + 1), []);

  // Show the manual only to signed-in users.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuth(data.session ? "in" : "out"));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setAuth(session ? "in" : "out"));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (auth !== "in" || util) return;
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return; // don't hijack arrows while typing a value
      if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); move(1); }
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); move(-1); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [move, auth, util]);

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
            T=K22 midi controller (i-volution)· configurable MIDI controller for accordion · www.imidi.co.uk. Turn the encoder in the simulator to see how the menu looks on the OLED screen and what each setting does.
          </p>
        </header>

        {auth === "loading" && <p className="text-[#c9cdd5]">Checking your session...</p>}

        {auth === "out" && (
          <div className={`${panel} mx-auto max-w-xl space-y-4 p-8 text-center`}>
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#c8323b]/20 text-lg">🔒</div>
            <h2 className="text-2xl font-semibold">Sign in to read the manual</h2>
            <p className="text-[#d5d9e0]">The i-VOLUTION manual is available to registered users.</p>
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
                <li>Hold <b>PUSH ENCODER</b> while powering on. After the splash screen the controller waits 5 seconds and go to <code className={px}>SERVICE</code>.</li>
                <li>Press <b>PUSH ENCODER</b> to go to the next position. The position (for example 5/16) shows at the top right.</li>
                <li>Turn the encoder to change the value. It is saved at once, except <code className={px}>REG_ASSG_C</code>, where you press TR to save.</li>
                <li>To assign key notes, go to <code className={px}>Config_key</code> or <code className={px}>bass_key</code> and turn the encoder to 5 or higher (see Key assignment).</li>
                <li>There is no exit button. Power-cycle the controller to go back to playing.</li>
              </ol>
            </section>

            <section id="keys" className={`${panel} p-5 sm:p-8`}>
              <h2 className={h2}>Key assignment <span className="ml-2 align-middle rounded-full border border-[#c9a24a] px-3 py-0.5 text-sm font-normal text-[#f0dcb4]">PC utility · preview</span></h2>
              <p className={lead}>On the controller, the CONFIG KEY screen (treble, up to 45 keys) and the BASS KEY screen (bass, 24 keys) work the same way: press TR to move to the next key, turn the encoder to set its note (0–127). Each change is saved immediately. The utility below prepares the same map on your PC. It can already connect to the controller through a USB-serial adapter and show live MIDI; sending the map needs a firmware update first.</p>
              <div className="flex flex-wrap items-center gap-5 rounded-xl border border-white/10 bg-gradient-to-br from-[#1d2026] to-[#14161a] p-5 shadow-[0_10px_40px_rgba(0,0,0,.4)]">
                <div aria-hidden className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#e0434c] to-[#7a1a20] text-3xl shadow-[0_6px_20px_rgba(200,50,59,.45)]">🎹</div>
                <div className="min-w-[14rem] flex-1">
                  <div className={`${px} text-xl text-[#cfeaff]`}>i-VOLUTION Utility v1.0.13</div>
                  <p className="text-sm text-[#d5d9e0]">Full setup (channels, velocity, bellows, registers) and key assignment, with USB link and live MIDI monitor, in its own window.</p>
                </div>
                <button className={`${btnRed} px-6 text-lg`} onClick={() => setUtil(true)}>Open utility</button>
              </div>
              <UtilityWindow open={util} onClose={closeUtil} px={px} font={sans.className}>
                <UtilityApp px={px} />
              </UtilityWindow>
            </section> 

            <section id="boot" className={`${panel} p-5 sm:p-8`}>
              <h2 className={h2}>Boot sequence</h2>
              <p className={lead}>On power-up the display runs three short screens. Replay them here:</p>
              <div className="grid items-start gap-6 md:grid-cols-[minmax(0,28rem)_1fr]">
                <BootDemo px={px} />
                <ol className="list-decimal space-y-3 pl-6 text-lg">
                  <li><b>Splash</b> — “i-VOLUTION / TS4x synth”, the web address and a loading bar.</li>
                  <li><b>Hello</b> — a short piano animation with “HI!”.</li>
                  <li><b>Info</b> — hardware REV 4.0 and firmware V 5.13.1. up</li>
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
                <p>The code names the display option <code className={px}>OLED_127x32</code>, but the driver is set up for an 128×64 screen.</p>
                <p>Not covered yet: where the key notes are stored and their default values (they are handled in <code className={px}>config.h</code>), the stored setting <code className={px}>trans_type</code> (EEPROM 0x121), and PC configuration over SysEx. The firmware has a disabled <code className={px}>SysEx_Config</code> block: a handshake (F0 7D 01 02 01 02 F7, answered with the same bytes and "PC&gt;" on screen) and command codes 03 and 04 for treble and bass keys, which are not handled yet.</p>
                <p>MIDI for Accordions · www.imidi.co.uk. Firmware © BM, all rights reserved.</p>
              </div>
            </section>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}