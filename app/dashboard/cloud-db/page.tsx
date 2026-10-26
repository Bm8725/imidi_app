"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import MetaMess from "@/components/metamess";

import { supabase } from "@/lib/supabase";
import { getUserStorageLimitMb, upgradeToProPlan, upgradeToEnterprisePlan } from "@/lib/storageLimit";
import * as tus from "tus-js-client";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/* ───────────── helpers ───────────── */
function formatEta(sec: number) {
  if (!isFinite(sec) || sec <= 0) return "--:--";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatSpeed(mbps: number) {
  if (!isFinite(mbps) || mbps <= 0) return "0 KB/s";
  if (mbps < 1) return `${(mbps * 1024).toFixed(0)} KB/s`;
  return `${mbps.toFixed(2)} MB/s`;
}

function formatSize(mb: number) {
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  if (mb < 0.1) return `${(mb * 1024).toFixed(0)} KB`;
  return `${mb.toFixed(1)} MB`;
}

type TransferStatus = {
  fileName: string;
  index: number;
  total: number;
  percent: number;
  speedMbps: number;
  etaSec: number;
  retrying?: boolean;
};

const ACCENT = "#FF7A1A";
const TYPE_COLOR: Record<string, string> = { "Audio Bank": "#3b82f6", "MIDI Pack": "#10b981", Presets: "#ec4899" };
const TYPE_ICON: Record<string, string> = { "Audio Bank": "wave", "MIDI Pack": "keys", Presets: "sliders" };
const LIBRARY = [
  { id: "all", label: "All files", icon: "grid", type: "" },
  { id: "audio banks", label: "Audio banks", icon: "wave", type: "Audio Bank" },
  { id: "midi packs", label: "MIDI packs", icon: "keys", type: "MIDI Pack" },
  { id: "presets", label: "Presets", icon: "sliders", type: "Presets" },
];
const TAB_TO_TYPE: Record<string, string> = { "audio banks": "Audio Bank", "midi packs": "MIDI Pack", presets: "Presets" };

/* ───────────── icons ───────────── */
const ICONS: Record<string, React.ReactNode> = {
  grid: <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />,
  wave: <path d="M3 12h2M7 8v8M11 4v16M15 8v8M19 10v4" />,
  keys: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M8 5v8M12 5v14M16 5v8" />
    </>
  ),
  sliders: <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />,
  upload: <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 8l5-5 5 5M12 3v13" />,
  download: <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </>
  ),
  tag: <path d="M20 12l-8 8-9-9V3h8l9 9zM7.5 7.5h.01" />,
  spark: <path d="M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z" />,
  key: (
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="M11 12l9-9M16 7l3 3" />
    </>
  ),
  logout: <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />,
  menu: <path d="M3 6h18M3 12h18M3 18h18" />,
  close: <path d="M18 6L6 18M6 6l12 12" />,
  share: (
    <>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.6 10.5l6.8-4M8.6 13.5l6.8 4" />
    </>
  ),
  trash: <path d="M19 7l-.9 12.1A2 2 0 0116.1 21H7.9a2 2 0 01-2-1.9L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </>
  ),
  check: <path d="M20 6L9 17l-5-5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  moon: <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />,
};

function Icon({ name, className = "h-[18px] w-[18px]" }: { name: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {ICONS[name]}
    </svg>
  );
}

/* ───────────── small UI parts ───────────── */
function NavItem({
  icon, label, active, onClick, href, badge, tone,
}: {
  icon: string; label: string; active?: boolean; onClick?: () => void; href?: string; badge?: React.ReactNode; tone?: "danger" | "ai";
}) {
  const color = active
    ? "bg-[color:var(--active)] text-[color:var(--t1)]"
    : tone === "danger"
    ? "text-[color:var(--red-t)] hover:bg-red-500/10 hover:text-[color:var(--red-t)]"
    : "text-[color:var(--t3)] hover:bg-[color:var(--fill)] hover:text-[color:var(--t1)]";
  const cls = `relative flex h-11 w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-[13px] font-medium transition-colors ${color}`;
  const inner = (
    <>
      {active && <span className="absolute bottom-2.5 left-0 top-2.5 w-[3px] rounded-r bg-[#FF7A1A]" />}
      <span className={tone === "ai" ? "text-violet-400" : active ? "text-[#FF7A1A]" : ""}>
        <Icon name={icon} />
      </span>
      <span className="flex-1 truncate text-left">{label}</span>
      {badge}
    </>
  );
  return href ? (
    <Link href={href} className={cls}>{inner}</Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>{inner}</button>
  );
}

function NavLabel({ children }: { children: React.ReactNode }) {
  return <p className="px-3 pb-1.5 pt-5 text-[11px] font-semibold text-[color:var(--t5)]">{children}</p>;
}

function PlanBadge({ plan }: { plan: "free" | "pro" | "enterprise" }) {
  const map = {
    free: "border border-[color:var(--line2)] bg-[color:var(--fill)] text-[color:var(--t2)]",
    pro: "bg-emerald-400 text-black",
    enterprise: "bg-cyan-400 text-black",
  } as const;
  const label = plan === "free" ? "FREE" : plan === "pro" ? "PRO" : "FULL";
  return <span className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider ${map[plan]}`}>{label}</span>;
}

function TransferCard({ kind, s }: { kind: "up" | "down"; s: TransferStatus }) {
  const c = kind === "up" ? ACCENT : "#22d3ee";
  return (
    <div className="rounded-2xl border border-[color:var(--line2)] bg-[color:var(--panel-pop)] p-4 cw-sh-pop backdrop-blur-xl">
      <div className="flex items-center justify-between text-[11px] font-semibold" style={{ color: c }}>
        <span className="flex items-center gap-1.5">
          <Icon name={kind === "up" ? "upload" : "download"} className="h-3.5 w-3.5" />
          {kind === "up" ? "Se încarcă" : "Se descarcă"}
        </span>
        {s.total > 1 && <span className="font-mono text-[color:var(--t4)]">{s.index}/{s.total}</span>}
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="truncate text-[13px] font-medium text-[color:var(--t1)]">{s.fileName}</span>
        <span className="font-mono text-[13px] font-bold" style={{ color: c }}>
          {s.retrying ? "Reconectare…" : `${Math.round(s.percent)}%`}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[color:var(--fill2)]">
        <div
          className={`h-full rounded-full transition-all duration-200 ${s.retrying ? "animate-pulse" : ""}`}
          style={{ width: `${s.percent}%`, background: s.retrying ? "#f59e0b" : c }}
        />
      </div>
      <div className="mt-2 flex justify-between font-mono text-[11px] text-[color:var(--t4)]">
        <span>{formatSpeed(s.speedMbps)}</span>
        <span>ETA {formatEta(s.etaSec)}</span>
      </div>
    </div>
  );
}

function Modal({ eyebrow, title, onClose, children, wide }: { eyebrow: string; title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[color:var(--scrim)] p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        className={`flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-[color:var(--line2)] bg-[color:var(--panel)] text-[color:var(--t2)] cw-sh-modal sm:rounded-3xl ${wide ? "sm:max-w-2xl" : "sm:max-w-md"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[color:var(--line)] px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold" style={{ color: ACCENT }}>{eyebrow}</p>
            <h3 className="truncate text-[15px] font-semibold text-[color:var(--t1)]">{title}</h3>
          </div>
          <button onClick={onClose} aria-label="Închide" className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-[color:var(--t3)] transition-colors hover:bg-[color:var(--fill2)] hover:text-[color:var(--t1)]">
            <Icon name="close" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}


/* ───────────── theme ───────────── */
type Theme = "dark" | "light";
const THEME_KEY = "imidi-cloud-theme"; // add this key to UI_PREF_KEYS in CookieBanner
// the preference is only stored when the visitor allowed "Remember my settings"
function canRemember() {
  try {
    const p = JSON.parse(localStorage.getItem("imidi_cookies_preferences") || "null");
    return !!p && p.version === 2 && !!p.preferences;
  } catch {
    return false;
  }
}

const THEME_CSS = `
.cw-root[data-theme="dark"]{color-scheme:dark;--bg:#0A0A0B;--bg-a:rgba(10,10,11,.9);--panel:#111113;--panel-a:rgba(17,17,19,.6);--panel-pop:rgba(20,20,22,.95);--line:rgba(255,255,255,.07);--line2:rgba(255,255,255,.10);--line3:rgba(255,255,255,.18);--fill0:rgba(255,255,255,.03);--fill:rgba(255,255,255,.05);--fill2:rgba(255,255,255,.10);--active:rgba(255,255,255,.08);--t1:#fff;--t2:#d4d4d8;--t3:#a1a1aa;--t4:#71717a;--t5:#52525b;--scrim:rgba(0,0,0,.7);--input:rgba(0,0,0,.4);--violet-t:#c4b5fd;--amber-t:#fde68a;--red-t:#f87171;--err-t:#fee2e2;--ok-t:#d1fae5;--emerald-t:#34d399;--cyan-t:#67e8f9;--orange-t:#FF9A4D;--ok-bg:rgba(2,44,34,.85);--err-bg:rgba(69,10,10,.85);--sh-drawer:20px 0 60px rgba(0,0,0,.6);--sh-modal:0 30px 80px rgba(0,0,0,.7);--sh-pop:0 20px 60px rgba(0,0,0,.6)}
.cw-root[data-theme="light"]{color-scheme:light;--bg:#F3F4F7;--bg-a:rgba(243,244,247,.92);--panel:#FFFFFF;--panel-a:rgba(255,255,255,.7);--panel-pop:rgba(255,255,255,.97);--line:rgba(15,23,42,.08);--line2:rgba(15,23,42,.12);--line3:rgba(15,23,42,.22);--fill0:rgba(15,23,42,.025);--fill:rgba(15,23,42,.04);--fill2:rgba(15,23,42,.08);--active:rgba(255,122,26,.12);--t1:#0F172A;--t2:#1E293B;--t3:#475569;--t4:#64748B;--t5:#94A3B8;--scrim:rgba(15,23,42,.45);--input:#F8FAFC;--violet-t:#6D28D9;--amber-t:#92400E;--red-t:#DC2626;--err-t:#7F1D1D;--ok-t:#064E3B;--emerald-t:#047857;--cyan-t:#0E7490;--orange-t:#C2560A;--ok-bg:#ECFDF5;--err-bg:#FEF2F2;--sh-drawer:20px 0 60px rgba(15,23,42,.18);--sh-modal:0 30px 80px rgba(15,23,42,.25);--sh-pop:0 20px 60px rgba(15,23,42,.18)}
.cw-root[data-theme="light"] [class*="bg-[color:var(--panel)]"]{box-shadow:0 1px 2px rgba(15,23,42,.05),0 12px 32px -20px rgba(15,23,42,.22)}
.cw-sh-drawer{box-shadow:var(--sh-drawer)!important}
.cw-sh-modal{box-shadow:var(--sh-modal)!important}
.cw-sh-pop{box-shadow:var(--sh-pop)!important}
`;

function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  const light = theme === "light";
  const slot = "relative z-10 flex h-9 w-[38px] items-center justify-center transition-colors duration-300";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={light}
      aria-label={light ? "Switch to dark theme" : "Switch to light theme"}
      title={light ? "Dark theme" : "Light theme"}
      onClick={onToggle}
      className="relative flex h-11 w-[84px] shrink-0 cursor-pointer items-center rounded-xl border border-[color:var(--line2)] bg-[color:var(--panel)] p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF7A1A]"
    >
      <span
        aria-hidden
        className={`absolute left-1 top-1 h-9 w-[38px] rounded-lg bg-[#FF7A1A] transition-transform duration-300 ease-out ${light ? "translate-x-[38px]" : ""}`}
      />
      <span className={`${slot} ${light ? "text-[color:var(--t4)]" : "text-black"}`}><Icon name="moon" /></span>
      <span className={`${slot} ${light ? "text-black" : "text-[color:var(--t4)]"}`}><Icon name="sun" /></span>
    </button>
  );
}

/* ───────────── page ───────────── */
export default function CloudWorkspacePage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("all");
  const [banks, setBanks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalUsedMb, setTotalUsedMb] = useState(0);
  const [typeUsed, setTypeUsed] = useState<Record<string, { mb: number; count: number }>>({});
  const [user, setUser] = useState<any>(null);
  const [delId, setDelId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<TransferStatus | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<TransferStatus | null>(null);

  // UI
  const [drawer, setDrawer] = useState(false);
  const [theme, setTheme] = useState<Theme>("dark");
  const [query, setQuery] = useState("");
  const [dragging, setDragging] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" } | null>(null);

  // share
  const [shareBank, setShareBank] = useState<any | null>(null);
  const [shareCode, setShareCode] = useState("");
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState("");
  const [shareResultUrl, setShareResultUrl] = useState("");
  const [shareResultExpires, setShareResultExpires] = useState("");
  const [shareCopied, setShareCopied] = useState(false);

  // AI
  const [showMarketAnalysis, setShowMarketAnalysis] = useState(false);
  const [marketAnalysisLoading, setMarketAnalysisLoading] = useState(false);
  const [marketAnalysisText, setMarketAnalysisText] = useState("");
  const [marketAnalysisError, setMarketAnalysisError] = useState("");
  const [marketStats, setMarketStats] = useState<any>(null);

  // plan
  const [plan, setPlan] = useState<"free" | "pro" | "enterprise">("free");
  const [buyingCloud, setBuyingCloud] = useState(false);
  const [buyingEnterprise, setBuyingEnterprise] = useState(false);
  const [maxMb, setMaxMb] = useState(50);
  const lim = 6;

  // history
  const [showDownloadHistory, setShowDownloadHistory] = useState(false);
  const [downloadHistory, setDownloadHistory] = useState<any[]>([]);
  const [downloadHistoryLoading, setDownloadHistoryLoading] = useState(false);
  const [downloadHistoryError, setDownloadHistoryError] = useState("");

  // facebook
  const [facebookId, setFacebookId] = useState<string | null>(null);
  const [userError, setUserError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const v = canRemember() ? localStorage.getItem(THEME_KEY) : null;
      if (v === "light" || v === "dark") setTheme(v);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const toggleTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      if (canRemember()) localStorage.setItem(THEME_KEY, next);
    } catch {
      /* storage unavailable */
    }
  };

  const notify = (msg: string, kind: "ok" | "err" = "ok") => setToast({ msg, kind });
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [drawer]);

  useEffect(() => {
    async function loadUser() {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        setUserError("Trebuie să fii logat.");
        return;
      }
      const fbIdentity = user.identities?.find((identity) => identity.provider === "facebook");
      if (fbIdentity) setFacebookId(fbIdentity.id);
    }
    loadUser();
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Unauthorized. Please log in.");
      setUser({
        id: session.user.id,
        email: session.user.email,
        name: session.user.user_metadata?.full_name || "Operator",
        avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${session.user.id}`,
      });

      const { plan: userPlan, limitMb } = await getUserStorageLimitMb(session.user.id);
      setPlan(userPlan);
      setMaxMb(limitMb);

      const { data: all } = await supabase.from("cloud_banks").select("size_mb,type").eq("user_id", session.user.id);
      if (all) {
        setTotalUsedMb(all.reduce((acc, c) => acc + Number(c.size_mb), 0));
        const t: Record<string, { mb: number; count: number }> = {};
        all.forEach((c: any) => {
          t[c.type] = t[c.type] || { mb: 0, count: 0 };
          t[c.type].mb += Number(c.size_mb);
          t[c.type].count += 1;
        });
        setTypeUsed(t);
      }

      let q = supabase.from("cloud_banks").select("*").eq("user_id", session.user.id);
      if (activeTab !== "all") q = q.eq("type", TAB_TO_TYPE[activeTab]);
      const { data } = await q.order("created_at", { ascending: false }).range((page - 1) * lim, page * lim - 1);
      if (data) setBanks(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, activeTab]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* ───── plan upgrades ───── */
  const handleBuyCloud = async () => {
    if (!user) return;
    window.open("https://revolut.me/mariusvalentin_b", "_blank", "noopener,noreferrer");
    const confirmed = window.confirm("Am deschis pagina de plata Revolut intr-un tab nou.\n\nDupa ce ai trimis $50, apasa OK aici ca sa activam cei 30GB.");
    if (!confirmed) return;
    setBuyingCloud(true);
    try {
      const { limitMb } = await upgradeToProPlan(user.id);
      setPlan("pro");
      setMaxMb(limitMb);
      notify("Gata! Ai acum 30GB de stocare.");
    } catch (err: any) {
      notify(err.message || "Nu am putut activa spatiul suplimentar. Incearca din nou.", "err");
    } finally {
      setBuyingCloud(false);
    }
  };

  const handleBuyEnterprise = async () => {
    if (!user) return;
    window.open("https://revolut.me/mariusvalentin_b", "_blank", "noopener,noreferrer");
    const confirmed = window.confirm("Am deschis pagina de plata Revolut intr-un tab nou.\n\nDupa ce ai trimis $149.90, apasa OK aici ca sa activam cei 250GB.");
    if (!confirmed) return;
    setBuyingEnterprise(true);
    try {
      const { limitMb } = await upgradeToEnterprisePlan(user.id);
      setPlan("enterprise");
      setMaxMb(limitMb);
      notify("Gata! Ai acum 250GB de stocare.");
    } catch (err: any) {
      notify(err.message || "Nu am putut activa spatiul suplimentar. Incearca din nou.", "err");
    } finally {
      setBuyingEnterprise(false);
    }
  };

  /* ───── upload (TUS) ───── */
  const uploadFileWithTus = (file: File, path: string, accessToken: string, index: number, total: number) => {
    return new Promise<void>((resolve, reject) => {
      let lastLoaded = 0;
      let lastTime = Date.now();
      const speedSamples: number[] = [];

      setUploadStatus({ fileName: file.name, index, total, percent: 0, speedMbps: 0, etaSec: 0, retrying: false });

      const upload = new tus.Upload(file, {
        endpoint: `${SUPABASE_URL}/storage/v1/upload/resumable`,
        retryDelays: [0, 1000, 3000, 5000, 10000, 20000],
        headers: { authorization: `Bearer ${accessToken}`, apikey: SUPABASE_ANON_KEY, "x-upsert": "false" },
        chunkSize: 6 * 1024 * 1024,
        uploadDataDuringCreation: true,
        metadata: {
          bucketName: "cloud-db-bucket",
          objectName: path,
          contentType: file.type || "application/octet-stream",
          cacheControl: "3600",
        },
        onShouldRetry: (err) => {
          const status = (err as any)?.originalResponse?.getStatus?.();
          if (status && status >= 400 && status < 500 && status !== 409) return false;
          setUploadStatus((prev) => (prev ? { ...prev, retrying: true } : prev));
          return true;
        },
        onError: (err) => reject(err),
        onProgress: (bytesUploaded, bytesTotal) => {
          const now = Date.now();
          const elapsedSec = (now - lastTime) / 1000;
          const instantSpeed = elapsedSec > 0 ? (bytesUploaded - lastLoaded) / elapsedSec : 0;
          speedSamples.push(instantSpeed);
          if (speedSamples.length > 5) speedSamples.shift();
          const avgSpeed = speedSamples.reduce((a, b) => a + b, 0) / speedSamples.length;
          const etaSec = avgSpeed > 0 ? (bytesTotal - bytesUploaded) / avgSpeed : 0;
          lastLoaded = bytesUploaded;
          lastTime = now;
          setUploadStatus((prev) =>
            prev ? { ...prev, percent: (bytesUploaded / bytesTotal) * 100, speedMbps: avgSpeed / (1024 * 1024), etaSec, retrying: false } : prev
          );
        },
        onSuccess: () => resolve(),
      });

      upload.findPreviousUploads().then((previousUploads) => {
        if (previousUploads.length) upload.resumeFromPreviousUpload(previousUploads[0]);
        upload.start();
      });
    });
  };

  // shared by the file picker AND drag & drop
  const processFiles = async (fileList: File[]) => {
    if (!fileList.length || uploading || !user) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      notify("Sesiune expirată, te rog reloghează-te.", "err");
      return;
    }

    setUploading(true);
    try {
      let runningTotal = totalUsedMb;
      const errors: string[] = [];
      let blocked = false;
      let okCount = 0;

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const fileSizeMb = file.size / (1024 * 1024);

        if (runningTotal >= maxMb) {
          blocked = true;
          errors.push(`${file.name}: neîncărcat — ai atins limita de ${formatSize(maxMb)}.`);
          continue;
        }
        if (runningTotal + fileSizeMb > maxMb) {
          blocked = true;
          errors.push(`${file.name}: neîncărcat — ar depăși limita de ${formatSize(maxMb)}.`);
          continue;
        }

        try {
          const ext = file.name.split(".").pop()?.toLowerCase() || "";
          const path = `${user.id}/${Math.random().toString(36).substring(2)}.${ext}`;

          await uploadFileWithTus(file, path, session.access_token, i + 1, fileList.length);

          let type = "Audio Bank", color = "#3b82f6";
          if (["fxp", "fxb", "vital", "fst", "adg", "adv", "pst", "json", "ts4", "bin", "jsf", "jbb", "sf2", "hex", "jbs", "prf", "bup"].includes(ext)) {
            type = "Presets"; color = "#ec4899";
          } else if (["mid", "midi"].includes(ext)) {
            type = "MIDI Pack"; color = "#10b981";
          }

          const { error: insErr } = await supabase.from("cloud_banks").insert({
            user_id: user.id, name: file.name, type, items_count: 1,
            size_mb: parseFloat(fileSizeMb.toFixed(2)), status: "active", color_hex: color, storage_path: path,
          });
          if (insErr) throw insErr;

          runningTotal += fileSizeMb;
          okCount++;
        } catch (fileErr: any) {
          errors.push(`${file.name}: ${fileErr.message || "eroare la upload"}`);
        }
      }

      if (blocked) {
        notify(`Ai depășit spațiul disponibil.\n${errors.join("\n")}\nExtinde stocarea din meniul din stânga.`, "err");
      } else if (errors.length) {
        notify(`Unele fișiere nu s-au încărcat:\n${errors.join("\n")}`, "err");
      } else if (okCount) {
        notify(okCount === 1 ? "Fișier încărcat." : `${okCount} fișiere încărcate.`);
      }
      await loadData();
    } catch (err: any) {
      notify(err.message, "err");
    } finally {
      setUploading(false);
      setUploadStatus(null);
    }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length) processFiles(Array.from(files));
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (totalUsedMb >= maxMb) return notify("Ai atins limita de stocare.", "err");
    processFiles(Array.from(e.dataTransfer.files || []));
  };

  /* ───── download ───── */
  const handleDownload = async (bank: any) => {
    if (!bank.storage_path) {
      notify("Fișierul acesta nu are un path de storage salvat, nu poate fi descărcat.", "err");
      return;
    }
    setDownloadingId(bank.id);
    setDownloadStatus({ fileName: bank.name, index: 1, total: 1, percent: 0, speedMbps: 0, etaSec: 0 });

    try {
      const { data: signed, error: signErr } = await supabase.storage.from("cloud-db-bucket").createSignedUrl(bank.storage_path, 120);
      if (signErr || !signed?.signedUrl) throw signErr || new Error("Nu am putut genera link de descărcare.");

      const res = await fetch(signed.signedUrl);
      if (!res.ok || !res.body) throw new Error("Descărcarea a eșuat.");

      const contentLengthHeader = res.headers.get("content-length");
      const totalBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : bank.size_mb * 1024 * 1024;

      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let receivedBytes = 0;
      let lastLoaded = 0;
      let lastTime = Date.now();
      const speedSamples: number[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          receivedBytes += value.length;

          const now = Date.now();
          const elapsedSec = (now - lastTime) / 1000;
          if (elapsedSec > 0.15) {
            const instantSpeed = (receivedBytes - lastLoaded) / elapsedSec;
            speedSamples.push(instantSpeed);
            if (speedSamples.length > 5) speedSamples.shift();
            const avgSpeed = speedSamples.reduce((a, b) => a + b, 0) / speedSamples.length;
            const etaSec = avgSpeed > 0 ? Math.max(totalBytes - receivedBytes, 0) / avgSpeed : 0;
            lastLoaded = receivedBytes;
            lastTime = now;
            setDownloadStatus((prev) =>
              prev ? { ...prev, percent: totalBytes > 0 ? Math.min(100, (receivedBytes / totalBytes) * 100) : 0, speedMbps: avgSpeed / (1024 * 1024), etaSec } : prev
            );
          }
        }
      }

      setDownloadStatus((prev) => (prev ? { ...prev, percent: 100, etaSec: 0 } : prev));

      const blob = new Blob(chunks as BlobPart[]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = bank.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      notify(err.message || "Download failed.", "err");
    } finally {
      setDownloadingId(null);
      setDownloadStatus(null);
    }
  };

  const handleDelete = async (id: string) => {
    const { error: delErr } = await supabase.from("cloud_banks").delete().eq("id", id);
    setDelId(null);
    if (delErr) return notify(delErr.message, "err");
    notify("Fișier șters.");
    await loadData();
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await supabase.auth.signOut();
      router.push("/login");
    } catch (err: any) {
      notify(err.message || "failed.", "err");
      setLoggingOut(false);
    }
  };

  /* ───── share ───── */
  const openShareModal = (bank: any) => {
    setShareBank(bank);
    setShareCode("");
    setShareError("");
    setShareResultUrl("");
    setShareResultExpires("");
    setShareCopied(false);
  };
  const closeShareModal = () => setShareBank(null);

  const generateShareLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareBank) return;
    if (shareCode.trim().length < 4) {
      setShareError("Codul trebuie sa aiba minim 4 caractere.");
      return;
    }
    setShareLoading(true);
    setShareError("");
    try {
      const { data, error } = await supabase.rpc("create_share_link", { p_bank_id: shareBank.id, p_code: shareCode.trim() });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      setShareResultUrl(`${window.location.origin}/download/${row.token}`);
      setShareResultExpires(new Date(row.expires_at).toLocaleDateString("ro-RO"));
    } catch (err: any) {
      setShareError(err.message || "Nu am putut genera linkul.");
    } finally {
      setShareLoading(false);
    }
  };

  const copyShareUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareResultUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      setShareError("Nu am putut copia linkul.");
    }
  };

  /* ───── history + AI ───── */
  const openDownloadHistory = async () => {
    setShowDownloadHistory(true);
    setDownloadHistoryLoading(true);
    setDownloadHistoryError("");
    try {
      const { data, error } = await supabase.from("cloud_download_log").select("*").order("downloaded_at", { ascending: false });
      if (error) throw error;
      setDownloadHistory(data ?? []);
    } catch (err: any) {
      setDownloadHistoryError(err.message || "Nu am putut incarca istoricul.");
    } finally {
      setDownloadHistoryLoading(false);
    }
  };

  const runMarketAnalysis = async () => {
    setShowMarketAnalysis(true);
    setMarketAnalysisLoading(true);
    setMarketAnalysisError("");
    setMarketAnalysisText("");
    setMarketStats(null);
    try {
      const res = await fetch("/api/ai/analyse-market");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Eroare la generarea analizei.");
      setMarketAnalysisText(data.analysis);
      setMarketStats(data);
    } catch (err: any) {
      setMarketAnalysisError(err.message);
    } finally {
      setMarketAnalysisLoading(false);
    }
  };

  /* ───── derived ───── */
  const pct = Math.min(100, (totalUsedMb / maxMb) * 100);
  const full = totalUsedMb >= maxMb;
  const totalFiles = Object.values(typeUsed).reduce((a, t) => a + t.count, 0);
  const section = LIBRARY.find((l) => l.id === activeTab) || LIBRARY[0];
  const shown = useMemo(() => banks.filter((b) => b.name.toLowerCase().includes(query.trim().toLowerCase())), [banks, query]);
  const ringC = 2 * Math.PI * 38;

  const pick = (fn: () => void) => () => {
    setDrawer(false);
    fn();
  };

  /* ───── sidebar (same content on desktop rail and mobile drawer) ───── */
  const renderSidebar = (mobile: boolean) => (
    <div className="flex h-full min-h-0 flex-col">
      {mobile && (
        <div className="flex items-center justify-between border-b border-[color:var(--line)] px-4 py-3.5">
          <span className="text-[15px] font-semibold text-[color:var(--t1)]">
            iMIDI <span style={{ color: ACCENT }}>MyCloud</span>
          </span>
          <button onClick={() => setDrawer(false)} aria-label="Close menu" className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-[color:var(--t3)] hover:bg-[color:var(--fill2)] hover:text-[color:var(--t1)]">
            <Icon name="close" />
          </button>
        </div>
      )}

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-2" aria-label="MyCloud menu">
        <button
          type="button"
          onClick={pick(() => fileRef.current?.click())}
          disabled={full || uploading}
          className="mb-1 mt-2 flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl text-[13px] font-bold text-black transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-30"
          style={{ background: ACCENT, boxShadow: "0 8px 24px -8px rgba(255,122,26,0.6)" }}
        >
          {uploading ? (
            <>
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/30 border-t-black" />
              {uploadStatus ? `${Math.round(uploadStatus.percent)}%` : "Uploading…"}
            </>
          ) : (
            <>
              <Icon name="plus" className="h-4 w-4" />
              Upload files
            </>
          )}
        </button>

        <NavLabel>Library</NavLabel>
        <div className="space-y-0.5">
          {LIBRARY.map((l) => (
            <NavItem
              key={l.id}
              icon={l.icon}
              label={l.label}
              active={activeTab === l.id}
              onClick={pick(() => { setActiveTab(l.id); setPage(1); setQuery(""); })}
              badge={
                <span className="font-mono text-[11px] text-[color:var(--t5)]">
                  {l.id === "all" ? totalFiles : typeUsed[l.type]?.count ?? 0}
                </span>
              }
            />
          ))}
        </div>

        <NavLabel>Tools</NavLabel>
        <div className="space-y-0.5">
          <NavItem icon="clock" label="Download history" onClick={pick(openDownloadHistory)} />
          <NavItem icon="tag" label="My listings" href="/dashboard/my-listings" />
          <NavItem icon="spark" label="AI Analyse" tone="ai" onClick={pick(runMarketAnalysis)} badge={<span className="rounded bg-violet-500/20 px-1.5 py-0.5 text-[10px] font-bold text-[color:var(--violet-t)]">AI</span>} />
        </div>

        <NavLabel>Account</NavLabel>
        <div className="space-y-0.5">
          <NavItem icon="key" label="Reset password" href="/update-password" />
          <NavItem icon="logout" label={loggingOut ? "Logging out…" : "Log out"} tone="danger" onClick={handleLogout} />
        </div>
      </nav>

      {/* account + storage */}
      <div className="shrink-0 space-y-3 border-t border-[color:var(--line)] p-4" style={mobile ? { paddingBottom: "max(1rem, env(safe-area-inset-bottom))" } : undefined}>
        <div className="flex items-center gap-3">
          <img
            src={user?.avatar || "/profile.jpg"}
            alt=""
            className="h-9 w-9 rounded-xl border border-[color:var(--line2)] bg-[color:var(--fill)] object-cover"
            onError={(e) => { e.currentTarget.src = "/profile.jpg"; }}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-[color:var(--t1)]">{user?.name || "…"}</p>
            <p className="truncate text-[11px] text-[color:var(--t4)]">{user?.email}</p>
          </div>
          <PlanBadge plan={plan} />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between text-[11px]">
            <span className="text-[color:var(--t4)]">Storage</span>
            <span className="font-mono text-[color:var(--t2)]">{formatSize(totalUsedMb)} / {formatSize(maxMb)}</span>
          </div>
          <div className="flex h-1.5 overflow-hidden rounded-full bg-[color:var(--fill2)]">
            {Object.entries(typeUsed).map(([t, v]) => (
              <div key={t} style={{ width: `${(v.mb / maxMb) * 100}%`, background: TYPE_COLOR[t] || "#888" }} />
            ))}
          </div>
        </div>

        {plan === "free" && (
          <button onClick={handleBuyCloud} disabled={buyingCloud} className="h-10 w-full cursor-pointer rounded-xl border border-[#FF7A1A]/40 bg-[#FF7A1A]/10 text-[12px] font-bold text-[color:var(--orange-t)] transition hover:bg-[#FF7A1A]/20 disabled:opacity-30">
            {buyingCloud ? "Activating…" : "Upgrade to 30GB · $50"}
          </button>
        )}
        {plan === "pro" && (
          <button onClick={handleBuyEnterprise} disabled={buyingEnterprise} className="h-10 w-full cursor-pointer rounded-xl border border-[color:var(--line3)] bg-[color:var(--fill)] text-[12px] font-bold text-[color:var(--t1)] transition hover:border-[#FF7A1A]/50 hover:text-[color:var(--orange-t)] disabled:opacity-30">
            {buyingEnterprise ? "Activating…" : "Extend to 250GB · $149.90"}
          </button>
        )}
        {plan === "enterprise" && (
          <div className="flex h-10 items-center justify-center rounded-xl bg-cyan-400/10 text-[12px] font-bold text-[color:var(--cyan-t)]">Enterprise active · 250GB</div>
        )}
      </div>
    </div>
  );

  return (
    <div data-theme={theme} className="cw-root flex min-h-screen flex-col bg-[color:var(--bg)] text-[color:var(--t2)] antialiased selection:bg-[#FF7A1A] selection:text-black">
      <style>{THEME_CSS}</style>
      <Navbar />

      <input
        type="file"
        multiple
        ref={fileRef}
        onChange={handleUpload}
        className="hidden"
        accept="audio/*,.mid,.midi,.fxp,.fxb,.vital,.fst,.adg,.adv,.pst,.json,.ts4,.bin,.jsf,.jbb,.sf2,.hex,.jbs,.prf,.bup"
      />

      {error ? (
        <main className="mx-auto mt-40 w-full max-w-sm flex-1 px-6">
          <div className="rounded-2xl border border-[color:var(--line2)] bg-[color:var(--panel)] p-6 text-center">
            <p className="mb-4 text-sm text-[color:var(--t3)]">{error}</p>
            <Link href="/login" className="block rounded-xl bg-[color:var(--t1)] px-4 py-2.5 text-sm font-semibold text-[color:var(--panel)]">Autentificare</Link>
          </div>
        </main>
      ) : (
        <div className="relative mx-auto flex w-full max-w-[1400px] flex-1 gap-6 px-4 pb-12 pt-28 lg:px-6">
          <div aria-hidden className="pointer-events-none absolute right-1/4 top-10 h-[420px] w-[420px] rounded-full bg-[#FF7A1A]/[0.05] blur-[140px]" />

          {/* desktop rail */}
          <aside className="sticky top-28 z-10 hidden h-[calc(100dvh-8rem)] w-72 shrink-0 overflow-hidden rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel)] lg:block">
            {renderSidebar(false)}
          </aside>

          {/* main */}
          <main
            className="relative z-10 min-w-0 flex-1 space-y-6"
            onDragOver={(e) => { e.preventDefault(); if (!dragging) setDragging(true); }}
            onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false); }}
            onDrop={onDrop}
          >
            {dragging && (
              <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-[#FF7A1A] bg-[color:var(--bg-a)] backdrop-blur-sm">
                <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FF7A1A]/15 text-[#FF7A1A]"><Icon name="upload" className="h-8 w-8" /></span>
                <p className="text-lg font-semibold text-[color:var(--t1)]">Eliberează pentru a încărca</p>
                <p className="text-sm text-[color:var(--t4)]">Audio, MIDI și preseturi</p>
              </div>
            )}

            {/* header */}
            <header className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => setDrawer(true)}
                aria-label="Open menu"
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border border-[color:var(--line2)] bg-[color:var(--panel)] text-[color:var(--t1)] lg:hidden"
              >
                <Icon name="menu" />
              </button>
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-2xl font-bold tracking-tight text-[color:var(--t1)] sm:text-3xl">{section.label}</h1>
                <p className="mt-0.5 truncate text-[12px] text-[color:var(--t4)]">iMIDI MyCloud · {user?.email}</p>
              </div>
              <label className="relative order-last w-full sm:order-none sm:w-64">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--t4)]"><Icon name="search" className="h-4 w-4" /></span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Caută pe această pagină…"
                  className="h-11 w-full rounded-xl border border-[color:var(--line2)] bg-[color:var(--panel)] pl-10 pr-3 text-[13px] text-[color:var(--t1)] outline-none transition placeholder:text-[color:var(--t5)] focus:border-[#FF7A1A]/60"
                />
              </label>
              <ThemeToggle theme={theme} onToggle={toggleTheme} />
            </header>

            {/* stats */}
            <section className="grid gap-4 lg:grid-cols-3">
              <div className="relative overflow-hidden rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel)] p-5 lg:col-span-2">
                <div aria-hidden className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-[#FF7A1A]/10 blur-3xl" />
                <div className="relative flex items-center gap-5">
                  <div className="relative h-24 w-24 shrink-0">
                    <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                      <circle cx="50" cy="50" r="38" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="9" />
                      <circle
                        cx="50" cy="50" r="38" fill="none" strokeWidth="9" strokeLinecap="round"
                        stroke={pct > 85 ? "#ef4444" : pct > 60 ? "#f59e0b" : ACCENT}
                        strokeDasharray={`${(pct / 100) * ringC} ${ringC}`}
                        className="transition-all duration-700"
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center font-mono text-[15px] font-bold text-[color:var(--t1)]">{Math.round(pct)}%</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] text-[color:var(--t4)]">Spațiu folosit</p>
                    <p className="mt-0.5 text-2xl font-bold text-[color:var(--t1)]">
                      {formatSize(totalUsedMb)} <span className="text-base font-medium text-[color:var(--t5)]">din {formatSize(maxMb)}</span>
                    </p>
                    <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-[color:var(--fill2)]">
                      {Object.entries(typeUsed).map(([t, v]) => (
                        <div key={t} className="transition-all duration-700" style={{ width: `${(v.mb / maxMb) * 100}%`, background: TYPE_COLOR[t] || "#888" }} />
                      ))}
                    </div>
                    <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[color:var(--t4)]">
                      {Object.keys(TYPE_COLOR).map((t) => (
                        <span key={t} className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full" style={{ background: TYPE_COLOR[t] }} />
                          {t} · {formatSize(typeUsed[t]?.mb ?? 0)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel)] p-5">
                <p className="text-[12px] text-[color:var(--t4)]">Fișiere în cloud</p>
                <p className="mt-0.5 text-3xl font-bold text-[color:var(--t1)]">{totalFiles}</p>
                <div className="mt-3 space-y-1.5">
                  {Object.keys(TYPE_COLOR).map((t) => (
                    <div key={t} className="flex items-center justify-between text-[12px]">
                      <span className="flex items-center gap-2 text-[color:var(--t3)]">
                        <span style={{ color: TYPE_COLOR[t] }}><Icon name={TYPE_ICON[t]} className="h-4 w-4" /></span>
                        {t}
                      </span>
                      <span className="font-mono text-[color:var(--t2)]">{typeUsed[t]?.count ?? 0}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {full && (
              <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 sm:flex-row sm:items-center">
                <p className="text-[13px] text-[color:var(--amber-t)]">
                  Ai atins limita de {formatSize(maxMb)}. Nu mai poți urca fișiere noi până nu ștergi ceva sau extinzi stocarea.
                </p>
                {plan === "free" && (
                  <button onClick={handleBuyCloud} disabled={buyingCloud} className="h-9 shrink-0 cursor-pointer rounded-lg bg-amber-400 px-4 text-[12px] font-bold text-black disabled:opacity-40">
                    {buyingCloud ? "…" : "Cumpără 30GB · $50"}
                  </button>
                )}
                {plan === "pro" && (
                  <button onClick={handleBuyEnterprise} disabled={buyingEnterprise} className="h-9 shrink-0 cursor-pointer rounded-lg bg-amber-400 px-4 text-[12px] font-bold text-black disabled:opacity-40">
                    {buyingEnterprise ? "…" : "Extinde la 250GB · $149.90"}
                  </button>
                )}
                {plan === "enterprise" && (
                  <Link href="/pricing" className="flex h-9 shrink-0 items-center rounded-lg bg-amber-400 px-4 text-[12px] font-bold text-black">Contactează-ne</Link>
                )}
              </div>
            )}

            {/* files */}
            {loading ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-[132px] animate-pulse rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel)]" />
                ))}
              </div>
            ) : shown.length === 0 ? (
              <button
                type="button"
                onClick={() => !full && fileRef.current?.click()}
                className="flex w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-[color:var(--line2)] bg-[color:var(--panel-a)] px-6 py-16 text-center transition hover:border-[#FF7A1A]/50 hover:bg-[#FF7A1A]/[0.03]"
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[color:var(--fill)] text-[color:var(--t3)]"><Icon name="upload" className="h-7 w-7" /></span>
                <span className="text-[15px] font-semibold text-[color:var(--t1)]">{query ? "Niciun rezultat pe această pagină" : "Nimic aici încă"}</span>
                <span className="text-[13px] text-[color:var(--t4)]">{query ? "Încearcă alt termen de căutare." : "Trage fișiere aici sau apasă pentru a încărca."}</span>
              </button>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {shown.map((b) => {
                  const color = b.color_hex || TYPE_COLOR[b.type] || "#3b82f6";
                  const isDl = downloadingId === b.id;
                  return (
                    <article key={b.id} className="group relative overflow-hidden rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel)] p-4 transition duration-200 hover:-translate-y-0.5 hover:border-[color:var(--line3)]">
                      <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-20 blur-2xl transition-opacity group-hover:opacity-45" style={{ background: color }} />
                      <div className="relative flex items-start gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border" style={{ background: `${color}14`, borderColor: `${color}40`, color }}>
                          <Icon name={TYPE_ICON[b.type] || "wave"} className="h-5 w-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-[14px] font-semibold text-[color:var(--t1)]" title={b.name}>{b.name}</h3>
                          <p className="mt-0.5 text-[12px] text-[color:var(--t4)]">
                            {b.type} · {formatSize(Number(b.size_mb))}
                            {b.created_at && <> · {new Date(b.created_at).toLocaleDateString("ro-RO")}</>}
                          </p>
                        </div>
                      </div>

                      <div className="relative mt-4 flex items-center gap-1.5 border-t border-[color:var(--line)] pt-3">
                        {delId === b.id ? (
                          <>
                            <span className="flex-1 text-[12px] text-[color:var(--t3)]">Ștergi definitiv?</span>
                            <button onClick={() => handleDelete(b.id)} className="h-8 cursor-pointer rounded-lg bg-red-600 px-3 text-[12px] font-semibold text-[color:var(--t1)] hover:bg-red-500">Șterge</button>
                            <button onClick={() => setDelId(null)} className="h-8 cursor-pointer rounded-lg px-3 text-[12px] font-semibold text-[color:var(--t3)] hover:bg-[color:var(--fill2)] hover:text-[color:var(--t1)]">Anulează</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => openShareModal(b)} title="Generează link de vânzare" className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-medium text-[color:var(--t3)] transition-colors hover:bg-[#FF7A1A]/10 hover:text-[color:var(--orange-t)]">
                              <Icon name="share" className="h-4 w-4" /> Share
                            </button>
                            <button onClick={() => handleDownload(b)} disabled={isDl} title="Descarcă" className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-medium text-[color:var(--t3)] transition-colors hover:bg-[color:var(--fill2)] hover:text-[color:var(--t1)] disabled:text-[color:var(--cyan-t)]">
                              <Icon name="download" className="h-4 w-4" />
                              {isDl && downloadStatus ? `${Math.round(downloadStatus.percent)}%` : "Descarcă"}
                            </button>
                            <button onClick={() => setDelId(b.id)} aria-label="Șterge" className="ml-auto flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[color:var(--t4)] transition-colors hover:bg-red-500/10 hover:text-[color:var(--red-t)]">
                              <Icon name="trash" className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {banks.length > 0 && (
              <div className="flex items-center justify-between border-t border-[color:var(--line)] pt-4 text-[13px]">
                <span className="text-[color:var(--t4)]">Pagina {page}</span>
                <div className="flex gap-2">
                  <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="h-9 cursor-pointer rounded-lg border border-[color:var(--line2)] bg-[color:var(--panel)] px-4 text-[color:var(--t1)] transition hover:bg-[color:var(--fill2)] disabled:opacity-30">← Înapoi</button>
                  <button disabled={banks.length < lim} onClick={() => setPage((p) => p + 1)} className="h-9 cursor-pointer rounded-lg border border-[color:var(--line2)] bg-[color:var(--panel)] px-4 text-[color:var(--t1)] transition hover:bg-[color:var(--fill2)] disabled:opacity-30">Înainte →</button>
                </div>
              </div>
            )}
          </main>
        </div>
      )}

      {/* mobile drawer */}
      <div className={`fixed inset-0 z-[70] lg:hidden ${drawer ? "" : "pointer-events-none"}`} aria-hidden={!drawer}>
        <div onClick={() => setDrawer(false)} className={`absolute inset-0 bg-[color:var(--scrim)] backdrop-blur-sm transition-opacity duration-300 ${drawer ? "opacity-100" : "opacity-0"}`} />
        <aside
          role="dialog"
          aria-label="Menu"
          className={`absolute inset-y-0 left-0 w-[86%] max-w-[330px] border-r border-[color:var(--line2)] bg-[color:var(--panel)] cw-sh-drawer transition-transform duration-300 ease-out ${drawer ? "translate-x-0" : "-translate-x-full"}`}
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          {renderSidebar(true)}
        </aside>
      </div>

      {/* mobile floating upload */}
      {!error && (
        <button
          onClick={() => fileRef.current?.click()}
          disabled={full || uploading}
          aria-label="Upload files"
          className="fixed right-4 z-[60] flex h-14 w-14 cursor-pointer items-center justify-center rounded-2xl text-black shadow-[0_12px_30px_rgba(255,122,26,0.45)] transition active:scale-95 disabled:opacity-30 lg:hidden"
          style={{ background: ACCENT, bottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          <Icon name="plus" className="h-6 w-6" />
        </button>
      )}

      {/* floating transfer panel */}
      {(uploadStatus || downloadStatus) && (
        <div className="fixed inset-x-3 bottom-24 z-[75] space-y-2 sm:left-auto sm:right-6 sm:w-96 lg:bottom-6">
          {uploadStatus && <TransferCard kind="up" s={uploadStatus} />}
          {downloadStatus && <TransferCard kind="down" s={downloadStatus} />}
        </div>
      )}

      {/* toast */}
      {toast && (
        <div role="status" className="fixed left-1/2 top-24 z-[90] w-[calc(100%-2rem)] max-w-md -translate-x-1/2">
          <div className={`flex items-start gap-2.5 whitespace-pre-line rounded-xl border px-4 py-3 text-[13px] shadow-2xl backdrop-blur-xl ${toast.kind === "ok" ? "border-emerald-500/30 bg-[color:var(--ok-bg)] text-[color:var(--ok-t)]" : "border-red-500/30 bg-[color:var(--err-bg)] text-[color:var(--err-t)]"}`}>
            <span className="mt-0.5 shrink-0"><Icon name={toast.kind === "ok" ? "check" : "close"} className="h-4 w-4" /></span>
            <span className="min-w-0 flex-1">{toast.msg}</span>
            <button onClick={() => setToast(null)} className="shrink-0 cursor-pointer opacity-60 hover:opacity-100" aria-label="Închide"><Icon name="close" className="h-4 w-4" /></button>
          </div>
        </div>
      )}

      {/* history modal */}
      {showDownloadHistory && (
        <Modal eyebrow="Activitate" title="Istoric descărcări" onClose={() => setShowDownloadHistory(false)} wide>
          {downloadHistoryLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-[color:var(--fill)]" />)}
            </div>
          ) : downloadHistoryError ? (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-[13px] text-[color:var(--red-t)]">{downloadHistoryError}</p>
          ) : downloadHistory.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-[14px] font-semibold text-[color:var(--t1)]">Nicio descărcare încă</p>
              <p className="mt-1 text-[13px] text-[color:var(--t4)]">Când cineva descarcă un pachet partajat, apare aici.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {downloadHistory.map((row) => {
                const dt = new Date(row.downloaded_at);
                return (
                  <li key={row.id} className="flex items-center justify-between gap-3 rounded-xl border border-[color:var(--line)] bg-[color:var(--fill0)] p-3">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-[color:var(--t1)]" title={row.bank_name}>{row.bank_name}</p>
                      <p className="mt-0.5 text-[11px] font-medium text-[color:var(--cyan-t)]">{row.bank_type || "Nespecificat"}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[12px] font-medium text-[color:var(--t2)]">{dt.toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" })}</p>
                      <p className="font-mono text-[11px] text-[color:var(--t4)]">{dt.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Modal>
      )}

      {/* share modal */}
      {shareBank && (
        <Modal eyebrow="Link de vânzare" title={shareBank.name} onClose={closeShareModal}>
          {!shareResultUrl ? (
            <form onSubmit={generateShareLink} className="space-y-3">
              <p className="text-[13px] leading-relaxed text-[color:var(--t3)]">
                Alege un cod pe care îl trimiți separat cumpărătorului (WhatsApp, chat etc.). Linkul funcționează o singură dată și expiră în 15 zile.
              </p>
              <input
                type="text"
                value={shareCode}
                onChange={(e) => setShareCode(e.target.value)}
                placeholder="Codul tău (minim 4 caractere)"
                autoFocus
                className="h-11 w-full rounded-xl border border-[color:var(--line2)] bg-[color:var(--input)] px-3.5 text-[13px] text-[color:var(--t1)] outline-none placeholder:text-[color:var(--t5)] focus:border-[#FF7A1A]/60"
              />
              {shareError && <p className="text-[12px] text-[color:var(--red-t)]">{shareError}</p>}
              <button type="submit" disabled={shareLoading} className="h-11 w-full cursor-pointer rounded-xl text-[13px] font-bold text-black disabled:opacity-40" style={{ background: ACCENT }}>
                {shareLoading ? "Se generează…" : "Generează link"}
              </button>
            </form>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="mb-1.5 text-[12px] text-[color:var(--t4)]">Link (trimite-l cumpărătorului)</p>
                <div className="flex gap-2">
                  <input readOnly value={shareResultUrl} className="h-10 min-w-0 flex-1 rounded-xl border border-[color:var(--line2)] bg-[color:var(--input)] px-3 font-mono text-[11px] text-[color:var(--t2)]" />
                  <button onClick={copyShareUrl} className="h-10 shrink-0 cursor-pointer rounded-xl bg-[color:var(--t1)] px-4 text-[12px] font-bold text-[color:var(--panel)]">{shareCopied ? "Copiat" : "Copiază"}</button>
                </div>
                {shareError && <p className="mt-2 text-[12px] text-[color:var(--red-t)]">{shareError}</p>}
              </div>
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[12px] text-[color:var(--amber-t)]">
                Codul <strong className="text-[color:var(--t1)]">{shareCode}</strong> nu se mai afișează după ce închizi fereastra — trimite-l acum cumpărătorului, separat de link.
              </div>
              <p className="text-[11px] text-[color:var(--t4)]">Expiră pe {shareResultExpires} sau după prima descărcare.</p>
            </div>
          )}
        </Modal>
      )}

      {/* AI modal */}
      {showMarketAnalysis && (
        <Modal eyebrow="iMIDI e-Market" title="Analiza pieței by AI Smith" onClose={() => setShowMarketAnalysis(false)} wide>
          {marketAnalysisLoading ? (
            <div className="flex flex-col items-center gap-3 py-16 text-[13px] text-[color:var(--t3)]">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-[color:var(--line2)] border-t-violet-400" />
              <p className="animate-pulse">Se generează analiza…</p>
            </div>
          ) : marketAnalysisError ? (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-[13px] text-[color:var(--red-t)]">{marketAnalysisError}</p>
          ) : marketStats ? (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { l: "Anunțuri active", v: marketStats.totalListings, c: "text-[color:var(--t1)]" },
                  { l: "Vizualizări totale", v: marketStats.totalViews, c: "text-[color:var(--t1)]" },
                  { l: "Preț mediu", v: `${marketStats.avgPriceOverall} €`, c: "text-[color:var(--violet-t)]" },
                  { l: "Noi (7 zile)", v: `+${marketStats.newThisWeek}`, c: "text-[color:var(--emerald-t)]" },
                ].map((s) => (
                  <div key={s.l} className="rounded-xl border border-[color:var(--line)] bg-[color:var(--fill0)] p-3.5">
                    <p className="text-[11px] text-[color:var(--t4)]">{s.l}</p>
                    <p className={`mt-1 text-2xl font-bold ${s.c}`}>{s.v}</p>
                  </div>
                ))}
              </div>

              {marketStats.expiringSoon > 0 && (
                <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[12px] text-[color:var(--amber-t)]">
                  {marketStats.expiringSoon} anunțuri expiră în următoarele 3 zile.
                </p>
              )}

              {marketStats.categoryBreakdown?.length > 0 && (
                <div className="space-y-3.5 rounded-xl border border-[color:var(--line)] bg-[color:var(--fill0)] p-4">
                  <p className="text-[12px] font-semibold text-[color:var(--t3)]">Distribuție pe categorii</p>
                  {marketStats.categoryBreakdown.map((c: any, i: number) => {
                    const maxCount = Math.max(...marketStats.categoryBreakdown.map((x: any) => x.total_listings));
                    const colors = ["#FF5CA1", "#8B5CF6", "#0070F3", "#10b981"];
                    const col = colors[i % colors.length];
                    return (
                      <div key={c.category}>
                        <div className="mb-1.5 flex justify-between gap-3 text-[12px]">
                          <span className="font-semibold capitalize text-[color:var(--t1)]">{c.category}</span>
                          <span className="text-right text-[color:var(--t4)]">{c.total_listings} anunțuri · {c.avg_price}€ medie · {c.avg_views} views</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-[color:var(--fill2)]">
                          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(c.total_listings / maxCount) * 100}%`, background: col }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {marketStats.topCountries?.length > 0 && (
                <div>
                  <p className="mb-2 text-[12px] font-semibold text-[color:var(--t3)]">Top țări active</p>
                  <div className="flex flex-wrap gap-2">
                    {marketStats.topCountries.map((c: any) => (
                      <span key={c.country} className="flex items-center gap-1.5 rounded-lg border border-[color:var(--line2)] bg-[color:var(--fill)] px-3 py-1.5 text-[12px] font-medium text-[color:var(--t1)]">
                        <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                        {c.country} <span className="text-[color:var(--t4)]">({c.count})</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="relative overflow-hidden rounded-xl border border-violet-500/25 bg-violet-500/[0.06] p-4 pl-5">
                <span className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-[#FF5CA1] to-[#8B5CF6]" />
                <p className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-[color:var(--violet-t)]"><Icon name="spark" className="h-3.5 w-3.5" /> Rezumat generat de AI</p>
                <p className="text-[14px] leading-relaxed text-[color:var(--t2)]">{marketAnalysisText}</p>
              </div>
            </div>
          ) : null}
        </Modal>
      )}

      {userError && <div className="px-6 pb-2 text-xs text-[color:var(--t1)]">{userError}</div>}
      {facebookId && <MetaMess facebookUserId={facebookId} />}

     
    </div>
  );
}