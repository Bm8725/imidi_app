/*
Notificari pe email — trimise automat de un Supabase Database Webhook
la fiecare INSERT in tabela `notifications`.

Setup necesar (o singura data, in Supabase Dashboard):
  Database -> Webhooks -> Create a new webhook
    Table: notifications
    Events: Insert
    Type: HTTP Request
    Method: POST
    URL: https://<domeniul-tau>/api/notifications/send-email
    Headers: x-webhook-secret: <valoarea din SUPABASE_WEBHOOK_SECRET>

Env vars necesare (.env.local):
  RESEND_API_KEY=...
  RESEND_FROM_EMAIL="iMIDI Market <notificari@domeniul-tau.com>"
  SUPABASE_WEBHOOK_SECRET=...           (orice string random, ales de tine)
  SUPABASE_SERVICE_ROLE_KEY=...         (din Supabase -> Settings -> API, NU e cheia publica)
  NEXT_PUBLIC_SUPABASE_URL=...
*/

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

// Client Supabase cu service role — necesar ca sa putem citi emailul userului
// (auth.users nu e accesibil cu cheia publica / anon).
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY);

interface NotificationRow {
  id: string;
  title: string;
  message: string;
  href: string | null;
  image: string | null;
  user_id: string | null;
  listing_id: string | null;
  created_at: string;
}

interface SupabaseWebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: NotificationRow;
  old_record: NotificationRow | null;
}

function buildEmailHtml(notification: NotificationRow, siteUrl: string) {
  const link = notification.href
    ? `${siteUrl}${notification.href.startsWith("/") ? "" : "/"}${notification.href}`
    : siteUrl;

  return `
  <div style="font-family: -apple-system, Inter, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
    <div style="background: linear-gradient(135deg, #0070F3, #8B5CF6); border-radius: 16px; padding: 2px;">
      <div style="background: #fff; border-radius: 14px; padding: 24px;">
        ${
          notification.image
            ? `<img src="${notification.image}" alt="" style="width: 100%; max-height: 160px; object-fit: cover; border-radius: 10px; margin-bottom: 16px;" />`
            : ""
        }
        <h2 style="margin: 0 0 8px; font-size: 16px; color: #111;">${escapeHtml(notification.title)}</h2>
        <p style="margin: 0 0 20px; font-size: 13px; color: #555; line-height: 1.5;">${escapeHtml(notification.message)}</p>
        <a href="${link}" style="display: inline-block; background: linear-gradient(135deg, #0070F3, #8B5CF6); color: #fff; text-decoration: none; font-size: 12px; font-weight: 600; padding: 10px 20px; border-radius: 10px;">
          Vezi pe iMIDI Market
        </a>
      </div>
    </div>
    <p style="text-align: center; font-size: 10px; color: #aaa; margin-top: 16px;">
      Primești acest email pentru că ai notificări active pe iMIDI Market.
    </p>
  </div>`;
}

function escapeHtml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function POST(req: Request) {
  try {
    // Verificam ca request-ul chiar vine de la webhook-ul nostru Supabase
    const secret = req.headers.get("x-webhook-secret");
    if (!secret || secret !== process.env.SUPABASE_WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload: SupabaseWebhookPayload = await req.json();

    if (payload.type !== "INSERT" || payload.table !== "notifications") {
      return NextResponse.json({ skipped: true });
    }

    const notification = payload.record;

    if (!notification.user_id) {
      console.warn("Notificare fara user_id, nu pot trimite email:", notification.id);
      return NextResponse.json({ skipped: true, reason: "no_user_id" });
    }

    // Luam emailul userului din auth.users
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(
      notification.user_id
    );

    if (userError || !userData?.user?.email) {
      console.error("Nu am gasit emailul userului:", notification.user_id, userError);
      return NextResponse.json({ error: "User email not found" }, { status: 404 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://imidi.co.uk";

    const { error: sendError } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "iMIDI Market <connect@imidi.co.uk>",
      to: userData.user.email,
      subject: notification.title,
      html: buildEmailHtml(notification, siteUrl),
    });

    if (sendError) {
      console.error("Eroare trimitere email Resend:", sendError);
      return NextResponse.json({ error: "Email send failed" }, { status: 500 });
    }

    return NextResponse.json({ sent: true });
  } catch (error: any) {
    console.error("send-email webhook error:", error);
    return NextResponse.json({ error: error?.message || "Eroare interna." }, { status: 500 });
  }
}