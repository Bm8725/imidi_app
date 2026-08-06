// app/products/page.tsx
import type { Metadata } from "next";
import ProductsClient from "./ProductsClient";

// !! Schimbă cu domeniul tău real de producție !!
const SITE_URL = "https://imidi.co.uk";

// !! Poza folosită la share (WhatsApp/Facebook/etc). Ideal 1200x630px.
// Poți schimba cu o poză dedicată, ex: `${SITE_URL}/og-ivolution.jpg`
const OG_IMAGE = `${SITE_URL}/bass.jpg`;

export const metadata: Metadata = {
  title: "i-VOLUTION MIDI System for Accordion | iMIDI app",
  description:
    "Professional MIDI integration for accordionists. Ultra-low latency, bellow real emulation, OLED display, compatible with KORG PA series and TS4X.",
  openGraph: {
    title: "i-VOLUTION MIDI System for Accordion",
    description:
      "Professional MIDI integration for accordionists. Price 800 Euro. Ultra-low latency, bellow real emulation, compatible with KORG PA, Roland synth series and TS4X PRO Native",
    url: `${SITE_URL}/products`,
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
      "Professional MIDI integration for accordionists — ultra-low latency, OLED display, KORG PA & TS4X compatible.",
    images: [OG_IMAGE],
  },
};

export default function Page() {
  return <ProductsClient />;
}