"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { isPromoted } from "@/lib/promotion"; // NOU: helper de promovare
import { listenToNewListings } from "@/lib/notify";


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
  views_count: number;
  promoted_until: string | null; // NOU
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

  ///// ai mod 
  const [aiKeywords, setAiKeywords] = useState("");
const [aiLoading, setAiLoading] = useState(false);
const [aiError, setAiError] = useState("");
const [showAiPanel, setShowAiPanel] = useState(false);
const smith_version = "v0.2.2613"; // versiunea curenta a asistentului AI Smith
const generateWithAI = async () => {
  if (aiKeywords.trim().length < 3) {
    setAiError("Scrie cateva cuvinte despre ce vinzi.");
    return;
  }
  setAiLoading(true);
  setAiError("");
  try {
    const res = await fetch("/api/ai/generate-listing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keywords: aiKeywords, category, price }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Eroare la generare.");
    setTitle(data.title);
    setDescription(data.description);
    setShowAiPanel(false);
    setAiKeywords("");
  } catch (err: any) {
    setAiError(err.message);
  } finally {
    setAiLoading(false);
  }
};

///////////////////////////////////////////////   search AI smith ///////////////////////////////////
  // ---- AI SMITH SEARCH MOD (NOU) ----
  const [aiSearchInput, setAiSearchInput] = useState("");
  const [aiSearchLoading, setAiSearchLoading] = useState(false);
  const [aiSearchFeedback, setAiSearchFeedback] = useState("");
   // Controler dedicat pentru comutarea tab-urilor de căutare
  const [searchMode, setSearchMode] = useState<"classic" | "ai">("classic");

  const handleAiSmithSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (aiSearchInput.trim().length < 4) {
      setAiSearchFeedback("Scrie o cerință mai clară (ex: clape ieftine sau preset techno).");
      return;
    }

    setAiSearchLoading(true);
    setAiSearchFeedback("Smith configurează filtrele în rețea...");
    
    try {
      const res = await fetch("/api/ai/search-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiSearchInput.trim() }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Eroare la procesare.");

      // Aplicăm instant filtrele returnate de Llama-3 în stările tale existente din pagină
      if (data.category) setFilter(data.category); // 'all' | 'instrument' | 'preset'
      
      if (data.keyword !== undefined) {
        setSearchInput(data.keyword);
        setSearchQuery(data.keyword);
      }
      
      // Dacă AI-ul găsește prețuri, le pune, dacă nu, le resetează ca să nu blocheze căutarea
      setPriceMax(data.priceMax !== null ? data.priceMax.toString() : "");
      setPriceMin(data.priceMin !== null ? data.priceMin.toString() : "");
      
      setAiSearchFeedback(`Filtre aplicate cu succes pentru: "${aiSearchInput.trim()}"`);
      setAiSearchInput(""); // Ștergem textul din bară după execuție
    } catch (err: any) {
      setAiSearchFeedback(`Smith nu a înțeles perfect textul. Încearcă o căutare normală.`);
      console.error(err.message);
    } finally {
      setAiSearchLoading(false);
    }
  };

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


useEffect(() => {
  // Pornim ascultătorul din Supabase
  const channel = listenToNewListings();

  // Funcția care se execută când evenimentul global se declanșează
  const handleNewListing = (e: Event) => {
    const listing = (e as CustomEvent).detail;
    
    // În loc de fetchListings, forțăm o reîmprospătare curată a datelor prin URL sau window
    window.location.reload(); 
    
    // Alerta vizuală
    alert(`🔥 Anunț Nou: ${listing.title} la doar €${listing.price}!`);
  };

  // Ascultăm evenimentul global pe fereastră
  window.addEventListener("imidi-new-listing", handleNewListing);

  return () => {
    if (channel) supabase.removeChannel(channel);
    window.removeEventListener("imidi-new-listing", handleNewListing);
  };
}, []);



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
          openListing(data as Listing);
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

    // NOU: anunturile promovate (promoted_until in viitor) apar mereu primele
    query = query.order("promoted_until", { ascending: false, nullsFirst: false });

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

  // ---- modal + reviews + views counter ----
  const openListing = async (item: Listing) => {
    setSelectedListing(item);
    setActiveImage(0);
    setMyRating(0);
    setMyComment("");
    setReviewsLoading(true);

    // incrementam contorul de vizualizari (fire-and-forget, nu blocam UI-ul)
    supabase.rpc("increment_listing_views", { listing_id_param: item.id }).then(() => {
      setSelectedListing((prev) =>
        prev && prev.id === item.id ? { ...prev, views_count: (prev.views_count || 0) + 1 } : prev
      );
      setListings((prev) =>
        prev.map((l) => (l.id === item.id ? { ...l, views_count: (l.views_count || 0) + 1 } : l))
      );
    });

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
    const url = window.location.origin + "/e-market/listing/" + item.id;

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
      const idToReload = selectedListing.id;
      const current = listings.find((l) => l.id === idToReload) || selectedListing;
      await openListing(current);
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

  const EyeIcon = ({ size = 12 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M2 12C2 12 5.5 5 12 5C18.5 5 22 12 22 12C22 12 18.5 19 12 19C5.5 19 2 12 2 12Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );

  return (
    <div className="bg-[#FFFFFF] text-[#1C1A16] min-h-screen flex flex-col antialiased relative">
      <Navbar />

      <div className="border-b border-black/5 pt-36 pb-10 bg-[#F7F6F3]">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row justify-between sm:items-end gap-4">
         <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b border-[#EADCC6] pb-8 mb-8">
  <div className="flex items-center gap-4">
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://w3.org"
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
        www.imidi.co.uk
      </p>
      <h1 className="text-3xl font-serif tracking-tight text-[#1C1A16]">E-Market</h1>
      <p className="text-sm text-[#7A7365] mt-1">
        The platform dedicated to selling and buying music instruments, presets, soundbanks, 
        and scripts for artists and producers adapted to modern life. Asistat by AI Smith can sell digital products or physical instruments, and you can also buy from other artists.
        Single platform that inovated the way artists and producers can sell and buy music instruments, presets, soundbanks, and scripts supported by Cloud. The publish is free for 14 days
        and after that you can choose to promote your listing for a small fee. 
      </p>
    </div>
  </div>

  {/* BUTONUL REVOLUT DE PROMOVARE */}
<div className="shrink-0 w-full sm:w-auto relative group">
  {/* Efectul de fundal animat (Glow) pe galben-perlă */}
  <div className="absolute -inset-0.5 bg-gradient-to-r from-[#F2C94C] to-[#3A7BD5] rounded-md blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200 animate-pulse" />
  
  <a
    href="https://revolut.me/mariusvalentin_b"
    target="_blank"
    rel="noopener noreferrer"
    className="relative flex sm:inline-flex items-center justify-between sm:justify-center gap-3 bg-[#0B1528] hover:bg-[#11203D] text-[#F2C94C] font-sans text-xs font-medium tracking-wide px-5 py-3 rounded-md border border-[#F2C94C]/30 transition-all duration-300 w-full sm:w-auto overflow-hidden"
  >
    {/* Linie strălucitoare care trece peste buton la hover */}
    <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white/10 opacity-40 group-hover:animate-shine" />

    <div className="flex flex-col text-left sm:text-center">
      <span className="font-bold uppercase tracking-widest text-[11px] flex items-center gap-1.5">
        {/* Sparkle Icon animat */}
        <svg className="w-3.5 h-3.5 animate-spin [animation-duration:6s] text-[#F2C94C]" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2l2.4 7.2L22 11.6l-7.6 2.4L12 22l-2.4-7.2L2 11.6l7.6-2.4z"/>
        </svg>
        Promovează Anunțul
      </span>
      <span className="text-[10px] text-[#7E8FAD] group-hover:text-[#F2C94C]/80 transition-colors mt-0.5">
        6 EUR / 45 zile via Revolut
      </span>
    </div>
    
    {/* Săgeată discretă care se mișcă la hover */}
    <svg 
      width="14" 
      height="14" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      className="transform transition-transform duration-300 group-hover:translate-x-1"
    >
      <path d="M5 12h14M12 5l7 7-7 7"/>
    </svg>
  </a>
</div>

</div>

          {user ? (
<button
  onClick={() => setShowForm(!showForm)}
  className="group h-10 px-6 bg-gradient-to-r from-[#FF5CA1] to-[#ff4392] text-white text-xs font-bold rounded-xl cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 self-start shadow-[0_4px_20px_rgba(255,92,161,0.35)] border border-white/10 tracking-wide uppercase font-mono flex items-center gap-2"
>
  {showForm ? (
    <>
      <span className="transition-transform duration-300 group-hover:rotate-90">✕</span>
      Close
    </>
  ) : (
    <>
      <span className="animate-pulse transition-transform duration-500 group-hover:rotate-180">✦</span>
      Publish+
    </>
  )}
</button>
          ) : (
            <p className="text-x text-[#7A7365] font-mono">
              <a href="/login" className="text-[#FF5CA1] underline underline-offset-2">
               Autentication
              </a>{" "}
              to publish your products and start selling on iMIDI Market.
            </p>
          )}
        </div>

       <div className="max-w-6xl mx-auto px-6 mt-6">


<div className="w-full space-y-3 px-1 sm:px-0">
  {/* Selector de Mod: Clasic vs AI Smith (Responsive & Touch-friendly pe mobil) */}
  <div className="flex gap-4 px-1 select-none border-b border-zinc-100 pb-1">
    <button
      type="button"
      onClick={() => setSearchMode("classic")}
      className={`text-[10px] font-bold uppercase tracking-wider transition-colors pb-1.5 ${
        searchMode === "classic" ? "text-[#1C1A16] border-b-2 border-[#1C1A16]" : "text-zinc-400 hover:text-zinc-600"
      }`}
    >
      Clasical search
    </button>
    <button
      type="button"
      onClick={() => setSearchMode("ai")}
      className={`text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1 pb-1.5 ${
        searchMode === "ai" ? "text-pink-600 border-b-2 border-pink-500" : "text-zinc-400 hover:text-pink-500"
      }`}
    >
      <span className="animate-pulse">✦</span> AI Smith Search
    </button>
  </div>

  {/* Formularul Unic - RECONSTRUIT RESPONSIVE (flex-col pe mobil, flex-row pe desktop) */}
  <form 
    onSubmit={searchMode === "ai" ? handleAiSmithSearch : runSearch} 
    className="flex flex-col md:flex-row gap-2.5 w-full"
  >
    {/* Input-ul ocupă lungimea maximă pe orice ecran */}
    <div className="flex-1 relative group w-full">
      <span className={`absolute inset-y-0 left-4 flex items-center transition-colors pointer-events-none ${
        searchMode === "ai" 
          ? "text-pink-400 group-focus-within:text-pink-500" 
          : "text-slate-400 group-focus-within:text-[#B4592F]"
      }`}>
        {searchMode === "ai" ? (
          <svg viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" fill="none" className={`w-4 h-4 ${aiSearchLoading ? "animate-spin" : ""}`}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 21l-.813-5.096L3 15.187l5.096-.813L9 9.313l.813 5.061 5.096.813-5.096.813ZM19.071 9.142 18.5 12l-.571-2.858L15 8.571l2.929-.571L18.5 5l.571 2.929L22 8.571l-2.929.571ZM11.44 3.44 11 4.5l-.44-1.06L9.5 3l1.06-.44L11 1.5l.44 1.06L12.5 3l-1.06.44Z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" fill="none" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.603 10.601Z" />
          </svg>
        )}
      </span>

      <input
        type="text"
        value={searchMode === "ai" ? aiSearchInput : searchInput}
        onChange={(e) => {
          if (searchMode === "ai") {
            setAiSearchInput(e.target.value);
          } else {
            setSearchInput(e.target.value);
          }
        }}
        placeholder={
          searchMode === "ai" 
            ? "Spune-i lui AI Smith ce cauți... (ex: preset tehno sub 30€)" 
            : "Cauta dupa titlu sau descriere..."
        }
        className={`w-full h-12 bg-white border rounded-2xl pl-11 pr-4 text-xs outline-none shadow-sm transition-all ${
          searchMode === "ai" 
            ? "border-pink-200 focus:border-pink-500/50 hover:border-pink-300 text-zinc-900 font-medium" 
            : "border-black/10 focus:border-[#B4592F]/50 text-[#1C1A16] hover:border-black/20"
        } focus:shadow-md`}
      />
    </div>

    {/* Zonă de butoane: pe mobil stau 50/50 pe un singur rând compact */}
    <div className="flex gap-2 w-full md:w-auto">
      {/* Buton Căutare / Smith */}
      <button
        type="submit"
        disabled={searchMode === "ai" && aiSearchLoading}
        className={`flex-1 md:flex-none h-12 px-6 text-xs font-semibold rounded-2xl cursor-pointer active:scale-[0.98] shadow-sm transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
          searchMode === "ai" 
            ? "bg-gradient-to-r from-pink-500 to-rose-500 text-white hover:opacity-95 shadow-pink-500/10 hover:shadow-md hover:shadow-pink-500/20" 
            : "bg-[#1C1A16] text-white hover:bg-[#33302A]"
        }`}
      >
        {searchMode === "ai" && (
          <svg viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" fill="none" className={`w-3.5 h-3.5 ${aiSearchLoading ? "animate-spin" : ""}`}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 21l-.813-5.096L3 15.187l5.096-.813L9 9.313l.813 5.061 5.061-.813L9 9.313l.813 5.061 5.096.813-5.096.813ZM19.071 9.142 18.5 12l-.571-2.858L15 8.571l2.929-.571L18.5 5l.571 2.929L22 8.571l-2.929.571ZM11.44 3.44 11 4.5l-.44-1.06L9.5 3l1.06-.44L11 1.5l.44 1.06L12.5 3l-1.06.44Z" />
          </svg>
        )}
        <span>{searchMode === "ai" ? (aiSearchLoading ? "Searching..." : "Smith search") : "Search"}</span>
      </button>

      {/* Buton Filtre Avansate */}
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className={
          showAdvanced
            ? "flex-1 md:flex-none h-12 px-5 text-xs font-semibold rounded-xl border bg-[#1C1A16] text-white border-[#1C1A16] active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
            : "flex-1 md:flex-none h-12 px-5 text-xs font-semibold rounded-xl border bg-white text-[#1C1A16] border-black/10 hover:bg-slate-50 hover:border-black/20 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-sm"
        }
      >
        <svg viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" fill="none" className="w-3.5 h-3.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
        </svg>
        Filtre
      </button>
    </div>
  </form>

  {/* Text de feedback AI */}
  {searchMode === "ai" && aiSearchFeedback && (
    <p className="text-[10px] text-pink-600/90 font-medium px-2 tracking-wide flex items-center gap-1 animate-fade-in">
      <span className="inline-block animate-pulse">✦</span> {aiSearchFeedback}
    </p>
  )}
</div>



  {showAdvanced && (
    /* Adăugat o tranziție de fade-in discretă și umbră mai fină pentru panou */
    <div className="mt-3 bg-white border border-black/5 rounded-2xl p-5 flex flex-wrap gap-4 items-end shadow-md animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex-1 min-w-[100px]">
        <label className="block text-[9px] font-mono uppercase tracking-wider text-[#9A907C] mb-1.5">
          Pret minim
        </label>
        <div className="relative">
          <input
            type="number"
            value={priceMin}
            onChange={(e) => setPriceMin(e.target.value)}
            placeholder="0"
            className="w-full h-10 bg-[#F7F6F3] border border-black/5 rounded-xl pl-3 pr-7 text-xs outline-none focus:bg-white focus:border-[#B4592F]/50 transition-all"
          />
          <span className="absolute inset-y-0 right-3 flex items-center text-[10px] font-semibold text-slate-400">$</span>
        </div>
      </div>

      <div className="flex-1 min-w-[100px]">
        <label className="block text-[9px] font-mono uppercase tracking-wider text-[#9A907C] mb-1.5">
          Pret maxim
        </label>
        <div className="relative">
          <input
            type="number"
            value={priceMax}
            onChange={(e) => setPriceMax(e.target.value)}
            placeholder="9999"
            className="w-full h-10 bg-[#F7F6F3] border border-black/5 rounded-xl pl-3 pr-7 text-xs outline-none focus:bg-white focus:border-[#B4592F]/50 transition-all"
          />
          <span className="absolute inset-y-0 right-3 flex items-center text-[10px] font-semibold text-slate-400">$</span>
        </div>
      </div>

      <div className="flex-[1.5] min-w-[140px]">
        <label className="block text-[9px] font-mono uppercase tracking-wider text-[#9A907C] mb-1.5">
          Tara
        </label>
        <input
          type="text"
          value={countryFilter}
          onChange={(e) => setCountryFilter(e.target.value)}
          placeholder="ex: Romania"
          className="w-full h-10 bg-[#F7F6F3] border border-black/5 rounded-xl px-3 text-xs outline-none focus:bg-white focus:border-[#B4592F]/50 transition-all"
        />
      </div>

      <div className="flex-[1.5] min-w-[140px]">
        <label className="block text-[9px] font-mono uppercase tracking-wider text-[#9A907C] mb-1.5">
          Sorteaza
        </label>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="w-full h-10 bg-[#F7F6F3] border border-black/5 rounded-xl px-3 text-xs outline-none focus:bg-white focus:border-[#B4592F]/50 transition-all cursor-pointer appearance-none"
        >
          <option value="newest">Cele mai noi</option>
          <option value="price_asc">Pret crescator</option>
          <option value="price_desc">Pret descrescator</option>
        </select>
      </div>

      <button
        type="button"
        onClick={resetFilters}
        className="h-10 px-4 text-[10px] font-mono text-[#9A907C] hover:text-rose-500 rounded-xl hover:bg-rose-50 transition-all cursor-pointer flex items-center gap-1 shrink-0"
      >
        {/* Iconiță X pentru resetare filtru */}
        <svg viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" className="w-3 h-3">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
        Reseteaza
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
                Instrument/serviciu
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
                placeholder="Telefon "
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

                {/* Genereaza titlu + descriere cu AI Smith */}
<div className="bg-[#F7F6F3] border border-dashed border-[#B4592F]/30 rounded-xl p-3 space-y-2">
  {/* PRIMUL BUTON (Deschidere panou): Acum complet RESPONSIVE (w-full sm:w-auto) */}
  <button
    type="button"
    onClick={() => setShowAiPanel(!showAiPanel)}
    className="flex items-center justify-center sm:justify-start gap-2 h-8 px-3 rounded-full bg-gradient-to-r from-[#FF5CA1] to-[#ff4392] text-white text-[11px] font-semibold cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_2px_10px_rgba(255,92,161,0.35)] w-full sm:w-auto"
  >
    <span className="animate-pulse shrink-0">{"\u2726"}</span>
    <span className="truncate">Generate title and description</span>
    <span className="px-1.5 py-0.5 rounded-full bg-white/25 text-[9px] font-bold tracking-wide shrink-0">
      Smith AI
    </span>
  </button>

  {showAiPanel && (
    <div className="space-y-2">
      <textarea
        rows={2}
        value={aiKeywords}
        onChange={(e) => setAiKeywords(e.target.value)}
        placeholder="Scrie pe scurt ce vinzi: model, stare, ce include... (ex: Roland Fantom 8, putin folosit, cutie originala)"
        className="w-full bg-white border border-black/10 rounded-lg p-2 text-xs outline-none focus:border-[#B4592F]/50 resize-none"
      />
      {aiError && <p className="text-[10px] text-red-500">{aiError}</p>}
      
      {/* AL DOILEA BUTON (Generare finală): Efect WOW și complet RESPONSIVE (w-full sm:w-auto) */}
      <button
        type="button"
        onClick={generateWithAI}
        disabled={aiLoading}
        className="relative h-8 px-4 text-white text-[11px] font-extrabold rounded-md disabled:opacity-40 cursor-pointer overflow-hidden transition-all duration-300 group
          bg-gradient-to-r from-[#6366f1] via-[#d946ef] to-[#2563eb] bg-[length:200%_auto] animate-textGradient
          hover:shadow-[0_0_20px_rgba(217,70,239,0.5)] hover:scale-[1.03] active:scale-[0.97]
          flex items-center justify-center gap-1.5 border border-white/10 w-full sm:w-auto"
      >
        {/* Efectul de reflexie lucioasă (Shine) la hover */}
        <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-shine transition-transform duration-1000" />

        {/* Efect de iluminare de fundal (Glow overlay) la hover */}
        <span className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Iconița AI stilizată */}
        <span className={`text-[12px] text-purple-100 shrink-0 ${aiLoading ? 'animate-spin' : 'animate-pulse group-hover:rotate-45 transition-transform duration-300'}`}>
          {"\u2726"}
        </span>

        <span className="relative z-10 tracking-widest font-black uppercase text-shadow-sm truncate">
          {aiLoading ? "Generating..." : "Generate Now"}
        </span>
      </button>

    </div>
  )}
</div>

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
                className={
                  "bg-white rounded-2xl overflow-hidden flex flex-col group hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer " +
                  (isPromoted(item.promoted_until)
                    ? "border-2 border-[#FFB100] shadow-[0_0_0_1px_rgba(255,177,0,0.15)]"
                    : "border border-black/5")
                }
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
                  {/* NOU: badge de promovare */}
                  {isPromoted(item.promoted_until) && (
                    <span className="absolute top-2 left-[62px] px-1.5 py-0.5 rounded-full text-[9px] bg-[#FFB100] text-white font-bold font-mono uppercase tracking-wide flex items-center gap-0.5">
                      ⭐ Promovat
                    </span>
                  )}
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
                  <span className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded-full text-[9px] bg-black/60 text-white font-mono flex items-center gap-1">
                    <EyeIcon size={10} />
                    {item.views_count || 0}
                  </span>
                  <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-lg text-xs font-mono font-bold bg-[#FF0000] text-[#FFFFFF]">
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
              {/* NOU: badge de promovare si in modal */}
              {isPromoted(selectedListing.promoted_until) && (
                <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] bg-[#FFB100] text-white font-bold font-mono uppercase tracking-wide flex items-center gap-1">
                  ⭐ Promovat
                </span>
              )}
              <span className="absolute bottom-3 left-3 px-2.5 py-1 rounded-full text-[10px] bg-black/60 text-white font-mono flex items-center gap-1.5">
                <EyeIcon size={12} />
                {selectedListing.views_count || 0} vizualizari
              </span>
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
                <span className="px-3 py-1 rounded-lg text-x font-mono font-bold bg-[#DC2626] text-[#FFFFFF] whitespace-nowrap">
                  {"\u20AC"}{selectedListing.price}
                </span>
              </div>

              <p className="text-xs text-[#4A463D] leading-relaxed whitespace-pre-wrap">
                {selectedListing.description}
              </p>
              {/* contact */}
              <div className="bg-gray-50 border border-black/5 rounded-2xl p-5 flex flex-col gap-3.5 w-full">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">
                  Contactează Vânzătorul
                </span>
                
                <div className="flex flex-col sm:flex-row flex-wrap gap-3 w-full">
                  {selectedListing.phone && (
                    <>
                      {/* Buton Apel */}
                      <a
                        href={"tel:" + selectedListing.phone}
                        className="flex-1 min-w-[160px] text-center text-sm font-bold text-white bg-[#B4592F] hover:bg-[#964723] px-5 py-4 rounded-xl flex items-center justify-center gap-2.5 transition-all shadow-md active:scale-95 hover:scale-[1.02]"
                      >
                        <span className="text-base">{"\u260E"}</span>
                        {selectedListing.phone}
                      </a>
                      
                     
                                    {/* Buton WhatsApp - REPARAT COMPLET CU SLASH ȘI PREFIX */}
                                    <a
                                    href={
                                        "https://wa.me/" + // 
                                        (selectedListing.phone.replace(/[^0-9]/g, "").startsWith("0") 
                                        ? "40" + selectedListing.phone.replace(/[^0-9]/g, "").substring(1) 
                                        : selectedListing.phone.replace(/[^0-9]/g, "")) + 
                                        "?text=" + 
                                        encodeURIComponent("Salut, sunt interesat de anuntul tau de pe iMIDI.co.uk!")
                                    }
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-1 min-w-[160px] text-center text-sm font-bold text-white bg-[#25D366] hover:bg-[#1ebd57] px-5 py-4 rounded-xl flex items-center justify-center gap-2.5 transition-all shadow-md active:scale-95 hover:scale-[1.02]"
                                    >
                                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                                        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.713-1.455L0 24zm6.59-4.846c1.66.986 3.288 1.474 4.803 1.475 5.394 0 9.779-4.384 9.782-9.78.001-2.614-1.017-5.074-2.871-6.928C16.447 2.067 14 1.05 11.4 1.05c-5.4 0-9.785 4.387-9.788 9.783-.001 1.704.469 3.371 1.359 4.881l-.972 3.548 3.648-.957zm11.124-4.525c-.3-.15-1.77-.874-2.043-.973-.274-.1-.473-.15-.673.15-.199.299-.772.972-.946 1.172-.174.2-.349.224-.649.075-.3-.15-1.267-.467-2.414-1.492-.893-.796-1.496-1.78-1.671-2.079-.174-.3-.019-.462.13-.611.135-.133.3-.349.45-.523.149-.174.199-.299.299-.498.1-.2.05-.374-.025-.523-.075-.15-.673-1.62-.922-2.218-.242-.585-.488-.507-.673-.517-.174-.007-.373-.008-.573-.008-.2 0-.523.075-.797.373-.274.299-1.045 1.021-1.045 2.49 0 1.47 1.07 2.89 1.219 3.09.149.2 2.107 3.216 5.106 4.512.714.308 1.272.492 1.707.63.717.227 1.37.195 1.887.118.577-.087 1.77-.723 2.019-1.42.249-.696.249-1.295.174-1.42-.075-.125-.275-.199-.575-.349z" />
                                    </svg>
                                    Trimite Mesaj
                                    </a>

                    </>
                  )}
                  
                  {selectedListing.email && (
                    <a
                      href={"mailto:" + selectedListing.email}
                      className="w-full text-center text-sm font-bold text-gray-700 bg-gray-200 hover:bg-gray-300 px-5 py-4 rounded-xl flex items-center justify-center gap-2.5 transition-all shadow-sm active:scale-95 hover:scale-[1.01]"
                    >
                      <span className="text-base">{"\u2709"}</span>
                      Trimite Email
                    </a>
                  )}
                </div>

                {!selectedListing.phone && !selectedListing.email && (
                  <span className="text-sm text-[#9A907C] font-semibold text-center py-2 bg-gray-100 rounded-xl">
                    Vânzătorul nu a lăsat date de contact.
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