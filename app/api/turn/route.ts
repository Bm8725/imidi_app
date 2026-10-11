// app/api/turn/route.ts
// Returns short-lived TURN credentials (Cloudflare Realtime TURN).
// Only signed-in users can call it, and the long-lived key never reaches the browser.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

export async function GET(req: NextRequest) {
  // 1) must be signed in
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return NextResponse.json({ iceServers: [], message: "Unauthorized." }, { status: 401, headers: noStore });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return NextResponse.json({ iceServers: [], message: "Unauthorized." }, { status: 401, headers: noStore });
  }

  // 2) server-side secrets (never NEXT_PUBLIC_)
  const keyId = process.env.CLOUDFLARE_TURN_KEY_ID;
  const apiToken = process.env.CLOUDFLARE_TURN_KEY_TOKEN;
  if (!keyId || !apiToken) {
    return NextResponse.json(
      { iceServers: [], message: "TURN is not configured on the server." },
      { headers: noStore }
    );
  }

  // 3) ask Cloudflare for credentials that expire after 1 hour
  try {
    const res = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ttl: 3600 }),
        cache: "no-store",
      }
    );

    if (!res.ok) {
      return NextResponse.json(
        { iceServers: [], message: `TURN provider responded with ${res.status}. Check the key ID and token.` },
        { status: 502, headers: noStore }
      );
    }

    const json = await res.json();
    const iceServers = Array.isArray(json.iceServers)
      ? json.iceServers
      : json.iceServers
      ? [json.iceServers]
      : [];

    return NextResponse.json({ iceServers }, { headers: noStore });
  } catch {
    return NextResponse.json(
      { iceServers: [], message: "Could not reach the TURN provider." },
      { status: 502, headers: noStore }
    );
  }
}