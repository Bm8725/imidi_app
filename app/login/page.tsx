"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation"; // Importat pentru redirecționare SPA rapidă
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { supabase } from "@/lib/supabase"; // DECOMENTAT: Clientul tău Supabase

export default function LoginPage() {
  const router = useRouter(); // Inițializare router Next.js
  const [loading, setLoading] = useState(false);
  const [fbLoading, setFbLoading] = useState(false); // NOU: loading separat pt. Facebook
  const [spotifyLoading, setSpotifyLoading] = useState(false); // NOU: loading separat pt. Spotify
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
      // CONECTARE REALĂ SUPABASE AUTH
      // =========================================================================
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (loginError) throw loginError;

      // Redirecționare directă către pagina cloud-db din dashboard
      router.push("/dashboard/cloud-db");
      router.refresh(); 

    } catch (err: any) {
      setError(err.message || "Invalid credentials or database connection failure.");
    } finally {
      setLoading(false);
    }
  };

  // NOU: login cu Facebook — Supabase redirecteaza automat catre Facebook,
  // apoi inapoi la /auth/callback (trebuie sa existe ruta asta in proiect,
  // spune-mi daca nu o ai si ti-o fac).
  const handleFacebookLogin = async () => {
    setFbLoading(true);
    setError("");
    try {
      const { error: fbError } = await supabase.auth.signInWithOAuth({
        provider: "facebook",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/dashboard/cloud-db`,
        },
      });
      if (fbError) throw fbError;
      // nu mai trebuie router.push aici — Supabase face redirect automat catre Facebook
    } catch (err: any) {
      setError(err.message || "Nu am putut porni login-ul cu Facebook.");
      setFbLoading(false);
    }
  };


  // NOU: login cu Spotify — foloseste pagina dedicata /auth/callback/spotify
  const handleSpotifyLogin = async () => {
    setSpotifyLoading(true);
    setError("");
    try {
      const { error: spotifyError } = await supabase.auth.signInWithOAuth({
        provider: "spotify",
        options: {
          redirectTo: `${window.location.origin}/auth/callback/spotify?next=/dashboard/cloud-db`,
        },
      });
      if (spotifyError) throw spotifyError;
    } catch (err: any) {
      setError(err.message || "Nu am putut porni login-ul cu Spotify.");
      setSpotifyLoading(false);
    }
  };

  // NOU: login cu google
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError("");
    try {
      const { error: googleError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          // Trimite utilizatorul DIRECT în dashboard. 
          // Supabase din browser va citi singur token-ul din URL-ul cu '#' și va crea sesiunea.
          redirectTo: `${window.location.origin}/dashboard/cloud-db`,
        },
      });
      if (googleError) throw googleError;
    } catch (err: any) {
      setError(err.message || "Nu am putut porni login-ul cu Google.");
      setGoogleLoading(false);
    }
  };




  return (
   <div className="bg-gradient-to-tr from-[#E0E7FF] via-[#EEF2FF] to-[#F5F3FF] text-[#111111] min-h-screen flex flex-col antialiased selection:bg-[#4F46E5]/20 relative overflow-x-hidden">
  <style>{`
    @import url('https://googleapis.com'); 
    .corp-sans { font-family: 'Inter', sans-serif; } 
    .corp-mono { font-family: 'JetBrains Mono', monospace; }
  `}</style>

  {/* INTERACTIVE BACKGROUND: ALBASTRU-MOV NEON EXTRA INTENS ȘI VIU */}
  <div className="absolute top-[-10%] right-[-5%] w-[400px] sm:w-[800px] h-[400px] sm:h-[800px] bg-gradient-to-br from-[#4F46E5]/35 via-[#8B5CF6]/30 to-transparent rounded-full blur-[70px] sm:blur-[110px] pointer-events-none z-0 animate-pulse duration-[5000ms]" />
  <div className="absolute bottom-[5%] left-[-10%] w-[350px] sm:w-[700px] h-[350px] sm:h-[700px] bg-gradient-to-tr from-[#6366F1]/30 via-[#EC4899]/15 to-transparent rounded-full blur-[80px] sm:blur-[120px] pointer-events-none z-0" />

      <Navbar />

      {/* MAIN CONTAINER: CENTRAT PERFECT ȘI CORECT SCALAT PE MOBIL */}
      <main className="corp-sans flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-28 relative z-10 w-full max-w-lg mx-auto">
        
        {/* HEADER INTRODUCTIV DINAMIC */}
        <div className="text-center space-y-2 mb-8 w-full px-2">

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-black sm:leading-none">
            Welcome back
          </h1>
          <p className="text-xs sm:text-sm text-[#666666] max-w-xs mx-auto">
            Enter your ecosystem keys to initialize your access your workspace.
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


                      <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="w-full h-11 bg-white text-gray-700 text-xs font-bold rounded-xl border border-gray-200 hover:bg-gray-50 active:scale-[0.99] transition-all duration-200 shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {googleLoading ? (
              <span className="corp-mono flex items-center gap-2">
                <span className="w-3 h-3 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                <span>Connecting...</span>
              </span>
            ) : (
              <>
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#EA4335" d="M12.24 10.285V14.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.866-3.577-7.866-8s3.536-8 7.866-8c2.46 0 4.105 1.025 5.047 1.926l3.227-3.11C18.243 1.904 15.495 1 12.24 1 6.133 1 1.157 5.927 1.157 12s4.976 11 11.083 11c6.377 0 10.622-4.464 10.622-10.74 0-.724-.078-1.275-.173-1.685H12.24z"/>
                </svg>
                <span>Continue with Google</span>
              </>
            )}
          </button>


               <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-black/[0.08]" />
              <span className="text-[10px] uppercase tracking-wider text-black/40 font-semibold"></span>
              <div className="flex-1 h-px bg-black/[0.08]" />
            </div>

            {/* NOU: buton login cu Facebook */}
            <button
              type="button"
              onClick={handleFacebookLogin}
              disabled={fbLoading}
              className="w-full h-11 bg-[#1877F2] text-white text-xs font-bold rounded-xl hover:bg-[#166FE5] active:scale-[0.99] transition-all duration-200 shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {fbLoading ? (
                <span className="corp-mono flex items-center gap-2">
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Connecting...</span>
                </span>
              ) : (
                <>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12.06C22 6.51 17.52 2 12 2S2 6.51 2 12.06c0 5 3.66 9.15 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.51 1.49-3.9 3.77-3.9 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.45 2.91h-2.33V22c4.78-.79 8.44-4.94 8.44-9.94Z"/></svg>
                  <span>Continue with Facebook</span>
                </>
              )}
            </button>

               {/* separator */}
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-black/[0.08]" />
              <span className="text-[10px] uppercase tracking-wider text-black/40 font-semibold"></span>
              <div className="flex-1 h-px bg-black/[0.08]" />
            </div>
    

            {/* NOU: buton login cu Spotify */}
            <button
              type="button"
              onClick={handleSpotifyLogin}
              disabled={spotifyLoading}
              className="w-full h-11 bg-[#1DB954] text-white text-xs font-bold rounded-xl hover:bg-[#1aa34a] active:scale-[0.99] transition-all duration-200 shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 mb-5"
            >
              {spotifyLoading ? (
                <span className="corp-mono flex items-center gap-2">
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Connecting...</span>
                </span>
              ) : (
                <>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm4.586 14.424a.622.622 0 0 1-.857.207c-2.348-1.435-5.304-1.76-8.785-.964a.622.622 0 1 1-.277-1.213c3.809-.87 7.077-.496 9.712 1.113.293.18.386.564.207.857Zm1.223-2.723a.78.78 0 0 1-1.072.257c-2.688-1.652-6.786-2.131-9.965-1.166a.78.78 0 0 1-.452-1.492c3.632-1.102 8.147-.568 11.232 1.328a.78.78 0 0 1 .257 1.073Zm.105-2.835c-3.223-1.914-8.54-2.09-11.618-1.156a.936.936 0 1 1-.543-1.79c3.532-1.072 9.404-.865 13.115 1.338a.936.936 0 0 1-.954 1.608Z"/></svg>
                  <span>Continue with Spotify</span>
                </>
              )}
            </button>

         {/* separator */}
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-black/[0.08]" />
              <span className="text-[10px] uppercase tracking-wider text-black/40 font-semibold">or</span>
              <div className="flex-1 h-px bg-black/[0.08]" />
            </div>
    
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
                className="w-full h-11 bg-white/50 border border-black/[0.08] rounded-xl px-4 text-sm outline-none transition-all duration-200 focus:bg-white focus:border-[#0070F3] focus:ring-4 focus:ring-[#0070F3]/5 placeholder:text-neutral-400" 
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