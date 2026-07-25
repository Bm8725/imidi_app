"use client";

import { useState } from "react";
import { useParams } from "next/navigation";

export default function DownloadLinkPage() {
  const params = useParams();
  const token = params.token as string;

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

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
        setError(data.error || "Cod incorect sau link expirat.");
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
      <div className="bg-white border rounded-2xl p-8 max-w-sm w-full shadow-sm text-center space-y-4">
        <h1 className="text-lg font-bold text-zinc-900">Download the files</h1>
        <p className="text-xs text-zinc-500">
          Put the access code provided by the seller to start the download. This is the smart link for download powered by imidi.co.uk
        </p>

        {done ? (
          <p className="text-xs text-emerald-600 font-medium">
            The download has started. You can close this page.
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
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-zinc-900 text-white text-sm font-semibold rounded-xl disabled:opacity-40"
            >
              {loading ? "Verifying..." : "Download"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}