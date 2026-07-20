"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function TryTS4XPage() {
  const [formData, setFormData] = useState({ deviceId: "", systemOS: "android", licenseType: "personal" });
  const [isDeployed, setIsDeployed] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleDeploy = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setIsDeployed(true);
    }, 1500);
  };

  return (
    <div className="bg-[#030305] text-[#E4E4E9] min-h-screen flex flex-col justify-between relative font-mono selection:bg-orange-500/30 selection:text-white">
      
      {/* BACKGROUND MATRIX GRID */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#111116_1px,transparent_1px),linear-gradient(to_bottom,#111116_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_30%,#000_80%,transparent_100%)] pointer-events-none opacity-20" />
      
      <Navbar />

      {/* CONTINUT CENTRAL */}
      <main className="flex-1 w-full max-w-5xl mx-auto flex items-center justify-center px-4 pt-28 pb-16 z-10">
        <div className="w-full border border-white/[0.05] bg-[#060608]/70 backdrop-blur-2xl rounded-2xl shadow-[0_40px_80px_-30px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col min-h-[480px]">
          
          {/* HEADER CONSOLĂ */}
          <div className="p-4 sm:p-6 border-b border-white/[0.05] flex justify-between items-center bg-white/[0.01]">
            <div className="text-left">
              <span className="text-[9px] text-orange-500/60 tracking-[0.25em] block font-bold">// DEPLOY_STATION</span>
              <h1 className="text-xl font-light text-white uppercase tracking-wider">
                TS4X <span className="text-orange-500 font-sans font-black">Terminal</span>
              </h1>
            </div>
            <div className="flex items-center gap-2 text-[9px] border border-white/[0.06] bg-black/50 h-7 px-3 rounded-full text-zinc-400">
              <span className={`w-1.5 h-1.5 rounded-full relative ${isDeployed ? "bg-orange-500" : "bg-zinc-600 animate-pulse"}`}>
                {isDeployed && <span className="absolute inset-0 bg-orange-500 rounded-full animate-ping opacity-60" />}
              </span>
              <span className="tracking-widest font-bold">{isDeployed ? "TUNNEL_READY" : "AWAITING_IO"}</span>
            </div>
          </div>

          {/* INSTANȚĂ FORMULAR / REZULTAT */}
          <div className="flex-1 flex flex-col justify-center">
            {!isDeployed ? (
              <div className="grid grid-cols-1 md:grid-cols-3 h-full">
                
                {/* Inputs */}
                <form onSubmit={handleDeploy} className="md:col-span-2 p-5 sm:p-6 space-y-5 text-left border-b md:border-b-0 md:border-r border-white/[0.05] flex flex-col justify-center">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-zinc-400 uppercase tracking-widest">// Device ID</label>
                    <input 
                      type="text" required value={formData.deviceId}
                      onChange={(e) => setFormData({...formData, deviceId: e.target.value})}
                      placeholder="e.g. CORE-ACCORDION-01"
                      className="w-full h-10 bg-white/[0.02] border border-white/[0.06] focus:border-orange-500/40 focus:bg-orange-500/[0.01] text-white px-3 text-xs rounded-xl outline-none transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-zinc-400 uppercase tracking-widest">// System OS</label>
                      <select value={formData.systemOS} onChange={(e) => setFormData({...formData, systemOS: e.target.value})} className="w-full h-10 bg-[#07070a] border border-white/[0.06] focus:border-orange-500/40 text-zinc-300 px-3 text-xs rounded-xl outline-none cursor-pointer">
                        <option value="android">Android Framework</option>
                        <option value="windows">Windows Desktop</option>
                        <option value="macos">macOS Architecture</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-zinc-400 uppercase tracking-widest">// License</label>
                      <select value={formData.licenseType} onChange={(e) => setFormData({...formData, licenseType: e.target.value})} className="w-full h-10 bg-[#07070a] border border-white/[0.06] focus:border-orange-500/40 text-zinc-300 px-3 text-xs rounded-xl outline-none cursor-pointer">
                        <option value="personal">Evaluation (Free)</option>
                        <option value="pro">Pro Stage License</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-white/[0.04] flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-[10px] font-sans font-light text-zinc-500 max-w-xs leading-normal">
                      Compiling initializes an exclusive secure handshake token network.
                    </p>
                    <button type="submit" disabled={loading} className="w-full sm:w-auto h-10 px-6 bg-white text-black font-sans font-bold text-[11px] tracking-widest uppercase rounded-xl hover:bg-orange-500 hover:text-white hover:shadow-[0_0_20px_rgba(249,115,22,0.4)] transition-all active:scale-[0.97] disabled:opacity-40">
                      {loading ? "[ COMPILING... ]" : "[ LAUNCH_ENVIRONMENT ]"}
                    </button>
                  </div>
                </form>

                {/* Specs Pane */}
                <div className="p-5 sm:p-6 bg-white/[0.005] flex flex-col justify-between text-left space-y-6">
                  <div className="space-y-2">
                    <span className="text-[9px] text-orange-500/50 tracking-[0.2em] block font-bold">// CORE_SPECS</span>
                    <p className="text-xs text-zinc-400 font-sans font-light leading-normal">
                      Instantiates an isolated standalone sandbox memory environment running latency-optimized audio drivers.
                    </p>
                  </div>
                  <div className="space-y-1.5 font-mono text-[10px] text-zinc-500 border-t border-white/[0.04] pt-3">
                    <div className="flex justify-between"><span>IO Buffer:</span> <span className="text-zinc-300">64 samples</span></div>
                    <div className="flex justify-between"><span>Audio LLA:</span> <span className="text-zinc-300">24-bit True</span></div>
                    <div className="flex justify-between"><span>Location:</span> <span className="text-orange-400/80">EU Central</span></div>
                  </div>
                </div>

              </div>
            ) : (
              /* DEPLOY SUCCESS */
              <div className="p-8 flex flex-col items-center justify-center space-y-5 text-center relative overflow-hidden">
                <div className="w-12 h-12 rounded-full border border-orange-500/30 bg-orange-500/5 flex items-center justify-center relative">
                  <span className="w-4 h-4 bg-orange-500 rounded-full animate-ping absolute opacity-60" />
                  <span className="w-1.5 h-1.5 bg-orange-500 rounded-full relative shadow-[0_0_12px_4px_rgba(249,115,22,0.8)]" />
                </div>
                <div className="space-y-2 max-w-sm">
                  <h3 className="text-lg font-light text-white uppercase tracking-wider">Handshake Vector Completed</h3>
                  <p className="text-xs font-sans text-zinc-400 leading-normal">
                    Node sandbox for <span className="text-white font-mono bg-white/[0.06] px-1.5 py-0.5 rounded border border-white/[0.05]">{formData.deviceId || "UNKNOWN"}</span> initialized on <span className="text-orange-400 font-bold uppercase">{formData.systemOS}</span> architecture.
                  </p>
                </div>
                <button onClick={() => setIsDeployed(false)} className="h-9 px-4 border border-white/[0.08] bg-white/[0.02] text-zinc-400 text-[9px] tracking-widest uppercase rounded-lg hover:text-white hover:border-orange-500/30 transition-all active:scale-95">
                  // DISCONNECT_NODE
                </button>
              </div>
            )}
          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
}
