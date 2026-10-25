"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ════════════════════════════════════════════════════════════════
   iMIDI · Privacy preferences (corporate, light)
   - First visit: compact, non-blocking banner (Reject all / Customize / Accept all)
   - "Customize" opens a preferences dialog (Cookies · AirMIDI Link · On this device)
   - After a choice is saved EVERYTHING is hidden (no floating icon).
     Re-open it from a footer link / privacy page:
       <button onClick={openCookieSettings}>Cookie settings</button>
   - /privacy keeps importing CONSENT_CATEGORIES, SESSION_FIELDS, UI_PREF_KEYS
   Accent: #0070F3 (find & replace to rebrand) · Fonts: Inter, JetBrains Mono
   ════════════════════════════════════════════════════════════════ */

export interface CookieSettings {
  essential: boolean;
  preferences: boolean;
  midiAndPresets: boolean;
  mediaUpload: boolean;
  analytics: boolean;
}
type OptionalKey = Exclude<keyof CookieSettings, "essential">;

const COOKIE_KEY = "imidi_cookies_preferences";
const CONSENT_VERSION = 2; // raise it whenever purposes change: everyone is asked again
const PRIVACY_URL = "/privacy"; // "" hides the link
const OPEN_EVENT = "imidi_open_cookie_settings";

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

// call it from any footer link/button: <button onClick={openCookieSettings}>Cookie settings</button>
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
type View = "closed" | "banner" | "modal";

/* ───────────── look & feel ───────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
.imidi-cc { font-family: Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif; -webkit-font-smoothing: antialiased; }
.imidi-cc .font-mono { font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace; }
@keyframes cc-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes cc-up { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
.imidi-cc .cc-fade { animation: cc-fade .2s ease both; }
.imidi-cc .cc-up { animation: cc-up .28s cubic-bezier(.2,.8,.2,1) both; }
.imidi-cc .cc-scroll { scrollbar-width: thin; scrollbar-color: #CBD5E1 transparent; }
@media (prefers-reduced-motion: reduce) { .imidi-cc .cc-fade, .imidi-cc .cc-up { animation: none; } }
`;

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0070F3] focus-visible:ring-offset-2 focus-visible:ring-offset-white";

const BTN_BASE = `inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg px-5 text-[14px] font-semibold transition-colors ${FOCUS}`;
const BTN_SOLID = `${BTN_BASE} bg-[#0F172A] text-white hover:bg-[#1E293B]`;
const BTN_OUTLINE = `${BTN_BASE} border border-[#CBD5E1] bg-white text-[#0F172A] hover:bg-[#F1F5F9]`;

const ico = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;
type IconName = "video" | "mic" | "keys" | "db" | "photo" | "lock" | "close" | "chevron" | "check";

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
      {name === "chevron" && <path d="M6 9l6 6 6-6" />}
      {name === "check" && <path d="M20 6L9 17l-5-5" />}
    </svg>
  );
}

function Mark() {
  return (
    <svg className="h-7 w-7 shrink-0" viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#0F172A" />
      <rect x="8" y="9" width="3.4" height="14" rx="1.7" fill="#fff" />
      <rect x="14.3" y="9" width="3.4" height="9" rx="1.7" fill="#fff" />
      <rect x="20.6" y="9" width="3.4" height="14" rx="1.7" fill="#0070F3" />
    </svg>
  );
}

/* ───────────── controls ───────────── */
function Switch({ on, label, onChange }: { on: boolean; label: string; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onChange}
      className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${FOCUS} ${on ? "bg-[#0070F3]" : "bg-[#CBD5E1]"}`}
    >
      <span
        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 motion-reduce:transition-none ${
          on ? "translate-x-5" : ""
        }`}
      />
    </button>
  );
}

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
      <dt className="w-14 shrink-0 text-[12px] text-[#64748B]">{k}</dt>
      <dd className="min-w-0 break-words font-mono text-[12px] leading-relaxed text-[#334155]">{v}</dd>
    </div>
  );
}

function ChoiceRow({ cat, on, onChange }: { cat: (typeof CONSENT_CATEGORIES)[number]; on: boolean; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const id = `cc-details-${cat.key}`;
  return (
    <li>
      <div className="flex items-start gap-4 px-4 py-4 sm:px-5">
        <div className="min-w-0 flex-1">
          <h4 className="text-[15px] font-semibold text-[#0F172A]">{cat.title}</h4>
          <p className="mt-1 max-w-[62ch] text-[14px] leading-relaxed text-[#475569]">{cat.text}</p>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={id}
            onClick={() => setOpen((o) => !o)}
            className={`mt-2 inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-md text-[13px] font-medium text-[#0058C2] hover:underline ${FOCUS}`}
          >
            <Icon name="chevron" className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
            Technical details
          </button>
        </div>
        <Switch on={on} label={cat.title} onChange={onChange} />
      </div>
      {open && (
        <dl id={id} className="cc-fade flex flex-col gap-2 border-t border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3.5 sm:px-5">
          <Meta k="Stores" v={cat.stores} />
          <Meta k="Kept" v={cat.kept} />
          <Meta k="If off" v={cat.off} />
        </dl>
      )}
    </li>
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

const PERM: Record<PermState, { label: string; chip: string; dot: string }> = {
  granted: { label: "Allowed", chip: "bg-[#ECFDF3] text-[#067647]", dot: "bg-[#12B76A]" },
  denied: { label: "Blocked", chip: "bg-[#FEF3F2] text-[#B42318]", dot: "bg-[#F04438]" },
  prompt: { label: "Not asked yet", chip: "bg-[#F1F5F9] text-[#475569]", dot: "bg-[#94A3B8]" },
  unknown: { label: "Unknown here", chip: "bg-[#F1F5F9] text-[#475569]", dot: "bg-[#CBD5E1]" },
};

function PermissionRow({ icon, title, text, state }: { icon: "video" | "mic" | "keys"; title: string; text: string; state: PermState }) {
  const p = PERM[state];
  return (
    <li className="flex items-start gap-3.5 px-4 py-4 sm:px-5">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F1F5F9] text-[#334155]">
        <Icon name={icon} className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
          <h4 className="text-[15px] font-semibold text-[#0F172A]">{title}</h4>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium ${p.chip}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${p.dot}`} aria-hidden />
            {p.label} in this browser
          </span>
        </div>
        <p className="mt-1 max-w-[62ch] text-[14px] leading-relaxed text-[#475569]">{text}</p>
      </div>
    </li>
  );
}

function PaneTitle({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h3 className="text-[18px] font-semibold text-[#0F172A]">{title}</h3>
      <p className="mt-1 max-w-[66ch] text-[14px] leading-relaxed text-[#475569]">{text}</p>
    </div>
  );
}

function AirMidiPane({ active }: { active: boolean }) {
  const cam = usePermission("camera", undefined, active);
  const mic = usePermission("microphone", undefined, active);
  const midi = usePermission("midi", undefined, active);
  const sysex = usePermission("midi", { sysex: true }, active);

  return (
    <div className="flex flex-col gap-5">
      <PaneTitle
        title="Private calls and live sessions"
        text="Camera, microphone and MIDI are not cookies. Your browser asks you separately, and you can change or revoke each one in its site settings at any time. Nothing here depends on the cookie choices."
      />

      <ul className="divide-y divide-[#E2E8F0] rounded-xl border border-[#E2E8F0] bg-white">
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

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-[#E2E8F0] bg-white p-4 sm:p-5">
          <div className="flex items-center gap-2 text-[#0F172A]">
            <Icon name="db" />
            <h4 className="text-[15px] font-semibold">Session details we keep</h4>
          </div>
          <p className="mt-1.5 text-[14px] leading-relaxed text-[#475569]">To pair devices and count your hours, linked to your account.</p>
          <dl className="mt-3 flex flex-col">
            {SESSION_FIELDS.map(([k, v]) => (
              <div key={k} className="flex flex-col border-t border-[#E2E8F0] py-2.5">
                <dt className="text-[14px] font-medium text-[#0F172A]">{k}</dt>
                <dd className="text-[13px] text-[#64748B]">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="rounded-xl border border-[#E2E8F0] bg-white p-4 sm:p-5">
          <div className="flex items-center gap-2 text-[#0F172A]">
            <Icon name="photo" />
            <h4 className="text-[15px] font-semibold">Photos</h4>
          </div>
          <p className="mt-1.5 text-[14px] leading-relaxed text-[#475569]">
            The Photo button saves a picture on your device. It is uploaded to a public link only if you press Share with a live picture.
          </p>
        </section>
      </div>
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
      <PaneTitle
        title="Stored on this device"
        text="A live read of the local storage keys iMIDI uses in this browser. Nothing here is sent to anyone by this panel."
      />

      <div className="overflow-x-auto rounded-xl border border-[#E2E8F0] bg-white">
        <table className="w-full min-w-[440px] text-left text-[13px]">
          <thead className="bg-[#F8FAFC] text-[#475569]">
            <tr>
              <th className="px-4 py-3 font-medium">Key</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Size</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8F0]">
            {rows.map((r) => (
              <tr key={r.key}>
                <td className="px-4 py-3 font-mono text-[12px] text-[#0F172A]">{r.key}</td>
                <td className="px-4 py-3 text-[#475569]">
                  {r.present ? (
                    willRemove(r.key) ? (
                      <span className="font-medium text-[#B42318]">Stored, will be deleted on save</span>
                    ) : (
                      "Stored"
                    )
                  ) : (
                    <span className="text-[#94A3B8]">Empty</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-mono text-[12px] text-[#475569]">{r.present ? `${r.bytes} B` : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="max-w-[66ch] text-[13px] leading-relaxed text-[#64748B]">
        Required storage: the sign-in session, account security, the 6-digit pairing code and this consent record. Without it the site and AirMIDI
        Link cannot work, so it has no switch.
      </p>
    </div>
  );
}

/* ───────────── consent side effects ───────────── */
function applyCookieLogic(s: CookieSettings) {
  const w = window as any;
  const hasGtag = typeof w.gtag === "function";
  if (hasGtag) w.gtag("consent", "update", { analytics_storage: s.analytics ? "granted" : "denied" });
  window.dispatchEvent(new CustomEvent(s.analytics ? "imidi_analytics_allowed" : "imidi_analytics_blocked"));
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
}

/* ───────────── component ───────────── */
export default function CookieBanner() {
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState<View>("closed");
  const [saved, setSaved] = useState<CookieSettings | null>(null);
  const [tab, setTab] = useState<Tab>("choices");
  const [settings, setSettings] = useState<CookieSettings>(ALL_OFF);
  const [toast, setToast] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const hasSaved = saved !== null;

  useEffect(() => {
    setMounted(true);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const initial = readConsent();
    if (initial) {
      setSettings(initial);
      setSaved(initial);
      applyCookieLogic(initial);
    } else {
      timer = setTimeout(() => setView("banner"), 800);
    }
    // any "Cookie settings" link in the app (footer, privacy page) reopens the dialog with current choices
    const reopen = () => {
      const current = readConsent();
      setSettings(current ?? ALL_OFF);
      setSaved(current);
      setTab("choices");
      setView("modal");
    };
    window.addEventListener(OPEN_EVENT, reopen);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener(OPEN_EVENT, reopen);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const save = (next: CookieSettings) => {
    const toSave = { ...next, essential: true, version: CONSENT_VERSION, savedAt: new Date().toISOString() };
    try {
      localStorage.setItem(COOKIE_KEY, JSON.stringify(toSave));
    } catch {
      /* storage unavailable: the choice applies for this visit only */
    }
    setSettings(next);
    setSaved(next);
    applyCookieLogic(toSave);
    setView("closed"); // fully hidden once a choice is made
    setToast("Preferences saved");
  };

  const flip = (k: OptionalKey) => setSettings((s) => ({ ...s, [k]: !s[k] }));
  const enabledCount = useMemo(() => CONSENT_CATEGORIES.filter((c) => settings[c.key]).length, [settings]);
  const dirty = useMemo(() => !saved || CONSENT_CATEGORIES.some((c) => saved[c.key] !== settings[c.key]), [saved, settings]);

  // dialog "close": back to the banner if no choice exists yet, otherwise hide everything
  const closeModal = useCallback(() => setView(hasSaved ? "closed" : "banner"), [hasSaved]);

  /* dialog behaviour: scroll lock, focus, Esc, focus trap (modal only) */
  useEffect(() => {
    if (view !== "modal") return;
    const prevOverflow = document.body.style.overflow;
    const prevFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
  }, [view]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      closeModal();
      return;
    }
    if (e.key !== "Tab" || !panelRef.current) return;
    const f = panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])');
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

  /* closed: nothing on screen, only a short confirmation right after saving */
  if (view === "closed") {
    if (!toast) return null;
    return (
      <div className="imidi-cc fixed left-4 z-[90]" style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}>
        <style>{CSS}</style>
        <span
          role="status"
          className="cc-up inline-flex items-center gap-2 rounded-lg bg-[#0F172A] px-4 py-2.5 text-[13px] font-medium text-white shadow-lg"
        >
          <Icon name="check" className="h-4 w-4 text-[#4ADE80]" />
          {toast}
        </span>
      </div>
    );
  }

  /* first layer: compact, non-blocking banner */
  if (view === "banner") {
    return (
      <div
        className="imidi-cc pointer-events-none fixed inset-x-0 bottom-0 z-[90] flex justify-center p-3 sm:justify-start sm:p-5"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <style>{CSS}</style>
        <section
          role="dialog"
          aria-modal="false"
          aria-labelledby="imidi-banner-title"
          className="cc-up pointer-events-auto w-full max-w-[560px] rounded-xl border border-[#E2E8F0] bg-white p-5 text-[#0F172A] shadow-[0_12px_40px_rgba(15,23,42,0.18)]"
        >
          <div className="flex items-center gap-2.5">
            <Mark />
            <h2 id="imidi-banner-title" className="text-[16px] font-semibold">
              Your privacy choices
            </h2>
          </div>
          <p className="mt-3 text-[14px] leading-relaxed text-[#475569]">
            iMIDI uses required storage to keep you signed in and to run AirMIDI Link. With your permission we also remember your settings, enable
            audio previews and measure anonymous usage. Optional categories are off until you turn them on.
            {PRIVACY_URL && (
              <>
                {" "}
                <a href={PRIVACY_URL} className="font-medium text-[#0058C2] underline-offset-2 hover:underline">
                  Privacy policy
                </a>
              </>
            )}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
            <button type="button" onClick={() => save(ALL_OFF)} className={BTN_SOLID}>
              Reject all
            </button>
            <button type="button" onClick={() => save(ALL_ON)} className={BTN_SOLID}>
              Accept all
            </button>
            <button
              type="button"
              onClick={() => {
                setTab("choices");
                setView("modal");
              }}
              className={`${BTN_OUTLINE} col-span-2 sm:order-first sm:mr-auto sm:border-transparent sm:px-3 sm:text-[#0058C2] sm:hover:bg-[#F1F5F9]`}
            >
              Customize
            </button>
          </div>
        </section>
      </div>
    );
  }

  /* second layer: preferences dialog */
  const TAB_ITEMS: { id: Tab; label: string; hint: string; badge?: string }[] = [
    { id: "choices", label: "Cookies", hint: "Choose what is stored on this device", badge: `${enabledCount}/${CONSENT_CATEGORIES.length}` },
    { id: "airmidi", label: "AirMIDI Link", hint: "Camera, microphone and MIDI permissions" },
    { id: "device", label: "On this device", hint: "What is stored right now" },
  ];

  return (
    <div
      className="imidi-cc cc-fade fixed inset-0 z-[100] flex items-stretch justify-center bg-[#0F172A]/50 md:items-center md:p-6"
      onKeyDown={onKeyDown}
    >
      <style>{CSS}</style>
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="imidi-consent-title"
        className="cc-up relative flex h-full w-full max-w-[920px] flex-col overflow-hidden bg-white text-[#0F172A] outline-none md:h-[min(680px,calc(100dvh-3rem))] md:rounded-xl md:shadow-[0_24px_80px_rgba(15,23,42,0.35)]"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        {/* header */}
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[#E2E8F0] px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Mark />
            <div className="min-w-0">
              <h2 id="imidi-consent-title" className="text-[17px] font-semibold leading-tight">
                Privacy preferences
              </h2>
              <p className="hidden text-[13px] text-[#64748B] sm:block">Cookies and local storage on imidi.co.uk and AirMIDI Link</p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeModal}
            aria-label="Close"
            className={`flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg text-[#475569] transition-colors hover:bg-[#F1F5F9] hover:text-[#0F172A] ${FOCUS}`}
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </header>

        {/* body */}
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <nav
            aria-label="Privacy sections"
            className="shrink-0 border-b border-[#E2E8F0] bg-[#F8FAFC] md:flex md:w-64 md:flex-col md:border-b-0 md:border-r md:px-3 md:py-4"
          >
            <div role="tablist" aria-orientation="vertical" className="grid grid-cols-3 md:flex md:flex-col md:gap-1">
              {TAB_ITEMS.map((t) => {
                const sel = tab === t.id;
                return (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={sel}
                    onClick={() => setTab(t.id)}
                    className={`flex min-h-12 cursor-pointer flex-col items-center justify-center border-b-2 px-2 py-2 text-center text-[13px] font-semibold transition-colors md:items-stretch md:rounded-lg md:border-b-0 md:border-l-2 md:px-3 md:py-2.5 md:text-left md:text-[14px] ${FOCUS} ${
                      sel
                        ? "border-[#0070F3] bg-white text-[#0F172A] md:bg-white md:shadow-sm"
                        : "border-transparent text-[#475569] hover:bg-[#EEF2F6] hover:text-[#0F172A]"
                    }`}
                  >
                    <span className="flex items-center justify-center gap-2 md:justify-between">
                      {t.label}
                      {t.badge && <span className="hidden rounded-full bg-[#E2E8F0] px-2 py-0.5 text-[11px] font-semibold text-[#334155] md:inline">{t.badge}</span>}
                    </span>
                    <span className="mt-0.5 hidden text-[12px] font-normal leading-snug text-[#64748B] md:block">{t.hint}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-auto hidden items-start gap-2.5 rounded-lg border border-[#E2E8F0] bg-white p-3.5 md:flex">
              <span className="mt-0.5 text-[#12B76A]">
                <Icon name="lock" />
              </span>
              <p className="text-[12px] leading-relaxed text-[#64748B]">
                <span className="block text-[13px] font-semibold text-[#0F172A]">Required storage is always on</span>
                Sign-in, account security and device pairing cannot work without it.
              </p>
            </div>
          </nav>

          <div role="tabpanel" className="cc-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6 sm:py-6">
            {tab === "choices" && (
              <div className="flex flex-col gap-4">
                <PaneTitle title="Optional cookies" text="Everything below is off until you turn it on. Required storage is not listed because it has no switch." />
                <ul className="divide-y divide-[#E2E8F0] overflow-hidden rounded-xl border border-[#E2E8F0] bg-white">
                  {CONSENT_CATEGORIES.map((c) => (
                    <ChoiceRow key={c.key} cat={c} on={settings[c.key]} onChange={() => flip(c.key)} />
                  ))}
                </ul>
              </div>
            )}
            <div hidden={tab !== "airmidi"}>
              <AirMidiPane active={tab === "airmidi"} />
            </div>
            {tab === "device" && <DevicePane draft={settings} active={tab === "device"} />}
          </div>
        </div>

        {/* actions: Reject and Accept carry the same weight on purpose */}
        <footer
          className="shrink-0 border-t border-[#E2E8F0] bg-white px-5 pt-4 sm:px-6 md:flex md:items-center md:justify-between md:gap-6 md:bg-[#F8FAFC]"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          <p className="mb-3 text-[13px] leading-relaxed text-[#64748B] md:mb-0">
            {hasSaved && dirty ? (
              <span className="inline-flex items-center gap-2 font-medium text-[#B54708]">
                <span className="h-2 w-2 rounded-full bg-[#F79009]" aria-hidden />
                Unsaved changes
              </span>
            ) : (
              <>
                You can change this later from “Cookie settings” in the footer.
                {PRIVACY_URL && (
                  <>
                    {" "}
                    <a href={PRIVACY_URL} className="font-medium text-[#0058C2] underline-offset-2 hover:underline">
                      Privacy policy
                    </a>
                  </>
                )}
              </>
            )}
          </p>
          <div className="grid grid-cols-2 gap-2 md:flex md:shrink-0 md:gap-3">
            <button type="button" onClick={() => save(ALL_OFF)} className={BTN_OUTLINE}>
              Reject all
            </button>
            <button type="button" onClick={() => save(ALL_ON)} className={BTN_OUTLINE}>
              Accept all
            </button>
            <button type="button" onClick={() => save(settings)} className={`${BTN_SOLID} order-first col-span-2 md:order-none md:col-span-1`}>
              {hasSaved && !dirty ? "Done" : "Save choices"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}