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
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const context = messages
        .concat(userMessage)
        .map((m) => (m.role === "user" ? `<|user|>\n${m.content}<|end|>` : `<|assistant|>\n${m.content}<|end|>`))
        .join("\n") + "\n<|assistant|>";

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context }),
      });

      const data = await res.json();
      
      // REPARAT CRITIC PENTRU TYPESCRIPT VERCEL:
      // Citim direct proprietatea din obiectul simplu trimis de server
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
        <div className="fixed bottom-[170px] right-0 sm:right-5 z-50 font-sans antialiased">
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

      {/* 2. DARK GLASS CHAT WINDOW CONTAINER */}
      {isOpen && (
        <div 
          className={`
            fixed z-50 font-sans antialiased text-white bg-black/90 backdrop-blur-xl flex flex-col overflow-hidden transition-all duration-300
            top-0 left-0 w-full h-[100dvh] 
            sm:top-auto sm:left-auto sm:bottom-[33px] sm:right-6 sm:w-[380px] sm:h-[540px] sm:max-h-[85vh] sm:border sm:border-white/10 sm:rounded-2xl sm:shadow-[0_20px_50px_rgba(0,0,0,0.5)]
          `}
        >
          {/* Ambient Glow behind content */}
          <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-[#FF5CA1]/10 to-transparent pointer-events-none z-0" />
          
          {/* Header Area */}
          <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black/40 backdrop-blur-md pt-16 sm:pt-4 relative z-10">
            <div className="flex items-center gap-2">
  
              <h3 className="text-xs font-semibold text-white/90 tracking-widest uppercase font-mono">AI chat support </h3>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-neutral-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-gradient-to-b from-neutral-900/20 to-neutral-950/40 relative z-10">
            {messages.length === 0 && (
              <div className="text-center py-20 px-6 space-y-3">
                <div className="w-11 h-11 bg-white/5 border border-white/10 text-[#FF5CA1] rounded-full flex items-center justify-center mx-auto text-sm font-bold shadow-inner animate-pulse">✦</div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-white">iMIDI Assistant Pro</p>
                  <p className="text-[11px] text-neutral-400 max-w-[240px] mx-auto leading-relaxed">Ask anything about technical audio, midi workspace configs or platform support.</p>
                </div>
              </div>
            )}

            {messages.map((msg, index) => (
              <div key={index} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[82%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed break-words shadow-md transition-all ${
                    msg.role === "user"
                      ? "bg-white text-black font-medium rounded-br-none"
                      : "bg-[#1A1A1A] border border-white/5 text-neutral-200 rounded-bl-none"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-[#1A1A1A] border border-white/5 text-neutral-400 text-[11px] rounded-2xl rounded-bl-none px-3.5 py-2 shadow-md flex items-center gap-1.5">
                  <span className="w-1 h-1 bg-[#FF5CA1] rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="w-1 h-1 bg-[#FF5CA1] rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="w-1 h-1 bg-[#FF5CA1] rounded-full animate-bounce"></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <form onSubmit={handleSendMessage} className="p-3 bg-black/60 border-t border-white/5 flex items-center gap-2 pb-12 sm:pb-3 relative z-10">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask iMIDI AI..."
              className="flex-1 h-10 px-3 text-xs bg-neutral-900 border border-white/10 rounded-xl outline-none focus:bg-neutral-800/80 focus:border-white/20 transition-all text-white placeholder-neutral-500"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="h-10 px-4 bg-[#FF5CA1] text-white text-xs font-semibold rounded-xl hover:bg-[#ff4392] active:scale-98 disabled:opacity-20 transition-all cursor-pointer shadow-[0_2px_8px_rgba(255,92,161,0.2)]"
            >
              Send
            </button>
          </form>

        </div>
      )}
    </>
  );
}
