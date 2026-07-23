"use client";

import { useState, useEffect } from "react";
import QRCode from "qrcode";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const GITHUB_OWNER = "Bm8725";
const GITHUB_REPO = "imidi_app";
const GITHUB_TAG = "v1.0";

const FALLBACK_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/tag/${GITHUB_TAG}`;

// Ilustrație decorativă de telefon — SVG inline, cu un mock de UI (grid de pad-uri
// + waveform) pe ecran, ca să sugereze aplicația fără să fie un screenshot real.
function PhoneIllustration({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 360 640"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* corp telefon */}
      <rect x="8" y="8" width="344" height="624" rx="44" fill="#111318" />
      <rect x="8" y="8" width="344" height="624" rx="44" stroke="#E2E2E5" strokeWidth="2" />
      {/* ecran */}
      <rect x="22" y="26" width="316" height="588" rx="30" fill="#0B0D11" />
      {/* notch */}
      <rect x="150" y="34" width="60" height="10" rx="5" fill="#1E2128" />

      {/* header ecran */}
      <text x="46" y="76" fill="#F2F2F4" fontFamily="Inter, sans-serif" fontSize="16" fontWeight="700">TS4X</text>
      <circle cx="300" cy="70" r="5" fill="#0070F3" />

      {/* waveform */}
      <g opacity="0.9">
        {Array.from({ length: 26 }).map((_, i) => {
          const heights = [10, 22, 14, 30, 18, 40, 24, 50, 30, 60, 36, 46, 28, 54, 32, 48, 22, 38, 16, 44, 26, 34, 12, 20, 8, 16];
          const h = heights[i % heights.length];
          return (
            <rect
              key={i}
              className="phone-wave-bar"
              x={46 + i * 10.5}
              y={130 - h}
              width="5"
              height={h}
              rx="2.5"
              fill={i % 3 === 0 ? "#0070F3" : "#3B93FF"}
              style={{ animationDelay: `${(i % 8) * 0.08}s` }}
            />
          );
        })}
      </g>

      {/* grid de pad-uri MIDI */}
      <g>
        {Array.from({ length: 4 }).map((_, row) =>
          Array.from({ length: 4 }).map((_, col) => {
            const active = (row === 1 && col === 2) || (row === 2 && col === 0) || (row === 0 && col === 3);
            return (
              <rect
                key={`${row}-${col}`}
                className={active ? "phone-pad-active" : undefined}
                x={46 + col * 66}
                y={168 + row * 66}
                width="54"
                height="54"
                rx="10"
                fill={active ? "#0070F3" : "#171A20"}
                stroke="#23262E"
                strokeWidth="1.5"
                style={active ? { animationDelay: `${(row + col) * 0.3}s` } : undefined}
              />
            );
          })
        )}
      </g>

      {/* bară inferioară / player controls */}
      <rect x="46" y="470" width="268" height="8" rx="4" fill="#1E2128" />
      <rect x="46" y="470" width="150" height="8" rx="4" fill="#0070F3" />
      <circle cx="150" cy="530" r="26" fill="#0070F3" />
      <path d="M142 518l20 12-20 12z" fill="white" />
      <circle cx="80" cy="530" r="16" fill="#171A20" />
      <circle cx="220" cy="530" r="16" fill="#171A20" />
    </svg>
  );
}

export default function AndroidDownloadPage() {
  const [downloadUrl, setDownloadUrl] = useState(FALLBACK_URL);
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadCount, setDownloadCount] = useState<number | null>(null);
  const [assetSize, setAssetSize] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrExpanded, setQrExpanded] = useState(false);

  // Regenerăm QR-ul de fiecare dată când avem un downloadUrl nou (fallback -> link real de la GitHub)
  useEffect(() => {
    QRCode.toDataURL(downloadUrl, {
      width: 480,
      margin: 3,
      errorCorrectionLevel: "M",
      color: { dark: "#0B1220", light: "#FFFFFFFF" },
    })
      .then(setQrDataUrl)
      .catch((err) => console.error("Nu am putut genera QR-ul:", err));
  }, [downloadUrl]);

  async function fetchGitHubData() {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases`,
        { headers: { Accept: "application/vnd.github+json" } }
      );

      if (!response.ok) {
        console.error("Răspuns API invalid de la GitHub:", response.status);
        return;
      }

      const releases = await response.json();
      if (!Array.isArray(releases)) return;

      const release = releases.find((r: any) => r.tag_name === GITHUB_TAG) || releases[0];
      const assets = release?.assets;
      if (!Array.isArray(assets) || assets.length === 0) return;

      const apkAsset =
        assets.find((a: any) => a.name?.toLowerCase().endsWith(".apk")) ??
        assets.find((a: any) => a.name?.includes("TS4X")) ??
        assets[0];

      if (apkAsset) {
        setDownloadCount(typeof apkAsset.download_count === "number" ? apkAsset.download_count : 0);

        if (apkAsset.browser_download_url) {
          setDownloadUrl(apkAsset.browser_download_url);
        }
        if (typeof apkAsset.size === "number") {
          setAssetSize((apkAsset.size / (1024 * 1024)).toFixed(2) + " MB");
        }
      }
    } catch (error) {
      console.error("Eroare la preluarea datelor live:", error);
    }
  }

  useEffect(() => {
    fetchGitHubData();
  }, []);

  useEffect(() => {
    if (!qrExpanded) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setQrExpanded(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [qrExpanded]);

  const handleButtonClick = () => {
    if (isDownloading) return;

    setIsDownloading(true);
    setProgress(0);

    const totalTime = 1500;
    const intervalTime = 30;
    const step = 100 / (totalTime / intervalTime);

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          setTimeout(() => {
            setIsDownloading(false);
            setProgress(0);
            setTimeout(() => {
              fetchGitHubData();
            }, 4000);
          }, 500);
          return 100;
        }
        return Math.min(100, Math.floor(prev + step));
      });
    }, intervalTime);
  };

  return (
    <div className="bg-[#EFEFEF] text-[#111111] min-h-screen flex flex-col antialiased selection:bg-[#0070F3]/10 selection:text-[#0070F3] relative overflow-x-hidden">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        .corp-sans { font-family: 'Inter', sans-serif; }
        .corp-mono { font-family: 'JetBrains Mono', monospace; }

        /* ---- animație pagină: fade-up la intrare, staggered ---- */
        @keyframes dl-fade-up { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .dl-fade-up { opacity: 0; animation: dl-fade-up 0.6s ease-out forwards; }

        /* ---- animație telefon: plutire + wobble ușor + fade-in la intrare ---- */
        @keyframes phone-pop { from { opacity: 0; transform: translateY(24px) scale(0.94) rotate(8deg); } to { opacity: 0.9; transform: translateY(0) scale(1) rotate(8deg); } }
        @keyframes phone-float { 0%, 100% { transform: translateY(0) rotate(8deg); } 50% { transform: translateY(-14px) rotate(6deg); } }
        .phone-illustration {
          animation: phone-pop 0.9s cubic-bezier(0.16,1,0.3,1) forwards,
                     phone-float 6s ease-in-out 0.9s infinite;
          transform-origin: center;
        }

        /* ---- pad-uri MIDI active: puls ușor de glow ---- */
        @keyframes phone-pad-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
        .phone-pad-active { animation: phone-pad-pulse 2.2s ease-in-out infinite; transform-origin: center; }

        /* ---- waveform: bare care "respiră" ---- */
        @keyframes phone-wave { 0%, 100% { transform: scaleY(0.55); } 50% { transform: scaleY(1); } }
        .phone-wave-bar { animation: phone-wave 1.4s ease-in-out infinite; transform-box: fill-box; transform-origin: bottom; }

        /* ---- lightbox QR ---- */
        @keyframes qr-modal-backdrop { from { opacity: 0; } to { opacity: 1; } }
        @keyframes qr-modal-pop { from { opacity: 0; transform: scale(0.9) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .qr-modal-backdrop { animation: qr-modal-backdrop 0.2s ease-out forwards; }
        .qr-modal-card { animation: qr-modal-pop 0.25s cubic-bezier(0.16,1,0.3,1) forwards; }
      `}</style>

      <Navbar />

      {/* ================= FUNDAL DECORATIV — telefon + grilă subtilă ================= */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* grilă foarte discretă, ca să nu fie fundal complet plat */}
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(0,0,0,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.03) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        {/* telefonul — vizibil pe toate ecranele, poziționat sus-dreapta, parțial tăiat de margine */}
        <PhoneIllustration className="phone-illustration absolute -top-8 -right-20 sm:-top-10 sm:-right-16 lg:right-8 w-[260px] sm:w-[340px] lg:w-[400px]" />
      </div>

      <div className="corp-sans bg-white/80 backdrop-blur-sm border-b border-[#E2E2E5] pt-32 pb-12 text-left relative z-10">
        <div className="w-full max-w-3xl mx-auto px-6 space-y-2 dl-fade-up" style={{ animationDelay: "0.05s" }}>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-black">Download TS4X Android App</h1>
          <p className="text-sm text-[#666666] leading-relaxed max-w-lg">
            Get the certified application package tailored for real-time mobile MIDI audio engine processing.
          </p>
        </div>
      </div>

      <main className="corp-sans flex-1 w-full max-w-3xl mx-auto px-6 py-12 relative z-10">
        <div className="dl-fade-up relative rounded-2xl p-[1.5px] bg-gradient-to-br from-[#0070F3]/50 via-[#8B5CF6]/30 to-[#0070F3]/50 shadow-[0_8px_30px_-12px_rgba(0,112,243,0.25)] hover:shadow-[0_12px_40px_-10px_rgba(139,92,246,0.35)] transition-shadow duration-500 group" style={{ animationDelay: "0.15s" }}>
          <div className="bg-white rounded-2xl p-6 flex flex-col gap-6">

            <div className="flex flex-col gap-6">
              {/* Info block — mereu full-width, pe orice ecran */}
              <div className="space-y-3 text-left">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0070F3] to-[#8B5CF6] flex items-center justify-center shrink-0 shadow-[0_4px_12px_-4px_rgba(0,112,243,0.5)]">
                    <svg viewBox="0 0 24 24" className="w-4.5 h-4.5 fill-white">
                      <path d="M17.6 9.48l1.84-3.18c.16-.31.04-.69-.26-.85-.29-.15-.65-.06-.83.22l-1.88 3.24a11.43 11.43 0 0 0-9.94 0L4.65 5.67c-.19-.28-.55-.37-.83-.22-.3.16-.42.54-.26.85L5.4 9.48C2.7 11.13.87 13.94.5 17.19h23c-.37-3.25-2.2-6.06-4.9-7.71zM7 15.25a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5zm10 0a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5z" />
                    </svg>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#0B1220] text-white tracking-wide uppercase">Android OS</span>
                  <span className="corp-mono text-[11px] font-semibold px-2 py-0.5 rounded-md bg-[#0070F3]/10 text-[#0070F3]">{GITHUB_TAG}-stable</span>
                  <span className="text-[11px] text-gray-400">• Size: {assetSize ?? "3.23 MB"}</span>

                  {downloadCount !== null && (
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600 border border-emerald-100">
                      ● {downloadCount} {downloadCount === 1 ? "download" : "downloads"}
                    </span>
                  )}
                </div>

                <div>
                  <h2 className="text-sm font-semibold text-black tracking-tight truncate">TS4x synth android bundle app</h2>
                  <p className="text-xs text-[#666666] mt-0.5">APK Binary Component (ARM64 Architecture) for low-latency wired setups. Requires Android 12 minimum.</p>
                </div>

              </div>

              {/* Actions — rând propriu, full-width, respiră separat de info */}
              <div className="flex flex-col sm:flex-row items-center gap-4 pt-5 border-t border-[#EFEFEF] justify-between">
                <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 w-full sm:w-auto text-center sm:text-left">
                  <button
                    type="button"
                    onClick={() => qrDataUrl && setQrExpanded(true)}
                    aria-label="Enlarge QR code"
                    className="w-[168px] h-[168px] shrink-0 rounded-xl border border-[#EAEAEA] bg-white p-3 shadow-[0_2px_10px_rgba(0,0,0,0.05)] transition-transform duration-200 hover:scale-[1.04] hover:shadow-[0_6px_20px_rgba(0,112,243,0.15)] active:scale-[0.98] cursor-zoom-in"
                  >
                    {qrDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={qrDataUrl}
                        alt="QR code către download-ul APK — click pentru mărire"
                        width={144}
                        height={144}
                        className="w-full h-full object-contain pointer-events-none"
                      />
                    ) : (
                      <div className="w-full h-full rounded-lg bg-[#FAFAFA] animate-pulse" />
                    )}
                  </button>
                  <div className="space-y-0.5">
                    <div className="text-[13px] font-semibold text-black">Scan with your phone</div>
                    <div className="text-[11px] text-gray-400 leading-snug max-w-[180px] mx-auto sm:mx-0">
                      Opens the download directly on your Android device — tap the code to enlarge
                    </div>
                  </div>
                </div>

                <a
                  href={downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleButtonClick}
                  className={`w-full sm:w-auto h-11 px-6 rounded-xl text-xs font-semibold tracking-wide flex items-center justify-center gap-1.5 font-sans transition-all duration-300 shrink-0 ${
                    isDownloading
                      ? "bg-[#FAFAFA] text-gray-400 border border-[#EAEAEA] pointer-events-none"
                      : "bg-gradient-to-r from-[#0070F3] to-[#8B5CF6] text-white shadow-[0_6px_20px_-6px_rgba(0,112,243,0.5)] hover:shadow-[0_8px_26px_-4px_rgba(139,92,246,0.6)] hover:scale-[1.03] active:scale-[0.98]"
                  }`}
                >
                  {isDownloading ? (
                    <>
                      <span className="inline-block animate-spin rounded-full h-3 w-3 border-2 border-gray-300 border-t-gray-600" />
                      <span>Downloading {progress}%</span>
                    </>
                  ) : (
                    <>
                      <span>Download TS4X APK</span>
                      <span className="text-xs">↓</span>
                    </>
                  )}
                </a>
              </div>
            </div>

            {isDownloading && (
              <div className="w-full space-y-1.5 animate-fadeIn">
                <div className="flex justify-between items-center text-[11px] corp-mono text-gray-500">
                  <span>Redirecting to GitHub release asset...</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full bg-[#EAEAEA] h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-[#0070F3] to-[#8B5CF6] h-full transition-all duration-150 ease-out rounded-full"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

          </div>
        </div>
      </main>

      {/* ============================= LIGHTBOX QR ============================= */}
      {qrExpanded && qrDataUrl && (
        <div
          className="qr-modal-backdrop fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center px-6"
          onClick={() => setQrExpanded(false)}
        >
          <div
            className="qr-modal-card relative bg-white rounded-2xl p-6 flex flex-col items-center gap-4 shadow-[0_30px_70px_-20px_rgba(0,0,0,0.5)] max-w-[90vw]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setQrExpanded(false)}
              aria-label="Close"
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-[#0B1220] text-white flex items-center justify-center text-sm hover:bg-black transition-colors shadow-lg"
            >
              ✕
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrDataUrl}
              alt="QR code către download-ul APK — mărit"
              className="w-[280px] h-[280px] sm:w-[340px] sm:h-[340px] object-contain"
            />
            <div className="text-center">
              <div className="text-sm font-semibold text-black">Scan to download TS4X APK</div>
              <div className="corp-mono text-[10px] text-gray-400 mt-1">{GITHUB_TAG}-stable</div>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}