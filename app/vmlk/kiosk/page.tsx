'use client';

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

/* ───────────── CONFIGURARE (schimbi aici, nu prin cod) ───────────── */

const CONFIG = {
  servicePhone: '+40 765 332 178',
  // Completează ca să apară slide-ul „Producător”. Câmpurile goale nu se afișează.
  producer: { name: '', farm: '', authorization: '' },
  // Mențiune permanentă în subsol. Lasă '' ca s-o ascunzi. VERIFICĂ formularea legală!
  rawMilkNotice: 'Lapte crud. Se recomandă fierberea înainte de consum.',
  reloadHour: 4, // reîncărcare automată zilnică (curăță memoria, preia versiunea nouă)
};

type Screen = {
  id: string; label: string; title: string; badge: string;
  desc?: string; steps?: string[]; facts?: { label: string; value: string }[]; info?: string;
  isVideo?: boolean; src?: string; img?: string; ms: number;
};

const SHIFTS = [[0, 0], [2, 1], [0, 2], [-2, 1]];

const BASE_SCREENS: Screen[] = [
  { id: 'video', label: 'Prezentare video', title: 'De la ferma noastră,\ndirect la tine', desc: 'Urmărește drumul laptelui proaspăt în fiecare zi.', badge: 'Puritate 100%', isVideo: true, src: '/milk.mp4', ms: 12000 },
  { id: '1', label: 'Proaspăt zilnic', title: 'Lapte de la fermă.\nPur și rece.', desc: 'Colectat în fiecare dimineață din ferma locală și menținut constant la temperatura optimă de 4°C.', badge: 'Direct de la fermă', img: '/milk1.jpeg', ms: 9000 },
  { id: 'igiena', label: 'Igienă', title: 'Spălat la fiecare\numplere a rezervorului.', desc: 'La fiecare alimentare, circuitul aparatului este spălat cu detergent industrial, înainte de a fi umplut cu lapte proaspăt.', badge: 'Spălare la fiecare umplere', img: '/milk3.jpg', ms: 9000 },
  { id: '2', label: 'Ghid de cumpărare', title: 'Cum cumperi în\ndoar 3 pași:', steps: ['Deschide ușa și introdu sticla sub dozator.', 'Introdu banii cash (doar bancnote).', 'Apasă butonul mare START.'], badge: 'Plată exclusiv CASH', info: 'Atenție: NU se acceptă plata cu card bancar.', img: '/milk2.webp', ms: 14000 },
  { id: '3', label: 'Sănătate curată', title: '100% Natural.\nDirect de la sursă.', desc: 'Lapte crud neprocesat, fără aditivi sau conservanți. Produs local pur, testat și certificat zilnic.', badge: 'Certificat Zilnic', info: 'Gustul autentic și proaspăt în fiecare zi.', img: '/milk3.jpg', ms: 9000 },
];

const producerFacts = [
  { label: 'Producător', value: CONFIG.producer.name },
  { label: 'Fermă', value: CONFIG.producer.farm },
  { label: 'Autorizație', value: CONFIG.producer.authorization },
].filter((f) => f.value.trim());

const SCREENS: Screen[] = [
  ...BASE_SCREENS,
  ...(producerFacts.length
    ? [{ id: 'producator', label: 'Informații producător', title: 'Știi exact\nde unde vine.', facts: producerFacts, badge: 'Trasabilitate', img: '/milk1.jpeg', ms: 9000 } as Screen]
    : []),
];

/* ───────────── PIESE MICI ───────────── */

function MilkDrop({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 2.5c3.2 4.1 6 7.2 6 11a6 6 0 0 1-12 0c0-3.8 2.8-6.9 6-11Z" />
    </svg>
  );
}

function Rule({ icon, slash = false, light = false, children }: { icon: 'coin' | 'note' | 'card'; slash?: boolean; light?: boolean; children: string }) {
  return (
    <span className={`flex items-center gap-2 px-4 text-xs font-medium first:pl-0 md:text-sm ${light ? 'text-white/90' : 'text-slate-600'}`}>
      <svg viewBox="0 0 24 24" className={`h-4 w-4 shrink-0 ${light ? 'text-white/70' : 'text-slate-500'}`} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden>
        {icon === 'coin' && <circle cx="12" cy="12" r="9" />}
        {icon === 'note' && (<><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></>)}
        {icon === 'card' && (<><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></>)}
        {slash && <path d="M4 20 20 4" />}
      </svg>
      {children}
    </span>
  );
}

function Rules({ light = false }: { light?: boolean }) {
  return (
    <div className={`flex items-center divide-x ${light ? 'divide-white/25' : 'divide-slate-200'}`}>
      <Rule icon="coin" slash light={light}>Fără rest</Rule>
      <Rule icon="note" light={light}>Doar bancnote</Rule>
      <Rule icon="card" slash light={light}>Fără card</Rule>
    </div>
  );
}

function TopBar({ date, time, light = false }: { date: string; time: string; light?: boolean }) {
  return (
    <header className={`pointer-events-none flex shrink-0 items-center justify-between border-b pb-[clamp(0.5rem,2vh,1.25rem)] ${light ? 'border-white/15' : 'border-slate-200'}`}>
      <div className="flex items-center gap-3">
        <span className={`flex h-10 w-10 items-center justify-center rounded-md text-white ${light ? 'bg-white/15 ring-1 ring-white/30' : 'bg-emerald-700'}`}>
          <MilkDrop className="h-5 w-5" />
        </span>
        <div className="leading-tight">
          <div className={`text-lg font-semibold tracking-tight ${light ? 'text-white' : 'text-slate-900'}`}>
            Vender<span className={light ? 'text-emerald-300' : 'text-emerald-700'}>Milk</span>
            <span className={`ml-2 text-xs font-normal ${light ? 'text-white/50' : 'text-slate-400'}`}>v1.13.2</span>
          </div>
          <div className={`text-xs [@media(max-height:560px)]:hidden ${light ? 'text-white/65' : 'text-slate-500'}`}>Stație automatizată</div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className={`hidden text-right text-xs capitalize sm:block ${light ? 'text-white/70' : 'text-slate-500'}`}>{date}</div>
        <div className={`hidden h-6 w-px sm:block ${light ? 'bg-white/20' : 'bg-slate-200'}`} />
        <div className={`text-2xl font-semibold tabular-nums tracking-tight ${light ? 'text-white' : 'text-slate-900'}`}>{time}</div>
      </div>
    </header>
  );
}

function InfoFooter({ light = false }: { light?: boolean }) {
  return (
    <footer className={`pointer-events-none shrink-0 border-t pt-[clamp(0.5rem,2vh,1.25rem)] ${light ? 'border-white/20' : 'border-slate-200'}`}>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <Rules light={light} />
        <div className={`text-xs ${light ? 'text-white/70' : 'text-slate-500'}`}>
          Support <span className={`font-medium tabular-nums ${light ? 'text-white' : 'text-slate-800'}`}>{CONFIG.servicePhone}</span>
        </div>
      </div>
      {CONFIG.rawMilkNotice && <p className={`mt-2 text-xs [@media(max-height:620px)]:hidden ${light ? 'text-white/60' : 'text-slate-500'}`}>{CONFIG.rawMilkNotice}</p>}
    </footer>
  );
}

function ProgressBar({ index, light = false }: { index: number; light?: boolean }) {
  const s = SCREENS[index];
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex gap-0.5" aria-hidden>
      {SCREENS.map((sc, i) => (
        <span key={sc.id} className={`relative h-1.5 flex-1 overflow-hidden ${light ? 'bg-white/25' : 'bg-slate-200'}`}>
          {i < index && <span className={`absolute inset-0 ${light ? 'bg-white' : 'bg-emerald-700'}`} />}
          {i === index && (
            <span
              key={index}
              className={`absolute inset-0 origin-left ${light ? 'bg-white' : 'bg-emerald-700'}`}
              style={{ animation: `kioskSeg ${s.ms}ms linear forwards` }}
            />
          )}
        </span>
      ))}
    </div>
  );
}

/* ───────────── KIOSK ───────────── */

export default function MilkKiosk() {
  const [index, setIndex] = useState(0);
  const [time, setTime] = useState('');
  const [date, setDate] = useState('');
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [secretClicks, setSecretClicks] = useState(0);
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const [shift, setShift] = useState(0);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wakeLockRef = useRef<any>(null);
  const reloadingRef = useRef(false);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);

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
    const t = setTimeout(() => setReady(true), 500);
    return () => clearTimeout(t);
  }, []);

  // Anti-sleep (Screen Wake Lock), reluat automat când revine tab-ul
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    const request = async () => {
      try {
        const nav = navigator as any;
        if (!nav.wakeLock) return;
        const lock = await nav.wakeLock.request('screen');
        if (cancelled) { lock.release().catch(() => {}); return; }
        wakeLockRef.current = lock;
        lock.addEventListener('release', () => {
          if (wakeLockRef.current === lock) wakeLockRef.current = null;
        });
      } catch (err) {
        console.warn('Wake Lock indisponibil:', err);
      }
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible' && !wakeLockRef.current) request();
    };

    request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      wakeLockRef.current?.release?.().catch(() => {});
      wakeLockRef.current = null;
    };
  }, [ready]);

  // Stare Fullscreen
  useEffect(() => {
    const check = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', check);
    return () => document.removeEventListener('fullscreenchange', check);
  }, []);

  // Auto-advance
  useEffect(() => {
    if (!ready) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => go(1), SCREENS[index]?.ms || 8000);
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [go, ready, index]);

  // Preîncarcă imaginea următoare (fără sclipiri la schimbare)
  useEffect(() => {
    const next = SCREENS[(index + 1) % SCREENS.length];
    if (next.img) { const im = new Image(); im.src = next.img; }
  }, [index]);

  // Ceas, dată și reîncărcare zilnică
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setTime(d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }));
      setDate(d.toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' }));
      if (d.getHours() === CONFIG.reloadHour && d.getMinutes() === 0 && !reloadingRef.current) {
        const key = `vmlk-reload-${d.toDateString()}`;
        let done = false;
        try { done = !!sessionStorage.getItem(key); } catch { /* storage indisponibil */ }
        if (!done) {
          reloadingRef.current = true;
          // Reîncarcă doar dacă serverul răspunde; altfel rămâne pagina curentă
          fetch(window.location.href, { method: 'HEAD', cache: 'no-store' })
            .then((r) => {
              if (!r.ok) return;
              try { sessionStorage.setItem(key, '1'); } catch { /* ignorat */ }
              window.location.reload();
            })
            .catch(() => {})
            .finally(() => { reloadingRef.current = false; });
        }
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  // Micro-deplasare a layout-ului din minut în minut (protecție burn-in, nu se observă)
  useEffect(() => {
    const t = setInterval(() => setShift((v) => (v + 1) % SHIFTS.length), 60000);
    return () => clearInterval(t);
  }, []);

  // Resetare contor secret după 2 s fără apăsări
  useEffect(() => {
    if (secretClicks === 0) return;
    const t = setTimeout(() => setSecretClicks(0), 2000);
    return () => clearTimeout(t);
  }, [secretClicks]);

  // Atingere: prima = intră în Fullscreen; apoi 5 rapide = ieșire de mentenanță
  const handleTap = () => {
    if (!document.fullscreenElement) {
      const el = document.documentElement as any;
      (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el)?.catch?.((e: unknown) => console.error(e));
      setSecretClicks(0);
      return;
    }
    setSecretClicks((prev) => {
      if (prev + 1 >= 5) { document.exitFullscreen?.(); return 0; }
      return prev + 1;
    });
  };

  // Swipe stânga/dreapta = navigare; atingere scurtă = logica de mentenanță
  const onPointerDown = (e: ReactPointerEvent) => { pointerStart.current = { x: e.clientX, y: e.clientY }; };
  const onPointerUp = (e: ReactPointerEvent) => {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
    else if (Math.hypot(dx, dy) < 12) handleTap();
  };

  if (!ready) {
    return (
      <div className="flex h-[100dvh] w-screen flex-col items-center justify-center gap-3 bg-white font-sans antialiased">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-700" />
        <div className="text-sm font-medium text-slate-500">Se încarcă…</div>
      </div>
    );
  }

  const s = SCREENS[index];
  const mediaOk = !failed[s.id] && (s.isVideo ? !!s.src : !!s.img);
  const markFailed = () => setFailed((f) => ({ ...f, [s.id]: true }));

  const [dx, dy] = SHIFTS[shift];
  const immersive = !!s.isVideo && mediaOk;
  const pad = 'px-[clamp(1.25rem,4vw,5rem)] py-[clamp(0.75rem,3vh,2.5rem)]';
  const shiftStyle = { transform: `translate(${dx}px, ${dy}px)`, transition: 'transform 3s ease' };

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => { pointerStart.current = null; }}
      style={{ touchAction: 'none' }}
      className="relative h-[100dvh] w-screen cursor-none select-none overflow-hidden bg-white font-sans text-slate-900 antialiased"
    >
      <style>{`
        @keyframes kioskSeg { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        @keyframes kioskRise { from { opacity: 0; transform: translateY(28px); } to { opacity: 1; transform: none; } }
        @keyframes kioskLine { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        @keyframes kioskZoom { from { transform: scale(1); } to { transform: scale(1.07); } }
        @keyframes kioskFade { from { opacity: 0; } to { opacity: 1; } }
        .k-rise { opacity: 0; animation: kioskRise .8s cubic-bezier(.2,.7,.2,1) forwards; }
        .k-line { transform-origin: left; animation: kioskLine .7s ease-out forwards; }
        .k-fade { opacity: 0; animation: kioskFade .9s ease-out forwards; }
        .k-zoom { animation: kioskZoom 16s ease-out forwards; }
        @media (prefers-reduced-motion: reduce) {
          .k-rise, .k-fade { opacity: 1; animation: none; }
          .k-line, .k-zoom { animation: none; }
        }
      `}</style>

      {!isFullscreen && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-50 bg-slate-900 py-2 text-center text-xs font-medium tracking-wide text-white">
          Atingeți ecranul pentru Modul Chioșc Securizat
        </div>
      )}

      {immersive ? (
        /* ── SLIDE VIDEO: ecran complet, text care intră pe rând ── */
        <div className={`absolute inset-0 bg-slate-950 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}>
          <video
            key={s.id}
            src={s.src}
            autoPlay loop muted playsInline preload="auto"
            onError={markFailed}
            className="k-zoom absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-slate-950/30" />

          <div className={`relative flex h-full flex-col justify-between ${pad}`} style={shiftStyle}>
            <TopBar date={date} time={time} light />

            <div className="pointer-events-none min-h-0 max-w-4xl pb-4">
              <div className="mb-[clamp(0.5rem,2vh,1.25rem)] flex items-center gap-3 text-sm font-semibold text-emerald-300 md:text-base">
                <span className="k-line h-px w-10 bg-emerald-300" style={{ animationDelay: '0.2s' }} />
                <span className="k-rise" style={{ animationDelay: '0.3s' }}>{s.label}</span>
              </div>

              <h1 className="mb-[clamp(0.5rem,2vh,1.25rem)] text-[clamp(1.9rem,min(6vw,9vh),5rem)] font-semibold leading-[1.05] tracking-tight text-white drop-shadow-lg">
                {s.title.split('\n').map((line, i) => (
                  <span key={i} className="k-rise block" style={{ animationDelay: `${0.5 + i * 0.25}s` }}>{line}</span>
                ))}
              </h1>

              {s.desc && (
                <p className="k-rise max-w-2xl text-[clamp(0.9rem,min(2vw,2.8vh),1.4rem)] leading-relaxed text-white/85" style={{ animationDelay: '1.1s' }}>
                  {s.desc}
                </p>
              )}

              <span
                className="k-rise mt-[clamp(0.75rem,3vh,2rem)] inline-flex items-center gap-2 rounded-md border border-white/40 px-3 py-1.5 text-sm font-semibold text-white"
                style={{ animationDelay: '1.4s' }}
              >
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                {s.badge}
              </span>
            </div>

            <div className="k-fade" style={{ animationDelay: '1.6s' }}>
              <InfoFooter light />
            </div>
          </div>
        </div>
      ) : (
        /* ── SLIDE-URI NORMALE ── */
        <div className={`flex h-full flex-col ${pad}`} style={shiftStyle}>
          <TopBar date={date} time={time} />

          <main
            className={`pointer-events-none mx-auto grid min-h-0 w-full max-w-7xl flex-1 grid-cols-1 items-center gap-[clamp(1rem,3vw,4rem)] py-[clamp(0.5rem,2vh,1.5rem)] transition-opacity duration-300 md:auto-rows-[minmax(0,1fr)] md:grid-cols-12 ${
              visible ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <section className="flex min-h-0 flex-col justify-center text-left md:col-span-7">
              <div className="mb-[clamp(0.5rem,2vh,1.25rem)] flex items-center gap-3 text-sm font-semibold text-emerald-700 md:text-base">
                <span className="h-px w-8 bg-emerald-700" />
                {s.label}
              </div>

              <h1 className="mb-[clamp(0.5rem,2vh,1.25rem)] whitespace-pre-line text-[clamp(1.6rem,min(5vw,7.5vh),3.75rem)] font-semibold leading-[1.1] tracking-tight text-slate-900">
                {s.title}
              </h1>

              {s.steps ? (
                <ol className="max-w-xl divide-y divide-slate-200 border-y border-slate-200">
                  {s.steps.map((t, i) => (
                    <li key={i} className="flex items-center gap-4 py-[clamp(0.4rem,1.6vh,1rem)]">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-emerald-700 text-sm font-semibold text-emerald-700 md:h-10 md:w-10 md:text-base">
                        {i + 1}
                      </span>
                      <span className="text-[clamp(0.9rem,min(2vw,2.8vh),1.4rem)] text-slate-800">{t}</span>
                    </li>
                  ))}
                </ol>
              ) : s.facts ? (
                <dl className="max-w-xl divide-y divide-slate-200 border-y border-slate-200">
                  {s.facts.map((f) => (
                    <div key={f.label} className="flex items-baseline justify-between gap-6 py-[clamp(0.4rem,1.6vh,1rem)]">
                      <dt className="text-sm text-slate-500 md:text-base">{f.label}</dt>
                      <dd className="text-right text-base font-semibold text-slate-900 md:text-lg lg:text-xl">{f.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="max-w-xl whitespace-pre-line text-[clamp(0.9rem,min(2vw,2.8vh),1.4rem)] leading-relaxed text-slate-600">
                  {s.desc}
                </p>
              )}

              <div className="mt-[clamp(0.75rem,3vh,2rem)] flex flex-wrap items-center gap-x-5 gap-y-2">
                <span className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-800">
                  <span className="h-2 w-2 rounded-full bg-emerald-600" />
                  {s.badge}
                </span>
                {s.info && <span className="text-sm text-slate-500">{s.info}</span>}
              </div>
            </section>

            <section className="flex h-full min-h-0 w-full items-center justify-center md:col-span-5">
              <div className="w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-50 md:h-full md:max-h-[65vh]">
                {mediaOk && !s.isVideo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={s.id} src={s.img} alt={s.label} draggable={false} onError={markFailed}
                    className="h-auto max-h-[40vh] w-full object-cover md:h-full md:max-h-none" />
                ) : (
                  <div className="flex aspect-[4/3] w-full items-center justify-center md:aspect-auto md:h-full">
                    <MilkDrop className="h-16 w-16 text-slate-300" />
                  </div>
                )}
              </div>
            </section>
          </main>

          <InfoFooter />
        </div>
      )}

      <ProgressBar index={index} light={immersive} />
    </div>
  );
}