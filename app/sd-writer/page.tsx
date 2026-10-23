'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ════════════════════════════════════════════════════════════════
   SdCardWriter · writes a purchased sound bank straight to an SD card from the browser

   Needs:  npm i hash-wasm        (incremental SHA-256 while streaming)
   Works:  Chrome / Edge on desktop, HTTPS, user picks the card folder (File System Access API)
   Does NOT: format the card, write raw sectors, or work on Safari / Firefox / phones.

   Server contract (you implement it):
     getManifest() -> POST /api/sd/manifest  { orderId }
       - checks the purchase, enforces the per-purchase write limit, logs the attempt
       - returns short-lived signed URLs (CORS enabled for your origin) + expected sizes and SHA-256
     parts are written in the order given: the FIRST part must be the first .JBB file

   Try it with no backend:  <SdCardWriter mock />
   ════════════════════════════════════════════════════════════════ */

export type SdPart = { name: string; url: string; size: number; sha256?: string };
export type SdManifest = { orderId: string; packName: string; parts: SdPart[] };
export type SdEvent = {
  type: "start" | "part_written" | "part_verified" | "settings_backup" | "settings_restore" | "complete" | "abort" | "error";
  orderId?: string;
  part?: string;
  detail?: string;
};

type Props = {
  /** called when the user presses Write: fetch a fresh manifest (and count the write on the server) */
  getManifest?: () => Promise<SdManifest>;
  /** no backend: writes synthetic test parts so you can try your card and your sampler */
  mock?: boolean;
  /** name of the settings file Juzisound keeps in the card root */
  settingsFile?: string;
  /** keep the user's settings in the cloud (MyCloud): saved before writing, restored after */
  settingsBackup?: { save: (file: Blob, name: string) => Promise<void>; load: () => Promise<Blob | null> };
  /** audit trail: send to your server for the log */
  onEvent?: (e: SdEvent) => void;
  /** shown when the browser cannot write to the card; lets you offer a normal download */
  onFallback?: (m: SdManifest | null) => void;
};

type PartStatus = "pending" | "writing" | "written" | "verifying" | "verified" | "error";
type Phase = "idle" | "ready" | "writing" | "done" | "error";

const MOCK: SdManifest = {
  orderId: "mock",
  packName: "Test bank (synthetic data)",
  parts: [
    { name: "TEST1.JBB", url: "mock://", size: 96 * 1024 * 1024 },
    { name: "TEST2.JBB", url: "mock://", size: 48 * 1024 * 1024 },
  ],
};

/* ---------- helpers ---------- */
const fmtBytes = (n: number) =>
  n >= 1e9 ? `${(n / 1e9).toFixed(2)} GB` : n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : n >= 1e3 ? `${(n / 1e3).toFixed(0)} KB` : `${n} B`;

const fmtEta = (s: number) => (!isFinite(s) || s <= 0 ? "–" : s > 3600 ? `${Math.round(s / 3600)} h` : s > 60 ? `${Math.round(s / 60)} min` : `${Math.round(s)} s`);

function mockStream(size: number, signal: AbortSignal): ReadableStream<Uint8Array> {
  let sent = 0;
  const CH = 1 << 20;
  return new ReadableStream<Uint8Array>({
    pull(ctrl) {
      if (signal.aborted) return ctrl.error(new DOMException("Aborted", "AbortError"));
      if (sent >= size) return ctrl.close();
      const n = Math.min(CH, size - sent);
      const b = new Uint8Array(n);
      for (let i = 0; i < n; i++) b[i] = ((sent + i) * 31) & 255;
      sent += n;
      ctrl.enqueue(b);
    },
  });
}

async function openPart(part: SdPart, signal: AbortSignal): Promise<ReadableStream<Uint8Array>> {
  if (part.url.startsWith("mock://")) return mockStream(part.size, signal);
  const res = await fetch(part.url, { signal });
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
  const names: string[] = [];
  for await (const entry of dir.values()) names.push(entry.name);
  return names;
}

/* ---------- component ---------- */
export default function SdCardWriter({ getManifest, mock = false, settingsFile = "SETTINGS.JST", settingsBackup, onEvent, onFallback }: Props) {
  const [supported, setSupported] = useState(true);
  const [phase, setPhase] = useState<Phase>("idle");
  const [cardName, setCardName] = useState("");
  const [existingBank, setExistingBank] = useState<string[]>([]);
  const [hasSettings, setHasSettings] = useState(false);
  const [deleteOld, setDeleteOld] = useState(false);
  const [message, setMessage] = useState("");
  const [manifest, setManifest] = useState<SdManifest | null>(null);
  const [status, setStatus] = useState<Record<string, PartStatus>>({});
  const [progress, setProgress] = useState({ done: 0, total: 0, speed: 0 });
  const [step, setStep] = useState("");

  const dirRef = useRef<any>(null);
  const abortRef = useRef<AbortController | null>(null);
  const doneRef = useRef(0);
  const t0Ref = useRef(0);
  const wakeRef = useRef<any>(null);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "showDirectoryPicker" in window);
  }, []);

  /* live progress (4 updates per second, not per chunk) */
  useEffect(() => {
    if (phase !== "writing") return;
    const id = setInterval(() => {
      const el = (performance.now() - t0Ref.current) / 1000;
      setProgress((p) => ({ ...p, done: doneRef.current, speed: el > 0 ? doneRef.current / el : 0 }));
    }, 250);
    return () => clearInterval(id);
  }, [phase]);

  /* warn before leaving while writing */
  useEffect(() => {
    if (phase !== "writing") return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [phase]);

  const emit = useCallback((e: SdEvent) => onEvent?.({ ...e, orderId: e.orderId ?? manifest?.orderId }), [onEvent, manifest]);

  /* ---------- 1. pick the card ---------- */
  const pickCard = async () => {
    setMessage("");
    try {
      const dir = await (window as any).showDirectoryPicker({ id: "imidi-sd", mode: "readwrite" });
      // prove we can really write here (some systems block drive roots)
      const probe = await dir.getFileHandle(".imidi-probe", { create: true });
      const w = await probe.createWritable();
      await w.write(new Uint8Array([1]));
      await w.close();
      await dir.removeEntry(".imidi-probe");

      const names = await listNames(dir);
      dirRef.current = dir;
      setCardName(dir.name);
      setExistingBank(names.filter((n) => n.toLowerCase().endsWith(".jbb")));
      setHasSettings(names.some((n) => n.toUpperCase() === settingsFile.toUpperCase()));
      setDeleteOld(false);
      setPhase("ready");
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      dirRef.current = null;
      setPhase("idle");
      setMessage(
        "This browser or system does not allow writing to the card root (some systems block drive roots). " +
          "Use a different computer or browser, or the download option below."
      );
      onFallback?.(null);
    }
  };

  /* ---------- 2. write ---------- */
  const writeParts = async (dir: any, m: SdManifest, signal: AbortSignal, total: number) => {
    for (const part of m.parts) {
      if (status[part.name] === "verified") {
        doneRef.current += part.size;
        continue;
      }
      setStep(`Writing ${part.name}`);
      setStatus((s) => ({ ...s, [part.name]: "writing" }));

      const hasher = await newHasher();
      const fh = await dir.getFileHandle(part.name, { create: true });
      const out = await fh.createWritable({ keepExistingData: false });
      let got = 0;
      try {
        const src = await openPart(part, signal);
        const tap = new TransformStream<Uint8Array, Uint8Array>({
          transform(chunk, ctrl) {
            got += chunk.byteLength;
            if (got > part.size) throw new Error(`${part.name} is larger than expected`);
            hasher.update(chunk);
            doneRef.current += chunk.byteLength;
            ctrl.enqueue(chunk);
          },
          flush() {
            if (got !== part.size) throw new Error(`${part.name}: got ${got} bytes, expected ${part.size}`);
          },
        });
        await src.pipeThrough(tap, { signal }).pipeTo(out, { signal });
      } catch (e) {
        try {
          await out.abort();
        } catch {}
        try {
          await dir.removeEntry(part.name);
        } catch {}
        doneRef.current -= got;
        throw e;
      }

      const hash = hasher.digest("hex");
      if (part.sha256 && hash !== part.sha256.toLowerCase()) {
        try {
          await dir.removeEntry(part.name);
        } catch {}
        throw new Error(`${part.name}: checksum mismatch after download`);
      }
      setStatus((s) => ({ ...s, [part.name]: "written" }));
      emit({ type: "part_written", part: part.name, detail: hash });
    }
    setProgress((p) => ({ ...p, done: total }));
  };

  /* ---------- 3. read back and verify ---------- */
  const verifyParts = async (dir: any, m: SdManifest, signal: AbortSignal) => {
    for (const part of m.parts) {
      setStep(`Verifying ${part.name}`);
      setStatus((s) => ({ ...s, [part.name]: "verifying" }));
      const file: File = await (await dir.getFileHandle(part.name)).getFile();
      if (file.size !== part.size) throw new Error(`${part.name}: size on card is ${file.size}, expected ${part.size}`);
      const hasher = await newHasher();
      const reader = file.stream().getReader();
      for (;;) {
        if (signal.aborted) throw new DOMException("Aborted", "AbortError");
        const { done, value } = await reader.read();
        if (done) break;
        hasher.update(value);
      }
      const hash = hasher.digest("hex");
      if (part.sha256 && hash !== part.sha256.toLowerCase()) throw new Error(`${part.name}: verification failed (checksum differs on the card)`);
      setStatus((s) => ({ ...s, [part.name]: "verified" }));
      emit({ type: "part_verified", part: part.name, detail: hash });
    }
  };

  const start = async () => {
    const dir = dirRef.current;
    if (!dir) return;
    if (existingBank.length && !deleteOld) {
      setMessage("This card already has bank files. Format it first (recommended), or tick the box to delete them.");
      return;
    }

    const ac = new AbortController();
    abortRef.current = ac;
    setMessage("");
    setPhase("writing");
    setStep("Preparing");

    try {
      const m = mock ? MOCK : await getManifest!();
      setManifest(m);
      const total = m.parts.reduce((a, p) => a + p.size, 0);
      doneRef.current = 0;
      t0Ref.current = performance.now();
      setProgress({ done: 0, total, speed: 0 });
      setStatus(Object.fromEntries(m.parts.map((p) => [p.name, "pending" as PartStatus])));
      onEvent?.({ type: "start", orderId: m.orderId });

      try {
        wakeRef.current = await (navigator as any).wakeLock?.request("screen");
      } catch {}

      // keep the user's settings safe
      let settings: Blob | null = null;
      if (hasSettings) {
        setStep(`Backing up ${settingsFile}`);
        const f: File = await (await dir.getFileHandle(settingsFile)).getFile();
        settings = f;
        await settingsBackup?.save(f, settingsFile);
        onEvent?.({ type: "settings_backup", orderId: m.orderId });
      } else if (settingsBackup) {
        settings = await settingsBackup.load();
      }

      if (existingBank.length) {
        setStep("Removing old bank files");
        for (const n of existingBank) await dir.removeEntry(n);
      }

      await writeParts(dir, m, ac.signal, total);
      await verifyParts(dir, m, ac.signal);

      if (settings) {
        setStep(`Restoring ${settingsFile}`);
        const fh = await dir.getFileHandle(settingsFile, { create: true });
        const w = await fh.createWritable();
        await w.write(settings);
        await w.close();
        onEvent?.({ type: "settings_restore", orderId: m.orderId });
      }

      onEvent?.({ type: "complete", orderId: m.orderId });
      setStep("");
      setPhase("done");
    } catch (err: any) {
      if (err?.name === "AbortError") {
        onEvent?.({ type: "abort" });
        setMessage("Writing cancelled. Partial files were removed. You can start again.");
      } else {
        onEvent?.({ type: "error", detail: String(err?.message ?? err) });
        const full = err?.name === "QuotaExceededError" || /no space|full/i.test(String(err?.message));
        setMessage(full ? "The card is full or too small for this bank." : String(err?.message ?? err));
      }
      setPhase("error");
    } finally {
      try {
        await wakeRef.current?.release();
      } catch {}
    }
  };

  const cancel = () => abortRef.current?.abort();

  const pct = progress.total ? Math.min(100, (progress.done / progress.total) * 100) : 0;
  const eta = progress.speed > 0 ? (progress.total - progress.done) / progress.speed : Infinity;
  const writing = phase === "writing";
  const canStart = (phase === "ready" || phase === "error") && !!dirRef.current && (mock || !!getManifest);

  const parts = useMemo(() => manifest?.parts ?? (mock ? MOCK.parts : []), [manifest, mock]);

  /* ---------- UI ---------- */
  if (!supported) {
    return (
      <section className="rounded-2xl border border-white/[0.08] bg-[#18181C] p-6 text-[#F2F2F4]">
        <h2 className="text-lg font-semibold">Write to SD card</h2>
        <p className="mt-2 text-sm leading-relaxed text-[#A1A1AA]">
          Writing straight to a card needs Chrome or Edge on a computer. Open this page there, or download the bank files instead.
        </p>
        <button
          type="button"
          onClick={() => onFallback?.(manifest)}
          className="mt-4 h-11 rounded-lg border border-white/20 px-5 text-xs font-bold uppercase tracking-wide text-white hover:bg-white/5"
        >
          Download files instead
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-[#18181C] p-6 text-[#F2F2F4]" aria-labelledby="sdw-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="sdw-title" className="text-lg font-semibold tracking-tight">
            Write to SD card
          </h2>
          <p className="mt-1 text-sm text-[#A1A1AA]">{manifest?.packName ?? (mock ? MOCK.packName : "Your purchased bank")}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
            phase === "done" ? "bg-emerald-500/15 text-emerald-300" : writing ? "bg-[#FF5CA1]/15 text-[#FF8FBF]" : phase === "error" ? "bg-red-500/15 text-red-300" : "bg-white/[0.06] text-[#B4B4BC]"
          }`}
        >
          {phase === "done" ? "Done" : writing ? "Writing" : phase === "error" ? "Needs attention" : phase === "ready" ? "Card ready" : "Waiting for card"}
        </span>
      </div>

      {/* before you start */}
      {!writing && phase !== "done" && (
        <ol className="mt-5 space-y-3 text-sm text-[#B4B4BC]">
          <li>
            <span className="font-semibold text-white">Format the card as FAT32</span> first (cards of 64 GB or more: use Rufus, as Juzisound recommends). A formatted, empty card works best.
          </li>
          <li>
            <span className="font-semibold text-white">Choose the card</span> below. Your browser will ask permission to write to it.
          </li>
          <li>
            <span className="font-semibold text-white">Don&apos;t use the computer for anything else</span> while it writes, and don&apos;t unplug the card.
          </li>
        </ol>
      )}

      {/* card info */}
      {cardName && !writing && phase !== "done" && (
        <div className="mt-5 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 text-sm">
          <p>
            Card: <span className="font-semibold text-white">{cardName}</span>
          </p>
          {hasSettings && <p className="mt-1 text-[#A1A1AA]">{settingsFile} found. It will be saved and put back after writing.</p>}
          {existingBank.length > 0 && (
            <label className="mt-3 flex cursor-pointer items-start gap-2 text-[#FFB38A]">
              <input type="checkbox" checked={deleteOld} onChange={(e) => setDeleteOld(e.target.checked)} className="mt-1" />
              <span>
                {existingBank.length} old bank file{existingBank.length > 1 ? "s" : ""} on the card ({existingBank.join(", ")}). Delete them before writing. Formatting the card instead is more reliable.
              </span>
            </label>
          )}
        </div>
      )}

      {/* progress */}
      {(writing || phase === "done" || (phase === "error" && manifest)) && (
        <div className="mt-5 space-y-4">
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs text-[#A1A1AA]">
              <span aria-live="polite">{phase === "done" ? "All files written and verified" : step}</span>
              <span className="font-mono">
                {fmtBytes(progress.done)} / {fmtBytes(progress.total)}
                {writing && progress.speed > 0 && ` · ${fmtBytes(progress.speed)}/s · ${fmtEta(eta)}`}
              </span>
            </div>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(phase === "done" ? 100 : pct)}
              className="h-2 overflow-hidden rounded-full bg-white/10"
            >
              <div className="h-full rounded-full bg-gradient-to-r from-[#FF5CA1] to-[#FF8A3D] transition-[width] duration-200" style={{ width: `${phase === "done" ? 100 : pct}%` }} />
            </div>
          </div>

          <ul className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.08]">
            {parts.map((p) => {
              const s = status[p.name] ?? "pending";
              return (
                <li key={p.name} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <span className="min-w-0 truncate font-mono text-[13px]">{p.name}</span>
                  <span className="flex shrink-0 items-center gap-3 text-xs text-[#A1A1AA]">
                    {fmtBytes(p.size)}
                    <span
                      className={`rounded-md px-2 py-0.5 font-semibold ${
                        s === "verified" ? "bg-emerald-500/15 text-emerald-300" : s === "error" ? "bg-red-500/15 text-red-300" : s === "pending" ? "bg-white/[0.06]" : "bg-[#FF5CA1]/15 text-[#FF8FBF]"
                      }`}
                    >
                      {s}
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

      {/* actions */}
      <div className="mt-6 flex flex-wrap gap-3">
        {!writing && phase !== "done" && (
          <button
            type="button"
            onClick={pickCard}
            className="h-11 rounded-lg border border-white/20 px-5 text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-white/5"
          >
            {cardName ? "Choose another card" : "Choose SD card"}
          </button>
        )}
        {canStart && (
          <button
            type="button"
            onClick={start}
            className="h-11 rounded-lg bg-gradient-to-r from-[#FF5CA1] to-[#FF8A3D] px-6 text-xs font-bold uppercase tracking-wide text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            {phase === "error" ? "Try again" : "Write to card"}
          </button>
        )}
        {writing && (
          <button
            type="button"
            onClick={cancel}
            className="h-11 rounded-lg border border-white/20 px-5 text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-white/5"
          >
            Cancel
          </button>
        )}
        {!writing && phase !== "done" && onFallback && (
          <button type="button" onClick={() => onFallback(manifest)} className="h-11 px-2 text-xs font-semibold text-[#A1A1AA] underline-offset-2 hover:text-white hover:underline">
            Download files instead
          </button>
        )}
      </div>
    </section>
  );
}