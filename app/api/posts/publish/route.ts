/**
 * app/api/posts/publish/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { publishFacebookPost } from "@/lib/meta";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, imageUrl, scheduledPublishTime, supabaseToken, userFbToken } = body;

    if (!supabaseToken || !userFbToken) {
      return NextResponse.json(
        { error: "Sesiune Facebook sau Supabase lipsă. Te rugăm să reîmprospătezi pagina imidi.co.uk." },
        { status: 401 }
      );
    }

    if (!message) {
      return NextResponse.json({ error: "Câmpul 'message' este obligatoriu." }, { status: 400 });
    }

    // 1. Inițializăm clientul Supabase cu drepturile utilizatorului logat
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${supabaseToken}` } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Utilizator neautorizat." }, { status: 401 });
    }

    let pageId = "";
    let pageAccessToken = "";
    let pageName = "";

    // 2. Încercăm să citim datele din tabelul tău în Supabase
    const { data: metaData } = await supabase
      .from("user_meta_connections")
      .select("fb_page_id, fb_page_access_token, fb_page_name")
      .eq("user_id", user.id)
      .maybeSingle();

    // 3. AUTOMATIZARE: Dacă rubrica este goală în DB, o umplem noi acum!
    if (!metaData?.fb_page_access_token || !metaData?.fb_page_id) {
      
      // ✅ REPARAT: Folosim exclusiv endpoint-ul oficial Meta Graph API pentru dezvoltatori
      const metaPagesRes = await fetch(`https://facebook.com{userFbToken}`);
      const metaPagesData = await metaPagesRes.json();

      if (!metaPagesRes.ok || !metaPagesData.data || metaPagesData.data.length === 0) {
        return NextResponse.json(
          { error: "Nu am găsit nicio Pagină de Facebook. Creează o pagină de brand pe Facebook mai întâi." },
          { status: 400 }
        );
      }

      // Luăm prima pagină returnată de Facebook folosind corect indexul array-ului
      const primaryPage = metaPagesData.data[0];
      pageId = primaryPage.id;
      pageAccessToken = primaryPage.access_token;
      pageName = primaryPage.name;

      // SALVĂM ȘI UMPLEM RUBRICA ÎN SUPABASE AUTOMAT
      await supabase
        .from("user_meta_connections")
        .upsert({
          user_id: user.id,
          fb_page_id: pageId,
          fb_page_name: pageName,
          fb_page_access_token: pageAccessToken,
          updated_at: new Date().toISOString()
        }, { onConflict: "user_id" });

    } else {
      // Dacă rubrica era deja plină, folosim datele existente din DB
      pageId = metaData.fb_page_id;
      pageAccessToken = metaData.fb_page_access_token;
      pageName = metaData.fb_page_name || "Pagina ta";
    }

    // 4. Trimitem postarea dinamic prin Meta Graph API
    const result = await publishFacebookPost({
      pageId: pageId,
      pageAccessToken: pageAccessToken,
      message,
      imageUrl,
      scheduledPublishTime,
    });

    return NextResponse.json({ success: true, pageName, facebook: result }, { status: 200 });

  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Eroare necunoscută la publicare" },
      { status: 500 }
    );
  }
}
