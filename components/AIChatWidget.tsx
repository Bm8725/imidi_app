"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/* ------------------------------------------------------------------ */
/*  CONFIG — edit this block to match imidi.co.uk                      */
/* ------------------------------------------------------------------ */

const SITE = {
  name: "iMIDI",
  assistant: "Smith AI",
  domain: "imidi.co.uk",
  headerTitle: "Smith AI",
  headerSubtitle: "iMIDI assistant. Replies in seconds.",
  // Put a real photo in /public (e.g. /smith.jpg) and set it here.
  // Leave "" to use the built-in illustrated avatar.
  avatarSrc: "",
  privacyHref: "/privacy",
  // Shown in the three-dot menu.
  links: [
    { label: "Download app", href: "/download" },
    { label: "Support center", href: "/support" },
  ],
  // Quick-reply buttons under the welcome message.
  prompts: [
    "Which platforms does iMIDI support?",
    "Help me set up my MIDI device",
    "Fix audio latency or crackling",
    "What can the real-time synth do?",
  ],
};

// The blue-to-cyan gradient is used on desktop. On phones it becomes a solid
// colour unless you set this to true.
const GRADIENT_ON_MOBILE = true;

// Text pill shown next to the launcher on desktop. Set to "" to show only the icon.
const LAUNCHER_LABEL = "";

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

const EMOJIS = ["😀", "😊", "😉", "😍", "🤔", "😅", "🙏", "👍", "👋", "🔥", "🎹", "🎧", "🎶", "✅", "❓", "💡", "🔌", "💻", "📱", "🛠️"];

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
const KEY_THEME = "imidi-chat-theme-v1";
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

type Sfx = "open" | "close" | "send" | "receive" | "error" | "click" | "accept" | "notify";

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
    case "notify":
      tone(987.77, 0, 0.1, "sine", 0.07);
      tone(1318.5, 0.11, 0.2, "sine", 0.07);
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

interface Option {
  label: string;
  onClick: () => void;
}

const MAX_IMAGES = 3;
const MAX_FILE_MB = 15;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

// Resize + compress so a phone photo or a retina screenshot stays small (max 1600px, JPEG).
async function fileToDataUrl(file: File): Promise<string> {
  const objUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("load"));
      i.src = objUrl;
    });
    const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(objUrl);
  }
}

// What /api/chat receives. Only the newest user message carries images.
function buildApiMessages(history: Message[]) {
  let lastUser = -1;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === "user") {
      lastUser = i;
      break;
    }
  }
  return history.map((m, i) => {
    const imgs = i === lastUser ? (m.images || []).filter((im) => im.url.startsWith("data:")) : [];
    if (imgs.length === 0) return { role: m.role, content: m.content };
    return {
      role: m.role,
      content: m.content || "Please look at the attached screenshot.",
      images: imgs.map((im) => {
        const [head, data] = im.url.split(",");
        return { mediaType: head.match(/data:(.*?);/)?.[1] || "image/jpeg", data };
      }),
    };
  });
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
      className="break-words font-medium underline underline-offset-2"
      style={{ color: "var(--im-link)" }}
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
      return (
        <strong key={k} className="font-semibold">
          {p.slice(2, -2)}
        </strong>
      );
    if (p.startsWith("`") && p.endsWith("`") && p.length > 2)
      return (
        <code
          key={k}
          className="rounded-md px-1.5 py-0.5 font-mono text-[12px]"
          style={{ background: "var(--im-code-bg)", color: "var(--im-link)" }}
        >
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
        className={`im-list my-1.5 space-y-1 pl-5 ${list.ordered ? "list-decimal" : "list-disc"}`}
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

/* ------------------------------------------------------------------ */
/*  Small pieces                                                       */
/* ------------------------------------------------------------------ */

// Solid speech bubble used on the launcher.
function ChatOutlineIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path
        d="M6 3.5H18A2.5 2.5 0 0 1 20.5 6V12.5A2.5 2.5 0 0 1 18 15H11.3L6.9 19.2A.6.6 0 0 1 5.9 18.8V15H6A2.5 2.5 0 0 1 3.5 12.5V6A2.5 2.5 0 0 1 6 3.5Z"
        strokeWidth="1.8"
      />
      <circle className="im-cdot" style={{ animationDelay: "0s" }} cx="8.3" cy="9.25" r="1.2" strokeWidth="1.45" />
      <circle className="im-cdot" style={{ animationDelay: "0.08s" }} cx="12" cy="9.25" r="1.2" strokeWidth="1.45" />
      <circle className="im-cdot" style={{ animationDelay: "0.16s" }} cx="15.7" cy="9.25" r="1.2" strokeWidth="1.45" />
    </svg>
  );
}

// Friendly support-agent illustration, used when no photo is configured.
function PersonIllustration() {
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
      <rect width="64" height="64" fill="#FFE2E4" />
      <path d="M8 66c2-13 12-19 24-19s22 6 24 19z" fill="#E5333B" />
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

function Avatar({ size = 28 }: { size?: number }) {
  const [broken, setBroken] = useState(false);
  return (
    <div
      className="flex-shrink-0 overflow-hidden rounded-full"
      style={{ width: size, height: size, boxShadow: "0 0 0 2px rgba(255,255,255,0.9)" }}
    >
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
  );
}

function WhatsAppIcon({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.29.173-1.414-.074-.124-.272-.198-.57-.347z" />
      <path d="M12.001 2c-5.514 0-9.988 4.474-9.988 9.988 0 1.76.462 3.482 1.34 4.998L2 22l5.146-1.34a9.96 9.96 0 0 0 4.855 1.238h.004c5.514 0 9.987-4.474 9.987-9.988C21.992 6.474 17.518 2 12.001 2zm0 18.16h-.003a8.155 8.155 0 0 1-4.163-1.14l-.299-.177-3.056.796.816-2.98-.194-.306a8.15 8.15 0 0 1-1.253-4.365c0-4.505 3.667-8.171 8.176-8.171 2.184 0 4.238.851 5.782 2.396a8.12 8.12 0 0 1 2.393 5.787c-.002 4.505-3.668 8.16-8.199 8.16z" />
    </svg>
  );
}

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

const I = {
  speakerOn: <svg width="20" height="20" viewBox="0 0 24 24" {...stroke}><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4zM15.5 9a4 4 0 010 6M18 6.5a8 8 0 010 11" /></svg>,
  speakerOff: <svg width="20" height="20" viewBox="0 0 24 24" {...stroke}><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4zM16 9.5l5 5M21 9.5l-5 5" /></svg>,
  kebab: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.9" /><circle cx="12" cy="12" r="1.9" /><circle cx="12" cy="19" r="1.9" /></svg>,
  chevron: <svg width="22" height="22" viewBox="0 0 24 24" {...stroke} strokeWidth={2.4}><path d="M5 9l7 7 7-7" /></svg>,
  close: <svg width="18" height="18" viewBox="0 0 24 24" {...stroke} strokeWidth={2.2}><path d="M6 6l12 12M18 6L6 18" /></svg>,
  mic: <svg width="20" height="20" viewBox="0 0 24 24" {...stroke}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21" /></svg>,
  stopSq: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2.5" /></svg>,
  emoji: <svg width="20" height="20" viewBox="0 0 24 24" {...stroke}><circle cx="12" cy="12" r="9" /><path d="M8.5 14.2a4 4 0 007 0" /><circle cx="9" cy="10" r=".6" fill="currentColor" /><circle cx="15" cy="10" r=".6" fill="currentColor" /></svg>,
  human: <svg width="20" height="20" viewBox="0 0 24 24" {...stroke}><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.8-4 3.8-6 7-6s6.2 2 7 6" /></svg>,
  phone: <svg width="16" height="16" viewBox="0 0 24 24" {...stroke}><path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" /></svg>,
  download: <svg width="16" height="16" viewBox="0 0 24 24" {...stroke}><path d="M12 4v11M7 11l5 5 5-5M5 20h14" /></svg>,
  trash: <svg width="16" height="16" viewBox="0 0 24 24" {...stroke}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V4h6v3" /></svg>,
  shield: <svg width="16" height="16" viewBox="0 0 24 24" {...stroke}><path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6l8-3zM9 12l2.2 2.2L15.5 10" /></svg>,
  expand: <svg width="16" height="16" viewBox="0 0 24 24" {...stroke}><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" /></svg>,
  save: <svg width="16" height="16" viewBox="0 0 24 24" {...stroke}><path d="M5 4h11l3 3v13H5V4zM8 4v5h7V4M8 20v-6h8v6" /></svg>,
  attach: <svg width="20" height="20" viewBox="0 0 24 24" {...stroke}><path d="M21 11.5l-8.6 8.6a5 5 0 01-7.1-7.1l8.6-8.6a3.3 3.3 0 014.7 4.7l-8.6 8.6a1.7 1.7 0 01-2.4-2.4l7.9-7.9" /></svg>,
  arrowDown: <svg width="14" height="14" viewBox="0 0 24 24" {...stroke} strokeWidth={2.2}><path d="M12 5v14M6 13l6 6 6-6" /></svg>,
  moon: <svg width="16" height="16" viewBox="0 0 24 24" {...stroke}><path d="M21 14.5A8.5 8.5 0 1110.5 3a7 7 0 0010.5 11.5z" /></svg>,
  sun: <svg width="16" height="16" viewBox="0 0 24 24" {...stroke}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></svg>,
  link: <svg width="16" height="16" viewBox="0 0 24 24" {...stroke}><path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" /></svg>,
};

function TypingDots() {
  return (
    <div className="flex h-4 items-center gap-1" role="status" aria-label={`${SITE.assistant} is typing`}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="im-dotb h-[7px] w-[7px] rounded-full"
          style={{ animationDelay: `${i * 0.15}s`, background: "var(--im-muted)" }}
        />
      ))}
    </div>
  );
}

function Switch({ on }: { on: boolean }) {
  return (
    <span
      className={`relative inline-block h-[18px] w-8 flex-shrink-0 rounded-full transition-colors ${on ? "bg-[var(--im-brand)]" : "bg-[var(--im-switch-off)]"}`}
      aria-hidden="true"
    >
      <span
        className={`absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow transition-all ${on ? "left-[16px]" : "left-[2px]"}`}
      />
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
      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition-colors ${
        danger ? "text-[#B42318] hover:bg-[#FFF1F0]" : "text-[var(--im-text)] hover:bg-[var(--im-hover)]"
      }`}
    >
      <span className={`flex h-4 w-4 flex-shrink-0 items-center justify-center [&>svg]:h-4 [&>svg]:w-4 ${danger ? "text-[#B42318]" : "text-[var(--im-muted)]"}`}>{icon}</span>
      <span className="flex-1">{label}</span>
      {toggle !== undefined && <Switch on={toggle} />}
    </button>
  );
}

// Round white-on-gradient header button
function HeadBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="im-tap flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-white/95 transition-colors hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
    >
      {children}
    </button>
  );
}

// Toolbar button under the message box
function ToolBtn({
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
      className={`im-tap flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--im-brand)] ${
        active
          ? "bg-[var(--im-brand-soft)] text-[var(--im-link)]"
          : "text-[var(--im-muted)] hover:bg-[var(--im-hover)] hover:text-[var(--im-text)]"
      }`}
    >
      {children}
    </button>
  );
}

// Bot message with attached quick-reply buttons (like the reference)
function BotCard({
  children,
  options,
  error,
}: {
  children: React.ReactNode;
  options?: Option[];
  error?: boolean;
}) {
  return (
    <div className="w-full overflow-hidden rounded-[18px] border" style={{ borderColor: error ? "#FFD0D0" : "var(--im-border)", background: "var(--im-surface)" }}>
      <div
        className="px-4 py-3 text-[14px] leading-relaxed"
        style={error ? { background: "#FFF3F3", color: "#9B1C1C" } : { background: "var(--im-bubble)", color: "var(--im-text)" }}
      >
        {children}
      </div>
      {options?.map((o, i) => (
        <button
          key={o.label}
          type="button"
          onClick={o.onClick}
          className="im-opt block w-full border-t px-4 py-3 text-center text-[14px] font-medium transition-colors hover:bg-[var(--im-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--im-brand)]"
          style={{ borderColor: "var(--im-border)", color: "var(--im-link)", animationDelay: `${Math.min(i, 5) * 45}ms` }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function MiniAction({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`im-tap flex h-7 w-7 items-center justify-center rounded-md ${
        active
          ? "bg-[var(--im-brand-soft)] text-[var(--im-link)]"
          : "text-[var(--im-muted)] hover:bg-[var(--im-hover)] hover:text-[var(--im-text)]"
      }`}
    >
      {children}
    </button>
  );
}

function AssistantMessage({
  msg,
  onCopy,
  onFeedback,
  onRetry,
  onSuggest,
  onImage,
  isLast,
}: {
  msg: Message;
  onCopy: (text: string) => void;
  onFeedback: (id: string, v: "up" | "down") => void;
  onRetry: () => void;
  onSuggest: (t: string) => void;
  onImage: (img: ChatImage) => void;
  isLast: boolean;
}) {
  const shown = msg.content;
  const done = true;
  const [copied, setCopied] = useState(false);


  const options: Option[] | undefined =
    done && isLast && msg.suggestions?.length
      ? msg.suggestions.slice(0, 3).map((s) => ({ label: s, onClick: () => onSuggest(s) }))
      : undefined;

  return (
    <div className="im-msg-in group flex max-w-[88%] flex-col items-start gap-1.5">
      {msg.content && (
        <BotCard error={msg.error} options={options}>
          {renderRich(shown)}
        </BotCard>
      )}

      {msg.images && msg.images.length > 0 && done && (
        <div className={`grid gap-1.5 ${msg.images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`} style={{ maxWidth: msg.images.length === 1 ? 240 : 280 }}>
          {msg.images.map((img, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onImage(img)}
              className="relative cursor-zoom-in overflow-hidden rounded-xl border bg-[var(--im-bubble)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--im-brand)]"
              style={{ borderColor: "var(--im-border)", aspectRatio: msg.images!.length === 1 ? "16/10" : "1/1" }}
            >
              <img src={img.url} alt={img.alt || `${SITE.name} attachment`} loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {done && msg.error && isLast && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full border px-3.5 py-1.5 text-xs font-semibold hover:bg-[var(--im-hover)]"
          style={{ borderColor: "var(--im-border)", color: "var(--im-text)" }}
        >
          Try again
        </button>
      )}

      {done && !msg.error && (
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 max-sm:opacity-70">
          <MiniAction
            label={copied ? "Copied" : "Copy answer"}
            active={copied}
            onClick={() => {
              onCopy(msg.content);
              setCopied(true);
              setTimeout(() => setCopied(false), 1400);
            }}
          >
            {copied ? (
              <svg width="13" height="13" viewBox="0 0 24 24" {...stroke} strokeWidth={2.4}><path d="M5 12l5 5L20 7" /></svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" {...stroke}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 012-2h9" /></svg>
            )}
          </MiniAction>
          <MiniAction label="Helpful" active={msg.feedback === "up"} onClick={() => onFeedback(msg.id, "up")}>
            <svg width="13" height="13" viewBox="0 0 24 24" {...stroke}><path d="M7 11v9H4v-9h3zM7 11l4-8a2 2 0 012 2v4h6a2 2 0 012 2.3l-1.2 7A2 2 0 0117.8 20H7" /></svg>
          </MiniAction>
          <MiniAction label="Not helpful" active={msg.feedback === "down"} onClick={() => onFeedback(msg.id, "down")}>
            <svg width="13" height="13" viewBox="0 0 24 24" {...stroke}><path d="M17 13V4h3v9h-3zM17 13l-4 8a2 2 0 01-2-2v-4H5a2 2 0 01-2-2.3l1.2-7A2 2 0 016.2 4H17" /></svg>
          </MiniAction>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main widget                                                        */
/* ------------------------------------------------------------------ */

export default function AIChatWidget() {
  const pathname = usePathname();

  const [isOpen, setIsOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
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
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const [micOk, setMicOk] = useState(false);
  const [listening, setListening] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [attachments, setAttachments] = useState<ChatImage[]>([]);
  const [attachNote, setAttachNote] = useState("");
  const [dragging, setDragging] = useState(false);
  const [unread, setUnread] = useState(0);
  const [, setTick] = useState(0);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const panelRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const isOpenRef = useRef(false);
  isOpenRef.current = isOpen;
  const baseTitleRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const recRef = useRef<any>(null);
  const listeningIntentRef = useRef(false);
  const soundRef = useRef(false);
  soundRef.current = !!consent?.sound;

  const sfx = useCallback((n: Sfx) => {
    if (soundRef.current) playSound(n);
  }, []);

  // Browser tab: "(1) Smith AI" while there is an unread reply, original title otherwise.
  useEffect(() => {
    if (unread > 0) {
      if (baseTitleRef.current === null) baseTitleRef.current = document.title;
      document.title = `(${unread}) ${SITE.assistant}`;
    } else if (baseTitleRef.current !== null) {
      document.title = baseTitleRef.current;
      baseTitleRef.current = null;
    }
  }, [unread]);

  useEffect(() => {
    const seen = () => {
      if (!document.hidden && isOpenRef.current) setUnread(0);
    };
    document.addEventListener("visibilitychange", seen);
    window.addEventListener("focus", seen);
    return () => {
      document.removeEventListener("visibilitychange", seen);
      window.removeEventListener("focus", seen);
      if (baseTitleRef.current !== null) document.title = baseTitleRef.current;
    };
  }, []);

  // Keep the open/closed status fresh while the contact sheet is visible.
  useEffect(() => {
    if (!contactOpen) return;
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, [contactOpen]);

  /* ---- load consent + theme ---- */
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
      const savedTheme = localStorage.getItem(KEY_THEME);
      if (savedTheme === "dark" || savedTheme === "light") setTheme(savedTheme);
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
      localStorage.setItem(KEY_THEME, theme);
    } catch {}
  }, [theme, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (consent?.save) {
        const clean = messages.slice(-MAX_STORED).map((m) => ({
          ...m,
          fresh: false,
          images: m.images?.filter((im) => !im.url.startsWith("data:")),
        }));
        localStorage.setItem(KEY_MSGS, JSON.stringify(clean));
      } else {
        localStorage.removeItem(KEY_MSGS);
      }
    } catch {}
  }, [messages, consent?.save, hydrated]);

  /* ---- scrolling / focus / keys ---- */
  const scrollDown = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, []);

  const onScroll = () => {
    const el = scrollRef.current;
    if (el) setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
  };

  useEffect(() => {
    if (isOpen) scrollDown();
  }, [messages, loading, isOpen, scrollDown]);

  useEffect(() => {
    if (isOpen && consent) inputRef.current?.focus();
  }, [isOpen, consent]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (lightbox) setLightbox(null);
      else if (contactOpen) setContactOpen(false);
      else if (emojiOpen) setEmojiOpen(false);
      else if (menuOpen) setMenuOpen(false);
      else if (isOpen) closePanel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightbox, menuOpen, emojiOpen, contactOpen, isOpen]);

  // Phones: follow the visual viewport (on-screen keyboard) and lock page scroll behind the chat.
  useEffect(() => {
    if (!isOpen) return;
    const mobile = window.matchMedia("(max-width: 639px)");
    const root = panelRef.current;
    const vv = window.visualViewport;
    const apply = () => {
      if (!root) return;
      if (mobile.matches && vv) {
        root.style.setProperty("--im-vh", `${vv.height}px`);
        root.style.setProperty("--im-vt", `${vv.offsetTop}px`);
        scrollDown();
      } else {
        root.style.removeProperty("--im-vh");
        root.style.removeProperty("--im-vt");
      }
    };
    apply();
    vv?.addEventListener("resize", apply);
    vv?.addEventListener("scroll", apply);
    mobile.addEventListener("change", apply);
    const prevOverflow = document.body.style.overflow;
    if (mobile.matches) document.body.style.overflow = "hidden";
    return () => {
      vv?.removeEventListener("resize", apply);
      vv?.removeEventListener("scroll", apply);
      mobile.removeEventListener("change", apply);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, scrollDown]);

  useEffect(
    () => () => {
      listeningIntentRef.current = false;
      try {
        recRef.current?.stop?.();
      } catch {}
    },
    []
  );

  /* ---- panel open/close ---- */
  const openPanel = () => {
    setIsOpen(true);
    setHasOpened(true);
    setUnread(0);
    sfx("open");
  };
  const stopMic = () => {
    listeningIntentRef.current = false;
    try {
      recRef.current?.stop?.();
    } catch {}
    setListening(false);
  };
  const closePanel = () => {
    stopMic();
    setMenuOpen(false);
    setEmojiOpen(false);
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
    stopMic();
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

  const toggleSound = () => {
    if (!consent) return;
    const next = !consent.sound;
    soundRef.current = next;
    patchConsent({ sound: next });
    if (next) playSound("click");
  };

  const toggleTheme = () => {
    setTheme((t) => (t === "light" ? "dark" : "light"));
    sfx("click");
  };

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
            messages: buildApiMessages(history),
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
        const away = typeof document !== "undefined" && (document.hidden || !isOpenRef.current);
        if (!failed && away) setUnread((n) => n + 1);
        if (soundRef.current) playSound(failed ? "error" : away ? "notify" : "receive");
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
      const imgs = attachments;
      if ((!value && imgs.length === 0) || loading || !consent) return;
      stopMic();
      setEmojiOpen(false);
      const next: Message[] = [
        ...messages.map((m) => ({ ...m, fresh: false })),
        { id: uid(), role: "user", content: value, images: imgs.length ? imgs : undefined },
      ];
      setMessages(next);
      setInput("");
      setAttachments([]);
      setAttachNote("");
      if (inputRef.current) inputRef.current.style.height = "auto";
      sfx("send");
      request(next);
    },
    [messages, loading, consent, request, sfx, attachments]
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
      .map((m) => `${m.role === "user" ? "You" : SITE.assistant}: ${m.content}${m.role === "user" && m.images?.length ? " [image attached]" : ""}`)
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

  const showNote = (m: string) => {
    setAttachNote(m);
    setTimeout(() => setAttachNote(""), 4500);
  };

  const addFiles = async (files: FileList | File[] | null) => {
    if (!files || !consent) return;
    const all = Array.from(files);
    const list = all.filter((f) => f.type.startsWith("image/"));
    if (list.length === 0) {
      showNote("Only images can be attached.");
      return;
    }
    if (attachments.length >= MAX_IMAGES) {
      showNote(`You can attach up to ${MAX_IMAGES} images.`);
      return;
    }
    for (const f of list) {
      if (f.size > MAX_FILE_BYTES) {
        showNote(`That image is too large (max ${MAX_FILE_MB} MB).`);
        continue;
      }
      try {
        const url = await fileToDataUrl(f);
        setAttachments((p) => (p.length >= MAX_IMAGES ? p : [...p, { url, alt: f.name }]));
      } catch {
        showNote("I couldn't read that image. Try a PNG or JPG.");
      }
    }
    sfx("click");
  };

  const openContact = () => {
    sfx("click");
    setMenuOpen(false);
    setEmojiOpen(false);
    setContactOpen(true);
  };

  /* ---- input helpers ---- */
  const autosize = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 110) + "px";
  };

  const addEmoji = (e: string) => {
    sfx("click");
    setInput((v) => (v + e).slice(0, 1000));
    setEmojiOpen(false);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      autosize(inputRef.current);
    });
  };

  /* ---- voice dictation (browser speech service) ---- */
  const toggleMic = () => {
    if (listening) {
      stopMic();
      return;
    }

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    const rec = new SR();
    rec.lang = "en-GB";
    rec.interimResults = true;
    rec.continuous = true;

    let finalText = input;

    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const piece = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          finalText = (finalText + " " + piece).replace(/\s+/g, " ").trim();
        } else {
          interim += piece;
        }
      }
      const combined = (finalText + (interim ? " " + interim : "")).replace(/\s+/g, " ").trim();
      setInput(combined);
      requestAnimationFrame(() => autosize(inputRef.current));
    };

    rec.onend = () => {
      // Chrome often ends after a short pause; restart while the user still wants to talk.
      if (listeningIntentRef.current) {
        try {
          rec.start();
        } catch {
          listeningIntentRef.current = false;
          setListening(false);
        }
      } else {
        setListening(false);
      }
    };

    rec.onerror = (ev: any) => {
      if (ev?.error === "aborted" || ev?.error === "no-speech") return;
      listeningIntentRef.current = false;
      setListening(false);
    };

    recRef.current = rec;
    listeningIntentRef.current = true;
    setListening(true);
    sfx("click");
    try {
      rec.start();
    } catch {
      listeningIntentRef.current = false;
      setListening(false);
    }
  };

  const lastIdx = messages.length - 1;
  const noGrad = GRADIENT_ON_MOBILE ? "" : "im-nogradmobile";
  const topPad = "calc(1.1rem + env(safe-area-inset-top))";

  const welcomeOptions: Option[] = [
    ...SITE.prompts.map((p) => ({ label: p, onClick: () => submit(p) })),
    { label: "Talk to a human", onClick: openContact },
  ];

  /* ---------------------------------------------------------------- */

  return (
    <>
      <style suppressHydrationWarning>{`
        .im-font { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }

        .im-theme-light {
          --im-brand: #E5333B;
          --im-grad: linear-gradient(120deg, #B8173A 0%, #E5333B 55%, #FF6B4A 100%);
          --im-glow: rgba(229, 51, 59, 0.40);
          --im-brand-soft: rgba(229, 51, 59, 0.11);
          --im-link: #D12A36;
          --im-text: #14192B;
          --im-muted: #8A93A8;
          --im-border: #E4E8F0;
          --im-surface: #FFFFFF;
          --im-bubble: #F0F3F8;
          --im-hover: rgba(20, 25, 43, 0.05);
          --im-code-bg: #FDE8EA;
          --im-switch-off: #CBD2E0;
          --im-input-bg: #F1F4F9;
          --im-shadow: 0 20px 60px rgba(30, 60, 140, 0.2);
          --im-ghost-bg: #FFFFFF;
          --im-ghost-bg-hover: #F4F6FB;
          --im-ghost-border: rgba(20, 25, 43, 0.10);
          --im-ghost-ink: #E5333B;
          --im-ghost-ring: #FFFFFF;
        }

        .im-theme-dark {
          --im-brand: #FF5A62;
          --im-grad: linear-gradient(120deg, #8F1230 0%, #C42632 55%, #E0553F 100%);
          --im-glow: rgba(255, 90, 98, 0.35);
          --im-brand-soft: rgba(255, 90, 98, 0.18);
          --im-link: #FF8A90;
          --im-text: #E8ECF8;
          --im-muted: #98A2BD;
          --im-border: #2A3050;
          --im-surface: #171B2B;
          --im-bubble: #232842;
          --im-hover: rgba(255, 255, 255, 0.07);
          --im-code-bg: #2A3050;
          --im-switch-off: #3A4060;
          --im-input-bg: #232842;
          --im-shadow: 0 20px 60px rgba(0, 0, 0, 0.55);
          --im-ghost-bg: #1F2438;
          --im-ghost-bg-hover: #272D46;
          --im-ghost-border: rgba(255, 255, 255, 0.14);
          --im-ghost-ink: #FF6B72;
          --im-ghost-ring: #171B2B;
        }

        .im-grad { background: var(--im-grad); }

        /* Launcher: clean solid surface, crisp edge, soft shadow */
        .im-ghost {
          background: var(--im-ghost-bg);
          color: var(--im-ghost-ink);
          border: 1px solid var(--im-ghost-border);
          box-shadow: 0 6px 22px rgba(20, 25, 43, 0.16), 0 1px 3px rgba(20, 25, 43, 0.08);
          cursor: pointer;
          transition: transform .2s cubic-bezier(.34,1.56,.64,1), box-shadow .2s ease, background-color .15s ease;
        }
        .im-ghost:hover { background: var(--im-ghost-bg-hover); transform: scale(1.07); box-shadow: 0 10px 28px rgba(20, 25, 43, 0.2), 0 1px 3px rgba(20, 25, 43, 0.08); }
        .im-ghost:active { transform: scale(.95); }
        @media (max-width: 639px) {
          .im-nogradmobile .im-grad { background: var(--im-brand); }
        }

        @keyframes im-bounce { 0%, 60%, 100% { transform: translateY(0); opacity: .45; } 30% { transform: translateY(-4px); opacity: 1; } }
        @keyframes im-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes im-pulse {
          0% { box-shadow: 0 0 0 0 var(--im-brand-soft); }
          70% { box-shadow: 0 0 0 9px transparent; }
          100% { box-shadow: 0 0 0 0 transparent; }
        }
        @keyframes im-ping { 75%, 100% { transform: scale(2); opacity: 0; } }

        @keyframes im-open { from { opacity: 0; transform: translateY(16px) scale(.96); } to { opacity: 1; transform: none; } }
        @keyframes im-open-m { from { opacity: 0; transform: translateY(28px); } to { opacity: 1; transform: none; } }
        @keyframes im-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        @keyframes im-pop { from { opacity: 0; transform: translateY(-6px) scale(.96); } to { opacity: 1; transform: none; } }
        @keyframes im-pop-in { from { opacity: 0; transform: scale(.5); } to { opacity: 1; transform: scale(1); } }
        @keyframes im-attn { 0% { transform: scale(1); opacity: .55; } 70%, 100% { transform: scale(1.55); opacity: 0; } }
        @keyframes im-hop { 0%, 100% { transform: translateY(0); } 40% { transform: translateY(-1.6px); } }

        .im-dotb { animation: im-bounce 1.1s ease-in-out infinite; }
        .im-panel-anim { animation: im-open .24s cubic-bezier(.16,1,.3,1) both; transform-origin: bottom right; }
        .im-msg-in { animation: im-rise .22s ease-out both; }
        .im-menu-in { animation: im-pop .16s ease-out both; transform-origin: top right; }
        .im-fade { animation: im-fade .16s ease-out both; }
        .im-opt { animation: im-rise .24s ease-out both; }
        .im-launch-in { animation: im-pop-in .42s cubic-bezier(.34,1.56,.64,1) both; }
        .im-attn { animation: im-attn 2.6s ease-out infinite; }
        .im-panel-size { transition: width .25s ease, height .25s ease; }
        .im-cdot { transform-box: fill-box; transform-origin: center; }
        .im-ghost:hover .im-cdot { animation: im-hop .5s ease-in-out; }
        .im-send svg { transition: transform .18s ease; }
        .im-send:hover svg { transform: translateX(2px) rotate(-6deg); }
        @media (max-width: 639px) { .im-panel-anim { animation-name: im-open-m; } }
        .im-mic-on { animation: im-pulse 1.4s ease-out infinite; }
        .im-ping { animation: im-ping 1.1s cubic-bezier(0,0,.2,1) infinite; }

        .im-list ::marker { color: var(--im-brand); }

        /* Phones: panel tracks the visual viewport so the keyboard never hides the input */
        @media (max-width: 639px) {
          .im-panel-mobile { top: var(--im-vt, 0px) !important; bottom: auto !important; height: var(--im-vh, 100dvh) !important; }
        }
        /* Small phones: tighter header */
        @media (max-width: 639px) and (max-height: 700px) {
          .im-head-sub { display: none; }
          .im-head-row { padding-bottom: 1.9rem !important; }
        }
        /* Short screens (landscape phones, small laptops): compact header,
           and the panel becomes a full-height sheet on the right */
        @media (max-height: 560px) {
          .im-head-sub { display: none; }
          .im-head-row { padding-bottom: 1.9rem !important; }
          .im-power { display: none; }
        }
        @media (min-width: 640px) and (max-height: 520px) {
          .im-panel-mobile { top: 0 !important; right: 0 !important; bottom: 0 !important; left: auto !important;
            height: 100dvh !important; width: min(420px, 100vw) !important; max-height: none !important; max-width: none !important; }
          .im-panel-mobile > .im-shell { border-radius: 0 !important; }
        }
        @media (max-width: 420px) { .im-power { display: none; } }
        @media (min-width: 640px) and (max-height: 520px) { .im-send { right: 14px !important; } }
        .im-font, .im-font * { -webkit-tap-highlight-color: transparent; }
        .im-font textarea { -webkit-text-size-adjust: 100%; }
        /* Touch screens: comfortable 44px targets */
        @media (pointer: coarse) { .im-tap { min-width: 44px; min-height: 44px; } }

        .im-scroll::-webkit-scrollbar { width: 6px; }
        .im-scroll::-webkit-scrollbar-thumb { background: rgba(120,130,170,.28); border-radius: 999px; }
        .im-scroll::-webkit-scrollbar-track { background: transparent; }

        @media (prefers-reduced-motion: reduce) {
          .im-dotb, .im-mic-on, .im-ping, .im-panel-anim, .im-msg-in, .im-menu-in, .im-fade, .im-opt,
          .im-launch-in, .im-attn, .im-cdot, .im-ghost:hover .im-cdot { animation: none !important; }
          .im-ghost, .im-panel-size, .im-send svg { transition: none !important; }
          .im-ghost:hover { transform: none; }
        }
      `}</style>

      {/* LAUNCHER */}
      {!isOpen && (
        <div className={`im-font im-theme-${theme} ${noGrad} im-launch-in fixed bottom-[170px] right-4 z-50 flex items-center gap-2.5 antialiased sm:right-6`}>
          {LAUNCHER_LABEL && (
            <button
              type="button"
              onClick={openPanel}
              tabIndex={-1}
              aria-hidden="true"
              className="im-ghost hidden h-11 items-center rounded-full px-4 text-[13.5px] font-semibold sm:flex"
            >
              {LAUNCHER_LABEL}
            </button>
          )}
          <button
            type="button"
            onClick={openPanel}
            aria-label={`Open ${SITE.assistant} chat`}
            title={`Chat with ${SITE.assistant}`}
            className="im-ghost relative flex h-[70px] w-[70px] items-center justify-center rounded-full sm:h-[76px] sm:w-[76px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--im-brand)]"
          >
            {(!hasOpened || unread > 0) && (
              <span className="im-attn pointer-events-none absolute inset-0 rounded-full" style={{ border: "2px solid var(--im-brand)" }} aria-hidden="true" />
            )}
            <ChatOutlineIcon size={46} />
            {(!hasOpened || unread > 0) && (
              <span
                className="absolute right-[3px] top-[3px] h-[14px] w-[14px] rounded-full"
                style={{ background: "var(--im-brand)", boxShadow: "0 0 0 2px var(--im-ghost-ring)" }}
                aria-label={`${Math.max(unread, 1)} unread message`}
              />
            )}
          </button>
        </div>
      )}

      {/* PANEL */}
      {isOpen && (
        <div
          role="dialog"
          aria-label={`${SITE.name} assistant`}
          ref={panelRef}
          onDragOver={(e) => {
            if (consent && e.dataTransfer?.types?.includes("Files")) {
              e.preventDefault();
              setDragging(true);
            }
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
          }}
          onDrop={(e) => {
            if (!consent) return;
            e.preventDefault();
            setDragging(false);
            addFiles(e.dataTransfer.files);
          }}
          className={`im-font im-panel-size im-panel-anim im-panel-mobile im-theme-${theme} ${noGrad} fixed inset-0 z-50 h-[100dvh] w-full antialiased
                     sm:inset-auto sm:bottom-6 sm:right-6 sm:max-h-[calc(100dvh-3rem)] sm:max-w-[calc(100vw-3rem)]
                     ${expanded ? "sm:h-[720px] sm:w-[420px] lg:h-[780px] lg:w-[480px]" : "sm:h-[720px] sm:w-[420px] lg:h-[670px] lg:w-[390px]"}`}
        >
          <div
            className="im-shell relative flex h-full w-full flex-col overflow-hidden sm:rounded-[22px]"
            style={{ background: "var(--im-surface)", boxShadow: "var(--im-shadow)" }}
          >
            {dragging && (
              <div
                className="im-fade pointer-events-none absolute inset-2 z-50 flex items-center justify-center rounded-2xl border-2 border-dashed text-[15px] font-semibold"
                style={{ background: "var(--im-surface)", borderColor: "var(--im-brand)", color: "var(--im-link)", opacity: 0.96 }}
              >
                Drop an image to attach it
              </div>
            )}
            {/* HEADER */}
            <div className="im-grad relative flex-shrink-0 text-white">
              <div className="im-head-row flex items-center gap-3 px-4 pb-4" style={{ paddingTop: topPad }}>
                <Avatar size={44} />
                <p className="min-w-0 flex-1 truncate text-[21px] font-semibold tracking-tight">{SITE.headerTitle}</p>
                {consent && (
                  <HeadBtn label="More options" onClick={() => { setEmojiOpen(false); setMenuOpen((v) => !v); }}>
                    {I.kebab}
                  </HeadBtn>
                )}
                <HeadBtn label="Minimize chat" onClick={closePanel}>{I.chevron}</HeadBtn>
              </div>

              <div className="im-head-sub border-t border-white/20 px-4 pb-8 pt-3 text-[14.5px] text-white/95">
                {SITE.headerSubtitle}
              </div>

              {/* wave edge */}
              <svg
                className="absolute bottom-[-1px] left-0 h-[26px] w-full"
                viewBox="0 0 400 26"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path d="M0 14C70 26 150 2 240 9S350 22 400 6V26H0Z" fill="var(--im-surface)" />
              </svg>
            </div>

            {/* kebab menu */}
            {menuOpen && consent && (
              <>
                <div className="absolute inset-0 z-20" onClick={() => setMenuOpen(false)} aria-hidden="true" />
                <div
                  role="menu"
                  className="im-menu-in absolute right-3 z-30 max-h-[calc(100%-80px)] w-[min(256px,calc(100%-1.5rem))] overflow-y-auto rounded-xl border p-1.5"
                  style={{
                    top: "calc(env(safe-area-inset-top) + 64px)",
                    background: "var(--im-surface)",
                    borderColor: "var(--im-border)",
                    boxShadow: "0 14px 36px rgba(20,30,70,0.2)",
                  }}
                >
                  <MenuItem icon={consent.sound ? I.speakerOn : I.speakerOff} label="Sounds" toggle={consent.sound} onClick={toggleSound} />
                  <MenuItem icon={I.save} label="Save chat on this device" toggle={consent.save} onClick={() => patchConsent({ save: !consent.save })} />
                  <MenuItem icon={theme === "dark" ? I.sun : I.moon} label={theme === "dark" ? "Light mode" : "Dark mode"} toggle={theme === "dark"} onClick={toggleTheme} />
                  <span className="max-lg:hidden">
                    <MenuItem icon={I.expand} label={expanded ? "Smaller window" : "Larger window"} onClick={() => { setExpanded((v) => !v); setMenuOpen(false); }} />
                  </span>
                  <div className="my-1 h-px" style={{ background: "var(--im-border)" }} />
                  <MenuItem icon={I.phone} label="Call or WhatsApp us" onClick={openContact} />
                  {SITE.links.map((l) => (
                    <MenuItem key={l.href} icon={I.link} label={l.label} onClick={() => { window.location.href = l.href; }} />
                  ))}
                  <div className="my-1 h-px" style={{ background: "var(--im-border)" }} />
                  {messages.length > 0 && <MenuItem icon={I.download} label="Download transcript" onClick={downloadTranscript} />}
                  {messages.length > 0 && <MenuItem icon={I.trash} label="Clear conversation" onClick={clearChat} />}
                  <MenuItem icon={I.shield} label="Withdraw consent and erase" danger onClick={withdraw} />
                </div>
              </>
            )}

            {/* CONTACT SHEET: phone + WhatsApp */}
            {contactOpen && (() => {
              const bh = getBusinessStatus();
              const canCall = bh.isOpen;
              const canWa = bh.isOpen || ALLOW_WHATSAPP_OFFLINE;
              return (
                <div
                  role="dialog"
                  aria-label="Contact our team"
                  className="im-fade absolute inset-0 z-40 flex flex-col"
                  style={{ background: "var(--im-surface)" }}
                >
                  <div className="im-grad relative flex-shrink-0 text-white">
                    <div className="flex items-center justify-between gap-3 px-4 pb-8" style={{ paddingTop: topPad }}>
                      <div className="min-w-0">
                        <p className="text-[21px] font-semibold tracking-tight">Talk to a human</p>
                        <p className="mt-0.5 text-[13.5px] text-white/90">Call or message our team</p>
                      </div>
                      <HeadBtn label="Close" onClick={() => setContactOpen(false)}>{I.close}</HeadBtn>
                    </div>
                    <svg className="absolute bottom-[-1px] left-0 h-[26px] w-full" viewBox="0 0 400 26" preserveAspectRatio="none" aria-hidden="true">
                      <path d="M0 14C70 26 150 2 240 9S350 22 400 6V26H0Z" fill="var(--im-surface)" />
                    </svg>
                  </div>

                  <div
                    className="mx-4 mt-1 flex flex-col gap-0.5 rounded-xl px-3.5 py-2.5 text-[12px]"
                    style={
                      bh.isOpen
                        ? theme === "dark"
                          ? { background: "rgba(16,185,129,0.14)", color: "#6EE7B7" }
                          : { background: "#ECFDF5", color: "#065F46" }
                        : theme === "dark"
                          ? { background: "rgba(245,158,11,0.14)", color: "#FCD34D" }
                          : { background: "#FFFBEB", color: "#92400E" }
                    }
                  >
                    <span className="flex items-center gap-2 font-semibold">
                      <span className={`h-2 w-2 rounded-full ${bh.isOpen ? "bg-emerald-500" : "bg-amber-500"}`} />
                      {bh.isOpen ? "Team online now" : "Team offline right now"}
                    </span>
                    <span className="pl-4 opacity-90">{bh.hoursText}</span>
                  </div>

                  <div className="im-scroll flex-1 space-y-3 overflow-y-auto p-4">
                    {DEPARTMENTS.map((d) => (
                      <div key={d.id} className="rounded-2xl border p-4" style={{ background: "var(--im-bubble)", borderColor: "var(--im-border)" }}>
                        <p className="text-[14.5px] font-semibold" style={{ color: "var(--im-text)" }}>{d.label}</p>
                        <p className="mt-0.5 text-[12px] leading-snug" style={{ color: "var(--im-muted)" }}>{d.sublabel}</p>

                        <p className="mt-3 flex items-center gap-2 text-[15px] font-semibold tabular-nums tracking-wide" style={{ color: "var(--im-text)" }}>
                          <span style={{ color: "var(--im-muted)" }}>{I.phone}</span>
                          {fmtPhone(d.number)}
                        </p>

                        <div className="mt-3 grid grid-cols-2 gap-2">
                          {canCall ? (
                            <a
                              href={`tel:+${d.number}`}
                              onClick={() => sfx("click")}
                              className="flex h-10 items-center justify-center gap-2 rounded-xl border text-[13px] font-semibold transition-colors hover:bg-[var(--im-hover)]"
                              style={{ borderColor: "var(--im-text)", background: "var(--im-surface)", color: "var(--im-text)" }}
                            >
                              {I.phone} Call
                            </a>
                          ) : (
                            <span
                              aria-disabled="true"
                              className="flex h-10 cursor-not-allowed select-none items-center justify-center gap-2 rounded-xl border text-[13px] font-semibold"
                              style={{ borderColor: "var(--im-border)", background: "var(--im-surface)", color: "var(--im-muted)", opacity: 0.8 }}
                            >
                              {I.phone} Call
                            </span>
                          )}

                          {canWa ? (
                            <a
                              href={`https://wa.me/${d.number}?text=${encodeURIComponent(d.message)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => sfx("click")}
                              className="flex h-10 items-center justify-center gap-2 rounded-xl bg-[#128C7E] text-[13px] font-semibold text-white transition-colors hover:bg-[#0F7A6E]"
                            >
                              <WhatsAppIcon size={16} /> WhatsApp
                            </a>
                          ) : (
                            <span
                              aria-disabled="true"
                              className="flex h-10 cursor-not-allowed select-none items-center justify-center gap-2 rounded-xl border text-[13px] font-semibold"
                              style={{ borderColor: "var(--im-border)", background: "var(--im-surface)", color: "var(--im-muted)", opacity: 0.8 }}
                            >
                              <WhatsAppIcon size={16} /> WhatsApp
                            </span>
                          )}
                        </div>
                      </div>
                    ))}

                    <p className="px-1 text-[11px] leading-relaxed" style={{ color: "var(--im-muted)" }}>
                      {bh.isOpen
                        ? "Calls and WhatsApp chats are answered by our team, not the AI assistant."
                        : "We're closed right now. Ask the AI assistant, or contact us again during opening hours."}
                    </p>
                  </div>

                  <div className="border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]" style={{ borderColor: "var(--im-border)" }}>
                    <button
                      type="button"
                      onClick={() => setContactOpen(false)}
                      className="h-11 w-full rounded-xl border text-[13.5px] font-semibold hover:bg-[var(--im-hover)]"
                      style={{ borderColor: "var(--im-border)", color: "var(--im-muted)" }}
                    >
                      Back to chat
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* BODY */}
            {!consent ? (
              /* ---------- CONSENT GATE ---------- */
              <div className="im-scroll flex-1 overflow-y-auto px-5 pb-5 pt-2">
                <div className="im-msg-in">
                  <h2 className="text-[21px] font-bold leading-tight tracking-tight" style={{ color: "var(--im-text)" }}>
                    Before we start
                  </h2>
                  <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: "var(--im-muted)" }}>
                    I'm {SITE.assistant}, {SITE.name}'s virtual assistant. I'm not a person, and my answers can be wrong.
                  </p>

                  <ul className="mt-3 space-y-2 text-[13px] leading-relaxed" style={{ color: "var(--im-muted)" }}>
                    {[
                      `What you type is sent to ${SITE.name}'s servers and to an AI provider so I can write a reply.`,
                      "Please don't share passwords, card numbers or other sensitive details.",
                      "If you attach a screenshot or photo, it is sent too. Hide any private details first.",
                      "You can withdraw consent and erase your chat at any time from the menu.",
                    ].map((t) => (
                      <li key={t} className="flex gap-2">
                        <span className="mt-[7px] h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: "var(--im-brand)" }} />
                        {t}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-4 space-y-2.5">
                    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border p-3" style={{ background: "var(--im-bubble)", borderColor: "var(--im-border)" }}>
                      <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[var(--im-brand)]" />
                      <span className="text-[13px] leading-snug" style={{ color: "var(--im-text)" }}>
                        <span className="font-semibold">I agree</span> to my messages being processed to get answers, as described in the{" "}
                        <a href={SITE.privacyHref} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-2" style={{ color: "var(--im-link)" }}>
                          privacy policy
                        </a>
                        .<span className="ml-1" style={{ color: "var(--im-muted)" }}>(required)</span>
                      </span>
                    </label>

                    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border p-3" style={{ background: "var(--im-bubble)", borderColor: "var(--im-border)" }}>
                      <input type="checkbox" checked={optSave} onChange={(e) => setOptSave(e.target.checked)} className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[var(--im-brand)]" />
                      <span className="text-[13px] leading-snug" style={{ color: "var(--im-text)" }}>
                        Keep my chat on this device so I can continue later.
                        <span className="ml-1" style={{ color: "var(--im-muted)" }}>(optional)</span>
                      </span>
                    </label>

                    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border p-3" style={{ background: "var(--im-bubble)", borderColor: "var(--im-border)" }}>
                      <input type="checkbox" checked={optSound} onChange={(e) => setOptSound(e.target.checked)} className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[var(--im-brand)]" />
                      <span className="text-[13px] leading-snug" style={{ color: "var(--im-text)" }}>
                        Play short sounds for messages.
                        <span className="ml-1" style={{ color: "var(--im-muted)" }}>(optional)</span>
                      </span>
                    </label>
                  </div>

                  <div className="mt-5 flex gap-2.5">
                    <button
                      type="button"
                      onClick={accept}
                      disabled={!agree}
                      className="im-grad flex-1 rounded-xl px-4 py-3 text-[14px] font-semibold text-white transition-all hover:brightness-110 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Accept and start chat
                    </button>
                    <button
                      type="button"
                      onClick={closePanel}
                      className="rounded-xl border px-4 py-3 text-[14px] font-semibold hover:bg-[var(--im-hover)]"
                      style={{ borderColor: "var(--im-border)", color: "var(--im-muted)" }}
                    >
                      No thanks
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={openContact}
                    className="mt-4 flex w-full items-center justify-center gap-2 border-t pt-3.5 text-[13px] font-medium hover:underline"
                    style={{ borderColor: "var(--im-border)", color: "var(--im-link)" }}
                  >
                    {I.human} Prefer a person? Call or WhatsApp us
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* MESSAGES */}
                <div className="relative min-h-0 flex-1">
                  <div ref={scrollRef} onScroll={onScroll} className="im-scroll h-full space-y-3 overflow-y-auto px-5 pb-3 pt-3" aria-live="polite">
                    {/* welcome message with quick replies */}
                    <div className="im-msg-in max-w-[92%]">
                      <BotCard options={messages.length === 0 ? welcomeOptions : undefined}>
                        Hi there! I'm {SITE.assistant} <span aria-hidden="true">👋</span>, {SITE.name}'s virtual assistant. How can I help you today?
                      </BotCard>
                    </div>

                    {messages.map((msg, i) =>
                      msg.role === "user" ? (
                        <div key={msg.id} className="im-msg-in flex flex-col items-end gap-1.5">
                          {msg.images && msg.images.length > 0 && (
                            <div className="flex max-w-[82%] flex-wrap justify-end gap-1.5">
                              {msg.images.map((img, k) => (
                                <button
                                  key={k}
                                  type="button"
                                  onClick={() => setLightbox(img)}
                                  className="h-[92px] w-[92px] cursor-zoom-in overflow-hidden rounded-xl border focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--im-brand)]"
                                  style={{ borderColor: "var(--im-border)" }}
                                  aria-label="Open image"
                                >
                                  <img src={img.url} alt={img.alt || "Attached image"} className="h-full w-full object-cover" />
                                </button>
                              ))}
                            </div>
                          )}
                          {msg.content && (
                            <div className="im-grad max-w-[82%] break-words rounded-[18px] rounded-br-md px-4 py-2.5 text-[14px] leading-relaxed text-white">
                              {msg.content}
                            </div>
                          )}
                        </div>
                      ) : (
                        <AssistantMessage
                          key={msg.id}
                          msg={msg}
                          isLast={i === lastIdx}
                          onCopy={copy}
                          onFeedback={setFeedback}
                          onRetry={retry}
                          onSuggest={submit}
                          onImage={setLightbox}
                        />
                      )
                    )}

                    {loading && (
                      <div className="im-msg-in">
                        <div className="inline-block rounded-[18px] px-4 py-3.5" style={{ background: "var(--im-bubble)" }}>
                          <TypingDots />
                        </div>
                      </div>
                    )}
                  </div>

                  {!atBottom && messages.length > 0 && (
                    <button
                      type="button"
                      onClick={() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })}
                      aria-label="Scroll to latest message"
                      className="im-msg-in absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold shadow-md hover:opacity-90"
                      style={{ background: "var(--im-surface)", borderColor: "var(--im-border)", color: "var(--im-link)" }}
                    >
                      {I.arrowDown} Latest
                    </button>
                  )}
                </div>

                {/* COMPOSER */}
                <form
                  id="im-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    submit(input);
                  }}
                  className="relative flex-shrink-0"
                  style={{ background: "var(--im-surface)" }}
                >
                  {listening && (
                    <div
                      className="im-fade mx-5 mb-2 flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-medium"
                      style={{ background: "var(--im-brand-soft)", color: "var(--im-link)" }}
                    >
                      <span className="relative flex h-2 w-2">
                        <span className="im-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: "var(--im-brand)" }} />
                        <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: "var(--im-brand)" }} />
                      </span>
                      Listening… speak now
                    </div>
                  )}

                  <div className="mx-5 h-px" style={{ background: "var(--im-border)" }} />

                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      addFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />

                  {attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 px-5 pt-3">
                      {attachments.map((a, k) => (
                        <div key={k} className="im-fade relative h-14 w-14">
                          <img src={a.url} alt={a.alt || "Attached image"} className="h-full w-full rounded-lg border object-cover" style={{ borderColor: "var(--im-border)" }} />
                          <button
                            type="button"
                            aria-label="Remove image"
                            onClick={() => setAttachments((p) => p.filter((_, j) => j !== k))}
                            className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold leading-none text-white"
                            style={{ background: "var(--im-text)" }}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {attachNote && (
                    <p className="im-fade px-5 pt-2 text-[12px] font-medium" style={{ color: "var(--im-link)" }} role="status">
                      {attachNote}
                    </p>
                  )}

                  <textarea
                    ref={inputRef}
                    rows={1}
                    value={input}
                    maxLength={1000}
                    onChange={(e) => {
                      setInput(e.target.value);
                      autosize(e.target);
                    }}
                    onPaste={(e) => {
                      const files = Array.from(e.clipboardData?.files || []).filter((f) => f.type.startsWith("image/"));
                      if (files.length) {
                        e.preventDefault();
                        addFiles(files);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        submit(input);
                      }
                    }}
                    placeholder={listening ? "Listening..." : "Type your message..."}
                    aria-label="Your message"
                    className="block max-h-[110px] min-h-[28px] w-full resize-none bg-transparent px-5 pb-2 pr-[76px] pt-4 text-[16px] outline-none placeholder:text-[var(--im-muted)] sm:pr-[60px] sm:text-[15px]"
                    style={{ color: "var(--im-text)" }}
                  />

                  {/* emoji picker */}
                  {emojiOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setEmojiOpen(false)} aria-hidden="true" />
                      <div
                        className="im-menu-in absolute bottom-[calc(58px+env(safe-area-inset-bottom))] left-3 z-20 grid w-[min(232px,calc(100%-1.5rem))] grid-cols-5 gap-1 rounded-xl border p-2"
                        style={{ background: "var(--im-surface)", borderColor: "var(--im-border)", boxShadow: "0 14px 36px rgba(20,30,70,0.2)" }}
                      >
                        {EMOJIS.map((e) => (
                          <button
                            key={e}
                            type="button"
                            onClick={() => addEmoji(e)}
                            className="flex h-9 items-center justify-center rounded-lg text-[20px] hover:bg-[var(--im-hover)]"
                            aria-label={`Insert ${e}`}
                          >
                            {e}
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  {/* toolbar */}
                  <div className="flex min-w-0 items-center gap-0.5 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pr-[76px] sm:pr-[52px]">
                    <ToolBtn label="Talk to a human" onClick={openContact}>{I.human}</ToolBtn>
                    <span className="mx-1 h-5 w-px" style={{ background: "var(--im-border)" }} />
                    <ToolBtn label="Attach a screenshot or photo" onClick={() => fileRef.current?.click()} active={attachments.length > 0}>
                      {I.attach}
                    </ToolBtn>
                    {micOk && (
                      <ToolBtn label={listening ? "Stop dictation" : "Dictate with your voice"} onClick={toggleMic} active={listening}>
                        <span className={listening ? "im-mic-on flex h-9 w-9 items-center justify-center rounded-full" : ""}>{I.mic}</span>
                      </ToolBtn>
                    )}
                    <ToolBtn label="Emoji" onClick={() => { setMenuOpen(false); setEmojiOpen((v) => !v); }} active={emojiOpen}>{I.emoji}</ToolBtn>
                    <ToolBtn label={consent.sound ? "Mute sounds" : "Turn sounds on"} onClick={toggleSound}>
                      {consent.sound ? I.speakerOn : I.speakerOff}
                    </ToolBtn>
                    <span className="im-power ml-auto min-w-0 truncate pl-2 text-right text-[10px] font-medium uppercase tracking-wide" style={{ color: "var(--im-muted)" }}>
                      Powered by {SITE.name}
                    </span>
                  </div>
                </form>
              </>
            )}
          </div>

          {/* SEND BUTTON: overlaps the panel edge on desktop, like the reference */}
          {consent && !contactOpen && (
            loading ? (
              <button
                type="button"
                onClick={stop}
                aria-label="Stop answer"
                className="im-grad absolute bottom-[calc(1.1rem+env(safe-area-inset-bottom))] right-4 z-30 flex h-[52px] w-[52px] items-center justify-center rounded-full text-white transition-transform hover:scale-105 active:scale-95 sm:-right-5 sm:bottom-6 im-send"
                style={{ boxShadow: "0 8px 22px var(--im-glow)" }}
              >
                {I.stopSq}
              </button>
            ) : (
              <button
                type="submit"
                form="im-form"
                disabled={!input.trim() && attachments.length === 0}
                aria-label="Send message"
                className="im-grad absolute bottom-[calc(1.1rem+env(safe-area-inset-bottom))] right-4 z-30 flex h-[52px] w-[52px] items-center justify-center rounded-full text-white transition-all hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 sm:-right-5 sm:bottom-6 im-send"
                style={{ boxShadow: "0 8px 22px var(--im-glow)" }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="white" aria-hidden="true">
                  <path d="M3.4 20.4l17.45-7.48a1 1 0 000-1.84L3.4 3.6a.993.993 0 00-1.39.91L2 9.12c0 .5.37.93.87.99L17 12 2.87 13.88c-.5.07-.87.5-.87 1l.01 4.61c0 .71.73 1.2 1.39.91z" />
                </svg>
              </button>
            )
          )}
        </div>
      )}

      {/* LIGHTBOX */}
      {lightbox && (
        <div
          className="im-fade fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-6"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-label="Image preview"
        >
          <div className="relative max-h-full max-w-full" onClick={(e) => e.stopPropagation()}>
            <img src={lightbox.url} alt={lightbox.alt || `${SITE.name} attachment`} className="max-h-[80vh] max-w-full rounded-2xl object-contain" />
            <button
              type="button"
              aria-label="Close preview"
              onClick={() => setLightbox(null)}
              className="absolute -right-3 -top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#14192B] shadow-lg"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
            {lightbox.alt && <p className="mt-2 text-center text-xs text-white/90">{lightbox.alt}</p>}
          </div>
        </div>
      )}
    </>
  );
}