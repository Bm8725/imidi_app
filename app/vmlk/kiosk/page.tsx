'use client';

export const dynamic = 'force-static';

import { useCallback, useEffect, useState } from 'react';

const SCREENS = [
  { id: 'video', label: 'PREZENTARE VIDEO', title: 'De la ferma noastră,\ndirect la tine', desc: 'Urmărește drumul laptelui proaspăt în fiecare zi.', price: 'Puritate 100%', info: 'Aparatul NU dă rest! Introduceți suma exactă.', isVideo: true, src: '/milk.mp4', ms: 12000 },
  { id: '1', label: 'PROASPĂT ZILNIC', title: 'Lapte de la fermă.\nPur și rece.', desc: 'Colectat în fiecare dimineață din ferma locală și menținut constant la temperatura optimă de 4°C.', price: 'Direct de la fermă', info: 'Aparatul NU dă rest! Introduceți suma exactă.', img: '/milk1.jpeg', ms: 9000 },
  { id: '2', label: 'GHID DE CUMPĂRARE', title: 'Cum cumperi în\ndoar 3 pași:', desc: '1. Deschide ușa și introdu sticla sub dozator.\n2. Introdu banii cash (fise sau bancnote).\n3. Apasă butonul mare START.', price: 'Plată exclusiv CASH', info: 'Atenție: NU se acceptă plata cu card bancar.', img: '/milk2.webp', ms: 14000 },
  { id: '3', label: 'SĂNĂTATE CURATĂ', title: '100% Natural.\nDirect de la sursă.', desc: 'Lapte crud neprocesat, fără aditivi sau conservanți. Produs local pur, testat și certificat zilnic.', price: 'Certificat Zilnic', info: 'Gustul autentic și proaspăt în fiecare zi.', img: '/milk3.jpg', ms: 9000 }
];

export default function MilkKiosk() {
  const [index, setIndex] = useState(0);
  const [time, setTime] = useState('');
  const [full, setFull] = useState(false);
  const [hideCursor, setHideCursor] = useState(false);
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(true);

  const go = useCallback((d: number) => {
    setVisible(false);
    setTimeout(() => { 
      setIndex((v) => (v + d + SCREENS.length) % SCREENS.length); 
      setVisible(true); 
    }, 250);
  }, []);

  useEffect(() => {
    const onChange = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    const timeout = setTimeout(() => setReady(true), 500);
    return () => { document.removeEventListener('fullscreenchange', onChange); clearTimeout(timeout); };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const interval = setTimeout(() => go(1), SCREENS[index]?.ms || 8000);
    return () => clearTimeout(interval);
  }, [go, ready, index]);

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }));
    tick(); const t = setInterval(tick, 1000); return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { 
      if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1); 
      if ((e.key === 'f' || e.key === 'F') && !document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  useEffect(() => {
    let t = 0;
    const onTouchOrMove = () => { setHideCursor(false); clearTimeout(t); t = window.setTimeout(() => setHideCursor(true), 3000); };
    window.addEventListener('pointermove', onTouchOrMove); window.addEventListener('pointerdown', onTouchOrMove);
    return () => { window.removeEventListener('pointermove', onTouchOrMove); window.removeEventListener('pointerdown', onTouchOrMove); clearTimeout(t); };
  }, []);

  useEffect(() => {
    let lock: WakeLockSentinel | null = null; let alive = true;
    const acquire = async () => { 
      if (!('wakeLock' in navigator) || document.visibilityState !== 'visible' || (lock && !lock.released)) return; 
      try { const l = await navigator.wakeLock.request('screen'); if (alive) lock = l; else l.release(); } catch {} 
    };
    acquire(); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') acquire(); });
    const t = setInterval(acquire, 60000); return () => { alive = false; clearInterval(t); lock?.release().catch(() => {}); };
  }, []);

  if (!ready) return <div className="flex h-screen w-screen items-center justify-center bg-[#F4F4F0] text-[#111] font-sans text-sm tracking-widest font-light">PORNIRE SISTEM...</div>;

  const s = SCREENS[index];

  return (
    <div 
      className={`relative w-screen h-screen bg-[#F4F4F0] text-[#1C1612] font-sans overflow-hidden select-none select-none ${hideCursor ? 'cursor-none' : 'cursor-default'}`}
      onClick={(e) => go(e.clientX / window.innerWidth > 0.5 ? 1 : -1)}
    >
      {/* TOP HEADER FIX (Nu se mișcă niciodată) */}
      <header className="absolute top-0 left-0 right-0 h-24 z-30 flex justify-between items-center px-8 md:px-16 pointer-events-none">
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-[#607855] animate-pulse" />
          <div className="text-xs font-black tracking-[0.3em] text-[#607855] uppercase">
            FERMA NOASTRĂ ZILNIC
          </div>
        </div>
        <div className="flex items-center gap-6 pointer-events-auto">
          <button 
            onClick={(e) => { e.stopPropagation(); document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.().catch(() => {}); }} 
            className={`bg-black/5 hover:bg-black/10 text-[#111] px-5 py-2.5 rounded-xl text-xs font-bold tracking-wider transition-all ${hideCursor ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}
          >
            {full ? 'ECRAN RESTRÂNS' : 'ECRAN COMPLET'}
          </button>
          <div className="bg-white border border-black/5 px-6 py-2 rounded-xl text-2xl font-black tabular-nums shadow-sm text-[#111]">
            {time}
          </div>
        </div>
      </header>

      {/* FOOTER FIX (Zonă dedicată pentru avertismente/info clienți) */}
      <footer className="absolute bottom-0 left-0 right-0 h-20 bg-white border-t border-black/5 z-30 flex items-center justify-between px-8 md:px-16 font-medium text-xs">
        <div className="flex items-center gap-2 text-amber-800">
          <span className="bg-amber-100 px-2 py-0.5 rounded font-bold">INFO ATM:</span>
          <span>{s.info}</span>
        </div>
        <div className="text-black/40 font-bold tracking-widest uppercase text-[10px]">
          Atingeți ecranul pentru a naviga
        </div>
      </footer>

      {/* CORE GRID SYSTEM (50% Text stânga | 50% Media dreapta) */}
      <main className="w-full h-full grid grid-cols-1 lg:grid-cols-2 pt-24 pb-20">
        
        {/* ZONA STÂNGA: TEXT (Perfect aliniată și fixă pe orice slide) */}
        <section className="flex flex-col justify-center px-8 md:px-16 lg:pr-8 xl:pr-16 z-10">
          <div className={`transition-all duration-300 transform ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}`}>
            <span className="text-xs font-bold tracking-widest text-[#607855] bg-[#607855]/10 px-3 py-1 rounded-md uppercase inline-block mb-6">
              {s.label}
            </span>
            <h1 className="text-3xl md:text-5xl xl:text-6xl font-black tracking-tight text-[#111] leading-[1.1] whitespace-pre-line mb-6 min-h-[3.3em] flex items-center">
              {s.title}
            </h1>
            <p className="text-sm md:text-base xl:text-lg leading-relaxed text-[#111]/70 max-w-[540px] whitespace-pre-line min-h-[4.5em]">
              {s.desc}
            </p>
            <div className="mt-8">
              <span className="text-xs uppercase tracking-widest font-black text-black/40 block mb-2">Statut Produs</span>
              <div className="inline-flex items-center gap-2 bg-[#607855] text-white font-bold text-sm px-4 py-2 rounded-xl shadow-sm">
                {s.price}
              </div>
            </div>
          </div>
        </section>

        {/* ZONA DREAPTA: MEDIA (Ocupă fix spațiul alocat, fără overflow) */}
        <section className="p-6 md:p-8 lg:p-12 flex items-center justify-center h-full w-full">
          <div className={`w-full h-full relative rounded-[32px] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.05)] bg-black transition-all duration-300 transform ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
            {s.isVideo ? (
              <video 
                src={s.src} 
                autoPlay 
                muted 
                playsInline 
                loop 
                onEnded={() => go(1)} 
                className="w-full h-full object-cover opacity-95" 
              />
            ) : (
              <img 
                src={s.img} 
                alt={s.label} 
                className="w-full h-full object-cover" 
              />
            )}
          </div>
        </section>

      </main>
    </div>
  );
}
