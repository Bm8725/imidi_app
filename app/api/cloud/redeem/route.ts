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

// ---- NOU INTEGRAT: Metoda GET pentru a aduce Numele Vânzătorului ȘI Numele Fișierului ----
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json({ seller_name: "Verified iMIDI Seller", filename: "Digital Content Pack" });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // 1. Căutăm linkul în tabela ta de link-uri active (încercăm rând pe rând denumirile des întâlnite)
    const { data: shareData } = await supabaseAdmin
      .from("share_links") 
      .select("user_id, bank_id, filename, name") // Tragem tot ce ar putea conține numele sau legătura
      .eq("token", token)
      .maybeSingle();

    // Fallback în caz că tabela se numește cloud_shares
    const finalShare = shareData || (await supabaseAdmin.from("cloud_shares").select("user_id, bank_id, filename, name").eq("token", token).maybeSingle()).data;

    let userId = finalShare?.user_id;
    let filename = finalShare?.filename || finalShare?.name || "Digital Content Pack";

    // 2. Dacă avem un ID de fișier (bank_id) dar nu avem numele direct, îl căutăm în tabela cloud_banks
    if (finalShare?.bank_id && filename === "Digital Content Pack") {
      const { data: bankData } = await supabaseAdmin
        .from("cloud_banks")
        .select("name")
        .eq("id", finalShare.bank_id)
        .maybeSingle();
      
      if (bankData?.name) {
        filename = bankData.name;
      }
    }

    // 3. Preluăm numele real al vânzătorului din contul de autentificare
    let sellerName = "Verified iMIDI Seller";
    if (userId) {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (authUser?.user?.user_metadata?.full_name) {
        sellerName = authUser.user.user_metadata.full_name;
      } else if (authUser?.user?.email) {
        sellerName = authUser.user.email.split("@")[0];
      }
    }

    return NextResponse.json({ 
      seller_name: sellerName, 
      filename: filename 
    });

  } catch (err) {
    console.error("Eroare la obținerea detaliilor de share:", err);
    return NextResponse.json({ seller_name: "Verified iMIDI Seller", filename: "Digital Content Pack" });
  }
}

// ---- Funcția ta POST (Lăsată 100% INTACĂ și NEATINSĂ) ----
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
