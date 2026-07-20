"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function MyCloudPage() {
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [terminalLog, setTerminalLog] = useState<string>("SYSTEM // Awaiting file initialization node...");
  const [cloudFiles, setCloudFiles] = useState([
    { name: "KORG_Pa5X_MainStage.set", size: "14.2 MB", type: "SET", date: "2 mins ago" },
    { name: "ChatWidget.tsx", size: "4.1 KB", type: "TSX", date: "1 day ago" },
    { name: "midi-mapping-v2.ts", size: "12.8 KB", type: "TS", date: "3 days ago" },
  ]);

  const simulateSync = (fileName: string, fileSize: string, fileType: string) => {
    if (syncing) return;
    setSyncing(true);
    setActiveFile(fileName);
    setProgress(0);
    setTerminalLog(`[INIT] Initializing handshake for ${fileName}...`);

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setCloudFiles(p => [{ name: fileName, size: fileSize, type: fileType, date: "Just now" }, ...p]);
            setSyncing(false);
            setActiveFile(null);
            setTerminalLog(`[SUCCESS] ${fileName} deployed to cloud cluster.`);
          }, 400);
          return 100;
        }
        if (prev === 30) setTerminalLog(`[COMPILING] Optimizing audio pipelines...`);
        if (prev === 60) setTerminalLog(`[ENCRYPTING] Securing ${fileType} node...`);
        return prev + 10;
      });
    }, 150);
  };

  return (
    <div className="bg-white text-[#171717] min-h-screen flex flex-col antialiased selection:bg-[#0070F3]/10 overflow-x-hidden">
      <style>{`
        @import url('https://googleapis.com');
        .geist-sans { font-family: 'Inter', sans-serif; }
        .geist-mono { font-family: 'JetBrains Mono', monospace; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
      `}</style>
      <Navbar />

      <main className="geist-sans flex-1 w-full max-w-5xl mx-auto px-6 pt-32 pb-20 space-y-10 animate-fade-in">
        {/* HERO SECTION */}
        <div className="border-b border-[#EEEEEE] pb-6 space-y-2">
          
          <h1 className="text-3xl font-bold tracking-tight text-black">iMIDI MyCloud Storage</h1>
          <p className="text-sm text-[#666666] max-w-3xl leading-relaxed">Automated repository synchronization for live setup parameters, custom soundbanks, and responsive layout scripts. Test our developer edge upload pipeline below.</p>
        </div>

        {/* MAIN GRID */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8 items-start">
          {/* TERMINAL SIMULATOR */}
          <div className="md:col-span-3 border border-[#EAEAEA] rounded-xl bg-white p-6 shadow-sm space-y-5 transition-all hover:border-[#CCCCCC]">
            <div>
              <h2 className="text-base font-semibold text-black">Developer Sandbox Environment</h2>
              <p className="text-xs text-[#666666]">Trigger a mock secure deployment sequence for code modules or hardware binaries.</p>
            </div>

            <div className="space-y-2">
              <span className="text-[10px] font-bold text-[#666666] uppercase tracking-wider geist-mono block">// DETECTED LOCAL FILES & SCRIPTS</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button disabled={syncing} onClick={() => simulateSync("ChatWidget.tsx", "6.4 KB", "TSX")} className="flex items-center justify-between p-3 rounded-lg border border-[#EAEAEA] bg-white text-xs font-medium hover:border-black transition-all disabled:opacity-40 group">
                  <span className="truncate group-hover:text-[#0070f3]">⚡ Deploy ChatWidget.tsx</span>
                  <span className="text-[10px] text-[#666666] bg-[#FAFAFA] border border-[#EAEAEA] px-1.5 py-0.5 rounded font-mono shrink-0">TSX</span>
                </button>
                <button disabled={syncing} onClick={() => simulateSync("i-volution.config.json", "1.2 KB", "JSON")} className="flex items-center justify-between p-3 rounded-lg border border-[#EAEAEA] bg-white text-xs font-medium hover:border-black transition-all disabled:opacity-40 group">
                  <span className="truncate group-hover:text-[#0070f3]">⚙️ Sync i-volution.config</span>
                  <span className="text-[10px] text-[#666666] bg-[#FAFAFA] border border-[#EAEAEA] px-1.5 py-0.5 rounded font-mono shrink-0">JSON</span>
                </button>
              </div>
            </div>

            {/* LIVE CONSOLE */}
            <div className="border border-[#EAEAEA] bg-[#FAFAFA] rounded-lg p-4 space-y-3 font-mono shadow-inner">
              <div className="flex justify-between items-center text-[10px] text-[#888888] pb-1 border-b border-[#EEEEEE]">
                <span>LOG_STREAM // EDGE_CONSOLE</span>
                <span className={`h-2 w-2 rounded-full ${syncing ? "bg-[#0070F3] animate-pulse" : "bg-gray-400"}`} />
              </div>
              <div className="text-xs text-black min-h-[20px] truncate">{terminalLog}</div>
              {syncing && (
                <div className="space-y-1.5 pt-1">
                  <div className="w-full h-1 bg-[#EAEAEA] rounded-full overflow-hidden"><div style={{ width: `${progress}%` }} className="h-full bg-black transition-all duration-150" /></div>
                  <div className="text-[10px] text-right text-[#666666]">{progress}% Transfer Complete</div>
                </div>
              )}
            </div>

            {/* CLOUD DRIVE */}
            <div className="space-y-2 border-t border-[#F1F1F1] pt-4">
              <span className="text-[10px] font-bold text-[#666666] uppercase tracking-wider geist-mono block">// SECURE DEPLOYED REPOSITORY MATRIX</span>
              <div className="border border-[#EAEAEA] rounded-lg overflow-hidden divide-y divide-[#EAEAEA]">
                {cloudFiles.map((file, i) => (
                  <div key={i} className="flex justify-between items-center px-4 py-3 bg-white text-xs hover:bg-[#FAFAFA] transition-colors">
                    <div className="space-y-0.5 truncate pr-4">
                      <div className="font-medium text-black truncate flex items-center gap-1.5"><span className="text-gray-400">📄</span> {file.name}</div>
                      <div className="text-[10px] text-[#888888] geist-mono">{file.size} · {file.date}</div>
                    </div>
                    <span className="text-[10px] font-bold text-[#666666] bg-[#FAFAFA] border border-[#EAEAEA] px-2 py-0.5 rounded-md geist-mono shrink-0">{file.type}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* SUBSCRIPTION PANEL */}
          <div className="md:col-span-2 border border-[#EAEAEA] rounded-xl bg-[#FAFAFA] p-6 space-y-5 flex flex-col justify-between min-h-[350px] hover:border-[#CCCCCC] transition-all">
            <div className="space-y-3">
              <span className="text-[10px] font-bold text-[#666666] uppercase tracking-widest geist-mono bg-white border border-[#EAEAEA] px-2 py-0.5 rounded-full shadow-sm">PRO NODE</span>
              <h2 className="text-lg font-semibold text-black">Cloud Storage Plan</h2>
              <div className="flex items-baseline gap-1.5"><span className="text-3xl font-bold text-black">$49.90</span><span className="text-xs text-[#666666] font-medium uppercase geist-mono">/ year</span></div>
              <ul className="text-xs text-[#444444] space-y-2 border-t border-[#EAEAEA] pt-4 leading-normal">
                <li>✓ 30 Gigabytes secure memory cloud pool</li>
                <li>✓ Sync both hardware files & script modules</li>
                <li>✓ On-stage instant hot-reload access</li>
              </ul>
            </div>
            <div className="space-y-2 pt-4">
              <button onClick={() => alert("Subscription structures will link securely once the production database cluster is finalized.")} className="w-full py-2.5 rounded-lg bg-[#0070F3] text-white hover:bg-[#0062d6] text-xs font-medium transition-all active:scale-[0.99] shadow-sm">Access Storage Console</button>
              <p className="text-[10px] text-[#888888] text-center uppercase font-medium geist-mono">Database Node Deployment In Progress</p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
