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
    whiteSpace: 'nowrap',
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
    whiteSpace: 'nowrap',
  };

  const iconStyle: React.CSSProperties = {
    width: 16,
    height: 16,
    display: 'block',
    objectFit: 'contain',
    flexShrink: 0,
  };

  const textWrapper: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexGrow: 1,
  };

  const actionsWrapper: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  };

  if (!waiting && !installEvt) return null;

  return (
    <>
      <style>{`
        /* Containerul principal - Setări implicite Desktop (Plutitor, Sus, Centrat) */
        .pwa-glass-bar {
          position: fixed;
          left: 50%;
          transform: translateX(-50%);
          top: calc(16px + env(safe-area-inset-top, 0px));
          background: rgba(24, 24, 28, 0.75);
          backdrop-filter: blur(20px) saturate(140%);
          -webkit-backdrop-filter: blur(20px) saturate(140%);
          color: '#F4F4F5';
          border: '1px solid rgba(167, 139, 250, 0.25)';
          border-radius: 16px;
          padding: 12px 18px;
          font-family: '600 14px system-ui, -apple-system, sans-serif';
          display: flex;
          gap: 16px;
          alignItems: center;
          zIndex: 99999;
          box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05) inset;
          animation: pwaSlideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          width: max-content;
          max-width: 90vw;
        }

        /* Animația de intrare de sus în jos */
        @keyframes pwaSlideDown {
          from { opacity: 0; transform: translate(-50%, -20px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }

        /* Regulă Responsive pentru Mobile (Ecrane sub 640px) */
        @media (max-width: 640px) {
          .pwa-glass-bar {
            left: 0 !important;
            right: 0 !important;
            top: 0 !important;
            transform: none !important;
            width: 100% !important;
            max-width: 100% !important;
            border-radius: 0 !important;
            border-left: 0 !important;
            border-right: 0 !important;
            border-top: 0 !important;
            border-bottom: 1px solid rgba(167, 139, 250, 0.2) !important;
            padding: calc(12px + env(safe-area-inset-top, 0px)) 16px 12px 16px !important;
            font-size: 13px !important;
            gap: 12px !important;
            justify-content: space-between;
          }
          
          @keyframes pwaSlideDown {
            from { opacity: 0; transform: translateY(-20px); }
            to { opacity: 1; transform: translateY(0); }
          }
        }
      `}</style>

      <div role="status" className="pwa-glass-bar">
        <div style={textWrapper}>
          <img src="/favicon-16x16.png" alt="iMIDI" style={iconStyle} />
          <span>
            {waiting ? 'A new version of iMIDI is available' : 'Install iMIDI app'}
          </span>
        </div>
        
        <div style={actionsWrapper}>
          {waiting ? (
            <button style={mainBtn} onClick={() => waiting.postMessage('SKIP_WAITING')}>
              Update
            </button>
          ) : (
            <>
              <button
                style={mainBtn}
                onClick={async () => {
                  await installEvt!.prompt();
                  await installEvt!.userChoice;
                  setInstallEvt(null);
                }}
              >
                Install
              </button>
              <button style={secBtn} onClick={() => setInstallEvt(null)}>
                Later
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
