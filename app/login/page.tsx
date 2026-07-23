"use client";

import { useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
// import { supabase } from "@/lib/supabase"; 

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({ email: "", password: "" });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.password) return setError("All fields are required.");
    
    setLoading(true);
    setError("");

    try {
      // =========================================================================
      // CONECTARE REALĂ SUPABASE AUTH (FĂRĂ SIMULĂRI FALSE)
      // =========================================================================
      // const { data, error: loginError } = await supabase.auth.signInWithPassword({
      //   email: formData.email,
      //   password: formData.password,
      // });
      // if (loginError) throw loginError;
      // window.location.href = "/dashboard";

      throw new Error("Database client is not connected. Please uncomment Supabase configuration.");
    } catch (err: any) {
      setError(err.message || "Invalid credentials or database connection failure.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#FAFAFA] text-[#111111] min-h-screen flex flex-col antialiased selection:bg-[#0070F3]/10 relative overflow-x-hidden">
      <style>{`
        @import url('https://googleapis.com'); 
        .corp-sans { font-family: 'Inter', sans-serif; } 
        .corp-mono { font-family: 'JetBrains Mono', monospace; }
      `}</style>

      {/* ULTRA-PREMIUM INTERACTIVE BACKGROUND */}
      <div className="absolute top-[-10%] right-[-10%] w-[300px] sm:w-[600px] h-[300px] sm:h-[600px] bg-gradient-to-b from-[#0070F3]/8 to-transparent rounded-full blur-[80px] sm:blur-[140px] pointer-events-none z-0" />
      <div className="absolute bottom-[5%] left-[-15%] w-[250px] sm:w-[500px] h-[250px] sm:h-[500px] bg-gradient-to-tr from-[#FF5CA1]/6 to-transparent rounded-full blur-[70px] sm:blur-[120px] pointer-events-none z-0" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:20px_20px] sm:bg-[size:32px_32px] pointer-events-none z-0" />

      <Navbar />

      {/* MAIN CONTAINER: CENTRAT PERFECT ȘI CORECT SCALAT PE MOBIL */}
      <main className="corp-sans flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-28 relative z-10 w-full max-w-lg mx-auto">
        
        {/* HEADER INTRODUCTIV DINAMIC */}
        <div className="text-center space-y-2 mb-8 w-full px-2">
          <div className="inline-flex items-center space-x-1.5 bg-black/[0.03] border border-black/[0.06] px-3 py-1 rounded-full backdrop-blur-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0070F3] animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#666666]">iMIDI Gate</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-black sm:leading-none">
            Welcome back
          </h1>
          <p className="text-xs sm:text-sm text-[#666666] max-w-xs mx-auto">
            Enter your ecosystem keys to initialize your active workspace.
          </p>
        </div>

        {/* NOTIFICARE EROARE DB - STIL LINEAR CURAT */}
        {error && (
          <div className="w-full mb-4 p-4 bg-red-50/80 backdrop-blur-md border border-red-200 rounded-2xl text-xs font-semibold text-red-600 corp-mono transition-all animate-in fade-in slide-in-from-top-1">
            ⚠️ {error}
          </div>
        )}

        {/* CONTAINERUL PREMIUM TIP GLASSMORPHISM */}
        <div className="w-full bg-white/60 backdrop-blur-xl border border-white/80 sm:border-[#EAEAEA] rounded-3xl p-6 sm:p-10 shadow-[0_8px_32px_rgba(0,0,0,0.02),0_1px_2px_rgba(0,0,0,0.01)] transition-all duration-300 hover:shadow-[0_20px_40px_rgba(0,0,0,0.04)]">
          <form onSubmit={handleLogin} className="space-y-4">
            
            {/* INPUT FIELD: EMAIL */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-black/60">Email Address</label>
              <div className="relative group">
                <input 
                  type="email" 
                  name="email" 
                  required 
                  value={formData.email} 
                  onChange={handleChange} 
                  className="w-full h-11 bg-white/50 border border-black/[0.08] rounded-xl px-4 text-sm outline-none transition-all duration-200 focus:bg-white focus:border-[#0070F3] focus:ring-4 focus:ring-[#0070F3]/5 placeholder:text-neutral-400" 
                  placeholder="name@domain.com" 
                />
              </div>
            </div>

            {/* INPUT FIELD: PAROLĂ */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-black/60">Password</label>
                <Link href="/forgot-password" className="text-[11px] font-semibold text-[#666666] hover:text-black hover:underline transition-colors">
                  Lost access?
                </Link>
              </div>
              <input 
                type="password" 
                name="password" 
                required 
                value={formData.password} 
                onChange={handleChange} 
                className="w-full h-11 bg-white/50 border border-black/[0.08] rounded-xl px-4 text-sm outline-none transition-all duration-200 focus:bg-white focus:border-[#0070F3] focus:ring-4 focus:ring-[#0070F3]/5 placeholder:text-••••••••" 
                placeholder="••••••••" 
              />
            </div>

            {/* BUTON MAI FAIN & RESPONSIVE CU GLOW DISCRET */}
            <button 
              type="submit" 
              disabled={loading}
              className="w-full h-11 bg-black text-white text-xs font-bold uppercase tracking-widest rounded-xl hover:bg-neutral-900 active:scale-[0.99] transition-all duration-200 shadow-sm mt-3 flex items-center justify-center disabled:opacity-50 group relative overflow-hidden"
            >
              {loading ? (
                <span className="corp-mono flex items-center space-x-2">
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Verifying...</span>
                </span>
              ) : (
                <span className="flex items-center space-x-1">
                  <span>Open Space</span>
                  <span className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
                </span>
              )}
            </button>
          </form>
        </div>

        {/* RETUR CĂTRE SUB-SISTEMUL DE ÎNREGISTRARE */}
        <div className="mt-8 text-center">
          <p className="text-xs text-[#666666] font-medium">
            New to iMIDI?{" "}
            <Link href="/register" className="text-[#0070F3] hover:text-[#0060df] font-bold transition-colors">
              Create an account
            </Link>
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
