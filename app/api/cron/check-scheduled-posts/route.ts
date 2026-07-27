/**
 * app/api/cron/check-scheduled-posts/route.ts
 *
 * Rulat periodic (Vercel Cron, la 5 minute — vezi vercel.json).
 * Verifică postările cu status="scheduled" a căror oră a trecut deja,
 * interoghează Graph API dacă s-au publicat efectiv, și creează
 * o notificare pentru user când detectează publicarea.
 */

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";


const GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION || "v21.0";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: pending, error: fetchErr } = await supabaseAdmin
      .from("scheduled_posts")
      .select("*")
      .eq("status", "scheduled")
      .lte("scheduled_publish_time", new Date().toISOString());

    if (fetchErr) throw fetchErr;
    if (!pending || pending.length === 0) {
      return NextResponse.json({ checked: 0, published: 0 });
    }

    // Cache tokenuri per user, ca să nu interogăm meta_connections de N ori
    // pentru mai multe postări ale aceluiași user.
    const tokenCache = new Map<string, string>();

    async function getPageAccessToken(userId: string): Promise<string | null> {
      if (tokenCache.has(userId)) return tokenCache.get(userId)!;
      const { data } = await supabaseAdmin
        .from("user_meta_connections")
        .select("fb_page_access_token")
        .eq("user_id", userId)
        .maybeSingle();
      if (!data) return null;
      tokenCache.set(userId, data.fb_page_access_token);
      return data.fb_page_access_token;
    }

    let publishedCount = 0;

    for (const post of pending) {
      try {
        const pageAccessToken = await getPageAccessToken(post.user_id);
        if (!pageAccessToken) {
          console.error(`Nicio conexiune Facebook găsită pentru userul ${post.user_id}`);
          continue;
        }

        const res = await fetch(
          `https://graph.facebook.com/${GRAPH_API_VERSION}/${post.fb_post_id}?fields=is_published&access_token=${pageAccessToken}`
        );
        const data = await res.json();

        // Dacă postarea nu mai există sau a dat eroare -> marcăm failed
        if (!res.ok) {
          await supabaseAdmin
            .from("scheduled_posts")
            .update({ status: "failed" })
            .eq("id", post.id);

          await supabaseAdmin.from("notifications").insert({
            user_id: post.user_id,
            type: "post_failed",
            title: "O postare programată a eșuat",
            body: data?.error?.message || "Facebook a returnat o eroare la publicare.",
            related_post_id: post.id,
          });
          continue;
        }

        if (data.is_published) {
          await supabaseAdmin
            .from("scheduled_posts")
            .update({ status: "published", published_at: new Date().toISOString() })
            .eq("id", post.id);

          await supabaseAdmin.from("notifications").insert({
            user_id: post.user_id,
            type: "post_published",
            title: "Postare publicată pe Facebook",
            body: post.message.slice(0, 120),
            related_post_id: post.id,
          });

          publishedCount++;
        }
        // Dacă is_published === false, o lăsăm "scheduled" -> o verificăm iar la următoarea rulare
      } catch (innerErr) {
        // Eroare de rețea/parsing pe o singură postare -> continuăm cu restul
        console.error(`Eroare la verificarea postării ${post.id}:`, innerErr);
      }
    }

    return NextResponse.json({ checked: pending.length, published: publishedCount });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}