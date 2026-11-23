// app/stiri/seo.ts
import type { Metadata } from "next";

export const SITE_URL = "https://imidi.co.uk";
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-stiri.jpg`;
export const DEFAULT_TITLE = "News & Community iMIDI";
export const DEFAULT_DESCRIPTION =
  "Stay updated with the latest news about MIDI routing, hardware patches and system updates from iMIDI.";

export function truncate(text: string, max: number) {
  if (!text || text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut) + "…";
}

// JSON-LD cu conținut de la useri: escapăm "<" ca să nu poată închide tag-ul <script>
export function safeJsonLd(schema: Record<string, unknown>) {
  return JSON.stringify(schema).replace(/</g, "\\u003c");
}

export function buildMetadata({
  title,
  description,
  url,
  image = DEFAULT_OG_IMAGE,
  type = "website",
}: {
  title: string;
  description: string;
  url: string;
  image?: string;
  type?: "website" | "article";
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-snippet": -1,
        "max-image-preview": "large",
      },
    },
    openGraph: {
      title,
      description,
      url,
      siteName: "iMIDI",
      images: [{ url: image, width: 1200, height: 630, alt: title }],
      type,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}