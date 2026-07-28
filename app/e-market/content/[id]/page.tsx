"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { supabase } from "@/lib/supabase";

interface BankInfo {
  id: string;
  name: string;
  type: string;
  size_mb: number;
  storage_path: string | null;
}

export default function MarketContentPage() {
  const params = useParams();
  const id = params?.id as string;

  const [bank, setBank] = useState<BankInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const { data, error: fetchError } = await supabase
          .from("cloud_banks")
          .select("id, name, type, size_mb, storage_path")
          .eq("id", id)
          .single();

        if (fetchError || !data) throw new Error("Conținutul nu a fost găsit sau nu mai este disponibil.");
        setBank(data as BankInfo);
      } catch (err: any) {
        setError(err.message || "Conținutul nu a fost găsit.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleDownload = async () => {
    if (!bank?.storage_path) {
      setDownloadError("Fișierul nu are un path de storage valid.");
      return;
    }
    setDownloading(true);
    setDownloadError("");
    try {
      // Link temporar (valabil 60s) generat direct din Supabase Storage
      const { data, error: signError } = await supabase.storage
        .from("cloud-db-bucket")
        .createSignedUrl(bank.storage_path, 60);

      if (signError || !data?.signedUrl) throw new Error("Nu am putut genera linkul de descărcare.");

      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.download = bank.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err: any) {
      setDownloadError(err.message || "Descărcarea a eșuat.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="bg-[#FAF9F6] text-zinc-900 min-h-screen flex flex-col antialiased">
      <Navbar />
      <main className="flex-1 w-full max-w-lg mx-auto px-4 pt-28 pb-16 flex flex-col items-center">
        {loading ? (
          <div className="w-full h-40 bg-white border rounded-2xl animate-pulse" />
        ) : error ? (
          <div className="w-full text-center p-8 bg-white border rounded-2xl shadow-sm space-y-3">
            <p className="text-2xl">🔍</p>
            <p className="text-sm text-zinc-500">{error}</p>
            <Link href="/e-market" className="inline-block px-4 py-2 bg-zinc-900 text-white text-xs font-semibold rounded-lg">
              Înapoi la Market
            </Link>
          </div>
        ) : bank ? (
          <div className="w-full bg-white border rounded-2xl p-6 shadow-sm space-y-5 text-center">
            <div className="w-14 h-14 mx-auto rounded-xl bg-zinc-100 flex items-center justify-center text-2xl">
              {bank.type === "Presets" ? "🎛️" : bank.type === "MIDI Pack" ? "🎹" : "🎵"}
            </div>
            <div>
              <h1 className="text-base font-bold text-zinc-900 truncate" title={bank.name}>{bank.name}</h1>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {bank.type} • {bank.size_mb < 0.1 ? `${(bank.size_mb * 1024).toFixed(0)} KB` : `${bank.size_mb} MB`}
              </p>
            </div>

            <button
              onClick={handleDownload}
              disabled={downloading}
              className="w-full h-11 bg-zinc-900 text-white text-xs font-bold uppercase tracking-widest rounded-xl hover:bg-neutral-900 active:scale-[0.99] transition-all disabled:opacity-40"
            >
              {downloading ? "Se generează link-ul..." : "Descarcă"}
            </button>
            {downloadError && <p className="text-[11px] text-red-500">{downloadError}</p>}

            <p className="text-[10px] text-zinc-300">iMIDI e-Market · conținut digital</p>
          </div>
        ) : null}
      </main>
      <Footer />
    </div>
  );
}