// app/sd-write/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

/* ════════════════════════════════════════════════════════════════
   Server connection (relative URLs)
   ════════════════════════════════════════════════════════════════ */
const MB = 1024 * 1024;

type Pkg = {
  token: string;
  code: string;
  name: string;
  type: string;
  size: number;
  parts: { name: string; size: number }[];
  expires?: string;
};

type Part = {
  name: string;
  url: string;
  size: number;
  sha256?: string;
};

async function checkLink(token: string, code: string): Promise<Pkg> {
  const res = await fetch(`/api/download/${encodeURIComponent(token)}/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Link or code invalid (${res.status})`);
  }

  const data = await res.json();
  return {
    token,
    code,
    name: data.name,
    type: data.type ?? "Sound bank",
    size: data.size,
    parts: data.parts,
    expires: data.expires,
  };
}

async function getManifest(pkg: Pkg): Promise<Part[]> {
  const res = await fetch(`/api/download/${encodeURIComponent(pkg.token)}/manifest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: pkg.code }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Could not get download links (${res.status})`);
  }

  const data = await res.json();
  return data.parts; // [{ name, url, size, sha256? }, ...]
}

async function reportDone(pkg: Pkg): Promise<void> {
  await fetch(`/api/download/${encodeURIComponent(pkg.token)}/done`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: pkg.code }),
  });
}

let memSettings: Blob | null = null;
const SETTINGS_FILE = "SETTINGS.JST";
const MIN_CODE = 4;

/* ════════════════════════════════════════════════════════════════
   helpers
   ════════════════════════════════════════════════════════════════ */
const fmtBytes = (n: number) =>
  n >= 1e9 ? `${(n / 1e9).toFixed(2)} GB` : n >= 1e6 ? `${(n / 1e6).toFixed(0)} MB` : `${(n / 1e3).toFixed(0)} KB`;

const fmtEta = (s: number) =>
  !isFinite(s) || s <= 0 ? "" : s > 3600 ? `${Math.round(s / 3600)} h` : s > 60 ? `${Math.round(s / 60)} min` : `${Math.round(s)} s`;

function parseToken(input: string): string {
  const s = input.trim();
  if (!s) return "";
  const m = s.match(/\/download\/([A-Za-z0-9_-]{3,})/);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{3,}$/.test(s) ? s : "";
}

function linkHostOk(input: string): boolean {
  const s = input.trim();
  if (!s) return true;
  try {
    const u = new URL(s, typeof window !== "undefined" ? window.location.origin : "https://imidi.co.uk");
    const h = u.hostname;
    return (
      h === (typeof window !== "undefined" ? window.location.hostname : "imidi.co.uk") ||
      h === "imidi.co.uk" ||
      h.endsWith(".imidi.co.uk")
    );
  } catch {
    return true;
  }
}

async function openPart(p: Part, signal: AbortSignal) {
  const res = await fetch(p.url, { signal });
  if (!res.ok || !res.body) throw new Error(`Download failed (${res.status})`);
  return res.body;
}

async function newHasher() {
  const { createSHA256 } = await import("hash-wasm");
  const h = await createSHA256();
  h.init();
  return h;
}

async function listNames(dir: any): Promise<string[]> {
  const out: string[] = [];
  for await (const e of dir.values()) out.push(e.name);
  return out;
}

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5CA1] focus-visible:ring-offset-2 focus-visible:ring-offset-[#131316]";

type Phase = "idle" | "ready" | "writing" | "done" | "error";
type PartState = "waiting" | "writing" | "checking" | "ok";

function Switch({
  on,
  onChange,
  label,
  disabled,
}: {
  on: boolean;
  onChange: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40 ${
        on ? "bg-[#FF5CA1]" : "bg-white/15"
      } ${FOCUS}`}
    >
      <span
        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform motion-reduce:transition-none ${
          on ? "translate-x-5" : ""
        }`}
      />
    </button>
  );
}

function StepHead({ n, title, done, hint }: { n: number; title: string; done: boolean; hint?: string }) {
  return (
    <div className="flex items-start gap-3.5">
      <span
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
          done ? "bg-emerald-500/20 text-emerald-300" : "bg-gradient-to-br from-[#FF5CA1] to-[#FF8A3D] text-white"
        }`}
        aria-hidden
      >
        {done ? "✓" : n}
      </span>
      <div>
        <h2 className="aw-display text-lg font-semibold text-white">{title}</h2>
        {hint && <p className="mt-0.5 text-[13px] text-[#A1A1AA]">{hint}</p>}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   page
   ════════════════════════════════════════════════════════════════ */
export default function SdWritePage() {
  const [linkInput, setLinkInput] = useState("");
  const [code, setCode] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState("");
  const [pkg, setPkg] = useState<Pkg | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const [formatted, setFormatted] = useState(false);
  const [cardName, setCardName] = useState("");
  const [oldFiles, setOldFiles] = useState<string[]>([]);
  const [hasSettings, setHasSettings] = useState(false);
  const [opt, setOpt] = useState({ verify: true, settings: true, wake: true, deleteOld: false });

  const [supported, setSupported] = useState(true);
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState("");
  const [partState, setPartState] = useState<Record<string, PartState>>({});
  const [progress, setProgress] = useState({ done: 0, total: 0, speed: 0 });
  const [stepText, setStepText] = useState("");

  const dirRef = useRef<any>(null);
  const abortRef = useRef<AbortController | null>(null);
  const doneRef = useRef(0);
  const t0Ref = useRef(0);

  const token = useMemo(() => parseToken(linkInput), [linkInput]);
  const hostBad = linkInput.trim().length > 0 && !linkHostOk(linkInput);
  const writing = phase === "writing";
  const cardReady = !!cardName && formatted;
  const canWrite = !!pkg && cardReady && (phase === "ready" || phase === "error");

  useEffect(() => {
    setSupported("showDirectoryPicker" in window && window.isSecureContext);
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

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

  const check = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setCheckError("");
    if (!token) return setCheckError("Paste the full link from the seller (it contains /download/…).");
    if (hostBad) return setCheckError("This doesn't look like an iMIDI link.");
    if (code.trim().length < MIN_CODE) return setCheckError(`The code has at least ${MIN_CODE} characters.`);
    setChecking(true);
    try {
      setPkg(await checkLink(token, code.trim()));
    } catch (err: any) {
      setPkg(null);
      setCheckError(err?.message ?? "Could not check the link.");
      setCooldown(3);
    } finally {
      setChecking(false);
    }
  };

  const changePackage = () => {
    setPkg(null);
    setCode("");
    setPhase("idle");
    setPartState({});
    setMessage("");
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
      setCardName(dir.name);
      setOldFiles(names.filter((n) => n.toLowerCase().endsWith(".jbb")));
      setHasSettings(names.some((n) => n.toUpperCase() === SETTINGS_FILE));
      setPartState({});
      setPhase("ready");
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      dirRef.current = null;
      setCardName("");
      setPhase("idle");
      setMessage(
        "This browser or system doesn't allow writing to the card root. Try the latest Chrome or Edge on a computer, or another USB card reader."
      );
    }
  };

  const write = async () => {
    const dir = dirRef.current;
    if (!dir || !pkg) return;
    if (oldFiles.length && !opt.deleteOld) {
      setMessage(
        "This card already has bank files. Format it first (recommended), or turn on “Delete old bank files” in the options."
      );
      return;
    }

    const ac = new AbortController();
    abortRef.current = ac;
    setMessage("");
    setPhase("writing");
    setStepText("Preparing");

    let wake: any = null;
    try {
      const parts = await getManifest(pkg);
      const total = parts.reduce((a, p) => a + p.size, 0);
      doneRef.current = 0;
      t0Ref.current = performance.now();
      setProgress({ done: 0, total, speed: 0 });
      setPartState(Object.fromEntries(parts.map((p) => [p.name, "waiting" as PartState])));

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
        } else {
          settings = memSettings;
        }
      }

      if (oldFiles.length) {
        setStepText("Removing old bank files");
        for (const n of oldFiles) await dir.removeEntry(n);
      }

      for (const p of parts) {
        setStepText(`Writing ${p.name}`);
        setPartState((s) => ({ ...s, [p.name]: "writing" }));
        const hasher = await newHasher();
        const out = await (await dir.getFileHandle(p.name, { create: true })).createWritable({ keepExistingData: false });
        let got = 0;
        try {
          const src = await openPart(p, ac.signal);
          const tap = new TransformStream<Uint8Array, Uint8Array>({
            transform(chunk, c) {
              got += chunk.byteLength;
              if (got > p.size) throw new Error(`${p.name} is larger than expected`);
              hasher.update(chunk);
              doneRef.current += chunk.byteLength;
              c.enqueue(chunk);
            },
            flush() {
              if (got !== p.size) throw new Error(`${p.name}: got ${got} bytes, expected ${p.size}`);
            },
          });
          await src.pipeThrough(tap, { signal: ac.signal }).pipeTo(out, { signal: ac.signal });
        } catch (e) {
          try {
            await out.abort();
          } catch {}
          try {
            await dir.removeEntry(p.name);
          } catch {}
          throw e;
        }

        if (p.sha256 && hasher.digest("hex") !== p.sha256.toLowerCase()) {
          try {
            await dir.removeEntry(p.name);
          } catch {}
          throw new Error(`${p.name}: checksum mismatch`);
        }
        if (!opt.verify) setPartState((s) => ({ ...s, [p.name]: "ok" }));
      }

      if (opt.verify) {
        for (const p of parts) {
          setStepText(`Checking ${p.name}`);
          setPartState((s) => ({ ...s, [p.name]: "checking" }));
          const f: File = await (await dir.getFileHandle(p.name)).getFile();
          if (f.size !== p.size) throw new Error(`${p.name}: size on the card is ${f.size}, expected ${p.size}`);
          const hasher = await newHasher();
          const r = f.stream().getReader();
          for (;;) {
            if (ac.signal.aborted) throw new DOMException("Aborted", "AbortError");
            const { done, value } = await r.read();
            if (done) break;
            hasher.update(value);
          }
          if (p.sha256 && hasher.digest("hex") !== p.sha256.toLowerCase()) {
            throw new Error(`${p.name}: check failed on the card`);
          }
          setPartState((s) => ({ ...s, [p.name]: "ok" }));
        }
      }

      if (settings) {
        setStepText(`Restoring ${SETTINGS_FILE}`);
        const w = await (await dir.getFileHandle(SETTINGS_FILE, { create: true })).createWritable();
        await w.write(settings);
        await w.close();
      }

      await reportDone(pkg);
      setProgress((p) => ({ ...p, done: total }));
      setStepText("");
      setPhase("done");
    } catch (e: any) {
      if (e?.name === "AbortError") {
        setMessage("Cancelled. Partial files were removed. You can start again.");
      } else if (e?.name === "QuotaExceededError" || /no space|full/i.test(String(e?.message))) {
        setMessage("The card is full or too small for this package.");
      } else {
        setMessage(String(e?.message ?? e));
      }
      setPhase("error");
    } finally {
      try {
        await wake?.release();
      } catch {}
    }
  };

  const pct = progress.total ? Math.min(100, (progress.done / progress.total) * 100) : 0;
  const eta = progress.speed > 0 ? (progress.total - progress.done) / progress.speed : 0;
  const showParts = !!pkg && (writing || phase === "done" || Object.keys(partState).length > 0);

  return (
    <div className="aw-root flex min-h-screen flex-col bg-[#131316] text-[#F2F2F4] selection:bg-[#FF5CA1]/40 selection:text-white">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700&family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        .aw-root { font-family: 'Inter', ui-sans-serif, system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
        .aw-display { font-family: 'Sora', ui-sans-serif, system-ui, sans-serif; }
        .aw-mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }
      `}</style>

      <Navbar />

      <main id="main-content" className="relative flex-1 overflow-x-clip px-5 pb-20 pt-28 sm:px-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-20 right-0 h-[320px] w-[320px] rounded-full bg-[#FF5CA1]/10 blur-[120px] sm:h-[460px] sm:w-[460px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute left-0 top-1/3 h-[260px] w-[260px] rounded-full bg-[#FF8A3D]/[0.07] blur-[110px]"
        />

        <div className="relative mx-auto w-full max-w-3xl">
          <p className="aw-mono text-xs uppercase tracking-[0.16em] text-[#FF5CA1]">iMIDI · SD writer</p>
          <h1 className="aw-display mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Write your package to an SD card
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-[#A1A1AA]">
            Paste the link and the code you got from the seller, plug in the card, and press write. Everything is checked
            and read back from the card.
          </p>

          {!supported && (
            <p role="alert" className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
              Writing to a card needs Chrome or Edge on a computer, over HTTPS. Open this page there.
            </p>
          )}

          <div className="mt-8 space-y-4">
            {/* 1. PACKAGE */}
            <section className="rounded-2xl border border-white/[0.08] bg-[#18181C] p-5 sm:p-7" aria-labelledby="s1">
              <StepHead
                n={1}
                title="Your package"
                done={!!pkg}
                hint={pkg ? undefined : "The link and the code come from the seller, usually sent in two separate messages."}
              />
              <span id="s1" className="sr-only">
                Your package
              </span>

              {!pkg ? (
                <form onSubmit={check} className="mt-5 space-y-4">
                  <div>
                    <label htmlFor="link" className="text-sm font-medium text-white">
                      Link
                    </label>
                    <input
                      id="link"
                      type="text"
                      inputMode="url"
                      autoComplete="off"
                      spellCheck={false}
                      value={linkInput}
                      onChange={(e) => setLinkInput(e.target.value)}
                      placeholder="https://imidi.co.uk/download/…  or  /download/…"
                      className={`mt-1.5 h-12 w-full rounded-xl border bg-[#131316] px-4 text-sm text-white outline-none transition-colors placeholder:text-[#6A6A73] focus:border-[#FF5CA1]/60 ${
                        hostBad ? "border-red-500/50" : "border-white/[0.12]"
                      }`}
                    />
                    <p className="mt-1.5 h-4 text-xs">
                      {linkInput.trim() === "" ? null : hostBad ? (
                        <span className="text-red-300">This doesn&apos;t look like an iMIDI link.</span>
                      ) : token ? (
                        <span className="text-emerald-300">Link recognised · …{token.slice(-6)}</span>
                      ) : (
                        <span className="text-[#A1A1AA]">Paste the whole link or /download/…</span>
                      )}
                    </p>
                  </div>

                  <div>
                    <label htmlFor="code" className="text-sm font-medium text-white">
                      Access code
                    </label>
                    <div className="relative mt-1.5">
                      <input
                        id="code"
                        type={showCode ? "text" : "password"}
                        autoComplete="off"
                        spellCheck={false}
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        placeholder="The code from the seller"
                        className="h-12 w-full rounded-xl border border-white/[0.12] bg-[#131316] px-4 pr-20 text-sm text-white outline-none transition-colors placeholder:text-[#6A6A73] focus:border-[#FF5CA1]/60"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCode((v) => !v)}
                        className={`absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2.5 py-1.5 text-xs font-semibold text-[#A1A1AA] hover:text-white ${FOCUS}`}
                      >
                        {showCode ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>

                  {checkError && (
                    <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-sm text-red-200">
                      {checkError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={checking || cooldown > 0 || !token || code.trim().length < MIN_CODE}
                    className={`inline-flex h-12 items-center gap-2.5 rounded-xl bg-gradient-to-r from-[#FF5CA1] to-[#FF8A3D] px-8 text-xs font-bold uppercase tracking-wide text-white transition-transform enabled:hover:scale-[1.02] enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS}`}
                  >
                    {checking && (
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white motion-reduce:animate-none" />
                    )}
                    {checking ? "Checking" : cooldown > 0 ? `Wait ${cooldown}s` : "Check package"}
                  </button>
                </form>
              ) : (
                <div className="mt-5 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold text-white">{pkg.name}</p>
                      <p className="aw-mono mt-1 text-[11px] text-[#A1A1AA]">
                        {pkg.type} · {fmtBytes(pkg.size)} · {pkg.parts.length} file{pkg.parts.length > 1 ? "s" : ""}
                        {pkg.expires && ` · valid until ${new Date(pkg.expires).toLocaleDateString("en-GB")}`}
                      </p>
                    </div>
                    {!writing && (
                      <button
                        type="button"
                        onClick={changePackage}
                        className={`rounded-md px-1 text-xs font-semibold text-[#A1A1AA] underline-offset-2 hover:text-white hover:underline ${FOCUS}`}
                      >
                        Use another link
                      </button>
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* 2. CARD */}
            <section
              className={`rounded-2xl border border-white/[0.08] bg-[#18181C] p-5 transition-opacity sm:p-7 ${
                !pkg ? "pointer-events-none opacity-45" : ""
              }`}
              aria-labelledby="s2"
              aria-disabled={!pkg}
            >
              <StepHead n={2} title="Your card" done={cardReady} hint="Plug in the SD card and choose it." />
              <span id="s2" className="sr-only">
                Your card
              </span>

              <label className="mt-5 flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={formatted}
                  onChange={(e) => setFormatted(e.target.checked)}
                  disabled={writing || !pkg}
                  className="mt-1 h-4 w-4 accent-[#FF5CA1]"
                />
                <span className="text-sm leading-relaxed text-[#D4D4D9]">
                  <span className="font-semibold text-white">The card is formatted as FAT32 and empty.</span>{" "}
                  <span className="text-[#A1A1AA]">
                    Browsers can&apos;t format cards. For 64 GB and larger use the &quot;Large FAT32&quot; method (for
                    example Rufus on Windows).
                  </span>
                </span>
              </label>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={pickCard}
                  disabled={writing || !supported || !pkg}
                  className={`h-11 rounded-xl border border-white/20 px-5 text-xs font-bold uppercase tracking-wide text-white transition-colors enabled:hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS}`}
                >
                  {cardName ? "Choose another card" : "Choose SD card"}
                </button>
                {cardName && (
                  <span className="text-sm text-[#B4B4BC]">
                    Card: <span className="font-semibold text-white">{cardName}</span>
                  </span>
                )}
              </div>

              {cardName && hasSettings && opt.settings && (
                <p className="mt-3 text-[13px] text-[#A1A1AA]">
                  {SETTINGS_FILE} found: it will be kept and put back after writing.
                </p>
              )}
              {oldFiles.length > 0 && (
                <p className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/[0.07] p-3 text-[13px] text-amber-100">
                  {oldFiles.length} old bank file{oldFiles.length > 1 ? "s" : ""} on the card ({oldFiles.join(", ")}).
                  Format the card for the most reliable result, or turn on “Delete old bank files” below.
                </p>
              )}

              <details className="group mt-5 border-t border-white/[0.07] pt-4">
                <summary
                  className={`flex cursor-pointer list-none items-center justify-between rounded text-sm font-semibold text-[#D4D4D9] hover:text-white ${FOCUS}`}
                >
                  Options
                  <span aria-hidden className="text-[#8E8E98] transition-transform group-open:rotate-180">
                    ⌄
                  </span>
                </summary>
                <ul className="mt-4 space-y-4">
                  {[
                    {
                      k: "verify" as const,
                      t: "Check files after writing",
                      d: "Reads every file back from the card and compares it. Slower, much safer.",
                    },
                    {
                      k: "settings" as const,
                      t: `Keep ${SETTINGS_FILE}`,
                      d: "Saves your settings file before writing and puts it back at the end.",
                    },
                    {
                      k: "wake" as const,
                      t: "Keep the screen awake",
                      d: "Stops the computer from sleeping while a long write is running.",
                    },
                    {
                      k: "deleteOld" as const,
                      t: "Delete old bank files",
                      d: "Removes .JBB files already on the card. Formatting is more reliable.",
                    },
                  ].map((o) => (
                    <li key={o.k} className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-white">{o.t}</p>
                        <p className="mt-0.5 text-[13px] leading-relaxed text-[#A1A1AA]">{o.d}</p>
                      </div>
                      <Switch
                        on={opt[o.k]}
                        label={o.t}
                        disabled={writing}
                        onChange={() => setOpt((s) => ({ ...s, [o.k]: !s[o.k] }))}
                      />
                    </li>
                  ))}
                </ul>
              </details>
            </section>

            {/* 3. WRITE */}
            <section
              className={`rounded-2xl border border-white/[0.08] bg-[#18181C] p-5 transition-opacity sm:p-7 ${
                !cardReady ? "pointer-events-none opacity-45" : ""
              }`}
              aria-labelledby="s3"
              aria-disabled={!cardReady}
            >
              <StepHead
                n={3}
                title="Write"
                done={phase === "done"}
                hint={
                  writing
                    ? undefined
                    : "Don't use the computer for anything else, and don't unplug the card, until it says Done."
                }
              />
              <span id="s3" className="sr-only">
                Write
              </span>

              {showParts && pkg && (
                <div className="mt-5 space-y-4">
                  <div>
                    <div className="mb-1.5 flex items-center justify-between gap-3 text-xs text-[#A1A1AA]">
                      <span aria-live="polite">
                        {phase === "done"
                          ? "All files written" + (opt.verify ? " and checked" : "")
                          : stepText}
                      </span>
                      <span className="aw-mono">
                        {fmtBytes(progress.done)} / {fmtBytes(progress.total)}
                        {writing && progress.speed > 0 && ` · ${fmtBytes(progress.speed)}/s · ${fmtEta(eta)}`}
                      </span>
                    </div>
                    <div
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(phase === "done" ? 100 : pct)}
                      className="h-2.5 overflow-hidden rounded-full bg-white/10"
                    >
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#FF5CA1] to-[#FF8A3D] transition-[width] duration-200"
                        style={{ width: `${phase === "done" ? 100 : pct}%` }}
                      />
                    </div>
                  </div>
                  <ul className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.08]">
                    {pkg.parts.map((p) => {
                      const s = partState[p.name] ?? "waiting";
                      return (
                        <li key={p.name} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                          <span className="aw-mono truncate text-[13px]">{p.name}</span>
                          <span className="flex shrink-0 items-center gap-3 text-xs text-[#A1A1AA]">
                            {fmtBytes(p.size)}
                            <span
                              className={`rounded-md px-2 py-0.5 font-semibold ${
                                s === "ok"
                                  ? "bg-emerald-500/15 text-emerald-300"
                                  : s === "waiting"
                                  ? "bg-white/[0.06]"
                                  : "bg-[#FF5CA1]/15 text-[#FF8FBF]"
                              }`}
                            >
                              {s === "ok" ? (opt.verify ? "checked" : "written") : s}
                            </span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {phase === "done" && (
                <p className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
                  Done. Eject the card from your computer the usual way (safely remove), then put it in the sampler.
                </p>
              )}
              {message && (
                <p role="alert" className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                  {message}
                </p>
              )}

              <div className="mt-5 flex flex-wrap gap-3">
                {!writing && phase !== "done" && (
                  <button
                    type="button"
                    onClick={write}
                    disabled={!canWrite}
                    className={`h-12 rounded-xl bg-gradient-to-r from-[#FF5CA1] to-[#FF8A3D] px-8 text-xs font-bold uppercase tracking-wide text-white transition-transform enabled:hover:scale-[1.02] enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS}`}
                  >
                    {phase === "error" ? "Try again" : "Write to card"}
                  </button>
                )}
                {writing && (
                  <button
                    type="button"
                    onClick={() => abortRef.current?.abort()}
                    className={`h-12 rounded-xl border border-white/20 px-6 text-xs font-bold uppercase tracking-wide text-white hover:bg-white/5 ${FOCUS}`}
                  >
                    Cancel
                  </button>
                )}
                {phase === "done" && (
                  <button
                    type="button"
                    onClick={() => {
                      setPhase("idle");
                      setCardName("");
                      dirRef.current = null;
                      setPartState({});
                      setFormatted(false);
                    }}
                    className={`h-12 rounded-xl border border-white/20 px-6 text-xs font-bold uppercase tracking-wide text-white hover:bg-white/5 ${FOCUS}`}
                  >
                    Write another card
                  </button>
                )}
              </div>
            </section>
          </div>

          <details className="mt-6 rounded-2xl border border-white/[0.08] bg-[#18181C] p-5 text-sm text-[#A1A1AA]">
            <summary className={`cursor-pointer rounded font-medium text-[#D4D4D9] hover:text-white ${FOCUS}`}>
              Link not working, or can&apos;t choose the card?
            </summary>
            <div className="mt-3 space-y-3 leading-relaxed">
              <p>
                Links are for one use and expire after 15 days. Check you pasted the whole link and the exact code, and
                ask the seller for a new link if needed.
              </p>
              <p>
                Some systems block selecting the root of a drive. Use the latest Chrome or Edge on a computer, try another
                USB card reader, and pick the card itself, not a folder inside it.
              </p>
            </div>
          </details>
        </div>
      </main>

      <Footer />
    </div>
  );
}