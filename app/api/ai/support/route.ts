import { NextResponse } from "next/server";
import Groq from "groq-sdk";

const SUPPORTED_LANGUAGES: Record<string, string> = {
  ro: "Romanian",
  en: "English",
  it: "Italian",
  es: "Spanish",
};

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "Configurare server incompleta." }, { status: 500 });
    }

    // Extragem datele din corpul cererii (POST) trimise de formularul tău.
    // `language` e opțional: dacă frontend-ul are un selector de limbă,
    // trimite codul (ro/en/it/es) și Smith răspunde forțat în limba aia.
    // Dacă nu e trimis, Smith detectează singur limba din mesaj.
    const body = await req.json();
    const { subject, category, message, language } = body;

    if (!message) {
      return NextResponse.json({ error: "Mesajul este obligatoriu." }, { status: 400 });
    }

    const forcedLanguage =
      language && SUPPORTED_LANGUAGES[language.toLowerCase()]
        ? SUPPORTED_LANGUAGES[language.toLowerCase()]
        : null;

    const languageInstruction = forcedLanguage
      ? `Răspunde STRICT în limba ${forcedLanguage}, indiferent de limba în care e scris mesajul userului.`
      : `Detectează automat limba mesajului userului. Suporți: română, engleză (English), italiană (Italiano), spaniolă (Español). Răspunde fluent, natural, în EXACT aceeași limbă în care userul a scris mesajul. Dacă mesajul e într-o altă limbă decât cele 4 suportate, sau limba nu e clară, răspunde în engleză ca fallback.`;

    const groq = new Groq({ apiKey });

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `Ești Smith, asistentul AI oficial pentru suport și legal compliance de pe platforma iMIDI (imidi.co.uk).
Platforma este un e-commerce global pentru produse și asset-uri digitale (e-books, template-uri, cod, software, bundle-uri).
Ești un expert antrenat pe legislația UK Copyright, drepturi de autor, contracte de licențiere digitală și soluționarea disputelor pe e-Market.

REGULI DE LIMBĂ:
${languageInstruction}

REGULI DE CONȚINUT:
- Răspunde direct, aplicat și profesionist, indiferent de limbă.
- Tonul tău trebuie să fie extrem de sigur, curat și corporate (stil Stripe sau Vercel support) — păstrează același nivel de profesionalism în toate cele 4 limbi.
- Formulează răspunsul scurt și la obiect, oferind pași legali sau soluții clare.
- Ajustează contextul strict după categoria primită (${category || "general"}) și subiectul (${subject || "Asistență"}).
- Text simplu, fără titluri mari, adaptat pentru un chat interactiv de dashboard.
- Terminologia legală (copyright, licențiere, dispute) trebuie să fie corectă și naturală în limba de răspuns aleasă, nu tradusă mot-a-mot din română.`,
        },
        {
          role: "user",
          content: `Subiect tichet: ${subject || "Fara subiect"}
Categorie selectata: ${category || "General"}
Mesaj utilizator: ${message}`,
        },
      ],
      max_tokens: 500,
      temperature: 0.5,
    });

    const reply = response.choices?.[0]?.message?.content || "Smith AI could not generate an answer.";

    return NextResponse.json({ reply });
  } catch (error: any) {
    console.error("Smith Support API error:", error);
    return NextResponse.json({ error: error?.message || "Error internal." }, { status: 500 });
  }
}