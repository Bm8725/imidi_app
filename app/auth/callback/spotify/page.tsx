"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function SpotifyCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [statusMessage, setStatusMessage] = useState("Se inițializează conexiunea cu Spotify...");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    const handleAuthCallback = async () => {
      // Preluăm codul din URL generat de Spotify/Supabase
      const code = searchParams.get("code");
      const next = searchParams.get("next") || "/dashboard/cloud-db";

      if (!code) {
        setIsError(true);
        setStatusMessage("Eroare: Codul de autentificare lipsește din URL.");
        return;
      }

      try {
        // Schimbăm codul pe o sesiune activă în browser prin Supabase
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) throw error;

        if (data?.session) {
          setStatusMessage("Autentificare reușită! Te redirecționăm...");
          
          // Redirecționăm rapid utilizatorul către dashboard
          router.push(next);
          router.refresh();
        }
      } catch (err: any) {
        console.error("Auth error:", err);
        setIsError(true);
        setStatusMessage(err.message || "A apărut o eroare la procesarea autentificării.");
        
        // Opțional: îl trimiți înapoi la login după 3 secunde dacă eșuează
        setTimeout(() => {
          router.push("/login");
        }, 3000);
      }
    };

    handleAuthCallback();
  }, [searchParams, router]);

  return (
    <div className="corp-sans min-h-screen bg-[#FAFAFA] text-[#111111] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md bg-white border border-[#EAEAEA] rounded-3xl p-8 text-center shadow-sm">
        
        {/* Spinner animat premium sau iconiță de eroare */}
        <div className="flex justify-center mb-6">
          {isError ? (
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-500 font-bold text-xl">
              ⚠️
            </div>
          ) : (
            <div className="w-10 h-10 border-4 border-[#1DB954]/20 border-t-[#1DB954] rounded-full animate-spin" />
          )}
        </div>

        <h1 className="text-xl font-bold mb-2">
          {isError ? "Problemă la autentificare" : "Conectare securizată"}
        </h1>
        
        <p className={`text-sm ${isError ? "text-red-500" : "text-[#666666]"} corp-mono`}>
          {statusMessage}
        </p>

        {isError && (
          <button 
            onClick={() => router.push("/login")}
            className="mt-6 text-xs font-bold text-white bg-black px-4 py-2 rounded-xl active:scale-[0.98] transition-all"
          >
            Înapoi la Login
          </button>
        )}
      </div>
    </div>
  );
}
