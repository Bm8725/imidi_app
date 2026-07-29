import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION || "v21.0";
const BASE_URL = `https://facebook.com{GRAPH_API_VERSION}`;

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");
  
  let userId = "";
  let redirectPath = "/dashboard/post";

  if (stateParam) {
    try {
      const parsedState = JSON.parse(stateParam);
      userId = parsedState.userId;
      redirectPath = parsedState.path || redirectPath;
    } catch (e) {
      redirectPath = stateParam; 
    }
  }

  if (!code) {
    return NextResponse.redirect(`${origin}${redirectPath}?fb_error=missing_code`);
  }
  
  if (!userId) {
    return NextResponse.redirect(`${origin}/login?fb_error=session_invalid_no_userid`);
  }

  try {
    // ---- 1. Schimbăm codul pe short-lived user access token ----
    const tokenUrl = new URL(`${BASE_URL}/oauth/access_token`);
    tokenUrl.searchParams.set("client_id", process.env.META_APP_ID!);
    tokenUrl.searchParams.set("client_secret", process.env.META_APP_SECRET!);
    tokenUrl.searchParams.set("redirect_uri", `${origin}/api/meta/callback`);
    tokenUrl.searchParams.set("code", code);

    const tokenRes = await fetch(tokenUrl.toString());
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) throw new Error(tokenData?.error?.message || "Eroare la schimbul codului OAuth.");

    const shortLivedToken = tokenData.access_token as string;

    // ---- 2. Schimbăm pe long-lived user access token (~60 zile) ----
    const longLivedUrl = new URL(`${BASE_URL}/oauth/access_token`);
    longLivedUrl.searchParams.set("grant_type", "fb_exchange_token");
    longLivedUrl.searchParams.set("client_id", process.env.META_APP_ID!);
    longLivedUrl.searchParams.set("client_secret", process.env.META_APP_SECRET!);
    longLivedUrl.searchParams.set("fb_exchange_token", shortLivedToken);

    const longLivedRes = await fetch(longLivedUrl.toString());
    const longLivedData = await longLivedRes.json();
    if (!longLivedRes.ok) throw new Error(longLivedData?.error?.message || "Eroare la extinderea tokenului.");

    const longLivedUserToken = longLivedData.access_token as string;

    // ---- 3. Preluăm lista paginilor de Facebook ale utilizatorului ----
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

    // CORECTARE: Extragem primul element din array în mod explicit!
    const page = pages[0];

    // ---- 4. Salvăm conexiunea în DB (FĂRĂ connected_at) ----
    const { error: upsertErr } = await supabaseAdmin
      .from("user_meta_connections")
      .upsert({
        user_id: userId,
        fb_page_id: page.id,
        fb_page_name: page.name,
        fb_page_access_token: page.access_token
      });

    if (upsertErr) throw upsertErr;

    return NextResponse.redirect(`${origin}${redirectPath}?fb_connected=1`);
  } catch (err: any) {
    console.error("Meta callback error:", err);
    return NextResponse.redirect(
      `${origin}${redirectPath}?fb_error=${encodeURIComponent(err.message || "Eroare necunoscuta")}`
    );
  }
}
