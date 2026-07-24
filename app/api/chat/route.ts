import { NextResponse } from "next/server";
import Groq from "groq-sdk";

// Definim URL-urile de unde chatbot-ul își va extrage datele automat
const SITE_URLS = [
  "https://imidi.co.uk",
  // Poți adăuga și alte subpagini relevante aici, de exemplu:
   "https://imidi.co.uk/e-market",
   "https://imidi.co.uk/downloads",
   "https://imidi.co.uk/ts4x",
   "https://imidi.co.uk/forum"
];

// Funcție care descarcă conținutul site-ului și îl transformă în text curat (Markdown)
async function fetchSiteKnowledge(): Promise<string> {
  try {
    let combinedText = "";

    for (const url of SITE_URLS) {
      // Folosim API-ul gratuit Jina Reader care transformă orice site în text curat pentru AI
      const response = await fetch(`https://jina.ai{url}`, {
        headers: { "Accept": "application/json" }
      });
      
      if (response.ok) {
        const data = await response.json();
        combinedText += `\n\n--- DATE EXTRASE AUTOMAT DE PE URL-UL: ${url} ---\n`;
        combinedText += data.data?.content || "";
      }
    }

    return combinedText || "Nu s-au putut extrage date automate.";
  } catch (error) {
    console.error("Eroare la scraping automat:", error);
    return "Eroare la încărcarea bazei de cunoștințe în timp real.";
  }
}

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "Lipsește GROQ_API_KEY" }, { status: 500 });
    }

    const groq = new Groq({ apiKey });

    // PASUL MAGIC: AI-ul își ia singur datele actualizate de pe site chiar acum!
    const AUTOMATIC_KNOWLEDGE_BASE = await fetchSiteKnowledge();

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `Ești asistentul AI oficial al platformei iMIDI (imidi.co.uk).
          Misiunea ta este să ajuți utilizatorii cu detalii despre produse, prețuri și funcționalități.
          
          REGULI STRICTE:
          1. Răspunde POLITICOS și folosește limba română (sau limba în care te întreabă utilizatorul).
          2. Folosește EXCLUSIV datele extrase automat de pe site-ul nostru, listate mai jos.
          3. Dacă o informație (preț, stoc, specificație) NU se află în textul de mai jos, spune sincer că nu o știi și îndrumă utilizatorul să verifice direct pe site sau să contacteze echipa la suport. Nu inventa nimic!

          BAZA DE CUNOȘTINȚE EXTRASĂ AUTOMAT ÎN TIMP REAL:
          ${AUTOMATIC_KNOWLEDGE_BASE}`
        },
        ...messages
      ],
      max_tokens: 400,
      temperature: 0.1, // Temperatură foarte mică pentru a preveni halucinațiile (AI-ul nu va inventa nimic)
    });

    const aiText = response.choices?.[0]?.message?.content || "";
    return NextResponse.json({ generated_text: aiText });

  } catch (error: any) {
    console.error("Groq API Error:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
