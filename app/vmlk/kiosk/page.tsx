'use client';

export const dynamic = 'force-static';

import { useCallback, useEffect, useState } from 'react';

const SCREENS = [
  { id: 'video', label: 'PREZENTARE VIDEO', title: 'De la ferma noastră, direct la tine', desc: 'Urmărește drumul laptelui proaspăt în fiecare zi.', price: 'Puritate 100%', info: 'Aparatul NU dă rest! Introduceți suma exactă.', isVideo: true, src: '/milk.mp4', ms: 12000 },
  { id: '1', label: 'PROASPĂT ZILNIC', title: 'Lapte de la fermă. Pur și rece.', desc: 'Colectat în fiecare dimineață din ferma locală și menținut constant la temperatura optimă de 4°C.', price: 'Direct de la fermă', info: 'Aparatul NU dă rest! Introduceți suma exactă.', img: '/milk1.jpeg', ms: 9000 },
  { id: '2', label: 'GHID DE CUMPĂRARE', title: 'Cum cumperi în doar 3 pași:', desc: '1. Deschide ușa și introdu sticla sub dozator.\n2. Introdu banii cash (fise sau bancnote).\n3. Apasă butonul mare START.', price: 'Plată exclusiv CASH', info: 'Atenție: NU se acceptă plata cu card bancar.', img: '/milk2.webp', ms: 14000 },
  { id: '3', label: 'SĂNĂTATE CURATĂ', title: '100% Natural. Direct de la sursă.', desc: 'Lapte crud neprocesat, fără aditivi sau conservanți. Produs local pur, testat și certificat zilnic.', price: 'Certificat Zilnic', info: 'Gustul autentic și proaspăt în fiecare zi.', img: '/milk3.jpg', ms: 9000 }
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
    }, 200);
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

  if (!ready) return <div className="flex h-screen w-screen items-center justify-center bg-[#FBFBF9] text-[#111] font-sans text-sm tracking-widest font-light">PORNIRE SISTEM...</div>;

  const s = SCREENS[index];

  return (
    <div 
      className={`min-h-screen w-full bg-[#FBFBF9] text-[#1C1612] font-sans flex flex-col justify-between p-4 sm:p-8 md:p-12 select-none ${hideCursor ? 'lg:cursor-none' : 'cursor-default'}`}
      onClick={(e) => go(e.clientX / window.innerWidth > 0.5 ? 1 : -1)}
    >
      {/* HEADER: Curat, simplu, nu mai stă fix peste conținut pe mobil */}
      <header className="w-full flex justify-between items-center mb-6 pointer-events-none">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#607855] animate-pulse" />
          <span className="text-[10px] font-black tracking-widest text-[#607855] uppercase">FERMA NOASTRĂ</span>
        </div>
        <div className="flex items-center gap-4 pointer-events-auto">
          <button 
            onClick={(e) => { e.stopPropagation(); document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.().catch(() => {}); }} 
            className="hidden sm:block bg-[#111]/5 hover:bg-[#111]/10 px-4 py-2 rounded-full text-[10px] font-bold tracking-wider transition-all"
          >
            {full ? 'ECRAN RESTRÂNS' : 'ECRAN COMPLET'}
          </button>
          <div className="bg-white border border-[#111]/5 px-4 py-1.5 rounded-xl text-base font-bold shadow-sm text-[#111]">
            {time}
          </div>
        </div>
      </header>

      {/* CONTINUTUL PRINCIPAL: Pe mobil curge natural în jos, pe desktop se pune pe 2 coloane */}
      <main className={`flex-1 flex flex-col lg:grid lg:grid-cols-2 gap-6 md:gap-12 items-center justify-center w-full my-auto transition-all duration-300 ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.99]'}`}>
        
        {/* Zona de Text */}
        <section className="w-full flex flex-col justify-center text-center lg:text-left order-2 lg:order-1">
          <span className="text-[10px] font-black tracking-widest text-[#607855] uppercase mb-2 block">
            // {s.label}
          </span>
          <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-[#111] leading-tight mb-4 whitespace-pre-line">
            {s.title}
          </h1>
          <p className="text-sm sm:text-base md:text-lg leading-relaxed text-[#111]/60 max-w-xl mx-auto lg:mx-0 whitespace-pre-line mb-6">
            {s.desc}
          </p>
          <div className="flex flex-wrap justify-center lg:justify-start gap-2">
            <span className="bg-[#607855]/10 text-[#607855] font-bold text-xs px-3 py-1 rounded-lg">
              {s.price}
            </span>
          </div>
        </section>

        {/* Zona Media: Imaginea sau Video-ul (pe mobil stă sus, pe desktop în dreapta) */}
        <section className="w-full order-1 lg:order-2">
          <div className="w-full aspect-[4/3] sm:aspect-video lg:aspect-square max-h-[40vh] sm:max-h-[50vh] lg:max-h-[65vh] relative rounded-2xl md:rounded-[32px] overflow-hidden shadow-lg bg-black">
            {s.isVideo ? (
              <video src={s.src} autoPlay muted playsInline loop onEnded={() => go(1)} className="w-full h-full object-cover" />
            ) : (
              <img src={s.img} alt={s.label} className="w-full h-full object-cover" />
            )}
          </div>
        </section>

      </main>

      {/* FOOTER: Caseta de informații care pe mobil stă cuminte jos, fără să blocheze restul textului */}
      <footer className="w-full mt-6 pt-4 border-t border-black/5 flex flex-col sm:flex-row justify-between items-center gap-2 text-center text-xs pointer-events-none">
        <div className="text-amber-800 bg-amber-50 border border-amber-200/60 px-3 py-1.5 rounded-xl font-medium max-w-full">
          <span className="font-bold">Atenție:</span> {s.info}
        </div>
        <div className="text-black/40 font-bold tracking-wider uppercase text-[9px]">
          Atinge ecranul pentru navigare
        </div>
      </footer>
    </div>
  );
}
