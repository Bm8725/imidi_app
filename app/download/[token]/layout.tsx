/**
 * @project     iMIDI Web Application
 * @package     @imidi/core-app
 * @summary     Universal Metadata Provider for All Share Platforms (W3C OG Standard).
 * @file        app/download/[token]/layout.tsx
 */

import { Metadata } from "next";

type Props = {
  params: { token: string };
  children: React.ReactNode;
};

// Această funcție rulează pe server și generează preview-ul instant pentru orice platformă de share
export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  const token = params.token;
  
  let title = "Digital Content Package";
  let description = "Secure digital delivery via iMIDI infrastructure. Enter your access key to download.";

  if (token) {
    try {
      // Interogăm API-ul intern folosind URL-ul complet absolut (obligatoriu pe server)
      const res = await fetch(`https://imidi.co.uk{token}`, {
        next: { revalidate: 60 } // Cache de 1 minut pentru performanță
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data?.filename) {
          title = data.filename;
        }
        if (data?.seller_name) {
          description = `Pachet digital livrat în siguranță de ${data.seller_name} prin intermediul platformei imidi.co.uk.`;
        }
      }
    } catch (err) {
      console.error("Eroare la generarea metadatelor universale de share:", err);
    }
  }

  return {
    title: `${title} | iMIDI CLOUD`,
    description: description,
    
    // 1. Standardul Open Graph - Folosit de WhatsApp, Facebook, Discord, Telegram, LinkedIn, iMessage
    openGraph: {
      title: `📦 ${title}`,
      description: description,
      url: `https://imidi.co.uk{token}`,
      siteName: "iMIDI Cloud Infrastructure",
      images: [
        {
          url: "https://imidi.co.uk", // Imaginea logo care apare ca thumbnail (sub 300KB)
          width: 192,
          height: 192,
          alt: "iMIDI Secure Transfer Node",
        },
      ],
      type: "website",
    },
    
    // 2. Standardul specific pentru platforma X / Twitter (Card Mare cu Imagine)
    twitter: {
      card: "summary_large_image",
      title: `📦 ${title}`,
      description: description,
      images: ["https://imidi.co.uk"],
    },
  };
}

export default function DownloadLayout({ children }: Props) {
  return <>{children}</>;
}
