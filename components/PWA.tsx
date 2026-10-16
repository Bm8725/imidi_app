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

  const bar: React.CSSProperties = {
    position: 'fixed',
    left: '50%',
    transform: 'translateX(-50%)',
    bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
    background: '#18181C',
    color: '#fff',
    border: '1px solid #A78BFA',
    borderRadius: 12,
    padding: '10px 14px',
    font: '14px system-ui, sans-serif',
    display: 'flex',
    gap: 12,
    alignItems: 'center',
    zIndex: 99999,
  };
  const btn: React.CSSProperties = {
    background: '#67E8F9',
    color: '#0D0E12',
    border: 0,
    borderRadius: 8,
    padding: '6px 10px',
    fontWeight: 600,
    cursor: 'pointer',
  };

  if (waiting) {
    return (
      <div role="status" style={bar}>
        <span>New version available</span>
        <button style={btn} onClick={() => waiting.postMessage('SKIP_WAITING')}>Update</button>
      </div>
    );
  }

  if (installEvt) {
    return (
      <div role="status" style={bar}>
        <span>Install iMIDI</span>
        <button
          style={btn}
          onClick={async () => {
            await installEvt.prompt();
            await installEvt.userChoice;
            setInstallEvt(null);
          }}
        >
          Install
        </button>
        <button style={{ ...btn, background: 'transparent', color: '#fff' }} onClick={() => setInstallEvt(null)}>
          Not now
        </button>
      </div>
    );
  }

  return null;
}