import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin"; // Clientul tău admin

export async function GET(req: NextRequest) {
  try {
    // 1. Extragem tokenul de autentificare din Header-ul trimis de Front-End
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ connected: false, error: "Lipseste tokenul de autentificare" }, { status: 41 }) ;
    }

    const token = authHeader.split(" ")[1];

    // 2. Validăm tokenul cu Supabase pentru a afla ID-ul utilizatorului curent
    const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !user) {
      return NextResponse.json({ connected: false, error: "Sesiune invalida in server" }, { status: 401 });
    }

    // 3. Căutăm conexiunea salvată în tabela din baza de date
    const { data: connection, error: dbErr } = await supabaseAdmin
      .from("user_meta_connections")
      .select("fb_page_id, fb_page_name")
      .eq("user_id", user.id)
      .maybeSingle(); // Returnează null dacă nu găsește, nu dă eroare crash

    if (dbErr) throw dbErr;

    // 4. Returnăm datele brute către pagina ta de test
    if (connection && connection.fb_page_id) {
      return NextResponse.json({
        connected: true,
        pageName: connection.fb_page_name,
        pageId: connection.fb_page_id,
        connectedAt: connection.connected_at
      });
    }

    // Dacă tabela este goală pentru acest user
    return NextResponse.json({
      connected: false,
      pageName: null,
      message: "Nu exista nicio configurare salvata in baza de date pentru acest user."
    });

  } catch (err: any) {
    console.error("Eroare in /api/meta/status:", err);
    return NextResponse.json({ connected: false, error: err.message }, { status: 500 });
  }
}
