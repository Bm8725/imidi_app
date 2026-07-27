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

    if (!supabaseToken) {
      return NextResponse.json(
        { error: "Sesiune lipsă sau expirată. Te rugăm să te reautentifici." },
        { status: 401 }
      );
    }

    if (!message) {
      return NextResponse.json({ error: "Câmpul 'message' este obligatoriu." }, { status: 400 });
    }

    // 1. Inițializăm clientul Supabase cu token-ul primit
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${supabaseToken}`,
        },
      },
    });

    // 2. Luăm datele complete ale utilizatorului logat
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Utilizator neautorizat." }, { status: 401 });
    }

    // 3. Extragem identitatea de Facebook pe care Supabase o are deja salvată nativ
    const fbIdentity = user.identities?.find((id) => id.provider === "facebook");
    
    // ID-ul de utilizator Facebook și token-ul lui de acces oferit la login
    const fbUserId = fbIdentity?.id; 
    const fbUserToken = fbIdentity?.identity_data?.access_token;

    if (!fbUserId || !fbUserToken) {
      return NextResponse.json(
        { error: "Nu am găsit un cont de Facebook conectat la profilul tău Supabase." },
        { status: 400 }
      );
    }

    // 4. Publicăm postarea folosind datele preluate nativ din logare
    // NOTĂ: fbUserId este ID-ul de profil. Pentru pagini de brand, Meta recomandă Page ID, 
    // dar poți posta direct pe profilul/pagina implicită legată prin acest token.
    const result = await publishFacebookPost({
      pageId: fbUserId, 
      pageAccessToken: fbUserToken,
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
