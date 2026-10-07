'use client';

import { useCallback, useEffect, useState, useRef } from 'react';

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
  
  // Contor ascuns pentru cele 5 apăsări de mentenanță
  const [secretClicks, setSecretClicks] = useState(0);
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const animTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const go = useCallback((d: number) => {
    setVisible(false);
    
    if (animTimeoutRef.current) clearTimeout(animTimeoutRef.current);
    
    animTimeoutRef.current = setTimeout(() => { 
      setIndex((v) => (v + d + SCREENS.length) % SCREENS.length); 
      setVisible(true); 
    }, 200);
  }, []);

  // Pornire sistem
  useEffect(() => {
    const timeout = setTimeout(() => setReady(true), 500);
    return () => clearTimeout(timeout);
  }, []);

  // Sincronizare stare Fullscreen
  useEffect(() => {
    const checkFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', checkFs);
    return () => document.removeEventListener('fullscreenchange', checkFs);
  }, []);

  // Auto-advance pentru slide-uri
  useEffect(() => {
    if (!ready) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    timeoutRef.current = setTimeout(() => go(1), SCREENS[index]?.ms || 8000);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [go, ready, index]);

  // Ceasul din colț (ro-RO)
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }));
    tick(); 
    const t = setInterval(tick, 1000); 
    return () => clearInterval(t);
  }, []);

  // Resetare contor secret dacă trece mai mult de 2 secunde între apăsări
  useEffect(() => {
    if (secretClicks === 0) return;
    const t = setTimeout(() => setSecretClicks(0), 2000);
    return () => clearTimeout(t);
  }, [secretClicks]);

  // Logica de control la atingere pe ecran
  const handleScreenTouch = () => {
    // Dacă nu este în Fullscreen, prima atingere îl blochează în Kiosk
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.()
        .then(() => setIsFullscreen(true))
        .catch((err) => console.error(err));
      setSecretClicks(0);
      return;
    }

    // Dacă este deja Fullscreen, numărăm apăsările rapide pentru mentenanță
    setSecretClicks((prev) => {
      const next = prev + 1;
      if (next >= 5) {
        document.exitFullscreen?.(); // Ieșire secretă din chioșc
        return 0;
      }
      return next;
    });
  };

  if (!ready) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-white text-slate-900 font-sans antialiased gap-3">
        <span className="w-10 h-10 rounded-full border-4 border-emerald-100 border-t-emerald-600 animate-spin" />
        <div className="text-xs tracking-[0.25em] font-bold text-emerald-700 uppercase">SISTEM ÎN PORNIRE...</div>
      </div>
    );
  }

  const s = SCREENS[index];

  return (
    <div 
      onClick={handleScreenTouch}
      className="relative w-screen h-screen overflow-hidden bg-white text-slate-800 font-sans flex flex-col justify-between p-6 md:p-10 lg:p-12 select-none cursor-none antialiased"
    >
      {/* Banner avertizare când NU este în modul complet */}
      {!isFullscreen && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-[11px] font-bold px-6 py-2 rounded-full z-50 animate-bounce pointer-events-none tracking-widest shadow-xl uppercase">
          Atingeți ecranul pentru Modul Chioșc Securizat
        </div>
      )}
      
      {/* Background Gradients */}
      <div className="absolute top-0 right-0 w-[45vw] h-[45vw] bg-emerald-50/40 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[35vw] h-[35vw] bg-green-50/50 rounded-full blur-[100px] pointer-events-none" />

      {/* HEADER */}
      <header className="h-[10vh] max-h-[80px] w-full flex justify-between items-center z-30 pointer-events-none border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3.5">
          <div className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-600"></span>
          </div>
          <div>
            <div className="text-sm font-black tracking-[0.2em] text-emerald-700 uppercase">FERMA NOASTRĂ</div>
            <div className="text-[10px] text-slate-400 tracking-wider font-semibold uppercase">Produs Natural Zilnic</div>
          </div>
        </div>
        <div className="bg-slate-50 border border-slate-100 px-6 py-2 rounded-2xl text-xl md:text-3xl font-extrabold tabular-nums text-slate-900 tracking-tight shadow-sm">
          {time}
        </div>
      </header>

      {/* MAIN CONTENT ZONE */}
      <main className={`flex-1 grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 lg:gap-16 items-center justify-center w-full max-w-7xl mx-auto pointer-events-none transition-all duration-300 ${visible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-1 scale-[0.99]'}`}>
        
        {/* TEXT STÂNGA */}
        <section className="w-full md:col-span-7 flex flex-col justify-center text-left z-10 max-h-full">
          <div className="mb-4">
            <span className="text-[10px] md:text-xs font-extrabold tracking-[0.15em] text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-lg uppercase">
              {s.label}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-black tracking-tight text-slate-950 leading-[1.12] whitespace-pre-line mb-4">
            {s.title}
          </h1>
          <p className="text-sm md:text-base lg:text-lg xl:text-xl leading-relaxed text-slate-600 max-w-2xl whitespace-pre-line mb-6 font-medium">
            {s.desc}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="bg-emerald-600 text-white font-extrabold tracking-wide text-xs md:text-sm px-6 py-3 rounded-xl shadow-md shadow-emerald-600/10 uppercase">
              {s.price}
            </div>
            <div className="text-[11px] md:text-xs text-slate-400 font-semibold tracking-wide bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
              {s.info}
            </div>
          </div>
        </section>

        {/* MEDIA DREAPTA (IMAGINE SAU VIDEO) */}
        <section className="w-full md:col-span-5 flex items-center justify-center h-[40vh] md:h-[60vh] max-h-[500px] relative z-10">
          <div className="w-full h-full rounded-3xl overflow-hidden shadow-2xl border border-slate-100 bg-slate-50 relative">
            {s.isVideo ? (
              <video
                key={s.src}
                src={s.src}
                autoPlay
                muted
                loop
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={s.img}
                alt={s.label}
                className="w-full h-full object-cover"
              />
            )}
          </div>
        </section>
      </main>

      {/* FOOTER - Indicatori Progres */}
      <footer className="h-[5vh] max-h-[40px] w-full flex justify-center items-center gap-2.5 z-30 pointer-events-none">
        {SCREENS.map((screen, idx) => (
          <div
            key={screen.id}
            className={`h-2 rounded-full transition-all duration-500 ${idx === index ? 'w-8 bg-emerald-600' : 'w-2 bg-slate-200'}`}
          />
        ))}
      </footer>
    </div>
  );
}
