"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    const next = searchParams.get("next") || "/dashboard/cloud-db";

    const finish = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
          router.replace(next);
          return;
        }

        const { data: listener } = supabase.auth.onAuthStateChange((event, s) => {
          if (event === "SIGNED_IN" && s) {
            listener.subscription.unsubscribe();
            router.replace(next);
          }
        });

        const timeout = setTimeout(() => {
          listener.subscription.unsubscribe();
          setError("Nu am putut finaliza autentificarea. Incearca din nou.");
        }, 4000);

        return () => {
          clearTimeout(timeout);
          listener.subscription.unsubscribe();
        };
      } catch (err: any) {
        setError(err.message || "Eroare la autentificare.");
      }
    };

    finish();
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center space-y-3">
        {error ? (
          <>
            <p className="text-sm text-red-600 font-medium">{error}</p>
            <a href="/login" className="text-xs text-[#0070F3] underline underline-offset-2">
              Inapoi la login
            </a>
          </>
        ) : (
          <>
            <span className="inline-block w-5 h-5 border-2 border-zinc-300 border-t-zinc-900 rounded-full animate-spin" />
            <p className="text-xs text-zinc-500 font-mono">Te autentificam...</p>
          </>
        )}
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-white">
          <span className="inline-block w-5 h-5 border-2 border-zinc-300 border-t-zinc-900 rounded-full animate-spin" />
        </div>
      }
    >
      <AuthCallbackInner />
    </Suspense>
  );
}