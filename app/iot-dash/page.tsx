'use client';

import { useState, useEffect } from 'react';

// Structura de date returnată de API-ul nostru în C++
interface IotData {
  status: string;
  path: string;
  debit_apa: number;
  unitate: string;
}

export default function IotDashboard() {
  const [data, setData] = useState<IotData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  useEffect(() => {
    async function fetchIotData() {
      try {
        // Interogăm API-ul serverless în C++ din Vercel
        const response = await fetch('/api/cpp/iot');
        if (!response.ok) {
          throw new Error('Eroare la comunicarea cu serverul C++');
        }
        const jsonData: IotData = await response.json();
        setData(jsonData);
        setLastUpdated(new Date().toLocaleTimeString('ro-RO'));
        setError(null);
      } catch (err: any) {
        setError(err.message || 'A apărut o eroare');
      } finally {
        setLoading(false);
      }
    }

    // Citire inițială și apoi sondaj (polling) la fiecare 2 secunde
    fetchIotData();
    const interval = setInterval(fetchIotData, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8 font-sans">
      {/* Header-ul Dashboard-ului */}
      <header className="max-w-6xl mx-auto mb-8 border-b border-slate-800 pb-4 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            Sistem Centralizat IIoT
          </h1>
          <p className="text-sm text-slate-400 mt-1">Monitorizare procese în timp real bazată pe nucleu C++</p>
        </div>
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-md text-xs text-slate-400">
          <span className={`h-2 w-2 rounded-full ${error ? 'bg-red-500 animate-pulse' : 'bg-emerald-500 animate-ping'}`} />
          {error ? 'Eroare Server' : 'Conexiune Live'}
        </div>
      </header>

      {/* Zona Principală */}
      <main className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Card Principal - Valoare Senzor C++ */}
        <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start">
              <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Debitmetru Principal</span>
              <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 font-mono">
                {data?.status || 'Sincronizare'}
              </span>
            </div>
            
            <div className="my-8 flex items-baseline gap-2">
              {loading && !data ? (
                <span className="text-4xl font-bold text-slate-600 animate-pulse">--.-</span>
              ) : (
                <span className="text-6xl font-extrabold text-slate-50 font-mono tracking-tight">
                  {data?.debit_apa.toFixed(2)}
                </span>
              )}
              <span className="text-xl font-medium text-slate-400">{data?.unitate || 'L/min'}</span>
            </div>
          </div>

          <div className="border-t border-slate-800/60 pt-4 flex justify-between text-xs text-slate-500">
            <div>Actualizat la: <span className="font-mono text-slate-300">{lastUpdated || '--:--:--'}</span></div>
            <div>Eșantionare: <span className="text-slate-300">2000ms</span></div>
          </div>
        </div>

        {/* Card Secundar - Metadate Infrastructură Cloud */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-semibold tracking-wider text-slate-400 uppercase mb-4">Detalii Nod Serviciu</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-slate-800/40 pb-2">
                <span className="text-slate-500">Ruta API Executată</span>
                <span className="font-mono text-xs text-cyan-400">{data?.path || 'api/cpp/iot.cpp'}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/40 pb-2">
                <span className="text-slate-500">Tehnologie Cloud</span>
                <span className="font-mono text-xs text-slate-300">Vercel Serverless</span>
              </div>
              <div className="flex justify-between pb-2">
                <span className="text-slate-500">Compilator Target</span>
                <span className="font-mono text-xs text-slate-300">GCC / Lambda Linux</span>
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-950/40 border border-red-900/50 rounded-lg text-xs text-red-400">
              ⚠️ {error}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
