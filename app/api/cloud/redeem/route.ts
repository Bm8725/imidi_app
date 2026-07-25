import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Definim o funcție helper pentru a obține clientul de admin doar când avem nevoie de el
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Supabase URL sau SERVICE_ROLE_KEY lipsesc din variabilele de mediu.");
  }

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const { token, code } = await req.json();

    if (!token || !code || typeof code !== "string") {
      return NextResponse.json({ error: "Date lipsa." }, { status: 400 });
    }

    // Inițializăm clientul în interiorul rutei ca să nu blocheze build-ul static
    const supabaseAdmin = getSupabaseAdmin();

    const { data, error } = await supabaseAdmin.rpc("redeem_share_link", {
      p_token: token,
      p_code: code,
    });

    if (error || !data || data.length === 0) {
      return NextResponse.json(
        { error: "Cod incorect sau link expirat/folosit deja." },
        { status: 400 }
      );
    }

    const { storage_path, filename } = data[0];

    const { data: signed, error: signError } = await supabaseAdmin.storage
      .from("cloud-db-bucket")
      .createSignedUrl(storage_path, 120);

    if (signError || !signed) {
      return NextResponse.json(
        { error: "Fisierul nu a putut fi accesat. Contacteaza vanzatorul." },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: signed.signedUrl, filename });
  } catch (err) {
    console.error("Eroare pe ruta de redeem:", err);
    return NextResponse.json({ error: "Eroare interna." }, { status: 500 });
  }
}
