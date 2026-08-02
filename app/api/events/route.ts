// app/api/events/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("CONFIG_ERROR: Supabase env vars lipsesc.");
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const supabase = getSupabaseAdmin();
    const country = req.headers.get("x-vercel-ip-country") ?? null;

    // Verificăm userul din access_token-ul trimis de client (Bearer token),
    // NU dintr-un cookie — la voi sesiunea Supabase stă în localStorage,
    // deci clientul trebuie să trimită explicit token-ul.
    let userId: string | null = null;
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const { data, error } = await supabase.auth.getUser(token);
      if (!error) userId = data?.user?.id ?? null;
    }

    // Caz 1: creare sesiune nouă
    if (body.create_session) {
      const { session_id, first_path, referrer, device } = body;
      if (!session_id) return new NextResponse(null, { status: 204 });

      await supabase.from("sessions").upsert(
        {
          id: session_id,
          user_id: userId,
          first_path: first_path ?? null,
          referrer: referrer ?? null,
          device: device ?? null,
          country,
        },
        { onConflict: "id" }
      );

      return new NextResponse(null, { status: 204 });
    }

    // Caz 2: eveniment normal (pageview, click, page_exit, custom)
    const { session_id, event_name, path, properties, time_on_previous_page_ms } = body;
    if (!session_id || !event_name) return new NextResponse(null, { status: 204 });

    await Promise.all([
      supabase.from("session_events").insert({
        session_id,
        event_name: String(event_name).slice(0, 100),
        path: path ? String(path).slice(0, 500) : null,
        properties: properties ?? null,
        time_on_previous_page_ms: time_on_previous_page_ms ?? null,
      }),
      // dacă între timp userul s-a logat, actualizăm și user_id pe sesiune
      supabase
        .from("sessions")
        .update({
          last_seen_at: new Date().toISOString(),
          ...(userId ? { user_id: userId } : {}),
        })
        .eq("id", session_id),
    ]);

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("Eroare la salvarea evenimentului:", err);
    return new NextResponse(null, { status: 204 });
  }
}