/*
app/dashboard/listings/[id]/edit/page.tsx
*/

"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { supabase } from "@/lib/supabase";

const IMAGES_BUCKET = "listing-images";

export default function EditListingPage() {
  const router = useRouter();
  const params = useParams();
  const listingId = params?.id as string;
  const imgInputRef = useRef<HTMLInputElement>(null);

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [banks, setBanks] = useState<any[]>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState<"instrument" | "preset">("preset");
  const [country, setCountry] = useState("");
  const [region, setRegion] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [digitalLink, setDigitalLink] = useState("");
  const [bankId, setBankId] = useState<string>("");

  const [images, setImages] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [viewsCount, setViewsCount] = useState(0);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Unauthorized. Please log in.");
        setUser(session.user);

        const { data: listing, error: lErr } = await supabase
          .from("listings")
          .select("*")
          .eq("id", listingId)
          .single();

        if (lErr || !listing) throw new Error("Anunțul nu a fost găsit.");
        if (listing.user_id !== session.user.id) throw new Error("Nu ai acces să editezi acest anunț.");

        setTitle(listing.title);
        setDescription(listing.description);
        setPrice(String(listing.price));
        setCategory(listing.category);
        setCountry(listing.country || "");
        setRegion(listing.region || "");
        setPhone(listing.phone || "");
        setEmail(listing.email || "");
        setDigitalLink(listing.digital_link || "");
        setBankId(listing.bank_id ? String(listing.bank_id) : "");
        setImages(listing.images || []);
        setViewsCount(listing.views_count);
        setExpiresAt(listing.expires_at);

        const { data: banksData } = await supabase
          .from("cloud_banks")
          .select("id, name, type")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false });
        setBanks(banksData ?? []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [listingId]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !user) return;
    setUploadingImages(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${user.id}/${Math.random().toString(36).substring(2)}.${ext}`;
        const { error: upErr } = await supabase.storage.from(IMAGES_BUCKET).upload(path, file);
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from(IMAGES_BUCKET).getPublicUrl(path);
        uploaded.push(pub.publicUrl);
      }
      setImages((prev) => [...prev, ...uploaded]);
    } catch (err: any) {
      alert(err.message || "Nu am putut încărca imaginile.");
    } finally {
      setUploadingImages(false);
      if (imgInputRef.current) imgInputRef.current.value = "";
    }
  };

  const removeImage = async (url: string) => {
    setImages((prev) => prev.filter((u) => u !== url));
    try {
      const path = url.split(`${IMAGES_BUCKET}/`)[1];
      if (path) await supabase.storage.from(IMAGES_BUCKET).remove([path]);
    } catch {
      // fisierul ramane orfan in storage daca stergerea esueaza, nu blocam userul
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!title.trim() || !description.trim() || !price || !category) {
      setFormError("Titlu, descriere, preț și categorie sunt obligatorii.");
      return;
    }
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0) {
      setFormError("Prețul trebuie să fie un număr valid.");
      return;
    }

    setSubmitting(true);
    try {
      const { error: updErr } = await supabase
        .from("listings")
        .update({
          title: title.trim(),
          description: description.trim(),
          price: priceNum,
          category,
          images,
          country: country.trim() || null,
          region: region.trim() || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
          digital_link: digitalLink.trim() || null,
          bank_id: bankId ? Number(bankId) : null,
        })
        .eq("id", listingId)
        .eq("user_id", user.id);

      if (updErr) throw updErr;
      router.push(`/e-market`);
    } catch (err: any) {
      setFormError(err.message || "Nu am putut salva modificările.");
    } finally {
      setSubmitting(false);
    }
  };

  const isExpired = expiresAt ? new Date(expiresAt).getTime() <= Date.now() : false;

  return (
    <div className="bg-[#f5ecec] text-[#D0D0D0] min-h-screen flex flex-col antialiased selection:bg-[#FF7A1A] selection:text-black relative overflow-hidden">
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-[#FF7A1A]/3 rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="absolute bottom-10 left-1/4 w-[400px] h-[400px] bg-indigo-500/[0.02] rounded-full blur-[120px] pointer-events-none z-0" />

      <Navbar />

      <main className="flex-1 max-w-3xl w-full mx-auto px-6 pt-32 pb-16 relative z-10 font-mono tracking-tight">
        {error ? (
          <div className="text-center p-6 bg-white border rounded-xl max-w-sm mx-auto shadow-sm mt-12">
            <p className="text-xs text-zinc-500 mb-4">{error}</p>
            <Link href="/dashboard/my-listings" className="px-4 py-2 bg-zinc-900 text-white text-xs font-semibold rounded-lg block">Înapoi la anunțuri</Link>
          </div>
        ) : loading ? (
          <div className="h-16 bg-[#222222] border border-[#2C2C2C] rounded-sm animate-pulse flex items-center px-4 text-[10px] text-zinc-500 uppercase tracking-wider">
            Loading...
          </div>
        ) : (
          <>
            <Link href="/dashboard/my-listings" className="flex items-center gap-1.5 text-[10px] text-zinc-500 hover:text-white uppercase tracking-widest mb-4 transition-colors w-fit">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Anunțurile mele
            </Link>

            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-black tracking-tight text-white">
                Editează <span className="bg-gradient-to-r from-[#FF7A1A] to-[#ff9f54] bg-clip-text text-transparent">anunțul</span>
              </h1>
              <div className="flex items-center gap-3 text-[10px] text-zinc-500 font-mono uppercase tracking-wider">
                <span>{viewsCount} views</span>
                {isExpired && <span className="text-red-400 font-bold">Expirat</span>}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="bg-[#0D0D0D] border border-zinc-800/80 rounded-2xl p-6 space-y-5 shadow-[0_12px_40px_rgba(0,0,0,0.6)]">

              {/* Titlu */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Titlu *</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full h-10 bg-[#1A1A1A] border border-zinc-800 rounded-lg px-3 text-xs text-white outline-none focus:border-[#FF7A1A]/50 transition-colors"
                />
              </div>

              {/* Descriere */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Descriere *</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  className="w-full bg-[#1A1A1A] border border-zinc-800 rounded-lg px-3 py-2.5 text-xs text-white outline-none focus:border-[#FF7A1A]/50 transition-colors resize-none"
                />
              </div>

              {/* Categorie + Pret */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Categorie *</label>
                  <div className="flex gap-1 bg-[#1A1A1A] p-1 border border-zinc-800 rounded-lg">
                    {(["preset", "instrument"] as const).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCategory(c)}
                        className={`flex-1 h-8 text-[10px] uppercase tracking-wider rounded-md transition-colors ${
                          category === c ? "bg-[#333333] text-white font-bold border border-[#444444]" : "text-zinc-500 hover:text-zinc-300"
                        }`}
                      >
                        {c === "preset" ? "Preset" : "Instrument"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Preț (€) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full h-10 bg-[#1A1A1A] border border-zinc-800 rounded-lg px-3 text-xs text-white outline-none focus:border-[#FF7A1A]/50 transition-colors"
                  />
                </div>
              </div>

              {/* Bank asociat */}
              {banks.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Leagă de un fișier din Cloud (opțional)</label>
                  <select
                    value={bankId}
                    onChange={(e) => setBankId(e.target.value)}
                    className="w-full h-10 bg-[#1A1A1A] border border-zinc-800 rounded-lg px-3 text-xs text-white outline-none focus:border-[#FF7A1A]/50 transition-colors"
                  >
                    <option value="">— niciunul —</option>
                    {banks.map((b) => (
                      <option key={b.id} value={b.id}>{b.name} ({b.type})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Tara / Regiune */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Țară</label>
                  <input
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full h-10 bg-[#1A1A1A] border border-zinc-800 rounded-lg px-3 text-xs text-white outline-none focus:border-[#FF7A1A]/50 transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Regiune</label>
                  <input
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="w-full h-10 bg-[#1A1A1A] border border-zinc-800 rounded-lg px-3 text-xs text-white outline-none focus:border-[#FF7A1A]/50 transition-colors"
                  />
                </div>
              </div>

              {/* Contact */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Telefon</label>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full h-10 bg-[#1A1A1A] border border-zinc-800 rounded-lg px-3 text-xs text-white outline-none focus:border-[#FF7A1A]/50 transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-10 bg-[#1A1A1A] border border-zinc-800 rounded-lg px-3 text-xs text-white outline-none focus:border-[#FF7A1A]/50 transition-colors"
                  />
                </div>
              </div>

              {/* Link digital */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Link livrare digitală (opțional)</label>
                <input
                  value={digitalLink}
                  onChange={(e) => setDigitalLink(e.target.value)}
                  className="w-full h-10 bg-[#1A1A1A] border border-zinc-800 rounded-lg px-3 text-xs text-white outline-none focus:border-[#FF7A1A]/50 transition-colors"
                />
              </div>

              {/* Imagini */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Imagini</label>
                <input type="file" multiple accept="image/*" ref={imgInputRef} onChange={handleImageUpload} className="hidden" />

                <div className="flex flex-wrap gap-2">
                  {images.map((url) => (
                    <div key={url} className="relative w-16 h-16 rounded-lg overflow-hidden border border-zinc-800 group">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImage(url)}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs transition-opacity"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    disabled={uploadingImages}
                    onClick={() => imgInputRef.current?.click()}
                    className="w-16 h-16 rounded-lg border border-dashed border-zinc-700 flex items-center justify-center text-zinc-500 hover:text-[#FF7A1A] hover:border-[#FF7A1A]/40 transition-colors disabled:opacity-40"
                  >
                    {uploadingImages ? (
                      <span className="w-3.5 h-3.5 border-2 border-zinc-600 border-t-[#FF7A1A] rounded-full animate-spin" />
                    ) : (
                      <span className="text-lg">+</span>
                    )}
                  </button>
                </div>
              </div>

              {formError && <p className="text-[11px] text-red-400">{formError}</p>}

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={submitting || uploadingImages}
                  className="flex-1 h-11 bg-[#FF7A1A] hover:bg-[#e06613] text-black text-xs font-black uppercase tracking-widest rounded-xl disabled:opacity-30 transition-all active:scale-[0.98]"
                >
                  {submitting ? "Se salvează..." : "Salvează modificările"}
                </button>
                <Link
                  href="/dashboard/my-listings"
                  className="h-11 px-5 flex items-center justify-center border border-zinc-700 rounded-xl text-xs font-semibold bg-zinc-900 text-white hover:bg-zinc-800 transition-colors"
                >
                  Renunță
                </Link>
              </div>
            </form>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}