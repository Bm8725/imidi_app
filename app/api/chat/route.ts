import { HfInference } from "@huggingface/inference";
import { NextResponse } from "next/server";

const hf = new HfInference(process.env.HF_TOKEN);

// Funcție ajutătoare pentru a aștepta un număr de milisecunde
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(req: Request) {
  try {
    const { context } = await req.json();

    if (!context) {
      return NextResponse.json(
        { error: "Contextul lipsește din cerere." },
        { status: 400 }
      );
    }

    let response = null;
    let retries = 3; // Numărul maxim de încercări
    let delay = 10000; // Timpul de așteptare între încercări (10 secunde)

    while (retries > 0) {
      try {
        response = await hf.chatCompletion({
          model: "meta-llama/Llama-3.2-3B-Instruct",
          messages: [
            {
              role: "user",
              content: context,
            },
          ],
          temperature: 0.7,
          max_tokens: 500,
        });
        
        // Dacă apelul a reușit, ieșim din buclă
        break;
      } catch (apiError: any) {
        // Verificăm dacă eroarea conține mesajul de încărcare al modelului
        const isLoading = apiError?.message?.toLowerCase().includes("loading") || 
                          JSON.stringify(apiError).toLowerCase().includes("loading");

        if (isLoading && retries > 1) {
          console.log(`Modelul se încarcă. Reîncercăm în ${delay / 1000} secunde... (${retries - 1} încercări rămase)`);
          retries--;
          await sleep(delay);
        } else {
          // Dacă este alt tip de eroare sau am epuizat încercările, o aruncăm mai departe
          throw apiError;
        }
      }
    }

    if (!response) {
      throw new Error("Nu s-a putut obține un răspuns de la model.");
    }

    const generatedText = response.choices?.message?.content || "";
    return NextResponse.json({ text: generatedText });

  } catch (error: any) {
    console.error("Eroare prin SDK-ul Hugging Face:", error);
    return NextResponse.json(
      { error: "Modelul se încarcă sau este indisponibil momentan. Vă rugăm să reîncercați." },
      { status: 500 }
    );
  }
}
