"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase"; // Importăm Supabase pentru a citi datele vânzătorului

export default function DownloadLinkPage() {
  const params = useParams();
  const token = params.token as string;

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  // ---- NOU: Stări pentru a ține minte datele vânzătorului ----
  const [sellerName, setSellerName] = useState<string | null>(null);
  const [sellerContact, setSellerContact] = useState<string | null>(null);
  const [fetchingSeller, setFetchingSeller] = useState(true);

  // ---- NOU: useEffect care rulează la încărcarea paginii și aduce datele din DB ----
  useEffect(() => {
    async function getSellerDetails() {
      if (!token) return;
      try {
        // 1. Căutăm în tabela ta de share_links (sau cum se numește ea) în funcție de token
        // Presupunem că tabela are coloana 'token' și o relație/user_id sau direct email/nume salvat
        const { data: linkData, error: linkErr } = await supabase
          .from("share_links") // Schimbă cu numele real al tabelei tale dacă diferă
          .select("user_id, created_at")
          .eq("token", token)
          .maybeSingle();

        if (linkErr || !linkData) {
          // Fallback discret dacă nu găsește detalii, ca să nu blocheze pagina
          setFetchingSeller(false);
          return;
        }

        // 2. Dacă am găsit user_id-ul vânzătorului, îi tragem profilul public din tabela de profile / users
        if (linkData.user_id) {
          const { data: profileData } = await supabase
            .from("profiles") // Sau tabela ta de useri/operatori (ex: 'users' sau profile detaliate)
            .select("full_name, email, contact") // Tragem numele și contactul
            .eq("id", linkData.user_id)
            .maybeSingle();

          if (profileData) {
            setSellerName(profileData.full_name || "iMIDI Creator");
            setSellerContact(profileData.contact || profileData.email || null);
          }
        }
      } catch (err) {
        console.error("Eroare la preluarea datelor vânzătorului:", err);
      } finally {
        setFetchingSeller(false);
      }
    }

    getSellerDetails();
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
      setError("Eroare de retea. Incearca din nou.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#e2dbc7] flex items-center justify-center px-4">
      <div className="bg-white border rounded-2xl p-8 max-w-sm w-full shadow-sm text-center space-y-5">
        
        {/* AVATAR & NUME VÂNZĂTOR (Dinamice din DB) */}
        <div className="flex flex-col items-center space-y-2 border-b border-zinc-100 pb-4">
          <div className="w-12 h-12 bg-zinc-100 rounded-full flex items-center justify-center font-bold text-zinc-700 uppercase shadow-inner">
            {sellerName ? sellerName.substring(0, 2) : "iM"}
          </div>
          <div>
            <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block">Sent securely by</span>
            <h2 className="text-sm font-bold text-zinc-800">
              {fetchingSeller ? "Loading sender..." : (sellerName || "Verified iMIDI Seller")}
            </h2>
            {sellerContact && (
              <span className="text-[11px] text-zinc-500 block mt-0.5">{sellerContact}</span>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-lg font-bold text-zinc-900">Download the files</h1>
          <p className="text-xs text-zinc-500 leading-relaxed">
            Put the access code provided by the seller to start the download. This is a secure smart link powered by imidi.co.uk
          </p>
        </div>

        {done ? (
          <p className="text-xs text-emerald-600 font-semibold bg-emerald-50 py-3 rounded-xl border border-emerald-100">
            🎉 The download has started. You can close this page.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Access Code"
              autoFocus
              className="w-full h-11 text-center tracking-widest font-mono border rounded-xl px-3 text-sm outline-none focus:border-zinc-400 transition-all"
            />
            {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
            <button
              type="submit"
              disabled={loading || fetchingSeller}
              className="w-full h-11 bg-zinc-900 text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-all hover:bg-zinc-800"
            >
              {loading ? "Verifying..." : "Download Files"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
