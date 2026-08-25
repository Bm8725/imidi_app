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
      <style>{`
        @keyframes im-ring { 0% { box-shadow: 0 0 0 0 rgba(255,92,161,0.45); } 100% { box-shadow: 0 0 0 14px rgba(255,92,161,0); } }
        @keyframes im-led { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
        @keyframes im-vu-1 { 0%, 100% { transform: scaleY(0.35); } 50% { transform: scaleY(1); } }
        @keyframes im-vu-2 { 0%, 100% { transform: scaleY(0.9); } 50% { transform: scaleY(0.3); } }
        @keyframes im-vu-3 { 0%, 100% { transform: scaleY(0.5); } 50% { transform: scaleY(1); } }
        @keyframes im-rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .im-vu-bar-1 { animation: im-vu-1 0.9s ease-in-out infinite; }
        .im-vu-bar-2 { animation: im-vu-2 0.9s ease-in-out infinite 0.12s; }
        .im-vu-bar-3 { animation: im-vu-3 0.9s ease-in-out infinite 0.24s; }
        .im-msg-in { animation: im-rise 0.22s ease-out; }
        .im-scrollbar::-webkit-scrollbar { width: 6px; }
        .im-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 999px; }
        .im-scrollbar::-webkit-scrollbar-track { background: transparent; }
      `}</style>

      {/* FLOATING LAUNCH BUTTON */}
      {!isOpen && (
        <div className="fixed bottom-[170px] right-0 sm:right-5 z-50 font-sans antialiased">
          <button
            onClick={() => setIsOpen(true)}
            style={{ animation: "im-ring 2.4s ease-out infinite" }}
            className="relative flex items-center justify-center w-14 h-14 bg-[#0B0D10] border border-white/10 rounded-full hover:scale-105 active:scale-95 transition-transform duration-200 cursor-pointer mr-6 sm:mr-0"
          >
            <span className="absolute top-2 right-2.5 w-1.5 h-1.5 rounded-full bg-[#38E1C6]" style={{ animation: "im-led 1.8s ease-in-out infinite" }} />
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="2" y="7" width="2.5" height="6" rx="1.25" fill="#FF5CA1" />
              <rect x="7" y="3" width="2.5" height="14" rx="1.25" fill="#FF5CA1" />
              <rect x="12" y="6" width="2.5" height="8" rx="1.25" fill="#FF5CA1" />
              <rect x="17" y="8.5" width="2.5" height="3" rx="1.25" fill="#FF5CA1" />
            </svg>
          </button>
        </div>
      )}

      {/* CHAT PANEL */}
      {isOpen && (
        <div className="fixed z-50 font-sans antialiased flex flex-col overflow-hidden transition-all duration-300 top-0 left-0 w-full h-[100dvh] bg-[#0B0D10] sm:top-auto sm:left-auto sm:bottom-[33px] sm:right-6 sm:w-[380px] sm:h-[560px] sm:max-h-[85vh] sm:border sm:border-white/10 sm:rounded-2xl sm:shadow-[0_24px_60px_rgba(0,0,0,0.55)]">
          {/* HEADER — console strip */}
          <div className="relative flex items-center justify-between px-4 pt-16 pb-4 sm:pt-4 bg-[#14171C] border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <span className="relative flex w-2 h-2">
                <span className="absolute inline-flex w-full h-full rounded-full bg-[#38E1C6]" style={{ animation: "im-led 1.6s ease-in-out infinite" }} />
              </span>
              <div className="leading-tight">
                <p className="text-[11px] font-mono font-semibold tracking-[0.18em] text-[#F3F1EC] uppercase">iMIDI Support</p>
                <p className="text-[10px] font-mono text-[#8890A0] tracking-wide">Smith · AI assistant</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-white/10 text-[#8890A0] hover:text-[#F3F1EC] hover:border-white/20 transition-colors cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* MESSAGES — screen */}
          <div className="im-scrollbar flex-1 p-4 overflow-y-auto space-y-3 bg-[#0B0D10] bg-[radial-gradient(circle_at_top,_rgba(255,92,161,0.06),_transparent_55%)]">
            {messages.length === 0 && (
              <div className="text-center py-16 px-6 space-y-4">
                <div className="w-14 h-14 mx-auto rounded-xl border border-white/10 bg-[#14171C] flex items-end justify-center gap-1 p-3.5">
                  <span className="im-vu-bar-1 w-1 h-full bg-[#FF5CA1] rounded-full origin-bottom" />
                  <span className="im-vu-bar-2 w-1 h-full bg-[#38E1C6] rounded-full origin-bottom" />
                  <span className="im-vu-bar-3 w-1 h-full bg-[#FF5CA1] rounded-full origin-bottom" />
                </div>
                <div className="space-y-1.5">
                  <p className="text-sm font-semibold text-[#F3F1EC]">Smith, your AI assistant</p>
                  <p className="text-xs text-[#8890A0] max-w-[240px] mx-auto leading-relaxed">
                    Ask anything about technical audio, MIDI workspace configs or platform support.
                  </p>
                </div>
              </div>
            )}

            {messages.map((msg, index) => (
              <div key={index} className={`im-msg-in flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[82%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed break-words ${
                    msg.role === "user"
                      ? "bg-gradient-to-br from-[#FF5CA1] to-[#E84690] text-white font-medium rounded-br-sm shadow-[0_4px_14px_rgba(255,92,161,0.25)]"
                      : "bg-[#14171C] border border-white/10 border-l-2 border-l-[#38E1C6] text-[#F3F1EC] rounded-bl-sm"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start im-msg-in">
                <div className="bg-[#14171C] border border-white/10 border-l-2 border-l-[#38E1C6] rounded-xl rounded-bl-sm px-3.5 py-3 flex items-end gap-1 h-9">
                  <span className="im-vu-bar-1 w-1 h-full bg-[#FF5CA1] rounded-full origin-bottom" />
                  <span className="im-vu-bar-2 w-1 h-full bg-[#38E1C6] rounded-full origin-bottom" />
                  <span className="im-vu-bar-3 w-1 h-full bg-[#FF5CA1] rounded-full origin-bottom" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* INPUT — control strip */}
          <form onSubmit={handleSendMessage} className="p-3 pb-12 sm:pb-3 bg-[#14171C] border-t border-white/10 flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask iMIDI AI..."
              className="flex-1 h-10 px-3.5 text-sm bg-[#0B0D10] border border-white/10 rounded-lg outline-none text-[#F3F1EC] placeholder-[#8890A0] focus:border-[#FF5CA1]/50 transition-colors"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="w-10 h-10 flex-shrink-0 flex items-center justify-center bg-[#FF5CA1] text-white rounded-lg hover:bg-[#ff4392] active:scale-95 disabled:opacity-20 disabled:active:scale-100 transition-all cursor-pointer"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 8h11M8 3l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
}