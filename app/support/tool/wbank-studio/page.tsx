'use client';

import React, { useState, useRef, useEffect } from 'react';
import WbnkCompilerOptions from '@/components/WbnkCompilerOptions';
import { compileWbnkToDisk, WbnkCompileData } from '@/lib/wbnk-compiler';

export default function WbnkEditorPage() {
  const [status, setStatus] = useState<string>('SYSTEM INITIALIZED // READY FOR HIGH-SPEED DSP COMPILATION');
  const [logs, setLogs] = useState<string[]>([
    'iMIDI_OS_v1.0@core:~$ SYSTEM INITIALIZED // READY FOR HIGH-SPEED DSP COMPILATION'
  ]);
  const [loading, setLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const terminalRef = useRef<HTMLDivElement>(null);

  const [bankData, setBankData] = useState<WbnkCompileData>({
    instrumente: [
      { name: "iMIDI Accordion Solo", first_zone: 0, zone_count: 1 }
    ],
    zone: [
      { key_lo: 36, key_hi: 96, vel_lo: 0, vel_hi: 127, attack: 0, decay: 250, sustain: 1000, release: 50 }
    ],
    textMeta: { author: "iMIDI Developer", license: "TS4X Core DSP Standard v1.0" },
    textSynt: {}
  });

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `iMIDI_OS_v1.0@core:~$ ${msg}`]);
    setStatus(msg);
  };

  const handleExecuteCompilation = async () => {
    setLoading(true);
    setProgress(0);
    addLog('ALLOCATING STORAGE HANDLE // EXECUTING DIRECT WRITABLE STREAM...');

    // Simulated progress for UX
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + Math.random() * 18;
      });
    }, 180);

    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: 'patch_bank.wbnk',
        types: [{
          description: 'Audio Bank Specification v1.0 (*.wbnk)',
          accept: { 'application/octet-stream': ['.wbnk'] }
        }]
      });

      const totalSize = await compileWbnkToDisk(handle, bankData, (msg) => {
        addLog(`[PROCESS]: ${msg.toUpperCase()}`);
      });

      clearInterval(progressInterval);
      setProgress(100);

      addLog(`SUCCESS // BINARY WRITTEN DIRECTLY TO HARD DRIVE. TOTAL SIZE: ${(totalSize / 1024).toFixed(2)} KB // 64-BYTE ALIGNED.`);
    } catch (error: any) {
      clearInterval(progressInterval);
      setProgress(0);
      addLog(`CRITICAL ERROR // EXECUTION FAILED: ${error.message.toUpperCase()}`);
    } finally {
      setTimeout(() => setLoading(false), 600);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-[#00ff66]/30 selection:text-white">
      {/* Subtle grid background */}
      <div className="fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none" />

      <div className="relative max-w-5xl mx-auto px-5 py-10 md:py-16">

        {/* Header */}
        <header className="mb-12">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-5">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-white text-black text-[11px] font-bold tracking-[0.2em] uppercase">
                TS4X Core
              </span>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                wbnk<span className="text-neutral-500 font-light">.studio</span>
              </h1>
            </div>
            <div className="flex gap-2 ml-auto">
              <span className="px-2.5 py-1 rounded-full border border-neutral-800 text-[11px] text-neutral-400 tracking-wide">
                v1.0.13
              </span>
              <span className="px-2.5 py-1 rounded-full border border-[#00ff66]/30 bg-[#00ff66]/5 text-[11px] text-[#00ff66] tracking-wide">
                DSP READY
              </span>
            </div>
          </div>

          <p className="text-neutral-400 text-sm md:text-[15px] max-w-2xl leading-relaxed">
            The global digital standard for modern digitalization e-market. Pre-allocate binary structures, map velocity-sensitive maps, and stream multi-sampled nodes instantly.
          </p>
        </header>

        {/* Main content */}
        <div className="space-y-8">

          {/* Compiler Options */}
          <section className="rounded-2xl border border-neutral-800/80 bg-neutral-900/40 backdrop-blur-sm p-6 md:p-8 shadow-2xl shadow-black/40">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xs font-semibold tracking-[0.15em] uppercase text-neutral-500">
                Bank Structure & Zones
              </h2>
              <div className="h-px flex-1 bg-neutral-800 mx-4" />
              <span className="text-[11px] text-neutral-600">EDITABLE</span>
            </div>

            <WbnkCompilerOptions
              bankData={bankData}
              setBankData={setBankData}
              disabled={loading}
            />
          </section>

          {/* Terminal + Control Panel */}
          <section className="rounded-2xl border border-neutral-800/80 bg-[#080808] overflow-hidden shadow-2xl shadow-black/50">
            {/* Terminal header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-800/80 bg-neutral-900/50">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                <span className="ml-3 text-[11px] font-medium tracking-wider text-neutral-500 uppercase">
                  Hardware IO Stream Monitor
                </span>
              </div>
              <span className="text-[11px] text-neutral-600 font-mono">LIVE</span>
            </div>

            {/* Terminal body */}
            <div
              ref={terminalRef}
              className="h-48 overflow-y-auto px-5 py-4 font-mono text-[12.5px] leading-relaxed bg-black/60"
              style={{ scrollbarWidth: 'thin' }}
            >
              {logs.map((log, i) => (
                <div key={i} className="mb-1.5 last:mb-0">
                  <span className="text-neutral-600 select-none">$</span>{' '}
                  <span className={log.includes('SUCCESS') ? 'text-[#00ff66]' : log.includes('CRITICAL') ? 'text-red-400' : 'text-[#00ff66]/90'}>
                    {log.replace('iMIDI_OS_v1.0@core:~$ ', '')}
                  </span>
                </div>
              ))}
              {loading && (
                <div className="flex items-center gap-2 mt-2 text-[#00ff66]/70">
                  <span className="animate-pulse">▊</span>
                  <span className="text-[11px]">processing binary blocks...</span>
                </div>
              )}
            </div>

            {/* Progress bar */}
            {(loading || progress > 0) && (
              <div className="px-5 py-3 border-t border-neutral-800/60 bg-neutral-900/30">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] text-neutral-500 tracking-wide">WRITE PROGRESS</span>
                  <span className="text-[11px] font-mono text-[#00ff66]">{Math.min(100, Math.round(progress))}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-neutral-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#00ff66] to-[#00cc55] transition-all duration-300 ease-out"
                    style={{ width: `${Math.min(100, progress)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Action bar */}
            <div className="px-5 py-5 border-t border-neutral-800/80 bg-neutral-900/40 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <button
                onClick={handleExecuteCompilation}
                disabled={loading}
                className={`
                  group relative flex-1 sm:flex-none px-8 py-3.5 rounded-xl font-semibold text-sm tracking-wide uppercase
                  transition-all duration-300 ease-out
                  ${loading
                    ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                    : 'bg-white text-black hover:bg-neutral-100 active:scale-[0.98] shadow-[0_0_0_1px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.15)]'
                  }
                `}
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {loading ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Compiling blocks...
                    </>
                  ) : (
                    <>
                      Compile & Write Package
                      <svg className="w-4 h-4 opacity-60 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </>
                  )}
                </span>
              </button>

              <div className="text-[11px] text-neutral-500 leading-relaxed max-w-xs">
                Direct File System Access API · 64-byte aligned binary stream · Zero intermediate buffers
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-neutral-900 text-center">
          <p className="text-[12px] text-neutral-600 tracking-wide">
            © 2026 iMIDI.co.uk · Platform developed with NI v0.1.13
          </p>
        </footer>
      </div>
    </div>
  );
}