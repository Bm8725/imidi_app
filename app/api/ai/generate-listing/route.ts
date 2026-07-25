/*
Smith AI 
model: "llama-3.3-70b-versatile", groq based.
author : BM26
*/

import { NextResponse } from "next/server";
import Groq from "groq-sdk";

export async function POST(req: Request) {
  try {
    const { keywords, category, price } = await req.json();
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "Lipseste GROQ_API_KEY" }, { status: 500 });
    }
    if (!keywords || keywords.trim().length < 3) {
      return NextResponse.json({ error: "Scrie cateva cuvinte despre ce vinzi." }, { status: 400 });
    }

    const groq = new Groq({ apiKey });

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `Esti un asistent care scrie anunturi de vanzare pentru iMIDI Market, o platforma de instrumente muzicale si preseturi.
Primesti cateva cuvinte cheie de la vanzator si generezi un anunt clar, onest si atragator.

REGULI STRICTE:
- Raspunde DOAR cu un obiect JSON valid, fara text in plus, fara backtick-uri, fara markdown.
- Format exact: {"title": "...", "description": "..."}
- "title": maxim 60 de caractere, clar, fara emoji, fara majuscule excesive.
- "description": 3-6 propozitii scurte, in limba romana, ton natural de vanzator privat (nu corporate). Mentioneaza DOAR detalii pe care vanzatorul chiar le-a dat in cuvintele cheie. Nu inventa specificatii tehnice, stare, accesorii sau garantii care nu au fost mentionate explicit.
- Categoria anuntului: ${category === "preset" ? "preset sau pachet digital pentru DAW/synth" : "instrument muzical fizic"}.
${price ? `- Pretul este ${price} EUR, poti sa il mentionezi natural in descriere daca se potriveste, nu e obligatoriu.` : ""}`,
        },
        {
          role: "user",
          content: `Cuvinte cheie / detalii de la vanzator: ${keywords}`,
        },
      ],
      max_tokens: 300,
      temperature: 0.7,
    });

    const raw = response.choices?.[0]?.message?.content || "{}";
    const cleaned = raw.replace(/```json|```/g, "").trim();

    let parsed: { title?: string; description?: string };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: "Raspuns AI invalid, incearca din nou." }, { status: 500 });
    }

    return NextResponse.json({
      title: (parsed.title || "").slice(0, 80),
      description: parsed.description || "",
    });
  } catch (error: any) {
    console.error("AI generate-listing error:", error);
    return NextResponse.json({ error: error?.message || "Eroare interna." }, { status: 500 });
  }
}