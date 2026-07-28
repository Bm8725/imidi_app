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

  // Stări pentru datele reale ale vânzătorului și ale fișierului
  const [sellerName, setSellerName] = useState("Verified iMIDI Seller");
  // NOU: Stare pentru numele conținutului/fișierului digital
  const [contentName, setContentName] = useState("Digital Content link");
  const [fetchingSeller, setFetchingSeller] = useState(true);

  // Apelăm API-ul nostru de backend pentru a trage detaliile în siguranță
  useEffect(() => {
    async function loadSellerDetails() {
      if (!token) return;
      try {
        const res = await fetch(`/api/cloud/redeem?token=${token}`);
        const data = await res.json();
        if (data?.seller_name) {
          setSellerName(data.seller_name);
        }
        // NOU: Mapăm numele conținutului trimis de backend
        if (data?.filename) {
          setContentName(data.filename);
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
    <div className="min-h-screen bg-white flex flex-col justify-between px-6 py-12 md:py-24 font-sans text-zinc-900 antialiased selection:bg-zinc-100">
      
      {/* Top Header discret (Branding iMIDI încorporat nativ) */}
      <header className="max-w-md w-full mx-auto flex items-center justify-between text-[11px] font-medium tracking-widest text-zinc-400 uppercase select-none">
        <span>iMIDI CLOUD infrastructure</span>
        <div className="flex items-center gap-1.5">
         
          
        </div>
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
          
          {/* NOU: Afișăm titlul real al fișierului primit din DB */}
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 md:text-3xl break-words">
            {fetchingSeller ? (
              <span className="text-zinc-200 animate-pulse">Loading content name...</span>
            ) : (
              contentName
            )}
          </h1>
          
          <p className="text-sm text-zinc-500 leading-relaxed pt-1">
            This repository contains high-fidelity digital content protected by imidi.co.uk. Please enter your cryptographic access key below to pull the files.
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
                  The secure pipeline is open. Your cloud download has been initialized and will start automatically.
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

              {/* Buton minimalist solid */}
              <button
                type="submit"
                disabled={loading || fetchingSeller}
                className="w-full h-12 bg-zinc-900 text-white text-sm font-medium rounded-xl disabled:opacity-20 disabled:pointer-events-none transition-all duration-200 hover:bg-zinc-800 active:scale-[0.99] flex items-center justify-center tracking-wide"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://w3.org" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
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

      {/* Footer curat, încorporat direct la baza ecranului */}
      <footer className="max-w-md w-full mx-auto text-left text-[10px] text-zinc-400 font-medium tracking-wide flex justify-between items-center select-none border-t border-zinc-100 pt-4">
        
        <span className="hover:text-zinc-600 transition-colors">imidi.co.uk</span>
      </footer>

    </div>
  );
}
