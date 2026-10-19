// app/stiri/page.tsx
import type { Metadata } from "next";
import StiriClient from "./ForumClient"; // Redenumit din ForumClient
import { supabase } from "@/lib/supabase";

const SITE_URL = "https://imidi.co.uk";
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-stiri.jpg`; 

const DEFAULT_TITLE = "News & Community iMIDI";
const DEFAULT_DESCRIPTION =
  "Stay updated with the latest news about MIDI routing, hardware patches and system updates from iMIDI.";

type SearchParams = Promise<{ post?: string }>;

// Forțăm Next.js să nu pună pagina în cache-ul static, asigurând preluarea știrilor noi instant
export const revalidate = 0;

function truncate(text: string, max: number) {
  if (!text || text.length <= max) return text;
  const cut = text.slice(0, max);
  return cut.slice(0, cut.lastIndexOf(" ")) + "…";
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const { post: postId } = await searchParams;

  if (!postId) {
    return buildMetadata({
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      url: `${SITE_URL}/stiri`,
      image: DEFAULT_OG_IMAGE,
    });
  }

  const { data: post } = await supabase
    .from("forum_posts")
    .select("title, content")
    .eq("id", postId)
    .single();

  if (!post) {
    return buildMetadata({
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      url: `${SITE_URL}/stiri`,
      image: DEFAULT_OG_IMAGE,
    });
  }

  const title = `${post.title} | Știri iMIDI`;
  const description = truncate(post.content ?? "", 160);

  return buildMetadata({
    title,
    description,
    url: `${SITE_URL}/stiri?post=${postId}`,
    image: DEFAULT_OG_IMAGE,
  });
}

function buildMetadata({
  title,
  description,
  url,
  image,
}: {
  title: string;
  description: string;
  url: string;
  image: string;
}): Metadata {
  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { 
        index: true, 
        follow: true,
        "max-snippet": -1,
        "max-image-preview": "large"
      },
    },
    openGraph: {
      title,
      description,
      url,
      siteName: "iMIDI",
      images: [{ url: image, width: 1200, height: 630, alt: title }],
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function Page({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { post: postId } = await searchParams;

  // 1. Preluăm toate datele direct de pe Server (pentru a fi incluse nativ în sursa HTML)
  const { data: p } = await supabase.from("forum_posts").select("*").order("created_at", { ascending: false });
  const { data: r } = await supabase.from("forum_replies").select("*").order("created_at", { ascending: true });

  const initialPosts = (p || []).map((post: any) => ({
    ...post,
    replies: (r || []).filter((rep: any) => rep.post_id === post.id),
  }));

  // 2. Generăm dinamic schemele structurate JSON-LD de tip NewsArticle pentru Google News
  let schemas: Record<string, unknown>[] = [];

  if (postId) {
    const activePost = initialPosts.find((item) => item.id === postId);
    if (activePost) {
      schemas.push({
        "@context": "https://schema.org",
        "@type": "NewsArticle", 
        "headline": activePost.title,
        "description": truncate(activePost.content, 150),
        "datePublished": activePost.created_at,
        "author": {
          "@type": "Person",
          "name": activePost.user_email,
        },
        "url": `${SITE_URL}/stiri?post=${postId}`,
        "isPartOf": {
          "@type": "WebSite",
          "name": "iMIDI Știri",
          "url": `${SITE_URL}/stiri`,
        },
      });
    }
  } else {
    // Când Google accesează direct /stiri, îi dăm array cu ultimele 3 articole
    initialPosts.slice(0, 3).forEach((post) => {
      schemas.push({
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        "headline": post.title,
        "description": truncate(post.content, 150),
        "datePublished": post.created_at,
        "author": {
          "@type": "Person",
          "name": post.user_email,
        },
        "url": `${SITE_URL}/stiri?post=${post.id}`,
      });
    });
  }

  return (
    <>
      {schemas.map((schema, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
      {/* Pasăm datele deja încărcate către componenta client */}
      <StiriClient initialPosts={initialPosts} />
    </>
  );
}
