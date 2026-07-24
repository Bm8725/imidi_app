"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function AIChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: "user", content: input };
    const updatedMessages = [...messages, userMessage]; // Istoricul complet + noul mesaj
    
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      // Pasăm istoricul ca structură nativă direct către API-ul nostru local
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedMessages }), 
      });

      const data = await res.json();
      let aiText = data?.generated_text || "";

      if (data?.error) {
        aiText = "AI Model is loading on servers. Please retry in 10 seconds.";
      } else if (!aiText) {
        aiText = "An error occurred while processing the response.";
      }

      setMessages((prev) => [...prev, { role: "assistant", content: aiText.trim() }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: "assistant", content: "Connection error with the internal server." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* 1. PINK FLOATING BUBBLE BUTTON */}
      {!isOpen && (
        <div className="fixed bottom-[170px] right-0 sm:right-5 z-50 font-serif antialiased">
          <button
            onClick={() => setIsOpen(true)}
            className="flex items-center justify-center w-14 h-14 bg-[#FF5CA1] text-white rounded-full shadow-[0_8px_24px_rgba(255,92,161,0.4)] hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer mr-6 sm:mr-0"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </button>
        </div>
      )}

      {/* 2. WARM CREAM CHAT WINDOW CONTAINER */}
      {isOpen && (
        <div className={`fixed z-50 font-serif antialiased text-neutral-800 bg-[#FDFBF7] flex flex-col overflow-hidden transition-all duration-300 top-0 left-0 w-full h-[100dvh] sm:top-auto sm:left-auto sm:bottom-[33px] sm:right-6 sm:w-[380px] sm:h-[540px] sm:max-h-[85vh] sm:border sm:border-amber-900/10 sm:rounded-2xl sm:shadow-[0_20px_50px_rgba(0,0,0,0.15)]`}>
          <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-[#FF5CA1]/5 to-transparent pointer-events-none z-0" />
          
          <div className="p-4 border-b border-amber-900/10 flex items-center justify-between bg-[#F7F4EB] pt-16 sm:pt-4 relative z-10">
            <h3 className="text-xs font-semibold text-amber-950 tracking-widest uppercase font-mono">Smith, your AI assistant 🫡</h3>
            <button onClick={() => setIsOpen(false)} className="text-amber-900/60 hover:text-amber-950 p-1.5 rounded-lg hover:bg-amber-900/5 transition-colors cursor-pointer">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-[#FDFBF7] relative z-10">
            {messages.length === 0 && (
              <div className="text-center py-20 px-6 space-y-3">
                <div className="w-11 h-11 bg-white border border-amber-900/10 text-[#FF5CA1] rounded-full flex items-center justify-center mx-auto text-sm font-bold shadow-sm animate-pulse">✦</div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-amber-950">iMIDI Assistant Pro</p>
                  <p className="text-xs text-amber-900/60 max-w-[240px] mx-auto leading-relaxed">Ask anything about technical audio, midi workspace configs or platform support.</p>
                </div>
              </div>
            )}

            {messages.map((msg, index) => (
              <div key={index} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[82%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed break-words shadow-sm transition-all ${msg.role === "user" ? "bg-[#FF5CA1] text-white font-medium rounded-br-none" : "bg-white border border-amber-900/10 text-neutral-800 rounded-bl-none"}`}>
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-amber-900/10 text-neutral-400 text-sm rounded-2xl rounded-bl-none px-3.5 py-2 shadow-sm flex items-center gap-1.5">
                  <span className="w-1 h-1 bg-[#FF5CA1] rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="w-1 h-1 bg-[#FF5CA1] rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="w-1 h-1 bg-[#FF5CA1] rounded-full animate-bounce"></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSendMessage} className="p-3 bg-[#F7F4EB] border-t border-amber-900/10 flex items-center gap-2 pb-12 sm:pb-3 relative z-10">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask iMIDI AI..."
              className="flex-1 h-10 px-3 text-sm bg-white border border-amber-900/10 rounded-xl outline-none text-neutral-900 placeholder-amber-900/40"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="h-10 px-4 bg-[#FF5CA1] text-white text-sm font-semibold rounded-xl hover:bg-[#ff4392] active:scale-98 disabled:opacity-20 transition-all cursor-pointer shadow-[0_2px_8px_rgba(255,92,161,0.2)]"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}
