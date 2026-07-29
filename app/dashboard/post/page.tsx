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
        
        const { data: { session } } = await supabase.auth.getSession();
        setSessionData(session);

        if (!session) {
          setError("Nu ești logat în aplicație prin Supabase.");
          return;
        }

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
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || "";

      // Generare URL securizată folosind obiectul nativ URL pentru a evita "Unterminated template"
      const oauthUrl = new URL("https://www.facebook.com/v21.0/dialog/oauth");
      
      oauthUrl.searchParams.set("client_id", process.env.NEXT_PUBLIC_META_APP_ID || "");
      oauthUrl.searchParams.set("redirect_uri", window.location.origin + "/api/meta/callback");
      oauthUrl.searchParams.set("response_type", "code");
      oauthUrl.searchParams.set("messenger_page_auth_attr", JSON.stringify({
        pages_manage_posts: true,
        pages_read_engagement: true,
        pages_show_list: true
      }));
      oauthUrl.searchParams.set("state", JSON.stringify({ userId: userId, path: "/dashboard/post" }));

      window.location.href = oauthUrl.toString();
    } catch (err) {
      console.error("Eroare la inițierea conectării:", err);
    }
  };

  if (loading) {
    return <div style={{ padding: "20px", fontFamily: "sans-serif" }}>Se încarcă datele de test...</div>;
  }

  return (
    <div style={{ padding: "30px", fontFamily: "monospace", maxWidth: "800px", margin: "0 auto" }}>
      <h2>🧪 Pagina de Test Conexiune Facebook</h2>
      
      {error && (
        <div style={{ padding: "10px", background: "#fdf2f2", color: "#ec4899", marginBottom: "20px" }}>
          <strong>Eroare:</strong> {error}
        </div>
      )}

      <div style={{ marginBottom: "30px" }}>
        <button 
          onClick={handleConnect} 
          style={{ padding: "10px 20px", background: "#1877f2", color: "white", border: "none", borderRadius: "5px", cursor: "pointer", fontWeight: "bold" }}
        >
          🔗 Forțează Conectare Facebook
        </button>
      </div>

      <div style={{ border: "1px solid #ddd", padding: "15px", marginBottom: "20px", background: "#f9f9f9", borderRadius: "6px" }}>
        <h3>1. Status Sesiune Supabase User</h3>
        <p>Logat în aplicație: {sessionData ? "🟢 DA" : "🔴 NU"}</p>
        {sessionData && <p>User ID: <code>{sessionData.user.id}</code></p>}
      </div>

      <div style={{ border: "1px solid #ddd", padding: "15px", background: "#f9f9f9", borderRadius: "6px" }}>
        <h3>2. Date brute returnate de /api/meta/status</h3>
        <p>Conectat la Facebook: {apiData?.connected ? "🟢 DA" : "🔴 NU"}</p>
        <pre style={{ background: "#eee", padding: "10px", overflowX: "auto", borderRadius: "4px" }}>
          {JSON.stringify(apiData, null, 2)}
        </pre>
      </div>
    </div>
  );
}
