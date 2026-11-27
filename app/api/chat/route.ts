import { NextResponse } from "next/server";
import Groq from "groq-sdk";

// Baza de cunoștințe actualizată cu datele exacte din aplicație (2026)
const BACKUP_KNOWLEDGE = `
PLATFORMA iMIDI (iMIDI.co.uk) — ECOSISTEM AUDIO & MIDI 3.0:
- Concept: Conectează controllerele fizice cu procesarea locală TS4X Core DSP (latență sub 1.8ms) și sincronizarea în cloud.
- Specificații recomandate: Apple Silicon (M1/M2/M3), Intel x86_64 până la 4.0 GHz sau ARM Cortex-A72; minim 8GB RAM; SSD NVMe; DAC 24-bit / 192kHz.

PRODUSE & UNELTE:
1. TS4x pro NATIVE (în curând): Motor synth live bazat pe sample-uri .wav stereo (16/24/32-bit float), latență sub 1.8ms. Funcționează standalone pe desktop și mobil, cu orice controller MIDI.
2. AirMIDI Link: Apeluri video private și sesiuni MIDI live direct în browser (fără instalare), latență ultra-scăzută.
3. wbank manager: Compilator local-first pentru wave vectors multi-sampled (WAV 16/24/32-bit), envelope shaper și export sound bank-uri 64-byte aligned pentru TS4X.
4. i-volution Controller: Controller MIDI universal dedicat acordeoanelor (funcționează pe orice canal MIDI, mapare velocity-sensitive pentru SOLO și BASS).
5. SD Writer: Scrie pachete de sunete direct pe cardul SD din browser (Chrome & Edge) pe bază de link unic și cod, cu verificare checksum.

PLANURI & PREȚURI:
- MyCloud Storage: €49.90 / an — 30 GB spațiu securizat pentru backup și sincronizare sound bank-uri, preseturi și mapări (inclusiv formate KORG/Genos).
- AirMIDI Link License: €19.00 / 30 ore — streaming audio+video și sesiuni MIDI live.
- E-Market (Vânzări): Publicare GRATUITĂ timp de 14 zile. Opțional, promovare anunț: €6 / 45 zile (via Revolut).

E-MARKET & COMUNITATE:
- E-Market: Marketplace pentru instrumente fizice, preseturi, sound bank-uri și scripturi. Căutare clasică sau asistată de AI Smith, cu mesagerie directă între utilizatori.
- Forum iMIDI: Comunitate pentru MIDI routing, patch-uri hardware și analiză log-uri.

DEZVOLTARE (Reactiq — echipa din spatele iMIDI):
- Servicii software la comandă: Web apps (Next.js, Vite), Mobile apps (React Native + C++/Rust), Custom software (Node, PostgreSQL), Integrări (REST, Webhooks, OAuth), Hardware-aware software (CAD, DSP) și AI/Automatizări (LLM, RAG, Agenți).
- Contact dezvoltare: marius_service@yahoo.com.
`;

const SITE_URLS = [
  "https://imidi.co.uk",
  "https://imidi.co.uk/e-market",
  "https://imidi.co.uk/pricing",
  "https://imidi.co.uk/forum",
  "https://imidi.co.uk/hub-services",
];

// Cache simplu în memorie pentru a evita apelurile lente la Jina la fiecare mesaj (TTL: 5 min)
let cachedKnowledge = "";
let lastFetchTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

async function fetchSiteKnowledge(): Promise<string> {
  const now = Date.now();
  if (cachedKnowledge && now - lastFetchTime < CACHE_TTL) {
    return cachedKnowledge;
  }

  const results = await Promise.allSettled(
    SITE_URLS.map(async (url) => {
      const response = await fetch(`https://r.jina.ai/${url}`, {
        headers: {
          Accept: "application/json",
          "X-Return-Format": "markdown",
        },
        signal: AbortSignal.timeout(6000),
      });

      if (!response.ok) return "";
      const data = await response.json();
      const content = data.data?.content || data.content || "";
      if (!content.trim()) return "";

      return `\n--- SURSA: ${url} ---\n${content}`;
    })
  );

  const combined = results
    .filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled")
    .map((r) => r.value)
    .join("");

  if (combined) {
    cachedKnowledge = combined;
    lastFetchTime = now;
  }

  return combined;
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

    const KNOWLEDGE_BASE = `
${BACKUP_KNOWLEDGE}

=== DATE LIVE DE PE SITE ===
${liveScrapedContent || "Nu s-au preluat date noi; folosește baza de cunoștințe de mai sus."}
`;

    const response = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [
        {
          role: "system",
          content: `Ești Smith, asistentul AI al platformei iMIDI (imidi.co.uk).

STIL DE RĂSPUNS:
- Fii scurt, obiectiv și la obiect. Evită introduceri lungi („Salut! Cu drag te ajut...”) sau concluzii inutile.
- Răspunde în 2–4 propoziții sau folosește liste scurte (bullet points) când enumeri specificații ori prețuri.
- Răspunde în limba în care scrie utilizatorul (implicit română).

REGULI DE DATE:
1. Folosește strict prețurile și specificațiile din baza de cunoștințe (ex: MyCloud €49.90/an, AirMIDI Link €19/30h, anunțuri E-Market gratuite 14 zile, promovare €6/45 zile).
2. Dacă utilizatorul întreabă de anunțuri active pe E-Market și în datele live apare „Niciun anunț găsit” sau lista e goală, spune direct că momentan nu sunt anunțuri listate și îndrumă-l să verifice pagina E-Market. Nu inventa produse.
3. Dacă informația cerută nu există în datele de mai jos, spune scurt că nu ai acel detaliu și oferă contactul relevant (ex: pagina de contact sau marius_service@yahoo.com pentru dezvoltare).

BAZA DE CUNOȘTINȚE:
${KNOWLEDGE_BASE}`,
        },
        ...messages,
      ],
      max_tokens: 350, // Limitează lungimea pentru răspunsuri rapide și concise
      temperature: 0.2, // Temperatură mică pentru precizie și obiectivitate
    });

    const aiText = response.choices?.[0]?.message?.content || "";
    return NextResponse.json({ generated_text: aiText });
  } catch (error: any) {
    console.error("Groq API Error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
