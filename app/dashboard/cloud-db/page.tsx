"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { supabase } from "@/lib/supabase";

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

  const lim = 6, maxMb = 50;

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Unauthorized. Please log in.");
        setUser({ id: session.user.id, email: session.user.email, name: session.user.user_metadata?.full_name || "Operator", avatar: `https://dicebear.com{session.user.id}` });
        
        const { data: all } = await supabase.from("cloud_banks").select("size_mb").eq("user_id", session.user.id);
        if (all) setTotalUsedMb(all.reduce((acc, c) => acc + Number(c.size_mb), 0));

        let q = supabase.from("cloud_banks").select("*").eq("user_id", session.user.id);
        if (activeTab !== "all") q = q.eq("type", { "audio banks": "Audio Bank", "midi packs": "MIDI Pack", "presets": "Presets" }[activeTab]);
        
        const { data } = await q.order("created_at", { ascending: false }).range((page - 1) * lim, page * lim - 1);
        if (data) setBanks(data);
      } catch (err: any) { setError(err.message); } finally { setLoading(false); }
    })();
  }, [page, activeTab]);

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
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-4 mb-6 gap-4">
              <div>
                <h1 className="text-xl font-bold tracking-tight">iMIDI MyCloud</h1>
                <p className="text-[11px] text-zinc-400">{user?.email}</p>
              </div>
              <div className="flex gap-2">
                <button disabled={totalUsedMb >= maxMb || uploading} onClick={() => fileRef.current?.click()} className="h-8 px-3 border rounded-lg text-xs font-medium bg-white shadow-sm disabled:opacity-40">Import</button>
                <button disabled={totalUsedMb >= maxMb || uploading} onClick={() => fileRef.current?.click()} className="h-8 px-3 bg-zinc-900 text-white text-xs font-medium rounded-lg disabled:opacity-40 shadow-sm">{uploading ? "Loading..." : "+ Upload"}</button>
                <button onClick={handleLogout} disabled={loggingOut} className="h-8 px-3 border rounded-lg text-xs font-medium bg-white shadow-sm text-red-500 hover:bg-red-50 disabled:opacity-40 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                  {loggingOut ? "..." : "Log out"}
                </button>
                <Link href="/update-password" className="h-8 px-3 border rounded-lg text-xs font-medium bg-white shadow-sm text-zinc-900 hover:bg-zinc-100 disabled:opacity-40 flex items-center gap-1">
                  Reset password
                </Link>
            
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
                <div className="text-[11px] text-zinc-500 flex justify-between font-medium"><span>Stocare</span><span>{totalUsedMb.toFixed(1)} / {maxMb} MB</span></div>
                <div className="w-full h-1.5 bg-zinc-100 rounded-full mt-1 border overflow-hidden"><div className={`h-full transition-all ${pct > 85 ? "bg-red-500" : pct > 60 ? "bg-amber-500" : "bg-zinc-900"}`} style={{ width: `${pct}%` }} /></div>
              </div>
            </div>

            {totalUsedMb >= maxMb && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <p className="text-xs text-amber-800">Ai atins limita gratuită de {maxMb} MB. Nu mai poți urca fișiere noi până nu eliberezi spațiu sau extinzi stocarea.</p>
                <Link href="/pricing" className="shrink-0 h-7 px-3 flex items-center bg-amber-900 text-white text-[11px] font-semibold rounded-lg whitespace-nowrap">Vezi opțiuni de stocare</Link>
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
      <Footer />
    </div>
  );
}