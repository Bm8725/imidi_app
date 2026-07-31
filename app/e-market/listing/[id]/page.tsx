import { Metadata } from "next";
import { supabase } from "@/lib/supabase";
import RedirectToListing from "./RedirectToListing";

interface Props {
  params: Promise<{ id: string }>;
}

const SITE_URL = "https://imidi.co.uk";
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.png`;

// 1. GENERATORUL DINAMIC DE METADATE "AI SMART SHARE"
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  const { data: listing } = await supabase
    .from("listings")
    .select("title, description, images, price")
    .eq("id", id)
    .single();

  if (!listing) {
    return { title: "Anunt indisponibil — iMIDI Market" };
  }

  // Extragem prima imagine din array sau folosim imaginea default a platformei
  const mainImage = listing.images?.[0] || DEFAULT_OG_IMAGE;
  const pageUrl = `${SITE_URL}/e-market/listing/${id}`;

  // Curățăm descrierea de tag-uri HTML și o scurtăm pentru a fi citită optim de rețelele sociale
  const cleanDesc = listing.description?.replace(/<\/?[^>]+(>|$)/g, "").substring(0, 120) || "";

  // CONSTRUIM URL-UL CĂTRE RUTA TA DE API SMARTSHARE (.ts / .tsx)
  // Îi pasăm titlul, prețul, descrierea curățată și imaginea de fundal ca parametri
  const smartShareImage = `${SITE_URL}/api/smart-share?title=${encodeURIComponent(listing.title)}&price=${listing.price || 0}&desc=${encodeURIComponent(cleanDesc)}&img=${encodeURIComponent(mainImage)}`;

  // Titlu și descriere magnetice pentru previzualizarea text a share-ului
  const intelligentTitle = `🔥 DOAR €${listing.price} | ${listing.title.toUpperCase()} ⚡`;
  const intelligentDescription = `💎 Ofertă verificată pe iMIDI Market! 👉 ${cleanDesc}... Click pentru detalii, poze și contact rapid!`;

  return {
    title: intelligentTitle,
    description: intelligentDescription,
    openGraph: {
      title: intelligentTitle,
      description: intelligentDescription,
      url: pageUrl,
      siteName: "iMIDI Marketplace",
      type: "article",
      images: [
        {
          url: smartShareImage, // Imaginea dinamică cu elemente suprapuse de AI
          width: 1200,
          height: 630,
          alt: listing.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: intelligentTitle,
      description: intelligentDescription,
      images: [smartShareImage], // Imaginea dinamică cu elemente suprapuse de AI pentru Twitter/X
    },
  };
}

// 2. RANDARE HTML REAL ȘI STRUCTURĂ JSON-LD PENTRU GOOGLE SEO
export default async function ListingPage({ params }: Props) {
  const { id } = await params;

  // Extragem datele din Supabase pe server pentru a construi structura JSON-LD
  const { data: listing } = await supabase
    .from("listings")
    .select("title, description, images, price")
    .eq("id", id)
    .single();

  // Generăm schema structurată pe care o va citi Google (utilizatorul vede imaginea normală, curată)
  const jsonLd = listing ? {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": listing.title,
    "description": listing.description,
    "image": listing.images?.[0] || DEFAULT_OG_IMAGE,
    "offers": {
      "@type": "Offer",
      "price": listing.price,
      "priceCurrency": "EUR",
      "availability": "https://schema.org"
    }
  } : null;

  return (
    <>
      {/* Scriptul JSON-LD generat pe server pentru indexare instantă în motorul de căutare */}
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}

      {/* Redirecționarea executată prin JS pe client către interfața vizuală a anunțului */}
      <RedirectToListing id={id} />
    </>
  );
}
