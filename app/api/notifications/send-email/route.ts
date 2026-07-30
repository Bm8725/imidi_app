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

Trimitere email: SMTP propriu (cPanel), prin Nodemailer — trebuie instalat pachetul:
  npm install nodemailer
  npm install -D @types/nodemailer

Env vars necesare (.env.local):
  NEXT_PUBLIC_SUPABASE_URL=...          (probabil il ai deja, il refolosim)
  SUPABASE_SERVICE_ROLE_KEY=...         (din Supabase -> Settings -> API, PRIVAT, NU e cheia publica/anon)
  SMTP_HOST=mail.domeniul-tau.com       (din cPanel -> Email Accounts -> Connect Devices)
  SMTP_PORT=587                         (sau 465, vezi cPanel)
  SMTP_USER=adresa@domeniul-tau.com
  SMTP_PASS=parola-contului-de-email
  SMTP_FROM="iMIDI Market <adresa@domeniul-tau.com>"   (optional, altfel foloseste SMTP_USER)
  SUPABASE_WEBHOOK_SECRET=...           (orice string random, ales de tine, PRIVAT)
  SITE_URL=...                          (optional, doar pt link-urile din email)
*/

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

// Client Supabase cu service role — necesar ca sa putem citi emailul userului
// (auth.users nu e accesibil cu cheia publica / anon).
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// SMTP propriu (cPanel) — vezi .env.local pentru SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: Number(process.env.SMTP_PORT) === 465, // true doar pe portul 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

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

    const siteUrl = process.env.SITE_URL || "https://imidi.co.uk";

    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || `"iMIDI Market" <${process.env.SMTP_USER}>`,
        to: userData.user.email,
        subject: notification.title,
        html: buildEmailHtml(notification, siteUrl),
      });
    } catch (sendError) {
      console.error("Eroare trimitere email SMTP:", sendError);
      return NextResponse.json({ error: "Email send failed" }, { status: 500 });
    }

    return NextResponse.json({ sent: true });
  } catch (error: any) {
    console.error("send-email webhook error:", error);
    return NextResponse.json({ error: error?.message || "Eroare interna." }, { status: 500 });
  }
}