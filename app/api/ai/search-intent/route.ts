/*
Smith AI Search Intent
model: "llama-3.3-70b-versatile", groq based.
author : BM26
*/

import { NextResponse } from "next/server";
import Groq from "groq-sdk";

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "Lipseste GROQ_API_KEY" }, { status: 500 });
    }
    if (!prompt || prompt.trim().length < 3) {
      return NextResponse.json({ error: "Scrie o cautare valida." }, { status: 400 });
    }

    const groq = new Groq({ apiKey });

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `Esti motorul de cautare inteligent "AI Smith" pentru iMIDI Market (platforma de instrumente, preseturi si diferite servicii).
Sarcina ta este sa analizezi textul liber scris de utilizator si sa extragi intentia de cautare sub forma de filtre structurate JSON.

REGULI STRICTE DE PARSARE SI FILTRARE:
1. "category": Trebuie sa fie obligatoriu una din valorile: "instrument" (daca cauta clape, hardware, synth fizic), "preset" (daca cauta sound-uri, patch-uri, banci de sunet, midi pack) sau "all" (daca nu reiese clar categoria).
2. "keyword": Extrage doar cuvintele cheie principale de cautare (ex: daca scrie "caut un preset de techno gras", keyword-ul este "techno"). Daca textul contine doar preturi sau categorii, lasa string gol "".
3. "relatedKeywords": O lista de 2-5 termeni inruditi cu keyword-ul principal, folositi pentru a gasi si alte anunturi similare din platforma — sinonime, subgenuri, denumiri alternative sau termeni tehnici apropiati (ex: pentru "techno" -> ["industrial techno", "hard techno", "peak time", "warehouse"]; pentru "clape" -> ["synth", "keyboard", "workstation"]). Daca keyword e gol, returneaza array gol [].
4. "priceMax": Daca utilizatorul mentioneaza un buget sau o limita de pret (ex: "pana in 30 de euro", "sub 100 euro"), extrage doar numarul intreg. Daca nu mentioneaza un pret maxim, returneaza null.
5. "priceMin": Daca mentioneaza un pret minim (ex: "peste 20 euro"), extrage numarul. Daca nu, returneaza null.

REGULI STRICTE DE RASPUNS:
- Raspunde DOAR cu un obiect JSON valid, fara text in plus, fara backtick-uri, fara markdown, fara introduceri.
- Format exact de raspuns: {"category": "all"|"instrument"|"preset", "keyword": "...", "relatedKeywords": ["...","..."], "priceMin": numar|null, "priceMax": numar|null}`,
        },
        {
          role: "user",
          content: `Textul cautat de utilizator: "${prompt}"`,
        },
      ],
      max_tokens: 220, // marit fata de 150 ca sa incapa si relatedKeywords
      temperature: 0.1, // Temperatură mică pentru acuratețe maximă pe JSON și zero variații creative
    });

    const raw = response.choices?.[0]?.message?.content || "{}";
    const cleaned = raw.replace(/```json|```/g, "").trim();

    interface SearchFilters {
      category: "all" | "instrument" | "preset";
      keyword: string;
      relatedKeywords: string[];
      priceMin: number | null;
      priceMax: number | null;
    }

    let parsed: SearchFilters;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: "AI Smith nu a putut structura datele. Incearca din nou." }, { status: 500 });
    }

    // Returnăm filtrele curate către frontend
    return NextResponse.json({
      category: parsed.category || "all",
      keyword: parsed.keyword || "",
      relatedKeywords: Array.isArray(parsed.relatedKeywords) ? parsed.relatedKeywords.filter(Boolean) : [],
      priceMin: parsed.priceMin || null,
      priceMax: parsed.priceMax || null,
    });
  } catch (error: any) {
    console.error("AI search-intent error:", error);
    return NextResponse.json({ error: error?.message || "Eroare interna server." }, { status: 500 });
  }
}