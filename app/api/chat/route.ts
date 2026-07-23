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

    const response = await hf.chatCompletion({
      model: "meta-llama/Llama-3.2-3B-Instruct",
      messages: [
        { 
          role: "system", 
          content: "You are iMIDI AI, a professional and helpful assistant. Respond concisely in English." 
        },
        { 
          role: "user", 
          content: context 
        }
      ],
      max_tokens: 300,
      temperature: 0.7
    });

    console.log("Response via Chat Completion:", JSON.stringify(response));

    // REPARAT CRITIC: Adăugat [0] pentru a citi corect din array-ul choices și a repara TypeScript
    const textGenerat = response.choices?.[0]?.message?.content || "";

    return NextResponse.json({ 
      generated_text: textGenerat.trim() || "AI responded with an empty body." 
    });

  } catch (error: any) {
    console.error("Error via Hugging Face SDK:", error);
    
    return NextResponse.json({ 
      generated_text: "The AI endpoint is initializing. Please click send again in a few seconds." 
    });
  }
}
