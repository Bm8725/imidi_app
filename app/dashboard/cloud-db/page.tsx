"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { supabase } from "@/lib/supabase"; 

interface CloudBank { id: string | number; name: string; type: string; items_count: number; size_mb: number; status: string; color_hex?: string; }

export default function CloudWorkspacePage() {
  const [activeTab, setActiveTab] = useState("all");
  const [banks, setBanks] = useState<CloudBank[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalUsedMb, setTotalUsedMb] = useState(0);
  const [userEmail, setUserEmail] = useState("");
  const itemsPerPage = 4;
  const maxStorageMb = 20 * 1024;

  useEffect(() => {
    async function fetchCloudData() {
      setLoading(true); setError("");
      try {
        const { data: { session }, error: authError } = await supabase.auth.getSession();
        if (authError || !session) throw new Error("Unauthorized. Please log in with your user and password.");
        setUserEmail(session.user.email || "");
        
        const { data: allUserBanks, error: sumError } = await supabase.from("cloud_banks").select("size_mb").eq("user_id", session.user.id);
        if (sumError) throw sumError;
        if (allUserBanks) setTotalUsedMb(allUserBanks.reduce((acc, curr) => acc + Number(curr.size_mb), 0));

        const from = (page - 1) * itemsPerPage;
        let query = supabase.from("cloud_banks").select("*").eq("user_id", session.user.id);
        if (activeTab !== "all") query = query.eq("type", { "audio banks": "Audio Bank", "midi packs": "MIDI Pack", "presets": "Presets" }[activeTab]);
        
        const { data, error: dbError } = await query.order("created_at", { ascending: false }).range(from, from + itemsPerPage - 1);
        if (dbError) throw dbError; if (data) setBanks(data);
      } catch (err: any) { setError(err.message || "An error occurred."); } finally { setLoading(false); }
    }
    fetchCloudData();
  }, [page, activeTab]);

  const usedGb = (totalUsedMb / 1024).toFixed(2);
  const storagePercentage = Math.min(100, (totalUsedMb / maxStorageMb) * 100);

  return (
    <div className="bg-[#FAFAFA] text-[#111111] min-h-screen flex flex-col antialiased relative overflow-x-hidden">
      <style>{`@import url('https://googleapis.com'); .corp-sans { font-family: 'Inter', sans-serif; } .corp-mono { font-family: 'JetBrains Mono', monospace; }`}</style>
      <div className="absolute top-0 right-0 w-[600px] h-[500px] bg-gradient-to-b from-[#0070F3]/4 to-transparent rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808006_1px,transparent_1px),linear-gradient(to_bottom,#80808006_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none z-0" />
      <Navbar />
      <main className="corp-sans flex-1 w-full max-w-6xl mx-auto px-4 sm:px-8 pt-32 pb-16 relative z-10">
        {error ? (
          <div className="w-full max-w-md mx-auto bg-white border border-neutral-200 rounded-3xl p-8 text-center space-y-4 shadow-sm mt-12">
            <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto text-lg font-bold">!</div>
            <h3 className="text-sm font-bold text-black tracking-tight">Access Denied</h3>
            <p className="text-xs text-[#666666]">{error}</p>
            {error.includes("Unauthorized") && <div className="pt-2"><Link href="/login" className="inline-flex items-center justify-center h-10 px-4 rounded-xl text-xs font-semibold bg-black text-white hover:bg-neutral-900">Go to Sign In →</Link></div>}
          </div>
        ) : loading ? (
          <div className="space-y-4"><div className="h-20 w-full bg-white border border-[#EAEAEA] rounded-2xl animate-pulse" /><div className="h-20 w-full bg-white border border-[#EAEAEA] rounded-2xl animate-pulse" /></div>
        ) : (
          <>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[#EAEAEA] pb-6 mb-6">
              <div>
                <div className="inline-flex items-center space-x-1.5 bg-black/[0.03] border border-black/[0.06] px-3 py-1 rounded-full mb-2"><span className="w-1.5 h-1.5 rounded-full bg-[#00DF89]" /><span className="text-[10px] font-bold uppercase tracking-widest text-[#666666] corp-mono">{userEmail}</span></div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-black">MySpace Cloud</h1>
              </div>
              <div className="flex items-center space-x-3">
                <button className="h-10 px-4 border border-[#EAEAEA] rounded-xl text-xs font-semibold bg-white hover:border-black">Import MIDI</button>
                <button disabled={totalUsedMb >= maxStorageMb} className="h-10 px-4 rounded-xl text-xs font-bold bg-[#0070F3] text-white hover:bg-[#0060df] shadow-sm disabled:opacity-50">{totalUsedMb >= maxStorageMb ? "Storage Full" : "+ Upload Audio Bank"}</button>
              </div>
            </div>
            <div className="bg-white border border-[#EAEAEA] p-5 rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.01)] mb-8 max-w-md">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#666666]">Ecosystem Storage Capacity</span>
              <div className="text-lg font-extrabold mt-1 text-black">{usedGb} GB <span className="text-xs font-medium text-[#999999]">used of 20.00 GB</span></div>
              <div className="w-full h-2 bg-[#FAFAFA] border border-[#EAEAEA] rounded-full mt-3 overflow-hidden"><div className={`h-full rounded-full transition-all duration-500 ${storagePercentage > 90 ? "bg-red-500" : "bg-black"}`} style={{ width: `${storagePercentage}%` }} /></div>
            </div>
            <div className="flex items-center space-x-1 border-b border-[#EAEAEA] mb-6 overflow-x-auto scrollbar-none">
              {["all", "audio banks", "midi packs", "presets"].map((t) => (
                <button key={t} onClick={() => { setActiveTab(t); setPage(1); }} className={`h-10 px-4 text-xs font-semibold uppercase tracking-wider transition-all border-b-2 -mb-[2px] whitespace-nowrap ${activeTab === t ? "border-black text-black font-bold" : "border-transparent text-[#666666]"}`}>{t}</button>
              ))}
            </div>
            {banks.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-[#EAEAEA] rounded-2xl bg-white"><p className="text-xs text-[#666666]">No storage blocks active in this node.</p></div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {banks.map((bank) => (
                  <div key={bank.id} className="group bg-white border border-[#EAEAEA] rounded-2xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.01)] hover:border-[#0070F3]/30 transition-all flex items-center justify-between">
                    <div className="flex items-center space-x-4 min-w-0">
                      <div className="w-11 h-11 rounded-xl flex flex-col justify-between p-2.5 shrink-0" style={{ backgroundColor: `${bank.color_hex || "#0070F3"}12`, border: `1px solid ${bank.color_hex || "#0070F3"}30` }}>
                        <div className="flex justify-between items-end h-full w-full space-x-[2px]"><span className="w-[3px] bg-current rounded-xs animate-pulse" style={{ color: bank.color_hex || "#0070F3", height: "60%" }} /><span className="w-[3px] bg-current rounded-xs" style={{ color: bank.color_hex || "#0070F3", height: "90%" }} /></div>
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <h3 className="text-sm font-bold text-black tracking-tight truncate">{bank.name}</h3>
                        <div className="flex items-center space-x-2 text-xs text-[#666666]"><span className="corp-mono text-[10px] bg-black/[0.03] border border-black/[0.05] px-1.5 py-0.5 rounded-md font-medium">{bank.type}</span><span>•</span><span>{bank.items_count} items</span><span>•</span><span>{bank.size_mb} MB</span></div>
                      </div>
                    </div>
                    <button className="w-8 h-8 rounded-lg border border-[#EAEAEA] bg-[#FAFAFA] flex items-center justify-center text-xs text-black hover:bg-black hover:text-white">→</button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center justify-end space-x-2 mt-8 pt-4 border-t border-[#EAEAEA]">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="h-9 px-4 border border-[#EAEAEA] rounded-xl text-xs font-semibold bg-white hover:border-black transition-colors disabled:opacity-40">Previous</button>
              <span className="text-xs font-medium text-[#666666] px-2">Page {page}</span>
              <button onClick={() => setPage((p) => p + 1)} disabled={banks.length < itemsPerPage} className="h-9 px-4 border border-[#EAEAEA] rounded-xl text-xs font-semibold bg-white hover:border-black transition-colors disabled:opacity-40">Next</button>
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
