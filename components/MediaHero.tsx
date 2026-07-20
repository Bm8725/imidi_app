'use client';

import Link from "next/link";

// Concept: Interactive Isometric Live Sequencer Matrix (Launchpad / Grid Controller)
// Fără linii de scanare laser, cu pad-uri complet accesibile și interactive la click/touch.

const GLOW_PADS = Array.from({ length: 16 }, (_, i) => {
  // Coordonate deterministe pentru pad-urile active din show-ul live
  const row = (i * 3 + 1) % 6;
  const col = (i * 4 + 2) % 8;
  const delay = (i % 7) * 0.8;
  const duration = 2.5 + (i % 4) * 0.5;
  const colors = ["#E2861A", "#0B7285", "#6B4FA0", "#C77313"];
  const color = colors[i % colors.length];
  return { row, col, delay, duration, color };
});

export default function MediaHero() {
  // Funcție simplă pentru a simula un feedback vizual la apăsarea unui buton live
  const handlePadClick = (index: number) => {
    console.log(`MIDI Note Triggered: Pad ${index}`);
  };

  return (
    <div className="absolute inset-0 overflow-hidden bg-neutral-950 select-none">
      <style>{`
        @keyframes pad-pulse {
          0%, 100% { opacity: 0.15; filter: blur(1px); }
          45%, 55% { opacity: 0.9; filter: drop-shadow(0 0 14px var(--pad-color)); }
        }
        @keyframes ambient-wave {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-4%, 3%) scale(1.06); }
        }
        @keyframes hero-cta-glow {
          0%, 100% { box-shadow: 0 10px 26px -10px rgba(226,134,26,0.55); }
          50% { box-shadow: 0 14px 34px -8px rgba(11,114,133,0.55); }
        }
        .hero-cta-glow { animation: hero-cta-glow 3.5s ease-in-out infinite; }
      `}</style>

      {/* 1. Lumini de scenă dinamice în fundal (Cyber Glow) */}
      <div className="absolute inset-0 pointer-events-none opacity-40 z-0">
        <div className="animate-[ambient-wave_12s_ease-in-out_infinite] absolute -top-20 right-1/4 w-[500px] h-[500px] rounded-full bg-amber-600/10 blur-[130px]" />
        <div className="animate-[ambient-wave_15s_ease-in-out_infinite_alternate] absolute bottom-10 left-1/4 w-[600px] h-[600px] rounded-full bg-teal-600/10 blur-[160px]" style={{ animationDelay: "-4s" }} />
      </div>

      {/* 2. Transformarea Izometrică 3D a Consolei */}
      <div 
        className="absolute inset-0 flex items-center justify-center opacity-85 z-10"
        style={{
          transform: "perspective(1000px) rotateX(60deg) rotateZ(-20deg) translateY(-5%) scale(1.2)",
        }}
      >
        {/* Rețeaua principală de Sequencer */}
        <div 
          className="relative w-[140vw] h-[140vh] max-w-[1600px] max-h-[1600px] grid grid-cols-8 grid-rows-6 gap-3 sm:gap-5 p-6 rounded-3xl"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(226, 134, 26, 0.03) 2px, transparent 2px),
              linear-gradient(to bottom, rgba(11, 114, 133, 0.03) 2px, transparent 2px)
            `,
            backgroundSize: "12.5% 16.666%",
          }}
        >
          {/* TOATE PAD-URILE HARDWARE (Acum sunt elemente <button> interactive și accesibile) */}
          {Array.from({ length: 48 }).map((_, i) => {
            // Verificăm dacă acest pad are mapată o animație din lista GLOW_PADS
            const activePad = GLOW_PADS.find(p => (p.row * 8 + p.col) === i);

            return (
              <button 
                key={`pad-${i}`} 
                onClick={() => handlePadClick(i)}
                aria-label={`MIDI Pad ${i + 1}`}
                className="w-full h-full rounded-md sm:rounded-lg border border-white/[0.04] bg-neutral-900/30 backdrop-blur-[1px] 
                           shadow-[inset_0_1px_2px_rgba(255,255,255,0.02)] transition-all duration-150
                           hover:bg-neutral-800/50 hover:border-white/20 active:scale-95 active:bg-white/10
                           pointer-events-auto cursor-pointer relative overflow-hidden group focus:outline-none focus:border-amber-500/50"
              >
                {/* Stratul de animație live dacă pad-ul este unul activ în secvență */}
                {activePad && (
                  <div
                    className="absolute inset-0 opacity-20 pointer-events-none rounded-md sm:rounded-lg"
                    style={{
                      background: `radial-gradient(circle at center, ${activePad.color} 40%, ${activePad.color}11 100%)`,
                      animation: `pad-pulse ${activePad.duration}s ease-in-out infinite`,
                      animationDelay: `${activePad.delay}s`,
                      '--pad-color': activePad.color,
                    } as React.CSSProperties}
                  />
                )}
                
                {/* Micro-glow la hover pe butoane */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-tr from-amber-500/5 to-teal-500/5 transition-opacity pointer-events-none" />
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Filtre de integrare ambientale plasate în fundal (Z-0) sau cu click-through activat */}
      {/* Folosim pointer-events-none ca să nu blocheze interacțiunea cu butoanele de dedesubt */}
      <div className="absolute inset-0 pointer-events-none z-20">
        <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-neutral-950 via-neutral-950/70 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-neutral-950 via-neutral-950/60 to-transparent" />
        <div className="absolute inset-y-0 left-0 w-24 sm:w-48 bg-gradient-to-r from-neutral-950 to-transparent" />
        <div className="absolute inset-y-0 right-0 w-24 sm:w-48 bg-gradient-to-l from-neutral-950 to-transparent" />
      </div>

      {/* 4. CTA-uri live — TS4X (SOLO) și i-volution (BASS), ancorate peste grid */}
      <div className="absolute inset-x-0 bottom-10 sm:bottom-14 z-30 flex flex-col sm:flex-row justify-center items-center gap-4 sm:gap-6 px-5 pointer-events-auto">
        <Link
          href="/ts4x"
          className="hero-cta-glow w-full sm:w-auto h-12 inline-flex items-center justify-center bg-[#E2861A] text-white font-medium text-sm px-8 rounded-full transition-all duration-300 hover:bg-[#C77313] hover:scale-[1.02] active:scale-[0.99]"
        >
          TS4X Application
        </Link>
        <Link
          href="/products"
          className="w-full sm:w-auto h-12 inline-flex items-center justify-center border border-teal-400/40 bg-white/5 backdrop-blur-sm text-teal-300 font-medium text-sm px-8 rounded-full transition-all duration-300 hover:bg-teal-500/10 hover:border-teal-400/70 hover:text-teal-200"
        >
          i-volution Hardware
        </Link>
      </div>
    </div>
  );
}