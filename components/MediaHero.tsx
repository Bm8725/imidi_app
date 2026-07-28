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
<div className="absolute inset-x-0 bottom-10 sm:bottom-14 z-30 flex flex-row justify-center items-center gap-5 px-5 pointer-events-auto max-w-4xl mx-auto">
  
  {/* 1. Cloud / Buy Instant (Efect Puls și Glow) */}
  <Link
    href="/mycloud"
    title="Instant Cloud Purchase"
    className="group relative w-14 h-14 inline-flex items-center justify-center border border-white/30 bg-white/5 backdrop-blur-md text-white rounded-full transition-all duration-500 hover:bg-white/20 hover:border-white hover:scale-110 active:scale-95 shadow-[0_0_15px_rgba(255,255,255,0.1)] hover:shadow-[0_0_25px_rgba(255,255,255,0.4)]"
  >
    {/* Inel exterior animat (Pulse) */}
    <span className="absolute inset-0 rounded-full border border-white/40 animate-ping opacity-25 group-hover:opacity-0 transition-opacity duration-300"></span>
    
    {/* Iconiță Cloud + Săgeată în jos (Download/Buy) */}
    <svg xmlns="http://w3.org" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-6 h-6 transition-transform duration-300 group-hover:-translate-y-0.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75v6.75m0 0-3-3m3 3 3-3m-8.25 6a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
    </svg>
  </Link>

  {/* 2. Global E-Market */}
  <Link
    href="/e-market"
    title="Global E-Market"
    className="group relative w-14 h-14 inline-flex items-center justify-center border border-white/20 bg-white/5 backdrop-blur-md text-white/80 rounded-full transition-all duration-500 hover:bg-white/20 hover:border-white/80 hover:scale-110 active:scale-95 hover:shadow-[0_0_20px_rgba(255,255,255,0.3)]"
  >
    <svg xmlns="http://w3.org" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-6 h-6 transition-transform duration-300 group-hover:-translate-y-0.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
    </svg>
  </Link>

  {/* 3. i-volution Hardware */}
  <Link
    href="/products"
    title="i-volution Hardware"
    className="group relative w-14 h-14 inline-flex items-center justify-center border border-white/20 bg-white/5 backdrop-blur-md text-white/80 rounded-full transition-all duration-500 hover:bg-white/20 hover:border-white/80 hover:scale-110 active:scale-95 hover:shadow-[0_0_20px_rgba(255,255,255,0.3)]"
  >
    <svg xmlns="http://w3.org" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-6 h-6 transition-transform duration-300 group-hover:-translate-y-0.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m10.5-5.25v1.5M3 12h1.5m16.5-.75h-1.5M21 12h-1.5m-3.75-9v1.5m2.25 13.5v1.5M7.5 21v-1.5m6.25 1.5v-1.5m-.75-6h-3.75A1.125 1.125 0 0 1 8.25 12V8.25a1.125 1.125 0 0 1 1.125-1.125h3.75A1.125 1.125 0 0 1 14.25 8.25V12A1.125 1.125 0 0 1 13.5 13.125ZM10.5 4.5H13.5A2.25 2.25 0 0 1 15.75 6.75V9.75A2.25 2.25 0 0 1 13.5 12H10.5A2.25 2.25 0 0 1 8.25 9.75V6.75A2.25 2.25 0 0 1 10.5 4.5Z" />
    </svg>
  </Link>

</div>


    </div>
  );
}