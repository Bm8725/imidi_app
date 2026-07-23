"use client";

import { useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { supabase } from "@/lib/supabase"; 

export default function RegisterPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({ email: "", password: "", confirmPassword: "", fullName: "", username: "", agreeTerms: false });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) return setError("Passwords do not match.");
    setError("");
    setStep(2);
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.agreeTerms) return setError("You must agree to the terms.");
    setLoading(true); 
    setError("");
    
    try {
      // =========================================================================
      // ÎNREGISTRARE REALĂ ÎN INSTANȚA TA SUPABASE
      // =========================================================================
      const { data, error: signUpError } = await supabase.auth.signUp({ 
        email: formData.email, 
        password: formData.password, 
        options: { 
          data: { 
            full_name: formData.fullName, 
            username: formData.username.toLowerCase().trim() 
          }, 
          emailRedirectTo: `${window.location.origin}/auth/callback` 
        } 
      });

      if (signUpError) throw signUpError;
      setSuccess(true);

    } catch (err: any) {
      setError(err.message || "An unexpected database error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#FAFAFA] text-[#111111] min-h-screen flex flex-col antialiased selection:bg-[#0070F3]/10 relative overflow-hidden">
      {/* REPARAT: Link corect către Google Fonts */}
      <style>{`@import url('https://googleapis.com'); .corp-sans { font-family: 'Inter', sans-serif; } .corp-mono { font-family: 'JetBrains Mono', monospace; }`}</style>

      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-b from-[#0070F3]/5 to-transparent rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="absolute bottom-12 left-[-100px] w-[400px] h-[400px] bg-gradient-to-tr from-[#FF5CA1]/4 to-transparent rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none z-0" />

      <Navbar />

      <div className="corp-sans bg-white/70 backdrop-blur-md border-b border-[#EAEAEA] pt-32 pb-12 text-left relative z-10">
        <div className="w-full max-w-xl mx-auto px-6 space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-black">Create your iMIDI account</h1>
          <p className="text-sm text-[#666666] leading-relaxed">{success ? "Registration complete." : `Step ${step} of 2 — Provide your ${step === 1 ? "security credentials" : "profile metadata"}.`}</p>
          {!success && <div className="w-full h-[2px] bg-[#EAEAEA] mt-4 relative overflow-hidden"><div className="absolute top-0 left-0 h-full bg-[#0070F3] transition-all duration-300" style={{ width: `${(step / 2) * 100}%` }} /></div>}
        </div>
      </div>

      <main className="corp-sans flex-1 w-full max-w-xl mx-auto px-6 py-10 relative z-10">
        {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-xs font-medium text-red-600 corp-mono transition-all">Error: {error}</div>}

        {success ? (
          <div className="bg-white border border-[#EAEAEA] rounded-xl p-8 text-center space-y-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <div className="w-10 h-10 bg-[#0070F3]/10 text-[#0070F3] rounded-full flex items-center justify-center mx-auto text-sm font-bold">✓</div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-black tracking-tight">Verification email sent</h3>
              <p className="text-xs text-[#666666]">Please check <span className="corp-mono text-black font-medium">{formData.email}</span> to validate your workspace.</p>
            </div>
            <div className="pt-2"><Link href="/login" className="inline-flex items-center justify-center h-10 px-4 rounded-lg text-xs font-semibold bg-black text-white hover:bg-neutral-900 transition-all">Go to Sign In →</Link></div>
          </div>
        ) : (
          <div className="bg-white border border-[#EAEAEA] rounded-xl p-6 sm:p-8 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            {step === 1 && (
              <form onSubmit={handleNextStep} className="space-y-4">
                <div className="space-y-1"><label className="block text-xs font-medium text-black">Email Address</label><input type="email" name="email" required value={formData.email} onChange={handleChange} className="w-full h-10 bg-[#FAFAFA] border border-[#EAEAEA] rounded-lg px-3 text-sm outline-none transition-all focus:bg-white focus:border-[#0070F3]/50" placeholder="you@example.com" /></div>
                <div className="space-y-1"><label className="block text-xs font-medium text-black">Password</label><input type="password" name="password" required value={formData.password} onChange={handleChange} className="w-full h-10 bg-[#FAFAFA] border border-[#EAEAEA] rounded-lg px-3 text-sm outline-none transition-all focus:bg-white focus:border-[#0070F3]/50" placeholder="••••••••" /></div>
                <div className="space-y-1"><label className="block text-xs font-medium text-black">Confirm Password</label><input type="password" name="confirmPassword" required value={formData.confirmPassword} onChange={handleChange} className="w-full h-10 bg-[#FAFAFA] border border-[#EAEAEA] rounded-lg px-3 text-sm outline-none transition-all focus:bg-white focus:border-[#0070F3]/50" placeholder="••••••••" /></div>
                <button type="submit" className="w-full h-10 bg-black text-white text-xs font-semibold rounded-lg hover:bg-neutral-900 transition-colors shadow-sm mt-2">Continue to profile setup →</button>
              </form>
            )}

            {step === 2 && (
              <form onSubmit={handleFinalSubmit} className="space-y-4">
                <div className="space-y-1"><label className="block text-xs font-medium text-black">Full Name</label><input type="text" name="fullName" required value={formData.fullName} onChange={handleChange} className="w-full h-10 bg-[#FAFAFA] border border-[#EAEAEA] rounded-lg px-3 text-sm outline-none transition-all focus:bg-white focus:border-[#0070F3]/50" placeholder="John Doe" /></div>
                <div className="space-y-1"><label className="block text-xs font-medium text-black">Username</label><div className="relative flex items-center"><span className="absolute left-3 text-xs text-[#666666] corp-mono pointer-events-none">@</span><input type="text" name="username" required value={formData.username} onChange={handleChange} className="w-full h-10 bg-[#FAFAFA] border border-[#EAEAEA] rounded-lg pl-7 pr-3 text-sm outline-none transition-all focus:bg-white focus:border-[#0070F3]/50" placeholder="johndoe" /></div></div>
                <div className="py-2">
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input type="checkbox" name="agreeTerms" required checked={formData.agreeTerms} onChange={handleChange} className="mt-0.5 h-4 w-4 rounded border-[#EAEAEA] text-[#0070F3] focus:ring-0 cursor-pointer" />
                    <span className="text-xs text-[#666666] leading-snug group-hover:text-black">
                      I accept the <span className="text-[#0070F3] hover:underline">Terms of Service</span> and acknowledge the Privacy Policy.
                    </span>
                  </label>
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <button type="button" disabled={loading} onClick={() => setStep(1)} className="h-10 px-4 border border-[#EAEAEA] rounded-lg text-xs font-semibold text-[#666666] hover:text-black hover:border-black transition-colors disabled:opacity-50">Back</button>
                  <button type="submit" disabled={loading} className="flex-1 h-10 bg-[#0070F3] text-white text-xs font-semibold rounded-lg hover:bg-[#0060df] transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center">
                    {loading ? <span className="corp-mono">Creating account...</span> : "Complete registration ✓"}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* REPARAT: Închidere corectă tag HTML */}
        {!success && (
          <div className="mt-6 text-center relative z-10">
            <p className="text-xs text-[#666666]">
              Already have an account? <Link href="/login" className="text-[#0070F3] hover:underline font-medium">Log in instead</Link>
            </p>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
