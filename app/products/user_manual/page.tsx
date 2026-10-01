"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bricolage_Grotesque, Pixelify_Sans } from "next/font/google";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { supabase } from "@/lib/supabase";

const sans = Bricolage_Grotesque({ subsets: ["latin"] });
const pixel = Pixelify_Sans({ subsets: ["latin"] });

type Param = { name: string; sub?: boolean; what: string; unit: string; eeprom?: string; note?: string };
type Page = { title: string; items: Param[] };

// Positions 13–16 come straight from the firmware. Descriptions of 1–12 are inferred from the names.
const PAGES: Page[] = [
  { title: "Bass & Bell", items: [
    { name: "BASS_EN", what: "Turns the bass section on or off.", unit: "ON / OFF" },
    { name: "Bell_low_pull", what: "Low-note “bell” register setting, used when the bellows are pulled.", unit: "value" },
    { name: "Bell_GAIN", what: "Output level (gain) of the bell register.", unit: "value" },
    { name: "Bell_low_push", what: "Low-note “bell” register setting, used when the bellows are pushed.", unit: "value" } ] },
  { title: "Channels & programs", items: [
    { name: "TREB_CH", what: "MIDI channel used by the right hand (melody).", unit: "channel 1–16" },
    { name: "BASS_CH", what: "MIDI channel used by the left hand (bass).", unit: "channel 1–16" },
    { name: "TREB_PG", what: "Program Change (the sound) sent for the melody.", unit: "program 0–127" },
    { name: "BASS_PG", what: "Program Change (the sound) sent for the bass.", unit: "program 0–127" } ] },
  { title: "Velocity & keys", items: [
    { name: "Vel_treb", what: "Velocity (note strength) for the melody.", unit: "0–127" },
    { name: "Vel_bass", what: "Velocity (note strength) for the bass.", unit: "0–127" },
    { name: "Config_key", sub: true, what: "Opens a submenu for configuring the keys (marked “>>”).", unit: "submenu" },
    { name: "bass_key", what: "Sets the base key/note for the bass.", unit: "value" } ] },
  { title: "Registers & chords", items: [
    { name: "REG_ASSG_C", what: "Register assignment per instrument. Pick an instrument (1–15) and set its value; the screen shows “instrument -> value”. The value is written to EEPROM while the TR signal is inactive, and “saved” appears on screen.", unit: "instrument 1–15 → value", eeprom: "0x000 – 0x00E" },
    { name: "PG_REG", what: "Enables or disables the registers (variable REG_EN). The screen shows EN when the value is 1, otherwise DIS.", unit: "EN / DIS", eeprom: "0x161", note: "Saved automatically on every change." },
    { name: "offest_LH_BL", what: "Offset for the left hand / bass. The value wraps back to 0 after 127.", unit: "0 – 127", eeprom: "0x172", note: "Saved automatically on every change." },
    { name: "ACHORD_CH", what: "MIDI channel for chords (judging by the name). Stored as 0–15, shown on screen as 1–16.", unit: "channel 1–16", eeprom: "0x154", note: "Saved automatically on every change." } ] },
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
          <h1 className="sheen text-[clamp(2.2rem,8vw,4.2rem)] font-bold leading-[1.05]">User manual</h1>
          <p className="mt-3 max-w-[60ch] text-lg text-[#d5d9e0]">
            Configurable MIDI controller for accordion. Turn the encoder in the simulator to see how the menu looks on the OLED screen and what each setting does.
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
                    <span>{p.what}</span>
                    <span className="text-[#d5d9e0]">{p.unit}</span>
                  </li>
                ))}
              </ul>
              <button className={`${btn} mt-3`} onClick={() => { setSel(tab * 4 + 1); document.getElementById("simulator")?.scrollIntoView(); }}>
                Show this page in the simulator
              </button>
            </section>

            <section id="start" className={`${panel} p-5 sm:p-8`}>
              <h2 className={h2}>Getting started</h2>
              <ol className="max-w-[65ch] list-decimal space-y-3 pl-6 text-lg">
                <li>Power on the controller and wait for the main screen.</li>
                <li>Turn the encoder to move through the 16 positions. The active line is marked with <kbd className={`rounded border border-[#3a404a] bg-[#262a31] px-1.5 ${px}`}>&gt;</kbd>.</li>
                <li>Set the MIDI channels (<code className={px}>TREB_CH</code>, <code className={px}>BASS_CH</code>) to match your instrument or software.</li>
                <li>Choose the sounds with <code className={px}>TREB_PG</code> and <code className={px}>BASS_PG</code>.</li>
                <li>Adjust playing strength with <code className={px}>Vel_treb</code> and <code className={px}>Vel_bass</code>.</li>
              </ol>
            </section>

            <section id="notes" className="rounded-2xl border border-[#6b5230] bg-[#2a2119]/95 p-5 text-[#f0dcb4] sm:p-8">
              <h2 className={h2}>Notes</h2>
              <div className="max-w-[65ch] space-y-3 text-lg">
                <p>The menu shown here is for the 127×32 OLED version. Parameter names are exactly as in the firmware, including <code className={px}>offest_LH_BL</code> as it appears on screen.</p>
                <p>Settings at positions 14, 15 and 16 are written to EEPROM on every change. <code className={px}>REG_ASSG_C</code> (position 13) is written only while TR is inactive, and the screen confirms with “saved”.</p>
                <p>Descriptions for positions 1–12 are inferred from the names and still need to be confirmed.</p>
              </div>
            </section>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}