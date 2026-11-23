// app/stiri/[id]/page.tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { supabase } from "@/lib/supabase";
import PostClient from "./PostClient";
import {
  SITE_URL,
  DEFAULT_TITLE,
  DEFAULT_DESCRIPTION,
  buildMetadata,
  truncate,
  safeJsonLd,
} from "../seo";

export const revalidate = 0;

async function getPost(id: string) {
  const { data: post } = await supabase
    .from("forum_posts")
    .select("*")
    .eq("id", id)
    .single();

  if (!post) return null;

  const { data: replies } = await supabase
    .from("forum_replies")
    .select("*")
    .eq("post_id", id)
    .order("created_at", { ascending: true });

  return { ...post, replies: replies || [] };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const post = await getPost(id);

  if (!post) {
    return {
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      robots: { index: false, follow: false },
    };
  }

  return buildMetadata({
    title: `${post.title} | Știri iMIDI`,
    description: truncate(post.content ?? "", 160),
    url: `${SITE_URL}/stiri/${id}`,
    type: "article",
  });
}

export default async function StirePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const post = await getPost(id);
  if (!post) notFound();

  const schema = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: post.title,
    description: truncate(post.content ?? "", 150),
    datePublished: post.created_at,
    mainEntityOfPage: `${SITE_URL}/stiri/${id}`,
    url: `${SITE_URL}/stiri/${id}`,
    // Nu punem emailul complet în datele publice structurate
    author: {
      "@type": "Person",
      name: String(post.user_email || "iMIDI").split("@")[0],
    },
    publisher: { "@type": "Organization", name: "iMIDI", url: SITE_URL },
    isPartOf: {
      "@type": "WebSite",
      name: "iMIDI Știri",
      url: `${SITE_URL}/stiri`,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(schema) }}
      />
      <PostClient initialPost={post} />
    </>
  );
}