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
            "Sesiune Facebook sau Supabase lipsă. Te rugăm să reîmprospătezi pagina imidi.co.uk.",
        },
        { status: 401 }
      );
    }

    if (!message) {
      return NextResponse.json(
        { error: "Câmpul 'message' este obligatoriu." },
        { status: 400 }
      );
    }

    // 1. Inițializăm clientul Supabase cu sesiunea utilizatorului
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${supabaseToken}`,
        },
      },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Utilizator neautorizat." },
        { status: 401 }
      );
    }

    let pageId = "";
    let pageAccessToken = "";
    let pageName = "";

    // 2. Citim conexiunea Meta din Supabase
    const { data: metaData } = await supabase
      .from("user_meta_connections")
      .select("fb_page_id, fb_page_access_token, fb_page_name")
      .eq("user_id", user.id)
      .maybeSingle();

    // 3. Dacă nu există încă în DB, o completăm automat
    if (!metaData?.fb_page_access_token || !metaData?.fb_page_id) {
      const metaPagesRes = await fetch(
        "https://graph.facebook.com/v23.0/me/accounts",
        {
          headers: {
            Authorization: `Bearer ${userFbToken}`,
          },
        }
      );

      const metaPagesData = await metaPagesRes.json();

      if (!metaPagesRes.ok) {
        return NextResponse.json(
          {
            error:
              metaPagesData?.error?.message ||
              "Nu s-au putut obține paginile Facebook.",
          },
          { status: 400 }
        );
      }

      if (
        !metaPagesData.data ||
        !Array.isArray(metaPagesData.data) ||
        metaPagesData.data.length === 0
      ) {
        return NextResponse.json(
          {
            error:
              "Nu am găsit nicio Pagină Facebook asociată acestui cont.",
          },
          { status: 400 }
        );
      }

      // Prima pagină găsită
      const primaryPage = metaPagesData.data[0];

      pageId = primaryPage.id;
      pageName = primaryPage.name;
      pageAccessToken = primaryPage.access_token;

      // Salvăm automat în Supabase
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
        console.error("Supabase save error:", saveError);
      }
    } else {
      // Există deja în DB
      pageId = metaData.fb_page_id;
      pageAccessToken = metaData.fb_page_access_token;
      pageName = metaData.fb_page_name || "Pagina ta";
    }

    // 4. Publicăm postarea
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
      { status: 200 }
    );
  } catch (err: any) {
    console.error(err);

    return NextResponse.json(
      {
        error: err.message || "Eroare necunoscută la publicare.",
      },
      {
        status: 500,
      }
    );
  }
}