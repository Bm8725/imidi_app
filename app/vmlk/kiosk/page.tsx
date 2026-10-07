'use client';

// Forțează Next.js să genereze pagina complet static la build (SSG).
// În Next.js 15/16, utilizarea lui 'force-static' este suficientă 
// pentru a opri orice solicitare ulterioară către CDN/Server.
export const dynamic = 'force-static';

import { useCallback, useEffect, useState } from 'react';

const SCREENS = [
  { id: 'video', label: 'PREZENTARE VIDEO', title: 'De la ferma noastră, direct la tine', desc: 'Urmărește drumul laptelui proaspăt în fiecare zi.', price: 'Puritate 100%', info: 'Aparatul NU dă rest! Introduceți suma exactă.', isVideo: true, src: '/milk.mp4', ms: 12000 },
  { id: '1', label: 'PROASPĂT ZILNIC', title: 'Lapte de la fermă.\nPur și rece.', desc: 'Colectat în fiecare dimineață din ferma locală și menținut constant la temperatura optimă de 4°C.', price: '6.00 lei / litru', info: 'Aparatul NU dă rest! Introduceți suma exactă.', img: '/milk1.jpeg', ms: 9000 },
  { id: '2', label: 'GHID DE CUMPĂRARE', title: 'Cum cumperi în doar 3 pași:', desc: '1. Deschide ușa și introdu sticla sub dozator.\n2. Introdu banii cash (fise sau bancnote).\n3. Apasă butonul mare START.', price: 'Plată exclusiv CASH', info: 'Atenție: NU se acceptă plata cu card bancar.', img: '/milk2.webp', ms: 14000 },
  { id: '3', label: 'SĂNĂTATE CURATĂ', title: '100% Natural.\nDirect de la sursă.', desc: 'Lapte crud neprocesat, fără aditivi sau conservanți. Produs local pur, testat și certificat zilnic.', price: 'Direct de la fermă', info: 'Gustul autentic și proaspăt în fiecare zi.', img: '/milk3.jpg', ms: 9000 }
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
    setTimeout(() => { setIndex((v) => (v + d + SCREENS.length) % SCREENS.length); setVisible(true); }, 200);
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
    const onTouchOrMove = () => { setHideCursor(false); clearTimeout(t); t = window.setTimeout(() => setHideCursor(true), 4000); };
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
    <div className={`relative flex w-screen h-screen bg-[#FBFBF9] text-[#1C1612] font-sans p-8 xl:p-20 select-none overflow-hidden transition-all duration-500 ${hideCursor ? 'cursor-none' : 'cursor-default'}`} onClick={(e) => go(e.clientX / window.innerWidth > 0.5 ? 1 : -1)}>
      <div className="absolute top-0 right-0 w-[40vw] h-[40vw] bg-[#607855]/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Top Bar Fixă */}
      <div className="absolute top-0 left-0 right-0 flex justify-between items-center px-8 py-8 xl:px-20 xl:py-12 z-30 pointer-events-none">
        <div className={`text-[10px] font-black tracking-[0.25em] text-[#607855] uppercase transition-all duration-500 ${hideCursor ? 'opacity-0' : 'opacity-100'}`}>
          {s.isVideo ? '✦ Live Stream' : '✦ Ferma Noastră'}
        </div>
        <div className="flex items-center gap-6 pointer-events-auto">
          <button onClick={(e) => { e.stopPropagation(); document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.().catch(() => {}); }} className={`bg-[#111]/5 hover:bg-[#111]/10 px-5 py-2.5 rounded-full text-[11px] font-bold tracking-wider transition-all duration-300 ${hideCursor ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>{full ? 'ECRAN RESTRÂNS' : 'ECRAN COMPLET'}</button>
          <div className="bg-white/80 border border-[#111]/5 px-6 py-2.5 rounded-2xl text-2xl font-bold tracking-tight shadow-sm text-[#111]">{time}</div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className={`relative flex w-full h-full items-center gap-[8%] z-10 transition-all duration-300 ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.995]'}`}>
        {s.isVideo ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-full h-[72vh] relative rounded-[40px] overflow-hidden shadow-[0_30px_60px_-15px_rgba(0,0,0,0.08)] bg-black">
              <video src={s.src} autoPlay muted playsInline loop onEnded={() => go(1)} className="w-full h-full object-cover opacity-90" />
              <div className="absolute bottom-8 left-8 right-8 bg-white/90 backdrop-blur-md p-8 rounded-3xl max-w-xl text-[#111] shadow-xl">
                <span className="text-[10px] font-black tracking-widest text-[#607855] uppercase block mb-2">PREZENTARE</span>
                <h2 className="text-3xl font-black mb-2 tracking-tight leading-tight">{s.title}</h2>
                <p className="text-sm text-[#111]/70 leading-relaxed font-medium">{s.desc}</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-[1.1] flex flex-col justify-center max-xl:items-center max-xl:text-center w-full">
              <span className="text-[10px] font-black tracking-[0.2em] text-[#607855] uppercase mb-4 block">// {s.label}</span>
              <h1 className="text-5xl xl:text-7xl font-black tracking-tight text-[#111] mb-6 leading-[1.05] whitespace-pre-line">{s.title}</h1>
              <p className="text-lg xl:text-xl leading-relaxed text-[#111]/60 mb-10 max-w-[500px] whitespace-pre-line font-medium">{s.desc}</p>
              <div className="flex flex-col gap-4 max-xl:items-center">
                <div className="text-4xl xl:text-5xl font-black text-[#111] tracking-tight">{s.price}</div>
                <div className="inline-flex items-center gap-3 bg-[#607855]/5 border border-[#607855]/10 px-5 py-3.5 rounded-2xl max-w-fit"><span className="text-xs font-bold text-[#607855] tracking-wide">⚠️ {s.info}</span></div>
              </div>
            </div>
            <div className="flex-1 w-full h-[68vh] relative rounded-[48px] overflow-hidden shadow-[0_40px_80px_-20px_rgba(0,0,0,0.06)] bg-white max-xl:h-[35vh]">{s.img && <img src={s.img} alt={s.title} className="w-full h-full object-cover transition-transform duration-1000 hover:scale-102" />}</div>
          </>
        )}
      </div>

      {/* Progress Dots */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-3 z-30">
        {SCREENS.map((_, idx) => (
          <div key={idx} className={`h-1 rounded-full transition-all duration-300 ${idx === index ? 'w-10 bg-[#607855]' : 'w-2 bg-[#111]/10'}`} />
        ))}
      </div>
    </div>
  );
}
