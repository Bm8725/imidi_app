"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";

/**
 * IndexedDB helper minimal, fara dependinte externe.
 * Tinem un singur store cu blob-uri partiale, cheia fiind token-ul.
 * Motiv: putem stoca Blob-uri mari fara sa trecem prin base64
 * (care ar umfla memoria si ar bloca thread-ul principal).
 */
const DB_NAME = "imidi-downloads";
const STORE_NAME = "partials";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key: string): Promise<Blob | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result as Blob | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: Blob): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDelete(key: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Metadata sesiunii de descarcare, persistata in sessionStorage.
 * Codul e single-use, dar URL-ul semnat e valabil 30 min - deci dupa
 * ce a fost "rascumparat" o data, nu mai avem nevoie de cod ca sa
 * reluam descarcarea daca pica netul sau userul da refresh din greseala.
 */
type DownloadSession = {
  url: string;
  filename: string; // exact cum vine din backend - nu se atinge, nu se schimba extensia
  expiresAt: number; // epoch ms
};

function sessionKey(token: string) {
  return `imidi_dl_session_${token}`;
}

function loadSession(token: string): DownloadSession | null {
  try {
    const raw = sessionStorage.getItem(sessionKey(token));
    if (!raw) return null;
    const parsed: DownloadSession = JSON.parse(raw);
    if (!parsed.expiresAt || parsed.expiresAt < Date.now()) {
      sessionStorage.removeItem(sessionKey(token));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveSession(token: string, session: DownloadSession) {
  sessionStorage.setItem(sessionKey(token), JSON.stringify(session));
}

function clearSession(token: string) {
  sessionStorage.removeItem(sessionKey(token));
}

/** Backoff exponential cu jitter, plafonat. */
function backoffDelay(attempt: number) {
  const base = Math.min(1000 * 2 ** attempt, 20000);
  return base + Math.random() * 400;
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Asteapta pana revine conexiunea (daca browserul o raporteaza ca offline). */
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

const MAX_RETRIES = 8;

type DownloadStatus =
  | "idle"
  | "connecting"
  | "downloading"
  | "reconnecting"
  | "finalizing"
  | "done"
  | "error";

export default function DownloadLinkPage() {
  const params = useParams();
  const token = params.token as string;

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [sellerName, setSellerName] = useState("Verified iMIDI Seller");
  const [contentName, setContentName] = useState("Digital Content Package");
  const [fetchingSeller, setFetchingSeller] = useState(true);

  const [status, setStatus] = useState<DownloadStatus>("idle");
  const [progress, setProgress] = useState(0); // 0-100, sau -1 daca serverul nu trimite Content-Length
  const [attempt, setAttempt] = useState(0);

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
        console.error("Eroare la preluarea vanzatorului:", err);
      } finally {
        setFetchingSeller(false);
      }
    }
    loadSellerDetails();
  }, [token]);

  // Daca exista deja o sesiune valida (ex: userul a dat refresh in timpul
  // descarcarii), reluam automat, fara sa mai cerem codul din nou.
  useEffect(() => {
    if (!token) return;
    const existing = loadSession(token);
    if (existing) {
      runDownload(existing);
    }
    return () => {
      cancelledRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  /**
   * Descarca fisierul in streaming, cu progres real, reluare de la ultimul
   * byte primit (Range requests) si retry cu backoff exponential la orice
   * eroare de retea. Numele fisierului (inclusiv extensia) e cel primit
   * de la backend si nu e modificat in niciun punct al fluxului.
   */
  const runDownload = useCallback(
    async (session: DownloadSession) => {
      cancelledRef.current = false;
      setError("");
      setStatus("connecting");

      const partialKey = `partial_${token}`;
      let downloadedBytes = 0;

      const existingBlob = await idbGet(partialKey).catch(() => undefined);
      if (existingBlob && existingBlob.size > 0) {
        downloadedBytes = existingBlob.size;
      }

      let localAttempt = 0;

      while (!cancelledRef.current) {
        try {
          setStatus(localAttempt === 0 ? "connecting" : "reconnecting");

          const headers: Record<string, string> = {};
          if (downloadedBytes > 0) {
            headers["Range"] = `bytes=${downloadedBytes}-`;
          }

          const res = await fetch(session.url, { headers });

          if (!res.ok && res.status !== 206) {
            // Link-ul semnat poate expira (dupa 30 min) - nu mai are rost
            // sa reincercam, userul trebuie sa regenereze codul.
            if (res.status === 403 || res.status === 404 || res.status === 410) {
              clearSession(token);
              await idbDelete(partialKey).catch(() => {});
              throw new Error(
                "Link-ul de descarcare a expirat. Reimprospateaza pagina si introdu codul din nou."
              );
            }
            throw new Error(`Eroare server: ${res.status}`);
          }

          const contentRange = res.headers.get("Content-Range"); // ex: bytes 1000-1999/2000
          const totalFromRange = contentRange ? Number(contentRange.split("/")[1]) : null;
          const contentLength = res.headers.get("Content-Length");
          const total =
            totalFromRange ?? (contentLength ? downloadedBytes + Number(contentLength) : null);

          if (!res.body) {
            // fallback fara streaming (browser vechi): descarcam tot dintr-o data
            const blob = await res.blob();
            const merged =
              downloadedBytes > 0 && existingBlob ? new Blob([existingBlob, blob]) : blob;
            await idbSet(partialKey, merged);
            downloadedBytes = merged.size;
            setProgress(100);
            break;
          }

          setStatus("downloading");
          const reader = res.body.getReader();
          const chunks: Uint8Array[] = [];
          let receivedThisRound = 0;

          const flush = async () => {
            if (chunks.length === 0) return;
            const roundBlob = new Blob(chunks as BlobPart[]);
            const base = await idbGet(partialKey).catch(() => undefined);
            const merged = base ? new Blob([base, roundBlob]) : roundBlob;
            await idbSet(partialKey, merged);
            chunks.length = 0;
          };

          while (true) {
            if (cancelledRef.current) return;
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              chunks.push(value);
              receivedThisRound += value.byteLength;
              downloadedBytes += value.byteLength;

              if (total) {
                setProgress(Math.min(99, Math.round((downloadedBytes / total) * 100)));
              } else {
                setProgress(-1);
              }

              // la fiecare ~2MB salvam progresul pe disc (IndexedDB)
              if (receivedThisRound > 2 * 1024 * 1024) {
                await flush();
                receivedThisRound = 0;
              }
            }
          }
          await flush();

          setProgress(100);
          break;
        } catch (err) {
          if (cancelledRef.current) return;

          localAttempt += 1;
          setAttempt(localAttempt);

          if (localAttempt > MAX_RETRIES) {
            setStatus("error");
            setError(
              err instanceof Error
                ? err.message
                : "Descarcarea a esuat dupa mai multe incercari. Verifica conexiunea si reincearca."
            );
            return;
          }

          setStatus("reconnecting");
          await waitForOnline();
          await wait(backoffDelay(localAttempt));
        }
      }

      if (cancelledRef.current) return;

      setStatus("finalizing");
      const finalBlob = await idbGet(partialKey);
      if (!finalBlob) {
        setStatus("error");
        setError("Fisierul nu a putut fi asamblat. Reincearca.");
        return;
      }

      const objectUrl = URL.createObjectURL(finalBlob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = session.filename; // neschimbat, extensie originala pastrata
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);

      await idbDelete(partialKey).catch(() => {});
      clearSession(token);
      setStatus("done");
    },
    [token]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/cloud/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, code }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Cod de acces respins.");
        return;
      }

      const session: DownloadSession = {
        url: data.url,
        filename: data.filename, // exact ce trimite backend-ul, fara modificari
        expiresAt: Date.now() + 30 * 60 * 1000, // sincron cu TTL-ul de 1800s de pe backend
      };
      saveSession(token, session);
      await runDownload(session);
    } catch {
      setError("Eroare de retea. Incearca din nou.");
    } finally {
      setLoading(false);
    }
  };

  const isBusy =
    status === "connecting" ||
    status === "downloading" ||
    status === "reconnecting" ||
    status === "finalizing";

  return (
    <div className="min-h-screen bg-white flex flex-col justify-between px-6 py-12 md:py-24 font-sans text-zinc-900 antialiased selection:bg-zinc-100">
      <header className="max-w-md w-full mx-auto flex items-center justify-between text-[11px] font-medium tracking-widest text-zinc-400 uppercase select-none">
        <span>iMIDI CLOUD infrastructure</span>
        <div className="flex items-center gap-1.5" />
      </header>

      <main className="max-w-md w-full mx-auto flex-1 flex flex-col justify-center space-y-8 my-auto">
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
            This repository contains high-fidelity digital content protected by imidi.co.uk. Please
            enter your cryptographic access key below to pull the files. One-time download after
            code is redeemed. If your connection drops, this page will automatically resume from
            where it left off.
          </p>
        </div>

        <div className="pt-2">
          {status === "done" ? (
            <div className="p-5 bg-zinc-50 rounded-2xl text-left border border-zinc-100 flex items-start gap-3">
              <span className="text-emerald-600 font-bold text-base mt-0.5">↓</span>
              <div>
                <h4 className="text-sm font-semibold text-zinc-900">Handshake Successful</h4>
                <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
                  Your file has been saved as{" "}
                  <span className="font-medium text-zinc-700">{contentName}</span>.
                </p>
              </div>
            </div>
          ) : isBusy ? (
            <div className="p-5 bg-zinc-50 rounded-2xl text-left border border-zinc-100 space-y-3">
              <div className="flex items-center justify-between text-xs font-medium text-zinc-600">
                <span>
                  {status === "connecting" && "Connecting..."}
                  {status === "downloading" && "Downloading..."}
                  {status === "reconnecting" &&
                    `Connection lost - retrying (attempt ${attempt}/${MAX_RETRIES})...`}
                  {status === "finalizing" && "Finalizing file..."}
                </span>
                {progress >= 0 && <span>{progress}%</span>}
              </div>
              <div className="w-full h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                <div
                  className={`h-full bg-zinc-900 transition-all duration-300 ${
                    progress < 0 ? "animate-pulse w-1/3" : ""
                  }`}
                  style={progress >= 0 ? { width: `${progress}%` } : undefined}
                />
              </div>
              {status === "reconnecting" && (
                <p className="text-[11px] text-amber-600">
                  Nu ai pierdut progresul - reluam exact de unde am ramas, fara cod nou.
                </p>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5 text-left">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block px-0.5">
                  Access Key
                </label>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Paste your code here"
                  autoFocus
                  className="w-full h-12 bg-zinc-50 border border-zinc-200/80 rounded-xl px-4 text-sm font-medium text-zinc-900 outline-none transition-all duration-200 focus:border-zinc-900 focus:bg-white placeholder:text-zinc-400 shadow-sm"
                />
              </div>

              {error && (
                <div className="text-xs text-red-600 font-medium bg-red-50/50 border border-red-100 p-3 rounded-xl text-left flex items-center gap-2">
                  <span className="font-bold">✕</span> {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || fetchingSeller}
                className="w-full h-12 bg-zinc-900 text-white text-sm font-medium rounded-xl disabled:opacity-20 disabled:pointer-events-none transition-all duration-200 hover:bg-zinc-800 active:scale-[0.99] flex items-center justify-center tracking-wide"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg
                      className="animate-spin h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Authorizing...
                  </span>
                ) : (
                  "Download "
                )}
              </button>
            </form>
          )}
        </div>
      </main>

      <footer className="max-w-md w-full mx-auto text-left text-[10px] text-zinc-400 font-medium tracking-wide flex justify-between items-center select-none border-t border-zinc-100 pt-4">
        <span className="hover:text-zinc-600 transition-colors">imidi.co.uk</span>
      </footer>
    </div>
  );
}