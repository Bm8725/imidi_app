import { Metadata } from "next";
import { supabase } from "@/lib/supabase";
import RedirectToListing from "./RedirectToListing";

interface Props {
  params: Promise<{ id: string }>;
}

const SITE_URL = "https://imidi.co.uk";
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.png`;

// 1. GENERATORUL DINAMIC DE METADATE "INTELLIGENT SHARE"
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

  const mainImage = listing.images?.[0] || DEFAULT_OG_IMAGE;
  const pageUrl = `${SITE_URL}/e-market/listing/${id}`;

  // Curățăm descrierea de tag-uri HTML și o scurtăm inteligent
  const cleanDesc = listing.description?.replace(/<\/?[^>]+(>|$)/g, "").substring(0, 130) || "";

  // TEXTE INTELIGENTE (Cârlige psihologice pentru Social Media)
  // Punem prețul și urgența direct în titlu deoarece platformele taie textele lungi
  const intelligentTitle = `🔥 DOAR €${listing.price} | ${listing.title.toUpperCase()} ⚡`;
  const intelligentDescription = `💎 Ofertă verificată pe iMIDI Market! \n👉 ${cleanDesc}... Click pentru poze, detalii și contact rapid!`;

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
          url: mainImage,
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
      images: [mainImage],
    },
  };
}

// 2. RANDARE HTML ȘI SCHEMA ORG
export default async function ListingPage({ params }: Props) {
  const { id } = await params;

  const { data: listing } = await supabase
    .from("listings")
    .select("title, description, images, price")
    .eq("id", id)
    .single();

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
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <RedirectToListing id={id} />
    </>
  );
}
