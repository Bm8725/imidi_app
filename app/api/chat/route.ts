import { NextResponse } from "next/server";
import { HfInference } from "@huggingface/inference";

export async function POST(req: Request) {
  try {
    const { context } = await req.json();
    const token = process.env.NEXT_PUBLIC_HF_TOKEN;

    if (!token) {
      return NextResponse.json({ error: "Missing token in .env.local" }, { status: 500 });
    }

    const hf = new HfInference(token.trim());

    // Folosim o metodă directă și un model ultra-stabil pe infrastructura lor de bază
    const response = await hf.textGeneration({
      model: "microsoft/Phi-3-mini-4k-instruct",
      inputs: `<|user|>\n${context}<|end|>\n<|assistant|>\n`,
      parameters: {
        max_new_tokens: 250,
        temperature: 0.7,
        return_full_text: false
      },
    });

    console.log("Răspuns primit direct prin textGeneration:", response);

    let textGenerat = response.generated_text || "";

    // Curățăm tag-urile suplimentare dacă apar în răspuns
    if (textGenerat) {
      textGenerat = textGenerat.replace("<|assistant|>", "").trim();
    }

    return NextResponse.json({ 
      generated_text: textGenerat || "AI responded with an empty body." 
    });

  } catch (error: any) {
    console.error("Eroare prin SDK-ul Hugging Face direct:", error);
    
    return NextResponse.json({ 
      generated_text: "The AI is currently processing. Please try pressing send again." 
    });
  }
}
