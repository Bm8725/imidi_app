/*
Smith AI Share Intent Generator
model: "llama-3.3-70b-versatile", groq based.
author : BM26
*/

import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import Groq from "groq-sdk";
import React from "react"; // 👈 Obligatoriu pentru React.createElement în fișiere .ts

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const title = searchParams.get("title") || "Anunț iMIDI";
    const price = searchParams.get("price") || "0";
    const desc = searchParams.get("desc") || "";
    const imgUrl = searchParams.get("img");

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return new Response("Missing GROQ_API_KEY", { status: 500 });
    }

    const groq = new Groq({ apiKey });

    let aiHook = "OFERTĂ DISPONIBILĂ ACUM";
    try {
      const aiResponse = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: "Ești un copywriter pentru iMIDI Market. Extrage din datele anunțului un singur slogan/cârlig ultra-scurt de marketing (MAXIM 4-5 CUVINTE, fără ghilimele, fără explicații, doar textul curat) care să forțeze utilizatorul să dea click."
          },
          {
            role: "user",
            content: `Titlu: ${title} | Descriere: ${desc}`
          }
        ],
        max_tokens: 30,
        temperature: 0.3,
      });
      aiHook = aiResponse.choices?.[0]?.message?.content?.trim() || aiHook;
    } catch (aiError) {
      console.error("Groq fail, folosesc fallback text:", aiError);
    }

    // Nativ în .ts construim elementele prin React.createElement
    return new ImageResponse(
      React.createElement(
        "div",
        {
          style: { display: "flex", width: "1200px", height: "630px", backgroundColor: "#0f172a", position: "relative", fontFamily: "sans-serif", padding: "60px", flexDirection: "column", justifyContent: "flex-end" }
        },
        // 1. Imagine de fundal
        imgUrl ? React.createElement("img", { src: imgUrl, style: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" } }) : null,
        
        // 2. Umbră gradient
        React.createElement("div", { style: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "linear-gradient(to top, rgba(15,23,42,0.95) 0%, rgba(15,23,42,0.6) 50%, rgba(0,0,0,0) 100%)" } }),
        
        // 3. Badge Brand (stânga sus)
        React.createElement("div", { style: { position: "absolute", top: "60px", left: "60px", backgroundColor: "#10B981", padding: "12px 24px", borderRadius: "30px", color: "white", fontSize: "22px", fontWeight: "bold", letterSpacing: "1px" } }, "🤖 AI SMART SHARE | iMIDI"),
        
        // 4. Badge Preț (dreapta sus)
        React.createElement(
          "div",
          { style: { position: "absolute", top: "60px", right: "60px", backgroundColor: "#EF4444", padding: "16px 36px", borderRadius: "20px", color: "white", display: "flex", flexDirection: "column", alignItems: "center", boxShadow: "0 10px 25px rgba(239, 68, 68, 0.3)" } },
          React.createElement("span", { style: { fontSize: "14px", fontWeight: "bold", opacity: 0.9, letterSpacing: "1px" } }, "PREȚ SPECIAL"),
          React.createElement("span", { style: { fontSize: "46px", fontWeight: "bold", marginTop: "4px" } }, `€${price}`)
        ),
        
        // 5. Titlu Mare
        React.createElement("h1", { style: { color: "white", fontSize: "56px", fontWeight: "bold", margin: 0, textShadow: "2px 4px 15px rgba(0,0,0,0.6)", lineHeight: "1.2" } }, title),
        
        // 6. Hook-ul de la Groq AI
        React.createElement("p", { style: { color: "#34D399", fontSize: "28px", margin: "15px 0 0 0", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px" } }, `✨ ${aiHook}`)
      ),
      { width: 1200, height: 630 }
    );

  } catch (error: any) {
    console.error("Critical API Error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
