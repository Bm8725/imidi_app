import { Metadata } from "next";
import { supabase } from "@/lib/supabase";
import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ id: string }>;
}

// 1. GENERATORUL DINAMIC DE METADATE PENTRU RETELELE SOCIALE
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  // Interogăm Supabase direct de pe server
  const { data: listing } = await supabase
    .from("listings")
    .select("title, description, images, price")
    .eq("id", id)
    .single();

  if (!listing) {
    return { title: "Listing Not Found — iMIDI Market" };
  }

  // Luăm prima poză din cele maxim 4 salvate în array, sau fallback dacă nu are
  const mainImage = listing.images?.[0] || "https://imidi.co.uk";

  return {
    title: `${listing.title} — €${listing.price} on iMIDI Market`,
    description: listing.description,
    openGraph: {
      title: listing.title,
      description: listing.description,
      url: `https://imidi.co.uk{id}`,
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

// 2. LOGICA PAGINII DE REDIRECTIONARE SAU VIZUALIZARE DIRECTA
export default async function ListingPage({ params }: Props) {
  const { id } = await params;

  // Opțiunea A: Redirecționăm automat utilizatorul uman înapoi în pagina ta principală 
  // deschizându-i automat modalul de detalii prin query params
  redirect(`/e-market?id=${id}`);
  
  return null;
}