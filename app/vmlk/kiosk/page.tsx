'use client';

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

  useEffect(() => {
    const checkFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', checkFs);
    return () => document.removeEventListener('fullscreenchange', checkFs);
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

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.()
        .then(() => setIsFullscreen(true))
        .catch((err) => console.log(err));
    } else {
      document.exitFullscreen?.()
        .then(() => setIsFullscreen(false))
        .catch((err) => console.log(err));
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { 
      if (e.key === 'ArrowRight') go(1); 
      if (e.key === 'ArrowLeft') go(-1); 
      if (e.key === 'f' || e.key === 'F') toggleFullscreen();
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [go]);

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
      onClick={toggleFullscreen}
      className="relative w-screen h-screen overflow-hidden bg-[#FBFBF9] text-[#1C1612] font-sans flex flex-col justify-between p-4 md:p-6 lg:p-10 select-none group"
    >
      {/* Indicator Mod Complet (Apare doar dacă nu e activat) */}
      {!isFullscreen && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-[10px] font-bold px-3 py-1 rounded-full z-50 animate-bounce pointer-events-none">
          ATINGEȚI ECRANUL PENTRU MODUL COMPLET KIOSK
        </div>
      )}
      
      {/* FUNDAL DECORATIV */}
      <div className="absolute top-0 right-0 w-[35vw] h-[35vw] bg-[#607855]/5 rounded-full blur-[100px] pointer-events-none" />

      {/* HEADER FIX */}
      <header className="h-[12vh] max-h-[80px] w-full flex justify-between items-center z-30">
        <div className="flex items-center gap-3 pointer-events-none">
          <span className="w-2.5 h-2.5 rounded-full bg-[#607855] animate-pulse" />
          <div className="text-[10px] sm:text-xs font-black tracking-[0.25em] text-[#607855] uppercase">
            FERMA NOASTRĂ ZILNIC
          </div>
        </div>
        
        {/* ZONĂ CONTROL: Conține ceasul și butonul fin ascuns la hover */}
        <div className="flex items-center gap-3 relative">
          {/* BUTONUL ASCUNS (Apare fin doar când pui mouse-ul în zona de sus-dreapta) */}
          <button
            onClick={(e) => {
              e.stopPropagation(); // Oprește declanșarea toggle-ului de pe fundal
              toggleFullscreen();
            }}
            className="opacity-0 group-hover:opacity-100 focus:opacity-100 bg-black/10 hover:bg-black/20 backdrop-blur-md text-[#111] text-[11px] font-bold px-3 py-1.5 rounded-xl border border-black/5 transition-all duration-300 flex items-center gap-1.5 active:scale-95"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-black/50" />
            {isFullscreen ? 'Ieșire Ecran Complet' : 'Mod Kiosk'}
          </button>

          <div className="bg-white border border-black/5 px-3 py-1.5 md:px-4 md:py-2 rounded-2xl text-base md:text-xl lg:text-2xl font-black tabular-nums shadow-xs text-[#111] pointer-events-none">
            {time}
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className={`flex-1 h-[70vh] grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-10 lg:gap-16 items-center justify-center w-full max-w-7xl mx-auto pointer-events-none transition-all duration-300 ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.995]'}`}>
        
        {/* COLOANA STÂNGA: TEXT */}
        <section className="w-full flex flex-col justify-center text-left z-10 max-h-full overflow-hidden">
          <div className="mb-2 md:mb-3">
            <span className="text-[9px] md:text-xs font-bold tracking-widest text-[#607855] bg-[#607855]/10 px-2.5 py-1 rounded-lg uppercase">
              {s.label}
            </span>
          </div>
          
          <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-black tracking-tight text-[#111] leading-[1.15] whitespace-pre-line mb-2 md:mb-3">
            {s.title}
          </h1>

          <p className="text-xs md:text-sm lg:text-base xl:text-lg leading-relaxed text-[#111]/60 max-w-xl whitespace-pre-line mb-3 md:mb-5">
            {s.desc}
          </p>

          <div className="flex justify-start">
            <div className="bg-[#607855] text-white font-black tracking-wide text-[10px] md:text-xs px-4 py-2 rounded-xl shadow-xs">
              {s.price}
            </div>
          </div>
        </section>

        {/* COLOANA DREAPTA: MEDIA */}
        <section className="w-full h-full flex items-center justify-center max-h-[40vh] sm:max-h-[55vh]">
          <div className="w-full h-full max-w-[40vh] sm:max-w-none aspect-square relative rounded-2xl lg:rounded-[32px] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.04)] bg-black">
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

      {/* FOOTER FIX */}
      <footer className="h-[10vh] max-h-[60px] w-full flex items-end justify-center z-30 pointer-events-none">
        <p className="text-[10px] sm:text-xs md:text-sm font-bold text-red-600 bg-red-50 px-4 py-2 rounded-xl border border-red-100 uppercase tracking-wider animate-pulse max-w-full text-center truncate">
          {s.info}
        </p>
      </footer>
    </div>
  );
}
