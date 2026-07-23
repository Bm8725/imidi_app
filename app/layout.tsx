/**
 * @project     iMIDI Web Application
 * @package     @imidi/core-app
 * @summary     The next generation of synthesizer technology.
 * @version     0.1.13 : 13.07.2026
 * @date        2026-07-13
 * @file        app/layout.tsx
 * @description Root layout component for the iMIDI web application, providing global styles, fonts, and metadata.
 * @author      B. Marius <marius_service@yahoo.com>
 * 
 * @copyright   Copyright (c) 2026 iMIDI/BM. All rights reserved.
 * @license     Proprietary / Confidential. Unauthorized copying is strictly prohibited.
 */

import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import WhatsAppWidget from "@/components/WhatsAppWidget";
import Script from "next/script";
import AIChatWidget from "@/components/AIChatWidget";


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Configurare Viewport obligatorie în Next.js pentru PWA și temă vizuală
export const viewport: Viewport = {
  themeColor: "#18181C",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

// Metadate SEO Avansate, OpenGraph (Facebook/Discord) și Mobile-Ready
export const metadata: Metadata = {
  title: "iMIDI App — Shape the Digital Music Future",
  description: "The next generation of synthesizer technology. Experience real-time cloud synergy, high-fidelity sound engines, and modern midi controls.",
  keywords: ["midi", "synth", "synthesizer", "digital music", "audio app", "next gen synth", "iMIDI"],
  authors: [{ name: "iMIDI Team" }],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "iMIDI",
  },
  openGraph: {
    title: "iMIDI App — Shape the Digital Music Future",
    description: "The next generation of synthesizer technology. Experience real-time cloud synergy.",
    url: "https://imidi.co.uk", // 
    siteName: "iMIDI",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "iMIDI App — Next Gen Synth",
    description: "Shape the digital music future with the ultimate online audio workstation setup.",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#0D0E12] text-white">
        {children}
        <WhatsAppWidget />
        <AIChatWidget />

        {/* Script nativ Next.js pentru înregistrarea silențioasă a sw.js în Production */}
        <Script id="register-pwa-sw" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator && window.location.hostname !== 'localhost') {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js')
                  .then(function(reg) { console.log('iMIDI PWA înregistrat cu succes:', reg.scope); })
                  .catch(function(err) { console.error('Eroare înregistrare sw.js:', err); });
              });
            }
          `}
        </Script>
      </body>
    </html>
  );
}
