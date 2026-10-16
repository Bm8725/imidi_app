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

  const glassBar: React.CSSProperties = {
    position: 'fixed',
    left: '50%',
    transform: 'translateX(-50%)',
    bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
    background: 'rgba(24, 24, 28, 0.65)',
    backdropFilter: 'blur(16px) saturate(140%)',
    WebkitBackdropFilter: 'blur(16px) saturate(140%)',
    color: '#F4F4F5',
    border: '1px solid rgba(167, 139, 250, 0.25)',
    borderRadius: 16,
    padding: '12px 18px',
    font: '600 14px system-ui, -apple-system, sans-serif',
    display: 'flex',
    gap: 14,
    alignItems: 'center',
    zIndex: 99999,
    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05) inset',
    animation: 'pwaSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
  };

  const mainBtn: React.CSSProperties = {
    background: '#67E8F9',
    color: '#0D0E12',
    border: 0,
    borderRadius: 10,
    padding: '8px 14px',
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: '-0.01em',
    transition: 'all 0.2s ease',
    boxShadow: '0 2px 8px rgba(103, 232, 249, 0.25)',
  };

  const secBtn: React.CSSProperties = {
    background: 'rgba(255, 255, 255, 0.06)',
    color: '#E4E4E7',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    padding: '8px 14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  };

  const iconStyle: React.CSSProperties = {
    width: 16,
    height: 16,
    display: 'block',
    objectFit: 'contain',
  };

  const textWrapper: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  };

  if (waiting) {
    return (
      <>
        <style>{`@keyframes pwaSlideUp { from { opacity: 0; transform: translate(-50%, 20px); } to { opacity: 1; transform: translate(-50%, 0); } }`}</style>
        <div role="status" style={glassBar}>
          <div style={textWrapper}>
            <img src="/favicon-16x16.png" alt="iMIDI" style={iconStyle} />
            <span>A new version of iMIDI is available</span>
          </div>
          <button style={mainBtn} onClick={() => waiting.postMessage('SKIP_WAITING')}>
            Update
          </button>
        </div>
      </>
    );
  }

  if (installEvt) {
    return (
      <>
        <style>{`@keyframes pwaSlideUp { from { opacity: 0; transform: translate(-50%, 20px); } to { opacity: 1; transform: translate(-50%, 0); } }`}</style>
        <div role="status" style={glassBar}>
          <div style={textWrapper}>
            <img src="/favicon-16x16.png" alt="iMIDI" style={iconStyle} />
            <span>Install iMIDI app</span>
          </div>
          <button
            style={mainBtn}
            onClick={async () => {
              await installEvt.prompt();
              await installEvt.userChoice;
              setInstallEvt(null);
            }}
          >
            Install
          </button>
          <button style={secBtn} onClick={() => setInstallEvt(null)}>
            Later
          </button>
        </div>
      </>
    );
  }

  return null;
}
