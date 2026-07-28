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
    <div className="min-h-screen bg-[#e2dbc7] flex items-center justify-center px-4">
      <div className="bg-white border rounded-2xl p-8 max-w-sm w-full shadow-sm text-center space-y-5">
        
        {/* AVATAR & NUME VÂNZĂTOR */}
        <div className="flex flex-col items-center space-y-2 border-b border-zinc-100 pb-4">
          <div className="w-12 h-12 bg-zinc-100 rounded-full flex items-center justify-center font-bold text-zinc-700 uppercase">
            {sellerName.substring(0, 2)}
          </div>
          <div>
            <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block">Sent securely by</span>
            <h2 className="text-sm font-bold text-zinc-800">
              {fetchingSeller ? "Loading sender..." : sellerName}
            </h2>
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
              className="w-full h-11 text-center tracking-widest font-mono border rounded-xl px-3 text-sm outline-none focus:border-zinc-400"
            />
            {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
            <button
              type="submit"
              disabled={loading || fetchingSeller}
              className="w-full h-11 bg-zinc-900 text-white text-sm font-semibold rounded-xl disabled:opacity-40 hover:bg-zinc-800"
            >
              {loading ? "Verifying..." : "Download Files"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
