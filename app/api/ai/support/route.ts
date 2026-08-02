import { NextResponse } from "next/server";
import Groq from "groq-sdk";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "Configurare server incompleta." }, { status: 500 });
    }

    // Extragem datele din corpul cererii (POST) trimise de formularul tău
    const body = await req.json();
    const { subject, category, message } = body;

    if (!message) {
      return NextResponse.json({ error: "Mesajul este obligatoriu." }, { status: 400 });
    }

    const groq = new Groq({ apiKey });

    // Apelăm SDK-ul Groq fix ca în exemplul tău de succes
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `Esti Smith, asistentul AI oficial pentru suport si legal compliance de pe platforma iMIDI (imidi.co.uk).
Platforma este un e-commerce global pentru produse si asset-uri digitale (e-books, template-uri, cod, software, bundle-uri).
Esti un expert antrenat pe legislatia UK Copyright, drepturi de autor, contracte de licentiere digitala si solutionarea disputelor pe e-Market.

REGULI:
- Raspunde direct, aplicat si profesionist in limba romana.
- Tonul tau trebuie sa fie extrem de sigur, curat si corporate (stil Stripe sau Vercel support).
- Formuleaza raspunsul scurt si la obiect, oferind pasi legali sau solutii clare.
- Ajusteaza contextul strict dupa categoria primita (${category || "general"}) si subiectul (${subject || "Asistenta"}).
- Text simplu, fara titluri mari, adaptat pentru un chat interactiv de dashboard.`,
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

    // Extragere identică cu exemplul tău de succes care funcționează direct în Turbopack
    const reply = response.choices?.[0]?.message?.content || "Smith Core nu a putut genera un raspuns.";

    return NextResponse.json({ reply });
  } catch (error: any) {
    console.error("Smith Support API error:", error);
    return NextResponse.json({ error: error?.message || "Eroare interna." }, { status: 500 });
  }
}
