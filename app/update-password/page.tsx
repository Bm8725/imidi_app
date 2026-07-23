"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { supabase } from "@/lib/supabase";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Supabase știe deja cine este utilizatorul pe baza jetonului (token) din link-ul de email
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) throw updateError;
      setSuccess(true);
      
      // Îl trimitem la login după 3 secunde
      setTimeout(() => {
        router.push("/login");
      }, 3000);
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
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-black">Update password</h1>
          <p className="text-sm text-[#666666] leading-relaxed">Enter your new secure password below.</p>
        </div>
      </div>

      <main className="corp-sans flex-1 w-full max-w-xl mx-auto px-6 py-10 relative z-10">
        {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-xs font-medium text-red-600 corp-mono">Error: {error}</div>}

        {success ? (
          <div className="bg-white border border-[#EAEAEA] rounded-xl p-8 text-center space-y-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <div className="w-10 h-10 bg-[#0070F3]/10 text-[#0070F3] rounded-full flex items-center justify-center mx-auto text-sm font-bold">✓</div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-black tracking-tight">Password updated!</h3>
              <p className="text-xs text-[#666666]">Redirecting you to the sign-in page...</p>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-[#EAEAEA] rounded-xl p-6 sm:p-8 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-black">New Password</label>
                <input 
                  type="password" 
                  required 
                  minLength={6}
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  className="w-full h-10 bg-[#FAFAFA] border border-[#EAEAEA] rounded-lg px-3 text-sm outline-none transition-all focus:bg-white focus:border-[#0070F3]/50" 
                  placeholder="••••••••" 
                />
              </div>
              <button 
                type="submit" 
                disabled={loading} 
                className="w-full h-10 bg-black text-white text-xs font-semibold rounded-lg hover:bg-neutral-900 transition-colors shadow-sm mt-2 disabled:opacity-50"
              >
                {loading ? "Updating..." : "Update password →"}
              </button>
            </form>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
