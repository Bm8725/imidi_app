'use client';

import { useEffect, useState } from 'react';

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export default function PWA() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [installEvt, setInstallEvt] = useState<InstallEvent | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || process.env.NODE_ENV !== 'production') return;

    let reloaded = false;
    const onController = () => {
      if (reloaded) return;
      reloaded = true;
      location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onController);

    let timer: ReturnType<typeof setInterval>;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).then((reg) => {
      const watch = (w: ServiceWorker) =>
        w.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) setWaiting(w);
        });
      if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);
      reg.addEventListener('updatefound', () => reg.installing && watch(reg.installing));
      timer = setInterval(() => reg.update(), 60 * 60 * 1000);
    });

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as InstallEvent);
    };
    const onInstalled = () => setInstallEvt(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      clearInterval(timer);
      navigator.serviceWorker.removeEventListener('controllerchange', onController);
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!waiting && !installEvt) return null;

  return (
    <div 
      role="status" 
      className="fixed left-1/2 -translate-x-1/2 z-[999999] flex items-center justify-between sm:justify-start gap-3 sm:gap-4 p-3 sm:px-4 sm:py-3 font-sans font-semibold text-sm text-[#F4F4F5] border border-purple-500/25 bg-[#18181C]/75 backdrop-blur-xl saturate-140 shadow-[0_12px_40px_rgba(0,0,0,0.6),inset_0_0_0_1px_rgba(255,255,255,0.05)] animate-[pwaSlideDown_0.4s_cubic-bezier(0.16,1,0.3,1)_forwards]
        top-[calc(64px+env(safe-area-inset-top,0px))] w-[calc(100%-24px)] max-w-[calc(100%-24px)] rounded-xl
        sm:top-[calc(24px+env(safe-area-inset-top,0px))] sm:w-max sm:max-w-[90vw] sm:rounded-2xl"
    >
      {/* Stilul pentru animație (singurul lucru care nu e direct utilitar standard) */}
      <style>{`
        @keyframes pwaSlideDown {
          from { opacity: 0; transform: translate(-50%, -15px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>

      {/* Secțiunea Text + Iconiță */}
      <div className="flex items-center gap-2 grow">
        <img 
          src="/favicon-16x16.png" 
          alt="iMIDI" 
          className="w-4 h-4 block object-contain shrink-0" 
        />
        <span>
          {waiting ? 'A new version of iMIDI is available' : 'Install iMIDI app'}
        </span>
      </div>
      
      {/* Secțiunea Butoane */}
      <div className="flex items-center gap-2.5">
        {waiting ? (
          <button 
            className="bg-[#67E8F9] color-[#0D0E12] border-0 rounded-xl px-3.5 py-2 font-bold cursor-pointer tracking-tight transition-all duration-200 ease-in-out shadow-[0_2px_8px_rgba(103,232,249,0.25)] whitespace-nowrap hover:opacity-90"
            onClick={() => waiting.postMessage('SKIP_WAITING')}
          >
            Update
          </button>
        ) : (
          <>
            <button
              className="bg-[#67E8F9] text-[#0D0E12] border-0 rounded-xl px-3.5 py-2 font-bold cursor-pointer tracking-tight transition-all duration-200 ease-in-out shadow-[0_2px_8px_rgba(103,232,249,0.25)] whitespace-nowrap hover:opacity-90"
              onClick={async () => {
                await installEvt!.prompt();
                await installEvt!.userChoice;
                setInstallEvt(null);
              }}
            >
              Install
            </button>
            <button 
              className="bg-white/5 text-[#E4E4E7] border border-white/10 rounded-xl px-3.5 py-2 font-semibold cursor-pointer transition-all duration-200 ease-in-out whitespace-nowrap hover:bg-white/10"
              onClick={() => setInstallEvt(null)}
            >
              Later
            </button>
          </>
        )}
      </div>
    </div>
  );
}
