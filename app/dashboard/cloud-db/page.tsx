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
  const openShareModal = (bank: any) => {
    setShareBank(bank);
    setShareCode("");
    setShareError("");
    setShareResultUrl("");
    setShareResultExpires("");
    setShareCopied(false);
  };

  const closeShareModal = () => {
    setShareBank(null);
  };

  const generateShareLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareBank) return;
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
    // Fundalul Ableton Live (Dark Grey industrial) cu texturi techno și selecție saturată
    <div className="bg-[#181818] text-[#D0D0D0] min-h-screen flex flex-col antialiased selection:bg-[#FF7A1A] selection:text-black relative overflow-hidden">
      
      {/* Pete fine de lumină ambientală în fundal (LED Backlight dinamic) */}
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-[#FF7A1A]/3 rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="absolute bottom-10 left-1/4 w-[400px] h-[400px] bg-indigo-500/[0.02] rounded-full blur-[120px] pointer-events-none z-0" />

      <Navbar />
      
      {/* Mainframe optimizat cu o grilă tehnică fină (grid-lines discrete) */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 pt-32 pb-12 relative z-10 font-mono tracking-tight bg-[#1C1C1C]/40 border-x border-zinc-900/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        
        {/* Contur decorativ specific panourilor din Ableton */}
        <div className="absolute inset-0 border border-zinc-900/40 pointer-events-none rounded-sm m-2 opacity-50" />
        
        {/* Conținutul paginii tale se va randa aici, plutind deasupra finisajului industrial */}




        {error ? (
          <div className="text-center p-6 bg-white border rounded-xl max-w-sm mx-auto shadow-sm mt-12">
            <p className="text-xs text-zinc-500 mb-4">{error}</p>
            <Link href="/login" className="px-4 py-2 bg-zinc-900 text-white text-xs font-semibold rounded-lg block">Autentication </Link>
          </div>
        ) : (
          <>
            <input type="file" multiple ref={fileRef} onChange={handleUpload} className="hidden" accept="audio/*,.mid,.midi,.fxp,.fxb,.vital,.fst,.adg,.adv,.pst,.json,.ts4,.bin,.jsf,.jbb,.sf2,.hex,.jbs,.prf,.bup" />
            
{/* PLATFORMA GRID ULTRA-PREMIUM (SIDEBAR INTEGRAT SAAS) */}
<div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch w-full mb-10">
  
  {/* PANOU PRINCIPAL (STÂNGA - 2 TREIMI): CONTROL VAULT */}
  <div className="lg:col-span-2 flex flex-col justify-between bg-[#0D0D0D] border border-zinc-800/80 p-6 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.6)] min-h-[190px] relative overflow-hidden group">
    
    {/* POZA DE FUNDAL: AVATAR SAU IMPLICIT profile.jpg */}
    <div className="absolute inset-0 z-0 pointer-events-none select-none overflow-hidden">
      <img 
        src={user?.avatar || "/profile.jpg"} 
        alt="Vault Background" 
        className="w-full h-full object-cover opacity-25 blur-[3px] group-hover:scale-105 transition-transform duration-700 ease-out"
        onError={(e) => { e.currentTarget.src = "/profile.jpg"; }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0D0D0D] via-[#0D0D0D]/80 to-transparent" />
    </div>

    {/* Glow decorativ subtil pe fundal */}
    <div className="absolute -top-12 -left-12 w-32 h-32 bg-[#FF7A1A]/5 rounded-full blur-3xl pointer-events-none z-0" />
    
    <div className="relative z-10 space-y-1">
      <h1 className="text-2xl font-black tracking-tight text-white">
        iMIDI <span className="bg-gradient-to-r from-[#FF7A1A] to-[#ff9f54] bg-clip-text text-transparent">MyCloud</span>
      </h1>
      <div className="flex items-center gap-2">
        {/* TEXT SCHIMBAT PE ALB CURAT */}
        <p className="text-xs font-mono text-white select-none tracking-wider">{user?.email}</p>
      </div>
    </div>

    {/* Zona Acțiuni Butoane */}
    <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2.5 w-full mt-6 relative z-10">
      
      {/* Buton Upload cu efect de adâncime */}
      <button 
        disabled={totalUsedMb >= maxMb || uploading} 
        onClick={() => fileRef.current?.click()} 
        className="h-10 px-5 bg-[#FF7A1A] hover:bg-[#e06613] active:scale-[0.97] text-black text-xs font-extrabold uppercase tracking-widest rounded-xl disabled:opacity-20 disabled:pointer-events-none transition-all duration-200 flex items-center justify-center gap-2 col-span-2 sm:col-span-1 shadow-[0_0_25px_rgba(255,122,26,0.15)] cursor-pointer"
      >
        {uploading ? (
          <>
            <span className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            <span className="animate-pulse tracking-normal font-bold">Syncing...</span>
          </>
        ) : (
          <>
            <span className="text-base font-black leading-none">+</span>
            <span>Upload</span>
          </>
        )}
      </button>

      {/* Buton Istoric Descărcări - TEXT ALB */}
      <button
        onClick={openDownloadHistory}
        className="h-10 px-4 border border-zinc-700 rounded-xl text-xs font-semibold bg-zinc-900 text-white hover:bg-zinc-800 hover:border-zinc-600 active:scale-[0.97] transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
      >
        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>Istoric</span>
      </button>

      {/* Buton Reset Pass - TEXT ALB */}
      <Link 
        href="/update-password" 
        className="h-10 px-4 border border-zinc-700 rounded-xl text-xs font-semibold bg-zinc-900 text-white hover:bg-zinc-800 hover:border-zinc-600 active:scale-[0.97] transition-all duration-200 flex items-center justify-center gap-2"
      >
        Reset pass
      </Link>

      {/* Buton Log Out - TEXT ROȘU CLAR */}
      <button 
        onClick={handleLogout} 
        disabled={loggingOut} 
        className="h-10 px-4 border border-zinc-700 rounded-xl text-xs font-semibold bg-zinc-900 text-red-400 hover:text-red-300 hover:bg-red-950/40 hover:border-red-900/50 active:scale-[0.97] disabled:opacity-20 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
      >
        {loggingOut ? (
          <span className="w-3.5 h-3.5 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
        ) : (
          <svg className="w-3.5 h-3.5 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        )}
        <span>{loggingOut ? "Ieșire..." : "Log out"}</span>
      </button>

      {/* Buton AI - Gradient Cyberpunk Strălucitor */}
      <button
        onClick={runMarketAnalysis}
        className="h-10 px-4 rounded-xl text-xs font-extrabold uppercase tracking-wider bg-gradient-to-r from-[#6366F1] via-[#4F46E5] to-[#0EA5E9] text-white shadow-[0_0_20px_rgba(99,102,241,0.2)] flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.01] hover:brightness-110 active:scale-[0.97] transition-all duration-200 col-span-2 sm:col-span-1 select-none"
      >
        <span className="text-sm text-purple-200">✦</span>
        <span>AI Analyse</span>
      </button>

    </div>
  </div>

  {/* SIDEBAR WIDGET (DREAPTA - O TREIME): PROFILE & STOCARE */}
  <div className="bg-[#0D0D0D] border border-zinc-800/80 p-6 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.6)] flex flex-col justify-between h-full min-h-[190px]">
    
    {/* Header Profil în Sidebar */}
    <div className="flex items-center justify-between w-full pb-4 border-b border-zinc-800">
      <div className="flex items-center gap-3">
        <div className="relative">
          <img 
            src={user?.avatar || "/profile.jpg"} 
            alt="User Avatar"
            className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-700 object-cover shadow-inner" 
            onError={(e) => { e.currentTarget.src = "/profile.jpg"; }}
          />
          <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#FF7A1A] border-2 border-[#0D0D0D]" />
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-white uppercase tracking-widest font-mono font-bold">User</span>
          <span className="text-sm font-bold text-white max-w-[110px] truncate tracking-wide">{user?.name || "Uploading..."}</span>
        </div>
      </div>
      
      {/* Badge Plan Stilizat Minimalist */}
      <div className="shrink-0 flex items-center">
        {plan === "free" && <span className="text-[9px] font-bold text-white font-mono border border-zinc-700 bg-zinc-900 px-2 py-1 rounded-md uppercase tracking-wider">FREE</span>}
        {plan === "pro" && <span className="text-[9px] font-black text-black font-mono bg-emerald-400 px-2 py-1 rounded-md uppercase tracking-wider">PRO</span>}
        {plan === "enterprise" && <span className="text-[9px] font-black text-black font-mono bg-cyan-400 px-2 py-1 rounded-md uppercase tracking-wider">FULL</span>}
      </div>
    </div>

    {/* Statistici volum stocare */}
    <div className="w-full mt-4 flex-1 flex flex-col justify-end">
      <div className="text-[10px] text-white flex justify-between font-mono tracking-widest font-black items-center mb-2">
        <span>VAULT STORAGE</span>
        <span className="text-white font-bold font-sans tracking-normal">
          {totalUsedMb >= 1024 ? `${(totalUsedMb / 1024).toFixed(2)} GB` : `${totalUsedMb.toFixed(1)} MB`}
          <span className="text-zinc-500 px-1 font-mono">/</span>
          {maxMb >= 1024 ? `${(maxMb / 1024).toFixed(0)} GB` : `${maxMb} MB`}
        </span>
      </div>
      
      {/* Bara progres */}
      <div className="w-full h-2 bg-zinc-950 rounded-full border border-zinc-800 overflow-hidden relative">
        <div 
          className={`h-full transition-all duration-700 ease-out shadow-[0_0_15px_rgba(255,122,26,0.3)] ${
            pct > 85 ? "bg-gradient-to-r from-red-600 to-red-400" : pct > 60 ? "bg-gradient-to-r from-amber-600 to-amber-400" : "bg-gradient-to-r from-[#FF7A1A] to-[#ffa566]"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>

    {/* Butoane premium pentru extindere spațiu */}
    <div className="w-full mt-5 pt-3 border-t border-zinc-800">
      {/* Pas 1: Free -> Pro (30GB) */}
      {plan === "free" && (
        <button
          onClick={handleBuyCloud}
          disabled={buyingCloud}
          className="w-full h-9 px-4 bg-[#FF7A1A] hover:bg-[#e06613] text-black text-xs font-black uppercase tracking-widest rounded-xl disabled:opacity-20 whitespace-nowrap active:scale-[0.98] transition-all cursor-pointer shadow-[0_4px_15px_rgba(255,122,26,0.1)]"
        >
          {buyingCloud ? "Activare..." : "Upgrade 30GB · $50"}
        </button>
      )}

      {/* Pas 2: Pro -> Enterprise (250GB) */}
      {plan === "pro" && (
        <button
          onClick={handleBuyEnterprise}
          disabled={buyingEnterprise}
          className="w-full h-9 px-4 bg-zinc-900 border border-zinc-700 text-white hover:text-[#FF7A1A] hover:border-[#FF7A1A]/40 text-xs font-bold rounded-xl disabled:opacity-20 whitespace-nowrap active:scale-[0.98] transition-all cursor-pointer"
        >
          {buyingEnterprise ? "Activare..." : "Extinde 250GB · $149.90"}
        </button>
      )}

      {/* Pas 3: Enterprise activ (250GB) */}
      {plan === "enterprise" && (
        <div className="w-full h-9 px-4 flex items-center justify-center gap-2 border border-cyan-500/20 bg-cyan-950/20 text-cyan-400 text-xs font-bold font-mono tracking-widest uppercase rounded-xl whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
          Vault Securizat Maximum
        </div>
      )}
    </div>
  </div>

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


<div className="flex gap-0.5 bg-[#181818] p-0.5 rounded-sm w-fit mb-6 border border-[#2C2C2C] font-mono shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)]">
  {["all", "audio banks", "midi packs", "presets"].map(t => (
    <button 
      key={t} 
      onClick={() => { setActiveTab(t); setPage(1); }} 
      className={`h-6 px-3 text-[10px] uppercase tracking-wider rounded-xs transition-colors cursor-pointer ${
        activeTab === t 
          ? "bg-[#333333] text-white border border-[#444444] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] font-bold" 
          : "text-zinc-500 hover:text-zinc-300 hover:bg-[#222222]/50"
      }`}
    >
      {t}
    </button>
  ))}
</div>


 {loading ? (
  /* State de Loading stilizat ca rack hardware gol în curs de scanare */
  <div className="h-16 bg-[#222222] border border-[#2C2C2C] rounded-sm animate-pulse flex items-center px-4 font-mono text-[10px] text-zinc-500 uppercase tracking-wider">
    Scanning device parameters...
  </div>
) : banks.length === 0 ? (
  /* State Empty - Stil ecran LCD Ableton când nu sunt date */
  <div className="text-center py-10 border border-dashed border-[#2C2C2C] rounded-sm bg-[#1E1E1E] font-mono text-[10px] text-zinc-500 uppercase tracking-widest">
    No packs or file found on track!
  </div>
) : (
  /* Grid-ul cu fișiere - Stil canale Mixer Ableton */
  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
    {banks.map(b => (
      <div 
        key={b.id} 
        className="bg-[#222222] border border-[#2C2C2C] p-3 rounded-sm flex items-center justify-between hover:bg-[#2A2A2A] hover:border-zinc-700 group transition-all shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]"
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Iconiță tip LED - folosește culoarea b.color_hex ca un bec hardware */}
          <div 
            className="w-8 h-8 rounded-sm flex items-center justify-center text-xs font-mono font-bold select-none border" 
            style={{ 
              backgroundColor: `${b.color_hex}08`, 
              borderColor: `${b.color_hex}30`,
              color: b.color_hex,
              textShadow: `0 0 6px ${b.color_hex}40`
            }}
          >
            {b.type === "Presets" ? "🎛️" : b.type === "MIDI Pack" ? "🎹" : "🎵"}
          </div>
          
          <div className="min-w-0 font-mono">
            {/* Titlu fișier - Text alb pur curat, foarte lizibil */}
            <h3 className="text-xs font-bold text-white truncate pr-2 tracking-tight" title={b.name}>
              {b.name}
            </h3>
            {/* Detalii tehnice - Gri fin industrial */}
            <p className="text-[10px] text-zinc-400 mt-0.5 uppercase tracking-tight">
              {b.type} <span className="text-zinc-600">•</span> {b.size_mb < 0.1 ? `${(b.size_mb * 1024).toFixed(0)} KB` : `${b.size_mb} MB`}
            </p>
          </div>
        </div>

        {/* Zona Butoane Acțiuni - Stil butoane iluminate de controller DJ */}
        <div className="shrink-0 z-20 flex items-center gap-1 font-mono">
          {delId === b.id ? (
            /* Pop-up confirmare ștergere integrat în designul tehnic */
            <div className="flex gap-1 bg-[#1A1A1A] p-1 border border-[#2C2C2C] rounded-sm">
              <button 
                onClick={async () => { 
                  await supabase.from("cloud_banks").delete().eq("id", b.id); 
                  setDelId(null); 
                  window.location.reload(); 
                }} 
                className="px-2 py-0.5 bg-red-600 hover:bg-red-500 text-white text-[9px] font-bold uppercase rounded-sm transition-colors"
              >
                yes
              </button>
              <button 
                onClick={() => setDelId(null)} 
                className="px-2 py-0.5 text-zinc-400 hover:text-white text-[9px] font-bold uppercase rounded-sm transition-colors"
              >
                No
              </button>
            </div>
          ) : (
            <>
              {/* Buton Share */}
              <button 
                onClick={() => openShareModal(b)} 
                className="w-7 h-7 rounded-sm flex items-center justify-center border border-transparent text-zinc-500 hover:text-[#FF7A1A] hover:bg-[#2C2C2C] hover:border-zinc-700 sm:opacity-0 group-hover:opacity-100 transition-all cursor-pointer" 
                title="Genereaza link de vanzare"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <path strokeLinecap="round" d="M8.6 10.5l6.8-4M8.6 13.5l6.8 4" />
                </svg>
              </button>

              {/* Buton Download */}
              <button 
                onClick={() => handleDownload(b)} 
                disabled={downloadingId === b.id} 
                className="w-7 h-7 rounded-sm flex items-center justify-center border border-transparent text-zinc-500 hover:text-white hover:bg-[#2C2C2C] hover:border-zinc-700 sm:opacity-0 group-hover:opacity-100 transition-all disabled:opacity-100 cursor-pointer"
              >
                {downloadingId === b.id ? (
                  <svg className="w-3.5 h-3.5 animate-spin text-[#FF7A1A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                  </svg>
                )}
              </button>

              {/* Buton Șterge */}
              <button 
                onClick={() => setDelId(b.id)} 
                className="w-7 h-7 rounded-sm flex items-center justify-center border border-transparent text-zinc-500 hover:text-red-500 hover:bg-red-950/20 hover:border-red-900/30 sm:opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
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
    className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 font-mono select-none" 
    onClick={() => setShowDownloadHistory(false)}
  >
    <div 
      className="bg-[#1E1E1E] text-[#D0D0D0] border border-[#2C2C2C] rounded-sm p-5 max-w-lg w-full shadow-[0_25px_60px_rgba(0,0,0,0.8)] space-y-4 max-h-[80vh] overflow-y-auto flex flex-col transition-all" 
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header Modal - Stil Rack Parametri */}
      <div className="flex items-center justify-between shrink-0 pb-3 border-b border-[#2C2C2C]">
        <div className="space-y-0.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#FF7A1A]">TRACK LOG</p>
          <h3 className="text-xs font-bold text-white uppercase tracking-tight">Descărcări pachete</h3>
        </div>
        <button 
          onClick={() => setShowDownloadHistory(false)} 
          className="w-7 h-7 rounded-sm bg-[#1A1A1A] border border-[#333333] flex items-center justify-center text-[10px] text-zinc-400 cursor-pointer hover:bg-[#FF7A1A] hover:text-black hover:border-transparent transition-all active:scale-95"
        >
          ✕
        </button>
      </div>

      {/* Corp Modal / Conținut */}
      <div className="flex-1 overflow-y-auto pr-1 text-xs">
        {downloadHistoryLoading ? (
          /* Skeleton Loader Premium - Stil LED Scan */
          <div className="space-y-1.5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex justify-between items-center p-3 border border-[#2C2C2C] bg-[#222222] rounded-sm animate-pulse">
                <div className="space-y-2 w-1/3">
                  <div className="h-2.5 bg-zinc-800 rounded-sm w-full" />
                  <div className="h-1.5 bg-zinc-900 rounded-sm w-2/3" />
                </div>
                <div className="space-y-1.5 w-1/4 flex flex-col items-end">
                  <div className="h-2 bg-zinc-800 rounded-sm w-3/4" />
                  <div className="h-1.5 bg-zinc-900 rounded-sm w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : downloadHistoryError ? (
          <div className="p-3 bg-red-950/20 border border-red-900/40 rounded-sm flex items-center gap-2">
            <span className="text-red-400 text-sm">⚠️</span>
            <p className="text-xs text-red-400 font-mono font-medium">{downloadHistoryError}</p>
          </div>
        ) : downloadHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 border border-dashed border-[#2C2C2C] rounded-sm bg-[#1A1A1A] text-center px-4 space-y-2">
            <div className="w-10 h-10 rounded-sm bg-[#222222] border border-[#2C2C2C] flex items-center justify-center text-zinc-500 text-base">📁</div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Nicio descărcare pe canal.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-zinc-500 px-0.5">
              <span>{downloadHistory.length} {downloadHistory.length === 1 ? 'LOG' : 'LOGS TOTAL'}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF7A1A] shadow-[0_0_6px_rgba(255,122,26,0.6)]" />
            </div>

            {/* Listă cu design mixer audio (canale separate cu hover fin) */}
            <div className="space-y-1.5 max-h-[45vh] overflow-y-auto pr-0.5">
              {downloadHistory.map((row) => {
                const dt = new Date(row.downloaded_at);
                const data = dt.toLocaleDateString("ro-RO", { day: '2-digit', month: '2-digit', year: 'numeric' });
                const ora = dt.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
                
                return (
                  <div 
                    key={row.id} 
                    className="flex items-center justify-between p-3 bg-[#222222] border border-[#2C2C2C] hover:bg-[#2A2A2A] hover:border-zinc-700 rounded-sm transition-all group shadow-[inset_0_1px_0_rgba(255,255,255,0.01)]"
                  >
                    {/* Detalii Bancă */}
                    <div className="min-w-0 pr-3 flex items-center gap-3">
                      <div className="w-7 h-7 rounded-sm bg-[#1A1A1A] border border-[#2C2C2C] group-hover:border-[#FF7A1A]/30 flex items-center justify-center text-xs shrink-0 transition-colors">
                        {row.bank_name?.toLowerCase().includes('edge') ? '🏦' : '💳'}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-white truncate text-xs tracking-tight" title={row.bank_name}>
                          {row.bank_name}
                        </p>
                        <span className="inline-flex items-center mt-0.5 text-[9px] font-bold uppercase tracking-wider text-[#00F0FF]">
                          {row.bank_type || "Nespecificat"}
                        </span>
                      </div>
                    </div>

                    {/* Dată / Timp - Afișaj curat de ceas hardware */}
                    <div className="shrink-0 text-right space-y-0.5">
                      <p className="text-zinc-300 font-bold tracking-tight">{data}</p>
                      <p className="text-[10px] text-zinc-500 font-mono font-medium">{ora}</p>
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

            {!shareResultUrl ? (
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