"use client";

import { useState, useRef, useEffect } from "react";

type Message = { id: string; role: "user" | "smith"; text: string };

export default function InteractiveSupportForm() {
  const [form, setForm] = useState({ subject: "", category: "general", description: "" });
  const [isChat, setIsChat] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [userMessageCount, setUserMessageCount] = useState(0);

  const chatEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (isChat) chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading, isChat]);

  const askSmith = async (textToSend: string, isInitial = false) => {
    setLoading(true);
    let currentCount = userMessageCount;
    
    if (isInitial) {
      setIsChat(true);
      currentCount = 1;
      setUserMessageCount(1);
    } else {
      currentCount += 1;
      setUserMessageCount(currentCount);
    }
    
    const userMsg: Message = { id: crypto.randomUUID(), role: "user", text: textToSend };
    const updatedMessages: Message[] = isInitial ? [userMsg] : [...messages, userMsg];
    setMessages(updatedMessages);

    try {
      const res = await fetch("/api/ai/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: form.subject, category: form.category, message: textToSend }),
      });
      const data = await res.json();
      
      // Am forțat vectorul să fie recunoscut strict ca Message[] pentru a trece de compilatorul Vercel
      let finalMessages: Message[] = [
        ...updatedMessages, 
        { id: crypto.randomUUID(), role: "smith", text: data.reply }
      ];

      if (currentCount >= 3) {
        finalMessages = [
          ...finalMessages,
          {
            id: crypto.randomUUID(),
            role: "smith",
            text: "Sistemul a atins limita de diagnosticare rapidă. Istoricul complet și detaliile problemei tale sunt transmise acum automat către operatori. Revenim cu un mesaj direct în inbox.",
          }
        ];
      }

      setMessages(finalMessages);

      if (currentCount >= 3) {
        await fetch("/api/ai/support/ticket", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ form, chatHistory: finalMessages }),
        });
      }
    } catch {
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: "smith", text: "Eroare de conexiune locală." }]);
    } finally { setLoading(false); }
  };

  if (!isChat) {
    return (
      <form onSubmit={(e) => { e.preventDefault(); askSmith(form.description, true); }} className="bg-white border border-zinc-200/70 rounded-2xl p-6 shadow-xs space-y-5 font-sans">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Category</label>
            <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-xs text-zinc-800 font-semibold focus:outline-none focus:border-indigo-500 transition-colors">
              <option value="general">General Inquiry</option>
              <option value="copyright">Copyright Shield</option>
              <option value="market">e-Market & Payments</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Subject</label>
            <input type="text" required value={form.subject} onChange={e => setForm({...form, subject: e.target.value})} placeholder="Subiectul problemei" className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-xs text-zinc-800 font-semibold focus:outline-none focus:border-indigo-500 transition-colors" />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Message</label>
          <textarea required rows={5} value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Introdu detaliile complete aici..." className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-3 text-xs text-zinc-800 font-medium leading-relaxed focus:outline-none focus:border-indigo-500 transition-colors" />
        </div>
        <button type="submit" className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm">
          Pornește asistența →
        </button>
      </form>
    );
  }

  return (
    <div className="bg-white border border-zinc-200/70 rounded-2xl shadow-xs overflow-hidden flex flex-col h-[480px] font-sans">
      <div className="bg-zinc-950 px-4 py-3 flex items-center justify-between border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
          <span className="text-xs font-bold text-white uppercase tracking-wider">Asistent Suport</span>
        </div>
        <span className="text-[9px] font-extrabold text-indigo-400 uppercase tracking-wider bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-md">
          Mesaje rămase: {Math.max(0, 3 - userMessageCount)}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50/20">
        {messages.map((m) => {
          const isAI = m.role === "smith";
          return (
            <div key={m.id} className={`flex items-start max-w-[85%] ${isAI ? "mr-auto" : "ml-auto"}`}>
              <div className={`p-3 rounded-2xl text-xs leading-relaxed ${isAI ? "bg-white border border-zinc-200/60 text-zinc-800 rounded-tl-xs shadow-xs" : "bg-indigo-600 text-white rounded-tr-xs"}`}>
                {m.text}
              </div>
            </div>
          );
        })}
        {loading && <div className="text-[10px] text-zinc-400 font-semibold px-2 animate-pulse">Se procesează răspunsul...</div>}
        <div ref={chatEndRef} />
      </div>

      <div className="p-3 bg-white border-t border-zinc-100">
        {userMessageCount < 3 ? (
          <form onSubmit={(e) => { e.preventDefault(); if(input.trim()) { askSmith(input); setInput(""); } }} className="flex items-center gap-2">
            <input type="text" value={input} onChange={e => setInput(e.target.value)} placeholder="Adaugă detalii suplimentare..." className="flex-1 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-800 focus:outline-none focus:border-indigo-500 focus:bg-white" />
            <button type="submit" disabled={!input.trim() || loading} className="h-8 w-8 bg-zinc-950 text-white rounded-xl flex items-center justify-center font-bold">→</button>
          </form>
        ) : (
          <div className="p-2 bg-indigo-50/50 border border-indigo-100 rounded-xl text-center space-y-1">
            <p className="text-[11px] font-semibold text-indigo-950">📬 Solicitarea și istoricul discuției au fost transmise automat echipei iMIDI.</p>
            <p className="text-[9px] text-indigo-500 font-bold uppercase tracking-wider">Te vom contacta pe email în cel mai scurt timp.</p>
          </div>
        )}
      </div>
    </div>
  );
}
