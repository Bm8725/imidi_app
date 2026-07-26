"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

function SpotifyCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [statusMessage, setStatusMessage] = useState("Se inițializează conexiunea cu Spotify...");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    const next = searchParams.get("next") || "/dashboard/cloud-db";

    const finish = async () => {
      try {
        // Clientul nostru foloseste flux implicit (fara flowType: 'pkce'),
        // deci Supabase-js citeste automat tokenul din URL (#access_token=...)
        // si creeaza sesiunea - la fel ca la Facebook.
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
          setStatusMessage("Autentificare reușită! Te redirecționăm...");
          router.replace(next);
          return;
        }

        const { data: listener } = supabase.auth.onAuthStateChange((event, s) => {
          if (event === "SIGNED_IN" && s) {
            listener.subscription.unsubscribe();
            setStatusMessage("Autentificare reușită! Te redirecționăm...");
            router.replace(next);
          }
        });

        const timeout = setTimeout(() => {
          listener.subscription.unsubscribe();
          setIsError(true);
          setStatusMessage("Nu am putut finaliza autentificarea. Incearca din nou.");
          setTimeout(() => router.push("/login"), 3000);
        }, 4000);

        return () => {
          clearTimeout(timeout);
          listener.subscription.unsubscribe();
        };
      } catch (err: any) {
        setIsError(true);
        setStatusMessage(err.message || "A aparut o eroare la procesarea autentificarii.");
        setTimeout(() => router.push("/login"), 3000);
      }
    };

    finish();
  }, [router, searchParams]);

  return (
    <div className="corp-sans min-h-screen bg-[#FAFAFA] text-[#111111] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md bg-white border border-[#EAEAEA] rounded-3xl p-8 text-center shadow-sm">
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

export default function SpotifyCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
          <div className="w-10 h-10 border-4 border-[#1DB954]/20 border-t-[#1DB954] rounded-full animate-spin" />
        </div>
      }
    >
      <SpotifyCallbackInner />
    </Suspense>
  );
}