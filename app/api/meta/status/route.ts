/**
 * app/api/meta/status/route.ts
 * Returnează dacă userul curent are o pagină Facebook conectată,
 * fără să expună niciodată tokenul brut către client.
 */

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const accessToken = authHeader?.replace("Bearer ", "");
    if (!accessToken) {
      return NextResponse.json({ connected: false }, { status: 401 });
    }

    const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(accessToken);
    if (userErr || !user) {
      return NextResponse.json({ connected: false }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from("user_meta_connections")
      .select("fb_page_name")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({ connected: !!data, pageName: data?.fb_page_name || null });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}