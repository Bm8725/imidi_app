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

  // Auto-advance slide-uri
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

  // Suport pentru tastatură ascunsă/teste (Săgeți și Tasta F pentru Fullscreen în spate)
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

  // WakeLock: previne stingerea ecranului la Kiosk
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
    <div className="relative w-full min-h-screen lg:h-screen lg:overflow-hidden bg-[#FBFBF9] text-[#1C1612] font-sans flex flex-col justify-between p-6 lg:p-12 select-none cursor-none">
      
      {/* BACKGROUND GRAPHIC */}
      <div className="absolute top-0 right-0 w-[40vw] h-[40vw] bg-[#607855]/5 rounded-full blur-[120px] pointer-events-none" />

      {/* HEADER COMPACT (Fără buton de fullscreen, doar branding și ceas masiv) */}
      <header className="w-full flex justify-between items-center z-30 pointer-events-none mb-4 lg:mb-0">
        <div className="flex items-center gap-2 lg:gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-[#607855] animate-pulse" />
          <div className="text-xs font-black tracking-[0.25em] text-[#607855] uppercase">
            FERMA NOASTRĂ ZILNIC
          </div>
        </div>
        <div className="bg-white border border-black/5 px-4 py-2 rounded-2xl text-lg lg:text-3xl font-black tabular-nums shadow-xs text-[#111]">
          {time}
        </div>
      </header>

      {/* ZONE / BUTOANE DE NAVIGARE GENERATION TACTILĂ (Vizibile, dar elegante) */}
      <div className="absolute inset-y-0 left-0 w-20 flex items-center justify-start pl-4 z-40">
        <button 
          onClick={() => go(-1)}
          className="w-12 h-12 rounded-full bg-white/80 backdrop-blur-md shadow-md border border-black/5 flex items-center justify-center text-[#607855] hover:bg-white active:scale-95 transition-all"
        >
          <svg xmlns="http://w3.org" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
      </div>

      <div className="absolute inset-y-0 right-0 w-20 flex items-center justify-end pr-4 z-40">
        <button 
          onClick={() => go(1)}
          className="w-12 h-12 rounded-full bg-white/80 backdrop-blur-md shadow-md border border-black/5 flex items-center justify-center text-[#607855] hover:bg-white active:scale-95 transition-all"
        >
          <svg xmlns="http://w3.org" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      {/* CONTAINER PRINCIPAL STRUCTURAT FLUID */}
      <main className={`flex-1 flex flex-col-reverse lg:grid lg:grid-cols-2 gap-6 lg:gap-16 items-center justify-center w-full max-w-6xl mx-auto transition-all duration-300 ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.995]'}`}>
        
        {/* COLOANA TEXT */}
        <section className="w-full flex flex-col justify-center text-center lg:text-left z-10 px-6 lg:px-0">
          <div className="min-h-[36px] flex items-center justify-center lg:justify-start mb-4">
            <span className="text-[10px] lg:text-xs font-bold tracking-widest text-[#607855] bg-[#607855]/10 px-3 py-1.5 rounded-lg uppercase">
              {s.label}
            </span>
          </div>
          
          <div className="min-h-[3.52rem] sm:min-h-[5.1rem] lg:min-h-[11rem] flex items-center justify-center lg:justify-start mb-4">
            <h1 className="text-2xl sm:text-4xl lg:text-5xl xl:text-6xl font-black tracking-tight text-[#111] leading-[1.15] whitespace-pre-line">
              {s.title}
            </h1>
          </div>

          <div className="min-h-[4.5rem] sm:min-h-[3.5rem] lg:min-h-[6rem] flex items-center justify-center lg:justify-start mb-6">
            <p className="text-sm sm:text-base lg:text-lg leading-relaxed text-[#111]/60 max-w-xl whitespace-pre-line">
              {s.desc}
            </p>
          </div>

          <div className="flex justify-center lg:justify-start">
            <div className="bg-[#607855] text-white font-black tracking-wide text-xs lg:text-sm px-5 py-2.5 rounded-xl shadow-xs">
              {s.price}
            </div>
          </div>
        </section>

        {/* COLOANA MEDIA (Video / Foto) */}
        <section className="w-full flex items-center justify-center px-6 lg:px-0">
          <div className="w-full aspect-[4/3] sm:aspect-video lg:aspect-square xl:aspect-[1.05] max-h-[30vh] sm:max-h-[38vh] lg:max-h-[52vh] xl:max-h-[56vh] relative rounded-3xl lg:rounded-[40px] overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.07)] bg-black">
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

      {/* FOOTER NOTĂ AVERTISMENT (Foarte importantă pe Kiosk-uri de plată) */}
      <footer className="w-full text-center mt-4 lg:mt-0 text-xs font-medium text-[#111]/50 tracking-wider pointer-events-none z-30">
        <span className="bg-white/60 border border-black/5 px-4 py-1.5 rounded-full inline-block backdrop-blur-xs">
          {s.info}
        </span>
      </footer>
    </div>
  );
}
