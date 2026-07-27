/**
 * app/api/post/publish/route.ts
 *
 * Endpoint pentru publicare/programare postări pe Facebook.
 * Ia automat page_id + page_access_token din meta_connections,
 * pe baza userului autentificat — nimic hardcodat în .env.
 *
 * Header: Authorization: Bearer <supabase session access_token>
 * Body: { message, imageUrl?, scheduledPublishTime? }
 */

import { NextRequest, NextResponse } from "next/server";
import { publishFacebookPost } from "@/lib/meta";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const accessToken = authHeader?.replace("Bearer ", "");
    if (!accessToken) {
      return NextResponse.json({ error: "Neautentificat." }, { status: 401 });
    }

    const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(accessToken);
    if (userErr || !user) {
      return NextResponse.json({ error: "Sesiune invalidă." }, { status: 401 });
    }

    const { data: connection, error: connErr } = await supabaseAdmin
      .from("user_meta_connections")
      .select("fb_page_id, fb_page_access_token")
      .eq("user_id", user.id)
      .maybeSingle();

    if (connErr) throw connErr;
    if (!connection) {
      return NextResponse.json(
        { error: "Contul Facebook nu este conectat. Conectează-l mai întâi." },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { message, imageUrl, scheduledPublishTime } = body;

    if (!message) {
      return NextResponse.json({ error: "Câmpul 'message' este obligatoriu." }, { status: 400 });
    }

    if (scheduledPublishTime) {
      const minTime = Math.floor(Date.now() / 1000) + 10 * 60;
      if (scheduledPublishTime < minTime) {
        return NextResponse.json(
          { error: "scheduledPublishTime trebuie să fie cu minim 10 minute în viitor." },
          { status: 400 }
        );
      }
    }

    const result = await publishFacebookPost({
      pageId: connection.fb_page_id,
      pageAccessToken: connection.fb_page_access_token,
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