import { Metadata } from "next";
import { supabase } from "@/lib/supabase";
import RedirectToListing from "./RedirectToListing";

interface Props {
  params: Promise<{ id: string }>;
}

const SITE_URL = "https://imidi.co.uk";
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.png`; // pune aici o imagine reala 1200x630, nu link catre homepage

// 1. GENERATORUL DINAMIC DE METADATE PENTRU RETELELE SOCIALE
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

  return {
    title: `${listing.title} — \u20AC${listing.price} pe iMIDI Market`,
    description: listing.description,
    openGraph: {
      title: listing.title,
      description: listing.description,
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
      title: listing.title,
      description: listing.description,
      images: [mainImage],
    },
  };
}

// 2. RANDAM HTML REAL (nu redirect() pe server!) ca sa apuce crawler-ele
// sa citeasca meta tag-urile OG, apoi redirectionam omul real prin JS.
export default async function ListingPage({ params }: Props) {
  const { id } = await params;
  return <RedirectToListing id={id} />;
}