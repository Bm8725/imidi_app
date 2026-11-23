// app/stiri/page.tsx
import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import StiriClient from "./ForumClient";
import { supabase } from "@/lib/supabase";
import {
  SITE_URL,
  DEFAULT_TITLE,
  DEFAULT_DESCRIPTION,
  buildMetadata,
  truncate,
  safeJsonLd,
} from "./seo";

type SearchParams = Promise<{ post?: string }>;

// Fără cache static: știrile noi apar imediat
export const revalidate = 0;

export const metadata: Metadata = buildMetadata({
  title: DEFAULT_TITLE,
  description: DEFAULT_DESCRIPTION,
  url: `${SITE_URL}/stiri`,
});

export default async function Page({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { post: postId } = await searchParams;

  // Linkurile vechi /stiri?post=ID -> 301 către /stiri/ID
  if (postId) {
    permanentRedirect(`/stiri/${encodeURIComponent(postId)}`);
  }

  const { data: p } = await supabase
    .from("forum_posts")
    .select("*")
    .order("created_at", { ascending: false });
  const { data: r } = await supabase
    .from("forum_replies")
    .select("*")
    .order("created_at", { ascending: true });

  const initialPosts = (p || []).map((post: any) => ({
    ...post,
    replies: (r || []).filter((rep: any) => rep.post_id === post.id),
  }));

  // Listă de articole pentru Google (ultimele 10)
  const listSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: DEFAULT_TITLE,
    url: `${SITE_URL}/stiri`,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: initialPosts.slice(0, 10).map((post: any, i: number) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${SITE_URL}/stiri/${post.id}`,
        name: post.title,
      })),
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(listSchema) }}
      />
      <StiriClient initialPosts={initialPosts} />
    </>
  );
}