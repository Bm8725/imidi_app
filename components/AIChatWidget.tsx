"use client";

import { useState, useRef, useEffect } from "react";

interface ChatImage {
  url: string;
  alt?: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  images?: ChatImage[];
}

// Extrage imagini din text markdown ![alt](url) sau linkuri directe .jpg/.png/.webp/.gif
// si returneaza textul curatat + lista de imagini gasite.
function extractImages(text: string): { cleanText: string; images: ChatImage[] } {
  const images: ChatImage[] = [];

  const markdownImgRegex = /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g;
  let cleanText = text.replace(markdownImgRegex, (_match, alt, url) => {
    images.push({ url, alt: alt || "" });
    return "";
  });

  const bareUrlRegex = /(https?:\/\/[^\s]+\.(?:png|jpe?g|webp|gif))/gi;
  cleanText = cleanText.replace(bareUrlRegex, (match) => {
    images.push({ url: match });
    return "";
  });

  return { cleanText: cleanText.trim(), images };
}

export default function AIChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<ChatImage | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  useEffect(() => {
    if (!lightboxImage) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxImage(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxImage]);

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

      // Suporta atat imagini trimise separat de API (data.images) cat si
      // imagini/thumbnail-uri incluse direct in text (markdown sau link brut).
      const { cleanText, images: parsedImages } = extractImages(aiText.trim());
      const apiImages: ChatImage[] = Array.isArray(data?.images)
        ? data.images.map((img: string | ChatImage) => (typeof img === "string" ? { url: img } : img))
        : [];
      const images = [...apiImages, ...parsedImages];

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: cleanText, images: images.length ? images : undefined },
      ]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: "assistant", content: "Connection error with the internal server." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700;800&display=swap');
        .im-font { font-family: 'Sora', ui-sans-serif, system-ui, sans-serif; }

        @keyframes im-spin { to { transform: rotate(360deg); } }
        @keyframes im-blob-a { 0%, 100% { transform: translate(0,0) scale(1); } 33% { transform: translate(14px,-10px) scale(1.08); } 66% { transform: translate(-10px,8px) scale(0.94); } }
        @keyframes im-blob-b { 0%, 100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-16px,-6px) scale(1.1); } }
        @keyframes im-breathe { 0%, 100% { transform: scale(0.6); opacity: 0.5; } 50% { transform: scale(1); opacity: 1; } }
        @keyframes im-rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes im-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
        @keyframes im-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes im-pop-in { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
        @keyframes im-shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }

        .im-ring { animation: im-spin 5s linear infinite; }
        .im-blob-a { animation: im-blob-a 9s ease-in-out infinite; }
        .im-blob-b { animation: im-blob-b 11s ease-in-out infinite; }
        .im-dot-1 { animation: im-breathe 1s ease-in-out infinite; }
        .im-dot-2 { animation: im-breathe 1s ease-in-out infinite 0.15s; }
        .im-dot-3 { animation: im-breathe 1s ease-in-out infinite 0.3s; }
        .im-msg-in { animation: im-rise 0.22s ease-out; }
        .im-launcher { animation: im-float 3.2s ease-in-out infinite; }
        .im-lightbox-bg { animation: im-fade-in 0.18s ease-out; }
        .im-lightbox-img { animation: im-pop-in 0.22s cubic-bezier(0.16,1,0.3,1); }
        .im-thumb { transition: transform 0.18s ease, box-shadow 0.18s ease; }
        .im-thumb:hover { transform: scale(1.03) translateY(-1px); box-shadow: 0 10px 24px rgba(255,92,161,0.28); }
        .im-thumb-loading {
          background: linear-gradient(90deg, #FFE9F1 25%, #FFF4F8 37%, #FFE9F1 63%);
          background-size: 400% 100%;
          animation: im-shimmer 1.4s ease-in-out infinite;
        }
        .im-scrollbar::-webkit-scrollbar { width: 6px; }
        .im-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,92,161,0.25); border-radius: 999px; }
        .im-scrollbar::-webkit-scrollbar-track { background: transparent; }
      `}</style>

      {/* FLOATING LAUNCH BUTTON */}
      {!isOpen && (
        <div className="im-font fixed bottom-[170px] right-0 sm:right-5 z-50 antialiased">
          <button
            onClick={() => setIsOpen(true)}
            className="im-launcher relative flex items-center justify-center w-16 h-16 cursor-pointer mr-6 sm:mr-0"
          >
            <span
              className="im-ring absolute inset-0 rounded-full opacity-90"
              style={{ background: "conic-gradient(from 0deg, #FF4C99, #FFB56B, #FF4C99)" }}
            />
            <span className="absolute inset-[3px] rounded-full shadow-[0_10px_28px_rgba(255,76,153,0.4)]" style={{ background: "linear-gradient(135deg, #FF4C99, #FF8AC0)" }} />
            <svg className="relative z-10" width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M4 13c2-6 4-6 4 0s2 6 4 0 2-6 4 0 2 6 4 0" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#2CE6C4] border-2 border-white" />
          </button>
        </div>
      )}

      {/* CHAT PANEL */}
      {isOpen && (
        <div className="im-font fixed z-50 antialiased flex flex-col overflow-hidden transition-all duration-300 top-0 left-0 w-full h-[100dvh] bg-[#FFF3F7] sm:top-auto sm:left-auto sm:bottom-[33px] sm:right-6 sm:w-[380px] sm:h-[560px] sm:max-h-[85vh] sm:rounded-[22px] sm:shadow-[0_24px_60px_rgba(43,23,35,0.28)] sm:border sm:border-[#241521]/25">
          {/* HEADER — full gradient banner */}
          <div
            className="relative z-10 flex items-center justify-between px-4 pt-16 pb-4 sm:pt-4"
            style={{ background: "linear-gradient(120deg, #FF4C99, #FF8AC0 55%, #FFB56B)" }}
          >
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.12)]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M4 13c2-6 4-6 4 0s2 6 4 0 2-6 4 0 2 6 4 0" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-[#2CE6C4] border-2 border-white" />
              </div>
              <div className="leading-tight">
                <p className="text-sm font-bold text-white">iMIDI Support</p>
                <p className="text-[11px] font-medium text-white/85">Smith · AI assistant</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="group w-8 h-8 flex items-center justify-center rounded-lg bg-white/20 border border-white/30 text-white hover:bg-white hover:text-[#FF4C99] active:scale-90 transition-all duration-300 cursor-pointer"
            >
              <svg
                className="w-3.5 h-3.5 transition-transform duration-300 ease-out group-hover:rotate-90"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* MESSAGES — dot-grid textured background */}
          <div
            className="im-scrollbar relative z-10 flex-1 p-4 overflow-y-auto space-y-3 bg-[#FFF3F7]"
            style={{
              backgroundImage: "radial-gradient(rgba(255,76,153,0.16) 1px, transparent 1px)",
              backgroundSize: "16px 16px",
            }}
          >
            {messages.length === 0 && (
              <div className="text-center py-16 px-6 space-y-4">
                <div className="relative w-16 h-16 mx-auto flex items-center justify-center rounded-2xl shadow-[0_8px_20px_rgba(255,92,161,0.3)]" style={{ background: "linear-gradient(135deg, #FF5CA1, #FFB56B)" }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                    <path d="M4 13c2-6 4-6 4 0s2 6 4 0 2-6 4 0 2 6 4 0" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="space-y-1.5">
                  <p className="text-sm font-bold text-[#241521]">Smith, your AI assistant</p>
                  <p className="text-xs text-[#9E6E85] max-w-[240px] mx-auto leading-relaxed">
                    Ask anything about technical audio, MIDI workspace configs or platform support.
                  </p>
                </div>
              </div>
            )}

            {messages.map((msg, index) => (
              <div key={index} className={`im-msg-in flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`flex flex-col gap-1.5 max-w-[82%] ${msg.role === "user" ? "items-end" : "items-start"}`}>
                  {msg.content && (
                    <div
                      className={`px-3.5 py-2.5 text-sm leading-relaxed break-words rounded-2xl ${
                        msg.role === "user"
                          ? "text-white font-medium rounded-br-md shadow-[0_6px_16px_rgba(255,92,161,0.32)]"
                          : "bg-white text-[#241521] font-medium rounded-bl-md shadow-[0_2px_10px_rgba(43,23,35,0.08)] border border-[#241521]/25"
                      }`}
                      style={msg.role === "user" ? { background: "linear-gradient(135deg, #FF4C99, #FF8AC0)" } : undefined}
                    >
                      {msg.content}
                    </div>
                  )}

                  {msg.images && msg.images.length > 0 && (
                    <div
                      className={`grid gap-1.5 ${msg.images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}
                      style={{ maxWidth: msg.images.length === 1 ? "220px" : "260px" }}
                    >
                      {msg.images.map((img, i) => (
                        <button
                          key={i}
                          onClick={() => setLightboxImage(img)}
                          className="im-thumb relative overflow-hidden rounded-xl border border-[#241521]/25 bg-white shadow-[0_2px_8px_rgba(43,23,35,0.08)] cursor-zoom-in"
                          style={{ aspectRatio: msg.images!.length === 1 ? "16/10" : "1/1" }}
                        >
                          <img
                            src={img.url}
                            alt={img.alt || "iMIDI attachment"}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                          <span className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-black/45 backdrop-blur-sm flex items-center justify-center">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                              <path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start im-msg-in">
                <div className="bg-white border border-[#241521]/25 rounded-2xl rounded-bl-md px-4 py-3.5 flex items-center gap-1.5 shadow-[0_2px_10px_rgba(43,23,35,0.08)]">
                  <span className="im-dot-1 w-1.5 h-1.5 rounded-full" style={{ background: "#FF5CA1" }} />
                  <span className="im-dot-2 w-1.5 h-1.5 rounded-full" style={{ background: "#FF8FBB" }} />
                  <span className="im-dot-3 w-1.5 h-1.5 rounded-full" style={{ background: "#FFB56B" }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* INPUT */}
          <form onSubmit={handleSendMessage} className="relative z-10 p-3 sm:pb-3 bg-white border-t border-[#241521]/25 shadow-[0_-4px_16px_rgba(43,23,35,0.06)] flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask iMIDI AI..."
              className="flex-1 h-11 px-4 text-sm bg-[#FFF3F7] border border-[#241521]/25 rounded-full outline-none text-[#241521] placeholder-[#B98CA0] font-medium focus:border-[#FF5CA1] focus:bg-white transition-colors"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="w-11 h-11 flex-shrink-0 flex items-center justify-center text-white rounded-full active:scale-95 disabled:opacity-25 disabled:active:scale-100 transition-all cursor-pointer shadow-[0_6px_18px_rgba(255,76,153,0.4)]"
              style={{ background: "linear-gradient(135deg, #FF4C99, #FFB56B)" }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 8h11M8 3l5 5-5 5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </form>

          {/* FOOTER */}
          <div className="relative z-10 flex items-center justify-center gap-1.5 py-2 pb-10 sm:pb-2 bg-white text-[10px] font-medium text-[#B98CA0]">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
              <path d="M4 13c2-6 4-6 4 0s2 6 4 0 2-6 4 0 2 6 4 0" stroke="#FF4C99" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>
              Powered by <span className="text-[#FF4C99] font-semibold">iMIDI App</span>
            </span>
          </div>
        </div>
      )}

      {/* LIGHTBOX — full view pentru imagini/thumbnail-uri */}
      {lightboxImage && (
        <div
          className="im-lightbox-bg fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-6"
          onClick={() => setLightboxImage(null)}
        >
          <div className="im-lightbox-img relative max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
            <img
              src={lightboxImage.url}
              alt={lightboxImage.alt || "iMIDI attachment"}
              className="max-w-full max-h-[80vh] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.5)] object-contain"
            />
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute -top-3 -right-3 w-9 h-9 rounded-full bg-white text-[#2B1723] flex items-center justify-center shadow-lg cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            {lightboxImage.alt && (
              <p className="im-font text-center text-white/80 text-xs mt-2">{lightboxImage.alt}</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}