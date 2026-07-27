/**
 * app/api/posts/publish/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { publishFacebookPost } from "@/lib/meta";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      message,
      imageUrl,
      scheduledPublishTime,
      supabaseToken,
      userFbToken,
    } = body;

    if (!supabaseToken || !userFbToken) {
      return NextResponse.json(
        {
          error:
            "Sesiune Facebook sau Supabase lipsă. Reconectează contul.",
        },
        { status: 401 }
      );
    }

    if (!message || !message.trim()) {
      return NextResponse.json(
        {
          error: "Mesajul este obligatoriu.",
        },
        { status: 400 }
      );
    }


    // ==============================
    // SUPABASE USER AUTH
    // ==============================

    const supabase = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: {
            Authorization: `Bearer ${supabaseToken}`,
          },
        },
      }
    );


    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();


    if (authError || !user) {
      return NextResponse.json(
        {
          error: "Utilizator neautorizat.",
        },
        { status: 401 }
      );
    }



    // ==============================
    // GET FACEBOOK PAGE TOKEN
    // ==============================

    const metaPagesRes = await fetch(
      "https://graph.facebook.com/v23.0/me/accounts",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${userFbToken}`,
        },
      }
    );


    const metaPagesData = await metaPagesRes.json();


    if (!metaPagesRes.ok) {
      console.error(
        "META PAGE ERROR:",
        metaPagesData
      );

      return NextResponse.json(
        {
          error:
            metaPagesData?.error?.message ||
            "Facebook nu a returnat paginile.",
        },
        { status: 400 }
      );
    }



    if (
      !metaPagesData.data ||
      metaPagesData.data.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "Nu există pagini Facebook asociate sau lipsesc permisiunile.",
        },
        { status: 400 }
      );
    }



    const page = metaPagesData.data[0];


    const pageId = page.id;
    const pageName = page.name;
    const pageAccessToken = page.access_token;



    // ==============================
    // SAVE CONNECTION
    // ==============================


    const { error: saveError } = await supabase
      .from("user_meta_connections")
      .upsert(
        {
          user_id: user.id,
          fb_page_id: pageId,
          fb_page_name: pageName,
          fb_page_access_token: pageAccessToken,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id",
        }
      );


    if (saveError) {
      console.error(
        "SUPABASE SAVE ERROR:",
        saveError
      );
    }



    // ==============================
    // PUBLISH FACEBOOK POST
    // ==============================


    const result = await publishFacebookPost({
      pageId,
      pageAccessToken,
      message,
      imageUrl,
      scheduledPublishTime,
    });



    return NextResponse.json(
      {
        success: true,
        pageName,
        facebook: result,
      },
      {
        status: 200,
      }
    );



  } catch (error: any) {

    console.error(
      "PUBLISH ERROR:",
      error
    );


    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          "Eroare necunoscută la publicare.",
      },
      {
        status: 500,
      }
    );
  }
}