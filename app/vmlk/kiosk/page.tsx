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
    const timeout = setTimeout(() => setReady(true), 500);
    return () => clearTimeout(timeout);
  }, []);

  // Schimbare complet automată strict bazată pe milisecundele fiecărui ecran
  useEffect(() => {
    if (!ready) return;
    const interval = setTimeout(() => go(1), SCREENS[index]?.ms || 8000);
    return () => clearTimeout(interval);
  }, [go, ready, index]);

  // Ceasul digital pentru monitorizare
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }));
    tick(); const t = setInterval(tick, 1000); return () => clearInterval(t);
  }, []);

  // Păstrat doar pentru depanare tehnică la instalare (Săgeți din tastatură ascunsă + tasta F)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { 
      if (e.key === 'ArrowRight') go(1); 
      if (e.key === 'ArrowLeft') go(-1); 
      if ((e.key === 'f' || e.key === 'F') && !document.fullscreenElement) {
        document.documentElement.requestFullscreen?.().catch(() => {});
      }
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  // WakeLock blochează stingerea automată a monitorului industrial
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
    <div className="relative w-full h-screen overflow-hidden bg-[#FBFBF9] text-[#1C1612] font-sans flex flex-col justify-between p-12 select-none cursor-none pointer-events-none">
      
      {/* BACKGROUND DECORATION */}
      <div className="absolute top-0 right-0 w-[40vw] h-[40vw] bg-[#607855]/5 rounded-full blur-[120px]" />

      {/* HEADER COMPACT KIOSK */}
      <header className="w-full flex justify-between items-center z-30 mb-0">
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-[#607855] animate-pulse" />
          <div className="text-xs font-black tracking-[0.25em] text-[#607855] uppercase">
            FERMA NOASTRĂ ZILNIC
          </div>
        </div>
        <div className="bg-white border border-black/5 px-4 py-2 rounded-2xl text-3xl font-black tabular-nums shadow-xs text-[#111]">
          {time}
        </div>
      </header>

      {/* CONTAINER PRINCIPAL GRID FIX 50/50 - REZOLVĂ RESPONSIVITATEA PE MONITOR */}
      <main className={`flex-1 grid grid-cols-2 gap-16 items-center justify-center w-full max-w-7xl mx-auto transition-all duration-300 ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.995]'}`}>
        
        {/* COLOANA STÂNGA: TEXTĂRI FIXATE PRIN BANDOURI MIN-H */}
        <section className="w-full flex flex-col justify-center text-left z-10">
          <div className="min-h-[36px] flex items-center mb-4">
            <span className="text-xs font-bold tracking-widest text-[#607855] bg-[#607855]/10 px-3 py-1.5 rounded-lg uppercase">
              {s.label}
            </span>
          </div>
          
          <div className="min-h-[11rem] flex items-center mb-4">
            <h1 className="text-5xl xl:text-6xl font-black tracking-tight text-[#111] leading-[1.15] whitespace-pre-line">
              {s.title}
            </h1>
          </div>

          <div className="min-h-[6rem] flex items-center mb-6">
            <p className="text-lg leading-relaxed text-[#111]/60 max-w-xl whitespace-pre-line">
              {s.desc}
            </p>
          </div>

          <div className="flex justify-start">
            <div className="bg-[#607855] text-white font-black tracking-wide text-sm px-5 py-2.5 rounded-xl shadow-xs">
              {s.price}
            </div>
          </div>
        </section>

        {/* COLOANA DREAPTA: CONTROLLER MEDIA ULTRA-STABIL */}
        <section className="w-full flex items-center justify-center">
          <div className="w-full aspect-[1.05] max-h-[56vh] relative rounded-[40px] overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.07)] bg-black">
            {s.isVideo ? (
              <video 
                src={s.src} 
                autoPlay 
                muted 
                loop 
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <img 
                src={s.img} 
                alt={s.title}
                className="w-full h-full object-cover"
              />
            )}
          </div>
        </section>

      </main>

      {/* FOOTER CRITIC: AVERTISMENT DE PLATĂ MASIV PENTRU CLIENȚI */}
      <footer className="w-full text-center mt-0 z-30">
        <span className="bg-red-500 text-white border border-red-600 px-6 py-2.5 rounded-full inline-block font-extrabold text-sm tracking-wide shadow-md animate-pulse">
          {s.info}
        </span>
      </footer>
    </div>
  );
}
