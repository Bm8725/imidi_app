import type { Metadata } from "next";

const site = "https://www.imidi.co.uk";
const ogImage = `${site}/31dPn.jpg`;

export const metadata: Metadata = {
  title: "SD Writer · iMIDI",
  description:
    "Paste the seller link and code, plug in your SD card, and write the package with full verification.",
  metadataBase: new URL(site),
  openGraph: {
    title: "SD Writer · iMIDI",
    description:
      "Write sound banks and packages straight to an SD card. One-time links, checksum verified.",
    url: `${site}/sd-write`,
    siteName: "iMIDI",
    locale: "en_GB",
    type: "website",
    images: [
      {
        url: ogImage,
        secureUrl: ogImage,
        width: 1200,
        height: 630,
        alt: "iMIDI SD Writer",
        type: "image/jpeg",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SD Writer · iMIDI",
    description:
      "Write packages straight to an SD card. Paste link + code, verify, done.",
    images: [ogImage],
  },
};

export default function SdWriteLayout({ children }: { children: React.ReactNode }) {
  return children;
}