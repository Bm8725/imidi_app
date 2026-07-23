"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
// import { supabase } from "@/lib/supabase"; 

interface CloudBank { id: string | number; name: string; type: string; items_count: number; size_bytes: string; status: string; color_hex?: string; }

export default function CloudWorkspacePage() {
  const [activeTab, setActiveTab] = useState("all");
  const [banks, setBanks] = useState<CloudBank[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const itemsPerPage = 4;

  useEffect(() => {
    async function fetchCloudData() {
      setLoading(true); setError("");
      try {
        // =========================================================================
        // QUERY REAL SUPABASE: PAGINARE + FILTRARE STRICTĂ PE CATEGORII
        // =========================================================================
        // const from = (page - 1) * itemsPerPage;
        // const to = from + itemsPerPage - 1;
        // 
        // let query = supabase.from("cloud_banks").select("*");
        // 
        // if (activeTab !== "all") {
        //   const typeMap: Record<string, string> = { "audio banks": "Audio Bank", "midi packs": "MIDI Pack", "presets": "Presets" };
        //   query = query.eq("type", typeMap[activeTab]);
        // }
        // 
        // const { data, error: dbError } = await query
        //   .order("created_at", { ascending: false })
        //   .range(from, to);
        // 
        // if (dbError) throw dbError;
        // if (data) setBanks(data);

        throw new Error("Database connection failed. Table 'cloud_banks' could not be resolved or Supabase is offline.");
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred.");
      } finally { 
        setLoading(false); 
      }
    }
    fetchCloudData();
  }, [page, activeTab]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setPage(1);
  };

  return (
    <div className="bg-[#FAFAFA] text-[#111111] min-h-screen flex flex-col antialiased relative overflow-x-hidden">
      <style>{`@import url('https://googleapis.com'); .corp-sans { font-family: 'Inter', sans-serif; } .corp-mono { font-family: 'JetBrains Mono', monospace; }`}</style>
      <div className="absolute top-0 right-0 w-[600px] h-[500px] bg-gradient-to-b from-[#0070F3]/4 to-transparent rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808006_1px,transparent_1px),linear-gradient(to_bottom,#80808006_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none z-0" />
      
      <Navbar />

      <main className="corp-sans flex-1 w-full max-w-6xl mx-auto px-4 sm:px-8 pt-32 pb-16 relative z-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[#EAEAEA] pb-8 mb-8">
          <div>
            <div className="inline-flex items-center space-x-1.5 bg-black/[0.03] border border-black/[0.06] px-3 py-1 rounded-full mb-2">
              <span className={`w-1.5 h-1.5 rounded-full ${error ? "bg-red-500" : "bg-[#00DF89]"}`} />
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#666666]">{error ? "Database Offline" : "Production Node Active"}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-black">MySpace Cloud</h1>
          </div>
          <div className="flex items-center space-x-3">
            <button disabled={!!error} className="h-10 px-4 border border-[#EAEAEA] rounded-xl text-xs font-semibold bg-white hover:border-black transition-colors disabled:opacity-50">Import MIDI</button>
            <button disabled={!!error} className="h-10 px-4 rounded-xl text-xs font-bold bg-[#0070F3] text-white hover:bg-[#0060df] transition-all disabled:opacity-50">+ Upload Audio Bank</button>
          </div>
        </div>

        <div className="flex items-center space-x-1 border-b border-[#EAEAEA] mb-6 overflow-x-auto scrollbar-none">
          {["all", "audio banks", "midi packs", "presets"].map((t) => (
            <button 
              key={t} 
              onClick={() => handleTabChange(t)} 
              className={`h-10 px-4 text-xs font-semibold uppercase tracking-wider transition-all border-b-2 -mb-[2px] whitespace-nowrap ${activeTab === t ? "border-black text-black font-bold" : "border-transparent text-[#666666] hover:text-black"}`}
            >
              {t}
            </button>
          ))}
        </div>

        {error ? (
          <div className="w-full bg-white border border-red-200 rounded-2xl p-8 text-center space-y-4 shadow-[0_1px_2px_rgba(0,0,0,0.01)] animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto text-lg font-bold">!</div>
            <h3 className="text-sm font-bold text-black tracking-tight">Sync Failure</h3>
            <p className="text-[11px] font-medium text-red-600 bg-red-50/60 border border-red-100 rounded-xl px-4 py-2.5 inline-block corp-mono text-left w-full truncate">Error: {error}</p>
          </div>
        ) : loading ? (
          <div className="space-y-4"><div className="h-20 w-full bg-white border border-[#EAEAEA] rounded-2xl animate-pulse" /><div className="h-20 w-full bg-white border border-[#EAEAEA] rounded-2xl animate-pulse" /></div>
        ) : (
          <>
            {banks.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-[#EAEAEA] rounded-2xl bg-white"><p className="text-xs text-[#666666]">No production packages found in this layer.</p></div>
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
                        <div className="flex items-center space-x-2 text-xs text-[#666666]"><span className="corp-mono text-[10px] bg-black/[0.03] border border-black/[0.05] px-1.5 py-0.5 rounded-md font-medium">{bank.type}</span><span>•</span><span>{bank.items_count} items</span><span>•</span><span>{bank.size_bytes}</span></div>
                      </div>
                    </div>
                    <button className="w-8 h-8 rounded-lg border border-[#EAEAEA] bg-[#FAFAFA] flex items-center justify-center text-xs text-black hover:bg-black hover:text-white transition-all">→</button>
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
