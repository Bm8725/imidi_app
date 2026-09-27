"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

// Structura dedusă direct din enum-ul firmware-ului C
const MANUAL_PAGES = [
  {
    index: 0,
    title: "Preț l (lapte)",
    key: "MENU_PRICE",
    step: "+0.50 RON / apăsare",
    limit: "Maxim 30.00 RON",
    description: "Setează prețul per litru de lapte perceput de automat. Modificarea se face în pași de 50 de bani.",
    lcdLine0: "Pret l (lapte)",
    lcdLine1: "3.50 ron/l",
  },
  {
    index: 1,
    title: "Pulsuri/l (FM)",
    key: "MENU_PULSES",
    step: "+10 (<1k) sau +100 (>1k)",
    limit: "Maxim 9000",
    description: "Calibrarea debitmetrului (Flow Meter). Reprezintă numărul de impulsuri electrice generate de senzor pentru un litru de fluid dispensed.",
    lcdLine0: "Pulsuri/l (FM)",
    lcdLine1: "pulse : 450",
  },
  {
    index: 2,
    title: "Doza max(ml)",
    key: "MENU_MAX_DOSE",
    step: "+100 ml / apăsare",
    limit: "1000 ml - 10000 ml",
    description: "Limita maximă de siguranță pentru o singură livrare continuă de lapte, prevenind risipa în caz de eroare senzorială.",
    lcdLine0: "Doza max(ml)",
    lcdLine1: "ml    : 1000",
  },
  {
    index: 3,
    title: "Timeout(s)",
    key: "MENU_TIMEOUT",
    step: "+1 secundă",
    limit: "10s - 59s",
    description: "Timpul de siguranță (No Flow Timeout). Oprește automat pompele dacă debitmetrul nu mai înregistrează impulsuri în acest interval.",
    lcdLine0: "Timeout(s)",
    lcdLine1: "time  : 15 s",
  },
  {
    index: 4,
    title: "Spalare(s)",
    key: "MENU_WASH_TIME",
    step: "+5 secunde",
    limit: "10s - 300s",
    description: "Durata activă a ciclului de curățare cu detergent industrial (CIP) aplicat pe conducte și duze.",
    lcdLine0: "Spalare(s)",
    lcdLine1: "time  : 30 s",
  },
  {
    index: 5,
    title: "Capacitate tanc (L)",
    key: "MENU_TANK_CAPACITY",
    step: "+50 Litri echiv.",
    limit: "100L - 1000L",
    description: "Capacitatea volumetrică totală a tancului de lapte instalat în interiorul automatului.",
    lcdLine0: "Capacitate tanc (L)",
    lcdLine1: "vol   : 500 L",
  },
  {
    index: 6,
    title: "Alimentare(L)",
    key: "MENU_FILL_AMOUNT",
    step: "+50 Litri echiv.",
    limit: "Până la capacitatea tancului",
    description: "Configurează cantitatea de lapte proaspăt introdusă manual în aparat la ciclul curent de aprovizionare.",
    lcdLine0: "Alimentare(L)",
    lcdLine1: "alim  : 0 L",
  },
  {
    index: 7,
    title: "CONFIRMA ALIM.",
    key: "MENU_FILL_CONFIRM",
    step: "Execuție la apăsare",
    limit: "N/A",
    description: "Adaugă valoarea setată la pasul anterior peste stocul curent, salvează datele în memoria Flash și afișează mesajul pe ecran.",
    lcdLine0: "CONFIRMA ALIM.",
    lcdLine1: "Stoc: 250.0L SET",
  },
  {
    index: 8,
    title: "Port MDB (0=Op,1=P)",
    key: "MENU_MDB_ENABLE",
    step: "Toggle (0 / 1)",
    limit: "0 sau 1",
    description: "Activează (1) sau dezactivează (0) magistrala fiscală MDB pentru cititorul de carduri POS bancar și sisteme de plată.",
    lcdLine0: "Port MDB(0=Op,1=P)",
    lcdLine1: "MDB status: 1",
  },
  {
    index: 9,
    title: "An calendar",
    key: "MENU_YEAR",
    step: "+1 An",
    limit: "2024 - 2033",
    description: "Setează anul curent în modulul de ceas în timp real (RTC). Modificarea reinițializează data pentru rapoartele HACCP.",
    lcdLine0: "An calendar",
    lcdLine1: "an    : 2026",
  },
  {
    index: 10,
    title: "Luna calendar",
    key: "MENU_MONTH",
    step: "+1 Lună",
    limit: "1 - 12",
    description: "Setează luna curentă în modulul RTC pentru sincronizarea sistemului de management fiscal.",
    lcdLine0: "Luna calendar",
    lcdLine1: "luna  : 09",
  },
  {
    index: 11,
    title: "Zi calendar",
    key: "MENU_DAY",
    step: "+1 Zi",
    limit: "1 - 31",
    description: "Setează ziua curentă a lunii în modulul RTC. Esențială pentru stabilirea corectă a intervalelor de spălare automată.",
    lcdLine0: "Zi calendar",
    lcdLine1: "zi    : 27",
  },
  {
    index: 12,
    title: "Ora calendar",
    key: "MENU_HOUR",
    step: "+1 Oră",
    limit: "0 - 23",
    description: "Setează ora exactă pentru sistemul intern. Automatul folosește acest parametru pentru pornirea paletei agitatorului la intervale fixe.",
    lcdLine0: "Ora calendar",
    lcdLine1: "ora   : 12",
  },
  {
    index: 13,
    title: "Minut calendar",
    key: "MENU_MINUTE",
    step: "+1 Minut",
    limit: "0 - 59",
    description: "Setează minutul curent pentru ceasul de sistem în timp real.",
    lcdLine0: "Minut calendar",
    lcdLine1: "min   : 45",
  },
  {
    index: 14,
    title: "Test pompa(SET)",
    key: "MENU_TEST_PUMP",
    step: "Pornit / Oprit la click",
    limit: "N/A",
    description: "Meniu de diagnosticare. Deschide electrovalva de evacuare și pornește pompa de lapte pentru verificarea directă a debitului.",
    lcdLine0: "Test pompa(SET)",
    lcdLine1: "POMPA: OPRITA",
  },
  {
    index: 15,
    title: "SPALARE(SET)",
    key: "MENU_WASH_START",
    step: "Lansare ciclu CIP",
    limit: "N/A",
    description: "Inițializează ciclul automat de spălare și igienizare conform parametrilor de timp setați în sistem.",
    lcdLine0: "SPALARE(SET)",
    lcdLine1: "SET = PORNESTE",
  },
];


const IDLE_LINE0 = "Stoc:250.0L DISP.";
const IDLE_LINE1 = "Introdu bani";
const SET_HOLD_MS = 2000;

// ── LCD 16x2 simulat — padding la 16 caractere, exact ca LCD_PrintLine() ──
function pad16(text: string) {
  return text.length >= 16 ? text.slice(0, 16) : text + " ".repeat(16 - text.length);
}

function LcdScreen({ line0, line1, flash }: { line0: string; line1: string; flash?: boolean }) {
  return (
    <div
      className={`corp-mono select-none rounded-md px-4 py-3 text-[15px] leading-[1.7] tracking-wider border-2 border-slate-500 relative overflow-hidden transition-all duration-150 ${
        flash ? "bg-[#2563eb]" : "bg-[#1d4ed8]"
      }`}
      style={{ 
        color: "#ffffff", 
        textShadow: "0px 0px 4px rgba(255, 255, 255, 0.75)",
        boxShadow: "inset 0 0 15px rgba(0, 0, 0, 0.3)" 
      }}
    >
      {/* Backlight puternic albastru uniform dedesubt */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#1e40af] to-[#1d4ed8] opacity-100 pointer-events-none" />
      
      {/* Conținutul text randat cu alb pur și contrast maxim */}
      <div className="whitespace-pre relative z-10 font-bold">{pad16(line0)}</div>
      <div className="whitespace-pre relative z-10 font-bold">{pad16(line1)}</div>
    </div>
  );
}


export default function VVMilkManualPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [holding, setHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [flash, setFlash] = useState(false);

  const holdStart = useRef<number | null>(null);
  const rafId = useRef<number | null>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

  const stopHoldTimer = useCallback(() => {
    if (rafId.current) cancelAnimationFrame(rafId.current);
    rafId.current = null;
    holdStart.current = null;
    setHolding(false);
    setHoldProgress(0);
  }, []);

  const tick = useCallback(() => {
    if (holdStart.current === null) return;
    const elapsed = Date.now() - holdStart.current;
    setHoldProgress(Math.min(100, (elapsed / SET_HOLD_MS) * 100));
    if (elapsed >= SET_HOLD_MS) {
      setMenuOpen((v) => !v);
      stopHoldTimer();
      return;
    }
    rafId.current = requestAnimationFrame(tick);
  }, [stopHoldTimer]);

  const onSetDown = () => {
    holdStart.current = Date.now();
    setHolding(true);
    rafId.current = requestAnimationFrame(tick);
  };

  const onSetUp = () => {
    // apăsare scurtă (<2s) — dacă suntem în meniu, simulăm "valoare modificată"
    const wasShort = holdStart.current !== null && Date.now() - holdStart.current < SET_HOLD_MS;
    stopHoldTimer();
    if (wasShort && menuOpen) {
      setFlash(true);
      setTimeout(() => setFlash(false), 150);
    }
  };

  const goToTab = (idx: number) => {
    setActiveTab(idx);
    setMenuOpen(true);
    rowRefs.current[idx]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };

  const scrollNext = () => {
    if (!menuOpen) return;
    const next = (activeTab + 1) % MANUAL_PAGES.length;
    goToTab(next);
  };

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); scrollNext(); }
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); setFlash(true); setTimeout(() => setFlash(false), 150); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, menuOpen]);

  const current = MANUAL_PAGES[activeTab];

  return (
    <div className="bg-[#FAFAFA] text-[#111111] min-h-screen flex flex-col antialiased selection:bg-[#0070F3]/10 selection:text-[#0070F3]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');
        .corp-sans { font-family: 'Inter', sans-serif; }
        .corp-mono { font-family: 'JetBrains Mono', monospace; }
      `}</style>

      <Navbar />

      {/* Hero Header Minimalist */}
      <div className="corp-sans bg-white border-b border-[#EAEAEA] pt-32 pb-12 text-left">
        <div className="w-full max-w-5xl mx-auto px-6 space-y-2">
          <div className="flex items-center gap-2">
            <span className="corp-mono bg-[#0070F3]/10 text-[#0070F3] text-xs font-semibold px-2 py-0.5 rounded">FIRMWARE CORE v 1.13.2</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-black">Manual de Configurare Tehnică</h1>
          <p className="text-sm text-[#666666] leading-relaxed max-w-3xl">
            Ghid oficial de programare a controllerului industrial pentru automatele de lapte proaspăt <strong>vMilk Vender</strong>. Documentație extrasă direct din stările logice ale butoanelor fizice de pe placă.
          </p>
        </div>
      </div>

      {/* Main Layout Manual */}
      <main className="corp-sans flex-1 w-full max-w-5xl mx-auto px-6 py-10 grid grid-cols-1 md:grid-cols-3 gap-8">

        {/* Coloana Stânga: Simulator LCD + Instrucțiuni */}
        <div className="md:col-span-1 space-y-6">

          {/* Simulator interactiv */}
          <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.15)] space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider corp-mono text-[#8fe388]">// Simulator Panou</h3>
              <span className="corp-mono text-[10px] text-[#777]">in_menu = {menuOpen ? 1 : 0}</span>
            </div>

            <LcdScreen
              line0={menuOpen ? current.lcdLine0 : IDLE_LINE0}
              line1={menuOpen ? current.lcdLine1 : IDLE_LINE1}
              flash={flash}
            />

            <div className="flex items-center gap-3">
              <button
                onMouseDown={onSetDown}
                onMouseUp={onSetUp}
                onMouseLeave={() => holding && stopHoldTimer()}
                onTouchStart={onSetDown}
                onTouchEnd={onSetUp}
                className="relative flex-1 overflow-hidden corp-mono text-xs font-bold uppercase tracking-wide py-3 rounded-md border border-[#3a3a3a] text-[#e0e0e0] active:scale-[0.98] transition-transform"
                style={{ background: "#1f1f1f" }}
              >
                <span
                  className="absolute inset-0 bg-[#0070F3]/40 transition-[width] duration-75"
                  style={{ width: `${holdProgress}%` }}
                />
                <span className="relative">SET</span>
              </button>

              <button
                onClick={scrollNext}
                disabled={!menuOpen}
                className="flex-1 corp-mono text-xs font-bold uppercase tracking-wide py-3 rounded-md border border-[#3a3a3a] text-[#e0e0e0] disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.98] transition-transform"
                style={{ background: "#1f1f1f" }}
              >
                SCROLL
              </button>
            </div>

            <p className="corp-mono text-[10px] text-[#777] leading-relaxed">
              Ține apăsat <strong className="text-[#e0e0e0]">SET</strong> 2 secunde pentru a intra/ieși din meniu.
              Apăsare scurtă = modifică valoarea. <strong className="text-[#e0e0e0]">SCROLL</strong> = pagina următoare.
              Poți naviga și cu tastele săgeți, sau click direct pe orice rând din registrul din dreapta.
            </p>
          </div>

          <div className="bg-white border border-[#EAEAEA] rounded-xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] space-y-4">
            <h3 className="text-sm font-bold text-black uppercase tracking-wider corp-mono text-[#0070F3]">
              // Interfață Fizică
            </h3>

            <div className="space-y-4 text-sm">
              <div className="space-y-1">
                <span className="font-bold text-black block">[SET] Apăsare Lungă (≥ 2s)</span>
                <p className="text-xs text-[#666666] leading-relaxed">
                  Intră sau iese din meniul de configurare. La ieșire, sistemul apelează automat funcția <code className="corp-mono bg-gray-100 text-red-500 px-1 rounded text-[11px]">SaveParamsToFlash()</code> și reinițializează validatorul fiscal MDB.
                </p>
              </div>

              <div className="space-y-1 border-t border-gray-100 pt-3">
                <span className="font-bold text-black block">[SET] Apăsare Scurtă (&lt; 2s)</span>
                <p className="text-xs text-[#666666] leading-relaxed">
                  Modifică valoarea parametrului selectat curent, incrementând-o conform regulilor definite în firmware.
                </p>
              </div>

              <div className="space-y-1 border-t border-gray-100 pt-3">
                <span className="font-bold text-black block">[SCROLL] Apăsare Scurtă</span>
                <p className="text-xs text-[#666666] leading-relaxed">
                  Trece la următoarea pagină/parametru din ecranul LCD (<code className="corp-mono text-[11px]">menu_index++</code>). Oprește automat testul pompei dacă acesta era activ în fundal.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Coloana Dreaptă: Registrul de Meniuri Interactiv */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white border border-[#EAEAEA] rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.02)] overflow-hidden">
            <div className="border-b border-[#EAEAEA] bg-[#FAFAFA] px-5 py-3 flex justify-between items-center">
              <span className="text-xs font-bold text-black corp-mono uppercase">Registru Pagini Meniu LCD ({MANUAL_PAGES.length})</span>
              <span className="text-xs text-[#666666] corp-mono">in_menu = {menuOpen ? 1 : 0}</span>
            </div>

            {/* Listă parametri */}
            <div className="divide-y divide-[#EAEAEA] max-h-[560px] overflow-y-auto">
              {MANUAL_PAGES.map((page, idx) => (
                <div
                  key={page.key}
                  ref={(node) => { rowRefs.current[idx] = node; }}
                  className={`p-5 transition-colors cursor-pointer ${activeTab === idx && menuOpen ? "bg-[#0070F3]/5" : "hover:bg-gray-50"}`}
                  onClick={() => goToTab(idx)}
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="corp-mono text-xs text-[#666666] bg-gray-100 px-1.5 py-0.5 rounded">INDEX_0{page.index}</span>
                        <h4 className="text-sm font-semibold text-black tracking-tight">
                          "{page.title}"
                        </h4>
                        {activeTab === idx && menuOpen && (
                          <span className="corp-mono text-[10px] text-[#0070F3] font-bold">◄ pe ecran</span>
                        )}
                      </div>
                      <p className="text-xs text-[#666666] leading-relaxed max-w-xl pt-1">
                        {page.description}
                      </p>
                    </div>

                    <div className="text-right shrink-0 corp-mono text-[11px] space-y-1">
                      <div className="text-black"><span className="text-[#666666]">Pas:</span> {page.step}</div>
                      <div className="text-[#0070F3]"><span className="text-[#666666]">Limită:</span> {page.limit}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

          </div>

          {/* Alertă Tehnică de Securitate Memorie */}
          <div className="bg-[#FFF3CD] border border-[#FFEBA0] rounded-xl p-4 flex gap-3 text-left">
            <span className="text-sm">⚠️</span>
            <div className="space-y-1">
              <h5 className="text-xs font-bold text-[#856404]">NOTĂ IMPORTANTĂ PRIVIND SALVAREA</h5>
              <p className="text-[11px] text-[#856404] leading-relaxed">
                Parametrii modificați nu se scriu sectorial în Flash la fiecare apăsare scurtă pentru a proteja ciclurile de viață ale microcontrolerului. Salvarea permanentă are loc strict în momentul părăsirii meniului prin apăsarea lungă de 2 secunde a butonului <strong>SET</strong>.
              </p>
            </div>
          </div>
        </div>

      </main>

      <Footer />
    </div>
  );
}