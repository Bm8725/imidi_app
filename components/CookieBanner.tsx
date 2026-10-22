"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ════════════════════════════════════════════════════════════════
   iMIDI · Privacy & cookie control panel (light theme)
   - Full-screen sheet on phones, large centered sheet on desktop
   - Floating icon (bottom-left) always available to reopen the settings
   - Single source of truth: /privacy imports CONSENT_CATEGORIES,
     SESSION_FIELDS and UI_PREF_KEYS from here, so both always match.
   Accent: #0070F3 (find & replace to rebrand)
   Fonts: Bricolage Grotesque (headings), Inter (text), JetBrains Mono (keys)
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

/* ───────────── look & feel ───────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600;12..96,700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
.imidi-cc { font-family: Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif; -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }
.imidi-cc .cc-display { font-family: 'Bricolage Grotesque', Inter, ui-sans-serif, system-ui, sans-serif; letter-spacing: -0.025em; }
.imidi-cc .font-mono { font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace; }
@keyframes cc-pop { from { opacity: 0; transform: translateY(14px) scale(.985); } to { opacity: 1; transform: none; } }
@keyframes cc-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes cc-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
.imidi-cc .cc-pop { animation: cc-pop .38s cubic-bezier(.2,.8,.2,1) both; }
.imidi-cc .cc-fade { animation: cc-fade .25s ease both; }
.imidi-cc .cc-rise { animation: cc-rise .42s cubic-bezier(.2,.8,.2,1) both; animation-delay: calc(var(--i, 0) * 50ms); }
.imidi-cc .cc-scroll { scrollbar-width: thin; scrollbar-color: #D6D6D6 transparent; }
@media (prefers-reduced-motion: reduce) { .imidi-cc .cc-pop, .imidi-cc .cc-fade, .imidi-cc .cc-rise { animation: none; } }
`;

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0070F3] focus-visible:ring-offset-2 focus-visible:ring-offset-white";

const ico = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round" } as const;

type IconName = "video" | "mic" | "keys" | "db" | "photo" | "lock" | "close" | "cookie" | "sliders" | "chevron" | "shield" | "check";

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
      {name === "shield" && <path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z" />}
      {name === "close" && <path d="M18 6L6 18M6 6l12 12" />}
      {name === "chevron" && <path d="M6 9l6 6 6-6" />}
      {name === "check" && <path d="M20 6L9 17l-5-5" />}
      {name === "sliders" && <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />}
      {name === "cookie" && (
        <>
          <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5z" />
          <path d="M8.5 8.5v.01M16 15.5v.01M12 12v.01M11 17v.01M7 13v.01" />
        </>
      )}
    </svg>
  );
}

function Mark() {
  return (
    <svg className="h-8 w-8 shrink-0" viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="9" fill="#111" />
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
      className={`relative h-8 w-14 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${FOCUS} ${
        on ? "bg-[#0070F3]" : "bg-[#D9D9D9]"
      }`}
    >
      <span
        className={`absolute left-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.25)] transition-transform duration-200 motion-reduce:transition-none ${
          on ? "translate-x-6 text-[#0070F3]" : "text-transparent"
        }`}
      >
        <Icon name="check" className="h-3.5 w-3.5" />
      </span>
    </button>
  );
}

function Presets({ count, onNone, onAll }: { count: number; onNone: () => void; onAll: () => void }) {
  const mode = count === 0 ? "none" : count === CONSENT_CATEGORIES.length ? "all" : "custom";
  const base = `flex-1 rounded-full px-3 py-2 text-[13px] font-medium transition-colors ${FOCUS}`;
  const on = "bg-white text-black shadow-[0_1px_2px_rgba(0,0,0,0.12)]";
  const off = "cursor-pointer text-[#666] hover:text-black";
  return (
    <div role="group" aria-label="Quick presets" className="flex w-full gap-1 rounded-full bg-[#F0F0F0] p-1 sm:w-auto">
      <button type="button" onClick={onNone} aria-pressed={mode === "none"} className={`${base} sm:px-4 ${mode === "none" ? on : off}`}>
        Essential only
      </button>
      <button
        type="button"
        disabled={mode !== "custom"}
        aria-pressed={mode === "custom"}
        className={`${base} sm:px-4 ${mode === "custom" ? on : "cursor-default text-[#B5B5B5]"}`}
      >
        Custom
      </button>
      <button type="button" onClick={onAll} aria-pressed={mode === "all"} className={`${base} sm:px-4 ${mode === "all" ? on : off}`}>
        Everything
      </button>
    </div>
  );
}

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
      <dt className="w-14 shrink-0 text-[12px] text-[#8A8A8A]">{k}</dt>
      <dd className="min-w-0 break-words font-mono text-[12px] leading-relaxed text-[#333]">{v}</dd>
    </div>
  );
}

function ChoiceCard({
  cat,
  on,
  onChange,
  index,
}: {
  cat: (typeof CONSENT_CATEGORIES)[number];
  on: boolean;
  onChange: () => void;
  index: number;
}) {
  const [open, setOpen] = useState(false);
  const id = `cc-details-${cat.key}`;
  return (
    <section
      className={`cc-rise rounded-2xl border bg-white transition-[border-color,box-shadow] duration-200 ${
        on ? "border-[#0070F3]/45 shadow-[0_0_0_4px_rgba(0,112,243,0.06)]" : "border-[#E6E6E6] hover:border-[#D4D4D4]"
      }`}
      style={{ ["--i" as string]: index } as React.CSSProperties}
    >
      <div className="flex items-start gap-4 p-4 sm:p-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h3 className="cc-display text-[18px] font-semibold leading-snug text-black">{cat.title}</h3>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                on ? "bg-[#0070F3]/10 text-[#0058C2]" : "bg-[#F0F0F0] text-[#777]"
              }`}
            >
              {on ? "On" : "Off"}
            </span>
          </div>
          <p className="mt-1.5 max-w-[60ch] text-[14px] leading-relaxed text-[#5C5C5C]">{cat.text}</p>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={id}
            onClick={() => setOpen((o) => !o)}
            className={`mt-3 inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-md text-[13px] font-medium text-[#555] transition-colors hover:text-black ${FOCUS}`}
          >
            <Icon name="chevron" className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
            Technical details
          </button>
        </div>
        <Switch on={on} label={cat.title} onChange={onChange} />
      </div>
      {open && (
        <dl id={id} className="cc-fade flex flex-col gap-2 rounded-b-2xl border-t border-[#EFEFEF] bg-[#FAFAFA] px-4 py-4 sm:px-5">
          <Meta k="Stores" v={cat.stores} />
          <Meta k="Kept" v={cat.kept} />
          <Meta k="If off" v={cat.off} />
        </dl>
      )}
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

const PERM: Record<PermState, { label: string; chip: string; dot: string }> = {
  granted: { label: "Allowed", chip: "bg-[#E8F7EE] text-[#136C34]", dot: "bg-[#1A9F4B]" },
  denied: { label: "Blocked", chip: "bg-[#FDECEC] text-[#B42318]", dot: "bg-[#E5484D]" },
  prompt: { label: "Not asked yet", chip: "bg-[#F2F2F2] text-[#5C5C5C]", dot: "bg-[#B5B5B5]" },
  unknown: { label: "Unknown here", chip: "bg-[#F2F2F2] text-[#5C5C5C]", dot: "bg-[#D0D0D0]" },
};

function PermissionRow({ icon, title, text, state }: { icon: "video" | "mic" | "keys"; title: string; text: string; state: PermState }) {
  const p = PERM[state];
  return (
    <li className="flex items-start gap-3.5 py-4">
      <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0070F3]/10 text-[#0070F3]">
        <Icon name={icon} className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
          <h4 className="text-[15px] font-semibold text-black">{title}</h4>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium ${p.chip}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${p.dot}`} aria-hidden />
            {p.label} in this browser
          </span>
        </div>
        <p className="mt-1.5 max-w-[60ch] text-[14px] leading-relaxed text-[#5C5C5C]">{text}</p>
      </div>
    </li>
  );
}

function CallPath() {
  const nodes: { icon: IconName; label: string; accent?: boolean }[] = [
    { icon: "video", label: "Your device" },
    { icon: "shield", label: "Browser asks first" },
    { icon: "lock", label: "Encrypted, device to device", accent: true },
    { icon: "video", label: "Other person" },
  ];
  return (
    <ol className="grid grid-cols-2 gap-2 sm:flex sm:items-stretch sm:gap-0" aria-label="How a private call travels">
      {nodes.map((n, i) => (
        <li key={n.label} className="flex items-center sm:flex-1">
          <div
            className={`flex w-full flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-center text-[13px] font-medium ${
              n.accent ? "border-[#0070F3]/40 bg-[#0070F3]/[0.05] text-black" : "border-[#E6E6E6] bg-white text-[#444]"
            }`}
          >
            <span className={n.accent ? "text-[#0070F3]" : "text-[#8A8A8A]"}>
              <Icon name={n.icon} className="h-[18px] w-[18px]" />
            </span>
            {n.label}
          </div>
          {i < nodes.length - 1 && <span className="hidden h-px w-5 shrink-0 border-t border-dashed border-[#BDBDBD] sm:block" aria-hidden />}
        </li>
      ))}
    </ol>
  );
}

function PaneTitle({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h3 className="cc-display text-[22px] font-semibold text-black">{title}</h3>
      <p className="mt-1.5 max-w-[64ch] text-[14px] leading-relaxed text-[#5C5C5C]">{text}</p>
    </div>
  );
}

function AirMidiPane({ active }: { active: boolean }) {
  const cam = usePermission("camera", undefined, active);
  const mic = usePermission("microphone", undefined, active);
  const midi = usePermission("midi", undefined, active);
  const sysex = usePermission("midi", { sysex: true }, active);

  return (
    <div className="flex flex-col gap-6">
      <PaneTitle
        title="Private calls and live sessions"
        text="Camera, microphone and MIDI are not cookies. Your browser asks you separately, and you can change or revoke each one in its site settings at any time. Nothing here depends on the cookie choices on the first tab."
      />

      <CallPath />

      <section className="rounded-2xl border border-[#E6E6E6] bg-white px-4 sm:px-5">
        <ul className="divide-y divide-[#EFEFEF]">
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

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-[#E6E6E6] bg-white p-4 sm:p-5">
          <div className="flex items-center gap-2 text-black">
            <Icon name="db" />
            <h4 className="text-[15px] font-semibold">Session details we keep</h4>
          </div>
          <p className="mt-1.5 text-[14px] leading-relaxed text-[#5C5C5C]">
            To pair devices and count your hours, linked to your account.
          </p>
          <dl className="mt-3 flex flex-col">
            {SESSION_FIELDS.map(([k, v]) => (
              <div key={k} className="flex flex-col border-t border-[#EFEFEF] py-2.5">
                <dt className="text-[14px] font-medium text-black">{k}</dt>
                <dd className="text-[13px] text-[#777]">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="rounded-2xl border border-[#E6E6E6] bg-white p-4 sm:p-5">
          <div className="flex items-center gap-2 text-black">
            <Icon name="photo" />
            <h4 className="text-[15px] font-semibold">Photos</h4>
          </div>
          <p className="mt-1.5 text-[14px] leading-relaxed text-[#5C5C5C]">
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

      <div className="overflow-x-auto rounded-2xl border border-[#E6E6E6] bg-white">
        <table className="w-full min-w-[440px] text-left text-[13px]">
          <thead className="bg-[#FAFAFA] text-[#666]">
            <tr>
              <th className="px-4 py-3 font-medium">Key</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Size</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EFEFEF]">
            {rows.map((r) => (
              <tr key={r.key}>
                <td className="px-4 py-3 font-mono text-[12px] text-[#222]">{r.key}</td>
                <td className="px-4 py-3 text-[#666]">
                  {r.present ? (
                    willRemove(r.key) ? (
                      <span className="font-medium text-[#B42318]">Stored, will be deleted on save</span>
                    ) : (
                      "Stored"
                    )
                  ) : (
                    <span className="text-[#A0A0A0]">Empty</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-mono text-[12px] text-[#666]">{r.present ? `${r.bytes} B` : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="max-w-[64ch] text-[13px] leading-relaxed text-[#777]">
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
      timer = setTimeout(() => setIsOpen(true), 1200);
    }
    // any "Cookie settings" link/button (footer, privacy page, floating icon): reopen with current choices
    const reopen = () => {
      const current = readConsent();
      setSettings(current ?? ALL_OFF);
      setSaved(current);
      setTab("choices");
      setIsOpen(true);
    };
    window.addEventListener(OPEN_EVENT, reopen);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener(OPEN_EVENT, reopen);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

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
    setSaved(finalSettings);
    applyCookieLogic(toSave);
    setIsOpen(false);
    setToast("Your choices are saved");
  };

  const flip = (k: OptionalKey) => setSettings((s) => ({ ...s, [k]: !s[k] }));
  const enabledCount = useMemo(() => CONSENT_CATEGORIES.filter((c) => settings[c.key]).length, [settings]);
  const dirty = useMemo(
    () => !saved || CONSENT_CATEGORIES.some((c) => saved[c.key] !== settings[c.key]),
    [saved, settings]
  );

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

  /* closed: persistent floating icon (+ confirmation after saving), always reachable */
  if (!isOpen) {
    return (
      <div className="imidi-cc fixed left-4 z-[90] flex items-center gap-2.5" style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}>
        <style>{CSS}</style>
        <button
          type="button"
          onClick={openCookieSettings}
          aria-label="Open cookie settings"
          className={`group flex h-12 cursor-pointer items-center rounded-full border border-[#E6E6E6] bg-white pl-[13px] pr-[13px] text-[#111] shadow-[0_6px_24px_rgba(0,0,0,0.12)] transition-all duration-200 hover:border-[#0070F3]/50 hover:text-[#0070F3] hover:shadow-[0_8px_28px_rgba(0,0,0,0.16)] active:scale-95 motion-reduce:transition-none md:hover:pr-4 md:focus-visible:pr-4 ${FOCUS}`}
        >
          <Icon name="cookie" className="h-[22px] w-[22px] shrink-0" />
          <span className="max-w-0 overflow-hidden whitespace-nowrap text-[13px] font-medium opacity-0 transition-all duration-200 md:group-hover:ml-2.5 md:group-hover:max-w-[10rem] md:group-hover:opacity-100 md:group-focus-visible:ml-2.5 md:group-focus-visible:max-w-[10rem] md:group-focus-visible:opacity-100">
            Cookie settings
          </span>
        </button>
        {toast && (
          <span
            role="status"
            className="cc-rise inline-flex items-center gap-2 rounded-full bg-[#111] px-4 py-2.5 text-[13px] font-medium text-white shadow-[0_6px_24px_rgba(0,0,0,0.2)]"
          >
            <Icon name="check" className="h-4 w-4 text-[#5BD68A]" />
            {toast}
          </span>
        )}
      </div>
    );
  }

  const TAB_ITEMS: { id: Tab; label: string; hint: string; icon: IconName; badge?: string }[] = [
    { id: "choices", label: "Cookies", hint: "Choose what is stored on this device", icon: "sliders", badge: `${enabledCount}/${CONSENT_CATEGORIES.length} on` },
    { id: "airmidi", label: "AirMIDI Link", hint: "Private video calls and live sessions", icon: "video" },
    { id: "device", label: "On this device", hint: "What is stored right now", icon: "db" },
  ];

  return (
    <div
      className="imidi-cc cc-fade fixed inset-0 z-[100] flex items-stretch justify-center bg-[#0B1220]/45 backdrop-blur-[6px] md:items-center md:p-6 lg:p-10"
      onKeyDown={onKeyDown}
    >
      <style>{CSS}</style>
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="imidi-consent-title"
        className="cc-pop relative flex h-full w-full max-w-[1180px] flex-col overflow-hidden bg-white text-[#111] outline-none md:h-[min(800px,calc(100dvh-3rem))] md:rounded-[28px] md:border md:border-white/60 md:shadow-[0_50px_140px_-30px_rgba(11,18,32,0.55)] lg:h-[min(800px,calc(100dvh-5rem))]"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        {/* header */}
        <header className="relative shrink-0 overflow-hidden border-b border-[#EDEDED] px-5 pb-5 pt-5 sm:px-8 sm:pb-6 sm:pt-7">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(0,112,243,0.14),transparent_65%)]"
          />
          <div className="relative flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="flex items-center gap-2.5 text-[14px] font-semibold text-black">
                  <Mark />
                  iMIDI
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-[#0070F3]/10 px-3.5 py-1.5 text-[13px] font-semibold text-[#0058C2]">
                  <Icon name="cookie" className="h-4 w-4" />
                  Cookies, privacy and live sessions
                </span>
              </div>
              <h2 id="imidi-consent-title" className="cc-display mt-5 text-[34px] font-bold leading-[1.05] text-black sm:text-[52px]">
                Cookies.
                <span className="block text-[#0070F3]">You decide what stays.</span>
              </h2>
              <p className="mt-4 max-w-[62ch] text-[14px] leading-relaxed text-[#5C5C5C] sm:text-[16px]">
                Cookies and local storage on imidi.co.uk and AirMIDI Link, including private video calls and live MIDI sessions. Everything optional
                is off until you turn it on.
              </p>
            </div>
            {hasSaved && (
              <button
                type="button"
                onClick={close}
                aria-label="Close without changing"
                className={`flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[#E3E3E3] bg-white text-[#555] transition-colors hover:bg-[#F4F4F4] hover:text-black ${FOCUS}`}
              >
                <Icon name="close" className="h-[18px] w-[18px]" />
              </button>
            )}
          </div>
        </header>

        {/* body */}
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {/* nav: tab bar on phones, side rail from md */}
          <nav
            aria-label="Cookie and privacy sections"
            className="shrink-0 border-b border-[#EDEDED] bg-[#FAFAFA] px-3 py-2.5 md:flex md:w-72 md:flex-col md:border-b-0 md:border-r md:px-4 md:py-5"
          >
            <div role="tablist" aria-orientation="vertical" className="grid grid-cols-3 gap-1 md:flex md:flex-col md:gap-1.5">
              {TAB_ITEMS.map((t) => {
                const sel = tab === t.id;
                return (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={sel}
                    onClick={() => setTab(t.id)}
                    className={`flex min-h-[56px] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2 text-center transition-all md:flex-row md:justify-start md:gap-3 md:px-3.5 md:py-3 md:text-left ${FOCUS} ${
                      sel
                        ? "border-[#E6E6E6] bg-white text-black shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                        : "border-transparent text-[#666] hover:bg-black/[0.04] hover:text-black"
                    }`}
                  >
                    <span className={`shrink-0 ${sel ? "text-[#0070F3]" : "text-[#8A8A8A]"}`}>
                      <Icon name={t.icon} className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-center gap-2 text-[13px] font-semibold md:justify-between md:text-[14px]">
                        {t.label}
                        {t.badge && (
                          <span className="hidden rounded-full bg-[#0070F3]/10 px-2 py-0.5 text-[11px] font-semibold text-[#0058C2] md:inline">
                            {t.badge}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 hidden text-[12px] leading-snug text-[#8A8A8A] md:block">{t.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-auto hidden rounded-2xl border border-[#E6E6E6] bg-white p-4 md:block">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-black">
                <span className="text-[#1A9F4B]">
                  <Icon name="lock" />
                </span>
                Required storage is always on
              </div>
              <p className="mt-1.5 text-[12px] leading-relaxed text-[#777]">
                Sign-in, account security and device pairing cannot work without it.
              </p>
            </div>
          </nav>

          {/* content */}
          <div role="tabpanel" className="cc-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-8 sm:py-7">
            {tab === "choices" && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="cc-display text-[22px] font-semibold text-black">Optional cookies</h3>
                  <Presets count={enabledCount} onNone={() => setSettings(ALL_OFF)} onAll={() => setSettings(ALL_ON)} />
                </div>
                {CONSENT_CATEGORIES.map((c, i) => (
                  <ChoiceCard key={c.key} cat={c} on={settings[c.key]} onChange={() => flip(c.key)} index={i} />
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
          className="shrink-0 border-t border-[#EDEDED] bg-white px-5 pt-4 sm:px-8 md:flex md:items-center md:justify-between md:gap-6 md:bg-[#FAFAFA]"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          <p className="mb-3 text-[13px] leading-relaxed text-[#777] md:mb-0">
            {hasSaved && dirty ? (
              <span className="inline-flex items-center gap-2 font-medium text-[#8A5A00]">
                <span className="h-2 w-2 rounded-full bg-[#F5A623]" aria-hidden />
                Unsaved changes
              </span>
            ) : (
              <>
                Change this any time with the cookie icon on every page.
                {PRIVACY_URL && (
                  <>
                    {" "}
                    <a href={PRIVACY_URL} className="font-medium text-[#0070F3] underline-offset-2 hover:underline">
                      Privacy policy
                    </a>
                  </>
                )}
              </>
            )}
          </p>
          <div className="grid grid-cols-2 gap-2 md:flex md:shrink-0 md:gap-3">
            <button
              onClick={() => savePreferences(ALL_OFF)}
              className={`min-h-12 cursor-pointer rounded-xl border border-[#D2D2D2] bg-white px-4 text-[14px] font-semibold text-black transition-colors hover:bg-[#F4F4F4] md:px-5 ${FOCUS}`}
            >
              Reject all
            </button>
            <button
              onClick={() => savePreferences(settings)}
              className={`order-first col-span-2 min-h-12 cursor-pointer rounded-xl bg-[#111] px-6 text-[14px] font-semibold text-white transition-colors hover:bg-[#2B2B2B] md:order-none md:col-span-1 md:px-7 ${FOCUS}`}
            >
              {hasSaved && !dirty ? "Done" : "Save choices"}
            </button>
            <button
              onClick={() => savePreferences(ALL_ON)}
              className={`min-h-12 cursor-pointer rounded-xl border border-[#D2D2D2] bg-white px-4 text-[14px] font-semibold text-black transition-colors hover:bg-[#F4F4F4] md:px-5 ${FOCUS}`}
            >
              Accept all
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}