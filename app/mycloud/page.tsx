"use client";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

interface CloudFile {
  name: string;
  size: string;
  type: string;
  date: string;
}

const CLOUD_FILES: CloudFile[] = [
  { name: "KORG_Pa5X_MainStage.set", size: "14.2 MB", type: "SET", date: "2 mins ago" },
  { name: "Horamare_basson.sf2", size: "4.1 KB", type: "TSX", date: "1 day ago" },
  { name: "Sarba33.ts", size: "12.8 KB", type: "TS", date: "3 days ago" },
];

export default function MyCloudPage() {
  return (
    <div className="bg-[#0A0A0C] text-[#E5E5E5] min-h-screen flex flex-col antialiased selection:bg-[#FF4500]/20 selection:text-[#FF4500] relative overflow-x-hidden">
      
      {/* 3D ANIMATION ENGINE & STYLES */}
      <style>{`
        @import url('https://googleapis.com');
        .corp-sans { font-family: 'Inter', sans-serif; }
        .corp-mono { font-family: 'JetBrains Mono', monospace; }

        /* Perspective space for 3D objects */
        .scene-3d {
          perspective: 1000px;
          perspective-origin: 50% 0%;
        }

        /* 3D floating and rotating keyboard mesh */
        .keyboard-3d {
          transform-style: preserve-3d;
          transform: rotateX(55deg) rotateY(0deg) rotateZ(-25deg);
          animation: float3D 8s ease-in-out infinite alternate;
        }

        @keyframes float3D {
          0% {
            transform: rotateX(50deg) rotateY(-2deg) rotateZ(-20deg) translateY(0px);
          }
          100% {
            transform: rotateX(58deg) rotateY(2deg) rotateZ(-28deg) translateY(-15px);
          }
        }

        /* Cyberpunk grid background */
        .cyber-grid {
          background-image: linear-gradient(to right, rgba(255,69,0,0.04) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(255,69,0,0.04) 1px, transparent 1px);
          background-size: 30px 30px;
        }
      `}</style>
      
      {/* BACKGROUND AREA: 3D MATRIX ENGINE */}
      <div className="absolute top-20 right-[-100px] md:right-10 w-full max-w-[650px] h-[500px] pointer-events-none select-none z-0 scene-3d opacity-20 md:opacity-40 cyber-grid">
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0C] via-transparent to-transparent z-10" />
        
        {/* The 3D Floating Keyboard */}
        <div className="keyboard-3d absolute inset-0 flex items-center justify-center pt-20">
          <div className="flex bg-[#16161E] p-4 rounded-xl border border-[#FF4500]/20 shadow-[0_0_50px_rgba(255,69,0,0.1)] gap-[2px]">
            {/* Generating minimalist 3D white and black keys */}
            {[...Array(14)].map((_, i) => (
              <div key={i} className="relative w-7 h-40 bg-gradient-to-b from-[#333] via-[#FFF] to-[#AAA] rounded-b border-b-[6px] border-[#666] shadow-md flex-shrink-0">
                {/* Black Keys nested strategically */}
                {([0, 1, 3, 4, 5, 7, 8, 10, 11, 12].includes(i)) && (
                  <div className="absolute top-0 right-[-8px] w-4 h-24 bg-gradient-to-b from-[#000] via-[#222] to-[#111] rounded-b border-b-[4px] border-[#000] z-20 shadow-xl border-x border-zinc-800" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <Navbar />

      {/* INTERFACE CONTENT */}
      <main className="corp-sans flex-1 w-full max-w-5xl mx-auto px-6 pt-32 pb-20 space-y-6 relative z-10">
        
        {/* HERO TITLE BLOCK */}
        <div className="relative border-b border-[#222226] bg-[#121216]/80 backdrop-blur-xl -mx-6 px-6 pt-6 pb-8 border-t rounded-xl sm:rounded-none shadow-[0_10px_30px_rgba(0,0,0,0.3)]">
          <div className="absolute top-0 left-1/3 w-72 h-24 bg-gradient-to-r from-[#E60000]/10 to-[#FF8800]/10 blur-3xl pointer-events-none" />
          
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
            <div className="space-y-1.5">
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                <span className="bg-gradient-to-r from-[#FF3333] via-[#FF6A00] to-[#FFAA00] bg-clip-text text-transparent">iMIDI MyCloud</span>
                
              </h1>
              <p className="text-sm text-[#A3A3A3] max-w-xl">
                High-performance node repository for setup parameters, engine soundbanks, and deployment scripts.
              </p>
            </div>
            
            <a 
              href="/dashboard/cloud-db" 
              className="inline-flex items-center justify-center bg-gradient-to-r from-[#FF4500] to-[#E60000] text-white text-xs font-semibold py-2.5 px-5 rounded-lg hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_4px_25px_rgba(255,69,0,0.25)] shrink-0"
            >
              Open Cloud DB Console →
            </a>
          </div>
        </div>

        {/* WORKSPACE ARCHITECTURE */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-start">
          
          {/* SECURE DRIVE FILE INDEX */}
          <section className="md:col-span-3 border border-[#222226] rounded-xl bg-[#121216]/90 backdrop-blur-md p-5 space-y-4 shadow-[0_4px_35px_rgba(0,0,0,0.4)] hover:border-[#FF4500]/30 transition-all duration-300">
            <div className="flex justify-between items-center pb-2 border-b border-[#222226]">
              <span className="text-[10px] font-bold bg-gradient-to-r from-[#FF4500] to-[#FFAA00] bg-clip-text text-transparent uppercase tracking-wider corp-mono">
                // SYSTEM_STORAGE_CLOUD
              </span>
              <span className="text-[10px] text-[#737373] corp-mono">{CLOUD_FILES.length} active nodes</span>
            </div>

            <div className="border border-[#222226] rounded-lg overflow-hidden divide-y divide-[#222226]">
              {CLOUD_FILES.map((file, i) => (
                <div key={i} className="flex justify-between items-center px-4 py-3 bg-[#16161C]/50 text-xs hover:bg-[#1E1E26] transition-colors group">
                  <div className="space-y-0.5 truncate pr-4">
                    <div className="font-medium text-[#E5E5E5] group-hover:text-white truncate flex items-center gap-1.5 transition-colors">
                      <span className="text-[#FF4500] group-hover:animate-pulse">🎛️</span> {file.name}
                    </div>
                    <div className="text-[10px] text-[#737373] corp-mono">{file.size} · {file.date}</div>
                  </div>
                  <span className="text-[10px] font-bold text-[#FFA07A] bg-[#FF4500]/10 border border-[#FF4500]/20 px-2 py-0.5 rounded corp-mono shrink-0">
                    {file.type}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* SUBSCRIPTION CONTROL COMPONENT */}
          <section className="md:col-span-2 border border-[#222226] rounded-xl bg-[#121216]/90 backdrop-blur-md p-5 space-y-5 flex flex-col justify-between shadow-[0_4px_35px_rgba(0,0,0,0.4)] relative overflow-hidden group hover:border-[#FF8800]/30 transition-all duration-300">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#E60000] via-[#FF4500] to-[#FF8800]" />
            
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-[#FF8800] uppercase tracking-widest corp-mono bg-[#FF8800]/10 border border-[#FF8800]/20 px-2.5 py-0.5 rounded-full">
                  PRO NODE
                </span>
              </div>
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-white">Cloud Storage Allocation</h2>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold tracking-tight text-white">$49.90</span>
                  <span className="text-xs text-[#A3A3A3] font-medium uppercase corp-mono">/ year</span>
                </div>
              </div>
              <ul className="text-xs text-[#A3A3A3] space-y-2.5 border-t border-[#222226] pt-4 leading-normal">
                <li className="flex items-center gap-2">
                  <span className="text-[#FF4500] font-semibold">✓</span> 30 Gigabytes secure memory cloud pool
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[#FF4500] font-semibold">✓</span> Sync hardware binaries & script parameters
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[#FF4500] font-semibold">✓</span> On-stage zero-latency hot-reload access
                </li>
              </ul>
            </div>
            
<a 
  href="/api/checkout/pro" // Sau link-ul tău direct de Stripe Payment / API Route
  className="w-full bg-[#1E1E26] text-white hover:text-white border border-[#2D2D37] hover:border-[#FF4500]/50 text-xs font-semibold py-2.5 px-4 rounded-lg hover:bg-[#252530] transition-all shadow-sm text-center block"
>
 BUY cloud space
</a>

          </section>
          
        </div>
      </main>

      <Footer />
    </div>
  );
}
