import { NextResponse } from "next/server";
import Groq from "groq-sdk";

// Baza de cunostinte locala (plasa de siguranta daca scraping-ul esueaza)
const BACKUP_KNOWLEDGE = `
INFORMATII VERIFICATE IMIDI (iMIDI.co.uk) - ANUL 2026:

STRUCTURA PLATFORMA & CONCEPT:
- Standard pentru performante de sinteza LIVE, bazat pe esantioane audio (.wav) de inalta calitate si latenta ultra-scazuta.
- Conceptul MIDI 3.0: leaga controllerul fizic cu procesarea locala TS4X Core DSP si partajarea in cloud.

PRODUSE SI LICENTE DE BAZA:
1. PERPETUAL_CORE ($199.9/an): Licenta TS4X Synth Pro. Debloheaza complet motorul DSP pe viata, latenta garantata sub 1.8ms. Include optiunea de retur de 14 zile.
2. CLOUD_EXPANSION ($49.9/an): Extinde spatiul MyCloud Preset Storage la 30 GB pentru sound bank-uri, preseturi si mapari (KORG si Genos).
3. TS4X-BETA-LIVE-2026-X99: Cod licenta temporara gratuita (Beta) oferita comunitatii pentru testare live.

COMPONENTE TEHNICE:
- TS4X Synth Engine: Motor audio cu latenta de 1.8ms (.apk si desktop). Dispune de un Web Sandbox pentru testare direct in browser (conectare USB-MIDI, mapare automata).
- i-volution MIDI System: Controller universal hardware conceput special pentru acordeoane (velocity-sensitive pentru SOLO si BASS).

SECTIUNEA iMIDI e-Market:
- Platforma dedicata vanzarilor after-market de instrumente muzicale si preset-uri pentru DAW-uri/synth direct din cloud, fara carduri de memorie sau SSD.
- Anunturile sunt gratuite timp de 15 zile. Filtre disponibile: Toate, Instrumente, Preset-uri.

SECTIUNEA COMUNITATE: Forum iMIDI:
- Spatiu de discutii pentru utilizatori axat pe MIDI routing, hardware patches si analiza de log-uri de sistem.
`;

const SITE_URLS = [
  "https://imidi.co.uk",
  "https://imidi.co.uk/e-market",
  "https://imidi.co.uk/pricing",
  "https://imidi.co.uk/forum",
];

async function fetchSiteKnowledge(): Promise<string> {
  const results = await Promise.allSettled(
    SITE_URLS.map(async (url) => {
      // Jina Reader: subdomeniul dedicat r.jina.ai, cu URL-ul tinta adaugat in path
      const response = await fetch(`https://r.jina.ai/${url}`, {
        headers: {
          Accept: "application/json",
          "X-With-Images-Summary": "true",
          "X-Return-Format": "markdown",
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) return "";

      const data = await response.json();
      const content = data.data?.content || data.content || "";
      if (!content.trim()) return "";

      return `\n\n--- EXTRAS DE PE: ${url} ---\n${content}`;
    })
  );

  return results
    .filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled")
    .map((r) => r.value)
    .join("");
}

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "Lipseste GROQ_API_KEY" }, { status: 500 });
    }

    const groq = new Groq({ apiKey });
    const liveScrapedContent = await fetchSiteKnowledge();

    const COMPREHENSIVE_KNOWLEDGE_BASE = `
    ${BACKUP_KNOWLEDGE}

    === DATE LIVE EXTRASE DE PE SITE (daca sunt goale, foloseste doar baza de mai sus) ===
    ${liveScrapedContent || "Nu s-au putut prelua date live in acest moment."}
    `;

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `Esti asistentul AI oficial al platformei iMIDI (imidi.co.uk), Smith.
          Raspunde direct, detaliat, in limba romana, pe baza informatiilor de mai jos.

          REGULI:
          1. Nu spune niciodata ca nu ai acces la date in timp real - foloseste extrasele de mai jos.
          2. Daca extrasele live nu contin anunturi sau sunt goale, spune ca informatia despre anunturi active nu e disponibila momentan si recomanda userului sa verifice direct pagina e-market - NU inventa si NU repeta o stare fixa daca datele live arata altceva.
          3. Daca gasesti link-uri de imagini in extrase, afiseaza-le ca link Markdown.
          4. Fii transparent si citeaza clar preturile si specificatiile tehnice gasite.

          BAZA DE CUNOSTINTE:
          ${COMPREHENSIVE_KNOWLEDGE_BASE}`,
        },
        ...messages,
      ],
      max_tokens: 750,
      temperature: 0.5,
    });

    const aiText = response.choices?.[0]?.message?.content || "";
    return NextResponse.json({ generated_text: aiText });
  } catch (error: any) {
    console.error("Groq API Error:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}