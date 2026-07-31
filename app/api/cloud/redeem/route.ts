import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("CONFIG_ERROR: Supabase URL sau SERVICE_ROLE_KEY lipsesc din setarile Vercel.");
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

    // Extragere sigură: verificăm dacă `data` este o listă (folosește data[0]) sau un obiect direct
    const resultData = Array.isArray(data) ? data[0] : data;

    if (!resultData || !resultData.storage_path || !resultData.filename) {
      return NextResponse.json(
        { error: "Cod incorect sau link expirat/folosit deja." },
        { status: 400 }
      );
    }

    const { storage_path, filename } = resultData;

    // TTL marit la 30 min (nu 120s): codul e single-use, iar acum download-ul
    // are progres real + retry cu backoff, deci poate dura mai mult decat 2 minute
    // pe conexiuni lente. Daca linkul expira in timp ce codul e deja consumat,
    // cumparatorul ramane blocat fara sa poata genera altul.
    const { data: signed, error: signError } = await supabaseAdmin.storage
      .from("cloud-db-bucket")
      .createSignedUrl(storage_path, 1800);

    if (signError || !signed) {
      return NextResponse.json(
        { error: signError?.message || "Fisierul nu a putut fi accesat. Contacteaza vanzatorul." },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: signed.signedUrl, filename });
  } catch (err: any) {
    console.error("Eroare pe ruta de redeem:", err);
    
    // Trimitem mesajul real de eroare în response pentru a vedea exact problema pe ecran fără să mai cauți în loguri
    return NextResponse.json(
      { error: err?.message || "Eroare interna server." }, 
      { status: 500 }
    );
  }
}