"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { supabase } from "@/lib/supabase";
import { SessionTracker, trackEvent } from "@/lib/session-tracker";

type Listing = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  price: number;
  category: "instrument" | "preset";
  images: string[];
  created_at: string;
  expires_at: string;
  digital_link: string | null;
  phone: string | null;
  country: string | null;
  region: string | null;
  email: string | null;
  views_count: number;
  bank_id: number | null;
  promoted_until: string | null;
};

const lim = 8;

export default function MyListingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<"all" | "active" | "expired" | "promoted">("all");
  const [delId, setDelId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Unauthorized. Please log in.");
        setUser(session.user);

        const now = new Date().toISOString();
        let q = supabase
          .from("listings")
          .select("*")
          .eq("user_id", session.user.id);

        if (filter === "active") q = q.gt("expires_at", now);
        if (filter === "expired") q = q.lte("expires_at", now);
        if (filter === "promoted") q = q.gt("promoted_until", now);

        const { data, error: qErr } = await q
          .order("created_at", { ascending: false })
          .range((page - 1) * lim, page * lim - 1);

        if (qErr) throw qErr;
        setListings((data as Listing[]) ?? []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [page, filter]);

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      const { error: delErr } = await supabase.from("listings").delete().eq("id", id);
      if (delErr) throw delErr;
      setListings((prev) => prev.filter((l) => l.id !== id));
      setDelId(null);
      trackEvent("listing_deleted", { listing_id: id });
    } catch (err: any) {
      alert(err.message || "Nu am putut șterge anunțul.");
    } finally {
      setDeleting(false);
    }
  };

  const statusOf = (l: Listing) => {
    const now = Date.now();
    const promoted = l.promoted_until && new Date(l.promoted_until).getTime() > now;
    const expired = new Date(l.expires_at).getTime() <= now;
    if (expired) return { label: "Expirat", cls: "bg-zinc-800 text-zinc-400 border-zinc-700" };
    if (promoted) return { label: "Promovat", cls: "bg-gradient-to-r from-[#6366F1]/20 to-[#0EA5E9]/20 text-cyan-300 border-cyan-500/30" };
    return { label: "Activ", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" };
  };

  const daysLeft = (expires_at: string) => {
    const diffMs = new Date(expires_at).getTime() - Date.now();
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return days;
  };

  return (
    <div className="bg-[#181818] text-[#D0D0D0] min-h-screen flex flex-col antialiased selection:bg-[#FF7A1A] selection:text-black relative overflow-hidden">
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-[#FF7A1A]/3 rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="absolute bottom-10 left-1/4 w-[400px] h-[400px] bg-indigo-500/[0.02] rounded-full blur-[120px] pointer-events-none z-0" />

      {/* Tracker global de sesiune — captează pageview + timp pe pagină + user_id dacă e logat */}
      <SessionTracker />

      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 pt-32 pb-12 relative z-10 font-mono tracking-tight bg-[#1C1C1C]/40 border-x border-zinc-900/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <div className="absolute inset-0 border border-zinc-900/40 pointer-events-none rounded-sm m-2 opacity-50" />

        {error ? (
          <div className="text-center p-6 bg-white border rounded-xl max-w-sm mx-auto shadow-sm mt-12">
            <p className="text-xs text-zinc-500 mb-4">{error}</p>
            <Link href="/login" className="px-4 py-2 bg-zinc-900 text-white text-xs font-semibold rounded-lg block">Autentication</Link>
          </div>
        ) : (
          <>
            {/* Header pagina */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <div className="space-y-1">
                <button
                  onClick={() => router.push("/dashboard/cloud-db")}
                  className="flex items-center gap-1.5 text-[10px] text-zinc-500 hover:text-white uppercase tracking-widest mb-2 transition-colors cursor-pointer"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  Înapoi la MyCloud
                </button>
                <h1 className="text-2xl font-black tracking-tight text-white">
                  Anunțurile <span className="bg-gradient-to-r from-[#FF7A1A] to-[#ff9f54] bg-clip-text text-transparent">Mele</span>
                </h1>
                <p className="text-xs text-zinc-500">{listings.length} {listings.length === 1 ? "anunț" : "anunțuri"} pe pagina curentă</p>
              </div>

              <Link
                href="/e-market"
                onClick={() => trackEvent("new_listing_clicked")}
                className="h-10 px-5 bg-[#FF7A1A] hover:bg-[#e06613] active:scale-[0.97] text-black text-xs font-extrabold uppercase tracking-widest rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(255,122,26,0.15)] cursor-pointer w-fit"
              >
                <span className="text-base font-black leading-none">+</span>
                <span>Anunț nou</span>
              </Link>
            </div>

            {/* Filtre status */}
            <div className="flex gap-0.5 bg-[#181818] p-0.5 rounded-sm w-fit mb-6 border border-[#2C2C2C] font-mono shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)]">
              {(["all", "active", "promoted", "expired"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => {
                    setFilter(f);
                    setPage(1);
                    trackEvent("listings_filter_changed", { filter: f });
                  }}
                  className={`h-6 px-3 text-[10px] uppercase tracking-wider rounded-xs transition-colors cursor-pointer ${
                    filter === f
                      ? "bg-[#333333] text-white border border-[#444444] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] font-bold"
                      : "text-zinc-500 hover:text-zinc-300 hover:bg-[#222222]/50"
                  }`}
                >
                  {f === "all" ? "toate" : f === "active" ? "active" : f === "promoted" ? "promovate" : "expirate"}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="h-16 bg-[#222222] border border-[#2C2C2C] rounded-sm animate-pulse flex items-center px-4 font-mono text-[10px] text-zinc-500 uppercase tracking-wider">
                Scanning listings...
              </div>
            ) : listings.length === 0 ? (
              <div className="text-center py-14 border border-dashed border-[#2C2C2C] rounded-sm bg-[#1E1E1E] font-mono text-[10px] text-zinc-500 uppercase tracking-widest space-y-3">
                <p>Nu ai niciun anunț {filter !== "all" ? `în categoria "${filter}"` : "publicat încă"}.</p>
                <Link href="/e-market" className="inline-block text-[#FF7A1A] hover:underline normal-case tracking-normal text-xs font-sans">
                  Publică primul tău anunț →
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {listings.map((l) => {
                  const status = statusOf(l);
                  const dl = daysLeft(l.expires_at);
                  const cover = l.images?.[0];

                  return (
                    <div
                      key={l.id}
                      className="bg-[#222222] border border-[#2C2C2C] rounded-sm p-3 flex gap-3 hover:bg-[#2A2A2A] hover:border-zinc-700 transition-all group"
                    >
                      {/* Thumbnail */}
                      <div className="w-16 h-16 shrink-0 rounded-sm bg-[#1A1A1A] border border-[#2C2C2C] overflow-hidden flex items-center justify-center text-lg">
                        {cover ? (
                          <img src={cover} alt={l.title} className="w-full h-full object-cover" />
                        ) : (
                          <span>{l.category === "preset" ? "🎛️" : "🎹"}</span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-xs font-bold text-white truncate tracking-tight" title={l.title}>
                              {l.title}
                            </h3>
                            <span className={`shrink-0 text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-sm border ${status.cls}`}>
                              {status.label}
                            </span>
                          </div>
                          <p className="text-[10px] text-zinc-400 mt-0.5 uppercase tracking-tight">
                            {l.category} <span className="text-zinc-600">•</span> {l.price} € <span className="text-zinc-600">•</span> {l.country || "—"}
                          </p>
                        </div>

                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-3 text-[9px] text-zinc-500 font-mono uppercase tracking-wider">
                            <span className="flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              {l.views_count}
                            </span>
                            <span>{dl > 0 ? `${dl}z rămase` : "expirat"}</span>
                          </div>

                          <div className="flex items-center gap-1">
                            {delId === l.id ? (
                              <div className="flex gap-1 bg-[#1A1A1A] p-1 border border-[#2C2C2C] rounded-sm">
                                <button
                                  disabled={deleting}
                                  onClick={() => handleDelete(l.id)}
                                  className="px-2 py-0.5 bg-red-600 hover:bg-red-500 text-white text-[9px] font-bold uppercase rounded-sm transition-colors disabled:opacity-40"
                                >
                                  {deleting ? "..." : "yes"}
                                </button>
                                <button
                                  onClick={() => setDelId(null)}
                                  className="px-2 py-0.5 text-zinc-400 hover:text-white text-[9px] font-bold uppercase rounded-sm transition-colors"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <>
                                <Link
                                  href={`/e-market`}
                                  className="w-6 h-6 rounded-sm flex items-center justify-center border border-transparent text-zinc-500 hover:text-white hover:bg-[#2C2C2C] hover:border-zinc-700 sm:opacity-0 group-hover:opacity-100 transition-all"
                                  title="Vezi anunțul public"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                </Link>
                                <Link
                                  href={`/dashboard/listings/${l.id}/edit`}
                                  onClick={() => trackEvent("listing_edit_clicked", { listing_id: l.id })}
                                  className="w-6 h-6 rounded-sm flex items-center justify-center border border-transparent text-zinc-500 hover:text-[#FF7A1A] hover:bg-[#2C2C2C] hover:border-zinc-700 sm:opacity-0 group-hover:opacity-100 transition-all"
                                  title="Editează"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </Link>
                                <button
                                  onClick={() => setDelId(l.id)}
                                  className="w-6 h-6 rounded-sm flex items-center justify-center border border-transparent text-zinc-500 hover:text-red-500 hover:bg-red-950/20 hover:border-red-900/30 sm:opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                                  title="Șterge"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {listings.length > 0 && (
              <div className="flex justify-between items-center mt-6 text-xs border-t border-zinc-800 pt-4">
                <span className="text-zinc-400 font-medium">Page {page}</span>
                <div className="flex gap-1">
                  <button
                    disabled={page === 1}
                    onClick={() => {
                      setPage((p) => p - 1);
                      trackEvent("listings_page_changed", { direction: "prev", page: page - 1 });
                    }}
                    className="h-7 px-3 border border-zinc-700 rounded-md bg-[#222222] text-white disabled:opacity-40"
                  >
                    ←
                  </button>
                  <button
                    disabled={listings.length < lim}
                    onClick={() => {
                      setPage((p) => p + 1);
                      trackEvent("listings_page_changed", { direction: "next", page: page + 1 });
                    }}
                    className="h-7 px-3 border border-zinc-700 rounded-md bg-[#222222] text-white disabled:opacity-40"
                  >
                    →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}