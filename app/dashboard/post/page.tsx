"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function TestFacebookPage() {
  const [sessionData, setSessionData] = useState<any>(null);
  const [apiData, setApiData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function testConnection() {
      try {
        setLoading(true);
        setError("");
        
        // 1. Verificăm dacă suntem logați în aplicație prin Supabase
        const { data: { session } } = await supabase.auth.getSession();
        setSessionData(session);

        if (!session) {
          setError("Nu ești logat în aplicație prin Supabase.");
          return;
        }

        // 2. Apelăm API-ul care verifică starea Facebook
        const res = await fetch("/api/meta/status", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        
        const data = await res.json();
        setApiData(data);
      } catch (err: any) {
        setError(err.message || "Eroare la apelul API.");
      } finally {
        setLoading(false);
      }
    }

    testConnection();
  }, []);

  const handleConnect = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id || "";

    const params = new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_META_APP_ID!,
      redirect_uri: `${window.location.origin}/api/meta/callback`,
      response_type: "code",
      messenger_page_auth_attr: JSON.stringify({
        pages_manage_posts: true,
        pages_read_engagement: true,
        pages_show_list: true
      }),
      state: JSON.stringify({ userId, path: "/dashboard/post" }),
    });

     window.location.href = `https://www.facebook.com/v21.0/dialog/oauth?
  };

  if (loading) return <div style={{ padding: "20px" }}>Se încarcă datele de test...</div>;

  return (
    <div style={{ padding: "30px", fontFamily: "monospace", maxWidth: "800px", margin: "0 auto" }}>
      <h2>🧪 Pagina de Test Conexiune Facebook</h2>
      
      {error && (
        <div style={{ padding: "10px", background: "#fdf2f2", color: "#ec4899", marginBottom: "20px" }}>
          <strong>Eroare:</strong> {error}
        </div>
      )}

      {/* Buton pentru Conectare */}
      <div style={{ marginBottom: "30px" }}>
        <button onClick={handleConnect} style={{ padding: "10px 20px", background: "#1877f2", color: "white", border: "none", borderRadius: "5px", cursor: "pointer" }}>
          🔗 Forțează Conectare Facebook
        </button>
      </div>

      {/* Pasul 1: Sesiunea Supabase */}
      <div style={{ border: "1px solid #ddd", padding: "15px", marginBottom: "20px", background: "#f9f9f9" }}>
        <h3>1. Status Sesiune Supabase User</h3>
        <p>Logat în aplicație: {sessionData ? "🟢 DA" : "🔴 NU"}</p>
        {sessionData && <p>User ID: <code>{sessionData.user.id}</code></p>}
      </div>

      {/* Pasul 2: Răspunsul brut de la Meta */}
      <div style={{ border: "1px solid #ddd", padding: "15px", background: "#f9f9f9" }}>
        <h3>2. Date brute returnate de /api/meta/status</h3>
        <p>Conectat la Facebook: {apiData?.connected ? "🟢 DA" : "🔴 NU"}</p>
        <pre style={{ background: "#eee", padding: "10px", overflowX: "auto" }}>
          {JSON.stringify(apiData, null, 2)}
        </pre>
      </div>
    </div>
  );
}
