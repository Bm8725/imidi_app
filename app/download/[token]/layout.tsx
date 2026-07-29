/**
 * @project     iMIDI Web Application
 * @package     @imidi/core-app
 * @summary     Universal Metadata Provider for All Share Platforms (W3C OG Standard).
 * @file        app/download/[token]/layout.tsx
 */

import { Metadata } from "next";

type LayoutProps = {
  params: Promise<{ token: string }>;
  children: React.ReactNode;
};

// Next.js cere ca params să fie tratat ca Promise asincron în generateMetadata
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  // Aici rezolvăm eroarea din consolă prin extragerea token-ului asincron cu await
  const { token } = await params;
  
  let title = "Digital Content Package";
  let description = "Secure digital delivery via iMIDI infrastructure. Enter your access key to download.";

  if (token) {
    try {
      const res = await fetch(`https://imidi.co.uk{token}`, {
        next: { revalidate: 60 }
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
    openGraph: {
      title: `📦 ${title}`,
      description: description,
      url: `https://imidi.co.uk{token}`,
      siteName: "iMIDI Cloud Infrastructure",
      images: [
        {
          url: "https://imidi.co.uk",
          width: 192,
          height: 192,
          alt: "iMIDI Secure Transfer Node",
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `📦 ${title}`,
      description: description,
      images: ["https://imidi.co.uk"],
    },
  };
}

// În layout-ul propriu-zis, Next.js primește params ca Promise, dar nu e obligatoriu să îi facem await dacă nu îl folosim în interfață
export default async function DownloadLayout({ children, params }: LayoutProps) {
  // Consumăm promisiunea pentru a asigura maparea corectă a tipurilor în Next.js
  await params;
  
  return <>{children}</>;
}
