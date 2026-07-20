// app/products/page.tsx
"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const hardwareConfigs = {
  solo: {
    id: "solo",
    badge: "Solo Configuration",
    name: "i-volution Right Hand",
    price: "$949.90",
    description: "Professional-grade right-hand MIDI integration tailored for flawless solo melodic control.",
    specs: { display: "1.8' OLED HUD", filter: "EMA Digital Filter", latency: "Ultra-low", channels: "01 - 05" },
    hotspots: [
      { top: "25%", left: "40%", title: "OLED Display", desc: "1.8 inch micro-HUD displaying active register parameters dynamically." },
      { top: "45%", left: "65%", title: "SysEx Core", desc: "General MIDI transpose framework compatible with KORG PA series." },
      { top: "70%", left: "30%", title: "Power Management", desc: "TPS63061 PM micro-chip architecture ensuring long battery lifecycle thresholds." }
    ]
  },
  bass: {
    id: "bass",
    badge: "Orchestral Master",
    name: "i-volution Full Bass (R+L)",
    price: "$1299.90",
    description: "The complete hardware ecosystem synchronizing both right-hand keys and left-hand bass modules.",
    specs: { display: "1.8' OLED HUD", filter: "EMA Advanced Model", latency: "Sub-1.8ms IO", channels: "01 - 09" },
    hotspots: [
      { top: "25%", left: "40%", title: "OLED Display", desc: "Integrated multi-functional digital encoder interface." },
      { top: "50%", left: "75%", title: "Bass Decoupler", desc: "Independent tactile nodes mapped for traditional multi-channel chords." },
      { top: "35%", left: "20%", title: "Bank Storage", desc: "Bank Select A, B, C, D capable of locking down up to 11x127 memory states." }
    ]
  }
};

export default function IvolutionConfiguratorPage() {
  const [currentTier, setCurrentTier] = useState<"solo" | "bass">("solo");
  const [hoveredHotspot, setHoveredHotspot] = useState<{ title: string; desc: string } | null>(null);
  const data = hardwareConfigs[currentTier];

  return (
    <div className="bg-[#FAF9F6] text-[#09090B] min-h-screen flex flex-col font-mono selection:bg-orange-500/10 overflow-x-hidden">
      
      {/* Meniul premium integrat */}
      <Navbar />

      {/* CONTINUT CENTRAL CONFIGURATOR */}
      <main className="flex-grow w-full max-w-6xl mx-auto px-4 sm:px-6 py-12 md:py-20 flex flex-col lg:flex-row gap-8 items-stretch">
        
        {/* PARTEA STÂNGA: VIZUALIZATORUL 3D SIMULAT (Zona Auto-Style Showcase) */}
        <div className="flex-1 bg-white border border-zinc-200/80 rounded-3xl p-6 relative flex flex-col justify-between overflow-hidden shadow-[0_4px_30px_rgba(0,0,0,0.01)] min-h-[400px] lg:min-h-[550px]">
          
          {/* Telemetrie vizuală */}
          <div className="flex justify-between items-center text-[10px] text-zinc-400 relative z-20">
            <span>[ VIEW_SHAPE // STAGE_RENDER ]</span>
            <span className="text-orange-600 bg-orange-500/5 px-2 py-0.5 border border-orange-500/10 rounded">{data.specs.channels}</span>
          </div>

          {/* SIMULATOR RANDARE VECTORIALĂ HARDWARE (Baza vizuală centrală) */}
          <div className="my-auto w-full max-w-md mx-auto aspect-video relative flex items-center justify-center group/hardware">
            
            {/* Glow de fundal reactiv în funcție de pachet */}
            <div className={`absolute w-64 h-64 rounded-full blur-[80px] opacity-30 transition-all duration-700 pointer-events-none ${currentTier === 'solo' ? 'bg-orange-500' : 'bg-fuchsia-500'}`} />

            {/* Circuitul structural desenat prin CSS pur */}
            <div className="w-full h-24 border border-zinc-200 rounded-xl bg-zinc-50/50 relative shadow-inner p-4 flex items-center justify-between transition-all duration-500 group-hover/hardware:border-zinc-400">
              <div className="w-10 h-10 border border-zinc-300 rounded bg-white flex items-center justify-center text-[9px] text-zinc-400">OLED</div>
              <div className="flex-1 px-4 space-y-2">
                <div className="h-[2px] bg-zinc-200 w-full" />
                <div className="h-[2px] bg-zinc-200 w-3/4" />
              </div>
              <div className="w-8 h-8 rounded-full border border-zinc-300 bg-white" />
            </div>

            {/* PLASAREA PUNCTELOR INTERACTIVE (Hotspots) DIRECT PE IMAGINE */}
            {data.hotspots.map((spot, i) => (
              <div
                key={i}
                style={{ top: spot.top, left: spot.left }}
                onMouseEnter={() => setHoveredHotspot({ title: spot.title, desc: spot.desc })}
                onMouseLeave={() => setHoveredHotspot(null)}
                className="absolute w-5 h-5 flex items-center justify-center cursor-pointer z-30 group/node"
              >
                <span className="absolute w-full h-full rounded-full bg-orange-500/20 animate-ping group-hover/node:scale-120 transition-transform" />
                <span className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,1)] transition-transform group-hover/node:scale-150" />
              </div>
            ))}
          </div>

          {/* CASUTA TEXT DINAMICĂ PENTRU DETALII LA HOVER PE INFOPANOU */}
          <div className="h-16 border-t border-zinc-100 pt-3 text-left transition-all duration-300">
            {hoveredHotspot ? (
              <div className="animate-fade-in space-y-0.5">
                <div className="text-[11px] font-bold text-orange-600 uppercase">// {hoveredHotspot.title}</div>
                <p className="text-[11px] text-zinc-500 font-sans font-light leading-tight">{hoveredHotspot.desc}</p>
              </div>
            ) : (
              <div className="text-[10px] text-zinc-400 italic font-sans flex items-center gap-2">
                <span className="w-1 h-1 bg-zinc-400 rounded-full animate-pulse" />
                Hover over the interactive core hotspots to examine architectural hardware specifications.
              </div>
            )}
          </div>
        </div>

        {/* PARTEA DREAPTĂ: CONSOLA DE CONFIGURARE (Stil Porsche Selector Panel) */}
        <div className="w-full lg:w-[360px] bg-white border border-zinc-200/80 rounded-3xl p-6 flex flex-col justify-between text-left space-y-8 shadow-[0_4px_30px_rgba(0,0,0,0.01)]">
          <div className="space-y-6">
            <div className="space-y-1">
              <span className="text-[9px] text-orange-600 bg-orange-500/5 px-2.5 py-0.5 rounded-full border border-orange-500/10 font-bold tracking-wider uppercase">{data.badge}</span>
              <h2 className="text-2xl font-light text-zinc-900 tracking-tight pt-2">{data.name}</h2>
              <div className="text-xl font-bold text-orange-600 font-sans tracking-tight pt-1">{data.price}</div>
            </div>

            <p className="text-xs font-sans font-light text-zinc-500 leading-relaxed border-t border-zinc-100 pt-4">
              {data.description}
            </p>

            {/* SELETOARE TIP BUTOANE CAR CONFIGURATOR */}
            <div className="space-y-2.5 pt-2">
              <span className="text-[10px] text-zinc-400 tracking-widest block font-bold">SELECT HARDWARE PACKAGE</span>
              
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setCurrentTier("solo")}
                  className={`h-11 rounded-xl border text-[11px] font-bold tracking-wide transition-all uppercase ${
                    currentTier === "solo"
                      ? "border-orange-500 bg-orange-500/[0.01] text-orange-600 shadow-[inset_0_1px_0_rgba(249,115,22,0.05)]"
                      : "border-zinc-200 text-zinc-500 hover:border-zinc-400 hover:text-zinc-800"
                  }`}
                >
                  Solo Tier
                </button>
                <button
                  onClick={() => setCurrentTier("bass")}
                  className={`h-11 rounded-xl border text-[11px] font-bold tracking-wide transition-all uppercase ${
                    currentTier === "bass"
                      ? "border-orange-500 bg-orange-500/[0.01] text-orange-600 shadow-[inset_0_1px_0_rgba(249,115,22,0.05)]"
                      : "border-zinc-200 text-zinc-500 hover:border-zinc-400 hover:text-zinc-800"
                  }`}
                >
                  Full Bass
                </button>
              </div>
            </div>

            {/* MATRICE SPECIFICATII REALE TEHNICE SPECIFICE MODELULUI ACTIVE */}
            <div className="space-y-2 border-t border-zinc-100 pt-4 font-sans text-xs text-zinc-500">
              <div className="flex justify-between border-b border-zinc-50 pb-1.5">
                <span className="font-mono text-[10px] text-zinc-400">INTERFACE</span>
                <span className="text-zinc-800 font-light">{data.specs.display}</span>
              </div>
              <div className="flex justify-between border-b border-zinc-50 pb-1.5">
                <span className="font-mono text-[10px] text-zinc-400">BELLOWS FILTER</span>
                <span className="text-zinc-800 font-light">{data.specs.filter}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-mono text-[10px] text-zinc-400">PERFORMANCE IO</span>
                <span className="text-zinc-800 font-light">{data.specs.latency}</span>
              </div>
            </div>
          </div>

          {/* CTA FINAL SECURED - ORDER TRANSMIT BUTTON */}
          <button className="w-full h-12 bg-zinc-950 text-white font-sans font-medium text-xs tracking-widest uppercase rounded-xl transition-all duration-300 hover:bg-orange-500 shadow-[0_4px_16px_rgba(0,0,0,0.08)] active:scale-[0.98]">
            Contact Us to Order
          </button>
        </div>

      </main>

      {/* Footer-ul tău curat pe linii */}
      <Footer />
    </div>
  );
}
