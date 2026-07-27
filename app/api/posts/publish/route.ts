/**
 * app/api/posts/publish/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { publishFacebookPost } from "@/lib/meta";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(req: NextRequest) {
  try {
    // 1. Extrage token-ul de acces direct din cookie-urile Supabase din browser
    const cookieStore = await cookies();
    
    // Numele standard al cookie-ului Supabase pentru proiectul tău
    // Înlocuiește 'sb-access-token' cu cel configurat de tine dacă ai un custom prefix
    const supabaseCookie = cookieStore.get("sb-access-token")?.value;

    if (!supabaseCookie) {
      return NextResponse.json(
        { error: "Sesiune lipsă sau expirată. Te rugăm să te reautentifici." },
        { status: 401 }
      );
    }

    // 2. Inițializează un client Supabase securizat, injectând token-ul userului în headers
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${supabaseCookie}`,
        },
      },
    });

    // 3. Validează userul și obține ID-ul lui securizat de pe serverul Supabase Auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Utilizator neautorizat" }, { status: 401 });
    }

    // 4. Extragere și validare body JSON
    const body = await req.json();
    const { message, imageUrl, scheduledPublishTime } = body;

    if (!message) {
      return NextResponse.json({ error: "Câmpul 'message' este obligatoriu." }, { status: 400 });
    }

    if (scheduledPublishTime) {
      const minTime = Math.floor(Date.now() / 1000) + 10 * 60;
      if (scheduledPublishTime < minTime) {
        return NextResponse.json(
          { error: "scheduledPublishTime trebuie să fie cu minim 10 minute în viitor." },
          { status: 400 }
        );
      }
    }

    // 5. Interoghează baza de date pentru a lua credențialele Meta ale acestui user
    const { data: metaData, error: dbError } = await supabase
      .from("user_meta_connections") // Pune aici denumirea exactă a tabelei tale
      .select("fb_page_id, fb_page_access_token")
      .eq("user_id", user.id)
      .single();

    if (dbError || !metaData?.fb_page_access_token || !metaData?.fb_page_id) {
      return NextResponse.json(
        { error: "Contul sau pagina de Facebook nu sunt configurate în profilul tău." },
        { status: 400 }
      );
    }

    // 6. Lansează postarea dinamic
    const result = await publishFacebookPost({
      pageId: metaData.fb_page_id,
      pageAccessToken: metaData.fb_page_access_token,
      message,
      imageUrl,
      scheduledPublishTime,
    });

    return NextResponse.json({ facebook: result }, { status: 200 });

  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Eroare necunoscută la publicare" },
      { status: 500 }
    );
  }
}
