"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/* ------------------------------------------------------------------ */
/*  CONFIG — edit this block to match imidi.co.uk                      */
/* ------------------------------------------------------------------ */

const SITE = {
  name: "iMIDI",
  assistant: "Smith",
  domain: "imidi.co.uk",
  // Put a real photo/illustration in /public (e.g. /smith.jpg) and set it here.
  // Leave "" to use the built-in illustrated avatar.
  avatarSrc: "",
  privacyHref: "/privacy",
  // Quick buttons shown above the message box.
  actions: [
    { label: "Talk to a human", href: "#contact", action: "contact", primary: true },
    { label: "Download app", href: "/download" },
    { label: "Support center", href: "/support" },
  ] as { label: string; href: string; primary?: boolean; action?: "contact" }[],
  prompts: [
    { text: "Which platforms does iMIDI support?", icon: "devices" },
    { text: "Help me set up my MIDI device", icon: "plug" },
    { text: "Fix audio latency or crackling", icon: "wave" },
    { text: "What can the real-time synth do?", icon: "spark" },
  ] as { text: string; icon: "devices" | "plug" | "wave" | "spark" }[],
};

const BRAND = "#3B5BDB";

/* Human contact: phone + WhatsApp. Hours are evaluated in this time zone. */
const BUSINESS_HOURS = {
  days: [1, 2, 3, 4, 5], // 1 = Monday ... 7 = Sunday
  startHour: 9,
  endHour: 18,
  timeZone: "Europe/Bucharest",
};

// Allow WhatsApp messages outside business hours? (Calls are always office-hours only.)
const ALLOW_WHATSAPP_OFFLINE = false;

const DEPARTMENTS = [
  {
    id: "general",
    label: "General Support",
    sublabel: "MIDI systems, i-volution, mounting system, firmware updates",
    number: "40765354998", // digits only, no '+'
    message: "Hi! I have a question about iMIDI / TS4X.",
  },
  {
    id: "cloud",
    label: "Cloud Support",
    sublabel: "Technical support, TS4X app support, firmware updates",
    number: "40729411747",
    message: "Hi! I need help with my cloud account and platform.",
  },
];

const fmtPhone = (n: string) => `+${n.slice(0, 2)} ${n.slice(2, 5)} ${n.slice(5, 8)} ${n.slice(8)}`;

function getBusinessStatus() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: BUSINESS_HOURS.timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  } as Intl.DateTimeFormatOptions).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const dayMap: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  const day = dayMap[get("weekday")] ?? 1;
  const hour = Number(get("hour")) + Number(get("minute")) / 60;
  const isOpen =
    BUSINESS_HOURS.days.includes(day) && hour >= BUSINESS_HOURS.startHour && hour < BUSINESS_HOURS.endHour;
  const hh = (n: number) => `${String(n).padStart(2, "0")}:00`;
  return {
    isOpen,
    hoursText: `Mon–Fri, ${hh(BUSINESS_HOURS.startHour)}–${hh(BUSINESS_HOURS.endHour)} (Romania time)`,
  };
}
const KEY_MSGS = "imidi-chat-v4";
const KEY_CONSENT = "imidi-chat-consent-v1";
const CONSENT_VERSION = 1;
const MAX_STORED = 40;

/* ------------------------------------------------------------------ */
/*  Sound engine (Web Audio, no files). Starts only after a click.     */
/* ------------------------------------------------------------------ */

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const C = window.AudioContext || (window as any).webkitAudioContext;
  if (!C) return null;
  if (!audioCtx) audioCtx = new C();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function tone(freq: number, at: number, dur: number, type: OscillatorType = "sine", vol = 0.06) {
  const ctx = getCtx();
  if (!ctx) return;
  const t0 = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

type Sfx = "open" | "close" | "send" | "receive" | "error" | "click" | "accept";

function playSound(name: Sfx) {
  switch (name) {
    case "open":
      tone(392, 0, 0.16, "triangle");
      tone(587.33, 0.08, 0.22, "triangle");
      break;
    case "close":
      tone(587.33, 0, 0.12, "triangle");
      tone(392, 0.07, 0.18, "triangle");
      break;
    case "send":
      tone(523.25, 0, 0.09, "sine", 0.05);
      tone(783.99, 0.06, 0.12, "sine", 0.05);
      break;
    case "receive":
      tone(659.25, 0, 0.14, "sine", 0.055);
      tone(880, 0.09, 0.14, "sine", 0.055);
      tone(1318.5, 0.18, 0.26, "sine", 0.04);
      break;
    case "accept":
      tone(523.25, 0, 0.12, "triangle");
      tone(659.25, 0.08, 0.12, "triangle");
      tone(783.99, 0.16, 0.26, "triangle");
      break;
    case "error":
      tone(220, 0, 0.18, "sawtooth", 0.03);
      tone(164.81, 0.12, 0.24, "sawtooth", 0.03);
      break;
    case "click":
      tone(880, 0, 0.05, "square", 0.02);
      break;
  }
}

/* ------------------------------------------------------------------ */
/*  Types + helpers                                                    */
/* ------------------------------------------------------------------ */

interface ChatImage {
  url: string;
  alt?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  images?: ChatImage[];
  suggestions?: string[];
  fresh?: boolean;
  error?: boolean;
  feedback?: "up" | "down";
}

interface Consent {
  v: number;
  ts: number;
  save: boolean; // keep chat on this device
  sound: boolean;
}

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

function extractImages(text: string): { cleanText: string; images: ChatImage[] } {
  const images: ChatImage[] = [];
  let cleanText = text.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, (_m, alt, url) => {
    images.push({ url, alt: alt || "" });
    return "";
  });
  cleanText = cleanText.replace(/(https?:\/\/[^\s]+\.(?:png|jpe?g|webp|gif))/gi, (m) => {
    images.push({ url: m });
    return "";
  });
  return { cleanText: cleanText.trim(), images };
}

const safeHref = (href: string) =>
  /^https?:\/\//i.test(href) || href.startsWith("/") ? href : null;

function SmartLink({ href, children }: { href: string; children: React.ReactNode }) {
  const safe = safeHref(href);
  if (!safe) return <>{children}</>;
  const external = /^https?:\/\//i.test(safe) && !safe.includes(SITE.domain);
  return (
    <a
      href={safe}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="break-words font-medium text-[#2F4AC0] underline decoration-[#2F4AC0]/30 underline-offset-2 hover:decoration-[#2F4AC0]"
    >
      {children}
    </a>
  );
}

function renderInline(text: string, key: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|https?:\/\/[^\s)]+)/g);
  return parts.map((p, i) => {
    const k = `${key}-${i}`;
    if (!p) return null;
    if (p.startsWith("**") && p.endsWith("**") && p.length > 4)
      return <strong key={k} className="font-semibold text-[#0E1330]">{p.slice(2, -2)}</strong>;
    if (p.startsWith("`") && p.endsWith("`") && p.length > 2)
      return (
        <code key={k} className="rounded-sm bg-[#EEF2FF] px-1.5 py-0.5 font-mono text-[12px] text-[#2F4AC0]">
          {p.slice(1, -1)}
        </code>
      );
    const md = p.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (md) return <SmartLink key={k} href={md[2]}>{md[1]}</SmartLink>;
    if (/^https?:\/\//.test(p))
      return (
        <SmartLink key={k} href={p}>
          {p.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
        </SmartLink>
      );
    return <span key={k}>{p}</span>;
  });
}

function renderRich(text: string): React.ReactNode {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flush = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(
      <Tag
        key={`l-${blocks.length}`}
        className={`my-1.5 space-y-1 pl-5 ${list.ordered ? "list-decimal" : "list-disc"} marker:text-[#3B5BDB]`}
      >
        {list.items.map((it, i) => (
          <li key={i}>{renderInline(it, `li-${blocks.length}-${i}`)}</li>
        ))}
      </Tag>
    );
    list = null;
  };

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const num = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (bullet || num) {
      const ordered = !!num;
      if (!list || list.ordered !== ordered) {
        flush();
        list = { ordered, items: [] };
      }
      list.items.push((bullet || num)![1]);
      return;
    }
    flush();
    if (!line.trim()) return;
    blocks.push(
      <p key={`p-${idx}`} className="my-1 first:mt-0 last:mb-0">
        {renderInline(line, `p-${idx}`)}
      </p>
    );
  });
  flush();
  return blocks;
}

function useTyped(text: string, enabled: boolean, onTick?: () => void) {
  const [n, setN] = useState(enabled ? 0 : text.length);
  const tick = useRef(onTick);
  tick.current = onTick;

  useEffect(() => {
    if (!enabled || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setN(text.length);
      return;
    }
    let i = 0;
    const id = setInterval(() => {
      i = Math.min(text.length, i + 3);
      setN(i);
      tick.current?.();
      if (i >= text.length) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [text, enabled]);

  return { shown: text.slice(0, n), done: n >= text.length };
}

/* ------------------------------------------------------------------ */
/*  Small pieces                                                       */
/* ------------------------------------------------------------------ */

function ChatIcon({ size = 24, color = "white" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5.5 3.5h13A2.5 2.5 0 0121 6v8.5a2.5 2.5 0 01-2.5 2.5H11.2l-4.1 3.5a.6.6 0 01-1-.46V17H5.5A2.5 2.5 0 013 14.5V6a2.5 2.5 0 012.5-2.5z"
        stroke={color}
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle cx="8.2" cy="10.3" r="1.1" fill={color} />
      <circle cx="12" cy="10.3" r="1.1" fill={color} />
      <circle cx="15.8" cy="10.3" r="1.1" fill={color} />
    </svg>
  );
}

// Friendly support-agent illustration, used when no photo is configured.
function PersonIllustration() {
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
      <rect width="64" height="64" fill="#DCE4FF" />
      <path d="M8 66c2-13 12-19 24-19s22 6 24 19z" fill="#4F6BFF" />
      <path d="M26 47l6 7 6-7" fill="#fff" opacity=".9" />
      <rect x="28" y="36" width="8" height="11" rx="4" fill="#E6B08F" />
      <ellipse cx="32" cy="28" rx="11" ry="12.5" fill="#F3CBA9" />
      <path d="M20.6 28C19 16.5 26.5 11 33 11.2c7 .2 12.8 5 11.4 16.8-1.5-5.2-4.6-8.4-9.2-9-5 2.7-10.2 3.3-14.6 9z" fill="#3A2823" />
      <circle cx="27.8" cy="29.5" r="1.25" fill="#2A1C18" />
      <circle cx="36.2" cy="29.5" r="1.25" fill="#2A1C18" />
      <path d="M28.4 34.2c2 2.3 5.2 2.3 7.2 0" stroke="#B5654A" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M20.4 28a11.6 11.6 0 0123.2 0" stroke="#1F2547" strokeWidth="2.3" fill="none" strokeLinecap="round" />
      <rect x="18.2" y="26.5" width="3.6" height="8" rx="1.8" fill="#1F2547" />
      <rect x="42.2" y="26.5" width="3.6" height="8" rx="1.8" fill="#1F2547" />
      <path d="M20 34c0 4.5 3.5 6.5 8 6.5" stroke="#1F2547" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <circle cx="29" cy="40.5" r="1.7" fill="#1F2547" />
    </svg>
  );
}

function Avatar({ size = 28, online = false, round = false }: { size?: number; online?: boolean; round?: boolean }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <div className={`h-full w-full overflow-hidden shadow-sm ring-2 ring-white ${round ? "rounded-full" : "rounded-sm"}`}>
        {SITE.avatarSrc && !broken ? (
          <img
            src={SITE.avatarSrc}
            alt={SITE.assistant}
            className="h-full w-full object-cover"
            onError={() => setBroken(true)}
          />
        ) : (
          <PersonIllustration />
        )}
      </div>
      {online && (
        <span
          className="absolute bottom-[2%] right-[2%] rounded-full border-2 border-white bg-[#22C58B]"
          style={{ width: Math.max(10, size * 0.22), height: Math.max(10, size * 0.22) }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

function PromptIcon({ name }: { name: "devices" | "plug" | "wave" | "spark" }) {
  const c = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "devices") return <svg {...c}><rect x="3" y="4" width="13" height="9" rx="2" /><path d="M8 17h3M9.5 13v4" /><rect x="17" y="8" width="4" height="9" rx="1.2" /></svg>;
  if (name === "plug") return <svg {...c}><path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 01-12 0V8zM12 17v4" /></svg>;
  if (name === "wave") return <svg {...c}><path d="M3 12h3l2-6 4 12 3-9 2 3h4" /></svg>;
  return <svg {...c}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3zM19 16l.7 2.1L22 19l-2.3.9L19 22l-.7-2.1L16 19l2.3-.9L19 16z" /></svg>;
}

function WhatsAppIcon({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.29.173-1.414-.074-.124-.272-.198-.57-.347z" />
      <path d="M12.001 2c-5.514 0-9.988 4.474-9.988 9.988 0 1.76.462 3.482 1.34 4.998L2 22l5.146-1.34a9.96 9.96 0 0 0 4.855 1.238h.004c5.514 0 9.987-4.474 9.987-9.988C21.992 6.474 17.518 2 12.001 2zm0 18.16h-.003a8.155 8.155 0 0 1-4.163-1.14l-.299-.177-3.056.796.816-2.98-.194-.306a8.15 8.15 0 0 1-1.253-4.365c0-4.505 3.667-8.171 8.176-8.171 2.184 0 4.238.851 5.782 2.396a8.12 8.12 0 0 1 2.393 5.787c-.002 4.505-3.668 8.16-8.199 8.16z" />
    </svg>
  );
}

const I = {
  speakerOn: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4zM15.5 9a4 4 0 010 6M18 6.5a8 8 0 010 11" /></svg>,
  speakerOff: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4zM16 9.5l5 5M21 9.5l-5 5" /></svg>,
  dots: <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>,
  close: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>,
  mic: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21" /></svg>,
  download: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v11M7 11l5 5 5-5M5 20h14" /></svg>,
  trash: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V4h6v3" /></svg>,
  shield: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6l8-3zM9 12l2.2 2.2L15.5 10" /></svg>,
  expand: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" /></svg>,
  save: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 4h11l3 3v13H5V4zM8 4v5h7V4M8 20v-6h8v6" /></svg>,
  human: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.8-4 3.8-6 7-6s6.2 2 7 6" /></svg>,
  phone: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" /></svg>,
  arrowDown: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M6 13l6 6 6-6" /></svg>,
};

function Equalizer() {
  return (
    <div className="flex h-4 items-end gap-[3px]" aria-label="Smith is typing" role="status">
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className="im-eq w-[3px] rounded-full" style={{ height: "100%", animationDelay: `${i * 0.12}s`, background: BRAND }} />
      ))}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
  active,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#3B5BDB] ${
        active ? "bg-[#3B5BDB]/15 text-[#2F4AC0]" : "text-[#4B5278] hover:bg-[#0E1330]/[0.07] hover:text-[#0E1330]"
      }`}
    >
      {children}
    </button>
  );
}

function Switch({ on }: { on: boolean }) {
  return (
    <span className={`relative inline-block h-[18px] w-8 flex-shrink-0 rounded-full transition-colors ${on ? "bg-[#3B5BDB]" : "bg-[#C9CCE0]"}`} aria-hidden="true">
      <span className={`absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow transition-all ${on ? "left-[16px]" : "left-[2px]"}`} />
    </span>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  toggle,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  toggle?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-left text-[13px] font-medium transition-colors ${
        danger ? "text-[#B42318] hover:bg-[#FFF1F0]" : "text-[#1F2547] hover:bg-[#F1F2FA]"
      }`}
    >
      <span className={danger ? "text-[#B42318]" : "text-[#6B7194]"}>{icon}</span>
      <span className="flex-1">{label}</span>
      {toggle !== undefined && <Switch on={toggle} />}
    </button>
  );
}

function AssistantMessage({
  msg,
  onTick,
  onCopy,
  onFeedback,
  onRetry,
  onSuggest,
  onImage,
  isLast,
}: {
  msg: Message;
  onTick: () => void;
  onCopy: (text: string) => void;
  onFeedback: (id: string, v: "up" | "down") => void;
  onRetry: () => void;
  onSuggest: (t: string) => void;
  onImage: (img: ChatImage) => void;
  isLast: boolean;
}) {
  const { shown, done } = useTyped(msg.content, !!msg.fresh, onTick);
  const [copied, setCopied] = useState(false);

  return (
    <div className="im-msg-in group flex items-start gap-2.5">
      <div className="mt-0.5"><Avatar size={30} /></div>

      <div className="flex min-w-0 max-w-[86%] flex-col gap-1.5">
        {msg.content && (
          <div
            className={`rounded-sm border px-3.5 py-2.5 text-[13.5px] leading-relaxed ${
              msg.error
                ? "border-[#FFD0D0] bg-[#FFF3F3] text-[#9B1C1C]"
                : "border-[#E7E9F5] bg-white text-[#1F2547] shadow-sm"
            }`}
          >
            {renderRich(shown)}
          </div>
        )}

        {msg.images && msg.images.length > 0 && done && (
          <div className={`grid gap-1.5 ${msg.images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`} style={{ maxWidth: msg.images.length === 1 ? 240 : 280 }}>
            {msg.images.map((img, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onImage(img)}
                className="im-thumb relative cursor-zoom-in overflow-hidden rounded-sm border border-[#E7E9F5] bg-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#3B5BDB]"
                style={{ aspectRatio: msg.images!.length === 1 ? "16/10" : "1/1" }}
              >
                <img src={img.url} alt={img.alt || `${SITE.name} attachment`} loading="lazy" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}

        {done && msg.error && isLast && (
          <button type="button" onClick={onRetry} className="self-start rounded-sm border border-[#E7E9F5] bg-white px-3 py-1.5 text-xs font-semibold text-[#1F2547] shadow-sm hover:bg-[#F3F4FC]">
            Try again
          </button>
        )}

        {done && !msg.error && (
          <div className="flex items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 max-sm:opacity-70">
            <button
              type="button"
              aria-label={copied ? "Copied" : "Copy answer"}
              title={copied ? "Copied" : "Copy answer"}
              onClick={() => {
                onCopy(msg.content);
                setCopied(true);
                setTimeout(() => setCopied(false), 1400);
              }}
              className={`flex h-7 w-7 items-center justify-center rounded-sm ${copied ? "bg-[#3B5BDB]/15 text-[#2F4AC0]" : "text-[#7A80A3] hover:bg-[#0E1330]/[0.06] hover:text-[#0E1330]"}`}
            >
              {copied ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 012-2h9" /></svg>
              )}
            </button>
            <button type="button" aria-label="Helpful" title="Helpful" onClick={() => onFeedback(msg.id, "up")} className={`flex h-7 w-7 items-center justify-center rounded-sm ${msg.feedback === "up" ? "bg-[#3B5BDB]/15 text-[#2F4AC0]" : "text-[#7A80A3] hover:bg-[#0E1330]/[0.06] hover:text-[#0E1330]"}`}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 11v9H4v-9h3zM7 11l4-8a2 2 0 012 2v4h6a2 2 0 012 2.3l-1.2 7A2 2 0 0117.8 20H7" /></svg>
            </button>
            <button type="button" aria-label="Not helpful" title="Not helpful" onClick={() => onFeedback(msg.id, "down")} className={`flex h-7 w-7 items-center justify-center rounded-sm ${msg.feedback === "down" ? "bg-[#3B5BDB]/15 text-[#2F4AC0]" : "text-[#7A80A3] hover:bg-[#0E1330]/[0.06] hover:text-[#0E1330]"}`}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 13V4h3v9h-3zM17 13l-4 8a2 2 0 01-2-2v-4H5a2 2 0 01-2-2.3l1.2-7A2 2 0 016.2 4H17" /></svg>
            </button>
          </div>
        )}

        {done && isLast && msg.suggestions && msg.suggestions.length > 0 && (
          <div className="mt-0.5 flex flex-wrap gap-1.5">
            {msg.suggestions.slice(0, 3).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onSuggest(s)}
                className="im-chip rounded-sm border border-[#3B5BDB]/30 bg-white px-3 py-1.5 text-xs font-medium text-[#2F4AC0] shadow-sm hover:border-[#3B5BDB]/60 hover:bg-[#EEF2FF]"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main widget                                                        */
/* ------------------------------------------------------------------ */

export default function AIChatWidget() {
  const pathname = usePathname();

  const [isOpen, setIsOpen] = useState(false);
  const [showGreeting, setShowGreeting] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [lightbox, setLightbox] = useState<ChatImage | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const [consent, setConsent] = useState<Consent | null>(null);
  const [agree, setAgree] = useState(false);
  const [optSave, setOptSave] = useState(false);
  const [optSound, setOptSound] = useState(true);

  const [menuOpen, setMenuOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const [micOk, setMicOk] = useState(false);
  const [listening, setListening] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [, setTick] = useState(0);

  // Keep the open/closed status fresh while the contact sheet is visible.
  useEffect(() => {
    if (!contactOpen) return;
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, [contactOpen]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const recRef = useRef<any>(null);
  const soundRef = useRef(false);
  soundRef.current = !!consent?.sound;

  const sfx = useCallback((n: Sfx) => {
    if (soundRef.current) playSound(n);
  }, []);

  /* ---- load consent (and chat only if the user allowed saving) ---- */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY_CONSENT);
      if (raw) {
        const c: Consent = JSON.parse(raw);
        if (c.v === CONSENT_VERSION) {
          setConsent(c);
          if (c.save) {
            const m = localStorage.getItem(KEY_MSGS);
            if (m) setMessages(JSON.parse(m));
          }
        }
      }
    } catch {}
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setMicOk(!!SR);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (consent) localStorage.setItem(KEY_CONSENT, JSON.stringify(consent));
      else localStorage.removeItem(KEY_CONSENT);
    } catch {}
  }, [consent, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (consent?.save) {
        const clean = messages.slice(-MAX_STORED).map((m) => ({ ...m, fresh: false }));
        localStorage.setItem(KEY_MSGS, JSON.stringify(clean));
      } else {
        localStorage.removeItem(KEY_MSGS);
      }
    } catch {}
  }, [messages, consent?.save, hydrated]);

  /* ---- scrolling / focus / keys ---- */
  const scrollDown = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight });
  }, []);

  const onScroll = () => {
    const el = scrollRef.current;
    if (el) setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
  };

  useEffect(() => {
    if (isOpen) scrollDown();
  }, [messages, loading, isOpen, scrollDown]);

  useEffect(() => {
    if (isOpen && consent) setTimeout(() => inputRef.current?.focus(), 120);
  }, [isOpen, consent]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (lightbox) setLightbox(null);
      else if (contactOpen) setContactOpen(false);
      else if (menuOpen) setMenuOpen(false);
      else if (isOpen) closePanel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightbox, menuOpen, contactOpen, isOpen]);

  useEffect(() => () => recRef.current?.stop?.(), []);

  /* ---- panel open/close ---- */
  const openPanel = () => {
    setIsOpen(true);
    setShowGreeting(false);
    sfx("open");
  };
  const closePanel = () => {
    recRef.current?.stop?.();
    setMenuOpen(false);
    setContactOpen(false);
    setIsOpen(false);
    sfx("close");
  };

  /* ---- consent ---- */
  const accept = () => {
    const c: Consent = { v: CONSENT_VERSION, ts: Date.now(), save: optSave, sound: optSound };
    setConsent(c);
    soundRef.current = optSound;
    if (optSound) playSound("accept"); // user gesture: audio is allowed now
  };

  const withdraw = () => {
    abortRef.current?.abort();
    recRef.current?.stop?.();
    setLoading(false);
    setMessages([]);
    setConsent(null);
    setAgree(false);
    setOptSave(false);
    setMenuOpen(false);
    try {
      localStorage.removeItem(KEY_MSGS);
      localStorage.removeItem(KEY_CONSENT);
    } catch {}
  };

  const patchConsent = (patch: Partial<Consent>) => setConsent((c) => (c ? { ...c, ...patch } : c));

  /* ---- network ---- */
  const request = useCallback(
    async (history: Message[]) => {
      setLoading(true);
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            messages: history.map(({ role, content }) => ({ role, content })),
            page: pathname,
            site: SITE.domain,
          }),
        });

        const data = await res.json();
        let aiText: string = data?.generated_text || "";
        let failed = false;

        if (!res.ok || data?.error) {
          aiText = "The assistant is waking up. Please try again in a few seconds.";
          failed = true;
        } else if (!aiText) {
          aiText = "I could not process that. Please rephrase your question.";
          failed = true;
        }

        const { cleanText, images: parsed } = extractImages(aiText.trim());
        const apiImages: ChatImage[] = Array.isArray(data?.images)
          ? data.images.map((i: string | ChatImage) => (typeof i === "string" ? { url: i } : i))
          : [];
        const images = [...apiImages, ...parsed];
        const suggestions: string[] | undefined = Array.isArray(data?.suggestions)
          ? data.suggestions.filter((s: unknown) => typeof s === "string")
          : undefined;

        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            role: "assistant",
            content: cleanText,
            images: images.length ? images : undefined,
            suggestions,
            fresh: !failed,
            error: failed,
          },
        ]);
        if (soundRef.current) playSound(failed ? "error" : "receive");
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        setMessages((prev) => [
          ...prev,
          { id: uid(), role: "assistant", content: "Connection problem. Check your network and try again.", error: true },
        ]);
        if (soundRef.current) playSound("error");
      } finally {
        setLoading(false);
        abortRef.current = null;
      }
    },
    [pathname]
  );

  const submit = useCallback(
    (text: string) => {
      const value = text.trim();
      if (!value || loading || !consent) return;
      recRef.current?.stop?.();
      const next: Message[] = [
        ...messages.map((m) => ({ ...m, fresh: false })),
        { id: uid(), role: "user", content: value },
      ];
      setMessages(next);
      setInput("");
      if (inputRef.current) inputRef.current.style.height = "auto";
      sfx("send");
      request(next);
    },
    [messages, loading, consent, request, sfx]
  );

  const retry = () => {
    const base = messages.filter((_, i) => i !== messages.length - 1);
    if (!base.length || base[base.length - 1].role !== "user") return;
    setMessages(base);
    request(base);
  };

  const stop = () => {
    abortRef.current?.abort();
    setLoading(false);
  };

  const clearChat = () => {
    abortRef.current?.abort();
    setLoading(false);
    setMessages([]);
    setMenuOpen(false);
    inputRef.current?.focus();
  };

  const downloadTranscript = () => {
    const body = messages
      .map((m) => `${m.role === "user" ? "You" : SITE.assistant}: ${m.content}`)
      .join("\n\n");
    const blob = new Blob([`${SITE.name} chat transcript\n${new Date().toLocaleString()}\n\n${body}\n`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${SITE.name.toLowerCase()}-chat.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setMenuOpen(false);
  };

  const setFeedback = (id: string, v: "up" | "down") => {
    sfx("click");
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, feedback: m.feedback === v ? undefined : v } : m)));
  };

  const copy = (text: string) => {
    sfx("click");
    try {
      navigator.clipboard?.writeText(text);
    } catch {}
  };

  /* ---- voice dictation (browser speech service) ---- */
  const autosize = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  const toggleMic = () => {
    if (listening) {
      recRef.current?.stop?.();
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = "en-GB";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e: any) => {
      const t = Array.from(e.results).map((r: any) => r[0].transcript).join("");
      setInput(t);
      requestAnimationFrame(() => autosize(inputRef.current));
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    sfx("click");
    rec.start();
  };

  const lastIdx = messages.length - 1;
  const compact = !!consent && messages.length > 0;
  const btnTop = compact ? "top-[62px] sm:top-[18px]" : "top-12 sm:top-3.5";

  /* ---------------------------------------------------------------- */

  return (
    <>
      <style>{`
        .im-font { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }

        @keyframes im-eq { 0%,100% { transform: scaleY(.25); } 50% { transform: scaleY(1); } }
        @keyframes im-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes im-pulse { 0% { box-shadow: 0 0 0 0 rgba(59,91,219,.45); } 100% { box-shadow: 0 0 0 10px rgba(59,91,219,0); } }

        .im-eq { transform-origin: bottom; animation: im-eq .9s ease-in-out infinite; }
        .im-msg-in, .im-menu-in, .im-fade { animation: im-fade .15s ease-out; }
        .im-mic-on { animation: im-pulse 1.1s ease-out infinite; }
        .im-chip { transition: background-color .15s ease, border-color .15s ease; }
        .im-panel-size { transition: width .25s ease, height .25s ease; }

        .im-scroll::-webkit-scrollbar, .im-hscroll::-webkit-scrollbar { width: 6px; height: 0; }
        .im-scroll::-webkit-scrollbar-thumb { background: rgba(80,90,160,.2); border-radius: 999px; }
        .im-scroll::-webkit-scrollbar-track { background: transparent; }

        @media (prefers-reduced-motion: reduce) {
          .im-eq, .im-msg-in, .im-menu-in, .im-fade, .im-mic-on { animation: none !important; }
        }
      `}</style>

      {/* LAUNCHER */}
      {!isOpen && (
        <div className="im-font fixed bottom-[170px] right-4 z-50 flex items-center gap-3 antialiased sm:right-5">
          {showGreeting && (
            <div
              role="button"
              tabIndex={0}
              onClick={openPanel}
              onKeyDown={(e) => e.key === "Enter" && openPanel()}
              className="relative flex max-w-[240px] cursor-pointer items-center gap-2.5 rounded-2xl rounded-br-md border border-[#E7E9F5] bg-white py-2.5 pl-2.5 pr-4 shadow-md"
            >
              <button
                type="button"
                aria-label="Dismiss"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowGreeting(false);
                }}
                className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#0E1330] text-[10px] text-white hover:bg-[#3B5BDB]"
              >
                ✕
              </button>
              <Avatar size={36} online round />
              <div>
                <p className="text-[13px] font-semibold leading-tight text-[#0E1330]">Need a hand with {SITE.name}?</p>
                <p className="mt-0.5 text-xs leading-snug text-[#6B7194]">{SITE.assistant}, AI assistant</p>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={openPanel}
            aria-label={`Open ${SITE.name} chat`}
            title="Chat with us"
            className="flex h-[58px] w-[58px] items-center justify-center rounded-full bg-[#3B5BDB] shadow-md transition-colors hover:bg-[#2F4AC0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#3B5BDB]"
          >
            <ChatIcon size={30} />
          </button>
        </div>
      )}

      {/* PANEL */}
      {isOpen && (
        <div
          role="dialog"
          aria-label={`${SITE.name} assistant`}
          className={`im-font im-panel-size fixed inset-0 z-50 h-[100dvh] w-full overflow-hidden bg-white antialiased
                     sm:inset-auto sm:bottom-6 sm:right-6 sm:max-h-[90vh] sm:rounded-none sm:border sm:border-[#D9DCEB] sm:shadow-2xl
                     ${expanded ? "sm:h-[780px] sm:w-[600px]" : "sm:h-[680px] sm:w-[410px]"}`}
        >
          <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#F6F7FC]">
            {/* header */}
            <div className="relative border-b border-[#E7E9F5] bg-white">

              {compact ? (
                <div className="relative flex items-center gap-3 px-4 pb-3.5 pt-14 sm:pt-4">
                  <Avatar size={42} online />
                  <div className="leading-tight">
                    <p className="text-[15px] font-semibold text-[#0E1330]">{SITE.assistant}</p>
                    <p className="text-xs text-[#4B5278]">{SITE.name} AI assistant, online</p>
                  </div>
                </div>
              ) : (
                <div className="relative flex flex-col items-center px-4 pb-5 pt-[88px] text-center sm:pt-7">
                  <Avatar size={72} online />
                  <p className="mt-3 text-[17px] font-bold text-[#0E1330]">{SITE.assistant}</p>
                  <p className="text-xs text-[#4B5278]">{SITE.name} AI assistant, online</p>
                </div>
              )}
            </div>

            {/* header buttons (outside the clipped header so the menu can open) */}
            <div className={`absolute right-3 z-20 flex items-center gap-0.5 ${btnTop}`}>
              {consent && (
                <IconButton
                  label={consent.sound ? "Mute sounds" : "Turn sounds on"}
                  onClick={() => {
                    const next = !consent.sound;
                    soundRef.current = next;
                    patchConsent({ sound: next });
                    if (next) playSound("click");
                  }}
                >
                  {consent.sound ? I.speakerOn : I.speakerOff}
                </IconButton>
              )}
              {consent && (
                <IconButton label="More options" onClick={() => setMenuOpen((v) => !v)} active={menuOpen}>
                  {I.dots}
                </IconButton>
              )}
              <IconButton label="Close chat" onClick={closePanel}>{I.close}</IconButton>
            </div>

            {menuOpen && consent && (
              <>
                <div className="absolute inset-0 z-20" onClick={() => setMenuOpen(false)} aria-hidden="true" />
                <div
                  role="menu"
                  className={`im-menu-in absolute right-3 z-30 w-[252px] rounded-sm border border-[#E7E9F5] bg-white p-1.5 shadow-sm ${
                    compact ? "top-[100px] sm:top-[56px]" : "top-[92px] sm:top-[54px]"
                  }`}
                >
                  <MenuItem
                    icon={consent.sound ? I.speakerOn : I.speakerOff}
                    label="Sounds"
                    toggle={consent.sound}
                    onClick={() => {
                      const next = !consent.sound;
                      soundRef.current = next;
                      patchConsent({ sound: next });
                      if (next) playSound("click");
                    }}
                  />
                  <MenuItem icon={I.save} label="Save chat on this device" toggle={consent.save} onClick={() => patchConsent({ save: !consent.save })} />
                  <span className="max-sm:hidden">
                    <MenuItem icon={I.expand} label={expanded ? "Smaller window" : "Larger window"} onClick={() => { setExpanded((v) => !v); setMenuOpen(false); }} />
                  </span>
                  <MenuItem icon={I.phone} label="Call or WhatsApp us" onClick={() => { setMenuOpen(false); setContactOpen(true); }} />
                  <div className="my-1 h-px bg-[#EDEEF7]" />
                  {messages.length > 0 && <MenuItem icon={I.download} label="Download transcript" onClick={downloadTranscript} />}
                  {messages.length > 0 && <MenuItem icon={I.trash} label="Clear conversation" onClick={clearChat} />}
                  <MenuItem icon={I.shield} label="Withdraw consent and erase" danger onClick={withdraw} />
                </div>
              </>
            )}

            {/* contact sheet: phone + WhatsApp */}
            {contactOpen && (() => {
              const bh = getBusinessStatus();
              const canCall = bh.isOpen;
              const canWa = bh.isOpen || ALLOW_WHATSAPP_OFFLINE;
              return (
                <div role="dialog" aria-label="Contact our team" className="im-fade absolute inset-0 z-40 flex flex-col bg-[#F6F7FC]">
                  <div className="flex items-center justify-between border-b border-[#E7E9F5] bg-white px-4 pb-3 pt-14 sm:pt-3.5">
                    <div className="leading-tight">
                      <p className="text-[15px] font-semibold text-[#0E1330]">Talk to a human</p>
                      <p className="text-xs text-[#4B5278]">Call or message our team</p>
                    </div>
                    <IconButton label="Close" onClick={() => setContactOpen(false)}>{I.close}</IconButton>
                  </div>

                  <div className={`flex items-center justify-between gap-3 border-b px-4 py-2 text-[12px] ${bh.isOpen ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-amber-100 bg-amber-50 text-amber-800"}`}>
                    <span className="flex items-center gap-2 font-semibold">
                      <span className={`h-2 w-2 rounded-full ${bh.isOpen ? "bg-emerald-500" : "bg-amber-500"}`} />
                      {bh.isOpen ? "Team online now" : "Team offline right now"}
                    </span>
                    <span className="text-right">{bh.hoursText}</span>
                  </div>

                  <div className="im-scroll flex-1 space-y-3 overflow-y-auto p-4">
                    {DEPARTMENTS.map((d) => (
                      <div key={d.id} className="border border-[#E7E9F5] bg-white p-4 shadow-sm">
                        <p className="text-[14px] font-semibold text-[#0E1330]">{d.label}</p>
                        <p className="mt-0.5 text-[12px] leading-snug text-[#6B7194]">{d.sublabel}</p>

                        <p className="mt-3 flex items-center gap-2 text-[15px] font-semibold tabular-nums tracking-wide text-[#1F2547]">
                          <span className="text-[#6B7194]">{I.phone}</span>
                          {fmtPhone(d.number)}
                        </p>

                        <div className="mt-3 grid grid-cols-2 gap-2">
                          {canCall ? (
                            <a
                              href={`tel:+${d.number}`}
                              onClick={() => sfx("click")}
                              className="flex h-10 items-center justify-center gap-2 border border-[#0E1330] bg-white text-[13px] font-semibold text-[#0E1330] transition-colors hover:bg-[#0E1330] hover:text-white"
                            >
                              {I.phone} Call
                            </a>
                          ) : (
                            <span aria-disabled="true" className="flex h-10 cursor-not-allowed select-none items-center justify-center gap-2 border border-[#E1E3F0] bg-[#F1F2FA] text-[13px] font-semibold text-[#9097B8]">
                              {I.phone} Call
                            </span>
                          )}

                          {canWa ? (
                            <a
                              href={`https://wa.me/${d.number}?text=${encodeURIComponent(d.message)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => sfx("click")}
                              className="flex h-10 items-center justify-center gap-2 bg-[#128C7E] text-[13px] font-semibold text-white transition-colors hover:bg-[#0F7A6E]"
                            >
                              <WhatsAppIcon size={16} /> WhatsApp
                            </a>
                          ) : (
                            <span aria-disabled="true" className="flex h-10 cursor-not-allowed select-none items-center justify-center gap-2 bg-[#F1F2FA] text-[13px] font-semibold text-[#9097B8]">
                              <WhatsAppIcon size={16} /> WhatsApp
                            </span>
                          )}
                        </div>
                      </div>
                    ))}

                    <p className="px-1 text-[11px] leading-relaxed text-[#6B7194]">
                      {bh.isOpen
                        ? "Calls and WhatsApp chats are answered by our team, not the AI assistant."
                        : "We're closed right now. Ask the AI assistant, or contact us again during opening hours."}
                    </p>
                  </div>

                  <div className="border-t border-[#E7E9F5] bg-white p-3 pb-8 sm:pb-3">
                    <button
                      type="button"
                      onClick={() => setContactOpen(false)}
                      className="h-10 w-full border border-[#E1E3F0] bg-white text-[13px] font-semibold text-[#4B5278] hover:bg-[#F1F2FA]"
                    >
                      Back to chat
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* body */}
            {!consent ? (
              /* ---------- CONSENT GATE ---------- */
              <div className="im-scroll flex-1 overflow-y-auto px-5 py-5">
                <div className="im-msg-in">
                  <h2 className="text-[22px] font-bold leading-tight tracking-tight text-[#0E1330]">Before we start</h2>
                  <p className="mt-2 text-[13px] leading-relaxed text-[#4B5278]">
                    I'm {SITE.assistant}, an AI assistant for {SITE.name}. I'm not a person, and my answers can be wrong.
                  </p>

                  <ul className="mt-3 space-y-2 text-[13px] leading-relaxed text-[#4B5278]">
                    <li className="flex gap-2"><span className="mt-[7px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#3B5BDB]" />
                      What you type is sent to {SITE.name}'s servers and to an AI provider so I can write a reply.</li>
                    <li className="flex gap-2"><span className="mt-[7px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#3B5BDB]" />
                      Please don't share passwords, card numbers or other sensitive details.</li>
                    <li className="flex gap-2"><span className="mt-[7px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#3B5BDB]" />
                      You can withdraw consent and erase your chat at any time from the menu.</li>
                  </ul>

                  <div className="mt-5 space-y-2.5">
                    <label className="flex cursor-pointer items-start gap-3 rounded-sm border border-[#E7E9F5] bg-white p-3 shadow-sm">
                      <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[#3B5BDB]" />
                      <span className="text-[13px] leading-snug text-[#1F2547]">
                        <span className="font-semibold">I agree</span> to my messages being processed to get answers, as described in the{" "}
                        <a href={SITE.privacyHref} target="_blank" rel="noopener noreferrer" className="font-medium text-[#2F4AC0] underline underline-offset-2">privacy policy</a>.
                        <span className="ml-1 text-[#6B7194]">(required)</span>
                      </span>
                    </label>

                    <label className="flex cursor-pointer items-start gap-3 rounded-sm border border-[#E7E9F5] bg-white p-3">
                      <input type="checkbox" checked={optSave} onChange={(e) => setOptSave(e.target.checked)} className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[#3B5BDB]" />
                      <span className="text-[13px] leading-snug text-[#1F2547]">
                        Keep my chat on this device so I can continue later.
                        <span className="ml-1 text-[#6B7194]">(optional)</span>
                      </span>
                    </label>

                    <label className="flex cursor-pointer items-start gap-3 rounded-sm border border-[#E7E9F5] bg-white p-3">
                      <input type="checkbox" checked={optSound} onChange={(e) => setOptSound(e.target.checked)} className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[#3B5BDB]" />
                      <span className="text-[13px] leading-snug text-[#1F2547]">
                        Play short sounds for messages.
                        <span className="ml-1 text-[#6B7194]">(optional)</span>
                      </span>
                    </label>
                  </div>

                  <div className="mt-5 flex gap-2.5 pb-6 sm:pb-0">
                    <button
                      type="button"
                      onClick={accept}
                      disabled={!agree}
                      className="flex-1 rounded-sm px-4 py-3 text-[14px] font-semibold text-white shadow-sm transition-all hover:brightness-110 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                      style={{ background: BRAND }}
                    >
                      Accept and start chat
                    </button>
                    <button
                      type="button"
                      onClick={closePanel}
                      className="rounded-sm border border-[#E1E3F0] bg-white px-4 py-3 text-[14px] font-semibold text-[#4B5278] hover:bg-[#F1F2FA]"
                    >
                      No thanks
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setContactOpen(true)}
                    className="mt-3 flex w-full items-center justify-center gap-2 border-t border-[#E7E9F5] pt-3 text-[13px] font-medium text-[#2F4AC0] hover:underline"
                  >
                    {I.human} Prefer a person? Call or WhatsApp us
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* messages */}
                <div className="relative flex-1 overflow-hidden">
                  <div ref={scrollRef} onScroll={onScroll} className="im-scroll h-full space-y-4 overflow-y-auto px-4 py-4" aria-live="polite">
                    {messages.length === 0 && (
                      <div className="im-msg-in">
                        <h2 className="text-[24px] font-bold leading-[1.12] tracking-tight text-[#0E1330]">
                          Hi, I'm {SITE.assistant}. How can I help you today?
                        </h2>
                        <p className="mt-2 max-w-[320px] text-[13px] leading-relaxed text-[#6B7194]">
                          Ask about the {SITE.name} app, MIDI setup, audio latency or supported platforms.
                        </p>

                        <div className="mt-4 grid grid-cols-2 gap-2.5">
                          {SITE.prompts.map((p) => (
                            <button
                              key={p.text}
                              type="button"
                              onClick={() => submit(p.text)}
                              className="flex flex-col items-start gap-2.5 rounded-sm border border-[#E7E9F5] bg-white p-3 text-left shadow-sm transition-colors hover:border-[#3B5BDB]/50 hover:bg-[#F8F9FF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#3B5BDB]"
                            >
                              <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-[#EEF2FF] text-[#2F4AC0]">
                                <PromptIcon name={p.icon} />
                              </span>
                              <span className="relative text-[13px] font-semibold leading-snug text-[#1F2547]">{p.text}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {messages.map((msg, i) =>
                      msg.role === "user" ? (
                        <div key={msg.id} className="im-msg-in flex justify-end">
                          <div
                            className="max-w-[82%] break-words rounded-sm px-3.5 py-2.5 text-[13.5px] font-medium leading-relaxed text-white shadow-sm"
                            style={{ background: BRAND }}
                          >
                            {msg.content}
                          </div>
                        </div>
                      ) : (
                        <AssistantMessage
                          key={msg.id}
                          msg={msg}
                          isLast={i === lastIdx}
                          onTick={scrollDown}
                          onCopy={copy}
                          onFeedback={setFeedback}
                          onRetry={retry}
                          onSuggest={submit}
                          onImage={setLightbox}
                        />
                      )
                    )}

                    {loading && (
                      <div className="im-msg-in flex items-start gap-2.5">
                        <Avatar size={30} />
                        <div className="rounded-sm border border-[#E7E9F5] bg-white px-4 py-3.5 shadow-sm">
                          <Equalizer />
                        </div>
                      </div>
                    )}
                  </div>

                  {!atBottom && messages.length > 0 && (
                    <button
                      type="button"
                      onClick={() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })}
                      aria-label="Scroll to latest message"
                      className="im-msg-in absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-sm border border-[#E7E9F5] bg-white px-3 py-1.5 text-xs font-semibold text-[#2F4AC0] shadow-sm hover:bg-[#EEF2FF]"
                    >
                      {I.arrowDown} Latest
                    </button>
                  )}
                </div>

                {/* quick actions */}
                <div className="im-hscroll flex gap-2 overflow-x-auto border-t border-[#E7E9F5] bg-white px-3 py-2">
                  {SITE.actions.map((a) => {
                    const cls = `im-chip flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm border px-3 py-1.5 text-xs font-semibold ${
                      a.primary
                        ? "border-transparent text-white shadow-sm hover:brightness-110"
                        : "border-[#E1E3F0] bg-white text-[#1F2547] hover:border-[#3B5BDB]/50 hover:bg-[#EEF2FF]"
                    }`;
                    const inner = (
                      <>
                        {a.primary && I.human}
                        {a.label}
                      </>
                    );
                    return a.action === "contact" ? (
                      <button
                        key={a.href}
                        type="button"
                        onClick={() => {
                          sfx("click");
                          setContactOpen(true);
                        }}
                        className={cls}
                        style={{ background: BRAND }}
                      >
                        {inner}
                      </button>
                    ) : (
                      <a key={a.href} href={a.href} onClick={() => sfx("click")} className={cls}>
                        {inner}
                      </a>
                    );
                  })}
                </div>

                {/* input */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    submit(input);
                  }}
                  className="bg-white px-3 pb-3 pt-1"
                >
                  <div className="flex items-end gap-2">
                    <div className="relative flex-1">
                      <textarea
                        ref={inputRef}
                        rows={1}
                        value={input}
                        maxLength={1000}
                        onChange={(e) => {
                          setInput(e.target.value);
                          autosize(e.target);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            submit(input);
                          }
                        }}
                        placeholder={listening ? "Listening..." : `Ask ${SITE.assistant} anything...`}
                        aria-label="Your message"
                        className={`max-h-[120px] min-h-[42px] w-full resize-none rounded-sm border border-transparent bg-[#F1F2FA] py-2.5 pl-4 text-[13.5px] font-medium text-[#0E1330] outline-none transition-all placeholder:text-[#9097B8] focus:border-[#3B5BDB] focus:bg-white focus:ring-4 focus:ring-[#3B5BDB]/12 ${micOk ? "pr-11" : "pr-4"}`}
                      />
                      {micOk && (
                        <button
                          type="button"
                          onClick={toggleMic}
                          aria-label={listening ? "Stop dictation" : "Dictate with your voice"}
                          title="Dictate (uses your browser's speech service)"
                          className={`absolute bottom-1 right-1 flex h-[34px] w-[34px] items-center justify-center rounded-sm transition-colors ${
                            listening ? "im-mic-on bg-[#3B5BDB] text-white" : "text-[#7A80A3] hover:bg-[#0E1330]/[0.07] hover:text-[#0E1330]"
                          }`}
                        >
                          {I.mic}
                        </button>
                      )}
                    </div>
                    {loading ? (
                      <button type="button" onClick={stop} aria-label="Stop answer" className="flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-sm bg-[#0E1330] hover:bg-[#262d57]">
                        <span className="h-3 w-3 rounded-[3px] bg-white" />
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={!input.trim()}
                        aria-label="Send message"
                        className="flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-sm text-white shadow-sm transition-all hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 disabled:shadow-none disabled:hover:scale-100"
                        style={{ background: BRAND }}
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 13V3M3.5 7.5L8 3l4.5 4.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </button>
                    )}
                  </div>
                  <p className="mt-2 pb-6 text-center text-[11px] text-[#9097B8] sm:pb-0">
                    AI assistant. It can make mistakes, so check important steps on {SITE.domain}.
                  </p>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* LIGHTBOX */}
      {lightbox && (
        <div className="im-fade fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-6" onClick={() => setLightbox(null)} role="dialog" aria-label="Image preview">
          <div className="relative max-h-full max-w-full" onClick={(e) => e.stopPropagation()}>
            <img src={lightbox.url} alt={lightbox.alt || `${SITE.name} attachment`} className="max-h-[80vh] max-w-full rounded-sm object-contain shadow-sm" />
            <button type="button" aria-label="Close preview" onClick={() => setLightbox(null)} className="absolute -right-3 -top-3 flex h-9 w-9 items-center justify-center rounded-sm bg-white text-[#0E1330] shadow-lg">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
            {lightbox.alt && <p className="mt-2 text-center text-xs text-white/90">{lightbox.alt}</p>}
          </div>
        </div>
      )}
    </>
  );
}