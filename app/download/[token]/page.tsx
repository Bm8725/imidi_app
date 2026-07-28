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
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4 relative overflow-hidden font-sans select-none selection:bg-cyan-500/30 selection:text-cyan-200">
      
      {/* BACKGROUND ELEMENT 1: Rețea digitală / Linii de Server abstracte */}
      <div className="absolute inset-0 bg-[radial-gradient(#ffffff03_1px,transparent_1px)] [background-size:16px_16px] opacity-70 pointer-events-none" />
      
      {/* BACKGROUND ELEMENT 2: Nebuloasă Cloud dinamică (Albastru Cyber & Cyan) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-br from-cyan-600/10 via-blue-600/5 to-transparent rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />

      {/* CARDUL PRINCIPAL: Structură stilizată ca un Nod de Server Cloud ultra-modern */}
      <div className="bg-zinc-900/40 border border-white/5 backdrop-blur-2xl rounded-3xl p-8 max-w-sm w-full shadow-[0_30px_70px_rgba(0,0,0,0.7)] text-center relative z-10 transition-all duration-500 hover:border-cyan-500/20 group">
        
        {/* Neon Glow Bar (Semnalizează conexiunea activă la rețeaua cloud) */}
        <div className="absolute top-0 inset-x-16 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_10px_rgba(34,211,238,0.5)]" />

        {/* SECȚIUNEA 1: CLOUD ROUTING & OPERATOR */}
        <div className="flex flex-col items-center space-y-3 border-b border-white/[0.05] pb-5">
          
          {/* Pictogramă Cloud Tech cu unde de rețea */}
          <div className="relative">
            {/* Cercuri concentrice animate (Pulse de rețea) */}
            <span className="absolute inset-0 rounded-full border border-cyan-500/20 animate-ping opacity-40 pointer-events-none scale-110" />
            
            <div className="w-14 h-14 bg-zinc-950 border border-white/10 rounded-2xl flex items-center justify-center relative z-10 shadow-inner group-hover:border-cyan-500/30 transition-colors duration-300">
              {/* Iconiță Cloud SVG minimalistă */}
              <svg xmlns="http://w3.org" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7 text-cyan-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
              </svg>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[9px] font-bold text-cyan-500 uppercase tracking-[0.25em] block">Cloud Storage Node</span>
            <div className="flex items-center justify-center gap-1.5 bg-white/[0.02] border border-white/5 px-3 py-1 rounded-full">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full shadow-[0_0_6px_#34d399]" />
              <h2 className="text-xs font-medium text-zinc-300 tracking-wide">
                {fetchingSeller ? "Resolving cluster..." : `Owner: ${sellerName}`}
              </h2>
            </div>
          </div>
        </div>

        {/* SECȚIUNEA 2: TITLURI DE SERVICIU */}
        <div className="space-y-2 pt-4">
          <h1 className="text-lg font-bold tracking-tight text-white uppercase tracking-wider">
            Secure Digital Asset
          </h1>
          <p className="text-[11px] text-zinc-400 leading-relaxed px-1">
            This cloud repository is encrypted. Please authenticate via your unique gateway token to pull the high-fidelity sound banks.
          </p>
        </div>

        {/* SECȚIUNEA 3: INPUT DIGITALIZAT ȘI DECRIPTARE */}
        <div className="pt-4">
          {done ? (
            <div className="space-y-3 p-4 bg-cyan-950/20 border border-cyan-500/20 rounded-2xl">
              <div className="w-7 h-7 rounded-full bg-cyan-500/10 border border-cyan-400/30 flex items-center justify-center mx-auto text-cyan-400 animate-bounce">
                ↓
              </div>
              <p className="text-xs text-cyan-300 font-medium tracking-wide">
                Handshake successful. Stream connection established, file downloading...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Căsuță de Input stilizată ca o consolă de server */}
              <div className="relative">
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="ENTER ACCESS KEY"
                  autoFocus
                  className="w-full h-11 text-center tracking-[0.15em] font-mono bg-zinc-950 border border-white/5 rounded-xl px-4 text-xs text-cyan-300 outline-none placeholder:text-zinc-600 focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/10 transition-all duration-300 shadow-inner"
                />
                {/* Linii fine decorative de colț (Console style) */}
                <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-zinc-700 rounded-tl-md pointer-events-none" />
                <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-zinc-700 rounded-br-md pointer-events-none" />
              </div>

              {error && (
                <p className="text-[11px] text-red-400 font-medium bg-red-950/20 border border-red-500/10 py-2 rounded-xl">
                  ✕ {error}
                </p>
              )}

              {/* Buton cu design futurist de inițializare serviciu */}
              <button
                type="submit"
                disabled={loading || fetchingSeller}
                className="w-full h-11 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-bold uppercase tracking-wider rounded-xl disabled:opacity-20 disabled:pointer-events-none transition-all duration-300 hover:brightness-110 hover:shadow-[0_0_20px_rgba(6,182,212,0.3)] active:scale-[0.99] flex items-center justify-center"
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

        {/* SECȚIUNEA 4: FOOTER METADATA CLOUD */}
        <div className="pt-4 border-t border-white/[0.03] mt-2 flex items-center justify-between text-[9px] text-zinc-600 uppercase tracking-widest font-mono">
          <span>SaaS Service v4.0</span>
          <span>imidi.co.uk</span>
        </div>

      </div>
    </div>
  );
}
