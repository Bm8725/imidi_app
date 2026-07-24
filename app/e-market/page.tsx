"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

interface Listing {
  id: string;
  user_id: string;
  title: string;
  description: string;
  price: number;
  category: "instrument" | "preset";
  images: string[];
  digital_link: string | null;
  phone: string | null;
  email: string | null;
  country: string | null;
  region: string | null;
}

interface Review {
  id: string;
  listing_id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

const PAGE_SIZE = 9;
const MAX_IMAGES = 4;

export default function EMarketPage() {
  const [user, setUser] = useState<any>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  // form fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState<"instrument" | "preset">("instrument");
  const [digitalLink, setDigitalLink] = useState("");
  const [phone, setPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [country, setCountry] = useState("");
  const [region, setRegion] = useState("");

  // upload poze, una cate una
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [editLinkValue, setEditLinkValue] = useState("");

  // filtre / cautare
  const [filter, setFilter] = useState<"all" | "instrument" | "preset">("all");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "price_asc" | "price_desc">("newest");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // paginare
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // modal detalii + reviews
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [myRating, setMyRating] = useState(0);
  const [myComment, setMyComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [shareFeedbackId, setShareFeedbackId] = useState<string | null>(null);

useEffect(() => {
  // Citim ID-ul din URL dacă utilizatorul a venit de pe un link de share
  const queryParams = new URLSearchParams(window.location.search);
  const sharedListingId = queryParams.get("id");

  if (sharedListingId) {
    // Interogăm Supabase pentru a încărca anunțul în modalul de detalii
    supabase
      .from("listings")
      .select("*")
      .eq("id", sharedListingId)
      .single()
      .then(({ data }) => {
        if (data) {
          setSelectedListing(data);
          setActiveImage(0);
        }
      });
  }
}, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) setUser(data.user);
    });
  }, []);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from("listings")
      .select("*", { count: "exact" })
      .gt("expires_at", new Date().toISOString());

    if (filter !== "all") {
      query = query.eq("category", filter);
    }
    if (searchQuery.trim() !== "") {
      query = query.or("title.ilike.%" + searchQuery + "%,description.ilike.%" + searchQuery + "%");
    }
    if (priceMin.trim() !== "") {
      query = query.gte("price", parseFloat(priceMin));
    }
    if (priceMax.trim() !== "") {
      query = query.lte("price", parseFloat(priceMax));
    }
    if (countryFilter.trim() !== "") {
      query = query.ilike("country", "%" + countryFilter + "%");
    }

    if (sortBy === "newest") {
      query = query.order("created_at", { ascending: false });
    } else if (sortBy === "price_asc") {
      query = query.order("price", { ascending: true });
    } else {
      query = query.order("price", { ascending: false });
    }

    query = query.range(from, to);

    const result = await query;
    if (result.error) {
      setError(result.error.message);
    } else {
      setListings((result.data as Listing[]) || []);
      setTotalCount(result.count || 0);
    }
    setLoading(false);
  }, [filter, searchQuery, priceMin, priceMax, countryFilter, sortBy, page]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  useEffect(() => {
    setPage(1);
  }, [filter, searchQuery, priceMin, priceMax, countryFilter, sortBy]);

  const runSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(searchInput.trim());
  };

  const resetFilters = () => {
    setSearchInput("");
    setSearchQuery("");
    setPriceMin("");
    setPriceMax("");
    setCountryFilter("");
    setSortBy("newest");
    setFilter("all");
  };

  // ---- upload poze, una cate una, cu preview si stergere individuala ----
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const room = MAX_IMAGES - imageFiles.length;
    const accepted = files.slice(0, Math.max(0, room));

    setImageFiles((prev) => [...prev, ...accepted]);
    setImagePreviews((prev) => [...prev, ...accepted.map((f) => URL.createObjectURL(f))]);

    e.target.value = "";
  };

  const removeImage = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  const uploadImages = async (): Promise<string[]> => {
    if (!user || imageFiles.length === 0) return [];
    setUploading(true);
    const urls: string[] = [];
    try {
      for (const file of imageFiles) {
        const ext = file.name.split(".").pop();
        const path = user.id + "/" + Date.now() + "-" + Math.random().toString(36).slice(2) + "." + ext;
        const uploadResult = await supabase.storage.from("listing-images").upload(path, file);
        if (uploadResult.error) throw uploadResult.error;
        const { data } = supabase.storage.from("listing-images").getPublicUrl(path);
        urls.push(data.publicUrl);
      }
      return urls;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmitListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError("Log in required.");
      return;
    }
    if (imageFiles.length === 0) {
      setError("Adauga cel putin o poza.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const uploadedUrls = await uploadImages();

      const insertResult = await supabase.from("listings").insert({
        user_id: user.id,
        title: title,
        description: description,
        price: parseFloat(price),
        category: category,
        images: uploadedUrls,
        digital_link: category === "preset" && digitalLink.trim() !== "" ? digitalLink.trim() : null,
        phone: phone.trim() !== "" ? phone.trim() : null,
        email: contactEmail.trim() !== "" ? contactEmail.trim() : null,
        country: category === "instrument" && country.trim() !== "" ? country.trim() : null,
        region: category === "instrument" && region.trim() !== "" ? region.trim() : null,
      });
      if (insertResult.error) throw insertResult.error;

      setTitle("");
      setDescription("");
      setPrice("");
      setDigitalLink("");
      setPhone("");
      setContactEmail("");
      setCountry("");
      setRegion("");
      imagePreviews.forEach((p) => URL.revokeObjectURL(p));
      setImageFiles([]);
      setImagePreviews([]);
      setShowForm(false);
      setPage(1);
      fetchListings();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const startEditLink = (item: Listing) => {
    setEditingLinkId(item.id);
    setEditLinkValue(item.digital_link || "");
  };

  const saveDigitalLink = async (id: string) => {
    try {
      const updateResult = await supabase
        .from("listings")
        .update({ digital_link: editLinkValue.trim() === "" ? null : editLinkValue.trim() })
        .eq("id", id);
      if (updateResult.error) throw updateResult.error;
      setEditingLinkId(null);
      fetchListings();
      if (selectedListing?.id === id) {
        setSelectedListing({ ...selectedListing, digital_link: editLinkValue.trim() || null });
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  // ---- modal + reviews ----
  const openListing = async (item: Listing) => {
    setSelectedListing(item);
    setActiveImage(0);
    setMyRating(0);
    setMyComment("");
    setReviewsLoading(true);
    const result = await supabase
      .from("listing_reviews")
      .select("*")
      .eq("listing_id", item.id)
      .order("created_at", { ascending: false });
    if (result.data) {
      setReviews(result.data as Review[]);
      const mine = (result.data as Review[]).find((r) => r.user_id === user?.id);
      if (mine) {
        setMyRating(mine.rating);
        setMyComment(mine.comment || "");
      }
    }
    setReviewsLoading(false);
  };

  const closeModal = () => {
    setSelectedListing(null);
    setReviews([]);
  };

  const shareListing = async (item: Listing, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const url = window.location.origin + window.location.pathname + "?listing=" + item.id;

    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({
          title: item.title,
          text: item.title + " - " + "\u20AC" + item.price + " pe iMIDI Market",
          url: url,
        });
      } catch {
        // userul a anulat share-ul, nu facem nimic
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      setShareFeedbackId(item.id);
      setTimeout(() => setShareFeedbackId(null), 2000);
    } catch {
      setError("Nu am putut copia linkul.");
    }
  };

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedListing) {
      setError("Log in required.");
      return;
    }
    if (myRating < 1) {
      setError("Alege un rating de la 1 la 5.");
      return;
    }
    setSubmittingReview(true);
    try {
      const upsertResult = await supabase
        .from("listing_reviews")
        .upsert(
          {
            listing_id: selectedListing.id,
            user_id: user.id,
            rating: myRating,
            comment: myComment.trim() === "" ? null : myComment.trim(),
          },
          { onConflict: "listing_id,user_id" }
        );
      if (upsertResult.error) throw upsertResult.error;
      await openListing(selectedListing);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmittingReview(false);
    }
  };

  const averageRating =
    reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;

  const StarRow = ({
    value,
    onChange,
  }: {
    value: number;
    onChange?: (v: number) => void;
  }) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          onClick={onChange ? () => onChange(n) : undefined}
          className={
            (onChange ? "cursor-pointer " : "") +
            (n <= value ? "text-[#B4592F]" : "text-black/15") +
            " text-sm leading-none"
          }
        >
          {"\u2605"}
        </span>
      ))}
    </div>
  );

  return (
    <div className="bg-[#FFFFFF] text-[#1C1A16] min-h-screen flex flex-col antialiased relative">
      <Navbar />

      <div className="border-b border-black/5 pt-36 pb-10 bg-[#F7F6F3]">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row justify-between sm:items-end gap-4">
          <div className="flex items-center gap-4">
            <svg
              width="48"
              height="48"
              viewBox="0 0 48 48"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="shrink-0"
            >
              <path
                d="M6 6H25L42 23L23 42L6 25V6Z"
                stroke="#B4592F"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <circle cx="15.5" cy="15.5" r="3" stroke="#B4592F" strokeWidth="2" />
              <path
                d="M17 31L20.5 24L24 33L27.5 21L31 28"
                stroke="#1C1A16"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#8A7A5C] mb-1">
                Catalog
              </p>
              <h1 className="text-3xl font-serif tracking-tight text-[#1C1A16]">iMIDI e-Market</h1>
              <p className="text-xs text-[#7A7365] mt-1">
                Platforma dedicata vanzarilor after-market de instrumente muzicale si 
                preseturi pentru DAW-uri/synth direct din cloud, fara carduri de memorie sau SSD. Publica anunturi gratuite, cumpara sau vinde in siguranta. Anuntul este gratuit 15 zile.
                Singura platforma de acest tip in Romania si Europa, cu suport tehnic si asistenta AI pentru configurarea spatiului tau de lucru in myCloud.
              </p>
            </div>
          </div>
          {user ? (
<button
  onClick={() => setShowForm(!showForm)}
  className="h-10 px-6 bg-[#FF5CA1] hover:bg-[#ff4392] text-white text-xs font-bold rounded-full cursor-pointer hover:scale-[1.03] active:scale-[0.98] transition-all duration-200 self-start shadow-[0_0_20px_rgba(255,92,161,0.35)] tracking-wide uppercase font-mono"
>
  {showForm ? "Close" : "Publish+"}
</button>
          ) : (
            <p className="text-x text-[#7A7365] font-mono">
              <a href="/login" className="text-[#FF5CA1] underline underline-offset-2">
                Autentifica-te
              </a>{" "}
              pentru a publica.
            </p>
          )}
        </div>

        <div className="max-w-6xl mx-auto px-6 mt-6">
          <form onSubmit={runSearch} className="flex gap-2">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Cauta dupa titlu sau descriere..."
              className="flex-1 h-10 bg-white border border-black/10 rounded-full px-4 text-xs outline-none focus:border-[#B4592F]/50 text-[#1C1A16]"
            />
            <button
              type="submit"
              className="h-10 px-5 bg-[#1C1A16] text-white text-xs rounded-full cursor-pointer hover:bg-[#33302A] transition-colors"
            >
              Cauta
            </button>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={
                showAdvanced
                  ? "h-10 px-4 text-xs rounded-full border bg-[#1C1A16] text-white border-[#1C1A16] transition-colors"
                  : "h-10 px-4 text-xs rounded-full border bg-white text-[#1C1A16] border-black/10 transition-colors"
              }
            >
              Filtre
            </button>
          </form>

          {showAdvanced && (
            <div className="mt-3 bg-white border border-black/5 rounded-2xl p-4 flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-[9px] font-mono uppercase text-[#9A907C] mb-1">
                  Pret minim
                </label>
                <input
                  type="number"
                  value={priceMin}
                  onChange={(e) => setPriceMin(e.target.value)}
                  placeholder="0"
                  className="w-24 h-9 bg-[#F7F6F3] border border-black/10 rounded-lg px-2 text-xs outline-none focus:border-[#B4592F]/50"
                />
              </div>
              <div>
                <label className="block text-[9px] font-mono uppercase text-[#9A907C] mb-1">
                  Pret maxim
                </label>
                <input
                  type="number"
                  value={priceMax}
                  onChange={(e) => setPriceMax(e.target.value)}
                  placeholder="9999"
                  className="w-24 h-9 bg-[#F7F6F3] border border-black/10 rounded-lg px-2 text-xs outline-none focus:border-[#B4592F]/50"
                />
              </div>
              <div>
                <label className="block text-[9px] font-mono uppercase text-[#9A907C] mb-1">
                  Tara
                </label>
                <input
                  type="text"
                  value={countryFilter}
                  onChange={(e) => setCountryFilter(e.target.value)}
                  placeholder="ex: Romania"
                  className="w-32 h-9 bg-[#F7F6F3] border border-black/10 rounded-lg px-2 text-xs outline-none focus:border-[#B4592F]/50"
                />
              </div>
              <div>
                <label className="block text-[9px] font-mono uppercase text-[#9A907C] mb-1">
                  Sorteaza
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="h-9 bg-[#F7F6F3] border border-black/10 rounded-lg px-2 text-xs outline-none focus:border-[#B4592F]/50"
                >
                  <option value="newest">Cele mai noi</option>
                  <option value="price_asc">Pret crescator</option>
                  <option value="price_desc">Pret descrescator</option>
                </select>
              </div>
              <button
                type="button"
                onClick={resetFilters}
                className="h-9 px-3 text-[10px] font-mono text-[#9A907C] hover:text-[#1C1A16] cursor-pointer"
              >
                Reseteaza filtrele
              </button>
            </div>
          )}
        </div>

        <div className="max-w-6xl mx-auto px-6 mt-4 flex gap-2">
          {(["all", "instrument", "preset"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={
                filter === f
                  ? "h-8 px-4 text-[11px] rounded-full border bg-[#1C1A16] text-[#FFFFFF] border-[#1C1A16] transition-colors"
                  : "h-8 px-4 text-[11px] rounded-full border bg-transparent text-[#7A7365] border-black/10 hover:border-black/20 transition-colors"
              }
            >
              {f === "all" ? "Toate" : f === "instrument" ? "Instrumente" : "Preset-uri"}
            </button>
          ))}
        </div>
      </div>

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10 space-y-8">
        {error && (
          <div className="p-3 bg-[#B4592F]/10 border border-[#B4592F]/20 text-xs text-[#B4592F] rounded-xl font-mono flex justify-between items-center">
            <span>Eroare: {error}</span>
            <button onClick={() => setError("")} className="text-[#B4592F] cursor-pointer">
              {"\u2715"}
            </button>
          </div>
        )}

        {showForm && user && (
          <div
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowForm(false)}
          >
          <form
            onSubmit={handleSubmitListing}
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-black/5 rounded-2xl p-6 space-y-4 max-w-xl w-full max-h-[88vh] overflow-y-auto shadow-xl relative"
          >
            <div className="flex items-center justify-between sticky -top-6 -mt-6 pt-6 pb-1 bg-white z-10">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#9A907C]">
                  Anunt nou
                </p>
                <h2 className="text-lg font-serif text-[#1C1A16]">Publica pe iMIDI Market</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="w-8 h-8 rounded-full bg-[#F7F6F3] flex items-center justify-center cursor-pointer hover:bg-black/5 shrink-0"
              >
                {"\u2715"}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Titlu"
                className="w-full h-10 bg-[#F7F6F3] border border-black/10 rounded-xl px-3 text-xs outline-none focus:border-[#B4592F]/50 text-[#1C1A16]"
              />
              <input
                type="number"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Pret (EUR)"
                className="w-full h-10 bg-[#F7F6F3] border border-black/10 rounded-xl px-3 text-xs outline-none focus:border-[#B4592F]/50 text-[#1C1A16]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCategory("instrument")}
                className={
                  category === "instrument"
                    ? "h-9 text-xs rounded-xl border bg-[#1C1A16] text-[#FFFFFF] border-[#1C1A16] transition-colors"
                    : "h-9 text-xs rounded-xl border bg-[#F7F6F3] text-[#1C1A16] border-black/10 transition-colors"
                }
              >
                Instrument
              </button>
              <button
                type="button"
                onClick={() => setCategory("preset")}
                className={
                  category === "preset"
                    ? "h-9 text-xs rounded-xl border bg-[#1C1A16] text-[#FFFFFF] border-[#1C1A16] transition-colors"
                    : "h-9 text-xs rounded-xl border bg-[#F7F6F3] text-[#1C1A16] border-black/10 transition-colors"
                }
              >
                Preset
              </button>
            </div>

            <textarea
              rows={3}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descriere..."
              className="w-full bg-[#F7F6F3] border border-black/10 rounded-xl p-3 text-xs outline-none focus:border-[#B4592F]/50 text-[#1C1A16] resize-none"
            />

            {/* upload poze, una cate una */}
            <div>
              <label className="block text-[9px] font-mono uppercase text-[#9A907C] mb-2">
                Poze ({imageFiles.length}/{MAX_IMAGES})
              </label>
              <div className="grid grid-cols-4 gap-2">
                {imagePreviews.map((src, i) => (
                  <div key={i} className="relative h-16 rounded-lg overflow-hidden border border-black/10 group">
                    <img src={src} alt="preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/70 text-white text-[9px] rounded-full flex items-center justify-center cursor-pointer"
                    >
                      {"\u2715"}
                    </button>
                  </div>
                ))}
                {imageFiles.length < MAX_IMAGES && (
                  <label className="h-16 rounded-lg border border-dashed border-black/20 flex items-center justify-center cursor-pointer text-[9px] text-[#9A907C] font-mono hover:border-[#B4592F]/50">
                    + poza
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
              <p className="text-[10px] text-[#9A907C] mt-1 font-mono">
                Adauga poze una cate una, maxim {MAX_IMAGES}.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Telefon (optional)"
                className="w-full h-10 bg-[#F7F6F3] border border-black/10 rounded-xl px-3 text-xs outline-none focus:border-[#B4592F]/50 text-[#1C1A16]"
              />
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="Email (optional)"
                className="w-full h-10 bg-[#F7F6F3] border border-black/10 rounded-xl px-3 text-xs outline-none focus:border-[#B4592F]/50 text-[#1C1A16]"
              />
            </div>

            {category === "instrument" && (
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="Tara"
                  className="w-full h-10 bg-[#F7F6F3] border border-black/10 rounded-xl px-3 text-xs outline-none focus:border-[#B4592F]/50 text-[#1C1A16]"
                />
                <input
                  type="text"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  placeholder="Regiune / oras"
                  className="w-full h-10 bg-[#F7F6F3] border border-black/10 rounded-xl px-3 text-xs outline-none focus:border-[#B4592F]/50 text-[#1C1A16]"
                />
              </div>
            )}

            {category === "preset" && (
              <div>
                <input
                  type="text"
                  value={digitalLink}
                  onChange={(e) => setDigitalLink(e.target.value)}
                  placeholder="Link digital (optional, il poti adauga si mai tarziu)"
                  className="w-full h-10 bg-[#F7F6F3] border border-black/10 rounded-xl px-3 text-xs outline-none focus:border-[#B4592F]/50 text-[#1C1A16]"
                />
                <p className="text-[10px] text-[#9A907C] mt-1 font-mono">
                  Poti lasa gol acum si il editezi ulterior din card.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || uploading}
              className="w-full h-10 bg-[#B4592F] text-white text-xs font-bold rounded-xl disabled:opacity-30 cursor-pointer hover:bg-[#9C4A26] transition-colors"
            >
              {uploading ? "Se incarca pozele..." : loading ? "Se publica..." : "Publica"}
            </button>
          </form>
          </div>
        )}

        {loading && listings.length === 0 ? (
          <p className="text-center text-xs text-[#9A907C] font-mono py-16">Se incarca...</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {listings.map((item) => (
              <div
                key={item.id}
                onClick={() => openListing(item)}
                className="bg-white border border-black/5 rounded-2xl overflow-hidden flex flex-col group hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer"
              >
                <div className="h-44 bg-[#F7F6F3] relative flex items-center justify-center border-b border-black/5">
                  {item.images.length > 0 ? (
                    <img
                      src={item.images[0]}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[10px] text-[#9A907C] font-mono">Fara imagine</span>
                  )}
                  <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-full text-[9px] bg-white/90 border border-black/5 text-[#7A7365] font-mono uppercase tracking-wide">
                    {item.category}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => shareListing(item, e)}
                    aria-label="Distribuie anuntul"
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 border border-black/5 flex items-center justify-center cursor-pointer hover:bg-white"
                  >
                    {shareFeedbackId === item.id ? (
                      <span className="text-[8px] font-mono text-[#B4592F]">OK</span>
                    ) : (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="18" cy="5" r="3" stroke="#1C1A16" strokeWidth="1.6" />
                        <circle cx="6" cy="12" r="3" stroke="#1C1A16" strokeWidth="1.6" />
                        <circle cx="18" cy="19" r="3" stroke="#1C1A16" strokeWidth="1.6" />
                        <path d="M8.6 10.5L15.4 6.5M8.6 13.5L15.4 17.5" stroke="#1C1A16" strokeWidth="1.6" strokeLinecap="round" />
                      </svg>
                    )}
                  </button>
                  <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-lg text-xs font-mono font-bold bg-[#1C1A16] text-[#FFFFFF]">
                    {"\u20AC"}{item.price}
                  </span>
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-semibold text-[#1C1A16] group-hover:text-[#B4592F] transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-[11px] text-[#7A7365] line-clamp-2 leading-relaxed mt-1">
                      {item.description}
                    </p>
                    {item.category === "instrument" && (item.country || item.region) && (
                      <p className="text-[10px] text-[#9A907C] font-mono mt-1">
                        {[item.region, item.country].filter(Boolean).join(", ")}
                      </p>
                    )}
                  </div>
                  <div className="text-[9px] font-mono text-[#9A907C]">
                    Expira in 15 zile {"\u00b7"} vezi detalii
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && listings.length === 0 && (
          <p className="text-center text-xs text-[#9A907C] font-mono py-16">
            Niciun anunt gasit pentru criteriile alese.
          </p>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-4">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="h-9 px-3 text-xs rounded-full border border-black/10 bg-white disabled:opacity-30 cursor-pointer hover:border-black/20"
            >
              Anterior
            </button>
            <span className="text-xs font-mono text-[#7A7365]">
              Pagina {page} din {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="h-9 px-3 text-xs rounded-full border border-black/10 bg-white disabled:opacity-30 cursor-pointer hover:border-black/20"
            >
              Urmator
            </button>
          </div>
        )}
      </main>

      {/* modal detalii anunt */}
      {selectedListing && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={closeModal}
        >
          <div
            className="bg-[#F7F6F3] rounded-2xl max-w-2xl w-full max-h-[88vh] overflow-y-auto shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative">
              <div className="h-64 bg-[#F7F6F3] flex items-center justify-center">
                {selectedListing.images.length > 0 ? (
                  <img
                    src={selectedListing.images[activeImage]}
                    alt={selectedListing.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xs text-[#9A907C] font-mono">Fara imagine</span>
                )}
              </div>
              <button
                type="button"
                onClick={(e) => shareListing(selectedListing, e)}
                aria-label="Distribuie anuntul"
                className="absolute top-3 right-14 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center cursor-pointer hover:bg-white"
              >
                {shareFeedbackId === selectedListing.id ? (
                  <span className="text-[9px] font-mono text-[#B4592F]">OK</span>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="18" cy="5" r="3" stroke="#1C1A16" strokeWidth="1.6" />
                    <circle cx="6" cy="12" r="3" stroke="#1C1A16" strokeWidth="1.6" />
                    <circle cx="18" cy="19" r="3" stroke="#1C1A16" strokeWidth="1.6" />
                    <path d="M8.6 10.5L15.4 6.5M8.6 13.5L15.4 17.5" stroke="#1C1A16" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                )}
              </button>
              <button
                onClick={closeModal}
                className="absolute top-3 right-3 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center cursor-pointer hover:bg-white"
              >
                {"\u2715"}
              </button>
              {selectedListing.images.length > 1 && (
                <div className="flex gap-2 p-3 bg-white/60">
                  {selectedListing.images.map((src, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveImage(i)}
                      className={
                        i === activeImage
                          ? "w-14 h-14 rounded-lg overflow-hidden border-2 border-[#B4592F]"
                          : "w-14 h-14 rounded-lg overflow-hidden border border-black/10 opacity-70"
                      }
                    >
                      <img src={src} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[9px] font-mono uppercase tracking-wide text-[#9A907C]">
                    {selectedListing.category}
                  </span>
                  <h2 className="text-xl font-serif text-[#1C1A16]">{selectedListing.title}</h2>
                  {selectedListing.category === "instrument" &&
                    (selectedListing.country || selectedListing.region) && (
                      <p className="text-xs text-[#9A907C] font-mono mt-0.5">
                        {[selectedListing.region, selectedListing.country].filter(Boolean).join(", ")}
                      </p>
                    )}
                </div>
                <span className="px-3 py-1 rounded-lg text-sm font-mono font-bold bg-[#1C1A16] text-[#FFFFFF] whitespace-nowrap">
                  {"\u20AC"}{selectedListing.price}
                </span>
              </div>

              <p className="text-xs text-[#4A463D] leading-relaxed whitespace-pre-wrap">
                {selectedListing.description}
              </p>

              {/* contact */}
              <div className="bg-white border border-black/5 rounded-xl p-4 flex flex-wrap gap-4">
                {selectedListing.phone && (
                  <a
                    href={"tel:" + selectedListing.phone}
                    className="text-xs text-[#B4592F] font-mono flex items-center gap-1.5"
                  >
                    {"\u260E"} {selectedListing.phone}
                  </a>
                )}
                {selectedListing.email && (
                  <a
                    href={"mailto:" + selectedListing.email}
                    className="text-xs text-[#B4592F] font-mono flex items-center gap-1.5"
                  >
                    {"\u2709"} {selectedListing.email}
                  </a>
                )}
                {!selectedListing.phone && !selectedListing.email && (
                  <span className="text-xs text-[#9A907C] font-mono">
                    Vanzatorul nu a lasat date de contact.
                  </span>
                )}
              </div>

              {/* link digital preset */}
              {selectedListing.category === "preset" && (
                <div className="bg-white border border-black/5 rounded-xl p-4">
                  {editingLinkId === selectedListing.id ? (
                    <div className="flex gap-2">
                      <input
                        autoFocus
                        value={editLinkValue}
                        onChange={(e) => setEditLinkValue(e.target.value)}
                        placeholder="https://..."
                        className="flex-1 h-9 bg-[#F7F6F3] border border-black/10 rounded-lg px-2 text-xs outline-none focus:border-[#B4592F]/50"
                      />
                      <button
                        onClick={() => saveDigitalLink(selectedListing.id)}
                        className="h-9 px-3 bg-[#1C1A16] text-white text-xs rounded-lg cursor-pointer"
                      >
                        Salveaza
                      </button>
                    </div>
                  ) : selectedListing.digital_link ? (
                    <div className="flex items-center justify-between gap-2">
                      <a
                        href={selectedListing.digital_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[#B4592F] underline underline-offset-2"
                      >
                        Descarca / Link digital
                      </a>
                      {user?.id === selectedListing.user_id && (
                        <button
                          onClick={() => startEditLink(selectedListing)}
                          className="text-[10px] text-[#9A907C] font-mono cursor-pointer hover:text-[#1C1A16]"
                        >
                          editeaza
                        </button>
                      )}
                    </div>
                  ) : user?.id === selectedListing.user_id ? (
                    <button
                      onClick={() => startEditLink(selectedListing)}
                      className="text-xs text-[#9A907C] font-mono cursor-pointer hover:text-[#1C1A16]"
                    >
                      + adauga link digital
                    </button>
                  ) : (
                    <span className="text-xs text-[#9A907C] font-mono">
                      Link-ul digital va fi disponibil dupa cumparare.
                    </span>
                  )}
                </div>
              )}

              {/* reviews */}
              <div className="pt-4 border-t border-black/10 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-[#7A7365]">
                    Review-uri ({reviews.length})
                  </h3>
                  {reviews.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <StarRow value={Math.round(averageRating)} />
                      <span className="text-[10px] text-[#9A907C] font-mono">
                        {averageRating.toFixed(1)}
                      </span>
                    </div>
                  )}
                </div>

                {reviewsLoading ? (
                  <p className="text-xs text-[#9A907C] font-mono">Se incarca...</p>
                ) : reviews.length === 0 ? (
                  <p className="text-xs text-[#9A907C] font-mono">Niciun review inca.</p>
                ) : (
                  <div className="space-y-3">
                    {reviews.map((r) => (
                      <div key={r.id} className="bg-white border border-black/5 rounded-xl p-3">
                        <StarRow value={r.rating} />
                        {r.comment && (
                          <p className="text-xs text-[#4A463D] mt-1.5 leading-relaxed">{r.comment}</p>
                        )}
                        <p className="text-[9px] text-[#9A907C] font-mono mt-1">
                          {new Date(r.created_at).toLocaleDateString("ro-RO")}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {user ? (
                  <form onSubmit={submitReview} className="bg-white border border-black/5 rounded-xl p-4 space-y-2">
                    <p className="text-[10px] font-mono uppercase text-[#9A907C]">
                      Lasa un review
                    </p>
                    <StarRow value={myRating} onChange={setMyRating} />
                    <textarea
                      rows={2}
                      value={myComment}
                      onChange={(e) => setMyComment(e.target.value)}
                      placeholder="Comentariul tau (optional)"
                      className="w-full bg-[#F7F6F3] border border-black/10 rounded-lg p-2 text-xs outline-none focus:border-[#B4592F]/50 resize-none"
                    />
                    <button
                      type="submit"
                      disabled={submittingReview}
                      className="h-9 px-4 bg-[#B4592F] text-white text-xs rounded-lg disabled:opacity-30 cursor-pointer hover:bg-[#9C4A26]"
                    >
                      {submittingReview ? "Se salveaza..." : "Trimite review"}
                    </button>
                  </form>
                ) : (
                  <p className="text-xs text-[#9A907C] font-mono">
                    <a href="/login" className="text-[#B4592F] underline underline-offset-2">
                      Autentifica-te
                    </a>{" "}
                    pentru a lasa un review.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}