"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Montează-l O SINGURĂ DATĂ, în layout-ul principal al aplicației
 * (app/layout.tsx), ca să funcționeze indiferent de unde se loghează userul.
 *
 * Ascultă evenimentele de auth. Imediat după un login cu Facebook,
 * session.provider_token conține User Access Token-ul de la Facebook
 * (disponibil DOAR în acest moment, nu și la refresh-uri ulterioare de sesiune) —
 * îl trimitem către server ca să extragem automat Page Access Token-ul.
 */
export default function MetaAuthListener() {
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event !== "SIGNED_IN") return;
      if (!session?.provider_token) return;

      try {
        await fetch("/api/meta/connect", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ fbUserAccessToken: session.provider_token }),
        });
      } catch (err) {
        console.error("Eroare la conectarea automată Facebook:", err);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return null;
}