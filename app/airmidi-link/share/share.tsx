"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

// 1. Componenta principală care conține logica de share
function ShareContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const roomCode = searchParams.get("room") || "";
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const base = window.location.origin;
      setShareUrl(roomCode ? `${base}/airmidi-link?room=${roomCode}` : `${base}/airmidi-link`);
    }
  }, [roomCode]);

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Eroare la copiere link:", err);
    }
  };

  return (
    <div className="w-full max-w-md bg-[#111A2B] border border-[#22304A] rounded-2xl p-6 shadow-xl text-center">
      <h1 className="text-2xl font-bold text-white mb-2">
        Partajează Conexiunea AirMIDI
      </h1>
      <p className="text-slate-400 text-sm mb-6">
        Trimite acest link sau codul QR partenerului tău pentru a conecta dispozitivele MIDI la distanță.
      </p>

      {roomCode && (
        <div className="bg-[#1A2740] border border-[#22304A] rounded-xl p-4 mb-6">
          <span className="text-xs uppercase tracking-wider text-slate-500 block font-semibold mb-1">
            Cod Cameră Activă
          </span>
          <span className="text-3xl font-mono font-bold text-emerald-400 tracking-widest">
            {roomCode}
          </span>
        </div>
      )}

      <div className="flex items-center space-x-2 mb-6">
        <input
          type="text"
          readOnly
          value={shareUrl}
          className="flex-1 p-3 text-xs bg-[#0E1626] border border-[#31456A] rounded-xl text-slate-300 focus:outline-none font-mono"
        />
        <button
          onClick={handleCopy}
          className={`px-4 py-3 text-sm font-medium text-white rounded-xl transition-colors ${
            copied ? "bg-emerald-600" : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {copied ? "Copiat" : "Copiază"}
        </button>
      </div>

      <div className="flex flex-col items-center justify-center p-4 bg-white rounded-xl mx-auto w-48 h-48 mb-2">
        {shareUrl ? (
          <img
            src={`https://googleapis.com{encodeURIComponent(shareUrl)}`}
            alt="Cod QR AirMIDI"
            className="w-40 h-40 object-contain"
          />
        ) : (
          <div className="text-slate-900 text-xs">Se generează codul QR...</div>
        )}
      </div>
      <span className="text-xs text-slate-500 block mb-6">Scanează camera cu telefonul</span>

      <button
        onClick={() => router.back()}
        className="text-sm text-slate-400 hover:text-white transition-colors underline"
      >
        Înapoi la consolă
      </button>
    </div>
  );
}

// 2. Exportul default obligatoriu învelit în Suspense pentru a opri eroarea de build Next.js
export default function AirMidiSharePage() {
  return (
    <div className="am-root am-dark min-h-screen flex flex-col bg-[#0B1220] text-[#E6EDF7]">
      <Navbar />
      
      <main className="flex-1 flex items-center justify-center p-6 am-grid">
        <Suspense fallback={<div className="text-white text-sm">Se încarcă detaliile...</div>}>
          <ShareContent />
        </Suspense>
      </main>

      <Footer />
    </div>
  );
}
