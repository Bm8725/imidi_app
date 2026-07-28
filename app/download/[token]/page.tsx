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
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center px-4 relative overflow-hidden font-sans select-none selection:bg-cyan-500/10 selection:text-cyan-800">
      
      {/* BACKGROUND DESCHIS: Grid minimalist fin de rețea */}
      <div className="absolute inset-0 bg-[radial-gradient(#e4e4e7_1px,transparent_1px)] [background-size:20px_20px] opacity-70 pointer-events-none" />
      
      {/* BACKGROUND GLOw: Efecte difuze de lumină deschisă în colțuri */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-br from-cyan-400/20 via-blue-400/10 to-transparent rounded-full blur-[100px] pointer-events-none" />

      {/* CARDUL PRINCIPAL: Design alb imaculat, curat și tech */}
      <div className="bg-white/80 border border-zinc-200/80 backdrop-blur-2xl rounded-3xl p-8 max-w-sm w-full shadow-[0_20px_50px_rgba(0,0,0,0.05)] text-center relative z-10 transition-all duration-500 hover:border-cyan-500/30 group">
        
        {/* Top Accent Line (Indicator discret de cloud activ) */}
        <div className="absolute top-0 inset-x-20 h-[3px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent rounded-full" />

        {/* SECȚIUNEA 1: CLOUD ROUTING & OPERATOR */}
        <div className="flex flex-col items-center space-y-3 border-b border-zinc-100 pb-5">
          
          <div className="relative">
            {/* Undă fină pulsatorie de rețea */}
            <span className="absolute inset-0 rounded-full border border-cyan-500/30 animate-ping opacity-25 pointer-events-none scale-105" />
            
            <div className="w-14 h-14 bg-zinc-50 border border-zinc-200/60 rounded-2xl flex items-center justify-center relative z-10 shadow-sm group-hover:border-cyan-500/20 transition-colors duration-300">
              {/* Iconiță Cloud modernă cyan */}
              <svg xmlns="http://w3.org" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7 text-cyan-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
              </svg>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[9px] font-bold text-cyan-600 uppercase tracking-[0.2em] block">Cloud Storage Node</span>
            <div className="flex items-center justify-center gap-1.5 bg-zinc-50 border border-zinc-200/50 px-3 py-1 rounded-full shadow-sm">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_5px_#10b981]" />
              <h2 className="text-xs font-semibold text-zinc-700 tracking-wide">
                {fetchingSeller ? "Resolving cluster..." : `Owner: ${sellerName}`}
              </h2>
            </div>
          </div>
        </div>

        {/* SECȚIUNEA 2: TITLURI DE SERVICIU */}
        <div className="space-y-1.5 pt-4">
          <h1 className="text-base font-bold tracking-wider text-zinc-900 uppercase">
            Secure Digital Asset
          </h1>
          <p className="text-[11px] text-zinc-500 leading-relaxed px-1">
            This cloud repository is encrypted. Please authenticate via your gateway token to pull the high-fidelity sound banks.
          </p>
        </div>

        {/* SECȚIUNEA 3: INPUT & DECRIPTARE */}
        <div className="pt-4">
          {done ? (
            <div className="space-y-3 p-4 bg-cyan-50 border border-cyan-200 rounded-2xl animate-fade-in">
              <div className="w-7 h-7 rounded-full bg-cyan-500/10 border border-cyan-400/20 flex items-center justify-center mx-auto text-cyan-600 font-bold">
                ↓
              </div>
              <p className="text-xs text-cyan-800 font-medium tracking-wide">
                Connection established. File downloading automatically...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Input deschis tip consolă */}
              <div className="relative">
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="ENTER ACCESS KEY"
                  autoFocus
                  className="w-full h-11 text-center tracking-[0.15em] font-mono bg-zinc-50 border border-zinc-200 rounded-xl px-4 text-xs text-cyan-600 font-bold outline-none placeholder:text-zinc-400 focus:border-cyan-500/50 focus:bg-white transition-all duration-300"
                />
                {/* Margini fine discrete de colț */}
                <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-zinc-300 rounded-tl-md pointer-events-none" />
                <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-zinc-300 rounded-br-md pointer-events-none" />
              </div>

              {error && (
                <p className="text-[11px] text-red-600 font-semibold bg-red-50 border border-red-200 py-2 rounded-xl">
                  ✕ {error}
                </p>
              )}

              {/* Buton Premium Solid Cyan */}
              <button
                type="submit"
                disabled={loading || fetchingSeller}
                className="w-full h-11 bg-zinc-900 text-white text-xs font-bold uppercase tracking-wider rounded-xl disabled:opacity-20 disabled:pointer-events-none transition-all duration-300 hover:bg-cyan-600 hover:shadow-[0_4px_12px_rgba(6,182,212,0.2)] active:scale-[0.99] flex items-center justify-center"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-3.5 w-3.5 text-white" xmlns="http://w3.org" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Decrypting Pipeline...
                  </span>
                ) : (
                  "Request Cloud Delivery"
                )}
              </button>
            </form>
          )}
        </div>

        {/* SECȚIUNEA 4: FOOTER METADATA */}
        <div className="pt-4 border-t border-zinc-100 mt-3 flex items-center justify-between text-[9px] text-zinc-400 uppercase tracking-widest font-mono">
          <span>SaaS Service v4.0</span>
          <span>imidi.co.uk</span>
        </div>

      </div>
    </div>
  );
}
