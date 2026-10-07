"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { QRCodeSVG } from "qrcode.react";

/* ───────────── DATE: paginile de meniu (din enum-ul firmware) ───────────── */

const MANUAL_PAGES = [
  { index: 0, key: "MENU_PRICE", title: "Preț l (lapte)", lcdLine0: "Pret l (lapte)", step: "+0.50 RON / apăsare", limit: "Maxim 30.00 RON", description: "Setează prețul per litru de lapte perceput de automat. Modificarea se face în pași de 50 de bani." },
  { index: 1, key: "MENU_PULSES", title: "Pulsuri/l (FM)", lcdLine0: "Pulsuri/l (FM)", step: "+10 (<1k) sau +100 (>1k)", limit: "Maxim 9000", description: "Calibrarea debitmetrului (Flow Meter). Reprezintă numărul de impulsuri electrice generate de senzor pentru un litru de fluid livrat." },
  { index: 2, key: "MENU_MAX_DOSE", title: "Doza max(ml)", lcdLine0: "Doza max(ml)", step: "+100 ml / apăsare", limit: "1000 ml - 10000 ml", description: "Limita maximă de siguranță pentru o singură livrare continuă de lapte, prevenind risipa în caz de eroare senzorială." },
  { index: 3, key: "MENU_TIMEOUT", title: "Timeout(s)", lcdLine0: "Timeout(s)", step: "+1 secundă", limit: "10s - 59s", description: "Timpul de siguranță (No Flow Timeout). Oprește automat pompele dacă debitmetrul nu mai înregistrează impulsuri în acest interval." },
  { index: 4, key: "MENU_WASH_TIME", title: "Spalare(s)", lcdLine0: "Spalare(s)", step: "+5 secunde", limit: "10s - 300s", description: "Durata activă a ciclului de curățare cu detergent industrial (CIP) aplicat pe conducte și duze." },
  { index: 5, key: "MENU_TANK_CAPACITY", title: "Capacitate tanc (L)", lcdLine0: "Capacitate tanc (L)", step: "+50 Litri echiv.", limit: "100L - 1000L", description: "Capacitatea volumetrică totală a tancului de lapte instalat în interiorul automatului." },
  { index: 6, key: "MENU_FILL_AMOUNT", title: "Alimentare(L)", lcdLine0: "Alimentare(L)", step: "+50 Litri echiv.", limit: "Până la capacitatea tancului", description: "Configurează cantitatea de lapte proaspăt introdusă manual în aparat la ciclul curent de aprovizionare." },
  { index: 7, key: "MENU_FILL_CONFIRM", title: "CONFIRMA ALIM.", lcdLine0: "CONFIRMA ALIM.", step: "Execuție la apăsare", limit: "N/A", description: "Adaugă valoarea setată la pasul anterior peste stocul curent, salvează datele în memoria Flash și afișează mesajul pe ecran." },
  { index: 8, key: "MENU_MDB_ENABLE", title: "Port MDB (0=Op,1=P)", lcdLine0: "Port MDB(0=Op,1=P)", step: "Toggle (0 / 1)", limit: "0 sau 1", description: "Activează (1) sau dezactivează (0) magistrala fiscală MDB pentru cititorul de carduri POS bancar și sisteme de plată." },
  { index: 9, key: "MENU_YEAR", title: "An calendar", lcdLine0: "An calendar", step: "+1 An", limit: "2024 - 2033", description: "Setează anul curent în modulul de ceas în timp real (RTC). Modificarea reinițializează data pentru rapoartele HACCP." },
  { index: 10, key: "MENU_MONTH", title: "Luna calendar", lcdLine0: "Luna calendar", step: "+1 Lună", limit: "1 - 12", description: "Setează luna curentă în modulul RTC pentru sincronizarea sistemului de management fiscal." },
  { index: 11, key: "MENU_DAY", title: "Zi calendar", lcdLine0: "Zi calendar", step: "+1 Zi", limit: "1 - 31", description: "Setează ziua curentă a lunii în modulul RTC. Esențială pentru stabilirea corectă a intervalelor de spălare automată." },
  { index: 12, key: "MENU_HOUR", title: "Ora calendar", lcdLine0: "Ora calendar", step: "+1 Oră", limit: "0 - 23", description: "Setează ora exactă pentru sistemul intern. Automatul folosește acest parametru pentru pornirea paletei agitatorului la intervale fixe." },
  { index: 13, key: "MENU_MINUTE", title: "Minut calendar", lcdLine0: "Minut calendar", step: "+1 Minut", limit: "0 - 59", description: "Setează minutul curent pentru ceasul de sistem în timp real." },
  { index: 14, key: "MENU_TEST_PUMP", title: "Test pompa(SET)", lcdLine0: "Test pompa(SET)", step: "Pornit / Oprit la click", limit: "N/A", description: "Meniu de diagnosticare. Deschide electrovalva de evacuare și pornește pompa de lapte pentru verificarea directă a debitului." },
  { index: 15, key: "MENU_WASH_START", title: "SPALARE(SET)", lcdLine0: "SPALARE(SET)", step: "Lansare ciclu CIP", limit: "N/A", description: "Inițializează ciclul automat de spălare și igienizare conform parametrilor de timp setați în sistem." },
];

const N_PAGES = MANUAL_PAGES.length;
const SET_HOLD_MS = 2000;

/* ───────────── STAREA SIMULATORULUI (valori editabile) ───────────── */

type Vals = {
  priceBani: number; pulses: number; maxDose: number; timeout: number; wash: number;
  tank: number; fill: number; stock: number; mdb: number;
  year: number; month: number; day: number; hour: number; minute: number;
};

const INITIAL: Vals = {
  priceBani: 350, pulses: 450, maxDose: 1000, timeout: 15, wash: 30,
  tank: 500, fill: 0, stock: 250, mdb: 1,
  year: 2026, month: 9, day: 27, hour: 12, minute: 45,
};

// La depășirea limitei, valoarea revine la minim (comportament presupus).
const cyc = (v: number, step: number, min: number, max: number) => (v + step > max ? min : v + step);
const p2 = (n: number) => String(n).padStart(2, "0");

function bump(key: string, v: Vals): Vals {
  switch (key) {
    case "MENU_PRICE": return { ...v, priceBani: cyc(v.priceBani, 50, 50, 3000) };
    case "MENU_PULSES": return { ...v, pulses: cyc(v.pulses, v.pulses < 1000 ? 10 : 100, 10, 9000) };
    case "MENU_MAX_DOSE": return { ...v, maxDose: cyc(v.maxDose, 100, 1000, 10000) };
    case "MENU_TIMEOUT": return { ...v, timeout: cyc(v.timeout, 1, 10, 59) };
    case "MENU_WASH_TIME": return { ...v, wash: cyc(v.wash, 5, 10, 300) };
    case "MENU_TANK_CAPACITY": { const tank = cyc(v.tank, 50, 100, 1000); return { ...v, tank, fill: Math.min(v.fill, tank) }; }
    case "MENU_FILL_AMOUNT": return { ...v, fill: v.fill + 50 > v.tank ? 0 : v.fill + 50 };
    case "MENU_FILL_CONFIRM": return { ...v, stock: Math.min(v.tank, v.stock + v.fill), fill: 0 };
    case "MENU_MDB_ENABLE": return { ...v, mdb: v.mdb ? 0 : 1 };
    case "MENU_YEAR": return { ...v, year: cyc(v.year, 1, 2024, 2033) };
    case "MENU_MONTH": return { ...v, month: cyc(v.month, 1, 1, 12) };
    case "MENU_DAY": return { ...v, day: cyc(v.day, 1, 1, 31) };
    case "MENU_HOUR": return { ...v, hour: cyc(v.hour, 1, 0, 23) };
    case "MENU_MINUTE": return { ...v, minute: cyc(v.minute, 1, 0, 59) };
    default: return v;
  }
}

function lcdValue(key: string, v: Vals, pump: boolean, washing: boolean): string {
  switch (key) {
    case "MENU_PRICE": return `${(v.priceBani / 100).toFixed(2)} ron/l`;
    case "MENU_PULSES": return `pulse : ${v.pulses}`;
    case "MENU_MAX_DOSE": return `ml    : ${v.maxDose}`;
    case "MENU_TIMEOUT": return `time  : ${v.timeout} s`;
    case "MENU_WASH_TIME": return `time  : ${v.wash} s`;
    case "MENU_TANK_CAPACITY": return `vol   : ${v.tank} L`;
    case "MENU_FILL_AMOUNT": return `alim  : ${v.fill} L`;
    case "MENU_FILL_CONFIRM": return `Stoc: ${v.stock.toFixed(1)}L SET`;
    case "MENU_MDB_ENABLE": return `MDB status: ${v.mdb}`;
    case "MENU_YEAR": return `an    : ${v.year}`;
    case "MENU_MONTH": return `luna  : ${p2(v.month)}`;
    case "MENU_DAY": return `zi    : ${p2(v.day)}`;
    case "MENU_HOUR": return `ora   : ${p2(v.hour)}`;
    case "MENU_MINUTE": return `min   : ${p2(v.minute)}`;
    case "MENU_TEST_PUMP": return pump ? "POMPA: PORNITA" : "POMPA: OPRITA";
    case "MENU_WASH_START": return washing ? "SPALARE ACTIVA" : "SET = PORNESTE";
    default: return "";
  }
}

/* ───────────── LCD 16x2 ───────────── */

// Exact ca LCD_PrintLine(): taie sau completează la 16 caractere.
const pad16 = (t: string) => (t.length >= 16 ? t.slice(0, 16) : t + " ".repeat(16 - t.length));

function LcdScreen({ line0, line1, flash = false }: { line0: string; line1: string; flash?: boolean }) {
  return (
    <div
      aria-label={`Ecran LCD: ${line0} / ${line1}`}
      className={`corp-mono select-none rounded-md border-2 border-slate-500 px-4 py-3 text-[15px] font-bold leading-[1.7] tracking-wider text-white transition-colors duration-150 ${
        flash ? "bg-[#2563eb]" : "bg-[#1d4ed8]"
      }`}
      style={{ textShadow: "0 0 4px rgba(255,255,255,0.75)", boxShadow: "inset 0 0 15px rgba(0,0,0,0.3)" }}
    >
      <div className="whitespace-pre">{pad16(line0)}</div>
      <div className="whitespace-pre">{pad16(line1)}</div>
    </div>
  );
}

/* ───────────── MONITOR AVARII ───────────── */

const ERRORS = [
  { code: "CASE 0", lcd: "ERR: Lipsa Flux!", desc: "Debitmetru: gripare rotor, pierdere presiune sau lipsa fluxului de lapte." },
  { code: "CASE 1", lcd: "ERR: Pompa Lapte", desc: "Suprasarcină pe circuitul releului sau feedback electronic defect la pompă." },
  { code: "CASE 2", lcd: "ERR: Vana Evac. ", desc: "Electrovana de evacuare nu răspunde sau circuitul ei este întrerupt." },
  { code: "CASE 3", lcd: "ERR: Lipsa lapte", desc: "Tanc complet gol. Este necesară o alimentare." },
  { code: "CALL", lcd: "Call: 0765332178 ", desc: "Mesaj de contact service, afișat la finalul rotației de erori." },
];

function ErrorMonitor() {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % ERRORS.length), 2500);
    return () => clearInterval(id);
  }, [paused]);

  return (
    <section
      className="rounded-2xl border border-[#1e293b] bg-[#0b0f19] p-6 shadow-xl"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="grid items-start gap-8 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-rose-500 motion-safe:animate-ping" />
            <span className="corp-mono text-xs uppercase tracking-wider text-[#94a3b8]">
              ERR-timeout · param INDEX_03 &quot;Timeout(s)&quot;
            </span>
          </div>
          <LcdScreen line0={ERRORS[idx].lcd} line1="Livrat: 0000 ml" />
          <p className="corp-mono text-[10px] text-[#64748b]">
            {paused ? "Pus pe pauză (mouse deasupra)." : "Rotație automată la 2.5 s. Treci cu mouse-ul peste panou pentru pauză."}
          </p>
        </div>

        <div className="space-y-3">
          <h3 className="corp-mono text-sm font-bold uppercase tracking-tight text-slate-200">
            // Matrice avarii
          </h3>
          <p className="text-xs leading-relaxed text-[#94a3b8]">
            Firmware-ul ține o variabilă statică locală{" "}
            <code className="corp-mono rounded bg-rose-950/40 px-1 text-rose-400">static uint8_t tip_eroare</code>.
            La fiecare iterație sau întrerupere de la senzor, valoarea face un salt incremental auto-mărginit, iar ecranul afișează pe rând fiecare avarie.
          </p>
          <ul className="space-y-1.5">
            {ERRORS.map((e, i) => (
              <li key={e.code}>
                <button
                  type="button"
                  onClick={() => { setIdx(i); setPaused(true); }}
                  aria-current={i === idx}
                  className={`w-full rounded-lg border px-3 py-2 text-left font-mono text-[11px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                    i === idx ? "border-sky-500/50 bg-sky-500/10 text-slate-200" : "border-[#1e293b] bg-[#111827] text-slate-400 hover:border-slate-600"
                  }`}
                >
                  <span className="mr-2 text-[#38bdf8]">{e.code}:</span>
                  {e.desc}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ───────────── PARTAJARE ───────────── */

function ShareBar() {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: "vMilk Core", text: "Fișă vMilk Vender", url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      /* partajare anulată */
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-6 py-4 font-mono text-[11px] text-[#64748b]">
      <span>vMilk Vender · fișă tehnică · fw 1.13.2</span>
      <button
        type="button"
        onClick={share}
        className="font-bold text-[#0070F3] transition-colors hover:text-[#0051a2] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0070F3]"
      >
        {copied ? "✓ Link copiat" : "Partajează fișa tehnică →"}
      </button>
    </div>
  );
}

/* ───────────── TIPURI ȘI DATE ───────────── */

type Group = "power" | "gnd" | "input" | "mdb" | "com" | "relay";
type Pin = { pin: number; label: string; group: Group };
type Relay = { id: number; name: string; pin: number; com: number | null };

// Clasele sunt scrise integral, ca Tailwind să le poată detecta.
const GROUPS: Record<Group, { name: string; dot: string; text: string }> = {
  power: { name: "Alimentare", dot: "bg-red-400", text: "text-red-300" },
  gnd: { name: "Masă (GND)", dot: "bg-slate-300", text: "text-slate-200" },
  input: { name: "Intrări X", dot: "bg-emerald-300", text: "text-emerald-200" },
  mdb: { name: "Comunicație MDB", dot: "bg-sky-400", text: "text-sky-300" },
  com: { name: "Comun relee (COM)", dot: "bg-violet-400", text: "text-violet-300" },
  relay: { name: "Ieșiri relee (Y)", dot: "bg-blue-400", text: "text-blue-300" },
};

const TOP_PINS: Pin[] = [
  { pin: 1, label: "+24V", group: "power" },
  { pin: 2, label: "GND", group: "gnd" },
  { pin: 3, label: "X0 (5V FM)", group: "input" },
  { pin: 4, label: "X1", group: "input" },
  { pin: 5, label: "X2 (Rx MDB)", group: "mdb" },
  { pin: 6, label: "X3 (Tx MDB)", group: "mdb" },
  { pin: 7, label: "X4", group: "input" },
  { pin: 8, label: "X5 (FM SENS)", group: "input" },
  { pin: 9, label: "X6", group: "input" },
  { pin: 10, label: "X7 (Spalare)", group: "input" },
  { pin: 11, label: "X8 (Stop)", group: "input" },
  { pin: 12, label: "X9 (Start)", group: "input" },
  { pin: 13, label: "X10 (Scroll)", group: "input" },
  { pin: 14, label: "X11 (Meniu)", group: "input" },
  { pin: 15, label: "GND", group: "gnd" },
];

const BOTTOM_PINS: Pin[] = [
  { pin: 16, label: "COM0", group: "com" },
  { pin: 17, label: "Y0", group: "relay" },
  { pin: 18, label: "COM1", group: "com" },
  { pin: 19, label: "Y1", group: "relay" },
  { pin: 20, label: "COM2", group: "com" },
  { pin: 21, label: "Y2", group: "relay" },
  { pin: 22, label: "COM3", group: "com" },
  { pin: 23, label: "Y3", group: "relay" },
  { pin: 24, label: "COM4", group: "com" },
  { pin: 25, label: "Y4", group: "relay" },
  { pin: 26, label: "COM5", group: "com" },
  { pin: 27, label: "Y5", group: "relay" },
  { pin: 28, label: "COM6", group: "com" },
  { pin: 29, label: "Y6", group: "relay" },
  { pin: 30, label: "Y7", group: "relay" },
];

const RELAYS: Relay[] = [
  { id: 0, name: "Y0 POMPA", pin: 17, com: 16 },
  { id: 1, name: "Y1 READY COOL", pin: 19, com: 18 },
  { id: 2, name: "Y2 POMPA DET", pin: 21, com: 20 },
  { id: 3, name: "Y3 VANA OUTLET", pin: 23, com: 22 },
  { id: 4, name: "Y4", pin: 25, com: 24 },
  { id: 5, name: "Y5", pin: 27, com: 26 },
  { id: 6, name: "Y6", pin: 29, com: 28 },
  { id: 7, name: "Y7", pin: 30, com: null },
];

/** Descrieri scurte (sub etichetă) și complete (în panoul de detalii). */
const PIN_INFO: Record<number, { short: string; desc: string }> = {
  1: { short: "Alim. 24V", desc: "Alimentare placă, +24 V DC." },
  2: { short: "Masă", desc: "Masă comună (GND) a alimentării." },
  3: { short: "5V debitmetru", desc: "Alimentare 5 V pentru debitmetrul de lapte (Flow Meter)." },
  4: { short: "Intrare liberă", desc: "Intrare digitală X1, neutilizată în etichetarea actuală." },
  5: { short: "Recepție MDB", desc: "Linia Rx a magistralei MDB către sistemul de plată." },
  6: { short: "Transmisie MDB", desc: "Linia Tx a magistralei MDB către sistemul de plată." },
  7: { short: "Intrare liberă", desc: "Intrare digitală X4, neutilizată în etichetarea actuală." },
  8: { short: "Semnal debitmetru", desc: "Intrarea de impulsuri a senzorului debitmetrului (FM SENS), folosită la măsurarea litrilor livrați." },
  9: { short: "Intrare liberă", desc: "Intrare digitală X6, neutilizată în etichetarea actuală." },
  10: { short: "Buton spălare", desc: "Intrare pentru comanda de spălare." },
  11: { short: "Buton STOP", desc: "Intrare STOP: oprește livrarea." },
  12: { short: "Buton START", desc: "Intrare START: pornește livrarea." },
  13: { short: "Buton SCROLL", desc: "Intrare buton SCROLL: trece la pagina următoare din meniu." },
  14: { short: "Buton meniu", desc: "Intrare buton de meniu (SET): apăsat lung 2 s intră sau iese din meniu." },
  15: { short: "Masă", desc: "Masă comună (GND)." },
  16: { short: "Comun Y0", desc: "Borna comună COM0 a contactului releului Y0." },
  17: { short: "Pompă lapte", desc: "Ieșire releu Y0: pornește pompa de lapte." },
  18: { short: "Comun Y1", desc: "Borna comună COM1 a contactului releului Y1." },
  19: { short: "Ready cool", desc: "Ieșire releu Y1: semnal READY COOL (răcire pregătită)." },
  20: { short: "Comun Y2", desc: "Borna comună COM2 a contactului releului Y2." },
  21: { short: "Pompă detergent", desc: "Ieșire releu Y2: pompa de detergent, folosită la spălare." },
  22: { short: "Comun Y3", desc: "Borna comună COM3 a contactului releului Y3." },
  23: { short: "Vană evacuare", desc: "Ieșire releu Y3: electrovana de evacuare (OUTLET)." },
  24: { short: "Comun Y4", desc: "Borna comună COM4 a contactului releului Y4." },
  25: { short: "Ieșire liberă", desc: "Ieșire releu Y4: neutilizată în etichetarea actuală." },
  26: { short: "Comun Y5", desc: "Borna comună COM5 a contactului releului Y5." },
  27: { short: "Ieșire liberă", desc: "Ieșire releu Y5: neutilizată în etichetarea actuală." },
  28: { short: "Comun Y6", desc: "Borna comună COM6 a contactului releului Y6." },
  29: { short: "Ieșire liberă", desc: "Ieșire releu Y6: neutilizată în etichetarea actuală." },
  30: { short: "Ieșire liberă", desc: "Ieșire releu Y7, neutilizată în etichetarea actuală." },
};

const ALL_PINS = [...TOP_PINS, ...BOTTOM_PINS];

/** Perechea Y ↔ COM a unui pin (dacă există). */
function partnerOf(pin: number | null): number | null {
  if (pin === null) return null;
  const r = RELAYS.find((x) => x.pin === pin || x.com === pin);
  if (!r) return null;
  return r.pin === pin ? r.com : r.pin;
}

/* ───────────── PAD DE LIPIT (pin selectabil) ───────────── */

function PinButton({
  p,
  selected,
  linked,
  top,
  onSelect,
}: {
  p: Pin;
  selected: boolean;
  linked: boolean;
  top: boolean;
  onSelect: (pin: number) => void;
}) {
  const g = GROUPS[p.group];

  const label = (
    <span className="flex min-h-[40px] flex-col items-center justify-center text-center">
      <span
        className={`font-mono text-[10px] font-bold leading-tight ${
          selected ? "text-amber-300" : g.text
        }`}
      >
        {p.label}
      </span>
      <span className="mt-0.5 text-[8px] leading-tight text-white/60">
        {PIN_INFO[p.pin]?.short}
      </span>
    </span>
  );

  const number = (
    <span className="font-mono text-[9px] text-white/40">{p.pin}</span>
  );

  // Pad placat cu aur, cu gaură în mijloc
  const pad = (
    <span
      className={`relative flex h-5 w-5 items-center justify-center rounded-full border transition-all duration-200 ${
        selected
          ? "scale-125 border-white bg-amber-300 shadow-[0_0_14px_3px_rgba(251,191,36,0.7)]"
          : linked
          ? "border-amber-100 bg-amber-200 shadow-[0_0_8px_rgba(253,230,138,0.6)]"
          : "border-amber-700/70 bg-gradient-to-br from-amber-200 to-amber-500"
      }`}
    >
      <span className="h-2 w-2 rounded-full bg-emerald-950 shadow-inner" />
    </span>
  );

  // Pistă de cupru care coboară/urcă spre zona centrală
  const trace = (
    <span
      className={`h-5 w-[3px] rounded-full transition-colors ${
        selected ? "bg-amber-300" : linked ? "bg-amber-200/80" : "bg-emerald-300/25"
      }`}
    />
  );

  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`Pin ${p.pin}, ${p.label}`}
      onClick={() => onSelect(p.pin)}
      className={`flex flex-col items-center gap-1 rounded-md px-0.5 py-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${
        selected ? "bg-amber-400/10" : "hover:bg-white/5"
      }`}
    >
      {top ? (
        <>
          {label}
          {pad}
          {number}
          {trace}
        </>
      ) : (
        <>
          {trace}
          {number}
          {pad}
          {label}
        </>
      )}
    </button>
  );
}

/* ───────────── STM32F103C8T6 (LQFP48) ───────────── */

function Stm32Chip() {
  const N = 12;
  const idx = Array.from({ length: N }, (_, i) => i);
  const pos = (i: number) => 58 + i * 11.2;

  return (
    <svg
      viewBox="0 0 240 240"
      role="img"
      aria-label="Microcontroler STM32F103C8T6, capsulă LQFP48"
      className="h-44 w-44 shrink-0 drop-shadow-[0_8px_10px_rgba(0,0,0,0.55)] sm:h-52 sm:w-52"
    >
      <defs>
        <linearGradient id="chipBody" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2a3342" />
          <stop offset="0.5" stopColor="#151b26" />
          <stop offset="1" stopColor="#0c1018" />
        </linearGradient>
        <linearGradient id="leg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e5e7eb" />
          <stop offset="1" stopColor="#94a3b8" />
        </linearGradient>
      </defs>

      {/* Contur serigrafie */}
      <rect x="24" y="24" width="192" height="192" rx="4" fill="none" stroke="#fff" strokeOpacity="0.25" strokeWidth="1" strokeDasharray="4 3" />
      <text x="28" y="20" fill="#fff" fillOpacity="0.55" fontSize="9" fontFamily="ui-monospace, monospace">U1</text>

      {/* Picioare (12 pe latură) */}
      {idx.map((i) => (
        <g key={i} fill="url(#leg)" stroke="#475569" strokeWidth="0.4">
          <rect x={pos(i) - 2.5} y={34} width={5} height={15} rx="0.8" />
          <rect x={pos(i) - 2.5} y={191} width={5} height={15} rx="0.8" />
          <rect x={34} y={pos(i) - 2.5} width={15} height={5} rx="0.8" />
          <rect x={191} y={pos(i) - 2.5} width={15} height={5} rx="0.8" />
        </g>
      ))}

      {/* Corp */}
      <rect x="48" y="48" width="144" height="144" rx="5" fill="url(#chipBody)" stroke="#05080d" strokeWidth="1.5" />
      <rect x="53" y="53" width="134" height="134" rx="3" fill="none" stroke="#fff" strokeOpacity="0.08" />
      <polygon points="48,48 192,48 48,192" fill="#fff" fillOpacity="0.035" />

      {/* Marcaj pin 1 */}
      <circle cx="64" cy="64" r="4" fill="#05080d" stroke="#64748b" strokeWidth="1" />

      {/* Text de pe cip */}
      <g fontFamily="ui-sans-serif, system-ui, sans-serif" fill="#cbd5e1" textAnchor="middle">
        <text x="120" y="102" fontSize="18" fontWeight="700" letterSpacing="1">STM32</text>
        <text x="120" y="122" fontSize="14" fontWeight="600" letterSpacing="0.5">F103C8T6</text>
        <text x="120" y="142" fontSize="8" fillOpacity="0.7" fontFamily="ui-monospace, monospace">ARM Cortex-M3 · 72 MHz</text>
        <text x="120" y="168" fontSize="7" fillOpacity="0.45" fontFamily="ui-monospace, monospace">64KB FLASH · 20KB SRAM</text>
        <text x="120" y="178" fontSize="6.5" fillOpacity="0.35" fontFamily="ui-monospace, monospace">GH 4341 PHL</text>
      </g>
    </svg>
  );
}

/* ───────────── COMPONENTE DECORATIVE ───────────── */

function Led({ color, pulse = false }: { color: string; pulse?: boolean }) {
  return (
    <span
      className={`h-2.5 w-2.5 rounded-sm border border-black/40 ${color} ${
        pulse ? "motion-safe:animate-pulse" : ""
      }`}
    />
  );
}

function Silk({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-[9px] text-white/55">{children}</span>;
}

function Cap() {
  return (
    <span className="h-2.5 w-5 rounded-[2px] border border-amber-950/60 bg-gradient-to-b from-amber-300 to-amber-600" />
  );
}

function DbPin({ n }: { n: number }) {
  return (
    <span className="flex h-3 w-3 items-center justify-center rounded-full border border-slate-950 bg-amber-400 text-[6px] font-bold text-slate-950">
      {n}
    </span>
  );
}

function MountingHole({ className }: { className: string }) {
  return (
    <span
      className={`absolute h-4 w-4 rounded-full border-[3px] border-amber-300/80 bg-slate-950 shadow-inner ${className}`}
    />
  );
}

/* ───────────── COMPONENTA PRINCIPALĂ ───────────── */

const PIN_GRID =
  "grid grid-cols-5 gap-x-1 gap-y-2 sm:grid-cols-8 lg:grid-cols-[repeat(15,minmax(0,1fr))]";

function PcbPinout() {
  const [selected, setSelected] = useState<number | null>(null);

  const toggle = (pin: number) => setSelected((cur) => (cur === pin ? null : pin));
  const partner = partnerOf(selected);
  const current = ALL_PINS.find((p) => p.pin === selected) ?? null;
  const currentRelay = RELAYS.find((r) => r.pin === selected || r.com === selected);

  return (
    <section className="w-full rounded-xl border border-slate-700 bg-slate-800 p-4 text-slate-100 shadow-xl sm:p-6">
      <div className="flex w-full flex-col gap-5">
        {/* ── PLACA PCB ── */}
        <div className="relative w-full select-none overflow-hidden rounded-2xl border-[3px] border-emerald-950 bg-gradient-to-br from-emerald-800 via-emerald-900 to-emerald-950 p-5 shadow-[0_20px_40px_rgba(0,0,0,0.5)] sm:p-8">
          {/* Textură măsă de cupru */}
          <div className="pointer-events-none absolute inset-0 opacity-[0.12] bg-[radial-gradient(#6ee7b7_1px,transparent_1px)] [background-size:14px_14px]" />
          {/* Contur serigrafie */}
          <div className="pointer-events-none absolute inset-2 rounded-xl border border-white/15" />

          {/* Găuri de montaj */}
          <MountingHole className="left-3 top-3" />
          <MountingHole className="right-3 top-3" />
          <MountingHole className="bottom-3 left-3" />
          <MountingHole className="bottom-3 right-3" />

          <div className="relative z-10 flex flex-col gap-6">
            {/* Titlu serigrafie */}
            <div className="flex items-end justify-between px-2">
              <span className="font-mono text-xs font-bold tracking-widest text-white/70">
                MDB-CTRL
              </span>
              <span className="font-mono text-[10px] text-white/45">REV 1.0 · 24V</span>
            </div>

            {/* Pini sus */}
            <div className={PIN_GRID}>
              {TOP_PINS.map((p) => (
                <PinButton
                  key={p.pin}
                  p={p}
                  top
                  selected={selected === p.pin}
                  linked={partner === p.pin}
                  onSelect={toggle}
                />
              ))}
            </div>

            {/* Zona centrală: componente + cip + DB9 */}
            <div className="mx-auto flex w-full max-w-3xl flex-col items-center justify-center gap-6 rounded-lg border border-white/10 bg-black/15 p-4 md:flex-row md:gap-8">
              {/* Stânga: cristal, condensatoare, SWD, LED-uri */}
              <div className="flex shrink-0 flex-row items-center gap-5 md:flex-col md:gap-4">
                <div className="flex flex-col items-center gap-1">
                  <div className="flex h-5 w-12 items-center justify-center rounded-md border border-slate-500 bg-gradient-to-b from-slate-200 to-slate-400 font-mono text-[8px] font-bold text-slate-700 shadow">
                    8.000
                  </div>
                  <Silk>Y1 · 8MHz</Silk>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <div className="flex gap-1.5">
                    <Cap />
                    <Cap />
                    <Cap />
                  </div>
                  <Silk>C1–C3</Silk>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <div className="flex gap-1.5 rounded-sm bg-black/30 p-1">
                    {["3V3", "CLK", "DIO", "GND"].map((s) => (
                      <span
                        key={s}
                        className="h-2.5 w-2.5 rounded-full border border-amber-700 bg-amber-300"
                        title={s}
                      />
                    ))}
                  </div>
                  <Silk>SWD</Silk>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <div className="flex gap-2">
                    <Led color="bg-emerald-400 shadow-[0_0_8px_#34d399]" pulse />
                    <Led color="bg-red-500 shadow-[0_0_8px_#ef4444]" />
                  </div>
                  <Silk>PWR · ERR</Silk>
                </div>
              </div>

              {/* Centru: STM32 */}
              <Stm32Chip />

              {/* Dreapta: DB9 */}
              <div className="flex shrink-0 flex-col items-center rounded-md border border-slate-600 bg-slate-900/80 p-3 shadow-lg">
                <span className="mb-2 font-mono text-[10px] font-bold text-amber-400">
                  DB9 – BILL VALIDATOR
                </span>
                <div
                  className="bg-slate-400 p-[2px]"
                  style={{ clipPath: "polygon(0 0, 100% 0, 93% 100%, 7% 100%)" }}
                >
                  <div
                    className="flex h-14 w-36 flex-col justify-between bg-slate-800 px-3 py-1.5"
                    style={{ clipPath: "polygon(0 0, 100% 0, 93% 100%, 7% 100%)" }}
                  >
                    <div className="flex justify-around">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <DbPin key={n} n={n} />
                      ))}
                    </div>
                    <div className="flex justify-around px-4">
                      {[6, 7, 8, 9].map((n) => (
                        <DbPin key={n} n={n} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Relee Y0 – Y7 */}
            <div className="grid grid-cols-2 gap-2 rounded-lg border border-black/30 bg-black/25 p-3 sm:grid-cols-4 lg:grid-cols-8">
              {RELAYS.map((r) => {
                const active = selected === r.pin || selected === r.com;
                return (
                  <button
                    key={r.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggle(r.pin)}
                    className={`relative flex h-[68px] flex-col justify-between rounded-md border p-2 text-center transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${
                      active
                        ? "scale-[1.03] border-white bg-blue-500 shadow-[0_0_16px_rgba(59,130,246,0.85)]"
                        : "border-blue-950 bg-blue-700 hover:bg-blue-600"
                    }`}
                  >
                    <span
                      className={`absolute right-1.5 top-1.5 h-2 w-2 rounded-full transition-all ${
                        active ? "bg-lime-300 shadow-[0_0_8px_#bef264]" : "bg-blue-950"
                      }`}
                    />
                    <span className="pr-3 font-mono text-[10px] font-bold leading-tight text-blue-50">
                      {r.name}
                    </span>
                    <span className="font-mono text-[10px] font-bold text-amber-300">
                      PIN {r.pin}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Pini jos */}
            <div className={PIN_GRID}>
              {BOTTOM_PINS.map((p) => (
                <PinButton
                  key={p.pin}
                  p={p}
                  top={false}
                  selected={selected === p.pin}
                  linked={partner === p.pin}
                  onSelect={toggle}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ── LEGENDĂ ── */}
        <ul className="flex flex-wrap gap-x-4 gap-y-2 px-1 text-xs text-slate-300">
          {(Object.keys(GROUPS) as Group[]).map((k) => (
            <li key={k} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-full ${GROUPS[k].dot}`} />
              {GROUPS[k].name}
            </li>
          ))}
        </ul>

        {/* ── PANOU DETALII ── */}
        <div
          aria-live="polite"
          className="w-full rounded-xl border border-slate-700 bg-slate-900/60 p-4 font-mono text-sm"
        >
          {current ? (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-amber-400">p.{current.pin}</span>
                <span className="text-base font-bold text-slate-100">{current.label}</span>
              </div>
              <span className={`flex items-center gap-1.5 ${GROUPS[current.group].text}`}>
                <span className={`h-2.5 w-2.5 rounded-full ${GROUPS[current.group].dot}`} />
                {GROUPS[current.group].name}
              </span>
              {currentRelay && (
                <span className="text-slate-300">
                  Pereche releu:{" "}
                  <span className="text-amber-300">
                    {currentRelay.com !== null
                      ? `COM${currentRelay.id} (p.${currentRelay.com}) ↔ Y${currentRelay.id} (p.${currentRelay.pin})`
                      : `Y${currentRelay.id} (p.${currentRelay.pin}) – fără COM propriu`}
                  </span>
                </span>
              )}
              {PIN_INFO[current.pin] && (
                <p className="w-full font-sans text-xs leading-relaxed text-slate-300">
                  {PIN_INFO[current.pin].desc}
                </p>
              )}
            </div>
          ) : (
            <p className="text-center text-slate-400">
              Selectează un pin sau un releu de pe placă. Apasă din nou pentru a deselecta.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

/* ───────────── QR HMI / KIOSK ───────────── */

const KIOSK_URL = "https://imidi.co.uk/vmlk/kiosk";

function KioskQr() {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(KIOSK_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard indisponibil */
    }
  };

  // Colțuri de „vizor", ca la un scanner
  const corners = [
    "left-0 top-0 border-l-2 border-t-2 rounded-tl-lg",
    "right-0 top-0 border-r-2 border-t-2 rounded-tr-lg",
    "bottom-0 left-0 border-b-2 border-l-2 rounded-bl-lg",
    "bottom-0 right-0 border-b-2 border-r-2 rounded-br-lg",
  ];

  return (
    <section className="flex flex-col items-center gap-6 rounded-2xl border border-[#EAEAEA] bg-white p-6 shadow-sm sm:flex-row">
      <div className="relative shrink-0 p-5">
        {corners.map((c) => (
          <span key={c} className={`absolute h-6 w-6 border-[#0070F3] ${c}`} />
        ))}
        <div className="rounded-md bg-white p-2 ring-1 ring-[#EAEAEA]">
          <QRCodeSVG
            value={KIOSK_URL}
            size={148}
            level="M"
            bgColor="#ffffff"
            fgColor="#0f172a"
            title="Cod QR către interfața HMI vMilk Kiosk"
          />
        </div>
      </div>

      <div className="space-y-3 text-center sm:text-left">
        <h2 className="text-lg font-bold tracking-tight text-black">Interfață HMI · Kiosk</h2>
        <p className="max-w-md text-xs leading-relaxed text-[#666666]">
          Scanează codul cu telefonul pentru a deschide direct interfața HMI a automatului, fără să mai tastezi adresa.
        </p>

        <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
          <a
            href={KIOSK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="corp-mono rounded-md bg-[#0070F3] px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-[#0051a2] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0070F3] focus-visible:ring-offset-2"
          >
            Deschide HMI
          </a>
          <button
            type="button"
            onClick={copy}
            className="corp-mono rounded-md border border-[#EAEAEA] bg-white px-3 py-2 text-xs font-bold text-[#111111] transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0070F3]"
          >
            {copied ? "✓ Link copiat" : "Copiază linkul"}
          </button>
        </div>
      </div>
    </section>
  );
}

/* ───────────── PAGINA ───────────── */

export default function VVMilkManualPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [vals, setVals] = useState<Vals>(INITIAL);
  const [pump, setPump] = useState(false);
  const [washing, setWashing] = useState(false);
  const [notice, setNotice] = useState<{ l0: string; l1: string } | null>(null);
  const [flash, setFlash] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);

  const menuOpenRef = useRef(false);
  const holdStart = useRef<number | null>(null);
  const rafId = useRef<number | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const rowRefs = useRef<(HTMLLIElement | null)[]>([]);
  const listRef = useRef<HTMLUListElement | null>(null);

  const later = (fn: () => void, ms: number) => { timers.current.push(setTimeout(fn, ms)); };
  useEffect(() => () => {
    timers.current.forEach(clearTimeout);
    if (rafId.current) cancelAnimationFrame(rafId.current);
  }, []);

  const setMenu = useCallback((v: boolean) => { menuOpenRef.current = v; setMenuOpen(v); }, []);

  const stopHold = useCallback(() => {
    if (rafId.current) cancelAnimationFrame(rafId.current);
    rafId.current = null;
    holdStart.current = null;
    setHoldProgress(0);
  }, []);

  // Apăsare lungă: intră / iese din meniu (la ieșire, „salvează în Flash”)
  const toggleMenu = useCallback(() => {
    if (menuOpenRef.current) {
      setMenu(false);
      setPump(false);
      setNotice({ l0: "Salvat in Flash", l1: "Meniu inchis" });
      later(() => setNotice(null), 1500);
    } else {
      setActiveTab(0);
      setMenu(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setMenu]);

  const tick = useCallback(() => {
    if (holdStart.current === null) return;
    const elapsed = performance.now() - holdStart.current;
    setHoldProgress(Math.min(100, (elapsed / SET_HOLD_MS) * 100));
    if (elapsed >= SET_HOLD_MS) { stopHold(); toggleMenu(); return; }
    rafId.current = requestAnimationFrame(tick);
  }, [stopHold, toggleMenu]);

  const onSetDown = () => {
    if (holdStart.current !== null) return;
    holdStart.current = performance.now();
    rafId.current = requestAnimationFrame(tick);
  };

  // Apăsare scurtă: modifică valoarea paginii curente
  const shortPress = () => {
    const key = MANUAL_PAGES[activeTab].key;
    if (key === "MENU_TEST_PUMP") setPump((p) => !p);
    else if (key === "MENU_WASH_START") { setWashing(true); later(() => setWashing(false), 3000); }
    else setVals((v) => bump(key, v));
    setFlash(true);
    later(() => setFlash(false), 150);
  };

  const onSetUp = () => {
    const wasShort = holdStart.current !== null && performance.now() - holdStart.current < SET_HOLD_MS;
    stopHold();
    if (wasShort && menuOpenRef.current) shortPress();
  };

  const goToTab = (idx: number) => {
    if (idx !== activeTab) setPump(false); // SCROLL oprește testul pompei
    setActiveTab(idx);
    setMenu(true);
    const row = rowRefs.current[idx];
    const box = listRef.current;
    if (row && box) box.scrollTo({ top: row.offsetTop - box.clientHeight / 2 + row.clientHeight / 2, behavior: "smooth" });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!menuOpen || (e.target as HTMLElement).closest("input,textarea,select")) return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); goToTab((activeTab + 1) % N_PAGES); }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); goToTab((activeTab - 1 + N_PAGES) % N_PAGES); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, menuOpen]);

  const current = MANUAL_PAGES[activeTab];
  const [line0, line1] = notice
    ? [notice.l0, notice.l1]
    : menuOpen
    ? [current.lcdLine0, lcdValue(current.key, vals, pump, washing)]
    : [`Stoc:${vals.stock.toFixed(1)}L DISP.`, "Introdu bani"];

  const btn =
    "corp-mono flex-1 rounded-md border border-[#3a3a3a] bg-[#1f1f1f] py-3 text-xs font-bold uppercase tracking-wide text-[#e0e0e0] transition-transform active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]";

  return (
    <div className="corp-sans flex min-h-screen flex-col bg-[#FAFAFA] text-[#111111] antialiased selection:bg-[#0070F3]/10 selection:text-[#0070F3]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');
        .corp-sans { font-family: 'Inter', sans-serif; }
        .corp-mono { font-family: 'JetBrains Mono', monospace; }
      `}</style>

      <Navbar />

      {/* Header */}
      <header className="border-b border-[#EAEAEA] bg-white pb-10 pt-32">
        <div className="mx-auto w-full max-w-5xl space-y-2 px-6">
          <span className="corp-mono inline-block rounded bg-[#0070F3]/10 px-2 py-0.5 text-xs font-semibold text-[#0070F3]">
            FIRMWARE CORE v 1.13.2
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-black sm:text-3xl">Manual de Configurare Tehnică</h1>
          <p className="max-w-3xl text-sm leading-relaxed text-[#666666]">
            Ghid oficial de programare a controllerului industrial pentru automatele de lapte proaspăt <strong>vMilk Vender</strong>.
            Documentație extrasă direct din stările logice ale butoanelor fizice de pe placă. Simulatorul de mai jos se comportă ca ecranul real: încearcă-l.
          </p>
        </div>
      </header>

      <ShareBar />

      <main className="mx-auto grid w-full max-w-5xl flex-1 grid-cols-1 gap-8 px-6 pb-12 md:grid-cols-3">
        {/* Stânga: simulator + interfață fizică */}
        <div className="space-y-6 md:col-span-1">
          <div className="space-y-4 rounded-xl border border-[#2a2a2a] bg-[#161616] p-5 shadow-sm md:sticky md:top-24">
            <div className="flex items-center justify-between">
              <h2 className="corp-mono text-xs font-bold uppercase tracking-wider text-[#8fe388]">// VMILK 1.13.2</h2>
              <span className="corp-mono text-[10px] text-[#777]">in_menu = {menuOpen ? 1 : 0}</span>
            </div>

            <LcdScreen line0={line0} line1={line1} flash={flash} />

            <div className="flex items-center gap-3">
              <button
                type="button"
                onPointerDown={onSetDown}
                onPointerUp={onSetUp}
                onPointerLeave={stopHold}
                onPointerCancel={stopHold}
                onContextMenu={(e) => e.preventDefault()}
                onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !e.repeat) { e.preventDefault(); onSetDown(); } }}
                onKeyUp={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSetUp(); } }}
                className={`${btn} relative touch-none select-none overflow-hidden`}
              >
                <span className="absolute inset-y-0 left-0 bg-[#2563eb]/40" style={{ width: `${holdProgress}%` }} />
                <span className="relative">SET</span>
              </button>
              <button
                type="button"
                onClick={() => goToTab((activeTab + 1) % N_PAGES)}
                disabled={!menuOpen}
                className={`${btn} disabled:cursor-not-allowed disabled:opacity-30`}
              >
                SCROLL
              </button>
            </div>

            <p className="corp-mono text-[10px] leading-relaxed text-[#777]">
              Ține apăsat <strong className="text-[#e0e0e0]">SET</strong> 2 secunde pentru a intra/ieși din meniu.
              Apăsare scurtă = modifică valoarea. <strong className="text-[#e0e0e0]">SCROLL</strong> = pagina următoare.
              Navighezi și cu tastele săgeți, sau cu click pe orice rând din registru.
            </p>
          </div>

          <div className="space-y-4 rounded-xl border border-[#EAEAEA] bg-white p-5 shadow-sm">
            <h2 className="corp-mono text-sm font-bold uppercase tracking-wider text-[#0070F3]">// Interfață fizică</h2>
            <div className="space-y-4 text-sm">
              <div className="space-y-1">
                <span className="block font-bold text-black">[SET] Apăsare lungă (≥ 2s)</span>
                <p className="text-xs leading-relaxed text-[#666666]">
                  Intră sau iese din meniul de configurare. La ieșire, sistemul apelează automat{" "}
                  <code className="corp-mono rounded bg-gray-100 px-1 text-[11px] text-red-500">SaveParamsToFlash()</code>{" "}
                  și reinițializează validatorul fiscal MDB.
                </p>
              </div>
              <div className="space-y-1 border-t border-gray-100 pt-3">
                <span className="block font-bold text-black">[SET] Apăsare scurtă (&lt; 2s)</span>
                <p className="text-xs leading-relaxed text-[#666666]">
                  Modifică valoarea parametrului selectat curent, incrementând-o conform regulilor definite în firmware.
                </p>
              </div>
              <div className="space-y-1 border-t border-gray-100 pt-3">
                <span className="block font-bold text-black">[SCROLL] Apăsare scurtă</span>
                <p className="text-xs leading-relaxed text-[#666666]">
                  Trece la următoarea pagină/parametru din ecranul LCD (<code className="corp-mono text-[11px]">menu_index++</code>). Oprește automat testul pompei dacă acesta era activ în fundal.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Dreapta: registru + avarii + notă */}
        <div className="space-y-6 md:col-span-2">
          <div className="overflow-hidden rounded-xl border border-[#EAEAEA] bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-[#EAEAEA] bg-[#FAFAFA] px-5 py-3">
              <h2 className="corp-mono text-xs font-bold uppercase text-black">Registru pagini meniu LCD ({N_PAGES})</h2>
              <span className="corp-mono text-xs text-[#666666]">pagina {activeTab + 1}/{N_PAGES}</span>
            </div>

            <ul ref={listRef} className="relative max-h-[560px] divide-y divide-[#EAEAEA] overflow-y-auto">
              {MANUAL_PAGES.map((page, idx) => {
                const on = activeTab === idx && menuOpen;
                return (
                  <li key={page.key} ref={(n) => { rowRefs.current[idx] = n; }}>
                    <button
                      type="button"
                      onClick={() => goToTab(idx)}
                      aria-current={on}
                      className={`block w-full p-5 text-left transition-colors focus:outline-none focus-visible:bg-[#0070F3]/10 ${
                        on ? "bg-[#0070F3]/5" : "hover:bg-gray-50"
                      }`}
                    >
                      <span className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                        <span className="block space-y-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="corp-mono rounded bg-gray-100 px-1.5 py-0.5 text-xs text-[#666666]">INDEX_{p2(page.index)}</span>
                            <span className="text-sm font-semibold tracking-tight text-black">&quot;{page.title}&quot;</span>
                            {on && <span className="corp-mono text-[10px] font-bold text-[#0070F3]">◄ pe ecran</span>}
                          </span>
                          <span className="block max-w-xl pt-1 text-xs leading-relaxed text-[#666666]">{page.description}</span>
                          <span className="corp-mono inline-block rounded bg-[#161616] px-2 py-0.5 text-[10px] text-[#8fe388]">
                            {lcdValue(page.key, vals, pump, washing)}
                          </span>
                        </span>
                        <span className="corp-mono block shrink-0 space-y-1 text-[11px] sm:text-right">
                          <span className="block text-black"><span className="text-[#666666]">Pas:</span> {page.step}</span>
                          <span className="block text-[#0070F3]"><span className="text-[#666666]">Limită:</span> {page.limit}</span>
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <ErrorMonitor />

          <KioskQr />

          <div className="flex gap-3 rounded-xl border border-[#FFEBA0] bg-[#FFF3CD] p-4 text-left">
            <span className="text-sm" aria-hidden>⚠️</span>
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-[#856404]">NOTĂ IMPORTANTĂ PRIVIND SALVAREA</h3>
              <p className="text-[11px] leading-relaxed text-[#856404]">
                Parametrii modificați nu se scriu în Flash la fiecare apăsare scurtă, pentru a proteja ciclurile de viață ale microcontrolerului.
                Salvarea permanentă are loc strict la părăsirea meniului, prin apăsarea lungă de 2 secunde a butonului <strong>SET</strong>.
              </p>
            </div>
          </div>
        </div>

        {/* Placa controlerului: conectori și pinout */}
        <section id="pcb" className="space-y-4 md:col-span-3">
          <div className="space-y-1">
            <h2 className="text-lg font-bold tracking-tight text-black">Placa controlerului: conectori și pinout</h2>
            <p className="max-w-3xl text-xs leading-relaxed text-[#666666]">
              Selectează un pin sau un releu pentru a vedea grupul din care face parte și perechea COM ↔ Y. Apasă din nou pentru a deselecta.
            </p>
          </div>
          <PcbPinout />
        </section>
      </main>

      <Footer />
    </div>
  );
}