"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

export default function DownloadLinkPage() {
  const params = useParams();
  const token = params.token as string;

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  // Stări pentru datele reale ale vânzătorului
  const [sellerName, setSellerName] = useState("Verified iMIDI Seller");
  const [fetchingSeller, setFetchingSeller] = useState(true);

  // Apelăm API-ul nostru de backend pentru a trage numele vânzătorului
  useEffect(() => {
    async function loadSellerDetails() {
      if (!token) return;
      try {
        const res = await fetch(`/api/cloud/redeem?token=${token}`);
        const data = await res.json();
        if (data?.seller_name) {
          setSellerName(data.seller_name);
        }
      } catch (err) {
        console.error("Eroare la preluarea vânzătorului:", err);
      } finally {
        setFetchingSeller(false);
      }
    }
    loadSellerDetails();
  }, [token]);

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
        setError(data.error || "Denied access code.");
        return;
      }

      window.location.href = data.url;
      setDone(true);
    } catch {
      setError("Network error. please try later");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4 relative overflow-hidden font-sans select-none selection:bg-teal-500/30 selection:text-teal-200">
      
      {/* Background neon abstract de atmosferă cinematică */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-teal-500/10 rounded-full blur-[80px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-[300px] h-[300px] bg-orange-500/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Cardul principal cu efect premium de sticlă fumurie (Glassmorphism) */}
      <div className="bg-zinc-900/60 border border-white/5 backdrop-blur-xl rounded-3xl p-7 max-w-sm w-full shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-zinc-800/50 text-center relative z-10 transition-all duration-300">
        
        {/* Glow discret pe rama de sus */}
        <div className="absolute top-0 inset-x-10 h-px bg-gradient-to-r from-transparent via-teal-500/30 to-transparent" />

        {/* SECȚIUNE: AVATAR & NUME VÂNZĂTOR */}
        <div className="flex flex-col items-center space-y-3 border-b border-white/[0.04] pb-5">
          <div className="relative group">
            {/* Efect de inel cu animație fină de rotație */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-teal-500/30 via-orange-500/20 to-transparent blur-[2px]" />
            <div className="w-14 h-14 bg-zinc-900 border border-white/10 rounded-full flex items-center justify-center font-bold text-white tracking-wider text-base uppercase relative z-10 shadow-inner">
              {sellerName.substring(0, 2)}
            </div>
            {/* Indicator verde de securitate / online */}
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-teal-400 border-2 border-zinc-900 rounded-full z-20 shadow-lg animate-pulse" />
          </div>

          <div className="space-y-0.5">
            <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest block">SECURE ENCRYPTED TRANSFER</span>
            <h2 className="text-sm font-semibold text-white tracking-wide">
              {fetchingSeller ? (
                <span className="text-zinc-500 inline-flex items-center gap-1 animate-pulse">Retrieving sender...</span>
              ) : (
                sellerName
              )}
            </h2>
          </div>
        </div>

        {/* SECȚIUNE: TEXTE DE TITLU */}
        <div className="space-y-2 pt-2">
          <h1 className="text-xl font-bold tracking-tight text-white bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-transparent">
            Decrypt & Download
          </h1>
          <p className="text-xs text-zinc-400 leading-relaxed px-2">
            Enter the unique crypto token key provided by the operator. Secure smart gateway by <span className="text-teal-400 font-medium">iMIDI Cloud</span>.
          </p>
        </div>

        {/* SECȚIUNE: FORMULAR INTERACTIV SAU SUCCES */}
        <div className="pt-2">
          {done ? (
            <div className="space-y-3 p-4 bg-teal-950/20 border border-teal-500/20 rounded-2xl animate-fade-in">
              <div className="w-8 h-8 rounded-full bg-teal-500/10 border border-teal-400/30 flex items-center justify-center mx-auto text-teal-400">
                ✓
              </div>
              <p className="text-xs text-teal-300 font-medium tracking-wide">
                The secure bridge has opened. Your download has started automatically.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative group">
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="•••• •••• ••••"
                  autoFocus
                  className="w-full h-12 text-center tracking-[0.2em] font-mono bg-zinc-950/80 border border-white/5 rounded-xl px-4 text-sm text-teal-300 outline-none placeholder:text-zinc-700 focus:border-teal-500/40 focus:ring-1 focus:ring-teal-500/20 transition-all duration-300 shadow-inner group-hover:border-white/10"
                />
              </div>

              {error && (
                <p className="text-xs text-orange-400 font-medium bg-orange-500/5 border border-orange-500/10 py-2 rounded-xl animate-shake">
                  ⚠️ {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || fetchingSeller}
                className="group relative w-full h-12 bg-white text-zinc-950 text-xs font-bold uppercase tracking-wider rounded-xl disabled:opacity-30 disabled:pointer-events-none transition-all duration-300 hover:bg-zinc-100 hover:scale-[1.01] active:scale-[0.99] shadow-lg shadow-white/5 overflow-hidden"
              >
                {/* Micro-glow effect în interiorul butonului la hover */}
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-shimmer transition-transform duration-1000" />
                
                <span className="relative z-10 flex items-center justify-center gap-1.5">
                  {loading ? (
                    <>
                      <svg className="animate-spin h-3 w-3 text-zinc-900" xmlns="http://w3.org" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Validating Hash...
                    </>
                  ) : (
                    "Authorize Download"
                  )}
                </span>
              </button>
            </form>
          )}
        </div>

        {/* Footer-ul discret de accesibilitate */}
        <div className="pt-2 text-[10px] text-zinc-600 tracking-wide">
          End-to-End Cryptographic Security Node
        </div>

      </div>
    </div>
  );
}
