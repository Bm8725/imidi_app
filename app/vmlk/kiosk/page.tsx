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
      className={`relative w-full min-h-screen lg:h-screen lg:overflow-hidden bg-[#FBFBF9] text-[#1C1612] font-sans flex flex-col justify-between p-4 sm:p-6 lg:p-12 select-none ${hideCursor ? 'lg:cursor-none' : 'cursor-default'}`}
      onClick={(e) => go(e.clientX / window.innerWidth > 0.5 ? 1 : -1)}
    >
      {/* BACKGROUND GRAPHIC */}
      <div className="absolute top-0 right-0 w-[40vw] h-[40vw] bg-[#607855]/5 rounded-full blur-[120px] pointer-events-none" />

      {/* FIXED HEADER */}
      <header className="w-full flex justify-between items-center z-30 pointer-events-none mb-4 lg:mb-0">
        <div className="flex items-center gap-2 lg:gap-3">
          <span className="w-2 h-2 rounded-full bg-[#607855] animate-pulse" />
          <div className="text-[10px] sm:text-xs font-black tracking-[0.25em] text-[#607855] uppercase">
            FERMA NOASTRĂ ZILNIC
          </div>
        </div>
        <div className="flex items-center gap-3 lg:gap-6 pointer-events-auto">
          <button 
            onClick={(e) => { e.stopPropagation(); document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.().catch(() => {}); }} 
            className={`hidden sm:block bg-black/5 hover:bg-black/10 text-[#111] px-4 py-2 rounded-xl text-xs font-bold tracking-wider transition-all ${hideCursor ? 'lg:opacity-0 lg:scale-95' : 'opacity-100 scale-100'}`}
          >
            {full ? 'ECRAN RESTRÂNS' : 'ECRAN COMPLET'}
          </button>
          <div className="bg-white border border-black/5 px-3 py-1 sm:px-4 sm:py-1.5 rounded-xl text-sm sm:text-base lg:text-2xl font-black tabular-nums shadow-sm text-[#111]">
            {time}
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className={`flex-1 flex flex-col-reverse lg:grid lg:grid-cols-2 gap-6 lg:gap-12 items-center justify-center w-full max-w-7xl mx-auto transition-all duration-300 ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.995]'}`}>
        
        {/* COLOANA TEXT */}
        <section className="w-full flex flex-col justify-center text-center lg:text-left z-10 px-2 sm:px-6 lg:px-0">
          <div className="min-h-[28px] lg:min-h-[36px] flex items-center justify-center lg:justify-start mb-2 lg:mb-4">
            <span className="text-[10px] lg:text-xs font-bold tracking-widest text-[#607855] bg-[#607855]/10 px-2.5 py-1 rounded-md uppercase">
              {s.label}
            </span>
          </div>
          
          {/* h1 are acum o înălțime minimă fixă bazată pe unități flexibile (lh / ch / rem) ca să nu mai miște restul layout-ului */}
          <div className="min-h-[3.52rem] sm:min-h-[5.1rem] lg:min-h-[11rem] flex items-center justify-center lg:justify-start mb-3 lg:mb-6">
            <h1 className="text-xl sm:text-3xl lg:text-5xl xl:text-6xl font-black tracking-tight text-[#111] leading-[1.15] whitespace-pre-line">
              {s.title}
            </h1>
          </div>

          <div className="min-h-[4.5rem] sm:min-h-[3.5rem] lg:min-h-[6rem] flex items-center justify-center lg:justify-start mb-4 lg:mb-8">
            <p className="text-xs sm:text-base lg:text-lg leading-relaxed text-[#111]/60 max-w-xl whitespace-pre-line">
              {s.desc}
            </p>
          </div>

          <div className="flex justify-center lg:justify-start">
            <div className="bg-[#607855] text-white font-bold text-xs lg:text-sm px-4 py-2 rounded-xl shadow-xs">
              {s.price}
            </div>
          </div>
        </section>

        {/* COLOANA MEDIA */}
        <section className="w-full flex items-center justify-center px-2 sm:px-6 lg:px-0">
          <div className="w-full aspect-[4/3] sm:aspect-video lg:aspect-square xl:aspect-[1.1] max-h-[30vh] sm:max-h-[40vh] lg:max-h-[55vh] xl:max-h-[60vh] relative rounded-2xl lg:rounded-[40px] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.06)] bg-black">
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

      {/* FOOTER PENTRU KIOSK (Info text stabil) */}
      <footer className="w-full text-center mt-4 lg:mt-0 text-[10px] sm:text-xs text-[#111]/40 tracking-wider pointer-events-none">
        {s.info}
      </footer>
    </div>
  );
}
