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
      {/* BACKGROUND GRAPHIC (Subtil, doar pentru design premium) */}
      <div className="absolute top-0 right-0 w-[40vw] h-[40vw] bg-[#607855]/5 rounded-full blur-[120px] pointer-events-none" />

      {/* FIXED HEADER: Stabil pe Kiosk, scalat corect pe mobil */}
      <header className="w-full flex justify-between items-center z-30 pointer-events-none mb-6 lg:mb-0">
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
          <div className="bg-white border border-black/5 px-4 py-1.5 rounded-xl text-base lg:text-2xl font-black tabular-nums shadow-sm text-[#111]">
            {time}
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER: Pe mobil curge fluid în jos, pe Kiosk este blocat 50% / 50% perfect fix */}
      <main className={`flex-1 flex flex-col-reverse lg:grid lg:grid-cols-2 gap-6 lg:gap-12 items-center justify-center w-full my-auto transition-all duration-300 ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.995]'}`}>
        
        {/* COLOANA TEXT: Nu mai sare, nu mai modifică dimensiunile layout-ului */}
        <section className="w-full flex flex-col justify-center text-center lg:text-left z-10 px-2 sm:px-6 lg:px-0">
          <span className="text-[10px] lg:text-xs font-bold tracking-widest text-[#607855] bg-[#607855]/10 px-2.5 py-1 rounded-md uppercase inline-block mb-3 lg:mb-6 w-fit mx-auto lg:mx-0">
            {s.label}
          </span>
          <h1 className="text-xl sm:text-3xl lg:text-5xl xl:text-6xl font-black tracking-tight text-[#111] leading-[1.15] whitespace-pre-line mb-4 min-h-hidden lg:min-h-[2.4em] flex items-center justify-center lg:justify-start">
            {s.title}
          </h1>
          <p className="text-sm sm:text-base lg:text-lg leading-relaxed text-[#111]/60 max-w-xl mx-auto lg:mx-0 whitespace-pre-line mb-6 min-h-hidden lg:min-h-[4.5em]">
            {s.desc}
          </p>
          <div className="flex justify-center lg:justify-start gap-2">
            <div className="bg-[#607855] text-white font-bold text-xs lg:text-sm px-4 py-2 rounded-xl shadow-xs">
              {s.price}
            </div>
          </div>
        </section>

        {/* COLOANA MEDIA: Matematic perfectă pe Kiosk, fluidă și vizibilă pe ecran de telefon */}
        <section className="w-full flex items-center justify-center px-2 sm:px-6 lg:px-0">
          <div className="w-full aspect-[4/3] sm:aspect-video lg:aspect-square xl:aspect-[1.1] max-h-[35vh] sm:max-h-[45vh] lg:max-h-[60vh] xl:max-h-[65vh] relative rounded-2xl lg:rounded-[40px] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.06)] bg-black">
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

      {/* FIXED FOOTER: Caseta critică pentru chioșcuri comercial (Informații plată/rest) */}
      <footer className="w-full mt-6 lg:mt-0 pt-4 lg:pt-6 border-t border-black/5 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs z-30">
        <div className="text-amber-800 bg-amber-50 border border-amber-200/60 px-4 py-2 rounded-xl font-semibold max-w-full text-center sm:text-left">
          <span className="font-bold uppercase tracking-wider text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded mr-2">IMPORTANT</span> 
          {s.info}
        </div>
        <div className="text-black/40 font-bold tracking-widest uppercase text-[9px] shrink-0 pointer-events-none">
          Atingeți ecranul pentru a naviga
        </div>
      </footer>
    </div>
  );
}
