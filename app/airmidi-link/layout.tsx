import type { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.imidi.co.uk"),
  title: "AirMIDI Link",
  description: "Play MIDI together in real time: encrypted, low latency, with live video and voice.",
  openGraph: {
    type: "website",
    title: "AirMIDI Link",
    description: "Play MIDI together in real time. No installs, just a code.",
    url: "/airmidi-link",
    images: [{ url: "/airlink-og.png", width: 1200, height: 630, alt: "AirMIDI Link" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AirMIDI Link",
    description: "Play MIDI together in real time. No installs, just a code.",
    images: ["/airlink-og.png"],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}