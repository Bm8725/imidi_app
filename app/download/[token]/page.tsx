"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";

// ---- helpers de formatare, identice cu cele din dashboard ----
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

type DlProgress = {
  percent: number;
  speedMbps: number;
  etaSec: number;
  retrying: boolean;
};

// ---- download rezumabil: fetch + Range headers, cu retry automat ----
// Analogul de download al TUS: daca stream-ul pica, reluam de unde am ramas
// cu "Range: bytes=<primit>-" in loc sa reincepem de la zero.
async function downloadResumable(
  url: string,
  onProgress: (p: DlProgress) => void,
  maxRetries = 6
): Promise<Blob> {
  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;
  let totalBytes = 0;
  let attempt = 0;

  let lastLoaded = 0;
  let lastTime = Date.now();
  let speedSamples: number[] = [];
  const retryDelays = [0, 1000, 2000, 4000, 8000, 15000];

  while (true) {
    try {
      const headers: Record<string, string> = {};
      if (receivedBytes > 0) headers["Range"] = `bytes=${receivedBytes}-`;

      const res = await fetch(url, { headers });
      if (!res.ok && res.status !== 206) throw new Error(`Server a răspuns cu status ${res.status}`);
      if (!res.body) throw new Error("Răspunsul nu conține date.");

      // stabilim marimea totala: din Content-Range daca e reluare, altfel din Content-Length
      const contentRange = res.headers.get("content-range"); // ex: "bytes 500-999/2000"
      if (contentRange) {
        const totalStr = contentRange.split("/")[1];
        if (totalStr) totalBytes = parseInt(totalStr, 10);
      } else {
        const cl = res.headers.get("content-length");
        if (cl) totalBytes = parseInt(cl, 10);
      }

      const reader = res.body.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          receivedBytes += value.length;

          const now = Date.now();
          const elapsedSec = (now - lastTime) / 1000;
          if (elapsedSec > 0.15) {
            const bytesDelta = receivedBytes - lastLoaded;
            const instantSpeed = bytesDelta / elapsedSec;
            speedSamples.push(instantSpeed);
            if (speedSamples.length > 5) speedSamples.shift();
            const avgSpeed = speedSamples.reduce((a, b) => a + b, 0) / speedSamples.length;

            const remaining = Math.max(totalBytes - receivedBytes, 0);
            const etaSec = avgSpeed > 0 ? remaining / avgSpeed : 0;

            lastLoaded = receivedBytes;
            lastTime = now;

            onProgress({
              percent: totalBytes > 0 ? Math.min(100, (receivedBytes / totalBytes) * 100) : 0,
              speedMbps: avgSpeed / (1024 * 1024),
              etaSec,
              retrying: false,
            });
          }
        }
      }

      // s-a terminat cu succes
      onProgress({ percent: 100, speedMbps: 0, etaSec: 0, retrying: false });
      return new Blob(chunks as BlobPart[]);
    } catch (err) {
      attempt++;
      if (attempt > maxRetries) throw err;
      onProgress({
        percent: totalBytes > 0 ? Math.min(100, (receivedBytes / totalBytes) * 100) : 0,
        speedMbps: 0,
        etaSec: 0,
        retrying: true,
      });
      const delay = retryDelays[Math.min(attempt - 1, retryDelays.length - 1)];
      await new Promise((r) => setTimeout(r, delay));
      // bucla reincepe si trimite Range de la receivedBytes — reluare reala, nu de la zero
    }
  }
}

export default function DownloadLinkPage() {
  const params = useParams();
  const token = params.token as string;

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
    async function loadSellerDetails() {
      if (!token) return;
      try {
        const res = await fetch(`/api/cloud/redeem?token=${token}`);
        const data = await res.json();
        if (data?.seller_name) setSellerName(data.seller_name);
        if (data?.filename) setContentName(data.filename);
      } catch (err) {
        console.error("Eroare la preluarea vânzătorului:", err);
      } finally {
        setFetchingSeller(false);
      }
    }
    loadSellerDetails();
    return () => { cancelledRef.current = true; };
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setDlProgress(null);

    try {
      const res = await fetch("/api/cloud/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, code }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Denied access code.");
        setLoading(false);
        return;
      }

      // NOU: in loc de window.location.href (fara progres, fara reluare),
      // descarcam manual cu progres real si reluare pe Range requests.
      setDlProgress({ percent: 0, speedMbps: 0, etaSec: 0, retrying: false });

      const blob = await downloadResumable(data.url, (p) => {
        if (!cancelledRef.current) setDlProgress(p);
      });

      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = contentName || "download";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);

      setDone(true);
    } catch (err: any) {
      setError(err.message || "Network error. please try later");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col justify-between px-6 py-12 md:py-24 font-sans text-zinc-900 antialiased selection:bg-zinc-100">

      {/* Top Header discret (Branding iMIDI încorporat nativ) */}
      <header className="max-w-md w-full mx-auto flex items-center justify-between text-[11px] font-medium tracking-widest text-zinc-400 uppercase select-none">
        <span>iMIDI CLOUD infrastructure</span>
        <div className="flex items-center gap-1.5" />
      </header>

      {/* Corpul Principal - Borderless / Încorporat fluid */}
      <main className="max-w-md w-full mx-auto flex-1 flex flex-col justify-center space-y-8 my-auto">

        {/* Secțiune Informații Vânzător și Content (Integrată curat) */}
        <div className="space-y-2 text-left">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase">
              Digital Delivery
            </span>
            <span className="text-zinc-300">•</span>
            <span className="text-[10px] font-medium text-zinc-500">
              {fetchingSeller ? "syncing..." : `by ${sellerName}`}
            </span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 md:text-3xl break-words">
            {fetchingSeller ? (
              <span className="text-zinc-200 animate-pulse">Loading content name...</span>
            ) : (
              contentName
            )}
          </h1>

          <p className="text-sm text-zinc-500 leading-relaxed pt-1">
            This repository contains high-fidelity digital content protected by imidi.co.uk. Please enter your cryptographic access key below to pull the files. Can download one time
            after recept the code.
          </p>
        </div>

        {/* Zona interactivă de download */}
        <div className="pt-2">
          {done ? (
            <div className="p-5 bg-zinc-50 rounded-2xl text-left border border-zinc-100 flex items-start gap-3">
              <span className="text-emerald-600 font-bold text-base mt-0.5">↓</span>
              <div>
                <h4 className="text-sm font-semibold text-zinc-900">Handshake Successful</h4>
                <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
                  The secure pipeline is open. Your file has been downloaded to this device.
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Input minimalist */}
              <div className="space-y-1.5 text-left">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block px-0.5">
                  Access Key
                </label>
                <input
                  type="text"
                  required
                  disabled={loading}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Paste your code here"
                  autoFocus
                  className="w-full h-12 bg-zinc-50 border border-zinc-200/80 rounded-xl px-4 text-sm font-medium text-zinc-900 outline-none transition-all duration-200 focus:border-zinc-900 focus:bg-white placeholder:text-zinc-400 shadow-sm disabled:opacity-60"
                />
              </div>

              {/* NOU: card de progres download — % real, viteza, ETA, stare reconectare */}
              {dlProgress && (
                <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100 space-y-2 text-left">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
                    <span className="text-zinc-500">
                      {dlProgress.retrying ? "Reconnecting..." : "Downloading"}
                    </span>
                    <span className="text-zinc-900">{Math.round(dlProgress.percent)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-200 ease-out ${
                        dlProgress.retrying ? "bg-amber-400 animate-pulse" : "bg-zinc-900"
                      }`}
                      style={{ width: `${dlProgress.percent}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-zinc-400 font-medium uppercase tracking-wider">
                    <span>{formatSpeed(dlProgress.speedMbps)}</span>
                    <span>ETA: {formatEta(dlProgress.etaSec)}</span>
                  </div>
                </div>
              )}

              {error && (
                <div className="text-xs text-red-600 font-medium bg-red-50/50 border border-red-100 p-3 rounded-xl text-left flex items-center gap-2">
                  <span className="font-bold">✕</span> {error}
                </div>
              )}

              {/* Buton minimalist solid */}
              <button
                type="submit"
                disabled={loading || fetchingSeller}
                className="w-full h-12 bg-zinc-900 text-white text-sm font-medium rounded-xl disabled:opacity-20 disabled:pointer-events-none transition-all duration-200 hover:bg-zinc-800 active:scale-[0.99] flex items-center justify-center tracking-wide"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {dlProgress ? `${Math.round(dlProgress.percent)}%` : "Authorizing..."}
                  </span>
                ) : (
                  "Download"
                )}
              </button>
            </form>
          )}
        </div>
      </main>

      {/* Footer curat, încorporat direct la baza ecranului */}
      <footer className="max-w-md w-full mx-auto text-left text-[10px] text-zinc-400 font-medium tracking-wide flex justify-between items-center select-none border-t border-zinc-100 pt-4">
        <span className="hover:text-zinc-600 transition-colors">imidi.co.uk</span>
      </footer>

    </div>
  );
}