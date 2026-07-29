"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function SimpleSocialPostsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [facebookConnected, setFacebookConnected] = useState(false);
  const [connectingFb, setConnectingFb] = useState(false);

  // 1. Încărcare date dintr-un singur flux stabil
  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");

      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          setError("Trebuie să fii logat în aplicație.");
          return;
        }

        // Verificăm dacă contul de Facebook este legat în baza de date
        try {
          const res = await fetch("/api/meta/status", {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          const data = await res.json();
          setFacebookConnected(!!data.connected);
        } catch (fbErr) {
          console.error("Eroare verificare status Facebook:", fbErr);
        }

        // Încărcăm listările active
        const { data: listingsData, error: err } = await supabase
          .from("listings")
          .select("*")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false });

        if (err) throw err;
        setListings(listingsData || []);

      } catch (err: any) {
        setError(err.message || "A apărut o eroare la încărcarea datelor.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 2. Ascultăm și curățăm parametrii trimiși înapoi de Facebook în URL
  useEffect(() => {
    const fbConnected = searchParams.get("fb_connected");
    const fbError = searchParams.get("fb_error");

    if (fbConnected === "1") {
      setFacebookConnected(true);
      router.replace(window.location.pathname);
    }
    if (fbError) {
      setError(`Eroare Facebook: ${fbError}`);
      router.replace(window.location.pathname);
    }
  }, [searchParams, router]);

  // 3. Funcția simplă de conectare (Transmite starea prin state)
const handleConnectFacebook = () => {
  setConnectingFb(true);
  const params = new URLSearchParams({
    client_id: process.env.NEXT_PUBLIC_META_APP_ID!,
    redirect_uri: `${window.location.origin}/api/meta/callback`,
    config_id: process.env.NEXT_PUBLIC_META_CONFIG_ID!,
    response_type: "code",
    state: window.location.pathname, // ca sa stim unde redirectam userul inapoi
  });
  window.location.href = `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;
};
  if (loading) {
    return <div style={{ padding: "20px", fontFamily: "sans-serif" }}>Se încarcă datele profilului...</div>;
  }

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif", maxWidth: "600px", margin: "0 auto" }}>
      <h1>Panou Postări Facebook</h1>
      
      {error && (
        <div style={{ padding: "10px", backgroundColor: "#ffebee", color: "#c62828", marginBottom: "15px", borderRadius: "5px" }}>
          {error}
        </div>
      )}

      {/* Stare Conexiune Facebook */}
      <div style={{ padding: "15px", border: "1px solid #ccc", borderRadius: "8px", marginBottom: "20px" }}>
        <h3>Stare Conexiune Meta</h3>
        {facebookConnected ? (
          <p style={{ color: "green", fontWeight: "bold" }}>● Contul Facebook este Conectat cu succes!</p>
        ) : (
          <div>
            <p style={{ color: "orange" }}>● Contul Facebook NU este conectat.</p>
            <button 
              onClick={handleConnectFacebook}
              disabled={connectingFb}
              style={{ padding: "10px 15px", backgroundColor: "#1877f2", color: "white", border: "none", borderRadius: "5px", cursor: "pointer" }}
            >
              {connectingFb ? "Se redirecționează..." : "Conectează Facebook"}
            </button>
          </div>
        )}
      </div>

      {/* Listă Anunțuri */}
      <div>
        <h3>Listările tale active ({listings.length})</h3>
        {listings.length === 0 ? (
          <p>Nu s-a găsit nicio listare activă în baza de date Supabase.</p>
        ) : (
          <ul style={{ paddingLeft: "20px" }}>
            {listings.map((listing) => (
              <li key={listing.id} style={{ marginBottom: "5px" }}>
                {listing.title || "Listare fără titlu"}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
