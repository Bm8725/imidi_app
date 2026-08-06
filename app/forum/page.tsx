// app/forum/page.tsx
import type { Metadata } from "next";
import ForumClient from "./ForumClient";
import { supabase } from "@/lib/supabase";

const SITE_URL = "https://imidi.co.uk";
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-forum.jpg`; // schimbă dacă ai altă poză default pt forum

// Metadata generică, folosită când nu există ?post= în URL (adică pe /forum simplu)
const DEFAULT_TITLE = "Forum community iMIDI";
const DEFAULT_DESCRIPTION =
  "Discuss MIDI routing, hardware patches, and system logs with the iMIDI community.";

type SearchParams = Promise<{ post?: string }>;

// Scurtează textul unei postări la N caractere, curat (fără să taie un cuvânt în două)
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

  // Fără ?post= -> metadata generică de forum
  if (!postId) {
    return buildMetadata({
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      url: `${SITE_URL}/forum`,
      image: DEFAULT_OG_IMAGE,
    });
  }

  // Cu ?post=<id> -> încercăm să luăm postarea reală, ca preview-ul de share
  // să arate titlul și conținutul discuției respective, nu textul generic.
  const { data: post } = await supabase
    .from("forum_posts")
    .select("title, content, user_email")
    .eq("id", postId)
    .single();

  if (!post) {
    // postarea nu (mai) există -> fallback la metadata generică, fără eroare
    return buildMetadata({
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      url: `${SITE_URL}/forum`,
      image: DEFAULT_OG_IMAGE,
    });
  }

  const title = `${post.title} | Forum iMIDI`;
  const description = truncate(post.content ?? "", 160);

  return buildMetadata({
    title,
    description,
    url: `${SITE_URL}/forum?post=${postId}`,
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
      googleBot: { index: true, follow: true },
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

  // JSON-LD DiscussionForumPosting — doar când există o postare specifică
  // (pe pagina generală de forum, un singur JSON-LD per postare n-are sens,
  // acolo ai deja lista completă randată de ForumClient).
  let jsonLd: Record<string, unknown> | null = null;

  if (postId) {
    const { data: post } = await supabase
      .from("forum_posts")
      .select("title, content, user_email, created_at")
      .eq("id", postId)
      .single();

    if (post) {
      jsonLd = {
        "@context": "https://schema.org",
        "@type": "DiscussionForumPosting",
        headline: post.title,
        text: post.content,
        datePublished: post.created_at,
        author: {
          "@type": "Person",
          name: post.user_email,
        },
        url: `${SITE_URL}/forum?post=${postId}`,
        isPartOf: {
          "@type": "WebSite",
          name: "iMIDI Forum",
          url: `${SITE_URL}/forum`,
        },
      };
    }
  }

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <ForumClient />
    </>
  );
}