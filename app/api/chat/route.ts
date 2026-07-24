import { NextResponse } from "next/server";
import { HfInference } from "@huggingface/inference";

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    
    // Păstrăm variabila ta din .env.local
    const token = process.env.NEXT_PUBLIC_HF_TOKEN;

    if (!token) {
      return NextResponse.json({ error: "Missing token in environment variables" }, { status: 500 });
    }

    const hf = new HfInference(token.trim());

    // REPARAT: Am trecut la Llama 3 8B, care este stabil și suportă nativ endpoint-ul de chat
    const response = await hf.chatCompletion({
      model: "Qwen/Qwen2.5-7B-Instruct",
      messages: messages,
      max_tokens: 250,
      temperature: 0.7,
    });

    // Extragere curată a răspunsului primit de la API
    const aiText = response.choices?.[0]?.message?.content || "";

    return NextResponse.json({ generated_text: aiText });
  } catch (error: any) {
    console.error("HF Error:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
