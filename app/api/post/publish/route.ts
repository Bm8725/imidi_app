/**
 * app/api/posts/publish/route.ts
 *
 * Endpoint pentru publicare/programare postări pe Facebook.
 *
 * Body JSON:
 * {
 *   "message": "text postare",
 *   "imageUrl": "https://...",              // opțional
 *   "scheduledPublishTime": 1753900000       // opțional, unix timestamp
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { publishFacebookPost } from "@/lib/meta";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, imageUrl, scheduledPublishTime } = body;

    if (!message) {
      return NextResponse.json(
        { error: "Câmpul 'message' este obligatoriu." },
        { status: 400 }
      );
    }

    if (scheduledPublishTime) {
      const minTime = Math.floor(Date.now() / 1000) + 10 * 60; // +10 minute
      if (scheduledPublishTime < minTime) {
        return NextResponse.json(
          { error: "scheduledPublishTime trebuie să fie cu minim 10 minute în viitor." },
          { status: 400 }
        );
      }
    }

    const result = await publishFacebookPost({ message, imageUrl, scheduledPublishTime });

    return NextResponse.json({ facebook: result }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Eroare necunoscută la publicare" },
      { status: 500 }
    );
  }
}