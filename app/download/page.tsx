"use client";

import { useState, useEffect } from "react";
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
              x={46 + i * 10.5}
              y={130 - h}
              width="5"
              height={h}
              rx="2.5"
              fill={i % 3 === 0 ? "#0070F3" : "#3B93FF"}
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
                x={46 + col * 66}
                y={168 + row * 66}
                width="54"
                height="54"
                rx="10"
                fill={active ? "#0070F3" : "#171A20"}
                stroke="#23262E"
                strokeWidth="1.5"
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
        <PhoneIllustration className="absolute -top-8 -right-20 sm:-top-10 sm:-right-16 lg:right-8 w-[260px] sm:w-[340px] lg:w-[400px] opacity-90 rotate-[8deg]" />
      </div>

      <div className="corp-sans bg-white/80 backdrop-blur-sm border-b border-[#E2E2E5] pt-32 pb-12 text-left relative z-10">
        <div className="w-full max-w-3xl mx-auto px-6 space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-black">Download TS4X Android App</h1>
          <p className="text-sm text-[#666666] leading-relaxed max-w-lg">
            Get the certified application package tailored for real-time mobile MIDI audio engine processing.
          </p>
        </div>
      </div>

      <main className="corp-sans flex-1 w-full max-w-3xl mx-auto px-6 py-12 relative z-10">
        <div className="bg-white border border-[#E2E2E5] rounded-xl p-6 shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex flex-col gap-6 transition-all hover:border-[#CCCCCC]">

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="space-y-3 text-left flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#FAFAFA] border border-[#EAEAEA] text-black tracking-wide uppercase">Android OS </span>
                <span className="corp-mono text-[11px] text-[#0070F3] font-medium">{GITHUB_TAG}-stable</span>
                <span className="text-[11px] text-gray-400">• Size: {assetSize ?? "3.23 MB"}</span>

                {downloadCount !== null && (
                  <span className="text-[11px] text-gray-500 font-medium bg-blue-50/50 px-2 py-0.5 rounded border border-blue-100/60">
                    • {downloadCount} {downloadCount === 1 ? "download" : "downloads"}
                  </span>
                )}
              </div>

              <div>
                <h2 className="text-sm font-semibold text-black tracking-tight truncate">iMIDI Stage Mobile Terminal Bundle</h2>
                <p className="text-xs text-[#666666] mt-0.5">APK Binary Component (ARM64 Architecture) for low-latency wired setups. Requires Android 12 minimum.</p>
              </div>

              <div className="corp-mono text-[10px] text-gray-400 truncate bg-[#FAFAFA] border border-[#EAEAEA] rounded px-2 py-1 inline-block max-w-full">
               sha256:a9e24eb9059402a83ae84583e91e09eee51a554c75df3b055b684cb2c5d8fbd4
              </div>
            </div>

            <div className="shrink-0 pt-2 sm:pt-0">
              <a
                href={downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleButtonClick}
                className={`w-full sm:w-auto h-10 px-5 rounded-lg text-xs font-medium tracking-wide transition-colors shadow-sm flex items-center justify-center gap-1.5 font-sans ${
                  isDownloading
                    ? "bg-[#FAFAFA] text-gray-400 border border-[#EAEAEA] pointer-events-none"
                    : "bg-black text-white hover:bg-[#222]"
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
                  className="bg-[#0070F3] h-full transition-all duration-150 ease-out rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

        </div>
      </main>

      <Footer />
    </div>
  );
}