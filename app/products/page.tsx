// app/products/page.tsx
import type { Metadata } from "next";
import ProductsClient from "./ProductsClient";

const SITE_URL = "https://imidi.co.uk";

// Poza folosită la share (WhatsApp/Facebook/etc) și în schema Product.
// Ideal 1200x630px pentru Open Graph. Schimbă dacă vrei o poză dedicată,
// ex: `${SITE_URL}/og-ivolution.jpg`
const OG_IMAGE = `${SITE_URL}/bass.jpg`;
const PAGE_URL = `${SITE_URL}/products`;

export const metadata: Metadata = {
  title: "i-VOLUTION MIDI System for Accordion | iMIDI",
  description:
    "Professional MIDI integration for accordionists price 800 Euro. Ultra-low latency, bellow real emulation, OLED display, compatible with KORG PA series and TS4X.",
  alternates: {
    canonical: PAGE_URL,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  openGraph: {
    title: "i-VOLUTION MIDI System for Accordion",
    description:
      "Professional MIDI integration for accordionists price 800 Euro. Ultra-low latency, bellow real emulation, OLED display, compatible with KORG PA series and TS4X.",
    url: PAGE_URL,
    siteName: "iMIDI",
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "i-VOLUTION MIDI System for Accordion",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "i-VOLUTION MIDI System for Accordion",
    description:
      "Professional MIDI integration for accordionists price 800 Euro. Ultra-low latency, OLED display, KORG PA & TS4X compatible.",
    images: [OG_IMAGE],
  },
};

// ============================================================================
// JSON-LD structured data — Product schema cu 2 variante (SOLO / R+L) ca
// AggregateOffer + Offer individuale. Ajută Google să afișeze rich snippets
// (preț, disponibilitate) direct în rezultatele de căutare.
// Actualizează manual prețurile aici dacă le schimbi în ProductsClient.tsx —
// nu sunt legate automat, ca să nu depindă pagina de metadata de state client.
// ============================================================================
const productJsonLd = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "i-VOLUTION MIDI System for Accordion",
  description:
    "Professional-grade MIDI integration for accordionists. Ultra-low latency, bellow real emulation, OLED display, compatible with KORG PA series and TS4X.",
  image: [OG_IMAGE],
  brand: {
    "@type": "Brand",
    name: "iMIDI",
  },
  offers: {
    "@type": "AggregateOffer",
    priceCurrency: "USD",
    lowPrice: "949.90",
    highPrice: "1299.90",
    offerCount: "2",
    availability: "https://schema.org/InStock",
    url: PAGE_URL,
    offers: [
      {
        "@type": "Offer",
        name: "SOLO — Right hand",
        price: "949.90",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        url: PAGE_URL,
      },
      {
        "@type": "Offer",
        name: "R + L — Full BASS included",
        price: "1299.90",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        url: PAGE_URL,
      },
    ],
  },
};

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <ProductsClient />
    </>
  );
}