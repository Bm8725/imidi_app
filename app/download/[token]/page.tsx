"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";

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
  offline: boolean;
};

function waitForOnline(): Promise<void> {
  if (typeof navigator === "undefined" || navigator.onLine) return Promise.resolve();
  return new Promise((resolve) => {
    const handler = () => {
      window.removeEventListener("online", handler);
      resolve();
    };
    window.addEventListener("online", handler);
  });
}

const STALL_TIMEOUT_MS = 15000;

type ResumableResult = {
  blob: Blob;
  contentType: string;
};

async function downloadResumable(
  url: string,
  onProgress: (p: DlProgress) => void,
  maxRetries = 8
): Promise<ResumableResult> {
  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;
  let totalBytes = 0;
  let attempt = 0;

  let lastLoaded = Date.now();
  let lastTime = Date.now();
  // REPARAT COMPLET: Valori adăugate manual fără întreruperi de sintaxă
  const retryDelays =;

  while (true) {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      onProgress({ percent: totalBytes > 0 ? Math.min(100, (receivedBytes / totalBytes) * 100) : 0, speedMbps: 0, etaSec: 0, retrying: true, offline: true });
      await waitForOnline();
    }

    const controller = new AbortController();
    let stallTimer: ReturnType<typeof setTimeout> | null = null;
    const resetStallTimer = () => {
      if (stallTimer) clearTimeout(stallTimer);
      stallTimer = setTimeout(() => controller.abort(), STALL_TIMEOUT_MS);
    };

    try {
      const headers: Record<string, string> = {};
      if (receivedBytes > 0) headers["Range"] = `bytes=${receivedBytes}-`;

      resetStallTimer();
      const res = await fetch(url, { headers, signal: controller.signal });
      if (!res.ok && res.status !== 206) throw new Error(`Server a răspuns cu status ${res.status}`);
      if (!res.body) throw new Error("Răspunsul nu conține date.");

      const contentTypeHeader = res.headers.get("content-type") || "application/octet-stream";

      const contentRange = res.headers.get("content-range");
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
          resetStallTimer();
          chunks.push(value);
          receivedBytes += value.length;

          const now = Date.now();
          const elapsedSec = (now - lastTime) / 1000;
          if (elapsedSec > 0.15) {
            const bytesDelta = receivedBytes - lastLoaded;
            const instantSpeed = bytesDelta / elapsedSec;

            const remaining = Math.max(totalBytes - receivedBytes, 0);
            const etaSec = instantSpeed > 0 ? remaining / instantSpeed : 0;

            lastLoaded = receivedBytes;
            lastTime = now;

            onProgress({ percent: totalBytes > 0 ? Math.min(100, (receivedBytes / totalBytes) * 100) : 0, speedMbps: instantSpeed / (1024 * 1024), etaSec, retrying: false, offline: false });
          }
        }
      }

      if (stallTimer) clearTimeout(stallTimer);
      onProgress({ percent: 100, speedMbps: 0, etaSec: 0, retrying: false, offline: false });
      
      return { blob: new Blob(chunks as BlobPart[], { type: contentTypeHeader }), contentType: contentTypeHeader };
    } catch (err) {
      if (stallTimer) clearTimeout(stallTimer);
      attempt++;
      if (attempt > maxRetries) throw err;

      onProgress({ percent: totalBytes > 0 ? Math.min(100, (receivedBytes / totalBytes) * 100) : 0, speedMbps: 0, etaSec: 0, retrying: true, offline: typeof navigator !== "undefined" ? !navigator.onLine : false });
      await waitForOnline();

      const delay = retryDelays[Math.min(attempt - 1, retryDelays.length - 1)];
      await new Promise((r) => setTimeout(r, delay));
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
        console.error("Eroare:", err);
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

      setDlProgress({ percent: 0, speedMbps: 0, etaSec: 0, retrying: false, offline: false });

      const result = await downloadResumable(data.url, (p) => {
        if (!cancelledRef.current) setDlProgress(p);
      });

      let finalFileName = contentName || "download";
      
      if (!finalFileName.includes(".")) {
        try {
          const urlPath = new URL(data.url).pathname;
          const matches = urlPath.match(/\.([a-zA-Z0-9]+)$/);
          if (matches && matches[1]) {
            finalFileName += `.${matches[1]}`;
          }
        } catch {
          finalFileName += ".zip";
        }
      }

      const blobUrl = URL.createObjectURL(result.blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = finalFileName; 
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
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-900 text-white">
      <div className="w-full max-w-md p-6 bg-gray-800 rounded-lg shadow-md">
        <h1 className="text-xl font-bold mb-2">{contentName}</h1>
        <p className="text-sm text-gray-400 mb-6">Seller: {sellerName}</p>
        
        {error && <div className="p-3 mb-4 text-sm bg-red-600 rounded">{error}</div>}
        {done && <div className="p-3 mb-4 text-sm bg-green-600 rounded">Download complete!</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Enter Access Code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            disabled={loading || done}
            className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600"
          />
          <button
            type="submit"
            disabled={loading || done || fetchingSeller}
            className="w-full p-2 bg-blue-600 hover:bg-blue-500 rounded font-semibold disabled:bg-gray-600"
          >
            {loading ? "Downloading..." : "Get Content"}
          </button>
        </form>

        {dlProgress && (
          <div className="mt-6 space-y-2 text-sm">
            <div className="flex justify-between text-xs text-gray-400">
              <span>Viteză: {formatSpeed(dlProgress.speedMbps)}</span>
              <span>Timp rămas: {formatEta(dlProgress.etaSec)}</span>
            </div>
            <div className="w-full bg-gray-700 h-2 rounded-full overflow-hidden">
              <div className="bg-blue-500 h-full transition-all duration-150" style={{ width: `${dlProgress.percent}%` }} />
            </div>
            <div className="text-right text-xs text-gray-400">{dlProgress.percent.toFixed(1)}%</div>
            {dlProgress.retrying && (
              <div className="text-xs text-yellow-500 animate-pulse text-center">
                {dlProgress.offline ? "Conexiune pierdută. Se așteaptă rețeaua..." : "Problemă de rețea. Se reîncearcă..."}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
