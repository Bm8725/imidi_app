"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ════════════════════════════════════════════════════════════════
   iMIDI · Privacy & cookie control panel (light theme)
   - Full-screen sheet on phones, large centered sheet on desktop
   - Floating icon (bottom-left) always available to reopen the settings
   - Single source of truth: the privacy page imports CONSENT_CATEGORIES,
     SESSION_FIELDS and UI_PREF_KEYS from here, so both always match.
   Accent colour: #0070F3 (find & replace to rebrand).
   ════════════════════════════════════════════════════════════════ */

export interface CookieSettings {
  essential: boolean;
  preferences: boolean; // remembers UI choices (theme, keyboard, controls, screen-awake)
  midiAndPresets: boolean; // in-browser audio pre-listening + synth mapping
  mediaUpload: boolean; // local cache for uploaded artwork / pack covers
  analytics: boolean;
}
type OptionalKey = Exclude<keyof CookieSettings, "essential">;

const COOKIE_KEY = "imidi_cookies_preferences";
const CONSENT_VERSION = 2; // raise it whenever purposes change: everyone is asked again
const PRIVACY_URL = "/privacy"; // change to your real privacy page ("" hides the link)
const OPEN_EVENT = "imidi_open_cookie_settings";

// Nothing optional is pre-ticked: consent has to be an active choice.
const ALL_OFF: CookieSettings = { essential: true, preferences: false, midiAndPresets: false, mediaUpload: false, analytics: false };
const ALL_ON: CookieSettings = { essential: true, preferences: true, midiAndPresets: true, mediaUpload: true, analytics: true };

// localStorage keys written by the AirMIDI page for "Remember my settings": removed when that choice is off
export const UI_PREF_KEYS = ["airmidi-theme", "airmidi-kb-on", "airmidi-kb-size", "airmidi-ctl-on", "airmidi-ctl-hidden", "airmidi-awake"];

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

// call it from any link/button: <button onClick={openCookieSettings}>Cookie settings</button>
export function openCookieSettings() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(OPEN_EVENT));
}

/* ───────────── content (shared with /privacy) ───────────── */
export const CONSENT_CATEGORIES: {
  key: OptionalKey;
  title: string;
  text: string;
  stores: string;
  kept: string;
  off: string;
}[] = [
  {
    key: "preferences",
    title: "Remember my settings",
    text: "Saves how you set up AirMIDI Link on this device: theme, on-screen keyboard, MIDI controls layout and screen-awake.",
    stores: UI_PREF_KEYS.join(", "),
    kept: "Until you turn this off or clear site data",
    off: "Defaults on every visit. Saved values are deleted.",
  },
  {
    key: "midiAndPresets",
    title: "Audio previews and presets",
    text: "Starts the in-browser audio engine so you can pre-listen to packs and map presets to a synth before downloading.",
    stores: "Audio engine, in memory",
    kept: "Current visit only",
    off: "Previews stay silent; presets can still be downloaded.",
  },
  {
    key: "mediaUpload",
    title: "Artwork upload cache",
    text: "Keeps artwork and pack covers you upload on this device, so previews load instantly before you publish.",
    stores: "Local browser cache of your uploaded images",
    kept: "Until you publish, or clear site data",
    off: "Previews re-read the file each time.",
  },
  {
    key: "analytics",
    title: "Anonymous analytics",
    text: "Anonymous usage and performance statistics, used to improve the site and the speed of live connections.",
    stores: "analytics_storage (consent mode)",
    kept: "Set by the analytics provider",
    off: "No analytics are collected.",
  },
];

export const SESSION_FIELDS: [string, string][] = [
  ["Room code", "Pairs the devices in a session"],
  ["Device names", "Shown to the other person"],
  ["Start and end time", "Used to count your hours"],
  ["Duration", "Used to count your hours"],
];

type Tab = "choices" | "airmidi" | "device";

const TABS: { id: Tab; label: string; hint: string }[] = [
  { id: "choices", label: "Your choices", hint: "Cookies and local storage" },
  { id: "airmidi", label: "AirMIDI Link", hint: "Private video calls and live sessions" },
  { id: "device", label: "On this device", hint: "What is stored right now" },
];

/* ───────────── small UI pieces ───────────── */
const ico = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

type IconName = "video" | "mic" | "keys" | "db" | "photo" | "lock" | "close" | "cookie";

function Icon({ name, className = "h-4 w-4" }: { name: IconName; className?: string }) {
  return (
    <svg className={className} {...ico} aria-hidden>
      {name === "video" && (
        <>
          <path d="M23 7l-7 5 7 5V7z" />
          <rect x="1" y="5" width="15" height="14" rx="2" />
        </>
      )}
      {name === "mic" && (
        <>
          <rect x="9" y="2" width="6" height="12" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v4" />
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
      {name === "lock" && (
        <>
          <rect x="4" y="11" width="16" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </>
      )}
      {name === "close" && <path d="M18 6L6 18M6 6l12 12" />}
      {name === "cookie" && (
        <>
          <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5z" />
          <path d="M8.5 8.5v.01M16 15.5v.01M12 12v.01M11 17v.01M7 13v.01" />
        </>
      )}
    </svg>
  );
}

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0070F3] focus-visible:ring-offset-2 focus-visible:ring-offset-white";

function Switch({ on, label, onChange }: { on: boolean; label: string; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onChange}
      className={`relative h-7 w-12 shrink-0 cursor-pointer rounded-full border transition-colors ${FOCUS} ${
        on ? "border-[#0070F3] bg-[#0070F3]" : "border-[#CFCFCF] bg-[#E5E5E5]"
      }`}
    >
      <span
        className={`absolute left-[3px] top-[3px] h-5 w-5 rounded-full bg-white shadow transition-transform motion-reduce:transition-none ${
          on ? "translate-x-5" : ""
        }`}
      />
    </button>
  );
}

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <dt className="w-16 shrink-0 text-[11px] text-[#8A8A8A]">{k}</dt>
      <dd className="min-w-0 break-words font-mono text-[11px] leading-relaxed text-[#444]">{v}</dd>
    </div>
  );
}

function ChoiceCard({ cat, on, onChange }: { cat: (typeof CONSENT_CATEGORIES)[number]; on: boolean; onChange: () => void }) {
  return (
    <section
      className={`rounded-2xl border p-4 transition-colors sm:p-5 ${
        on ? "border-[#0070F3]/40 bg-[#0070F3]/[0.04]" : "border-[#EAEAEA] bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-black">{cat.title}</h3>
          <p className="mt-1 max-w-[62ch] text-[13px] leading-relaxed text-[#666]">{cat.text}</p>
        </div>
        <Switch on={on} label={cat.title} onChange={onChange} />
      </div>
      <dl className="mt-4 flex flex-col gap-1.5 border-t border-[#EAEAEA] pt-3">
        <Meta k="Stores" v={cat.stores} />
        <Meta k="Kept" v={cat.kept} />
        <Meta k="If off" v={cat.off} />
      </dl>
    </section>
  );
}

/* ───────────── live permission status (AirMIDI Link) ───────────── */
type PermState = "granted" | "denied" | "prompt" | "unknown";

function usePermission(name: string, extra?: Record<string, unknown>, active = true): PermState {
  const [state, setState] = useState<PermState>("unknown");
  useEffect(() => {
    if (!active) return;
    let status: PermissionStatus | null = null;
    let cancelled = false;
    const handler = () => status && !cancelled && setState(status.state as PermState);
    try {
      navigator.permissions
        .query({ name, ...extra } as unknown as PermissionDescriptor)
        .then((s) => {
          if (cancelled) return;
          status = s;
          setState(s.state as PermState);
          s.addEventListener("change", handler);
        })
        .catch(() => setState("unknown"));
    } catch {
      setState("unknown");
    }
    return () => {
      cancelled = true;
      status?.removeEventListener("change", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, active]);
  return state;
}

const PERM_LABEL: Record<PermState, string> = {
  granted: "Allowed in this browser",
  denied: "Blocked in this browser",
  prompt: "Not asked yet",
  unknown: "Status not available here",
};
const PERM_DOT: Record<PermState, string> = {
  granted: "bg-[#1A9F4B]",
  denied: "bg-[#E5484D]",
  prompt: "bg-[#BDBDBD]",
  unknown: "bg-[#DADADA]",
};

function PermissionRow({ icon, title, text, state }: { icon: "video" | "mic" | "keys"; title: string; text: string; state: PermState }) {
  return (
    <li className="flex items-start gap-3 py-3.5">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0070F3]/10 text-[#0070F3]">
        <Icon name={icon} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <h4 className="text-sm font-semibold text-black">{title}</h4>
          <span className="flex items-center gap-2 text-[11px] text-[#666]">
            <span className={`h-2 w-2 rounded-full ${PERM_DOT[state]}`} aria-hidden />
            {PERM_LABEL[state]}
          </span>
        </div>
        <p className="mt-1 max-w-[62ch] text-[13px] leading-relaxed text-[#666]">{text}</p>
      </div>
    </li>
  );
}

function CallPath() {
  const nodes = ["Your device", "Browser permission", "Encrypted, device to device", "Other person"];
  return (
    <ol className="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-0" aria-label="How a private call travels">
      {nodes.map((n, i) => (
        <li key={n} className="flex flex-1 items-center sm:flex-row">
          <div
            className={`flex-1 rounded-xl border px-3 py-2.5 text-center text-xs font-medium ${
              i === 2 ? "border-[#0070F3]/50 bg-[#0070F3]/[0.06] text-black" : "border-[#EAEAEA] bg-[#FAFAFA] text-[#555]"
            }`}
          >
            {n}
          </div>
          {i < nodes.length - 1 && <span className="hidden h-px w-4 shrink-0 bg-[#CFCFCF] sm:block" aria-hidden />}
        </li>
      ))}
    </ol>
  );
}

function AirMidiPane({ active }: { active: boolean }) {
  const cam = usePermission("camera", undefined, active);
  const mic = usePermission("microphone", undefined, active);
  const midi = usePermission("midi", undefined, active);
  const sysex = usePermission("midi", { sysex: true }, active);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-lg font-semibold text-black">Private calls and live sessions</h3>
        <p className="mt-1.5 max-w-[66ch] text-[13px] leading-relaxed text-[#666]">
          Camera, microphone and MIDI are not cookies. Your browser asks you separately, and you can change or revoke each one in its site
          settings at any time. Nothing here depends on the cookie choices on the first tab.
        </p>
      </div>

      <CallPath />

      <section className="rounded-2xl border border-[#EAEAEA] bg-white px-4 sm:px-5">
        <ul className="divide-y divide-[#EAEAEA]">
          <PermissionRow
            icon="video"
            title="Camera"
            state={cam}
            text="Off until you press Camera, and your browser asks first. Video travels directly between the people in the session, encrypted. iMIDI does not record or store it and does not use face recognition."
          />
          <PermissionRow
            icon="mic"
            title="Microphone"
            state={mic}
            text="Off until you press Mic, and your browser asks first. Voice travels directly between the people in the session, encrypted. iMIDI does not record or store it and does not use voice recognition."
          />
          <PermissionRow
            icon="keys"
            title="MIDI devices"
            state={midi}
            text="Your browser asks before sharing a MIDI device. MIDI messages reach the other person only while the session is live."
          />
          <PermissionRow
            icon="keys"
            title="MIDI system messages (SysEx)"
            state={sysex}
            text="A separate browser permission. Only needed for devices that exchange settings or patch data."
          />
        </ul>
      </section>

      <section className="rounded-2xl border border-[#EAEAEA] bg-white p-4 sm:p-5">
        <div className="flex items-center gap-2 text-black">
          <Icon name="db" />
          <h4 className="text-sm font-semibold">Session details we keep</h4>
        </div>
        <p className="mt-1.5 max-w-[62ch] text-[13px] leading-relaxed text-[#666]">
          To pair devices and count your hours, we keep these details for each session, linked to your account.
        </p>
        <dl className="mt-3 grid gap-x-8 gap-y-2 sm:grid-cols-2">
          {SESSION_FIELDS.map(([k, v]) => (
            <div key={k} className="flex flex-col border-t border-[#EAEAEA] pt-2">
              <dt className="text-[13px] font-medium text-black">{k}</dt>
              <dd className="text-[12px] text-[#777]">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-2xl border border-[#EAEAEA] bg-white p-4 sm:p-5">
        <div className="flex items-center gap-2 text-black">
          <Icon name="photo" />
          <h4 className="text-sm font-semibold">Photos</h4>
        </div>
        <p className="mt-1.5 max-w-[62ch] text-[13px] leading-relaxed text-[#666]">
          The Photo button saves a picture on your device. It is uploaded to a public link only if you press Share with a live picture.
        </p>
      </section>
    </div>
  );
}

/* ───────────── what is on this device right now ───────────── */
type StoredKey = { key: string; present: boolean; bytes: number };

function readStored(): StoredKey[] {
  return [COOKIE_KEY, ...UI_PREF_KEYS].map((key) => {
    let v: string | null = null;
    try {
      v = localStorage.getItem(key);
    } catch {
      /* storage unavailable */
    }
    return { key, present: v !== null, bytes: v ? new Blob([v]).size : 0 };
  });
}

function DevicePane({ draft, active }: { draft: CookieSettings; active: boolean }) {
  const [rows, setRows] = useState<StoredKey[]>([]);
  useEffect(() => {
    if (active) setRows(readStored());
  }, [active]);

  const willRemove = (key: string) => !draft.preferences && UI_PREF_KEYS.includes(key);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="text-lg font-semibold text-black">Stored on this device</h3>
        <p className="mt-1.5 max-w-[66ch] text-[13px] leading-relaxed text-[#666]">
          A live read of the local storage keys iMIDI uses in this browser. Nothing here is sent to anyone by this panel.
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[#EAEAEA] bg-white">
        <table className="w-full min-w-[420px] text-left text-[12px]">
          <thead className="bg-[#FAFAFA] text-[#666]">
            <tr>
              <th className="px-4 py-2.5 font-medium">Key</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 text-right font-medium">Size</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EAEAEA]">
            {rows.map((r) => (
              <tr key={r.key}>
                <td className="px-4 py-2.5 font-mono text-[#222]">{r.key}</td>
                <td className="px-4 py-2.5 text-[#666]">
                  {r.present ? (willRemove(r.key) ? "Stored, will be deleted on save" : "Stored") : "Empty"}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-[#666]">{r.present ? `${r.bytes} B` : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="max-w-[66ch] text-[12px] leading-relaxed text-[#777]">
        Required storage: the sign-in session, account security, the 6-digit pairing code and this consent record. Without it the site and AirMIDI
        Link cannot work, so it has no switch.
      </p>
    </div>
  );
}

/* ───────────── component ───────────── */
export default function CookieBanner() {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [tab, setTab] = useState<Tab>("choices");
  const [settings, setSettings] = useState<CookieSettings>(ALL_OFF);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const saved = readConsent();
    if (saved) {
      setSettings(saved);
      setHasSaved(true);
      applyCookieLogic(saved);
    } else {
      timer = setTimeout(() => setIsOpen(true), 1200);
    }
    // any "Cookie settings" link/button (footer, privacy page, floating icon): reopen with current choices
    const reopen = () => {
      const current = readConsent();
      setSettings(current ?? ALL_OFF);
      setHasSaved(!!current);
      setTab("choices");
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
    setSettings(finalSettings);
    setHasSaved(true);
    applyCookieLogic(toSave);
    setIsOpen(false);
  };

  const flip = (k: OptionalKey) => setSettings((s) => ({ ...s, [k]: !s[k] }));
  const enabledCount = useMemo(() => CONSENT_CATEGORIES.filter((c) => settings[c.key]).length, [settings]);

  /* dialog behaviour: scroll lock, focus, Esc, focus trap */
  const close = useCallback(() => {
    if (hasSaved) setIsOpen(false); // before the first choice the panel stays: closing is not consent
  }, [hasSaved]);

  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    const prevFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
  }, [isOpen]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
      return;
    }
    if (e.key !== "Tab" || !panelRef.current) return;
    const f = panelRef.current.querySelectorAll<HTMLElement>('button, a[href], [tabindex]:not([tabindex="-1"])');
    if (!f.length) return;
    const first = f[0];
    const last = f[f.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  if (!mounted) return null;

  /* closed: persistent floating icon, always reachable */
  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={openCookieSettings}
        aria-label="Open cookie and privacy settings"
        title="Cookie and privacy settings"
        className={`fixed left-4 z-[90] flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-[#EAEAEA] bg-white text-[#111] shadow-[0_4px_16px_rgba(0,0,0,0.12)] transition-all hover:border-[#0070F3]/50 hover:text-[#0070F3] hover:shadow-[0_6px_20px_rgba(0,0,0,0.16)] active:scale-95 motion-reduce:transition-none ${FOCUS}`}
        style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <Icon name="cookie" className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-stretch justify-center bg-black/40 backdrop-blur-sm md:items-center md:p-6 lg:p-10"
      onKeyDown={onKeyDown}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="imidi-consent-title"
        className="relative flex h-full w-full max-w-[1180px] flex-col overflow-hidden bg-white text-[#111] outline-none animate-in fade-in zoom-in-95 duration-300 motion-reduce:animate-none md:h-auto md:max-h-full md:rounded-3xl md:border md:border-[#EAEAEA] md:shadow-[0_40px_120px_-20px_rgba(0,0,0,0.35)]"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        {/* header */}
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[#EAEAEA] px-5 py-5 sm:px-8">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[13px] text-[#777]">
              <span className="font-semibold text-black">iMIDI</span>
              <span aria-hidden>/</span>
              <span>Privacy and storage</span>
            </div>
            <h2 id="imidi-consent-title" className="mt-2 text-2xl font-semibold tracking-tight text-black sm:text-3xl">
              You decide what stays on your device.
            </h2>
            <p className="mt-2 max-w-[68ch] text-[13px] leading-relaxed text-[#666]">
              Optional storage is off until you turn it on. This applies to imidi.co.uk and AirMIDI Link, including private video calls and live
              MIDI sessions.
            </p>
          </div>
          {hasSaved && (
            <button
              type="button"
              onClick={close}
              aria-label="Close without changing"
              className={`flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[#E0E0E0] text-[#555] transition-colors hover:bg-[#F2F2F2] hover:text-black ${FOCUS}`}
            >
              <Icon name="close" />
            </button>
          )}
        </header>

        {/* body */}
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {/* nav: tab strip on phones, side rail from md */}
          <nav
            aria-label="Privacy sections"
            className="flex shrink-0 gap-1 overflow-x-auto border-b border-[#EAEAEA] bg-[#FAFAFA] px-3 py-2 md:w-64 md:flex-col md:overflow-visible md:border-b-0 md:border-r md:px-4 md:py-5"
          >
            <div role="tablist" aria-orientation="vertical" className="flex gap-1 md:flex-col">
              {TABS.map((t) => {
                const sel = tab === t.id;
                return (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={sel}
                    onClick={() => setTab(t.id)}
                    className={`shrink-0 cursor-pointer rounded-xl border px-3.5 py-2.5 text-left transition-colors ${FOCUS} ${
                      sel
                        ? "border-[#EAEAEA] bg-white text-black shadow-sm"
                        : "border-transparent text-[#666] hover:bg-black/[0.04] hover:text-black"
                    }`}
                  >
                    <span className="block text-sm font-semibold">{t.label}</span>
                    <span className="mt-0.5 hidden text-[12px] leading-snug text-[#8A8A8A] md:block">{t.hint}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-auto hidden rounded-xl border border-[#EAEAEA] bg-white p-3.5 md:block">
              <div className="flex items-center gap-2 text-[12px] font-semibold text-black">
                <Icon name="lock" />
                Required storage is always on
              </div>
              <p className="mt-1.5 text-[12px] leading-relaxed text-[#777]">
                Sign-in, account security and device pairing cannot work without it.
              </p>
            </div>
          </nav>

          {/* content */}
          <div role="tabpanel" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-8">
            {tab === "choices" && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-lg font-semibold text-black">Optional storage</h3>
                  <span className="text-[12px] text-[#777]">
                    {enabledCount} of {CONSENT_CATEGORIES.length} on
                  </span>
                </div>
                {CONSENT_CATEGORIES.map((c) => (
                  <ChoiceCard key={c.key} cat={c} on={settings[c.key]} onChange={() => flip(c.key)} />
                ))}
              </div>
            )}
            <div hidden={tab !== "airmidi"}>
              <AirMidiPane active={isOpen && tab === "airmidi"} />
            </div>
            {tab === "device" && <DevicePane draft={settings} active={tab === "device"} />}
          </div>
        </div>

        {/* actions: Reject and Accept carry the same weight on purpose */}
        <footer
          className="flex shrink-0 flex-col gap-3 border-t border-[#EAEAEA] bg-[#FAFAFA] px-5 py-4 sm:px-8 md:flex-row md:items-center md:justify-between"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          <p className="text-[12px] leading-relaxed text-[#777]">
            Change this any time with the cookie icon at the bottom left of every page.
            {PRIVACY_URL && (
              <>
                {" "}
                <a href={PRIVACY_URL} className="text-[#0070F3] underline-offset-2 hover:underline">
                  Privacy policy
                </a>
              </>
            )}
          </p>
          <div className="grid grid-cols-3 gap-2 md:flex md:gap-3">
            <button
              onClick={() => savePreferences(ALL_OFF)}
              className={`cursor-pointer rounded-xl border border-[#CFCFCF] bg-white px-3 py-3 text-[13px] font-semibold text-black transition-colors hover:bg-[#F2F2F2] md:px-5 ${FOCUS}`}
            >
              Reject all
            </button>
            <button
              onClick={() => savePreferences(settings)}
              className={`cursor-pointer rounded-xl bg-black px-3 py-3 text-[13px] font-semibold text-white transition-colors hover:bg-[#333] md:px-6 ${FOCUS}`}
            >
              Save choices
            </button>
            <button
              onClick={() => savePreferences(ALL_ON)}
              className={`cursor-pointer rounded-xl border border-[#CFCFCF] bg-white px-3 py-3 text-[13px] font-semibold text-black transition-colors hover:bg-[#F2F2F2] md:px-5 ${FOCUS}`}
            >
              Accept all
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}