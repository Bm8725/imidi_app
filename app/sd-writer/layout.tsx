import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SD Writer · iMIDI",
  description:
    "Paste the seller link and code, plug in your SD card, and write BINARY the package with full verification.",
  openGraph: {
    title: "SD Writer · iMIDI",
    description:
      "Write sound banks and packages straight to an SD card. One-time links, checksum verified.",
    url: "https://www.imidi.co.uk/sd-write",
    siteName: "iMIDI",
    images: [
      {
        url: "https://www.imidi.co.uk/icons/UOTOB.jpg",
        width: 1200,
        height: 630,
        alt: "iMIDI SD Writer",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SD Writer · iMIDI",
    description:
      "Write packages straight to an SD card. Paste link + code, verify, done.",
    images: ["https://www.imidi.co.uk/icons/UOTOB.jpg"],
  },
};

export default function SdWriteLayout({ children }: { children: React.ReactNode }) {
  return children;
}