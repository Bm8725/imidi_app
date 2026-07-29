/**
 * @project     iMIDI Web Application
 * @package     @imidi/core-app
 * @summary     Universal Metadata Provider with network fixes.
 * @file        app/download/[token]/layout.tsx
 */

import { Metadata } from "next";

type LayoutProps = {
  params: Promise<{ token: string }>;
  children: React.ReactNode;
};

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  
  let title = "Digital Content Package";
  let description = "Secure digital delivery via iMIDI infrastructure. Enter your access key to download.";
  let imageUrl = "https://imidi.co.uk"; // Fallback sigur la o imagine care există deja în RootLayout

  if (token) {
    try {
      // Adăugăm { cache: 'no-store' } pentru a opri Next.js din a memora un răspuns gol sau defect în faza de build
      const res = await fetch(`https://imidi.co.uk{token}`, {
        cache: 'no-store'
      });
      
      if (res.ok) {
        const data = await res.json();
        
        if (data?.filename) {
          title = data.filename;
        }
        
        const seller = data?.seller_name || data?.seller || "Verified iMIDI Seller";
        description = `Secure delivery by ${seller} protected by imidi.co.uk. Enter your access key to pull files.`;
        
        if (data?.cover_image || data?.image) {
          imageUrl = data.cover_image || data.image;
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
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: "iMIDI Secure Transfer Node",
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `📦 ${title}`,
      description: description,
      images: [imageUrl],
    },
  };
}

export default async function DownloadLayout({ children, params }: LayoutProps) {
  await params;
  return <>{children}</>;
}
