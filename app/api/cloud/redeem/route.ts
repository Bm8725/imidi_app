import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("CONFIG_ERROR: Supabase URL sau SERVICE_ROLE_KEY lipsesc din setarile Vercel.");
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}

// ---- NOU: Metodă GET care extrage numele în siguranță de pe server ----
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) return NextResponse.json({ seller_name: "Verified iMIDI Seller" });

    const supabaseAdmin = getSupabaseAdmin();

    // Rulăm o interogare sigură pe tabelul de share-uri din sistemul tău
    // Încercăm întâi tabelul standard de linkuri create de RPC-ul tău
    const { data: shareData } = await supabaseAdmin
      .from("share_links") 
      .select("user_id")
      .eq("token", token)
      .maybeSingle();

    const userId = shareData?.user_id;

    if (!userId) {
      return NextResponse.json({ seller_name: "Verified iMIDI Seller" });
    }

    // Luăm numele din metadatele contului de Auth Supabase (Funcționează și pt Facebook/Spotify/Email)
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
    const finalName = authUser?.user?.user_metadata?.full_name || authUser?.user?.email?.split("@")[0];

    return NextResponse.json({ seller_name: finalName || "Verified iMIDI Seller" });
  } catch (err) {
    return NextResponse.json({ seller_name: "Verified iMIDI Seller" });
  }
}

// ---- Funcția ta POST neschimbată ----
export async function POST(req: NextRequest) {
  try {
    const { token, code } = await req.json();

    if (!token || !code || typeof code !== "string") {
      return NextResponse.json({ error: "Date lipsa." }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const { data, error } = await supabaseAdmin.rpc("redeem_share_link", {
      p_token: token,
      p_code: code,
    });

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message || "Cod incorect sau link expirat/folosit deja." },
        { status: 400 }
      );
    }

    const resultData = Array.isArray(data) ? data[0] : data;

    if (!resultData || !resultData.storage_path || !resultData.filename) {
      return NextResponse.json(
        { error: "Cod incorect sau link expirat/folosit deja." },
        { status: 400 }
      );
    }

    const { storage_path, filename } = resultData;

    const { data: signed, error: signError } = await supabaseAdmin.storage
      .from("cloud-db-bucket")
      .createSignedUrl(storage_path, 120);

    if (signError || !signed) {
      return NextResponse.json(
        { error: signError?.message || "Fisierul nu a putut fi accesat. Contacteaza vanzatorul." },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: signed.signedUrl, filename });
  } catch (err: any) {
    console.error("Eroare pe ruta de redeem:", err);
    return NextResponse.json(
      { error: err?.message || "Eroare interna server." }, 
      { status: 500 }
    );
  }
}
