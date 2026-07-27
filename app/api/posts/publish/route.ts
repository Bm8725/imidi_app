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

    // 1. Inițializăm clientul Supabase cu token-ul utilizatorului
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

    // 2. Citim datele curente din tabelul tău exact public.user_meta_connections
    const { data: metaData, error: readError } = await supabase
      .from("user_meta_connections")
      .select("fb_page_id, fb_page_access_token, fb_page_name")
      .eq("user_id", user.id)
      .maybeSingle();

    if (readError) {
      console.error("EROARE LA CITIREA DIN SUPABASE:", readError);
    }

    // 3. Dacă rubrica este goală în DB, o populăm automat
    if (!metaData?.fb_page_access_token || !metaData?.fb_page_id) {
      
      const metaPagesRes = await fetch(`https://facebook.com{userFbToken}`);
      const metaPagesData = await metaPagesRes.json();

      if (!metaPagesRes.ok || !metaPagesData.data || metaPagesData.data.length === 0) {
        return NextResponse.json(
          { error: "Nu există pagini Facebook asociate sau lipsesc permisiunile în contul tău." },
          { status: 400 }
        );
      }

      // Extragem prima pagină disponibilă din JSON-ul Meta
      const primaryPage = metaPagesData.data[0];
      pageId = primaryPage.id;
      pageAccessToken = primaryPage.access_token;
      pageName = primaryPage.name;

      console.log(`Încercăm salvarea automată în DB pentru userul: ${user.id}`);

      // ÎNCERCĂM SALVAREA ÎN BAZA TA DE DATE (Exact pe coloanele din schema ta SQL)
      const { error: saveError } = await supabase
        .from("user_meta_connections")
        .upsert({
          user_id: user.id,
          fb_page_id: pageId,
          fb_page_name: pageName,
          fb_page_access_token: pageAccessToken,
          updated_at: new Date().toISOString()
        }, { onConflict: "user_id" });

      if (saveError) {
        console.error("❌ EROARE CRITICĂ LA SALVAREA ÎN SUPABASE DB:", saveError);
        return NextResponse.json(
          { error: `Baza de date a respins salvarea datelor: ${saveError.message}. Verifică politicile RLS!` },
          { status: 500 }
        );
      }

      console.log("✅ Rubricile din tabela user_meta_connections s-au completat automat cu succes!");

    } else {
      // Dacă rubrica era deja plină, folosim datele salvate anterior
      pageId = metaData.fb_page_id;
      pageAccessToken = metaData.fb_page_access_token;
      pageName = metaData.fb_page_name || "Pagina ta";
    }

    // 4. Trimitem postarea dinamic cu datele preluate
    const result = await publishFacebookPost({
      pageId: pageId,
      pageAccessToken: pageAccessToken,
      message,
      imageUrl,
      scheduledPublishTime,
    });

    return NextResponse.json({ success: true, pageName, facebook: result }, { status: 200 });

  } catch (err: any) {
    console.error("EROARE INTERNĂ SERVER:", err);
    return NextResponse.json(
      { error: err.message || "Eroare necunoscută la publicare" },
      { status: 500 }
    );
  }
}
