import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin"; // Clientul tău admin

export async function GET(req: NextRequest) {
  try {
    // 1. Extragem tokenul de autentificare din Header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ connected: false, error: "Lipseste tokenul de autentificare" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];

    // 2. Validăm tokenul cu Supabase
    const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !user) {
      return NextResponse.json({ connected: false, error: "Sesiune invalida in server" }, { status: 401 });
    }

    // 3. Căutăm conexiunea (FĂRĂ connected_at, doar datele esențiale)
    const { data: connection, error: dbErr } = await supabaseAdmin
      .from("user_meta_connections")
      .select("fb_page_id, fb_page_name")
      .eq("user_id", user.id)
      .maybeSingle(); 

    if (dbErr) throw dbErr;

    // 4. Returnăm datele către pagina ta de test
    if (connection && connection.fb_page_id) {
      return NextResponse.json({
        connected: true,
        pageName: connection.fb_page_name,
        pageId: connection.fb_page_id
      });
    }

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
