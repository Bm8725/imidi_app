// app/hmi40/page.tsx
"use client";
import { useState, useEffect, useRef } from "react";

// Importuri oficiale corecte pentru Siemens iX Versiunea 5.x
import "@siemens/ix/dist/siemens-ix/siemens-ix.css";

/* ---------- Ipoteze simulare (editabile) ---------- */
const RAW_PER_CLINKER = 1.58;       // t făină crudă / t clincher
const PROCESS_CO2 = 525;            // kg CO2 / t clincher (calcinare)
const FOSSIL_EF = 95;               // kg CO2 / GJ (cărbune / petcoke)
const AF_EF = 75;                   // kg CO2 / GJ (RDF, fracția fosilă)
const AF_BIO = 0.4;                 // fracția biogenă a combustibilului alternativ (0 emisii)
const GRID_EF = 0.27;               // kg CO2 / kWh (mix rețea, valoare orientativă)
const ELEC = { kiln: 32, raw: 26, cem: 45, aux: 10 }; // kWh / t clincher

type Sim = {
  temp: number; vib: number; risc: number;
  clk: number;            // t/h clincher
  qTh: number;            // MJ/t clincher
  kWhT: number;           // kWh/t clincher
  co2T: number;           // kg CO2 / t clincher
  pKw: number;            // kW putere electrică
  cumClk: number; cumGJ: number; cumMWh: number; cumCO2: number;
  histCO2: number[]; histQ: number[];
};

const init: Sim = {
  temp: 1420, vib: 2.4, risc: 12, clk: 76, qTh: 3450, kWhT: 113, co2T: 880, pKw: 8600,
  cumClk: 0, cumGJ: 0, cumMWh: 0, cumCO2: 0, histCO2: [], histQ: [],
};

function Spark({ data, color, min, max }: { data: number[]; color: string; min: number; max: number }) {
  const w = 220, h = 44;
  const pts = data.map((v, i) => {
    const x = (i / Math.max(1, 59)) * w;
    const y = h - ((Math.min(max, Math.max(min, v)) - min) / (max - min)) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-11 bg-black border border-[#808080]">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  );
}

const fmt = (n: number, d = 0) => n.toLocaleString("ro-RO", { minimumFractionDigits: d, maximumFractionDigits: d });

export default function SiemensUnifiedHMI() {
  const [isAnomalie, setIsAnomalie] = useState(false);
  const [feed, setFeed] = useState(120);       // t/h făină crudă
  const [af, setAf] = useState(30);            // % substituție termică
  const [speed, setSpeed] = useState(60);      // 1 s real = X s simulate
  const [v, setV] = useState<Sim>(init);
  const [fs, setFs] = useState(false);
  const [tab, setTab] = useState<"core" | "kiln" | "ai">("core");
  const [ets, setEts] = useState(70);          // €/t CO2
  const [target, setTarget] = useState(850);   // kg CO2/t clincher
  const p = useRef({ isAnomalie, feed, af, speed });
  p.current = { isAnomalie, feed, af, speed };

  useEffect(() => {
    const id = setInterval(() => {
      const { isAnomalie: an, feed: F, af: s, speed: sp } = p.current;
      setV(o => {
        const effFeed = an ? F * 0.35 : F;
        const clk = effFeed / RAW_PER_CLINKER;
        // consum termic specific: scade eficiența la sarcină mică și la avarie
        const qTh = (3450 + (120 - effFeed) * 6 + s * 2.2) * (an ? 1.18 : 1) + (Math.random() - 0.5) * 20;
        const perT = ELEC.kiln + ELEC.raw + ELEC.cem + ELEC.aux;
        const kWhT = perT * (an ? 1.25 : 1) + (Math.random() - 0.5) * 1.5;
        const gj = qTh / 1000;
        const fuelCO2 = gj * (1 - s / 100) * FOSSIL_EF + gj * (s / 100) * (1 - AF_BIO) * AF_EF;
        const co2T = PROCESS_CO2 + fuelCO2 + kWhT * GRID_EF;
        const dtH = sp / 3600;
        const tClk = clk * dtH;
        const hc = [...o.histCO2, co2T].slice(-60);
        const hq = [...o.histQ, qTh].slice(-60);
        return {
          temp: Math.round(1420 + (Math.random() - 0.5) * 4 + (an ? 150 : 0)),
          vib: Math.round((2.4 + (Math.random() - 0.5) * 0.2 + (an ? 3.8 : 0)) * 10) / 10,
          risc: an ? 95 : Math.min(85, o.risc + 0.1),
          clk, qTh, kWhT, co2T, pKw: kWhT * clk,
          cumClk: o.cumClk + tClk,
          cumGJ: o.cumGJ + gj * tClk,
          cumMWh: o.cumMWh + (kWhT * tClk) / 1000,
          cumCO2: o.cumCO2 + (co2T * tClk) / 1000,
          histCO2: hc, histQ: hq,
        };
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const toggleFS = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().then(() => setFs(true));
    else { document.exitFullscreen(); setFs(false); }
  };

  const gj = v.qTh / 1000;
  const gap = v.co2T - target;
  const perPct = gj * (FOSSIL_EF - (1 - AF_BIO) * AF_EF) / 100;      // kg CO2/t per 1% AF
  const needPct = gap > 0 ? Math.ceil(gap / perPct) : 0;
  const reachable = af + needPct <= 80;
  const costHour = (v.co2T * v.clk / 1000) * ets;                    // €/h
  const costT = (v.co2T / 1000) * ets;                               // €/t clincher
  const save10 = perPct * 10 * v.clk / 1000 * ets;                   // €/h la +10% AF
  // ---- Cuptor rotativ: valori derivate ----
  const rpm = (1.8 + (feed / 140) * 1.6) * (isAnomalie ? 0.55 : 1);
  const torque = 62 + (v.vib - 2.4) * 4 + (isAnomalie ? 18 : 0);
  const amps = torque * 4.6;
  const driveKw = 260 * (rpm / 3.4) * (torque / 62);
  const shellT = 285 + (v.temp - 1420) * 0.6;
  const dT = isAnomalie ? 25 : 0;
  const cyc = [340, 480, 640, 780, 880].map(t => t + dT);
  const o2 = isAnomalie ? 1.6 : 3.2;
  const co = isAnomalie ? 620 : 140;
  const nox = Math.round(420 + (v.temp - 1420) * 1.1 - af * 0.8);
  const so2 = Math.round(90 + af * 0.6);
  const noxHigh = nox > 500;
  const theo = 1750;
  const loss = Math.max(0, v.qTh - theo);
  const heat = [
    { l: "Formare clincher (teoretic)", mj: theo, c: "#2D6A4F" },
    { l: "Gaze evacuate preîncălzitor", mj: loss * 0.42, c: "#C55A11" },
    { l: "Aer evacuat răcitor", mj: loss * 0.25, c: "#2E75B6" },
    { l: "Radiație manta", mj: loss * 0.14, c: "#7F7F7F" },
    { l: "Praf și alte pierderi", mj: loss * 0.19, c: "#A0A0A0" },
  ];
  const kpiBg = isAnomalie ? "bg-[#FFD2D2] border-[#FF0000]" : "bg-[#E2F0D9] border-[#70AD47]";
  const co2Fuel = (v.qTh / 1000) * (1 - af / 100) * FOSSIL_EF + (v.qTh / 1000) * (af / 100) * (1 - AF_BIO) * AF_EF;
  const co2Elec = v.kWhT * GRID_EF;
  const parts = [
    { l: "Calcinare (proces)", val: PROCESS_CO2, c: "#4A5A6A" },
    { l: "Combustibil", val: co2Fuel, c: "#C55A11" },
    { l: "Energie electrică", val: co2Elec, c: "#2E75B6" },
  ];
  const tot = parts.reduce((a, b) => a + b.val, 0);
  const elecParts = [
    { l: "Moară ciment", k: ELEC.cem }, { l: "Cuptor + ventilatoare", k: ELEC.kiln },
    { l: "Moară crudă", k: ELEC.raw }, { l: "Auxiliare", k: ELEC.aux },
  ];

  return (
    <main className="min-h-screen bg-[#DCDCDC] text-[#2D2D2D] p-2 md:p-4 font-mono select-none flex flex-col justify-between border-2 md:border-4 border-[#B0B0B0]"
      data-ix-theme="siemens"
      data-ix-color-schema="dark"
    >
      <header className="bg-[#1C2630] text-white p-2 flex flex-col sm:flex-row justify-between items-center gap-2 border-b-2 border-[#0E1318] shadow-md">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="text-xs font-black bg-[#00FFCC] text-[#1C2630] px-2 py-0.5 rounded">SIEMENS iX</div>
          <h1 className="text-[11px] font-bold uppercase text-slate-200 flex items-center gap-2">
            <svg className="w-4 h-4 text-[#00FFCC] inline animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            Cloud purpose HMI • Cement industry 4.0
          </h1>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button onClick={toggleFS} className="bg-[#2D3C4C] hover:bg-[#3D4C5C] border border-[#4C5C6C] px-2 py-1 text-[11px]">
            {fs ? "IEȘIRE FULLSCREEN" : "COMPLET FULLSCREEN"}
          </button>
          <button onClick={() => setIsAnomalie(!isAnomalie)}
            className={`px-3 py-1 text-[11px] font-bold border transition-all ${isAnomalie ? "bg-[#FF0000] border-[#990000] animate-pulse" : "bg-[#2D6A4F] border-[#1B4332] hover:bg-[#40916C]"}`}>
            {isAnomalie ? "⚠ SYSTEM FAULT" : "✓ PLC ONLINE"}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-2 mt-2 flex-grow">
        {/* Parametri de proces */}
        <aside className="bg-[#C6C6C6] border border-[#A0A0A0] p-3 flex flex-col gap-4 text-[11px]">
          <div className="flex flex-row lg:flex-col gap-1">
            <button onClick={() => setTab("core")} className={`flex-1 text-xs p-2 font-bold text-left whitespace-nowrap ${tab === "core" ? "bg-[#B8B8B8] border-b-2 border-r-2 border-[#808080]" : "bg-[#CECECE] border border-[#A0A0A0]"}`}>📂 CORE OVERVIEW</button>
            <button onClick={() => setTab("kiln")} className={`flex-1 text-xs p-2 font-bold text-left whitespace-nowrap ${tab === "kiln" ? "bg-[#B8B8B8] border-b-2 border-r-2 border-[#808080]" : "bg-[#CECECE] border border-[#A0A0A0]"}`}>⚙ KILN DRIVE</button>
            <button onClick={() => setTab("ai")} className={`flex-1 text-xs p-2 font-bold text-left whitespace-nowrap ${tab === "ai" ? "bg-[#B8B8B8] border-b-2 border-r-2 border-[#808080]" : "bg-[#CECECE] border border-[#A0A0A0]"}`}>🧠 AI ANALYTICS</button>
          </div>
          <div className="font-bold border-b border-[#A0A0A0] pb-1">PARAMETRI SIMULARE</div>
          <label className="block">Alimentare făină crudă: <b>{feed} t/h</b>
            <input type="range" min={80} max={140} value={feed} onChange={e => setFeed(+e.target.value)} className="w-full accent-[#1C2630]" />
          </label>
          <label className="block">Combustibil alternativ: <b>{af} %</b>
            <input type="range" min={0} max={80} value={af} onChange={e => setAf(+e.target.value)} className="w-full accent-[#2D6A4F]" />
          </label>
          <div>
            <div className="mb-1">Viteză timp simulat</div>
            <div className="flex gap-1">
              {[1, 60, 600].map(x => (
                <button key={x} onClick={() => setSpeed(x)}
                  className={`flex-1 border py-1 ${speed === x ? "bg-[#1C2630] text-white border-[#0E1318]" : "bg-[#CECECE] border-[#A0A0A0]"}`}>
                  {x === 1 ? "1×" : x === 60 ? "1 min/s" : "10 min/s"}
                </button>
              ))}
            </div>
          </div>
          <div className="text-[9px] text-slate-600 leading-relaxed border-t border-[#A0A0A0] pt-2">
            Ipoteze: calcinare {PROCESS_CO2} kg/t clincher; cărbune {FOSSIL_EF} kg/GJ; RDF {AF_EF} kg/GJ cu {AF_BIO * 100}% biogen; rețea {GRID_EF} kg/kWh. Valori orientative, nu date reale de fabrică.
          </div>
        </aside>

        <section className="lg:col-span-3 flex flex-col gap-2">
          {tab === "core" ? (<>
          {/* INDICATORI MANAGEMENT */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
            <div className="bg-[#F0F0F0] border border-[#B0B0B0] p-3 shadow-inner">
              <span className="text-slate-500 block uppercase font-bold text-[9px] border-b pb-1 border-slate-300">OEE STATS</span>
              <span className="font-bold text-[#1C2630] text-xl block mt-1">{isAnomalie ? "64.2 %" : "88.4 %"}</span>
            </div>
            <div className="bg-[#F0F0F0] border border-[#B0B0B0] p-3 shadow-inner">
              <span className="text-slate-500 block uppercase font-bold text-[9px] border-b pb-1 border-slate-300">FEEDER RATE</span>
              <span className="font-bold text-[#1C2630] text-xl block mt-1">{fmt(isAnomalie ? feed * 0.35 : feed, 1)} t/h</span>
            </div>
            <div className={`p-3 border shadow-inner transition-colors duration-500 ${isAnomalie ? "bg-[#FFD2D2] border-[#FF0000]" : "bg-[#E2F0D9] border-[#70AD47]"}`}>
              <span className="text-slate-600 block uppercase font-bold text-[9px] border-b pb-1 border-slate-300/40">AI DEGRADATION RISK</span>
              <span className="font-bold text-lg block mt-1">{v.risc.toFixed(1)} %</span>
            </div>
          </div>

          {/* KPI ENERGIE / CO2 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            {[
              ["CLINCHER", `${fmt(v.clk, 1)} t/h`],
              ["ENERGIE TERMICĂ", `${fmt(v.qTh)} MJ/t`],
              ["ENERGIE ELECTRICĂ", `${fmt(v.kWhT, 1)} kWh/t`],
            ].map(([a, b]) => (
              <div key={a} className="bg-[#F0F0F0] border border-[#B0B0B0] p-3 shadow-inner">
                <span className="text-slate-500 block font-bold text-[9px] border-b pb-1 border-slate-300">{a}</span>
                <span className="font-bold text-[#1C2630] text-lg block mt-1">{b}</span>
              </div>
            ))}
            <div className={`p-3 border shadow-inner transition-colors duration-500 ${kpiBg}`}>
              <span className="text-slate-600 block font-bold text-[9px] border-b pb-1 border-slate-300/40">CO₂ SPECIFIC</span>
              <span className="font-bold text-lg block mt-1">{fmt(v.co2T)} kg/t</span>
            </div>
          </div>

          {/* Mimic central */}
          <div className="bg-[#F0F0F0] border border-[#B0B0B0] p-3">
            <div className="flex justify-between items-center border-b pb-1 text-[11px] font-bold">
              <span className="text-[#1C2630]">ZONĂ CALCINARE CUPTOR ROTATIV</span>
              <span className="text-[9px] bg-[#2D3C4C] px-1.5 py-0.5 text-white">PLC_NODE_04</span>
            </div>
            <div className="my-2 bg-black text-[#00FF00] p-3 rounded border-2 border-[#808080] grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>TEMP<span className={`text-2xl font-black block ${isAnomalie ? "text-[#FF0000]" : "text-[#00FF00]"}`}>{v.temp} °C</span></div>
              <div>VIBRAȚII<span className="text-2xl font-black block text-[#FFFF00]">{v.vib.toFixed(1)} mm/s</span></div>
              <div>PUTERE EL.<span className="text-2xl font-black block text-[#00CCFF]">{fmt(v.pKw / 1000, 2)} MW</span></div>
              <div>RISC AI<span className="text-2xl font-black block">{v.risc.toFixed(1)} %</span></div>
            </div>
            <div className="text-[10px] text-slate-500 flex justify-between border-t pt-1">
              <span>Primary Air Fan: 420 m³/h</span>
              <span>Alternative Fuel Link: {af}%</span>
            </div>
          </div>

          {/* Emisii + tendințe */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px]">
            <div className="bg-[#F0F0F0] border border-[#B0B0B0] p-3">
              <h2 className="font-bold text-[#1C2630] mb-2">DEFALCARE CO₂ (kg / t clincher)</h2>
              <div className="flex h-5 border border-[#808080] mb-2">
                {parts.map(x => <div key={x.l} style={{ width: `${(x.val / tot) * 100}%`, background: x.c }} />)}
              </div>
              {parts.map(x => (
                <div key={x.l} className="flex justify-between py-0.5">
                  <span><i className="inline-block w-2 h-2 mr-1" style={{ background: x.c }} />{x.l}</span><b>{fmt(x.val)}</b>
                </div>
              ))}
              <div className="flex justify-between border-t mt-1 pt-1 font-bold"><span>Total</span><span>{fmt(tot)}</span></div>
            </div>
            <div className="bg-[#F0F0F0] border border-[#B0B0B0] p-3">
              <h2 className="font-bold text-[#1C2630] mb-2">CONSUM ELECTRIC SPECIFIC (kWh / t)</h2>
              {elecParts.map(x => (
                <div key={x.l} className="mb-1">
                  <div className="flex justify-between"><span>{x.l}</span><b>{fmt(x.k * (isAnomalie ? 1.25 : 1), 1)}</b></div>
                  <div className="h-1.5 bg-[#CECECE]"><div className="h-full bg-[#2E75B6]" style={{ width: `${(x.k / 50) * 100}%` }} /></div>
                </div>
              ))}
            </div>
            <div className="bg-[#F0F0F0] border border-[#B0B0B0] p-3">
              <h2 className="font-bold text-[#1C2630] mb-1">TREND CO₂ SPECIFIC (60 s)</h2>
              <Spark data={v.histCO2} color="#FF9900" min={750} max={1100} />
            </div>
            <div className="bg-[#F0F0F0] border border-[#B0B0B0] p-3">
              <h2 className="font-bold text-[#1C2630] mb-1">TREND ENERGIE TERMICĂ (60 s)</h2>
              <Spark data={v.histQ} color="#00FF00" min={3200} max={4600} />
            </div>
          </div>

          </>) : tab === "kiln" ? (
          <>
            {/* KILN DRIVE + CUPTOR ROTATIV */}
            <div className="bg-[#F0F0F0] border border-[#B0B0B0] p-3">
              <div className="flex justify-between items-center border-b pb-1 text-[11px] font-bold">
                <span className="text-[#1C2630]">LINIE CUPTOR ROTATIV • PREÎNCĂLZITOR → CUPTOR → RĂCITOR</span>
                <span className="text-[9px] bg-[#2D3C4C] px-1.5 py-0.5 text-white">{fmt(rpm, 2)} rot/min</span>
              </div>
              <svg viewBox="0 0 700 220" className="w-full h-auto mt-2" fontFamily="monospace">
                <defs>
                  <linearGradient id="kg" x1="0" x2="1">
                    <stop offset="0" stopColor="#8a4b12" /><stop offset="0.45" stopColor="#c55a11" />
                    <stop offset="0.8" stopColor="#ff9900" /><stop offset="1" stopColor={isAnomalie ? "#ff3300" : "#ffd24d"} />
                  </linearGradient>
                  <pattern id="kr" width="430" height="12" patternUnits="userSpaceOnUse">
                    <rect width="430" height="4" fill="rgba(0,0,0,0.28)" />
                    <animateTransform attributeName="patternTransform" type="translate" from="0 0" to="0 12" dur={`${(60 / rpm / 5).toFixed(2)}s`} repeatCount="indefinite" />
                  </pattern>
                </defs>
                {/* preîncălzitor cu 5 trepte */}
                {cyc.map((t, i) => (
                  <g key={i}>
                    <rect x="30" y={14 + i * 34} width="100" height="28" rx="4" fill="#DCE3EA" stroke="#4A5A6A" />
                    <text x="38" y={32 + i * 34} fontSize="10" fill="#1C2630">C{i + 1}</text>
                    <text x="122" y={32 + i * 34} fontSize="10" fill={t > 900 ? "#C00000" : "#1C2630"} textAnchor="end">{t} °C</text>
                  </g>
                ))}
                <text x="80" y="200" fontSize="9" fill="#4A5A6A" textAnchor="middle">Preîncălzitor + calcinator</text>
                <path d="M130 158 L165 158" stroke="#4A5A6A" strokeWidth="3" />
                {/* tub cuptor înclinat */}
                <g transform="rotate(2.5 400 148)">
                  <rect x="160" y="126" width="430" height="44" rx="6" fill="url(#kg)" stroke="#2D2D2D" />
                  <rect x="160" y="126" width="430" height="44" rx="6" fill="url(#kr)" />
                  {[250, 400, 520].map(x => <rect key={x} x={x} y="120" width="12" height="56" fill="#4A5A6A" stroke="#1C2630" />)}
                  <rect x="325" y="118" width="26" height="60" fill="#2D3C4C" stroke="#0E1318" />
                  <text x="338" y="152" fontSize="10" fill="#fff" textAnchor="middle">M</text>
                  {/* flacără */}
                  <polygon points="588,148 520,136 470,148 520,160" fill={isAnomalie ? "#ff2200" : "#ffb020"} opacity="0.85">
                    <animate attributeName="opacity" values="0.6;1;0.75;1" dur="0.5s" repeatCount="indefinite" />
                  </polygon>
                </g>
                {/* răcitor */}
                <rect x="592" y="150" width="96" height="46" rx="4" fill="#DCE3EA" stroke="#4A5A6A" />
                <text x="640" y="170" fontSize="10" fill="#1C2630" textAnchor="middle">Răcitor cu grătar</text>
                <text x="640" y="186" fontSize="10" fill="#2E75B6" textAnchor="middle">120 °C ieșire</text>
                {/* zone */}
                <text x="200" y="100" fontSize="10" fill="#1C2630">Calcinare</text>
                <text x="200" y="112" fontSize="10" fill="#4A5A6A">≈ 900 °C</text>
                <text x="330" y="100" fontSize="10" fill="#1C2630">Tranziție</text>
                <text x="330" y="112" fontSize="10" fill="#4A5A6A">≈ 1150 °C</text>
                <text x="460" y="100" fontSize="10" fill="#1C2630">Sinterizare</text>
                <text x="460" y="112" fontSize="10" fill={isAnomalie ? "#C00000" : "#4A5A6A"}>{v.temp} °C</text>
                <text x="350" y="212" fontSize="9" fill="#4A5A6A" textAnchor="middle">{fmt(v.clk, 1)} t/h clincher • {af}% combustibil alternativ la arzător</text>
              </svg>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              {[
                ["TURAȚIE CUPTOR", `${fmt(rpm, 2)} rot/min`, false],
                ["CUPLU ANTRENARE", `${fmt(torque)} %`, torque > 85],
                ["CURENT MOTOR", `${fmt(amps)} A`, torque > 85],
                ["TEMP MANTA", `${fmt(shellT)} °C`, shellT > 350],
              ].map(([a, b, bad]) => (
                <div key={a as string} className={`p-3 border shadow-inner ${bad ? "bg-[#FFD2D2] border-[#FF0000]" : "bg-[#F0F0F0] border-[#B0B0B0]"}`}>
                  <span className="text-slate-500 block font-bold text-[9px] border-b pb-1 border-slate-300">{a}</span>
                  <span className="font-bold text-[#1C2630] text-lg block mt-1">{b}</span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px]">
              <div className="bg-[#F0F0F0] border border-[#B0B0B0] p-3">
                <h2 className="font-bold text-[#1C2630] mb-2">BILANȚ TERMIC (MJ / t clincher)</h2>
                {heat.map(x => (
                  <div key={x.l} className="mb-1">
                    <div className="flex justify-between"><span>{x.l}</span><b>{fmt(x.mj)}</b></div>
                    <div className="h-1.5 bg-[#CECECE]"><div className="h-full" style={{ width: `${(x.mj / v.qTh) * 100}%`, background: x.c }} /></div>
                  </div>
                ))}
                <div className="flex justify-between border-t mt-1 pt-1 font-bold"><span>Eficiență termică</span><span>{fmt((theo / v.qTh) * 100, 1)} %</span></div>
              </div>
              <div className="bg-[#F0F0F0] border border-[#B0B0B0] p-3">
                <h2 className="font-bold text-[#1C2630] mb-2">ANALIZĂ GAZE ȘI EMISII (coș)</h2>
                {[
                  ["O₂", `${o2.toFixed(1)} %`, o2 < 2],
                  ["CO", `${co} ppm`, co > 500],
                  ["NOx", `${nox} mg/Nm³ (lim. 500)`, noxHigh],
                  ["SO₂", `${so2} mg/Nm³`, false],
                  ["Putere antrenare", `${fmt(driveKw)} kW`, false],
                ].map(([a, b, bad]) => (
                  <div key={a as string} className={`flex justify-between py-1 border-b border-slate-300 ${bad ? "text-[#9C0006] font-bold" : ""}`}>
                    <span>{a}</span><span>{b}</span>
                  </div>
                ))}
              </div>
            </div>
          </>) : (
          <>
            {/* AI ANALYTICS */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <div className="bg-[#F0F0F0] border border-[#B0B0B0] p-3 shadow-inner">
                <span className="text-slate-500 block font-bold text-[9px] border-b pb-1 border-slate-300">COST CO₂ / ORĂ</span>
                <span className="font-bold text-[#1C2630] text-lg block mt-1">{fmt(costHour)} €/h</span>
              </div>
              <div className="bg-[#F0F0F0] border border-[#B0B0B0] p-3 shadow-inner">
                <span className="text-slate-500 block font-bold text-[9px] border-b pb-1 border-slate-300">COST CO₂ / t CLINCHER</span>
                <span className="font-bold text-[#1C2630] text-lg block mt-1">{fmt(costT, 1)} €/t</span>
              </div>
              <div className="bg-[#F0F0F0] border border-[#B0B0B0] p-3 shadow-inner">
                <span className="text-slate-500 block font-bold text-[9px] border-b pb-1 border-slate-300">COST ACUMULAT</span>
                <span className="font-bold text-[#1C2630] text-lg block mt-1">{fmt(v.cumCO2 * ets)} €</span>
              </div>
              <div className={`p-3 border shadow-inner transition-colors duration-500 ${gap > 0  ? "bg-[#FFD2D2] border-[#FF0000]" : "bg-[#E2F0D9] border-[#70AD47]"}`}>
                <span className="text-slate-600 block font-bold text-[9px] border-b pb-1 border-slate-300/40">FAȚĂ DE OBIECTIV</span>
                <span className="font-bold text-lg block mt-1">{gap > 0 ? "+" : ""}{fmt(gap)} kg/t</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px]">
              <div className="bg-[#F0F0F0] border border-[#B0B0B0] p-3 space-y-3">
                <h2 className="font-bold text-[#1C2630]">TINTE ȘI PREȚ</h2>
                <label className="block">Obiectiv CO₂ specific: <b>{target} kg/t</b>
                  <input type="range" min={700} max={1000} step={5} value={target} onChange={e => setTarget(+e.target.value)} className="w-full accent-[#2D6A4F]" />
                </label>
                <label className="block">Preț certificat EU ETS: <b>{ets} €/t CO₂</b>
                  <input type="range" min={30} max={150} value={ets} onChange={e => setEts(+e.target.value)} className="w-full accent-[#1C2630]" />
                </label>
                <div>
                  <div className="flex justify-between mb-1"><span>Actual</span><b>{fmt(v.co2T)}</b></div>
                  <div className="relative h-3 bg-[#CECECE] border border-[#808080]">
                    <div className="h-full" style={{ width: `${Math.min(100, (v.co2T / 1200) * 100)}%`, background: gap > 0 ? "#C00000" : "#2D6A4F" }} />
                    <div className="absolute top-[-3px] h-[18px] w-0.5 bg-black" style={{ left: `${(target / 1200) * 100}%` }} />
                  </div>
                </div>
              </div>
              <div className="bg-[#F0F0F0] border border-[#B0B0B0] p-3">
                <h2 className="font-bold text-[#1C2630] mb-1">TREND CO₂ SPECIFIC (60 s)</h2>
                <Spark data={v.histCO2} color="#FF9900" min={750} max={1100} />
                <h2 className="font-bold text-[#1C2630] mt-3 mb-1">TREND ENERGIE TERMICĂ (60 s)</h2>
                <Spark data={v.histQ} color="#00FF00" min={3200} max={4600} />
              </div>
            </div>

            <div className="bg-[#1C2630] text-white border border-[#0E1318] p-3 text-[11px] space-y-1.5">
              <h2 className="font-bold text-[#00FFCC]">RECOMANDĂRI AI (simulat)</h2>
              {isAnomalie && <div className="text-[#FF9999]">⚠ Avarie activă: consum termic +18%, cost suplimentar estimat ≈ {fmt(costHour - ((v.co2T / 1.12) * v.clk / 1000) * ets)} €/h. Prioritate: remediere cuptor.</div>}
              {gap <= 0
                ? <div>✓ Obiectivul de {target} kg/t este atins. Marjă: {fmt(-gap)} kg/t.</div>
                : reachable
                  ? <div>→ Crește combustibilul alternativ cu ~{needPct}% (la {af + needPct}%) pentru a atinge obiectivul.</div>
                  : <div>→ Obiectivul nu se atinge doar din combustibil alternativ (limită 80%). Reduce și consumul termic sau relaxează ținta.</div>}
              <div>+10% combustibil alternativ ≈ −{fmt(perPct * 10, 1)} kg CO₂/t și ≈ {fmt(save10)} €/h economie ETS.</div>
              <div>Risc degradare AI: {v.risc.toFixed(1)} % — {v.risc > 60 ? "programează inspecție rulmenți" : "în parametri normali"}.</div>
            </div>
          </>)}

          {/* Totalizatoare */}
          <div className="bg-[#1C2630] text-white border border-[#0E1318] p-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
            <div>Clincher produs<b className="block text-base text-[#00FFCC]">{fmt(v.cumClk, 1)} t</b></div>
            <div>Energie termică<b className="block text-base text-[#00FFCC]">{fmt(v.cumGJ, 1)} GJ</b></div>
            <div>Energie electrică<b className="block text-base text-[#00FFCC]">{fmt(v.cumMWh, 2)} MWh</b></div>
            <div>CO₂ emis<b className="block text-base text-[#FF9900]">{fmt(v.cumCO2, 2)} t</b></div>
          </div>

          {/* Alarme */}
          <div className="bg-[#F0F0F0] border border-[#B0B0B0] p-2 text-[10px]">
            <h2 className="font-bold uppercase mb-1 text-[#1C2630] flex items-center gap-1">
              <svg className="w-3.5 h-3.5 text-[#FF0000] inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              WinCC Unified Alarm Stack (Active Only)
            </h2>
            <div className="bg-white border border-[#A0A0A0] h-[75px] overflow-auto p-2">
              {isAnomalie ? (
                <div className="text-[#9C0006] font-bold space-y-1">
                  <div>[CRIT] ❌ TEMP OVER LIMIT LIMIT_HIGH_PRAG</div>
                  <div className="text-[#9C6500]">[WARN] ⚠ PREDICTIVE: BEARING WEAR OUT (AI CALC)</div>
                  <div className="text-[#9C6500]">[WARN] ⚠ ENERGY: SPECIFIC HEAT +18% / CO₂ ABOVE TARGET</div>
                  <div className="text-[#9C0006]">[CRIT] ❌ KILN DRIVE: TORQUE {fmt(torque)}% / SHELL {fmt(shellT)} °C</div>
                  {noxHigh && <div className="text-[#9C6500]">[WARN] ⚠ STACK: NOx {nox} mg/Nm³ OVER LIMIT</div>}
                </div>
              ) : co2Fuel + PROCESS_CO2 + co2Elec > 900 ? (
                <div className="text-[#9C6500]">[INFO] CO₂ specific peste 900 kg/t – crește combustibilul alternativ sau alimentarea.</div>
              ) : (
                <div className="text-slate-400 italic text-center pt-3">Zero active alarms. Continuous automation normal.</div>
              )}
            </div>
          </div>
        </section>
      </div>

      <footer className="mt-2 text-center text-[10px] text-slate-600">© {new Date().getFullYear()} BM — Toate drepturile rezervate. Simulare demonstrativă.</footer>
    </main>
  );
}