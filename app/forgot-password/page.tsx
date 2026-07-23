"use client";

import { useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { supabase } from "@/lib/supabase";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });

      if (resetError) throw resetError;
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#FAFAFA] text-[#111111] min-h-screen flex flex-col antialiased selection:bg-[#0070F3]/10 relative overflow-hidden">
      <Navbar />

      <div className="corp-sans bg-white/70 backdrop-blur-md border-b border-[#EAEAEA] pt-32 pb-12 text-left relative z-10">
        <div className="w-full max-w-xl mx-auto px-6 space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-black">Reset your password</h1>
          <p className="text-sm text-[#666666] leading-relaxed">Enter your email to receive a secure password reset link.</p>
        </div>
      </div>

      <main className="corp-sans flex-1 w-full max-w-xl mx-auto px-6 py-10 relative z-10">
        {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-xs font-medium text-red-600 corp-mono transition-all">Error: {error}</div>}

        {success ? (
          <div className="bg-white border border-[#EAEAEA] rounded-xl p-8 text-center space-y-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <div className="w-10 h-10 bg-[#0070F3]/10 text-[#0070F3] rounded-full flex items-center justify-center mx-auto text-sm font-bold">✓</div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-black tracking-tight">Reset link sent</h3>
              <p className="text-xs text-[#666666]">Please check <span className="corp-mono text-black font-medium">{email}</span> for the recovery link.</p>
            </div>
            <div className="pt-2"><Link href="/login" className="inline-flex items-center justify-center h-10 px-4 rounded-lg text-xs font-semibold bg-black text-white hover:bg-neutral-900 transition-all">Back to Sign In</Link></div>
          </div>
        ) : (
          <div className="bg-white border border-[#EAEAEA] rounded-xl p-6 sm:p-8 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-black">Email Address</label>
                <input 
                  type="email" 
                  required 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  className="w-full h-10 bg-[#FAFAFA] border border-[#EAEAEA] rounded-lg px-3 text-sm outline-none transition-all focus:bg-white focus:border-[#0070F3]/50" 
                  placeholder="you@example.com" 
                />
              </div>
              <button 
                type="submit" 
                disabled={loading} 
                className="w-full h-10 bg-black text-white text-xs font-semibold rounded-lg hover:bg-neutral-900 transition-colors shadow-sm mt-2 disabled:opacity-50"
              >
                {loading ? "Sending link..." : "Send reset link →"}
              </button>
              <div className="text-center pt-2">
                <Link href="/login" className="text-xs text-[#666666] hover:text-black transition-colors">Remember your password? Sign In</Link>
              </div>
            </form>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
