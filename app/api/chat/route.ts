import { NextResponse } from "next/server";
import Groq from "groq-sdk";

// Baza de cunoștințe locală extinsă (Plasa de siguranță cu date structurate)
const BACKUP_KNOWLEDGE = `
INFORMAȚII VERIFICATE IMIDI (iMIDI.co.uk) - ANUL 2026:

STRUCTURĂ PLATFORMĂ & CONCEPT:
- Standard pentru performanțe de sinteză LIVE, bazat pe eșantioane audio (.wav) de înaltă calitate și latență ultra-scăzută.
- Conceptul MIDI 3.0: leagă controllerul fizic cu procesarea locală TS4X Core DSP și partajarea în cloud.

PRODUSE ȘI LICENȚE DE BAZĂ:
1. PERPETUAL_CORE ($199.9/an): Licența TS4X Synth Pro. Deblochează complet motorul DSP pe viață, latență garantată sub 1.8ms. Include opțiunea de retur de 14 zile.
2. CLOUD_EXPANSION ($49.9/an): Extinde spațiul MyCloud Preset Storage la 30 GB pentru sound bank-uri, preseturi și mapări (KORG și Genos).
3. TS4X-BETA-LIVE-2026-X99: Cod licență temporară gratuită (Beta) oferită comunității pentru testare live.

COMPONENTE TEHNICE:
- TS4X Synth Engine: Motor audio cu latență de 1.8ms (.apk și desktop). Dispune de un Web Sandbox pentru testare direct în browser (conectare USB-MIDI, mapare automată).
- i-volution MIDI System: Controller universal hardware conceput special pentru acordeoane (velocity-sensitive pentru SOLO și BASS).

SECȚIUNEA iMIDI e-Market (PAGINA MARKET):
- Platformă dedicată vânzărilor after-market de instrumente muzicale și preset-uri pentru DAW-uri/synth direct din cloud, fără carduri de memorie sau SSD.
- Anunțurile sunt gratuite timp de 15 zile. Singura platformă de acest tip în România și Europa, cu asistență AI pentru myCloud.
- Stare curentă catalog conform codului sursă: "Niciun anunt gasit pentru criteriile alese". Dacă utilizatorul întreabă de anunțuri, citează direct această stare extrasă, dar oferă și structura pieței (Toate, Instrumente, Preset-uri).

SECȚIUNEA COMUNITATE: Forum iMIDI:
- Spațiu de discuții pentru utilizatori axat pe MIDI routing, hardware patches și analiză de log-uri de sistem.
`;

// Array-ul de URL-uri setat exact conform cerințelor tale
const SITE_URLS = [
  "https://imidi.co.uk",
  "https://imidi.co.uk/e-market",
  "https://imidi.co.uk",
  "https://imidi.co.uk/forum"
];

async function fetchSiteKnowledge(): Promise<string> {
  try {
    let combinedText = "";

    for (const url of SITE_URLS) {
      // Solicităm Jina Reader să extragă pagina păstrând formatul Markdown curat (inclusiv imagini și link-uri brute)
      const response = await fetch(`https://jina.ai{url}`, {
        headers: { 
          "Accept": "application/json",
          "X-With-Images-Summary": "true", // Îi cerem explicit să proceseze și să păstreze referințele vizuale / pozele
          "X-Return-Format": "markdown"
        },
        signal: AbortSignal.timeout(4000)
      });
      
      if (response.ok) {
        const data = await response.json();
        const content = data.data?.content || data.content || "";
        if (content.trim()) {
          combinedText += `\n\n--- EXTRASE ȘI DATE BRUTE DE PE URL-UL: ${url} ---\n`;
          combinedText += content;
        }
      }
    }

    return combinedText;
  } catch (error) {
    console.error("Eroare la scraping automat:", error);
    return "";
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
    const liveScrapedContent = await fetchSiteKnowledge();

    const COMPREHENSIVE_KNOWLEDGE_BASE = `
    ${BACKUP_KNOWLEDGE}
    
    === DATE AUTOMATE ȘI EXTRASE HTML/MARKDOWN ÎN TIMP REAL (INCLUSIV IMAGINI/ANUNȚURI DETECTATE) ===
    ${liveScrapedContent || "Nu s-au putut prelua date noi prin proxy direct. Bazează-te pe structura de backup."}
    `;

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `Ești asistentul AI Smith oficial al platformei iMIDI (imidi.co.uk).
          Misiunea ta este să oferi extrase precise, brute și detalii clare despre produse, prețuri, anunțuri și imagini de pe site.
          
          REGULI STRICTE DE REZOLVARE ȘI AFREȘARE:
          1. Răspunde direct, detaliat și folosește limba română.
          2. NU folosi niciodată scuze de tipul "nu am acces direct la baza de date" sau "nu dețin informații în timp real". Ai toate extrasele brute în textul de mai jos!
          3. Când utilizatorul întreabă de anunțuri sau dorește extrase, analizează textul de la e-market. Menționează textual că în extras scrie explicit: "Niciun anunt gasit pentru criteriile alese", dar explică cum funcționează (anunț gratuit 15 zile, fără carduri, filtre pentru Instrumente și Preset-uri).
          4. EXTRAGERE IMAGINI: Dacă în datele de mai jos găsești link-uri sau sintaxe de imagini (de tipul ![imagine](url) sau link-uri directe de imagini/logo-uri), extrage-le și afișează-le exact sub formă de link sau imagine Markdown în răspuns, pentru ca utilizatorul să le vadă direct.
          5. Fii transparent: arată-i utilizatorului fragmente clare din textul extras (prețuri licențe, latență 1.8ms, conceptul MIDI 3.0).

          BAZA DE CUNOȘTINȚE ACCESIBILĂ COMPILATĂ PENTRU EXTRAS:
          ${COMPREHENSIVE_KNOWLEDGE_BASE}`
        },
        ...messages
      ],
      max_tokens: 750, // Am mărit numărul de tokeni pentru a permite extrase lungi și link-uri complete
      temperature: 0.2, // Păstrăm temperatura jos pentru acuratețea citatelor brute
    });

    const aiText = response.choices?.[0]?.message?.content || "";
    return NextResponse.json({ generated_text: aiText });

  } catch (error: any) {
    console.error("Groq API Error:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
