import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// service role — bypass total la RLS si la policy-urile de storage.
// NU folosi acest client in cod care ruleaza in browser.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

export async function POST(req: NextRequest) {
  try {
    const { token, code } = await req.json();

    if (!token || !code || typeof code !== "string") {
      return NextResponse.json({ error: "Date lipsa." }, { status: 400 });
    }

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
  } catch {
    return NextResponse.json({ error: "Eroare interna." }, { status: 500 });
  }
}