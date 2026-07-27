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
    const { message, imageUrl, scheduledPublishTime, supabaseToken } = body;

    // 1. Verificăm prezența token-ului trimis de pe frontend
    if (!supabaseToken) {
      return NextResponse.json(
        { error: "Sesiune lipsă sau expirată. Te rugăm să te reautentifici." },
        { status: 401 }
      );
    }

    if (!message) {
      return NextResponse.json(
        { error: "Câmpul 'message' este obligatoriu." },
        { status: 400 }
      );
    }

    if (scheduledPublishTime) {
      const minTime = Math.floor(Date.now() / 1000) + 10 * 60; // +10 minute
      if (scheduledPublishTime < minTime) {
        return NextResponse.json(
          { error: "scheduledPublishTime trebuie să fie cu minim 10 minute în viitor." },
          { status: 400 }
        );
      }
    }

    // 2. Inițializăm clientul Supabase folosind token-ul de sesiune al userului
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${supabaseToken}`,
        },
      },
    });

    // 3. Validăm utilizatorul pe serverele Supabase
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: "Utilizator neautorizat sau sesiune expirată." },
        { status: 401 }
      );
    }

    // 4. Extragem automat pagina de Facebook și token-ul ei din baza ta de date
    // (Asigură-te că numele tabelei coincide cu ce ai configurat în Supabase)
    const { data: metaData, error: dbError } = await supabase
      .from("user_meta_connections")
      .select("fb_page_id, fb_page_access_token")
      .eq("user_id", user.id)
      .single();

    if (dbError || !metaData?.fb_page_access_token || !metaData?.fb_page_id) {
      return NextResponse.json(
        { error: "Contul sau pagina de Facebook nu sunt configurate pe platformă." },
        { status: 400 }
      );
    }

    // 5. Publicăm postarea prin Meta API utilizând credențialele dinamice
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
