/**
 * app/api/posts/publish/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { publishFacebookPost } from "@/lib/meta";

// Inițializare client Supabase pentru backend
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    // 1. Extrage tokenul de sesiune din header-ul cererii (Bearer token)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Lipsesc credențialele de acces" }, { status: 401 });
    }
    const token = authHeader.split(" ")[1];

    // 2. Verifică utilizatorul în Supabase Auth folosind tokenul primit
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: "Utilizator neautorizat sau sesiune expirată" }, { status: 401 });
    }

    // 3. Extragere body JSON
    const body = await req.json();
    const { message, imageUrl, scheduledPublishTime } = body;

    if (!message) {
      return NextResponse.json(
        { error: "Câmpul 'message' este obligatoriu." },
        { status: 400 }
      );
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

    // 4. Extrage token-ul și ID-ul paginii Meta salvate în baza de date pentru acest user.id
    // Setează noul client să folosească tokenul utilizatorului pentru a respecta regulile RLS (Row Level Security)
    const supabaseWithUser = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: metaData, error: dbError } = await supabaseWithUser
      .from("user_meta_connections") // Înlocuiește cu numele exact al tabelei tale
      .select("fb_page_id, fb_page_access_token")
      .eq("user_id", user.id)
      .single();

    if (dbError || !metaData?.fb_page_access_token || !metaData?.fb_page_id) {
      return NextResponse.json(
        { error: "Contul sau pagina de Facebook nu sunt configurate pe platformă." },
        { status: 400 }
      );
    }

    // 5. Trimite postarea dinamic folosind credențialele extrase din Supabase
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
