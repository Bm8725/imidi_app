/**
 * app/api/posts/publish/route.ts
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { publishFacebookPost } from "@/lib/meta";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION || "v21.0";

export async function POST(req: NextRequest) {
  try {
    const { message, imageUrl, scheduledPublishTime, supabaseToken, userFbToken } = await req.json();

    if (!supabaseToken) return NextResponse.json({ error: "Sesiune Supabase lipsă." }, { status: 401 });
    if (!message?.trim()) return NextResponse.json({ error: "Mesajul este obligatoriu." }, { status: 400 });

    // 1. Validare utilizator în Supabase
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${supabaseToken}` } },
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Utilizator neautorizat." }, { status: 401 });

    // 2. Obținere Token de pagină (Fallback pe DB dacă token-ul din sesiune lipsește)
    let fbToken = userFbToken;
    if (!fbToken) {
      const { data: connection } = await supabase.from("user_meta_connections").select("fb_page_access_token").eq("user_id", user.id).single();
      fbToken = connection?.fb_page_access_token;
      if (!fbToken) return NextResponse.json({ error: "Sesiune Facebook lipsă. Reconectează contul." }, { status: 401 });
    }

    // 3. Preluare pagini Meta (aliniat la versiunea din meta.ts)
    const metaRes = await fetch(`https://facebook.com{GRAPH_API_VERSION}/me/accounts`, {
      method: "GET",
      headers: { Authorization: `Bearer ${fbToken}` },
    });
    const metaData = await metaRes.json();

    if (!metaRes.ok || !metaData.data?.length) {
      console.error("META ERROR:", metaData);
      return NextResponse.json({ error: metaData?.error?.message || "Nu există pagini Facebook accesibile." }, { status: 400 });
    }

    const { id: pageId, name: pageName, access_token: pageAccessToken } = metaData.data[0];

    // 4. Salvare/Actualizare conexiune în DB
    const { error: saveError } = await supabase.from("user_meta_connections").upsert(
      { user_id: user.id, fb_page_id: pageId, fb_page_name: pageName, fb_page_access_token: pageAccessToken, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
    if (saveError) console.error("SUPABASE SAVE ERROR:", saveError);

    // 5. Publicare prin Meta API
    const result = await publishFacebookPost({ pageId, pageAccessToken, message, imageUrl, scheduledPublishTime });

    return NextResponse.json({ success: true, pageName, facebook: result }, { status: 200 });

  } catch (error: any) {
    console.error("PUBLISH ERROR:", error);
    return NextResponse.json({ success: false, error: error?.message || "Eroare internă de server." }, { status: 500 });
  }
}
