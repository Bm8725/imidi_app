/**
 * app/api/meta/callback/route.ts
 *
 * Callback pentru "Facebook Login for Business".
 * Primește ?code=... de la Facebook, il schimbă pe un user access token,
 * apoi pe unul long-lived, ia paginile userului via /me/accounts,
 * și salvează page_id + page_access_token in user_meta_connections.
 *
 * IMPORTANT: acest flow e complet separat de supabase.auth.linkIdentity —
 * NU mai trece prin Supabase Auth pentru partea de permisiuni de Pagina.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION || "v21.0";
const BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state") || "/dashboard/posts";
  const errorParam = searchParams.get("error_description") || searchParams.get("error");

  if (errorParam) {
    return NextResponse.redirect(
      `${origin}${state}?fb_error=${encodeURIComponent(errorParam)}`
    );
  }
  if (!code) {
    return NextResponse.redirect(`${origin}${state}?fb_error=missing_code`);
  }

  // ---- 0. cine e userul curent (trebuie sa fie deja logat in aplicatie) ----
  // Trimitem sesiunea Supabase printr-un cookie, nu prin Authorization header,
  // pt ca acest request vine direct de la Facebook (browser redirect), nu din fetch-ul nostru.
  const supabaseSession = req.cookies.get("sb-access-token")?.value; // ajusteaza numele cookie-ului la setup-ul tau real
  if (!supabaseSession) {
    return NextResponse.redirect(`${origin}/login?fb_error=not_logged_in`);
  }

  const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(supabaseSession);
  if (userErr || !user) {
    return NextResponse.redirect(`${origin}/login?fb_error=session_invalid`);
  }

  try {
    // ---- 1. code -> short-lived user access token ----
    const tokenUrl = new URL(`${BASE_URL}/oauth/access_token`);
    tokenUrl.searchParams.set("client_id", process.env.FACEBOOK_APP_ID!);
    tokenUrl.searchParams.set("client_secret", process.env.FACEBOOK_APP_SECRET!);
    tokenUrl.searchParams.set("redirect_uri", `${origin}/api/meta/callback`);
    tokenUrl.searchParams.set("code", code);

    const tokenRes = await fetch(tokenUrl.toString());
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) throw new Error(tokenData?.error?.message || "Eroare la schimbul codului OAuth.");

    const shortLivedToken = tokenData.access_token as string;

    // ---- 2. short-lived -> long-lived user access token (~60 zile) ----
    const longLivedUrl = new URL(`${BASE_URL}/oauth/access_token`);
    longLivedUrl.searchParams.set("grant_type", "fb_exchange_token");
    longLivedUrl.searchParams.set("client_id", process.env.FACEBOOK_APP_ID!);
    longLivedUrl.searchParams.set("client_secret", process.env.FACEBOOK_APP_SECRET!);
    longLivedUrl.searchParams.set("fb_exchange_token", shortLivedToken);

    const longLivedRes = await fetch(longLivedUrl.toString());
    const longLivedData = await longLivedRes.json();
    if (!longLivedRes.ok) throw new Error(longLivedData?.error?.message || "Eroare la extinderea tokenului.");

    const longLivedUserToken = longLivedData.access_token as string;

    // ---- 3. lista paginilor userului (page access token e deja long-lived aici) ----
    const pagesUrl = new URL(`${BASE_URL}/me/accounts`);
    pagesUrl.searchParams.set("access_token", longLivedUserToken);
    pagesUrl.searchParams.set("fields", "id,name,access_token");

    const pagesRes = await fetch(pagesUrl.toString());
    const pagesData = await pagesRes.json();
    if (!pagesRes.ok) throw new Error(pagesData?.error?.message || "Nu am putut lista paginile Facebook.");

    const pages = pagesData.data as Array<{ id: string; name: string; access_token: string }>;
    if (!pages || pages.length === 0) {
      throw new Error("Contul tau de Facebook nu administreaza nicio Pagina.");
    }

    // Daca userul are o singura pagina o luam automat; daca are mai multe,
    // aici e locul unde ai putea afisa un ecran de selectie in loc sa iei prima.
    const page = pages[0];

    // ---- 4. salvam conexiunea ----
    const { error: upsertErr } = await supabaseAdmin
      .from("user_meta_connections")
      .upsert(
        {
          user_id: user.id,
          fb_page_id: page.id,
          fb_page_name: page.name,
          fb_page_access_token: page.access_token,
          connected_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (upsertErr) throw upsertErr;

    return NextResponse.redirect(`${origin}${state}?fb_connected=1`);
  } catch (err: any) {
    console.error("Meta callback error:", err);
    return NextResponse.redirect(
      `${origin}${state}?fb_error=${encodeURIComponent(err.message || "Eroare necunoscuta")}`
    );
  }
}