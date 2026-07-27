/**
 * app/api/posts/publish/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { publishFacebookPost } from "@/lib/meta";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, imageUrl, scheduledPublishTime, fbPageId, fbPageAccessToken } = body;

    // Validăm că am primit datele de Facebook din frontend
    if (!fbPageId || !fbPageAccessToken) {
      return NextResponse.json(
        { error: "Datele de autentificare Facebook lipsesc din cerere." },
        { status: 401 }
      );
    }

    if (!message) {
      return NextResponse.json({ error: "Câmpul 'message' este obligatoriu." }, { status: 400 });
    }

    // Publicăm postarea direct prin Meta API folosind datele primite curat din frontend
    const result = await publishFacebookPost({
      pageId: fbPageId, 
      pageAccessToken: fbPageAccessToken,
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
