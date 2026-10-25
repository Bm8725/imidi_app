// app/sd-write/page.tsx  ·  seller link + code  ->  /api/cloud/redeem  ->  written straight to an SD card
// Needs:  npm i hash-wasm
'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const SESSION_MS = 30 * 60 * 1000;
const MIN_CODE = 4;
const MAX_RETRIES = 8;
const SETTINGS_FILE = "SETTINGS.JST";

type Session = { url: string; filename: string; expiresAt: number };
type Preview = { seller: string; filename: string };
type Failure = Error & { kind?: "redeem" | "expired" | "card" };

const fail = (message: string, kind: Failure["kind"]): Failure => Object.assign(new Error(message), { kind });

async function previewLink(token: string, signal?: AbortSignal): Promise<Preview> {
  const res = await fetch(`/api/cloud/redeem?token=${encodeURIComponent(token)}`, { signal });
  const data = await res.json().catch(() => ({}));
  if (res.status === 404 || res.status === 410) throw new Error(data?.error || "This link is not valid or has expired.");
  return { seller: data?.seller_name || "iMIDI seller", filename: data?.filename || "Digital content package" };
}

async function redeem(token: string, code: string): Promise<Session> {
  const res = await fetch("/api/cloud/redeem", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, code }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw fail(data?.error || "Access code rejected.", "redeem");
  if (!data?.url || !data?.filename) throw fail("The server did not return a file.", "redeem");
  return { url: data.url, filename: data.filename, expiresAt: Date.now() + SESSION_MS };
}

const sessionKey = (t: string) => `imidi_sd_session_${t}`;
function loadSession(token: string): Session | null {
  try {
    const raw = sessionStorage.getItem(sessionKey(token));
    if (!raw) return null;
    const s: Session = JSON.parse(raw);
    if (!s.expiresAt || s.expiresAt < Date.now()) {
      sessionStorage.removeItem(sessionKey(token));
      return null;
    }
    return s;
  } catch {
    return null;
  }
}
const saveSession = (t: string, s: Session) => {
  try {
    sessionStorage.setItem(sessionKey(t), JSON.stringify(s));
  } catch {}
};
const clearSession = (t: string) => {
  try {
    sessionStorage.removeItem(sessionKey(t));
  } catch {}
};

const fmtBytes = (n: number) => (n >= 1e9 ? `${(n / 1e9).toFixed(2)} GB` : n >= 1e6 ? `${(n / 1e6).toFixed(0)} MB` : `${(n / 1e3).toFixed(0)} KB`);
const fmtEta = (s: number) => (!isFinite(s) || s <= 0 ? "" : s > 3600 ? `${Math.round(s / 3600)} h` : s > 60 ? `${Math.round(s / 60)} min` : `${Math.round(s)} s`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const backoff = (n: number) => Math.min(1000 * 2 ** n, 20000) + Math.random() * 400;
const waitOnline = () =>
  navigator.onLine
    ? Promise.resolve()
    : new Promise<void>((res) => {
        const h = () => {
          window.removeEventListener("online", h);
          res();
        };
        window.addEventListener("online", h);
      });

function parseToken(input: string): string {
  const s = input.trim();
  if (!s) return "";
  const m = s.match(/\/download\/([A-Za-z0-9_-]{3,})/);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{3,}$/.test(s) ? s : "";
}

function linkHostOk(input: string): boolean {
  try {
    const h = new URL(input.trim()).hostname;
    return h === window.location.hostname || h === "imidi.co.uk" || h.endsWith(".imidi.co.uk");
  } catch {
    return true;
  }
}

async function probeSize(url: string): Promise<number> {
  try {
    const r = await fetch(url, { method: "HEAD" });
    const n = Number(r.headers.get("content-length"));
    if (r.ok && n > 0) return n;
  } catch {}
  try {
    const r = await fetch(url, { headers: { Range: "bytes=0-0" } });
    const m = r.headers.get("content-range")?.match(/\/(\d+)$/);
    r.body?.cancel().catch(() => {});
    if (m) return Number(m[1]);
  } catch {}
  return 0;
}

async function newHasher() {
  const { createSHA256 } = await import("hash-wasm");
  const h = await createSHA256();
  h.init();
  return h;
}

async function hashCardFile(dir: any, name: string, signal: AbortSignal, onBytes?: (n: number) => void) {
  const file: File = await (await dir.getFileHandle(name)).getFile();
  const hasher = await newHasher();
  const r = file.stream().getReader();
  for (;;) {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    const { done, value } = await r.read();
    if (done) break;
    hasher.update(value);
    onBytes?.(value.byteLength);
  }
  return { hash: hasher.digest("hex") as string, size: file.size };
}

async function listNames(dir: any): Promise<string[]> {
  const out: string[] = [];
  for await (const e of dir.values()) out.push(e.name);
  return out;
}

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5CA1] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E0F13]";
const PRIMARY = `h-12 rounded-xl bg-gradient-to-r from-[#FF5CA1] to-[#FF8A3D] px-7 text-sm font-semibold text-white shadow-[0_10px_30px_-12px_rgba(255,92,161,.7)] transition-transform enabled:hover:scale-[1.02] enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS}`;
const GHOST = `h-11 rounded-xl border border-white/15 px-5 text-sm font-semibold text-white transition-colors enabled:hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS}`;
const FIELD = "h-12 w-full rounded-xl border bg-[#0B0C10] px-4 text-sm text-white outline-none transition-colors placeholder:text-[#6A6A73] focus:border-[#FF5CA1]/60";

type Phase = "idle" | "ready" | "writing" | "done" | "error";
type FileState = "waiting" | "writing" | "checking" | "ok";

let memSettings: Blob | null = null;

function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: () => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40 ${on ? "bg-[#FF5CA1]" : "bg-white/15"} ${FOCUS}`}
    >
      <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform motion-reduce:transition-none ${on ? "translate-x-5" : ""}`} />
    </button>
  );
}

function StepCard({
  n,
  title,
  hint,
  state,
  last = false,
  children,
}: {
  n: number;
  title: string;
  hint?: string;
  state: "locked" | "active" | "done";
  last?: boolean;
  children?: React.ReactNode;
}) {
  const done = state === "done";
  const locked = state === "locked";
  return (
    <section aria-label={title} aria-disabled={locked} className="relative flex gap-4 sm:gap-5">
      <div className="flex flex-col items-center">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${
            done
              ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
              : locked
              ? "border-white/10 text-[#6A6A73]"
              : "border-[#FF5CA1] bg-[#FF5CA1]/10 text-[#FF8FBF]"
          }`}
        >
          {done ? "✓" : n}
        </span>
        {!last && <span className={`mt-2 w-px flex-1 ${done ? "bg-emerald-400/30" : "bg-white/10"}`} />}
      </div>
      <div
        className={`min-w-0 flex-1 rounded-2xl border bg-[#15171C] p-5 transition-opacity sm:p-6 ${last ? "" : "mb-5"} ${
          locked ? "pointer-events-none border-white/[0.05] opacity-50" : "border-white/[0.08]"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="aw-display text-lg font-semibold text-white">{title}</h2>
          <span
            className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
              done ? "bg-emerald-400/10 text-emerald-300" : locked ? "bg-white/[0.05] text-[#7A7A85]" : "bg-[#FF5CA1]/10 text-[#FF8FBF]"
            }`}
          >
            {done ? "Completed" : locked ? "Locked" : "In progress"}
          </span>
        </div>
        {hint && <p className="mt-1 text-[13px] leading-relaxed text-[#9A9AA5]">{hint}</p>}
        {children}
      </div>
    </section>
  );
}

export default function SdWritePage() {
  const [linkInput, setLinkInput] = useState("");
  const [code, setCode] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [formError, setFormError] = useState("");
  const [minutesLeft, setMinutesLeft] = useState<number | null>(null);

  const [formatted, setFormatted] = useState(false);
  const [cardName, setCardName] = useState("");
  const [oldFiles, setOldFiles] = useState<string[]>([]);
  const [hasSettings, setHasSettings] = useState(false);
  const [opt, setOpt] = useState({ verify: true, settings: true, wake: true, deleteOld: false });

  const [supported, setSupported] = useState(true);
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState("");
  const [fileState, setFileState] = useState<FileState>("waiting");
  const [fileName, setFileName] = useState("");
  const [progress, setProgress] = useState({ done: 0, total: 0, speed: 0 });
  const [stepText, setStepText] = useState("");

  const dirRef = useRef<any>(null);
  const abortRef = useRef<AbortController | null>(null);
  const doneRef = useRef(0);
  const t0Ref = useRef(0);
  const partialRef = useRef<{ name: string; size: number } | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  const token = useMemo(() => parseToken(linkInput), [linkInput]);
  const hostBad = linkInput.trim().length > 0 && !linkHostOk(linkInput);
  const writing = phase === "writing";
  const hasSession = !!token && typeof window !== "undefined" && !!loadSession(token);
  const cardReady = !!cardName && formatted;
  const canWrite = confirmed && cardReady && (phase === "ready" || phase === "error");

  useEffect(() => {
    setSupported("showDirectoryPicker" in window && window.isSecureContext);
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    setPreview(null);
    setPreviewError("");
    if (!token || hostBad) return;
    const ac = new AbortController();
    setPreviewing(true);
    const id = setTimeout(async () => {
      try {
        setPreview(await previewLink(token, ac.signal));
      } catch (e: any) {
        if (e?.name !== "AbortError") setPreviewError(e?.message ?? "Could not look this link up.");
      } finally {
        if (!ac.signal.aborted) setPreviewing(false);
      }
    }, 450);
    return () => {
      clearTimeout(id);
      ac.abort();
      setPreviewing(false);
    };
  }, [token, hostBad]);

  useEffect(() => {
    const tick = () => {
      const s = token ? loadSession(token) : null;
      setMinutesLeft(s ? Math.max(1, Math.ceil((s.expiresAt - Date.now()) / 60000)) : null);
    };
    tick();
    const id = setInterval(tick, 20000);
    return () => clearInterval(id);
  }, [token, phase, confirmed]);

  useEffect(() => {
    if (!writing) return;
    const id = setInterval(() => {
      const el = (performance.now() - t0Ref.current) / 1000;
      setProgress((p) => ({ ...p, done: doneRef.current, speed: el > 0 ? doneRef.current / el : 0 }));
    }, 250);
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      clearInterval(id);
      window.removeEventListener("beforeunload", warn);
    };
  }, [writing]);

  const goContinue = (e?: React.FormEvent) => {
    e?.preventDefault();
    setFormError("");
    if (!token) return setFormError("Paste the full link from the seller (it contains /download/…).");
    if (hostBad) return setFormError("This doesn't look like an iMIDI link.");
    if (previewError) return setFormError(previewError);
    if (!hasSession && code.trim().length < MIN_CODE) return setFormError(`The code has at least ${MIN_CODE} characters.`);
    setConfirmed(true);
  };

  const changePackage = () => {
    setConfirmed(false);
    setPhase("idle");
    setMessage("");
    setFileState("waiting");
    partialRef.current = null;
  };

  const pickCard = async () => {
    setMessage("");
    try {
      const dir = await (window as any).showDirectoryPicker({ id: "imidi-sd", mode: "readwrite" });
      const probe = await dir.getFileHandle(".imidi-probe", { create: true });
      const w = await probe.createWritable();
      await w.write(new Uint8Array([1]));
      await w.close();
      await dir.removeEntry(".imidi-probe");

      const names = await listNames(dir);
      dirRef.current = dir;
      partialRef.current = null;
      setCardName(dir.name);
      setOldFiles(names.filter((n) => n.toLowerCase().endsWith(".jbb")));
      setHasSettings(names.some((n) => n.toUpperCase() === SETTINGS_FILE));
      setFileState("waiting");
      setPhase("ready");
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      dirRef.current = null;
      setCardName("");
      setPhase("idle");
      setMessage("This browser or system doesn't allow writing to the card root. Try the latest Chrome or Edge on a computer, or another USB card reader.");
    }
  };

  const write = async () => {
    const dir = dirRef.current;
    if (!dir || !token) return;

    const resumeName = partialRef.current?.name;
    const toDelete = oldFiles.filter((n) => n !== resumeName);
    if (toDelete.length && !opt.deleteOld) {
      setMessage("This card already has bank files. Format it first (recommended), or turn on “Delete old bank files” in the options.");
      return;
    }

    const ac = new AbortController();
    abortRef.current = ac;
    setMessage("");
    setPhase("writing");
    setStepText("Unlocking the link");

    let wake: any = null;
    let name = "";
    try {
      let session = loadSession(token);
      if (!session) {
        try {
          session = await redeem(token, code.trim());
        } catch (e: any) {
          if (e?.kind === "redeem") {
            setConfirmed(false);
            setPhase("idle");
            setFormError(e.message);
            topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            return;
          }
          throw e;
        }
        saveSession(token, session);
      }
      name = session.filename;
      setFileName(name);

      setStepText("Reading the file size");
      let total = await probeSize(session.url);
      doneRef.current = 0;
      t0Ref.current = performance.now();
      setProgress({ done: 0, total, speed: 0 });
      setFileState("waiting");

      if (opt.wake) {
        try {
          wake = await (navigator as any).wakeLock?.request("screen");
        } catch {}
      }

      let settings: Blob | null = null;
      if (opt.settings) {
        if (hasSettings) {
          setStepText(`Saving ${SETTINGS_FILE}`);
          settings = await (await dir.getFileHandle(SETTINGS_FILE)).getFile();
          memSettings = settings;
        } else settings = memSettings;
      }

      if (toDelete.length) {
        setStepText("Removing old bank files");
        for (const n of toDelete) await dir.removeEntry(n);
      }

      let written = 0;
      const hasher = await newHasher();
      let fh: any;
      try {
        fh = await dir.getFileHandle(name, { create: true });
      } catch {
        throw fail("This file name can't be written on the card.", "card");
      }
      const prev = partialRef.current;
      if (prev && prev.name === name) {
        const existing: File = await fh.getFile();
        if (existing.size === prev.size && existing.size > 0 && (!total || existing.size < total)) {
          setStepText("Continuing from where it stopped");
          const r = existing.stream().getReader();
          for (;;) {
            const { done, value } = await r.read();
            if (done) break;
            hasher.update(value);
          }
          written = existing.size;
        }
      }
      doneRef.current = written;

      setFileState("writing");
      setStepText(`Writing ${name}`);
      let writable = await fh.createWritable({ keepExistingData: written > 0 });
      if (written > 0) await writable.seek(written);

      let attempt = 0;
      for (;;) {
        try {
          const res = await fetch(session.url, { signal: ac.signal, headers: written > 0 ? { Range: `bytes=${written}-` } : undefined });
          if ([400, 401, 403, 404, 410].includes(res.status)) throw fail("The download link has expired. Links last 30 minutes after the code is used. Ask the seller for a new link.", "expired");
          if (!res.ok && res.status !== 206) throw new Error(`Server error ${res.status}`);
          if (written > 0 && res.status !== 206) throw new Error("The server can't continue a download. Try again from the start.");
          if (!total) {
            const cl = Number(res.headers.get("content-length"));
            if (cl > 0) {
              total = written + cl;
              setProgress((p) => ({ ...p, total }));
            }
          }
          if (!res.body) throw new Error("The browser could not stream this download.");

          const reader = res.body.getReader();
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            try {
              await writable.write(value);
            } catch (we: any) {
              throw fail(we?.name === "QuotaExceededError" ? "The card is full or too small for this file." : `Could not write to the card: ${we?.message ?? we}`, "card");
            }
            hasher.update(value);
            written += value.byteLength;
            doneRef.current = written;
          }
          break;
        } catch (e: any) {
          if (e?.name === "AbortError" || e?.kind === "card" || e?.kind === "expired") throw e;
          attempt++;
          if (attempt > MAX_RETRIES) throw e;
          setStepText(`Connection lost, retrying (${attempt}/${MAX_RETRIES})`);
          try {
            await writable.close();
          } catch {}
          await waitOnline();
          await sleep(backoff(attempt));
          writable = await fh.createWritable({ keepExistingData: true });
          await writable.seek(written);
          setStepText(`Writing ${name}`);
        }
      }
      await writable.close();

      if (total && written !== total) throw new Error(`Received ${written} bytes, expected ${total}.`);
      total = written;
      setProgress((p) => ({ ...p, total: written, done: written }));

      if (opt.verify) {
        setFileState("checking");
        setStepText(`Checking ${name}`);
        const back = await hashCardFile(dir, name, ac.signal);
        if (back.size !== written) throw new Error(`Size on the card is ${back.size}, expected ${written}.`);
        if (back.hash !== hasher.digest("hex")) throw new Error("The file on the card differs from the download. Try again or use another card.");
      }
      setFileState("ok");

      if (settings) {
        setStepText(`Restoring ${SETTINGS_FILE}`);
        const w = await (await dir.getFileHandle(SETTINGS_FILE, { create: true })).createWritable();
        await w.write(settings);
        await w.close();
      }

      partialRef.current = null;
      clearSession(token);
      setStepText("");
      setPhase("done");
    } catch (e: any) {
      if (e?.name === "AbortError") {
        setMessage("Cancelled. The unfinished file stays on the card, so “Try again” continues from there.");
      } else if (e?.kind === "expired") {
        clearSession(token);
        partialRef.current = null;
        if (name) {
          try {
            await dir.removeEntry(name);
          } catch {}
        }
        setMessage(e.message);
      } else if (e?.kind === "card") {
        setMessage(e.message);
      } else {
        setMessage(String(e?.message ?? e));
      }
      if (name && e?.kind !== "expired") {
        try {
          const f: File = await (await dir.getFileHandle(name)).getFile();
          if (f.size > 0) partialRef.current = { name, size: f.size };
        } catch {}
      }
      setPhase("error");
    } finally {
      try {
        await wake?.release();
      } catch {}
    }
  };

  const pct = progress.total ? Math.min(100, (progress.done / progress.total) * 100) : 0;
  const eta = progress.speed > 0 && progress.total ? (progress.total - progress.done) / progress.speed : 0;
  const showProgress = writing || phase === "done" || (phase === "error" && progress.total + progress.done > 0);
  const ext = (preview?.filename ?? "").split(".").pop()?.toUpperCase();

  const statusLabel =
    phase === "writing" ? "Writing" : phase === "done" ? "Complete" : phase === "error" ? "Needs attention"
    : !confirmed ? "Waiting for package" : !cardReady ? "Choose a card" : "Ready to write";
  const statusTone =
    phase === "done" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
    : phase === "error" ? "border-red-400/30 bg-red-400/10 text-red-300"
    : writing ? "border-[#FF5CA1]/40 bg-[#FF5CA1]/10 text-[#FF8FBF]"
    : "border-white/10 bg-white/[0.04] text-[#B4B4BC]";
  const checks = [
    { t: "Package confirmed", ok: confirmed },
    { t: "Card selected", ok: !!cardName },
    { t: "Card formatted FAT32", ok: formatted },
    { t: "File written", ok: phase === "done" },
    { t: opt.verify ? "Checked on the card" : "Check turned off", ok: phase === "done" && opt.verify },
  ];

  return (
    <div className="aw-root flex min-h-screen flex-col bg-[#0E0F13] text-[#F2F2F4] selection:bg-[#FF5CA1]/40 selection:text-white">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700&family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        .aw-root { font-family: 'Inter', ui-sans-serif, system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
        .aw-display { font-family: 'Sora', ui-sans-serif, system-ui, sans-serif; }
        .aw-mono { font-family: 'JetBrains Mono', ui-monospace, monospace; font-variant-numeric: tabular-nums; }
        .aw-grid { background-image: linear-gradient(rgba(255,255,255,.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.03) 1px, transparent 1px); background-size: 48px 48px; -webkit-mask-image: linear-gradient(#000, transparent 70%); mask-image: linear-gradient(#000, transparent 70%); }
      `}</style>

      <Navbar />

      <main id="main-content" className="relative flex-1 overflow-x-clip px-4 pb-20 pt-24 sm:px-6">
        <div aria-hidden className="aw-grid pointer-events-none absolute inset-x-0 top-0 h-[520px]" />
        <div aria-hidden className="pointer-events-none absolute -top-24 right-[8%] h-[360px] w-[360px] rounded-full bg-[#FF5CA1]/10 blur-[130px]" />

        <div ref={topRef} className="relative mx-auto w-full max-w-6xl scroll-mt-24">
          <header className="flex flex-wrap items-center justify-between gap-5 rounded-2xl border border-white/[0.08] bg-[#15171C]/90 p-5 backdrop-blur sm:p-6">
            <div className="flex min-w-0 items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/UOTOB.jpg" alt="SD Writer" width={56} height={56} className="h-14 w-14 shrink-0 rounded-xl object-cover ring-1 ring-white/10" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-[#FF5CA1]">iMIDI · SD writer</p>
                <h1 className="aw-display mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Write your package to an SD card</h1>
                <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-[#9A9AA5]">
                  Paste the seller&apos;s link and code, choose the card, press write. The file goes straight to the card and is checked afterwards.
                </p>
              </div>
            </div>
            <span className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold ${statusTone}`} aria-live="polite">
              <span className={`h-2 w-2 rounded-full bg-current ${writing ? "animate-pulse motion-reduce:animate-none" : ""}`} />
              {statusLabel}
            </span>
          </header>

          {!supported && (
            <p role="alert" className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
              Writing to a card needs Chrome or Edge on a computer, over HTTPS. Open this page there. To save the file on your computer instead, open the link itself.
            </p>
          )}

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              {/* 1. PACKAGE */}
              <StepCard n={1} title="Your package" state={confirmed ? "done" : "active"} hint={confirmed ? undefined : "The link and the code come from the seller, usually in two separate messages."}>
                {!confirmed ? (
                  <form onSubmit={goContinue} className="mt-5 space-y-4">
                    <div>
                      <label htmlFor="link" className="text-sm font-medium text-white">Link</label>
                      <input
                        id="link"
                        type="text"
                        inputMode="url"
                        autoComplete="off"
                        spellCheck={false}
                        value={linkInput}
                        onChange={(e) => setLinkInput(e.target.value)}
                        placeholder="https://imidi.co.uk/download/…"
                        className={`mt-1.5 ${FIELD} ${hostBad || previewError ? "border-red-500/50" : "border-white/[0.12]"}`}
                      />
                      <p className="mt-2 min-h-[1.25rem] text-[13px]" aria-live="polite">
                        {linkInput.trim() === "" ? null : hostBad ? (
                          <span className="text-red-300">This doesn&apos;t look like an iMIDI link.</span>
                        ) : !token ? (
                          <span className="text-[#9A9AA5]">Paste the whole link, it contains /download/</span>
                        ) : previewing ? (
                          <span className="text-[#9A9AA5]">Looking up the link…</span>
                        ) : previewError ? (
                          <span className="text-red-300">{previewError}</span>
                        ) : preview ? (
                          <span className="text-emerald-300">
                            Found: <span className="font-semibold">{preview.filename}</span> <span className="text-[#9A9AA5]">by {preview.seller}</span>
                          </span>
                        ) : null}
                      </p>
                    </div>

                    <div>
                      <label htmlFor="code" className="text-sm font-medium text-white">Access code</label>
                      <div className="relative mt-1.5">
                        <input
                          id="code"
                          type={showCode ? "text" : "password"}
                          autoComplete="off"
                          spellCheck={false}
                          value={code}
                          onChange={(e) => setCode(e.target.value)}
                          placeholder={hasSession ? "Link already unlocked in this tab" : "The code from the seller"}
                          className={`${FIELD} border-white/[0.12] pr-20`}
                        />
                        <button type="button" onClick={() => setShowCode((v) => !v)} className={`absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2.5 py-1.5 text-xs font-semibold text-[#9A9AA5] hover:text-white ${FOCUS}`}>
                          {showCode ? "Hide" : "Show"}
                        </button>
                      </div>
                      <p className="mt-1.5 text-xs text-[#8E8E98]">The code is checked when you press Write, and works once.</p>
                    </div>

                    {formError && (
                      <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-sm text-red-200">{formError}</p>
                    )}

                    <button type="submit" disabled={!token || hostBad || previewing || !!previewError} className={PRIMARY}>Continue</button>
                  </form>
                ) : (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-[#0B0C10] p-4">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold text-white">{preview?.filename ?? "Package"}</p>
                      <p className="aw-mono mt-1 text-[11px] text-[#9A9AA5]">
                        {ext && `${ext} file · `}by {preview?.seller ?? "iMIDI seller"}
                        {minutesLeft != null && ` · unlocked, about ${minutesLeft} min left to write`}
                      </p>
                    </div>
                    {!writing && (
                      <button type="button" onClick={changePackage} className={`rounded-md px-1 text-xs font-semibold text-[#9A9AA5] underline-offset-2 hover:text-white hover:underline ${FOCUS}`}>
                        Change
                      </button>
                    )}
                  </div>
                )}
              </StepCard>

              {/* 2. CARD */}
              <StepCard n={2} title="Your card" state={!confirmed ? "locked" : cardReady ? "done" : "active"} hint="Plug in the SD card and choose it.">
                <label className="mt-5 flex cursor-pointer items-start gap-3">
                  <input type="checkbox" checked={formatted} onChange={(e) => setFormatted(e.target.checked)} disabled={writing || !confirmed} className="mt-1 h-4 w-4 accent-[#FF5CA1]" />
                  <span className="text-sm leading-relaxed text-[#D4D4D9]">
                    <span className="font-semibold text-white">The card is formatted as FAT32 and empty.</span>{" "}
                    <span className="text-[#9A9AA5]">Browsers can&apos;t format cards. For 64 GB and larger use the &quot;Large FAT32&quot; method (for example Rufus on Windows).</span>
                  </span>
                </label>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button type="button" onClick={pickCard} disabled={writing || !supported || !confirmed} className={GHOST}>
                    {cardName ? "Choose another card" : "Choose SD card"}
                  </button>
                  {cardName && (
                    <span className="text-sm text-[#B4B4BC]">
                      Card: <span className="font-semibold text-white">{cardName}</span>
                    </span>
                  )}
                </div>

                {cardName && hasSettings && opt.settings && <p className="mt-3 text-[13px] text-[#9A9AA5]">{SETTINGS_FILE} found: it will be kept and put back after writing.</p>}
                {oldFiles.length > 0 && (
                  <p className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/[0.07] p-3 text-[13px] text-amber-100">
                    {oldFiles.length} old bank file{oldFiles.length > 1 ? "s" : ""} on the card ({oldFiles.join(", ")}). Format the card for the most reliable result, or turn on “Delete old bank files” below.
                  </p>
                )}

                <details className="group mt-5 border-t border-white/[0.07] pt-4">
                  <summary className={`flex cursor-pointer list-none items-center justify-between rounded text-sm font-semibold text-[#D4D4D9] hover:text-white ${FOCUS}`}>
                    Options
                    <span aria-hidden className="text-[#8E8E98] transition-transform group-open:rotate-180">⌄</span>
                  </summary>
                  <ul className="mt-4 space-y-4">
                    {[
                      { k: "verify" as const, t: "Check the file after writing", d: "Reads it back from the card and compares it. Slower, much safer." },
                      { k: "settings" as const, t: `Keep ${SETTINGS_FILE}`, d: "Saves your settings file before writing and puts it back at the end." },
                      { k: "wake" as const, t: "Keep the screen awake", d: "Stops the computer from sleeping while a long write is running." },
                      { k: "deleteOld" as const, t: "Delete old bank files", d: "Removes .JBB files already on the card. Formatting is more reliable." },
                    ].map((o) => (
                      <li key={o.k} className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium text-white">{o.t}</p>
                          <p className="mt-0.5 text-[13px] leading-relaxed text-[#9A9AA5]">{o.d}</p>
                        </div>
                        <Switch on={opt[o.k]} label={o.t} disabled={writing} onChange={() => setOpt((s) => ({ ...s, [o.k]: !s[o.k] }))} />
                      </li>
                    ))}
                  </ul>
                </details>
              </StepCard>

              {/* 3. WRITE */}
              <StepCard
                n={3}
                title="Write"
                last
                state={!cardReady ? "locked" : phase === "done" ? "done" : "active"}
                hint={writing ? undefined : "Don't use the computer for anything else, and don't unplug the card, until it says Done."}
              >
                {showProgress && (
                  <div className="mt-5 space-y-4">
                    <div>
                      <div className="mb-1.5 flex items-center justify-between gap-3 text-xs text-[#9A9AA5]">
                        <span aria-live="polite">{phase === "done" ? "File written" + (opt.verify ? " and checked" : "") : stepText}</span>
                        <span className="aw-mono">
                          {fmtBytes(progress.done)}
                          {progress.total > 0 && ` / ${fmtBytes(progress.total)}`}
                          {writing && progress.speed > 0 && ` · ${fmtBytes(progress.speed)}/s${eta ? ` · ${fmtEta(eta)}` : ""}`}
                        </span>
                      </div>
                      <div
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={progress.total ? Math.round(phase === "done" ? 100 : pct) : undefined}
                        className="h-2.5 overflow-hidden rounded-full bg-white/10"
                      >
                        <div
                          className={`h-full rounded-full bg-gradient-to-r from-[#FF5CA1] to-[#FF8A3D] transition-[width] duration-200 ${progress.total ? "" : "w-1/3 animate-pulse motion-reduce:animate-none"}`}
                          style={progress.total ? { width: `${phase === "done" ? 100 : pct}%` } : undefined}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-[#0B0C10] px-4 py-2.5">
                      <span className="aw-mono truncate text-[13px]">{fileName}</span>
                      <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${fileState === "ok" ? "bg-emerald-500/15 text-emerald-300" : fileState === "waiting" ? "bg-white/[0.06] text-[#9A9AA5]" : "bg-[#FF5CA1]/15 text-[#FF8FBF]"}`}>
                        {fileState === "ok" ? (opt.verify ? "checked" : "written") : fileState}
                      </span>
                    </div>
                  </div>
                )}

                {phase === "done" && (
                  <p className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
                    Done. Eject the card from your computer the usual way (safely remove), then put it in the sampler.
                  </p>
                )}
                {message && (
                  <p role="alert" className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{message}</p>
                )}

                <div className="mt-5 flex flex-wrap gap-3">
                  {!writing && phase !== "done" && (
                    <button type="button" onClick={write} disabled={!canWrite} className={PRIMARY}>
                      {phase === "error" ? "Try again" : "Write to card"}
                    </button>
                  )}
                  {writing && (
                    <button type="button" onClick={() => abortRef.current?.abort()} className={GHOST}>Cancel</button>
                  )}
                  {phase === "done" && (
                    <button
                      type="button"
                      onClick={() => {
                        setPhase("idle");
                        setCardName("");
                        dirRef.current = null;
                        setFormatted(false);
                        setFileState("waiting");
                        setProgress({ done: 0, total: 0, speed: 0 });
                      }}
                      className={GHOST}
                    >
                      Write to another card
                    </button>
                  )}
                </div>
              </StepCard>
            </div>

            {/* SUMMARY RAIL */}
            <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
              <section className="rounded-2xl border border-white/[0.08] bg-[#15171C] p-5" aria-label="Summary">
                <h2 className="aw-display text-sm font-semibold text-white">Summary</h2>
                <dl className="mt-4 space-y-3 text-[13px]">
                  {[
                    { k: "Package", v: confirmed ? preview?.filename ?? "—" : "—" },
                    { k: "Seller", v: confirmed ? preview?.seller ?? "—" : "—" },
                    { k: "Card", v: cardName || "—" },
                    { k: "Size", v: progress.total ? fmtBytes(progress.total) : "—", mono: true },
                    { k: "Link time left", v: minutesLeft != null ? `${minutesLeft} min` : "—", mono: true },
                  ].map((r) => (
                    <div key={r.k} className="flex items-center justify-between gap-3">
                      <dt className="text-[#8E8E98]">{r.k}</dt>
                      <dd className={`max-w-[60%] truncate font-medium text-white ${r.mono ? "aw-mono" : ""}`}>{r.v}</dd>
                    </div>
                  ))}
                </dl>
                <ul className="mt-5 space-y-2.5 border-t border-white/[0.07] pt-4">
                  {checks.map((c) => (
                    <li key={c.t} className="flex items-center gap-2.5 text-[13px]">
                      <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${c.ok ? "bg-emerald-400/20 text-emerald-300" : "bg-white/[0.06] text-transparent"}`}>✓</span>
                      <span className={c.ok ? "text-white" : "text-[#8E8E98]"}>{c.t}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <details className="rounded-2xl border border-white/[0.08] bg-[#15171C] p-5 text-sm text-[#9A9AA5]">
                <summary className={`cursor-pointer rounded font-medium text-[#D4D4D9] hover:text-white ${FOCUS}`}>Link not working, or can&apos;t choose the card?</summary>
                <div className="mt-3 space-y-3 leading-relaxed">
                  <p>
                    A code works once. After it is used, the link stays open for 30 minutes in this tab, so a failed write can be retried. Check you pasted the whole link and the exact code, and ask the seller for a new link if needed.
                  </p>
                  <p>Some systems block selecting the root of a drive. Use the latest Chrome or Edge on a computer, try another USB card reader, and pick the card itself, not a folder inside it.</p>
                </div>
              </details>
            </aside>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}