"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
// Importăm componenta din folderul de componente
import MetaMess from "@/components/metamess";

import { supabase } from "@/lib/supabase";
// NOU: functii de verificare/upgrade a limitei de stocare
import { getUserStorageLimitMb, upgradeToProPlan, upgradeToEnterprisePlan } from "@/lib/storageLimit";

export default function CloudWorkspacePage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("all");
  const [banks, setBanks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalUsedMb, setTotalUsedMb] = useState(0);
  const [user, setUser] = useState<any>(null);
  const [delId, setDelId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  // ---- share link (cod de acces pt cumparator) ----
  const [shareBank, setShareBank] = useState<any | null>(null);
  const [shareCode, setShareCode] = useState("");
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState("");
  const [shareResultUrl, setShareResultUrl] = useState("");
  const [shareResultExpires, setShareResultExpires] = useState("");
  const [shareCopied, setShareCopied] = useState(false);
  // NOU: pretul anuntului de pe Market legat de acest bank + comisionul iMIDI
  const [shareListing, setShareListing] = useState<{ price: number; title: string } | null>(null);
  const [shareListingLoading, setShareListingLoading] = useState(false);
  const COMMISSION_RATE = 0.1; // 10%

  // ---- AI analiza piata ----
  const [showMarketAnalysis, setShowMarketAnalysis] = useState(false);
  const [marketAnalysisLoading, setMarketAnalysisLoading] = useState(false);
  const [marketAnalysisText, setMarketAnalysisText] = useState("");
  const [marketAnalysisError, setMarketAnalysisError] = useState("");

  // ---- NOU: plan/limita dinamica + stare buton cumparare ----
  const [plan, setPlan] = useState<"free" | "pro" | "enterprise">("free");
  const [buyingCloud, setBuyingCloud] = useState(false);
  const [buyingEnterprise, setBuyingEnterprise] = useState(false);

  const lim = 6;
  const [maxMb, setMaxMb] = useState(50); // NOU: nu mai e fix, vine din DB (vezi useEffect)



    

// 1. Pune aceste două stări (useState) chiar la începutul componentei tale, sus de tot
const [facebookId, setFacebookId] = useState<string | null>(null);
const [userError, setUserError] = useState<string | null>(null);

// 2. Înlocuiește liniile tale 58-62 cu acest bloc useEffect care trage ID-ul 100% automat:
useEffect(() => {
  async function loadUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      setUserError("Trebuie să fii logat.");
      return;
    }

    const fbIdentity = user.identities?.find(
      (identity) => identity.provider === "facebook"
    );

    if (fbIdentity) {
      setFacebookId(fbIdentity.id);
    }
  }

  loadUser();
}, []);



  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Unauthorized. Please log in.");
        setUser({ id: session.user.id, email: session.user.email, name: session.user.user_metadata?.full_name || "Operator", avatar: `https://dicebear.com{session.user.id}` });

        // NOU: citim limita reala a userului (Free 50MB sau Pro 30GB)
        const { plan: userPlan, limitMb } = await getUserStorageLimitMb(session.user.id);
        console.log("DEBUG plan citit din DB:", userPlan, "limitMb:", limitMb); // TEMPORAR - sterge dupa ce testezi
        setPlan(userPlan);
        setMaxMb(limitMb);

        const { data: all } = await supabase.from("cloud_banks").select("size_mb").eq("user_id", session.user.id);
        if (all) setTotalUsedMb(all.reduce((acc, c) => acc + Number(c.size_mb), 0));

        let q = supabase.from("cloud_banks").select("*").eq("user_id", session.user.id);
        if (activeTab !== "all") q = q.eq("type", { "audio banks": "Audio Bank", "midi packs": "MIDI Pack", "presets": "Presets" }[activeTab]);
        
        const { data } = await q.order("created_at", { ascending: false }).range((page - 1) * lim, page * lim - 1);
        if (data) setBanks(data);
      } catch (err: any) { setError(err.message); } finally { setLoading(false); }
    })();
  }, [page, activeTab]);

  // NOU: cumpara 30GB — deschide plata Revolut, apoi (dupa confirmare) actualizeaza limita in DB
  const handleBuyCloud = async () => {
    if (!user) return;
    window.open("https://revolut.me/mariusvalentin_b", "_blank", "noopener,noreferrer");

    const confirmed = window.confirm(
      "Am deschis pagina de plata Revolut intr-un tab nou.\n\nDupa ce ai trimis $50, apasa OK aici ca sa activam cei 30GB."
    );
    if (!confirmed) return;

    setBuyingCloud(true);
    try {
      const { limitMb } = await upgradeToProPlan(user.id);
      setPlan("pro");
      setMaxMb(limitMb);
      alert("Gata! Ai acum 30GB de stocare.");
    } catch (err: any) {
      alert(err.message || "Nu am putut activa spatiul suplimentar. Incearca din nou.");
    } finally {
      setBuyingCloud(false);
    }
  };

  // NOU: Pas 2 — extinde la 250GB, disponibil doar dupa ce ai deja Pro (30GB)
  const handleBuyEnterprise = async () => {
    if (!user) return;
    window.open("https://revolut.me/mariusvalentin_b", "_blank", "noopener,noreferrer");

    const confirmed = window.confirm(
      "Am deschis pagina de plata Revolut intr-un tab nou.\n\nDupa ce ai trimis $149.90, apasa OK aici ca sa activam cei 250GB."
    );
    if (!confirmed) return;

    setBuyingEnterprise(true);
    try {
      const { limitMb } = await upgradeToEnterprisePlan(user.id);
      setPlan("enterprise");
      setMaxMb(limitMb);
      alert("Gata! Ai acum 250GB de stocare.");
    } catch (err: any) {
      alert(err.message || "Nu am putut activa spatiul suplimentar. Incearca din nou.");
    } finally {
      setBuyingEnterprise(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      let runningTotal = totalUsedMb;
      const errors: string[] = [];
      let blocked = false;

      for (const file of Array.from(files)) {
        const fileSizeMb = file.size / (1024 * 1024);

        if (runningTotal >= maxMb) {
          blocked = true;
          errors.push(`${file.name}: neîncărcat — ai atins limita de ${maxMb} MB.`);
          continue;
        }
        if (runningTotal + fileSizeMb > maxMb) {
          blocked = true;
          errors.push(`${file.name}: neîncărcat — ar depăși limita de ${maxMb} MB.`);
          continue;
        }

        try {
          const ext = file.name.split(".").pop()?.toLowerCase() || "";
          const path = `${user.id}/${Math.random().toString(36).substring(2)}.${ext}`;
          const { error: upErr } = await supabase.storage.from("cloud-db-bucket").upload(path, file);
          if (upErr) throw upErr;

          let type = "Audio Bank", color = "#3b82f6";
          if (["fxp", "fxb", "vital", "fst", "adg", "adv", "pst", "json", "ts4", "bin", "jsf", "jbb", "sf2", "hex", "jbs", "prf", "bup"].includes(ext)) {
            type = "Presets"; color = "#ec4899";
          } else if (["mid", "midi"].includes(ext)) {
            type = "MIDI Pack"; color = "#10b981";
          }

          const { error: insErr } = await supabase.from("cloud_banks").insert({ user_id: user.id, name: file.name, type, items_count: 1, size_mb: parseFloat(fileSizeMb.toFixed(2)), status: "active", color_hex: color, storage_path: path });
          if (insErr) throw insErr;

          runningTotal += fileSizeMb;
        } catch (fileErr: any) {
          errors.push(`${file.name}: ${fileErr.message}`);
        }
      }

      if (blocked) {
        alert(`Ai depășit spațiul gratuit de ${maxMb} MB.\n\nUnele fișiere nu s-au încărcat:\n${errors.join("\n")}\n\nCumpără spațiu suplimentar din pagina de pricing ca să continui.`);
      } else if (errors.length) {
        alert(`Unele fișiere nu s-au încărcat:\n${errors.join("\n")}`);
      }
      window.location.reload();
    } catch (err: any) { alert(err.message); } finally { setUploading(false); }
  };

  const handleDownload = async (bank: any) => {
    if (!bank.storage_path) {
      alert("Fișierul acesta nu are un path de storage salvat, nu poate fi descărcat.");
      return;
    }
    setDownloadingId(bank.id);
    try {
      const { data, error } = await supabase.storage.from("cloud-db-bucket").download(bank.storage_path);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = bank.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || "Download failed.");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await supabase.auth.signOut();
      router.push("/login");
    } catch (err: any) {
      alert(err.message || "failed.");
      setLoggingOut(false);
    }
  };

  // ---- share link: deschide modalul pt un bank anume ----
  const openShareModal = async (bank: any) => {
    setShareBank(bank);
    setShareCode("");
    setShareError("");
    setShareResultUrl("");
    setShareResultExpires("");
    setShareCopied(false);
    setShareListing(null);

    // NOU: cautam anuntul de pe Market legat de acest bank, ca sa afisam pretul si comisionul
    setShareListingLoading(true);
    try {
      const { data, error } = await supabase
        .from("listings")
        .select("price, title")
        .eq("bank_id", bank.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (data) setShareListing({ price: Number(data.price), title: data.title });
    } catch {
      // daca nu exista anunt publicat pe Market pentru acest bank, ramane null (fara eroare afisata)
    } finally {
      setShareListingLoading(false);
    }
  };

  const closeShareModal = () => {
    setShareBank(null);
    setShareListing(null);
  };

  const generateShareLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareBank) return;
    if (!shareListing) {
      setShareError("Acest fișier nu are un anunț activ pe Market. Publică-l întâi.");
      return;
    }
    if (shareCode.trim().length < 4) {
      setShareError("Codul trebuie sa aiba minim 4 caractere.");
      return;
    }
    setShareLoading(true);
    setShareError("");
    try {
      const { data, error } = await supabase.rpc("create_share_link", {
        p_bank_id: shareBank.id,
        p_code: shareCode.trim(),
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      const url = `${window.location.origin}/download/${row.token}`;
      setShareResultUrl(url);
      setShareResultExpires(new Date(row.expires_at).toLocaleDateString("ro-RO"));
    } catch (err: any) {
      setShareError(err.message || "Nu am putut genera linkul.");
    } finally {
      setShareLoading(false);
    }
  };

  // ---- NOU: istoric descarcari (cloud_download_log) ----
  const [showDownloadHistory, setShowDownloadHistory] = useState(false);
  const [downloadHistory, setDownloadHistory] = useState<any[]>([]);
  const [downloadHistoryLoading, setDownloadHistoryLoading] = useState(false);
  const [downloadHistoryError, setDownloadHistoryError] = useState("");

  const openDownloadHistory = async () => {
    setShowDownloadHistory(true);
    setDownloadHistoryLoading(true);
    setDownloadHistoryError("");
    try {
      const { data, error } = await supabase
        .from("cloud_download_log")
        .select("*")
        .order("downloaded_at", { ascending: false });
      if (error) throw error;
      setDownloadHistory(data ?? []);
    } catch (err: any) {
      setDownloadHistoryError(err.message || "Nu am putut incarca istoricul.");
    } finally {
      setDownloadHistoryLoading(false);
    }
  };

const [marketStats, setMarketStats] = useState<any>(null);

const runMarketAnalysis = async () => {
  setShowMarketAnalysis(true);
  setMarketAnalysisLoading(true);
  setMarketAnalysisError("");
  setMarketAnalysisText("");
  setMarketStats(null);
  try {
    const res = await fetch("/api/ai/analyse-market");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Eroare la generarea analizei.");
    setMarketAnalysisText(data.analysis);
    setMarketStats(data);
  } catch (err: any) {
    setMarketAnalysisError(err.message);
  } finally {
    setMarketAnalysisLoading(false);
  }
};

  const copyShareUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareResultUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      setShareError("Nu am putut copia linkul.");
    }
  };

  const pct = Math.min(100, (totalUsedMb / maxMb) * 100);

  return (
    <div className="bg-[#FAF9F6] text-zinc-900 min-h-screen flex flex-col antialiased">
      <Navbar />
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 pt-24 pb-12">
        {error ? (
          <div className="text-center p-6 bg-white border rounded-xl max-w-sm mx-auto shadow-sm mt-12">
            <p className="text-xs text-zinc-500 mb-4">{error}</p>
            <Link href="/login" className="px-4 py-2 bg-zinc-900 text-white text-xs font-semibold rounded-lg block">Autentication </Link>
          </div>
        ) : (
          <>
            <input type="file" multiple ref={fileRef} onChange={handleUpload} className="hidden" accept="audio/*,.mid,.midi,.fxp,.fxb,.vital,.fst,.adg,.adv,.pst,.json,.ts4,.bin,.jsf,.jbb,.sf2,.hex,.jbs,.prf,.bup" />
            
<div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-zinc-100 pb-5 mb-6 gap-5 w-full">
  {/* Secțiune Titlu, User & Indicator Stocare */}
  <div className="space-y-3 w-full md:w-auto">
    <div className="space-y-0.5">
      <h1 className="text-xl md:text-2xl font-bold tracking-tight bg-gradient-to-r from-zinc-900 to-zinc-700 bg-clip-text text-transparent">
        iMIDI MyCloud
      </h1>
      <div className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <p className="text-[11px] font-medium text-zinc-400 select-none tracking-wide">{user?.email}</p>
      </div>
    </div>


  </div>

  {/* Secțiune Butoane - Responsive Grid / Flex */}
  <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full md:w-auto">
    
    {/* Buton Upload cu Loading micro-animație */}
    <button 
      disabled={totalUsedMb >= maxMb || uploading} 
      onClick={() => fileRef.current?.click()} 
      className="h-9 px-4 bg-blue-500 hover:bg-blue-600 active:scale-[0.98] text-white text-xs font-semibold rounded-xl disabled:opacity-40 disabled:pointer-events-none shadow-sm shadow-blue-100 transition-all duration-200 flex items-center justify-center gap-1.5 col-span-2 sm:col-span-1"
    >
      {uploading ? (
        <>
          <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          <span className="animate-pulse">Se încarcă...</span>
        </>
      ) : (
        <>
          <span className="text-sm font-light">+</span>
          <span>Upload</span>
        </>
      )}
    </button>

    {/* Buton Istoric Descărcări */}
    <button
      onClick={openDownloadHistory}
      className="h-9 px-3 border border-zinc-200 rounded-xl text-xs font-medium bg-white text-zinc-700 hover:text-zinc-900 hover:bg-zinc-50 hover:border-zinc-300 active:scale-[0.98] shadow-xs transition-all duration-200 flex items-center justify-center gap-1.5"
    >
      <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>Istoric</span>
    </button>

    {/* Buton Reset Pass */}
    <Link 
      href="/update-password" 
      className="h-9 px-3 border border-zinc-200 rounded-xl text-xs font-medium bg-white text-zinc-700 hover:text-zinc-900 hover:bg-zinc-50 hover:border-zinc-300 active:scale-[0.98] shadow-xs transition-all duration-200 flex items-center justify-center gap-1.5"
    >
      Reset pass
    </Link>

    {/* Buton Log Out cu starea de deconectare */}
    <button 
      onClick={handleLogout} 
      disabled={loggingOut} 
      className="h-9 px-3 border border-zinc-200 rounded-xl text-xs font-medium bg-white text-red-500 hover:bg-red-50/60 hover:border-red-100 active:scale-[0.98] disabled:opacity-40 shadow-xs transition-all duration-200 flex items-center justify-center gap-1.5"
    >
      {loggingOut ? (
        <span className="w-3.5 h-3.5 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
      ) : (
        <svg className="w-3.5 h-3.5 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
      )}
      <span>{loggingOut ? "Ieșire..." : "Log out"}</span>
    </button>

    {/* Buton AI - Design WOW Exclusiv */}
    <button
      onClick={runMarketAnalysis}
      className="h-9 px-4 rounded-xl text-xs font-bold bg-gradient-to-r from-[#8B5CF6] to-[#0070F3] text-white shadow-md shadow-blue-500/10 flex items-center justify-center gap-1.5 cursor-pointer hover:scale-[1.02] hover:brightness-110 active:scale-[0.98] transition-all duration-200 col-span-2 sm:col-span-1 select-none"
    >
      <span className="animate-pulse text-sm text-purple-200">{"\u2726"}</span>
      <span className="tracking-wide">AI Analyse</span>
    </button>

  </div>
</div>


            <div className="bg-white border p-4 rounded-xl flex flex-col sm:flex-row justify-between items-center gap-4 mb-6 shadow-sm">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <img 
                  src={user?.avatar || "/user.webp"} 
                  alt="User Avatar"
                  className="w-8 h-8 rounded-lg bg-zinc-100 object-cover" 
                  onError={(e) => { e.currentTarget.src = "/user.webp"; }}
                />
                <span className="text-xs font-bold">{user?.name || "Uploading..."}</span>
              </div>
              <div className="w-full sm:w-64">
                <div className="text-[11px] text-zinc-500 flex justify-between font-medium items-center">
                  <span className="flex items-center gap-1.5">
                    Stocare
                    {plan === "pro" && (
                      <span className="text-[9px] font-bold text-white bg-emerald-500 px-1.5 py-0.5 rounded">PRO PLAN</span>
                    )}
                    {plan === "enterprise" && (
                      <span className="text-[9px] font-bold text-white bg-emerald-500 px-1.5 py-0.5 rounded">FULL PLAN</span>
                    )}
                  </span>
                  <span>
                    {totalUsedMb >= 1024 ? `${(totalUsedMb / 1024).toFixed(2)} GB` : `${totalUsedMb.toFixed(1)} MB`}
                    {" / "}
                    {maxMb >= 1024 ? `${(maxMb / 1024).toFixed(0)} GB` : `${maxMb} MB`}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-zinc-100 rounded-full mt-1 border overflow-hidden"><div className={`h-full transition-all ${pct > 85 ? "bg-red-500" : pct > 60 ? "bg-amber-500" : "bg-zinc-900"}`} style={{ width: `${pct}%` }} /></div>
              </div>
              {/* Pas 1: Free -> Pro (30GB) */}
              {plan === "free" && (
                <button
                  onClick={handleBuyCloud}
                  disabled={buyingCloud}
                  className="shrink-0 h-9 px-4 bg-zinc-900 text-white text-xs font-semibold rounded-lg disabled:opacity-40 whitespace-nowrap"
                >
                  {buyingCloud ? "Se activeaza..." : "Cumpără 30GB · $50"}
                </button>
              )}

              {/* Pas 2: Pro -> Enterprise (250GB), disponibil doar dupa ce ai deja 30GB */}
              {plan === "pro" && (
                <div className="shrink-0 flex items-center gap-2">
                  <span className="h-9 px-4 flex items-center gap-1.5 bg-emerald-500 text-white text-xs font-semibold rounded-lg whitespace-nowrap">
                    ✓ Pro activ
                  </span>
                  <button
                    onClick={handleBuyEnterprise}
                    disabled={buyingEnterprise}
                    className="h-9 px-4 bg-zinc-900 text-white text-xs font-semibold rounded-lg disabled:opacity-40 whitespace-nowrap"
                  >
                    {buyingEnterprise ? "Se activeaza..." : "Extinde la 250GB · $149.90"}
                  </button>
                </div>
              )}

              {/* Pas 3: Enterprise activ (250GB) — stare finala, full */}
              {plan === "enterprise" && (
                <span className="shrink-0 h-9 px-4 flex items-center gap-1.5 bg-emerald-500 text-white text-xs font-semibold rounded-lg whitespace-nowrap">
                  ✓ FULL 250GB
                </span>
              )}
            </div>

            {totalUsedMb >= maxMb && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <p className="text-xs text-amber-800">Ai atins limita de {maxMb} MB. Nu mai poți urca fișiere noi până nu eliberezi spațiu sau extinzi stocarea.</p>
                {plan === "free" && (
                  <button onClick={handleBuyCloud} disabled={buyingCloud} className="shrink-0 h-7 px-3 flex items-center bg-amber-900 text-white text-[11px] font-semibold rounded-lg whitespace-nowrap disabled:opacity-40">
                    {buyingCloud ? "..." : "Cumpără 30GB · $49.9"}
                  </button>
                )}
                {plan === "pro" && (
                  <button onClick={handleBuyEnterprise} disabled={buyingEnterprise} className="shrink-0 h-7 px-3 flex items-center bg-amber-900 text-white text-[11px] font-semibold rounded-lg whitespace-nowrap disabled:opacity-40">
                    {buyingEnterprise ? "..." : "Extinde la 250GB · $149.90"}
                  </button>
                )}
                {plan === "enterprise" && (
                  <Link href="/pricing" className="shrink-0 h-7 px-3 flex items-center bg-amber-900 text-white text-[11px] font-semibold rounded-lg whitespace-nowrap">Contacteaza-ne</Link>
                )}
              </div>
            )}


            <div className="flex gap-1 bg-zinc-200/50 p-1 rounded-lg w-fit mb-4">
              {["all", "audio banks", "midi packs", "presets"].map(t => (
                <button key={t} onClick={() => { setActiveTab(t); setPage(1); }} className={`h-7 px-3 text-xs capitalize rounded-md transition-all ${activeTab === t ? "bg-white text-zinc-900 shadow-sm font-semibold" : "text-zinc-500 hover:text-zinc-900"}`}>{t}</button>
              ))}
            </div>

            {loading ? <div className="h-16 bg-white border rounded-xl animate-pulse" /> : banks.length === 0 ? <div className="text-center py-10 border border-dashed rounded-xl bg-white text-xs text-zinc-400">Not  packs or file found!</div> : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {banks.map(b => (
                  <div key={b.id} className="bg-white border p-3 rounded-xl flex items-center justify-between hover:border-zinc-400 group transition-all shadow-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-md flex items-center justify-center text-xs" style={{ backgroundColor: `${b.color_hex}10`, color: b.color_hex }}>{b.type === "Presets" ? "🎛️" : b.type === "MIDI Pack" ? "🎹" : "🎵"}</div>
                      <div className="min-w-0">
                        <h3 className="text-xs font-semibold truncate pr-2" title={b.name}>{b.name}</h3>
                        <p className="text-[10px] text-zinc-400">{b.type} • {b.size_mb < 0.1 ? `${(b.size_mb * 1024).toFixed(0)} KB` : `${b.size_mb} MB`}</p>
                      </div>
                    </div>
                    <div className="shrink-0 z-20 flex items-center gap-1">
                      {delId === b.id ? (
                        <div className="flex gap-1 bg-zinc-50 p-1 border rounded-md">
                          <button onClick={async () => { await supabase.from("cloud_banks").delete().eq("id", b.id); setDelId(null); window.location.reload(); }} className="px-2 py-0.5 bg-red-500 text-white text-[10px] rounded">yes</button>
                          <button onClick={() => setDelId(null)} className="px-2 py-0.5 text-zinc-500 text-[10px]">No</button>
                        </div>
                      ) : (
                        <>
                          <button onClick={() => openShareModal(b)} className="w-7 h-7 rounded-md flex items-center justify-center text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 sm:opacity-0 group-hover:opacity-100 transition-all" title="Genereaza link de vanzare">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path strokeLinecap="round" d="M8.6 10.5l6.8-4M8.6 13.5l6.8 4" /></svg>
                          </button>
                          <button onClick={() => handleDownload(b)} disabled={downloadingId === b.id} className="w-7 h-7 rounded-md flex items-center justify-center text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 sm:opacity-0 group-hover:opacity-100 transition-all disabled:opacity-100">
                            {downloadingId === b.id ? (
                              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" /></svg>
                            )}
                          </button>
                          <button onClick={() => setDelId(b.id)} className="w-7 h-7 rounded-md flex items-center justify-center text-zinc-400 hover:text-red-500 hover:bg-red-50 sm:opacity-0 group-hover:opacity-100 transition-all">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {banks.length > 0 && (
              <div className="flex justify-between items-center mt-6 text-xs border-t pt-4">
                <span className="text-zinc-400 font-medium">Page {page}</span>
                <div className="flex gap-1">
                  <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="h-7 px-3 border rounded-md bg-white disabled:opacity-40">←</button>
                  <button disabled={banks.length < lim} onClick={() => setPage(p => p + 1)} className="h-7 px-3 border rounded-md bg-white disabled:opacity-40">→</button>
                </div>
              </div>
            )}
          </>
        )}
      </main>

{/* modal istoric descarcari */}
{showDownloadHistory && (
  <div 
    className="fixed inset-0 bg-zinc-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" 
    onClick={() => setShowDownloadHistory(false)}
  >
    <div 
      className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-zinc-100 space-y-4 max-h-[80vh] overflow-y-auto flex flex-col scale-in" 
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header Modal */}
      <div className="flex items-center justify-between shrink-0">
        <div className="space-y-0.5">
          <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-500">Istoric</p>
          <h3 className="text-base font-bold text-zinc-900 tracking-tight">Descărcări pachete</h3>
        </div>
        <button 
          onClick={() => setShowDownloadHistory(false)} 
          className="w-7 h-7 rounded-full bg-zinc-50 hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 flex items-center justify-center text-xs transition-colors active:scale-95"
        >
          ✕
        </button>
      </div>

      {/* Corp Modal / Conținut */}
      <div className="flex-1 overflow-y-auto pr-1">
        {downloadHistoryLoading ? (
          /* Skeleton Loader Premium pe linii, nu doar un bloc gri */
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex justify-between items-center p-3 border border-zinc-100 rounded-xl animate-pulse">
                <div className="space-y-1.5 w-1/3">
                  <div className="h-3 bg-zinc-100 rounded-md w-full" />
                  <div className="h-2 bg-zinc-50 rounded-md w-2/3" />
                </div>
                <div className="space-y-1 w-1/4 flex flex-col items-end">
                  <div className="h-2.5 bg-zinc-100 rounded-md w-3/4" />
                  <div className="h-2 bg-zinc-50 rounded-md w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : downloadHistoryError ? (
          <div className="p-3 bg-red-50/60 border border-red-100 rounded-xl flex items-center gap-2">
            <span className="text-red-500 text-sm">⚠️</span>
            <p className="text-xs text-red-600 font-medium">{downloadHistoryError}</p>
          </div>
        ) : downloadHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 border border-dashed border-zinc-200 rounded-xl text-center px-4 space-y-2">
            <div className="w-10 h-10 rounded-full bg-zinc-50 flex items-center justify-center text-zinc-400 text-lg">📁</div>
            <p className="text-xs font-medium text-zinc-500">Nicio descărcare înregistrată încă.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[11px] font-medium text-zinc-400 px-0.5">
              <span>{downloadHistory.length} {downloadHistory.length === 1 ? 'descărcare' : 'descărcări în total'}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            </div>

            {/* Listă cu design modern (carduri separate cu efect de hover) */}
            <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-0.5">
              {downloadHistory.map((row) => {
                const dt = new Date(row.downloaded_at);
                const data = dt.toLocaleDateString("ro-RO", { day: '2-digit', month: '2-digit', year: 'numeric' });
                const ora = dt.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
                
                return (
                  <div 
                    key={row.id} 
                    className="flex items-center justify-between p-3 text-xs bg-white border border-zinc-100 hover:border-zinc-200 hover:shadow-xs rounded-xl transition-all duration-150 group"
                  >
                    {/* Detalii Bancă */}
                    <div className="min-w-0 pr-3 flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-zinc-50 group-hover:bg-blue-50/50 flex items-center justify-center text-sm shrink-0 border border-zinc-100/50 transition-colors">
                        {row.bank_name?.toLowerCase().includes('edge') ? '🏦' : '💳'}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-zinc-800 truncate" title={row.bank_name}>
                          {row.bank_name}
                        </p>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-medium bg-zinc-50 text-zinc-500 border border-zinc-100">
                          {row.bank_type || "Nespecificat"}
                        </span>
                      </div>
                    </div>

                    {/* Dată / Timp */}
                    <div className="shrink-0 text-right space-y-0.5">
                      <p className="text-zinc-700 font-semibold tracking-tight">{data}</p>
                      <p className="text-[10px] text-zinc-400 font-mono">{ora}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
)}


      {/* modal generare link de vanzare (cod ales de vanzator) */}
      {shareBank && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={closeShareModal}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wide text-zinc-400">Seller link (link in BIO)</p>
                <h3 className="text-sm font-bold text-zinc-900 truncate max-w-[220px]" title={shareBank.name}>{shareBank.name}</h3>
              </div>
              <button onClick={closeShareModal} className="w-7 h-7 rounded-full bg-zinc-100 flex items-center justify-center text-xs">✕</button>
            </div>

            {/* NOU: pretul anuntului + comisionul iMIDI, daca exista un anunt publicat pe Market pt acest bank */}
            {shareListingLoading ? (
              <div className="h-16 bg-zinc-50 border rounded-lg animate-pulse" />
            ) : shareListing ? (
              <div className="bg-zinc-50 border rounded-lg p-3 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">Preț anunț</span>
                  <span className="font-bold text-zinc-900">{shareListing.price.toFixed(2)} lei</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-zinc-400">Comision iMIDI ({(COMMISSION_RATE * 100).toFixed(0)}%)</span>
                  <span className="text-red-500 font-medium">- {(shareListing.price * COMMISSION_RATE).toFixed(2)} lei</span>
                </div>
                <div className="flex items-center justify-between text-[11px] border-t pt-1.5 mt-1.5">
                  <span className="text-zinc-500 font-medium">Încasezi</span>
                  <span className="text-emerald-600 font-bold">{(shareListing.price * (1 - COMMISSION_RATE)).toFixed(2)} lei</span>
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-zinc-400 bg-zinc-50 border rounded-lg p-3">
                Acest fișier nu are un anunț publicat pe Market — linkul de mai jos e doar pentru livrare directă, fără preț/comision.
              </p>
            )}

            {!shareResultUrl ? (
              shareListingLoading ? null : shareListing ? (
                <form onSubmit={generateShareLink} className="space-y-3">
                  <p className="text-[11px] text-zinc-500">
                    Alege un cod pe care il trimiti separat cumparatorului (WhatsApp, chat etc.). Linkul functioneaza o singura data si expira in 15 zile.
                  </p>
                  <input
                    type="text"
                    value={shareCode}
                    onChange={(e) => setShareCode(e.target.value)}
                    placeholder="Codul tau (minim 4 caractere)"
                    autoFocus
                    className="w-full h-10 border rounded-lg px-3 text-xs outline-none focus:border-zinc-400"
                  />
                  {shareError && <p className="text-[11px] text-red-500">{shareError}</p>}
                  <button type="submit" disabled={shareLoading} className="w-full h-10 bg-zinc-900 text-white text-xs font-semibold rounded-lg disabled:opacity-40">
                    {shareLoading ? "Se genereaza..." : "Genereaza link"}
                  </button>
                </form>
              ) : (
                <div className="space-y-2">
                  <p className="text-[11px] text-zinc-500">
                    Poți genera linkul de vânzare doar pentru fișiere care au un anunț activ pe Market.
                  </p>
                  <Link
                    href="/e-market"
                    onClick={closeShareModal}
                    className="block w-full text-center h-10 leading-10 bg-zinc-900 text-white text-xs font-semibold rounded-lg"
                  >
                    Publică un anunț
                  </Link>
                </div>
              )
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] font-mono uppercase text-zinc-400 mb-1">Link (trimite-l cumparatorului)</p>
                  <div className="flex gap-2">
                    <input readOnly value={shareResultUrl} className="flex-1 h-9 border rounded-lg px-2 text-[11px] font-mono bg-zinc-50" />
                    <button onClick={copyShareUrl} className="h-9 px-3 bg-zinc-900 text-white text-[11px] rounded-lg shrink-0">
                      {shareCopied ? "Copiat" : "Copiaza"}
                    </button>
                  </div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                  <p className="text-[11px] text-amber-800">
                    Codul <strong>{shareCode}</strong> nu se mai afiseaza dupa ce inchizi fereastra — trimite-l acum cumparatorului, separat de link.
                  </p>
                </div>
                <p className="text-[10px] text-zinc-400">Expira pe {shareResultExpires} sau dupa prima descarcare.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* modal AI analiza piata Smith */}
{showMarketAnalysis && (
  <div
    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-opacity duration-300 animate-fadeIn"
    onClick={() => setShowMarketAnalysis(false)}
  >
    <div
      className="bg-[#FDFBF7] font-serif border border-amber-900/10 rounded-2xl max-w-2xl w-full max-h-[88vh] overflow-y-auto shadow-[0_20px_50px_rgba(40,30,20,0.15)] relative"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Decorative top ambient glow */}
      <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-[#FF5CA1]/10 to-transparent pointer-events-none z-0" />

      {/* Sticky Header pe Crem Curat */}
      <div className="sticky top-0 bg-[#F7F4EB]/90 backdrop-blur-md border-b border-amber-900/10 px-6 py-4 flex items-center justify-between z-10">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-[#FF5CA1] font-bold">
            iMIDI e-Market
          </p>
          <h3 className="text-sm font-bold text-amber-950">Analiza pieței by AI Smith</h3>
        </div>
        <button
          onClick={() => setShowMarketAnalysis(false)}
          className="w-8 h-8 rounded-xl bg-amber-900/5 flex items-center justify-center text-xs text-amber-900/70 cursor-pointer hover:bg-[#FF5CA1] hover:text-white transition-all duration-200"
        >
          ✕
        </button>
      </div>

      {/* Rezultate și statistici animate / colorate */}
      <div className="p-6 space-y-6 relative z-10">
        {marketAnalysisLoading ? (
          <div className="flex flex-col items-center gap-3 text-sm text-amber-900/60 py-16 justify-center">
            <span className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-amber-900/20 border-t-[#FF5CA1]" />
            <p className="font-mono animate-pulse">Se generează analiza...</p>
          </div>
        ) : marketAnalysisError ? (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-4 font-sans">{marketAnalysisError}</p>
        ) : marketStats ? (
          <>
            {/* Carduri Statistici Ultra-Colorate cu Gradienți Neon iMIDI */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              <div className="bg-gradient-to-br from-[#FF5CA1]/10 to-[#8B5CF6]/10 border border-[#FF5CA1]/20 rounded-xl p-3.5 shadow-sm transform hover:scale-[1.02] transition-transform">
                <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-amber-950/60">Anunțuri active</p>
                <p className="text-2xl font-black text-amber-950 mt-1">{marketStats.totalListings}</p>
              </div>
              <div className="bg-gradient-to-br from-[#8B5CF6]/10 to-[#0070F3]/10 border border-[#8B5CF6]/20 rounded-xl p-3.5 shadow-sm transform hover:scale-[1.02] transition-transform">
                <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-amber-950/60">Vizualizări totale</p>
                <p className="text-2xl font-black text-amber-950 mt-1">{marketStats.totalViews}</p>
              </div>
              <div className="bg-gradient-to-br from-[#FF5CA1]/15 to-transparent border border-[#FF5CA1]/30 rounded-xl p-3.5 shadow-sm transform hover:scale-[1.02] transition-transform">
                <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-amber-950/60">Preț mediu</p>
                <p className="text-2xl font-black text-[#FF5CA1] mt-1">{marketStats.avgPriceOverall} €</p>
              </div>
              <div className="bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 border border-emerald-500/30 rounded-xl p-3.5 shadow-sm transform hover:scale-[1.02] transition-transform">
                <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-emerald-700">Noi (7 zile)</p>
                <p className="text-2xl font-black text-emerald-600 mt-1">+{marketStats.newThisWeek}</p>
              </div>
            </div>

            {/* Alert bară expirare */}
            {marketStats.expiringSoon > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 font-sans flex items-center gap-2">
                <span className="animate-bounce">🔔</span> {marketStats.expiringSoon} anunțuri expira în următoarele 3 zile
              </div>
            )}

            {/* Breakdown pe categorii - Bare colorate cu umbre și tranziții */}
            {marketStats.categoryBreakdown && marketStats.categoryBreakdown.length > 0 && (
              <div className="bg-[#F7F4EB] border border-amber-900/5 rounded-xl p-4 space-y-4">
                <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-950/60">
                  Distribuție pe categorii
                </p>
                <div className="space-y-3.5">
                  {marketStats.categoryBreakdown.map((c: any, i: number) => {
                    const maxCount = Math.max(...marketStats.categoryBreakdown.map((x: any) => x.total_listings));
                    const widthPct = (c.total_listings / maxCount) * 100;
                    
                    // Paletă vibrantă de culori premium pentru categorii (Pink, Violet, Blue, Emerald)
                    const colors = ["#FF5CA1", "#8B5CF6", "#0070F3", "#10b981"];
                    const currentColor = colors[i % colors.length];

                    return (
                      <div key={c.category} className="group">
                        <div className="flex justify-between text-xs mb-1.5 font-sans">
                          <span className="font-bold text-amber-950 capitalize">{c.category}</span>
                          <span className="text-neutral-500 text-[11px]">
                            <span className="font-semibold text-neutral-800">{c.total_listings}</span> anunțuri · <span className="font-semibold text-neutral-800">{c.avg_price}€</span> medie · {c.avg_views} views
                          </span>
                        </div>
                        <div className="w-full h-2.5 bg-white border border-amber-900/5 rounded-full overflow-hidden p-[1px]">
                          <div
                            className="h-full rounded-full transition-all duration-700 ease-out"
                            style={{ 
                              width: `${widthPct}%`, 
                              backgroundColor: currentColor,
                              boxShadow: `0 0 8px ${currentColor}50` 
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Top țări sub formă de Capsule Colorate */}
            {marketStats.topCountries && marketStats.topCountries.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-950/60">Top țări active</p>
                <div className="flex flex-wrap gap-2">
                  {marketStats.topCountries.map((c: any) => (
                    <span
                      key={c.country}
                      className="px-3 py-1.5 rounded-xl bg-white border border-amber-900/10 font-sans text-xs font-semibold text-amber-950 flex items-center gap-1.5 shadow-sm hover:border-[#8B5CF6]/40 transition-colors"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6]" />
                      {c.country} <span className="text-neutral-400 text-[11px]">({c.count})</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Rezumat AI - Card Stilizat cu Glow Lateral */}
            <div className="relative overflow-hidden rounded-xl border border-[#FF5CA1]/20 bg-white p-4 shadow-sm">
              <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-[#FF5CA1] to-[#8B5CF6]" />
              <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-[#FF5CA1] mb-2 flex items-center gap-1">
                <span>✦</span> Rezumat generate by AI
              </p>
              <p className="text-sm text-neutral-800 leading-relaxed font-sans">{marketAnalysisText}</p>
            </div>
          </>
        ) : null}
      </div>
    </div>
  </div>
)}


 {userError && <div className="text-white text-xs">{userError}</div>}
{facebookId && <MetaMess facebookUserId={facebookId} />}

      <Footer />
    </div>
  );
}