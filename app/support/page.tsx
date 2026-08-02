import Link from "next/link";
import InteractiveSupportForm from "@/components/interactive-support-form";

export default async function SupportPage() {
  return (
    <div className="relative min-h-screen bg-white font-sans text-zinc-900 antialiased selection:bg-zinc-100 overflow-hidden">
      
      {/* 🌊 Stripe-like Cinematic Waves & Glow Background */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden select-none">
        {/* Ambient Lights */}
        <div className="absolute -top-[20%] -right-[10%] w-[70%] h-[50%] rounded-full bg-indigo-500/10 blur-[130px]" />
        <div className="absolute top-[10%] -left-[20%] w-[60%] h-[50%] rounded-full bg-violet-400/5 blur-[100px]" />
        
        {/* Wave 1: Linii fluide curbate */}
        <svg className="absolute top-0 left-0 w-full h-[550px] opacity-[0.4] text-zinc-200" fill="none" viewBox="0 0 1440 400">
          <path 
            stroke="currentColor" 
            strokeWidth="1.5" 
            d="M0,120 C240,250 480,50 720,180 C960,310 1200,100 1440,220" 
            className="text-zinc-200/80"
          />
          <path 
            stroke="url(#stripe-gradient)" 
            strokeWidth="1.5" 
            d="M0,150 C280,290 520,30 760,210 C1000,390 1220,140 1440,250" 
          />
          <path 
            stroke="currentColor" 
            strokeWidth="1" 
            strokeDasharray="4 4"
            d="M0,90 C220,200 440,90 680,140 C920,190 1160,20 1440,160" 
            className="text-zinc-300/50"
          />
          <defs>
            <linearGradient id="stripe-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#e4e4e7" stopOpacity="0.2" />
              <stop offset="30%" stopColor="#6366f1" stopOpacity="0.3" />
              <stop offset="70%" stopColor="#a855f7" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#e4e4e7" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>

        {/* Wave 2: Subtilă, plasată mai jos pentru adâncime */}
        <svg className="absolute top-[80px] left-0 w-full h-[450px] opacity-[0.25]" fill="none" viewBox="0 0 1440 400">
          <path 
            stroke="rgba(99, 102, 241, 0.25)" 
            strokeWidth="2" 
            d="M0,200 C320,80 640,320 960,150 C1280,-20 1380,180 1440,120" 
          />
        </svg>
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-20 space-y-12">
        
        {/* Back navigation */}
        <Link
          href="/e-market"
          className="group inline-flex items-center gap-2 text-[10px] font-bold text-zinc-400 hover:text-zinc-900 uppercase tracking-widest transition-colors"
        >
          <svg className="w-3 h-3 transform group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to
        </Link>

        {/* Minimalist Clean Header */}
        <header className="space-y-2 border-b border-zinc-100 pb-8">
          <h1 className="text-3xl font-black tracking-tight text-zinc-950">
            Support iMIDI app
          </h1>
          <p className="text-xs text-zinc-500 font-medium">
            Describe you problem that you meet!
          </p>
        </header>

        {/* Form & Smart Router Container */}
        <main className="relative">
          <InteractiveSupportForm />
        </main>

      </div>
    </div>
  );
}
