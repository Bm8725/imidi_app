"use client";
import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";

function formatEta(sec: number) {
  if (!isFinite(sec) || sec <= 0) return "--:--";
  return `${Math.floor(sec / 60)}:${Math.round(sec % 60).toString().padStart(2, "0")}`;
}

function formatSpeed(mbps: number) {
  if (!isFinite(mbps) || mbps <= 0) return "0 KB/s";
  return mbps < 1 ? `${(mbps * 1024).toFixed(0)} KB/s` : `${mbps.toFixed(2)} MB/s`;
}

type DlProgress = { percent: number; speedMbps: number; etaSec: number; retrying: boolean; offline: boolean; };

function waitForOnline(): Promise<void> {
  if (typeof navigator === "undefined" || navigator.onLine) return Promise.resolve();
  return new Promise(r => window.addEventListener("online", function h() { window.removeEventListener("online", h); r(); }));
}

const STALL_TIMEOUT_MS = 15000;

async function downloadResumable(url: string, onProgress: (p: DlProgress) => void, maxRetries = 8): Promise<Blob> {
  let chunks: Uint8Array[] = [], receivedBytes = 0, totalBytes = 0, attempt = 0;
  let lastLoaded = 0, lastTime = Date.now(), speedSamples: number[] = [];
  const retryDelays =;

  while (true) {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      onProgress({ percent: totalBytes > 0 ? Math.min(100, (receivedBytes / totalBytes) * 100) : 0, speedMbps: 0, etaSec: 0, retrying: true, offline: true });
      await waitForOnline();
    }

    const controller = new AbortController();
    let stallTimer = setTimeout(() => controller.abort(), STALL_TIMEOUT_MS);
    const resetStall = () => { clearTimeout(stallTimer); stallTimer = setTimeout(() => controller.abort(), STALL_TIMEOUT_MS); };

    try {
      const headers: Record<string, string> = receivedBytes > 0 ? { "Range": `bytes=${receivedBytes}-` } : {};
      const res = await fetch(url, { headers, signal: controller.signal });
      if (!res.ok || !res.body) throw new Error("Eroare server date");

      if (receivedBytes > 0 && res.status === 200) { chunks = []; receivedBytes = 0; }

      const contentRange = res.headers.get("content-range");
      if (contentRange?.split("/")[1]) totalBytes = parseInt(contentRange.split("/")[1], 10);
      else if (res.status === 200 && res.headers.get("content-length")) totalBytes = parseInt(res.headers.get("content-length")!, 10);

      const reader = res.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          resetStall(); chunks.push(value); receivedBytes += value.length;
          const now = Date.now(), elapsed = (now - lastTime) / 1000;
          if (elapsed > 0.15) {
            speedSamples.push((receivedBytes - lastLoaded) / elapsed);
            if (speedSamples.length > 5) speedSamples.shift();
            const avg = speedSamples.reduce((a, b) => a + b, 0) / speedSamples.length;
            lastLoaded = receivedBytes; lastTime = now;
            onProgress({ percent: totalBytes > 0 ? Math.min(100, (receivedBytes / totalBytes) * 100) : 0, speedMbps: avg / 1048576, etaSec: avg > 0 ? Math.max(totalBytes - receivedBytes, 0) / avg : 0, retrying: false, offline: false });
          }
        }
      }
      clearTimeout(stallTimer);
      onProgress({ percent: 100, speedMbps: 0, etaSec: 0, retrying: false, offline: false });
      return new Blob(chunks as BlobPart[]);
    } catch (err) {
      clearTimeout(stallTimer);
      if (++attempt > maxRetries) throw err;
      onProgress({ percent: totalBytes > 0 ? Math.min(100, (receivedBytes / totalBytes) * 100) : 0, speedMbps: 0, etaSec: 0, retrying: true, offline: typeof navigator !== "undefined" ? !navigator.onLine : false });
      await waitForOnline();
      await new Promise(r => setTimeout(r, retryDelays[Math.min(attempt - 1, retryDelays.length - 1)]));
    }
  }
}

export default function DownloadLinkPage() {
  const token = useParams().token as string;
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [dlProgress, setDlProgress] = useState<DlProgress | null>(null);
  const [sellerName, setSellerName] = useState("Verified iMIDI Seller");
  const [contentName, setContentName] = useState("Digital Content Package");
  const [fetchingSeller, setFetchingSeller] = useState(true);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/cloud/redeem?token=${token}`).then(r => r.json()).then(d => {
      if (d?.seller_name) setSellerName(d.seller_name);
      if (d?.filename) setContentName(d.filename);
    }).catch(e => console.error(e)).finally(() => setFetchingSeller(false));
    return () => { cancelledRef.current = true; };
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError(""); setDlProgress({ percent: 0, speedMbps: 0, etaSec: 0, retrying: false, offline: false });
    try {
      const res = await fetch("/api/cloud/redeem", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, code }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Cod invalid."); setLoading(false); setDlProgress(null); return; }
      const blob = await downloadResumable(data.url, p => { if (!cancelledRef.current) setDlProgress(p); });
      const blobUrl = URL.createObjectURL(blob), a = document.createElement("a");
      a.href = blobUrl; a.download = contentName || "download"; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(blobUrl);
      setDone(true);
    } catch (err: any) { setError(err.message || "Eroare rețea."); setDlProgress(null); } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 antialiased text-slate-800">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 p-6 sm:p-8">
        <div className="text-center mb-6">
          {fetchingSeller ? <div className="h-6 w-32 bg-slate-200 rounded animate-pulse mx-auto mb-2" /> : <p className="text-xs font-semibold tracking-wider text-indigo-600 uppercase mb-1">{sellerName}</p>}
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight line-clamp-2">{fetchingSeller ? "Se încarcă..." : contentName}</h1>
        </div>
        {error && <div className="mb-6 p-4 bg-rose-50 border-l-4 border-rose-500 rounded-r-xl text-sm text-rose-700 font-medium">{error}</div>}
        {done ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-100">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-1">Descărcare gata!</h2>
            <p className="text-sm text-slate-500">Fișierul a fost salvat.</p>
          </div>
        ) : dlProgress ? (
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between text-sm font-semibold">
              <span className="text-slate-700">Se descarcă...</span>
              <span className="text-indigo-600 tabular-nums">{dlProgress.percent.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200/50">
              <div className="bg-gradient-to-r from-indigo-500 to-violet-600 h-full rounded-full transition-all duration-300 ease-out" style={{ width: `${dlProgress.percent}%` }} />
            </div>
            <div className="flex justify-between text-xs text-slate-400 font-medium tracking-wide">
              <span>Viteză: {formatSpeed(dlProgress.speedMbps)}</span>
              <span>Rămas: {formatEta(dlProgress.etaSec)}</span>
            </div>
            {dlProgress.offline && <p className="text-xs text-amber-600 bg-amber-50 p-2.5 rounded-xl text-center font-medium animate-pulse">Conexiune pierdută. Se reia automat când revine netul...</p>}
            {!dlProgress.offline && dlProgress.retrying && <p className="text-xs text-indigo-600 bg-indigo-50 p-2.5 rounded-xl text-center font-medium animate-pulse">Flux întrerupt. Reîncercăm conectarea...</p>}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input type="text" required value={code} onChange={e => setCode(e.target.value)} placeholder="Introdu codul primit de la vânzător" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center font-medium tracking-wide" disabled={loading || fetchingSeller} />
            <button type="submit" disabled={loading || fetchingSeller} className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold py-3 px-4 rounded-xl shadow-md disabled:opacity-50 transition-all flex items-center justify-center gap-2">
              {loading ? <span className="animate-pulse">Se validează...</span> : "Validează și Descarcă"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
