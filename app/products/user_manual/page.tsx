"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bricolage_Grotesque, Pixelify_Sans } from "next/font/google";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { supabase } from "@/lib/supabase";

const sans = Bricolage_Grotesque({ subsets: ["latin"] });
const pixel = Pixelify_Sans({ subsets: ["latin"] });

type Param = { name: string; sub?: boolean; what: string; unit: string; v?: string; eeprom?: string; note?: string };
type Page = { title: string; items: Param[] };

// Variable names and EEPROM addresses come from the firmware. Menu-to-variable pairing for 1–12 is matched by name.
const PAGES: Page[] = [
  { title: "Bass & Bellows", items: [
    { name: "BASS_EN", what: "Enables or disables the left-hand (bass) section.", unit: "EN / DIS", v: "LH_EN", eeprom: "0x160" },
    { name: "Bell_low_pull", what: "Lower-bellows setting for the pull direction.", unit: "value", v: "lower_bellows_pull", eeprom: "0x130" },
    { name: "Bell_GAIN", what: "Gain of the bellows sensor. The firmware default is 1.", unit: "value", v: "bellows_gain", eeprom: "0x140" },
    { name: "Bell_low_push", what: "Lower-bellows setting for the push direction.", unit: "value", v: "lower_bellows_push", eeprom: "0x120" } ] },
  { title: "Channels & programs", items: [
    { name: "TREB_CH", what: "MIDI channel used by the right hand (melody).", unit: "channel 1–16", v: "R_key_ch", eeprom: "0x150" },
    { name: "BASS_CH", what: "MIDI channel used by the left hand (bass).", unit: "channel 1–16", v: "L_key_ch", eeprom: "0x151" },
    { name: "TREB_PG", what: "Program Change setting for the melody.", unit: "value", v: "R_PG_ch", eeprom: "0x152" },
    { name: "BASS_PG", what: "Program Change setting for the bass.", unit: "value", v: "L_PG_ch", eeprom: "0x153" } ] },
  { title: "Velocity & keys", items: [
    { name: "Vel_treb", what: "Velocity (note strength) for the melody.", unit: "0–127", v: "Velocity_treble", eeprom: "0x170" },
    { name: "Vel_bass", what: "Velocity (note strength) for the bass.", unit: "0–127", v: "Velocity_bass", eeprom: "0x171" },
    { name: "Config_key", sub: true, what: "Opens a submenu for configuring the keys (marked “>>”).", unit: "submenu" },
    { name: "bass_key", what: "Sets the base key/note for the bass.", unit: "value" } ] },
  { title: "Registers & chords", items: [
    { name: "REG_ASSG_C", what: "Register assignment per instrument. Pick an instrument (1–15) and set its value; the screen shows “instrument -> value”. The value is written to EEPROM while the TR signal is inactive, and “saved” appears on screen.", unit: "instrument 1–15 → value", v: "shift_register1 … 15", eeprom: "0x000 – 0x00E" },
    { name: "PG_REG", what: "Enables or disables the registers. The screen shows EN when the value is 1, otherwise DIS.", unit: "EN / DIS", v: "REG_EN", eeprom: "0x161", note: "Saved automatically on every change." },
    { name: "offest_LH_BL", what: "Offset for the left hand. The value wraps back to 0 after 127.", unit: "0 – 127", v: "off_LH", eeprom: "0x172", note: "Saved automatically on every change." },
    { name: "ACHORD_CH", what: "MIDI channel for chords (judging by the name). Stored as 0–15, shown on screen as 1–16.", unit: "channel 1–16", v: "L_key_ch2", eeprom: "0x154", note: "Saved automatically on every change." } ] },
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
            <div>INFO</div><div className="pt-[6%]">&lt;hardware type&gt;</div><div>&lt;OS version&gt;</div>
          </div>
        )}
      </div>
      <button className={`${btn} mt-3`} onClick={() => setRun((r) => r + 1)}>↻ Replay boot sequence</button>
    </div>
  );
}

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
type K = { note: number; ch: number };
type KeyMap = { treble: K[]; bass: K[] };
const mkKeys = (n: number, start: number, ch: number): K[] => Array.from({ length: n }, (_, i) => ({ note: Math.min(127, start + i), ch }));
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, Math.round(v) || a));
const noteName = (n: number) => NOTES[n % 12] + (Math.floor(n / 12) - 1);
const inputCls = "h-11 w-full rounded-lg border border-[#3a404a] bg-[#0f1116] px-3 text-[#f4f0e8] outline-none focus:border-[#bfe6ff]";

// Preview of the future PC utility. Today it edits a draft key map and exports/imports JSON.
// When the USB-USART link exists, plug the transport into sendToDevice() below.
function KeyConfigurator({ px }: { px: string }) {
  const [cfg, setCfg] = useState<KeyMap>({ treble: mkKeys(24, 48, 1), bass: mkKeys(24, 36, 2) });
  const [hand, setHand] = useState<"treble" | "bass">("treble");
  const [idx, setIdx] = useState(0);
  const [serial, setSerial] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => setSerial("serial" in navigator), []);

  const keys = cfg[hand];
  const i = Math.min(idx, keys.length - 1);
  const k = keys[i];
  const upd = (patch: Partial<K>) => setCfg((c) => ({ ...c, [hand]: c[hand].map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  const fill = (start: number) => setCfg((c) => ({ ...c, [hand]: c[hand].map((x, j) => ({ ...x, note: Math.min(127, start + j) })) }));
  const resize = (v: number) => {
    const n = clamp(v, 1, 64);
    setCfg((c) => {
      const cur = c[hand];
      const last = cur[cur.length - 1];
      const next = n <= cur.length ? cur.slice(0, n) : [...cur, ...Array.from({ length: n - cur.length }, (_, j) => ({ note: Math.min(127, last.note + j + 1), ch: last.ch }))];
      return { ...c, [hand]: next };
    });
  };
  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ device: "i-VOLUTION TS4x", version: 1, ...cfg }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "ivolution-keys.json"; a.click();
    URL.revokeObjectURL(a.href); setMsg("Exported ivolution-keys.json");
  };
  const importJson = async (f?: File) => {
    if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      const ok = (a: unknown) => Array.isArray(a) && a.length >= 1 && a.length <= 64 &&
        a.every((x) => Number.isInteger(x?.note) && x.note >= 0 && x.note <= 127 && Number.isInteger(x?.ch) && x.ch >= 1 && x.ch <= 16);
      if (ok(d.treble) && ok(d.bass)) { setCfg({ treble: d.treble, bass: d.bass }); setIdx(0); setMsg("Imported."); }
      else setMsg("That file is not a valid key map.");
    } catch { setMsg("That file is not a valid key map."); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-black/25 p-3">
        <span className="inline-flex items-center gap-2 text-sm"><span className="h-2.5 w-2.5 rounded-full bg-[#c9a24a]" />USB-USART: not connected (planned)</span>
        <button disabled className={`${btn} ml-auto cursor-not-allowed opacity-50`}>Connect to controller · coming soon</button>
        <span className="w-full text-sm text-[#c9cdd5]">Browser serial support (Web Serial): {serial ? "available" : "not available — use Chrome or Edge"}.</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["treble", "bass"] as const).map((h) => (
          <button key={h} aria-pressed={hand === h} onClick={() => { setHand(h); setIdx(0); }}
            className={`${btn} ${hand === h ? "!border-[#f4f0e8] !bg-[#f4f0e8] !text-[#14161a]" : ""}`}>{h === "treble" ? "Treble (right hand)" : "Bass (left hand)"}</button>
        ))}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8" role="group" aria-label="Keys">
          {keys.map((x, j) => (
            <button key={j} onClick={() => setIdx(j)} aria-pressed={j === i} aria-label={`Key ${j + 1}, note ${noteName(x.note)}`}
              className={`min-h-14 cursor-pointer rounded-lg border px-1 py-1.5 text-center transition-colors ${j === i ? "border-[#e0434c] bg-[#c8323b]/30" : "border-[#3a404a] bg-[#1b1e25] hover:border-[#c9cdd5]"}`}>
              <span className="block text-xs text-[#c9cdd5]">{j + 1}</span>
              <span className={`${px} block text-base`}>{noteName(x.note)}</span>
            </button>
          ))}
        </div>

        <div className="space-y-3 rounded-xl border border-white/10 bg-black/25 p-4">
          <h3 className={`${px} text-xl text-[#cfeaff]`}>Key {i + 1} · {noteName(k.note)}</h3>
          <label className="block text-sm">MIDI note (0–127)
            <input type="number" min={0} max={127} value={k.note} onChange={(e) => upd({ note: clamp(+e.target.value, 0, 127) })} className={`${inputCls} mt-1`} /></label>
          <label className="block text-sm">MIDI channel (1–16)
            <input type="number" min={1} max={16} value={k.ch} onChange={(e) => upd({ ch: clamp(+e.target.value, 1, 16) })} className={`${inputCls} mt-1`} /></label>
          <label className="block text-sm">Number of keys (1–64)
            <input type="number" min={1} max={64} value={keys.length} onChange={(e) => resize(+e.target.value)} className={`${inputCls} mt-1`} /></label>
          <button className={`${btn} w-full`} onClick={() => fill(k.note - i)}>Fill chromatically from key 1 = {noteName(Math.max(0, k.note - i))}</button>
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

            <section id="boot" className={`${panel} p-5 sm:p-8`}>
              <h2 className={h2}>Boot sequence</h2>
              <p className={lead}>When you power on, the display runs three short screens before the controller is ready. Replay it here:</p>
              <div className="grid items-start gap-6 md:grid-cols-[minmax(0,28rem)_1fr]">
                <BootDemo px={px} />
                <ol className="list-decimal space-y-3 pl-6 text-lg">
                  <li><b>Splash</b> — “i-VOLUTION / TS4x synth” and the web address, with a loading bar.</li>
                  <li><b>Hello</b> — a short piano animation with “HI!”.</li>
                  <li><b>Info</b> — the hardware type and the OS (firmware) version.</li>
                </ol>
              </div>
            </section>

            <section id="midi" className={`${panel} p-5 sm:p-8`}>
              <h2 className={h2}>MIDI messages</h2>
              <p className={lead}>The firmware can send these standard MIDI messages:</p>
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[13rem_1fr]">
                {[
                  ["Note On / Note Off", "Status 0x9n and 0x8n, with note and velocity."],
                  ["Program Change", "Status 0xCn, with one data byte (0–127)."],
                  ["Control Change", "Status 0xBn. Volume uses CC 7, Expression uses CC 11."],
                  ["Bank + program", "Bank MSB (CC 0), bank LSB (CC 32), then Program Change. Written for Korg PA-series keyboards."],
                  ["Preset number", "A preset from 0 to 16383 is split into bank MSB (preset ÷ 128) and program (preset mod 128); bank LSB is 0."],
                ].map(([k, v]) => (<div key={k} className="contents"><dt className="font-semibold text-[#cfeaff]">{k}</dt><dd className="mb-2 sm:mb-0">{v}</dd></div>))}
              </dl>
              <p className="mt-4 text-[#c9cdd5]">n is the MIDI channel (0–15 in the message, shown as 1–16 on screen).</p>
            </section>

            <section id="keys" className={`${panel} p-5 sm:p-8`}>
              <h2 className={h2}>Key configurator <span className="ml-2 align-middle rounded-full border border-[#c9a24a] px-3 py-0.5 text-sm font-normal text-[#f0dcb4]">preview</span></h2>
              <p className={lead}>A PC utility for setting up the keys. For now it edits a draft key map and saves it as a file; the number of keys and the defaults are placeholders. A USB-USART link to the controller is planned, so the map can be sent straight from the PC.</p>
              <KeyConfigurator px={px} />
            </section>

            <section id="start" className={`${panel} p-5 sm:p-8`}>
              <h2 className={h2}>Getting started</h2>
              <ol className="max-w-[65ch] list-decimal space-y-3 pl-6 text-lg">
                <li>Power on the controller and wait for the boot sequence to finish.</li>
                <li>Turn the encoder to move through the 16 positions. The active line is marked with <kbd className={`rounded border border-[#3a404a] bg-[#262a31] px-1.5 ${px}`}>&gt;</kbd>.</li>
                <li>Set the MIDI channels (<code className={px}>TREB_CH</code>, <code className={px}>BASS_CH</code>) to match your instrument or software.</li>
                <li>Choose the sounds with <code className={px}>TREB_PG</code> and <code className={px}>BASS_PG</code>.</li>
                <li>Adjust playing strength with <code className={px}>Vel_treb</code> and <code className={px}>Vel_bass</code>.</li>
              </ol>
            </section>

            <section id="notes" className="rounded-2xl border border-[#6b5230] bg-[#2a2119]/95 p-5 text-[#f0dcb4] sm:p-8">
              <h2 className={h2}>Notes</h2>
              <div className="max-w-[65ch] space-y-3 text-lg">
                <p>The settings menu is the SERVICE setup. At start-up the firmware loads every setting from EEPROM, so values persist after power-off.</p>
                <p>The menu shown here is the <code className={px}>OLED_127x32</code> build; the boot screens are drawn for a 128×64 display. Parameter names are exactly as in the firmware, including <code className={px}>offest_LH_BL</code> as it appears on screen.</p>
                <p>Settings at positions 14, 15 and 16 are written to EEPROM on every change. <code className={px}>REG_ASSG_C</code> (position 13) is written only while TR is inactive, and the screen confirms with “saved”.</p>
                <p>One more stored value, <code className={px}>trans_type</code> (EEPROM 0x121), is not on the pages shown here. Descriptions of <code className={px}>Config_key</code>, <code className={px}>bass_key</code> and the exact meaning of the bellows values still need to be confirmed.</p>
              </div>
            </section>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}