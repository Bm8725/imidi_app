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
  const [isFullscreen, setIsFullscreen] = useState(false);

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

  // Monitorizare stare Fullscreen nativă
  useEffect(() => {
    const checkFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', checkFs);
    return () => document.removeEventListener('fullscreenchange', checkFs);
  }, []);

  // Auto-advance slide-uri bazat pe ms
  useEffect(() => {
    if (!ready) return;
    const interval = setTimeout(() => go(1), SCREENS[index]?.ms || 8000);
    return () => clearTimeout(interval);
  }, [go, ready, index]);

  // Ceasul digital local
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }));
    tick(); const t = setInterval(tick, 1000); return () => clearInterval(t);
  }, []);

  // Funcție tehnică care forțează ecranul complet la atingere
  const triggerFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.()
        .then(() => setIsFullscreen(true))
        .catch(() => {});
    }
  };

  // Suport pentru tastatură ascunsă/depanare (Săgeți și Tasta F)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { 
      if (e.key === 'ArrowRight') go(1); 
      if (e.key === 'ArrowLeft') go(-1); 
      if (e.key === 'f' || e.key === 'F') triggerFullscreen();
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  // WakeLock: Menține ecranul pornit 24/7
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
      onClick={triggerFullscreen}
      className="relative w-screen h-screen overflow-hidden bg-[#FBFBF9] text-[#1C1612] font-sans flex flex-col justify-between p-6 md:p-8 lg:p-12 select-none cursor-none"
    >
      {/* Indicator Tehnic discret dacă NU este în Fullscreen (Dispare când e complet) */}
      {!isFullscreen && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-[10px] font-bold px-3 py-1 rounded-full z-50 animate-bounce pointer-events-none">
          ATINGEȚI ECRANUL PENTRU MODUL COMPLET KIOSK
        </div>
      )}
      
      {/* BACKGROUND DECORATION */}
      <div className="absolute top-0 right-0 w-[40vw] h-[40vw] bg-[#607855]/5 rounded-full blur-[120px] pointer-events-none" />

      {/* HEADER KIOSK ADAPTIV */}
      <header className="w-full flex justify-between items-center z-30 pointer-events-none">
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-[#607855] animate-pulse" />
          <div className="text-[10px] sm:text-xs font-black tracking-[0.25em] text-[#607855] uppercase">
            FERMA NOASTRĂ ZILNIC
          </div>
        </div>
        <div className="bg-white border border-black/5 px-3 py-1.5 md:px-4 md:py-2 rounded-2xl text-xl md:text-2xl lg:text-3xl font-black tabular-nums shadow-xs text-[#111]">
          {time}
        </div>
      </header>

      {/* MAIN CONTAINER ADAPTIV (Ajustat cu unități flexibile pentru orice rezoluție) */}
      <main className={`flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-10 lg:gap-16 items-center justify-center w-full max-w-7xl mx-auto pointer-events-none transition-all duration-300 ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.995]'}`}>
        
        {/* COLOANA TEXT - Ajustare automată a textului pe ecrane mici/mari */}
        <section className="w-full flex flex-col justify-center text-center lg:text-left z-10">
          <div className="mb-2 md:mb-4">
            <span className="text-[10px] md:text-xs font-bold tracking-widest text-[#607855] bg-[#607855]/10 px-3 py-1.5 rounded-lg uppercase">
              {s.label}
            </span>
          </div>
          
          <h1 className="text-2xl sm:text-4xl md:text-5xl xl:text-6xl font-black tracking-tight text-[#111] leading-[1.15] whitespace-pre-line mb-2 md:mb-4">
            {s.title}
          </h1>

          <p className="text-sm md:text-base lg:text-lg leading-relaxed text-[#111]/60 max-w-xl mx-auto lg:mx-0 whitespace-pre-line mb-4 md:mb-6">
            {s.desc}
          </p>

          <div className="flex justify-center lg:justify-start">
            <div className="bg-[#607855] text-white font-black tracking-wide text-xs md:text-sm px-5 py-2.5 rounded-xl shadow-xs">
              {s.price}
            </div>
          </div>
        </section>

        {/* COLOANA MEDIA - Păstrează proporția corectă indiferent dacă ecranul e pătrat sau lat */}
        <section className="w-full flex items-center justify-center">
          <div className="w-full aspect-[4/3] sm:aspect-video lg:aspect-square xl:aspect-[1.05] max-h-[35vh] lg:max-h-[52vh] xl:max-h-[56vh] relative rounded-3xl lg:rounded-[40px] overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.07)] bg-black">
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

      {/* FOOTER NOTĂ AVERTISMENT PENTRU CLIENT */}
      <footer className="w-full text-center z-30 pointer-events-none">
        <span className="bg-red-500 text-white border border-red-600 px-5 py-2 md:px-6 md:py-2.5 rounded-full inline-block font-extrabold text-xs md:text-sm tracking-wide shadow-md animate-pulse">
          {s.info}
        </span>
      </footer>
    </div>
  );
}
