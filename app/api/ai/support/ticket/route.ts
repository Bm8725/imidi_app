import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(req: Request) {
  try {
    const { form, chatHistory } = await req.json();

    // Structurăm istoricul de chat
    const formattedHistory = chatHistory
      .map((m: any) => `${m.role === "smith" ? "Asistent" : "Utilizator"}: ${m.text}`)
      .join("\n\n");

    // Reutilizăm variabilele tale de mediu existente
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 465,
      secure: true, // Portul 465 folosește SSL implicit
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Trimitem e-mailul direct prin contul tău conectat
    await transporter.sendMail({
      from: `"iMIDI Support Hub" <${process.env.SMTP_USER}>`,
      to: "connect@imidi.ro", // Adresa unde vrei să primești tichetele finale
      subject: `[Support Ticket] ${form.subject || "Problemă nouă"} - ${form.category}`,
      text: `Categorie: ${form.category}\nSubiect: ${form.subject}\n\nIstoric:\n${formattedHistory}`,
      html: `
        <div style="font-family: sans-serif; color: #111; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 12px; bg: #ffffff;">
          <h2 style="font-size: 15px; font-weight: 800; border-bottom: 1px solid #eaeaea; padding-bottom: 10px; color: #4f46e5; margin-top: 0;">iMIDI Support Sync</h2>
          <div style="background: #fafafa; padding: 12px; border-radius: 8px; margin: 15px 0; font-size: 13px; border: 1px solid #f0f0f0;">
            <p style="margin: 0; color: #666;"><strong>Categorie:</strong> ${form.category.toUpperCase()}</p>
            <p style="margin: 4px 0 0 0; color: #111;"><strong>Subiect:</strong> ${form.subject}</p>
          </div>
          <h3 style="font-size: 12px; font-weight: 700; color: #444; margin-bottom: 8px; text-transform: uppercase; tracking-letter: 0.5px;">Istoric conversație:</h3>
          <div style="background: #f4f4f5; padding: 15px; border-radius: 8px; font-family: monospace; font-size: 12px; white-space: pre-wrap; line-height: 1.5; color: #27272a; border: 1px solid #e4e4e7;">${formattedHistory}</div>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("❌ Support SMTP Error:", error);
    return NextResponse.json({ error: error?.message || "Eroare la trimiterea email-ului." }, { status: 500 });
  }
}
