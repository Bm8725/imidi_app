'use client';

import React, { useState, useEffect, useRef, FormEvent } from 'react';
import { createClient } from '@supabase/supabase-js';

// Definim tipurile de date pentru TypeScript
interface Message {
  id: string;
  room_id: string;
  sender_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface ChatWindowProps {
  roomId: string;
  currentUserId: string;
  listingTitle?: string;
  sellerName?: string;
}

// Inițializare Supabase (asigură-te că ai variabilele în .env.local)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ChatWindow({ roomId, currentUserId, listingTitle, sellerName }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // 1. Încarcă istoricul mesajelor la deschiderea camerei
  useEffect(() => {
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setMessages(data as Message[]);
      }
    };

    fetchMessages();

    // 2. Ascultă LIVE mesajele noi prin WebSockets (Realtime)
    const channel = supabase
      .channel(`room-${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${roomId}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  // 3. Auto-scroll când apare un mesaj nou
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 4. Trimite mesajul nou
  const handleSendMessage = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const messageToSend = newMessage;
    setNewMessage(''); // Curăță input-ul instant pentru viteză vizuală

    const { error } = await supabase
      .from('chat_messages')
      .insert([
        {
          room_id: roomId,
          sender_id: currentUserId,
          message: messageToSend,
        },
      ]);

    if (error) {
      console.error("Eroare la trimitere:", error.message);
    }
  };

  return (
    <div className="flex flex-col h-[600px] w-full max-w-md mx-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden font-sans">
      
      {/* HEADER CHAT */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800/80 backdrop-blur-md border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-white font-bold text-lg shadow-md">
            {sellerName ? sellerName[0].toUpperCase() : 'M'}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">{sellerName || 'Muzician iMIDI'}</h3>
            <p className="text-xs text-amber-500 truncate max-w-[180px]">Set: {listingTitle || 'Anunț KORG'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-xs text-slate-400">Live</span>
        </div>
      </div>

      {/* ZONA DE MESAJE (SCROLLABLE) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950">
        {messages.map((msg) => {
          const isMe = msg.sender_id === currentUserId;
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[75%] px-4 py-2.5 rounded-2xl shadow-sm text-sm break-words transition-all duration-200 ${
                  isMe
                    ? 'bg-amber-500 text-slate-950 rounded-tr-none font-medium'
                    : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700/40'
                }`}
              >
                <p>{msg.message}</p>
                <span className={`text-[10px] mt-1 text-right block ${isMe ? 'text-slate-800/80' : 'text-slate-400'}`}>
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* INPUT TRIMITERE */}
      <form onSubmit={handleSendMessage} className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Scrie un mesaj sau întreabă de set..."
          className="flex-1 bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
        />
        <button
          type="submit"
          className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold p-2.5 rounded-xl shadow-md active:scale-95 transition-all flex items-center justify-center"
        >
          <svg xmlns="http://w3.org" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
          </svg>
        </button>
      </form>

    </div>
  );
}
