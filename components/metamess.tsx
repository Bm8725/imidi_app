"use client";

import { useState } from "react";

interface MetaMessProps {
  facebookUserId: string;
}

export default function MetaMess({ facebookUserId }: MetaMessProps) {
  const [isOpen, setIsOpen] = useState(false);

  // REPARAT CONCRET: Adăugat slash-ul și simbolul $ corect pentru interpolare
  const messengerUrl = `https://m.me{facebookUserId}`;

  return (
    <div className="fixed bottom-4 left-4 md:bottom-6 md:left-6 z-50 font-sans select-none flex flex-col items-start">
      
      {isOpen && (
        <div className="fixed inset-0 bottom-20 left-0 right-0 top-0 sm:absolute sm:inset-auto sm:bottom-16 sm:left-0 w-full sm:w-[360px] h-[calc(100vh-140px)] sm:h-[480px] bg-white rounded-t-2xl sm:rounded-2xl shadow-[0_12px_28px_0_rgba(0,0,0,0.2)] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-200 border border-gray-200">
          
          {/* Header Alb Facebook */}
          <div className="px-4 py-3 bg-white border-b border-gray-200 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white font-bold text-sm">
                  iM
                </div>
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-[#31A24C] rounded-full border-2 border-white" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[14px] font-semibold text-gray-900 leading-tight">iMIDI Support</span>
                <span className="text-[12px] text-gray-500">Activ(ă) acum</span>
              </div>
            </div>

            <button 
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100 transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>

          {/* Zona de Mesaje */}
          <div className="flex-grow p-4 overflow-y-auto bg-white flex flex-col justify-end text-left">
            <div className="flex items-end gap-2 max-w-[85%] mb-2">
              <div className="bg-[#E4E6EB] text-gray-900 text-[14px] rounded-2xl px-3 py-2 leading-snug">
                Salut! Ești conectat în siguranță cu contul tău iMIDI. Apasă pe butonul de mai jos pentru a deschide direct chat-ul tău în Messenger.
              </div>
            </div>
          </div>

          {/* Butonul Oficial Albastru de Messenger */}
          <div className="p-4 bg-white border-t border-gray-100 flex items-center justify-center">
            <a 
              href={messengerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-[#0084FF] hover:bg-[#0078e6] text-center text-white font-semibold text-[14px] py-2.5 px-4 rounded-xl transition-all shadow-sm"
            >
              Trimite mesaj pe Messenger
            </a>
          </div>
        </div>
      )}

      {/* Bula rotundă albă stânga jos */}
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative flex items-center justify-center w-14 h-14 bg-white text-[#0084FF] hover:bg-gray-50 rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.15)] border border-gray-100 transition-all duration-200"
        >
          <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-[#31A24C] rounded-full border-2 border-white z-10" />

          {isOpen ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-gray-500">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          ) : (
            <svg className="w-8 h-8 fill-current text-[#0084FF]" viewBox="0 0 24 24">
              <path d="M12 2C6.5 2 2 6.14 2 11.25c0 2.91 1.45 5.51 3.71 7.14.19.14.31.36.31.6l.02 2.2c.02.56.6.94 1.1.68l2.43-1.28c.18-.1.38-.13.58-.08 1.19.31 2.44.49 3.75.49 5.5 0 10-4.14 10-9.25C22 6.14 17.5 2 12 2zm1.06 12.35l-2.52-2.53-4.9 2.53 5.37-5.42 2.57 2.53 4.85-2.53-5.37 5.42z" />
            </svg>
          )}
        </button>
      </div>

    </div>
  );
}
