'use client';

import Link from "next/link";

// Concept: Interactive Isometric Live Sequencer Matrix (Launchpad / Grid Controller)
// Complet transparent, fără fundal negru, umbre ambientale sau gradienți masivi.

const GLOW_PADS = Array.from({ length: 16 }, (_, i) => {
  const row = (i * 3 + 1) % 6;
  const col = (i * 4 + 2) % 8;
  const delay = (i % 7) * 0.8;
  const duration = 2.5 + (i % 4) * 0.5;
  const colors = ["#E2861A", "#0B7285", "#6B4FA0", "#C77313"];
  const color = colors[i % colors.length];
  return { row, col, delay, duration, color };
});

export default function MediaHero() {
  const handlePadClick = (index: number) => {
    console.log(`MIDI Note Triggered: Pad ${index}`);
  };

  return (
    <div className="absolute inset-0 overflow-hidden bg-transparent select-none">
      <style>{`
        @keyframes pad-pulse {
          0%, 100% { opacity: 0.05; }
          45%, 55% { opacity: 0.6; }
        }
      `}</style>

      {/* Transformarea Izometrică 3D a Consolei */}
      <div 
        className="absolute inset-0 flex items-center justify-center opacity-90 z-10"
        style={{
          transform: "perspective(1000px) rotateX(60deg) rotateZ(-20deg) translateY(-5%) scale(1.2)",
        }}
      >
        {/* Rețeaua principală de Sequencer (Trama de linii este foarte discretă, 1% opacitate) */}
        <div 
          className="relative w-[140vw] h-[140vh] max-w-[1600px] max-h-[1600px] grid grid-cols-8 grid-rows-6 gap-3 sm:gap-5 p-6 rounded-3xl"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(255, 255, 255, 0.01) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(255, 255, 255, 0.01) 1px, transparent 1px)
            `,
            backgroundSize: "12.5% 16.666%",
          }}
        >
          {/* TOATE PAD-URILE HARDWARE (Butoane semi-transparente care lasă fundalul tău să se vadă) */}
          {Array.from({ length: 48 }).map((_, i) => {
            const activePad = GLOW_PADS.find(p => (p.row * 8 + p.col) === i);

            return (
              <button 
                key={`pad-${i}`} 
                onClick={() => handlePadClick(i)}
                aria-label={`MIDI Pad ${i + 1}`}
                className="w-full h-full rounded-md sm:rounded-lg border border-white/[0.03] bg-white/[0.01] backdrop-blur-[1px] 
                           transition-all duration-150 hover:bg-white/[0.06] hover:border-white/10 
                           active:scale-95 active:bg-white/10 pointer-events-auto cursor-pointer 
                           relative overflow-hidden group focus:outline-none"
              >
                {/* Stratul de animație live dacă pad-ul este unul activ în secvență */}
                {activePad && (
                  <div
                    className="absolute inset-0 pointer-events-none rounded-md sm:rounded-lg"
                    style={{
                      background: `radial-gradient(circle at center, ${activePad.color} 20%, transparent 80%)`,
                      animation: `pad-pulse ${activePad.duration}s ease-in-out infinite`,
                      animationDelay: `${activePad.delay}s`,
                    } as React.CSSProperties}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* CTA-uri live ancorate peste grid */}
      <div className="absolute inset-x-0 bottom-10 sm:bottom-14 z-30 flex flex-row justify-center items-center gap-5 px-5 pointer-events-auto max-w-4xl mx-auto">
        

      </div>
    </div>
  );
}
