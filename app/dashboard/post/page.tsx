"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import NotificationBell from "@/components/NotificationBell";
import { supabase } from "@/lib/supabase";
import { buildPostMessage, getListingImage, Listing } from "@/lib/postMessageBuilder";

export default function SocialPostsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ---- verificare obligatorie: userul e conectat cu Facebook? ----
  const [checkingFbAuth, setCheckingFbAuth] = useState(true);
  const [facebookConnected, setFacebookConnected] = useState(false);
  const [connectingFb, setConnectingFb] = useState(false);

  const [selected, setSelected] = useState<Listing | null>(null);
  const [message, setMessage] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [scheduleMode, setScheduleMode] = useState<"now" | "later">("later");
  const [scheduledLocal, setScheduledLocal] = useState(""); // valoare din input datetime-local

  const [publishing, setPublishing] = useState(false);
  const [resultMsg, setResultMsg] = useState("");
  const [resultError, setResultError] = useState("");

  // Verificare obligatorie: fără pagină Facebook conectată, nu se poate posta.
  useEffect(() => {
    (async () => {
      setCheckingFbAuth(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setFacebookConnected(false);
          return;
        }
        const res = await fetch("/api/meta/status", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await res.json();
        setFacebookConnected(!!data.connected);
      } finally {
        setCheckingFbAuth(false);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Trebuie să fii logat.");

        const { data, error: err } = await supabase
          .from("listings")
          .select("*")
          .eq("user_id", session.user.id)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false });

        if (err) throw err;
        setListings(data || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

const handleConnectFacebook = async () => {
  setConnectingFb(true);
  
  // 1. Luăm sesiunea curentă direct din client (care este deja logat)
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id || "";

  // 2. Construim parametrii fără config_id și forțăm calea "/post"
  const params = new URLSearchParams({
    client_id: process.env.NEXT_PUBLIC_META_APP_ID!,
    redirect_uri: `${window.location.origin}/api/meta/callback`,
    response_type: "code",
    scope: "pages_manage_posts,pages_read_engagement,pages_show_list", // Permisiunile necesare scrise direct text
    // Îi transmitem serverului ID-ul de utilizator și locația exactă "/post"
    state: JSON.stringify({ userId, path: "/post" }), 
  });
  
  // 3. Plecăm spre Facebook
  window.location.href = `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;
};


  const selectListing = (listing: Listing) => {
    setSelected(listing);
    setMessage(buildPostMessage(listing));
    setImageUrl(getListingImage(listing) || "");
    setResultMsg("");
    setResultError("");
  };

  const handlePublish = async () => {
    if (!message.trim()) {
      setResultError("Mesajul nu poate fi gol.");
      return;
    }

    let scheduledPublishTime: number | undefined;

    if (scheduleMode === "later") {
      if (!scheduledLocal) {
        setResultError("Alege o dată și oră pentru programare.");
        return;
      }
      scheduledPublishTime = Math.floor(new Date(scheduledLocal).getTime() / 1000);

      const minTime = Math.floor(Date.now() / 1000) + 10 * 60;
      if (scheduledPublishTime < minTime) {
        setResultError("Ora aleasă trebuie să fie cu minim 10 minute în viitor.");
        return;
      }
    }

    setPublishing(true);
    setResultMsg("");
    setResultError("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sesiune expirată, te rugăm să te reloghezi.");

      const res = await fetch("/api/post/publish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          message,
          imageUrl: imageUrl || undefined,
          scheduledPublishTime,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Eroare la publicare.");

      // Salvăm postarea în DB ca să putem urmări statusul ei (pentru notificări).
      const fbPostId = data.facebook?.id || data.facebook?.post_id;

      if (fbPostId) {
        await supabase.from("scheduled_posts").insert({
          user_id: session.user.id,
          listing_id: selected?.id || null,
          fb_post_id: fbPostId,
          message,
          image_url: imageUrl || null,
          scheduled_publish_time:
            scheduleMode === "later" ? new Date(scheduledLocal).toISOString() : null,
          status: scheduleMode === "later" ? "scheduled" : "published",
          published_at: scheduleMode === "now" ? new Date().toISOString() : null,
        });
      }

      setResultMsg(
        scheduleMode === "later"
          ? "Postare programată cu succes pe Facebook. Vei primi o notificare când se publică efectiv."
          : "Postare publicată acum pe Facebook."
      );
    } catch (err: any) {
      setResultError(err.message || "Eroare necunoscută.");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="bg-[#e3f1f1] text-zinc-900 min-h-screen flex flex-col antialiased">
      <Navbar />
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 pt-24 pb-12">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Postări Facebook</h1>
          <NotificationBell />
        </div>
        <p className="text-xs text-zinc-400 mb-6">
          Alege o listare activă — mesajul și linkul de promovare se completează automat.
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl p-3 mb-4">
            {error}
          </div>
        )}

        {checkingFbAuth ? (
          <div className="h-24 bg-white border rounded-xl animate-pulse" />
        ) : !facebookConnected ? (
          <div className="bg-white border border-amber-200 rounded-xl p-6 text-center space-y-3 max-w-md mx-auto">
            <p className="text-2xl">📘</p>
            <p className="text-sm font-semibold text-zinc-900">
              Contul tău Facebook nu este conectat
            </p>
            <p className="text-xs text-zinc-500">
              Ca să poți publica sau programa postări, trebuie mai întâi să legi
              contul de Facebook (pagina ta) de acest cont.
            </p>
            <button
              onClick={handleConnectFacebook}
              disabled={connectingFb}
              className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg disabled:opacity-40"
            >
              {connectingFb ? "Se conectează..." : "Conectează Facebook"}
            </button>
          </div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Lista listărilor */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wide text-zinc-400 mb-3">
              Listările tale active
            </h2>

            {loading ? (
              <div className="h-16 bg-white border rounded-xl animate-pulse" />
            ) : listings.length === 0 ? (
              <div className="text-center py-10 border border-dashed rounded-xl bg-white text-xs text-zinc-400">
                Nu ai listări active momentan.
              </div>
            ) : (
              <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
                {listings.map((listing) => (
                  <button
                    key={listing.id}
                    onClick={() => selectListing(listing)}
                    className={`w-full text-left bg-white border p-3 rounded-xl flex items-center gap-3 transition-all ${
                      selected?.id === listing.id
                        ? "border-zinc-900 shadow-sm"
                        : "border-zinc-200 hover:border-zinc-400"
                    }`}
                  >
                    {listing.images?.[0] ? (
                      <img
                        src={listing.images[0]}
                        alt={listing.title}
                        className="w-10 h-10 rounded-md object-cover bg-zinc-100 shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-md bg-zinc-100 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">{listing.title}</p>
                      <p className="text-[10px] text-zinc-400">
                        {listing.price} € · {listing.category}
                        {listing.digital_link ? " · are link" : " · fără link"}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Formular de compunere postare */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wide text-zinc-400 mb-3">
              Compune postarea
            </h2>

            {!selected ? (
              <div className="text-center py-10 border border-dashed rounded-xl bg-white text-xs text-zinc-400">
                Alege o listare din stânga pentru a începe.
              </div>
            ) : (
              <div className="bg-white border rounded-xl p-4 space-y-3">
                <div>
                  <label className="text-[11px] font-medium text-zinc-500 block mb-1">
                    Mesaj (editabil)
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={7}
                    className="w-full border rounded-lg p-2 text-xs outline-none focus:border-zinc-400"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-zinc-500 block mb-1">
                    URL imagine (opțional)
                  </label>
                  <input
                    type="text"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full h-9 border rounded-lg px-2 text-xs outline-none focus:border-zinc-400"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setScheduleMode("now")}
                    className={`h-8 px-3 rounded-lg text-xs font-medium border ${
                      scheduleMode === "now"
                        ? "bg-zinc-900 text-white border-zinc-900"
                        : "bg-white text-zinc-600 border-zinc-200"
                    }`}
                  >
                    Publică acum
                  </button>
                  <button
                    onClick={() => setScheduleMode("later")}
                    className={`h-8 px-3 rounded-lg text-xs font-medium border ${
                      scheduleMode === "later"
                        ? "bg-zinc-900 text-white border-zinc-900"
                        : "bg-white text-zinc-600 border-zinc-200"
                    }`}
                  >
                    Programează
                  </button>
                </div>

                {scheduleMode === "later" && (
                  <div>
                    <label className="text-[11px] font-medium text-zinc-500 block mb-1">
                      Data și ora publicării
                    </label>
                    <input
                      type="datetime-local"
                      value={scheduledLocal}
                      onChange={(e) => setScheduledLocal(e.target.value)}
                      className="w-full h-9 border rounded-lg px-2 text-xs outline-none focus:border-zinc-400"
                    />
                  </div>
                )}

                {resultError && <p className="text-[11px] text-red-500">{resultError}</p>}
                {resultMsg && <p className="text-[11px] text-emerald-600">{resultMsg}</p>}

                <button
                  onClick={handlePublish}
                  disabled={publishing}
                  className="w-full h-10 bg-zinc-900 text-white text-xs font-semibold rounded-lg disabled:opacity-40"
                >
                  {publishing
                    ? "Se trimite..."
                    : scheduleMode === "later"
                    ? "Programează postarea"
                    : "Publică acum"}
                </button>
              </div>
            )}
          </div>
        </div>
        )}
      </main>
      <Footer />
    </div>
  );
}