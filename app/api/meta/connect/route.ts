/**
 * app/api/meta/connect/route.ts
 *
 * Apelat automat (vezi components/MetaAuthListener.tsx) imediat după
 * login-ul cu Facebook. Primește User Access Token-ul scurt de la
 * Facebook, îl extinde, ia paginile userului și salvează Page Access
 * Token-ul în DB, per user.
 *
 * Body: { fbUserAccessToken: string }
 * Header: Authorization: Bearer <supabase session access_token>
 */

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { exchangeForLongLivedUserToken, fetchUserPages } from "@/lib/metaAuth";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const accessToken = authHeader?.replace("Bearer ", "");
    if (!accessToken) {
      return NextResponse.json({ error: "Lipsește tokenul de autentificare." }, { status: 401 });
    }

    const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(accessToken);
    if (userErr || !user) {
      return NextResponse.json({ error: "Sesiune invalidă." }, { status: 401 });
    }

    const body = await req.json();
    const { fbUserAccessToken } = body;
    if (!fbUserAccessToken) {
      return NextResponse.json({ error: "Lipsește tokenul Facebook." }, { status: 400 });
    }

    const longLivedUserToken = await exchangeForLongLivedUserToken(fbUserAccessToken);
    const pages = await fetchUserPages(longLivedUserToken);

    if (pages.length === 0) {
      return NextResponse.json(
        { error: "Contul Facebook conectat nu administrează nicio pagină." },
        { status: 400 }
      );
    }

    // Simplificare: luăm prima pagină administrată de user.
    // Dacă un user are mai multe pagini, se poate extinde ulterior cu un selector.
    const page = pages[0];

    const { error: upsertErr } = await supabaseAdmin
      .from("user_meta_connections")
      .upsert(
        {
          user_id: user.id,
          fb_page_id: page.id,
          fb_page_name: page.name,
          fb_page_access_token: page.access_token,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (upsertErr) throw upsertErr;

    return NextResponse.json({
      connected: true,
      pageName: page.name,
      pagesAvailable: pages.length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Eroare la conectarea Facebook." }, { status: 500 });
  }
}