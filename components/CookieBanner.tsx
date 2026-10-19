"use client";

import React, { useState, useEffect } from "react";

interface CookieSettings {
  essential: boolean;
  preferences: boolean; // remembers UI choices (theme, keyboard, controls, screen-awake)
  midiAndPresets: boolean; // in-browser audio pre-listening + synth mapping
  mediaUpload: boolean; // local cache for uploaded artwork / pack covers
  analytics: boolean;
}

const COOKIE_KEY = "imidi_cookies_preferences";
const CONSENT_VERSION = 2; // raise it whenever purposes change: everyone is asked again
const PRIVACY_URL = "/privacy"; // change to your real privacy page ("" hides the link)
const OPEN_EVENT = "imidi_open_cookie_settings";

// Nothing optional is pre-ticked: consent has to be an active choice.
const ALL_OFF: CookieSettings = { essential: true, preferences: false, midiAndPresets: false, mediaUpload: false, analytics: false };
const ALL_ON: CookieSettings = { essential: true, preferences: true, midiAndPresets: true, mediaUpload: true, analytics: true };

// localStorage keys written by the AirMIDI page for "Remember my settings": removed when that choice is off
const UI_PREF_KEYS = ["airmidi-theme", "airmidi-kb-on", "airmidi-kb-size", "airmidi-ctl-on", "airmidi-ctl-hidden", "airmidi-awake"];

/* ───────────── helpers other parts of the app can import ───────────── */
export function readConsent(): CookieSettings | null {
  try {
    const raw = localStorage.getItem(COOKIE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p || p.version !== CONSENT_VERSION) return null;
    return {
      essential: true,
      preferences: !!p.preferences,
      midiAndPresets: !!p.midiAndPresets,
      mediaUpload: !!p.mediaUpload,
      analytics: !!p.analytics,
    };
  } catch {
    return null;
  }
}

export function hasConsent(key: keyof CookieSettings): boolean {
  if (key === "essential") return true;
  return !!readConsent()?.[key];
}

// call it from a footer link: <button onClick={openCookieSettings}>Cookie settings</button>
export function openCookieSettings() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(OPEN_EVENT));
}

/* ───────────── small UI pieces ───────────── */
const ico = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const Icon = ({ name }: { name: "video" | "keys" | "db" | "photo" }) => (
  <svg className="w-4 h-4" {...ico} aria-hidden>
    {name === "video" && (
      <>
        <path d="M23 7l-7 5 7 5V7z" />
        <rect x="1" y="5" width="15" height="14" rx="2" />
      </>
    )}
    {name === "keys" && (
      <>
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="M7 4v8M12 4v16M17 4v8" />
      </>
    )}
    {name === "db" && (
      <>
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
      </>
    )}
    {name === "photo" && (
      <>
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
      </>
    )}
  </svg>
);

function Toggle({ on, label, onChange }: { on: boolean; label: string; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      className={`relative shrink-0 mt-0.5 h-5 w-9 rounded-full border transition-colors cursor-pointer ${
        on ? "bg-[#B4592F] border-[#B4592F]" : "bg-white/10 border-white/20"
      }`}
    >
      <span className={`absolute top-[2px] left-[2px] h-3.5 w-3.5 rounded-full bg-white transition-transform ${on ? "translate-x-4" : ""}`} />
    </button>
  );
}

function Row({ title, text, on, onChange }: { title: string; text: string; on: boolean; onChange: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 cursor-pointer group" onClick={onChange}>
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-bold text-white transition-colors group-hover:text-[#B4592F]">{title}</span>
        <span className="text-[11px] text-gray-400/80 leading-normal">{text}</span>
      </div>
      <Toggle on={on} label={title} onChange={onChange} />
    </div>
  );
}

const DEVICE_INFO: { icon: "video" | "keys" | "db" | "photo"; title: string; text: string }[] = [
  {
    icon: "video",
    title: "Camera & microphone",
    text: "Off until you press Camera or Mic, and your browser asks first. Video and voice travel directly between the people in the session, encrypted. iMIDI does not record or store them, and does not use face or voice recognition.",
  },
  {
    icon: "keys",
    title: "MIDI devices",
    text: "Your browser asks before sharing a MIDI device (SysEx is a separate permission). MIDI messages reach the other person only while the session is live.",
  },
  {
    icon: "db",
    title: "Session details we keep",
    text: "To pair devices and count your hours we keep the room code, device names, start and end times and duration of each session, linked to your account.",
  },
  {
    icon: "photo",
    title: "Photos",
    text: "The Photo button saves a picture on your device. It is uploaded to a public link only if you press Share with a live picture.",
  },
];

/* ───────────── component ───────────── */
export default function CookieBanner() {
  const [isOpen, setIsOpen] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [settings, setSettings] = useState<CookieSettings>(ALL_OFF);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const saved = readConsent();
    if (saved) {
      setSettings(saved);
      applyCookieLogic(saved);
    } else {
      timer = setTimeout(() => setIsOpen(true), 1200);
    }
    // "Cookie settings" link in the footer: reopen with the current choices
    const reopen = () => {
      setSettings(readConsent() ?? ALL_OFF);
      setShowPreferences(true);
      setIsOpen(true);
    };
    window.addEventListener(OPEN_EVENT, reopen);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener(OPEN_EVENT, reopen);
    };
  }, []);

  const applyCookieLogic = (s: CookieSettings) => {
    const hasGtag = typeof window !== "undefined" && (window as any).gtag;
    if (s.analytics) {
      if (hasGtag) (window as any).gtag("consent", "update", { analytics_storage: "granted" });
      window.dispatchEvent(new CustomEvent("imidi_analytics_allowed"));
    } else {
      if (hasGtag) (window as any).gtag("consent", "update", { analytics_storage: "denied" });
      window.dispatchEvent(new CustomEvent("imidi_analytics_blocked"));
    }
    if (s.midiAndPresets) window.dispatchEvent(new CustomEvent("imidi_audio_engine_ready"));
    window.dispatchEvent(new CustomEvent(s.mediaUpload ? "imidi_media_cache_allowed" : "imidi_media_cache_blocked"));
    window.dispatchEvent(new CustomEvent(s.preferences ? "imidi_preferences_allowed" : "imidi_preferences_blocked"));
    // turning "Remember my settings" off also forgets what was saved before
    if (!s.preferences) {
      try {
        UI_PREF_KEYS.forEach((k) => localStorage.removeItem(k));
      } catch {
        /* storage unavailable */
      }
    }
  };

  const savePreferences = (finalSettings: CookieSettings) => {
    const toSave = { ...finalSettings, essential: true, version: CONSENT_VERSION, savedAt: new Date().toISOString() };
    try {
      localStorage.setItem(COOKIE_KEY, JSON.stringify(toSave));
    } catch {
      /* storage unavailable: the choice applies for this visit only */
    }
    applyCookieLogic(toSave);
    setIsOpen(false);
    setShowPreferences(false);
  };

  const flip = (k: keyof CookieSettings) => setSettings((s) => ({ ...s, [k]: !s[k] }));

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie and privacy preferences"
      className="fixed left-6 right-6 md:right-auto md:max-w-[440px] w-auto z-50 animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out"
      style={{ bottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
    >
      {/* Premium Cyber/Studio Container */}
      <div className="relative overflow-hidden flex flex-col max-h-[calc(100dvh-3rem)] bg-black/90 backdrop-blur-2xl border border-white/[0.08] rounded-[24px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] text-white">
        {/* Decorative Abstract Glows */}
        <div className="absolute -top-10 -left-10 w-32 h-32 bg-[#B4592F]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -right-10 w-24 h-24 bg-[#25D366]/10 rounded-full blur-2xl pointer-events-none" />

        {/* scrollable content */}
        <div className="relative min-h-0 overflow-y-auto overscroll-contain px-6 pt-6">
          {/* Header with Digital Badge */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2 bg-white/[0.06] border border-white/[0.04] px-3 py-1.5 rounded-full">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-300 font-mono">Cookies &amp; live sessions</span>
              </div>
              <span className="text-xl select-none filter drop-shadow-[0_0_8px_rgba(180,89,47,0.5)]">🍪</span>
            </div>

            <div className="flex flex-col gap-1.5 mt-1">
              <h3 className="text-lg font-black tracking-tight bg-gradient-to-r from-white via-gray-100 to-gray-400 bg-clip-text text-transparent">
                Your privacy on iMIDI.
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed font-normal">
                We use cookies and local storage to keep you signed in, remember your settings and run live sessions on AirMIDI Link.
                Camera, microphone and MIDI access are not cookies: your browser asks you separately, each time.
              </p>
            </div>
          </div>

          {/* Extensible Preferences Panel */}
          {showPreferences && (
            <div className="my-4 flex flex-col gap-4">
              <div className="bg-white/[0.03] border border-white/[0.05] rounded-2xl p-4 flex flex-col gap-3.5 animate-in fade-in slide-in-from-top-3 duration-300">
                {/* Core */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      Core
                      <span className="text-[9px] bg-white/10 text-gray-300 px-1.5 py-0.5 rounded font-mono font-medium">REQUIRED</span>
                    </span>
                    <span className="text-[11px] text-gray-400/80 leading-normal">
                      Keeps you signed in, secures your account, pairs devices with the 6-digit code and remembers this choice.
                    </span>
                  </div>
                  <div className="w-4 h-4 rounded border border-white/20 bg-white/10 flex items-center justify-center mt-1 shrink-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#B4592F]" />
                  </div>
                </div>

                <div className="h-[1px] bg-white/[0.06]" />
                <Row
                  title="Remember my settings"
                  text="Saves theme, keyboard size, MIDI controls layout and screen-awake on this device. Off: defaults on every visit."
                  on={settings.preferences}
                  onChange={() => flip("preferences")}
                />

                <div className="h-[1px] bg-white/[0.06]" />
                <Row
                  title="Audio previews & presets"
                  text="Enables instant in-browser pre-listening and synth mapping for packs and presets."
                  on={settings.midiAndPresets}
                  onChange={() => flip("midiAndPresets")}
                />

                <div className="h-[1px] bg-white/[0.06]" />
                <Row
                  title="Artwork upload cache"
                  text="Keeps uploaded artwork and pack covers on this device for faster previews before you publish."
                  on={settings.mediaUpload}
                  onChange={() => flip("mediaUpload")}
                />

                <div className="h-[1px] bg-white/[0.06]" />
                <Row
                  title="Anonymous analytics"
                  text="Anonymous usage and performance statistics, used to improve the site and its connection speed."
                  on={settings.analytics}
                  onChange={() => flip("analytics")}
                />
              </div>

              {/* AirMIDI Link: what happens with devices and live sessions (not cookies, shown for transparency) */}
              <div className="bg-white/[0.03] border border-white/[0.05] rounded-2xl p-4 flex flex-col gap-3.5">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-300 font-mono">AirMIDI Link: devices &amp; live sessions</span>
                  <span className="text-[11px] text-gray-500 leading-normal">Not cookies. Always your call, in your browser.</span>
                </div>
                {DEVICE_INFO.map((r) => (
                  <div key={r.title} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-[#E58A5F]">
                      <Icon name={r.icon} />
                    </span>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-bold text-white">{r.title}</span>
                      <span className="text-[11px] text-gray-400/80 leading-normal">{r.text}</span>
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-[11px] text-gray-500 leading-normal">
                You can change your choice at any time from <span className="text-gray-300">Cookie settings</span> in the footer.
                {PRIVACY_URL && (
                  <>
                    {" "}
                    <a href={PRIVACY_URL} className="underline underline-offset-2 text-gray-300 hover:text-white">
                      Read the privacy policy
                    </a>
                    .
                  </>
                )}
              </p>
            </div>
          )}
        </div>

        {/* Premium Action Interfaces */}
        <div className="relative shrink-0 flex flex-col gap-2.5 w-full px-6 pb-6 pt-4">
          {showPreferences ? (
            <button
              onClick={() => savePreferences(settings)}
              className="w-full text-center text-xs font-bold text-black bg-white hover:bg-gray-100 py-3.5 rounded-xl transition-all shadow-lg cursor-pointer transform active:scale-95"
            >
              Save my choices
            </button>
          ) : (
            <div className="flex items-center gap-2.5 w-full">
              <button
                onClick={() => savePreferences(ALL_OFF)}
                className="flex-1 text-center text-xs font-bold text-gray-200 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] py-3.5 rounded-xl transition-all border border-white/[0.12] cursor-pointer transform active:scale-95"
              >
                Reject all
              </button>
              <button
                onClick={() => savePreferences(ALL_ON)}
                className="flex-1 text-center text-xs font-bold text-white bg-[#B4592F] hover:bg-[#964723] py-3.5 rounded-xl transition-all shadow-[0_4px_20px_rgba(180,89,47,0.3)] hover:scale-[1.02] cursor-pointer transform active:scale-95"
              >
                Accept all
              </button>
            </div>
          )}

          <button
            onClick={() => setShowPreferences(!showPreferences)}
            className="w-full text-center text-[10px] font-bold uppercase tracking-wider text-gray-500 hover:text-gray-300 transition-colors py-1 mt-1 cursor-pointer font-mono"
          >
            {showPreferences ? "[ Back ]" : "[ Choose what to allow ]"}
          </button>
        </div>
      </div>
    </div>
  );
}