import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { publishFacebookPost } from "@/lib/meta";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION || "v21.0";

export async function POST(req: NextRequest) {
  try {
    const { message, imageUrl, scheduledPublishTime, supabaseToken, userFbToken } = await req.json();

    if (!supabaseToken || !userFbToken) {
      return NextResponse.json({ error: "Sesiune Facebook sau Supabase lipsă. Reconectează contul." }, { status: 401 });
    }
    if (!message?.trim()) return NextResponse.json({ error: "Mesajul este obligatoriu." }, { status: 400 });

    // 1. Inițializăm Supabase folosind token-ul de sesiune primit de la user (astfel RLS știe cine este)
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${supabaseToken}` } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Utilizator neautorizat." }, { status: 401 });

    // 2. Interogăm API-ul Meta Graph folosind token-ul de utilizator primit din sesiune
    const metaPagesRes = await fetch(`https://facebook.com{GRAPH_API_VERSION}/me/accounts`, {
      method: "GET",
      headers: { Authorization: `Bearer ${userFbToken}` },
    });
    const metaPagesData = await metaPagesRes.json();

    if (!metaPagesRes.ok || !metaPagesData.data || metaPagesData.data.length === 0) {
      return NextResponse.json({ error: metaPagesData?.error?.message || "Nu există pagini Facebook asociate." }, { status: 400 });
    }

    // Extragem prima pagină disponibilă returnată de Meta
    const page = metaPagesData.data[0];
    const pageId = page.id;
    const pageName = page.name;
    const pageAccessToken = page.access_token;

    // 3. Salvarea în tabelă (Upsert-ul funcționează perfect prin RLS dacă politicile sunt active)
    const { error: saveError } = await supabase
      .from("user_meta_connections")
      .upsert(
        {
          user_id: user.id, // ID-ul din JSON-ul tău: "3a24da4b-27b5-4175-acd9-8a81288b73ae"
          fb_page_id: pageId,
          fb_page_name: pageName,
          fb_page_access_token: pageAccessToken,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (saveError) console.error("SUPABASE SAVE ERROR:", saveError);

    // 4. Publicarea efectivă pe Facebook prin funcția din meta.ts
    const result = await publishFacebookPost({ pageId, pageAccessToken, message, imageUrl, scheduledPublishTime });

    return NextResponse.json({ success: true, pageName, facebook: result }, { status: 200 });

  } catch (error: any) {
    console.error("PUBLISH ERROR:", error);
    return NextResponse.json({ success: false, error: error?.message || "Eroare internă." }, { status: 500 });
  }
}
