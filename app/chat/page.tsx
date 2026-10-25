'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import ChatWindow from '@/components/ChatWindow';

interface ChatRoom {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  created_at: string;
  partner_email: string;
  listing_title: string;
}

interface ListingOption {
  id: string;
  title: string;
  seller_id: string;
}

export default function GlobalChatPage() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal state
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [listingSearch, setListingSearch] = useState('');
  const [listingResults, setListingResults] = useState<ListingOption[]>([]);
  const [searchingListings, setSearchingListings] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function fetchRooms(userId: string) {
      const { data: roomsData, error } = await supabase
        .from('chat_rooms')
        .select(`
          id,
          listing_id,
          buyer_id,
          seller_id,
          created_at,
          listings (title)
        `)
        .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Eroare la încărcarea camerelor:', error.message);
        if (isMounted) setLoading(false);
        return;
      }

      const formattedRooms: ChatRoom[] = (roomsData || []).map((room: any) => {
        const isBuyer = room.buyer_id === userId;
        const partnerLabel = isBuyer
          ? `Vânzător · ${room.seller_id.slice(0, 6)}…`
          : `Cumpărător · ${room.buyer_id.slice(0, 6)}…`;

        return {
          id: room.id,
          listing_id: room.listing_id,
          buyer_id: room.buyer_id,
          seller_id: room.seller_id,
          created_at: room.created_at,
          partner_email: partnerLabel,
          listing_title: room.listings?.title || 'Discuție iMIDI',
        };
      });

      if (isMounted) {
        setRooms(formattedRooms);
        setSelectedRoom((prev) => {
          if (!prev && formattedRooms.length > 0) return formattedRooms[0];
          return prev;
        });
        setLoading(false);
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;

      if (event === 'INITIAL_SESSION' && !session) {
        setTimeout(async () => {
          const {
            data: { session: retrySession },
          } = await supabase.auth.getSession();

          if (!retrySession && isMounted) {
            window.location.href = '/login';
          } else if (retrySession && isMounted) {
            setCurrentUserId(retrySession.user.id);
            fetchRooms(retrySession.user.id);
          }
        }, 300);
        return;
      }

      if (event === 'SIGNED_OUT' || (!session && event !== 'INITIAL_SESSION')) {
        window.location.href = '/login';
        return;
      }

      if (session) {
        setCurrentUserId(session.user.id);
        fetchRooms(session.user.id);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Caută anunțuri pentru modal
  useEffect(() => {
    if (!listingSearch.trim() || !isNewChatOpen) {
      setListingResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setSearchingListings(true);

      const { data, error } = await supabase
        .from('listings')
        .select('id, title, seller_id')
        .ilike('title', `%${listingSearch}%`)
        .neq('seller_id', currentUserId) // nu-ți arăți propriile anunțuri
        .limit(8);

      if (!error && data) {
        setListingResults(data);
      }
      setSearchingListings(false);
    }, 300);

    return () => clearTimeout(timeout);
  }, [listingSearch, isNewChatOpen, currentUserId]);

  async function startChatWithListing(listing: ListingOption) {
    if (!currentUserId) return;

    // 1. Verifică dacă există deja camera
    const { data: existing } = await supabase
      .from('chat_rooms')
      .select('id')
      .eq('listing_id', listing.id)
      .eq('buyer_id', currentUserId)
      .eq('seller_id', listing.seller_id)
      .maybeSingle();

    let roomId = existing?.id;

    // 2. Dacă nu există, o creează
    if (!roomId) {
      const { data: newRoom, error } = await supabase
        .from('chat_rooms')
        .insert({
          listing_id: listing.id,
          buyer_id: currentUserId,
          seller_id: listing.seller_id,
        })
        .select('id')
        .single();

      if (error || !newRoom) {
        console.error('Eroare la crearea camerei:', error);
        return;
      }
      roomId = newRoom.id;
    }

    // 3. Reîncarcă lista de camere și selectează camera nouă
    const { data: roomsData } = await supabase
      .from('chat_rooms')
      .select(`
        id,
        listing_id,
        buyer_id,
        seller_id,
        created_at,
        listings (title)
      `)
      .or(`buyer_id.eq.${currentUserId},seller_id.eq.${currentUserId}`)
      .order('created_at', { ascending: false });

    const formattedRooms: ChatRoom[] = (roomsData || []).map((room: any) => {
      const isBuyer = room.buyer_id === currentUserId;
      const partnerLabel = isBuyer
        ? `Vânzător · ${room.seller_id.slice(0, 6)}…`
        : `Cumpărător · ${room.buyer_id.slice(0, 6)}…`;

      return {
        id: room.id,
        listing_id: room.listing_id,
        buyer_id: room.buyer_id,
        seller_id: room.seller_id,
        created_at: room.created_at,
        partner_email: partnerLabel,
        listing_title: room.listings?.title || 'Discuție iMIDI',
      };
    });

    setRooms(formattedRooms);
    const newSelected = formattedRooms.find((r) => r.id === roomId) || null;
    setSelectedRoom(newSelected);

    // Închide modalul
    setIsNewChatOpen(false);
    setListingSearch('');
    setListingResults([]);
  }

  const filteredRooms = rooms.filter(
    (room) =>
      room.partner_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.listing_title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-9 h-9 border-[3px] border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Se încarcă conversațiile…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <div className="max-w-6xl mx-auto h-[calc(100vh-2rem)] my-4 px-4">
        <div className="h-full bg-white border border-slate-200 rounded-xl shadow-sm flex overflow-hidden">
          
          {/* SIDEBAR */}
          <aside className="w-[320px] flex flex-col border-r border-slate-200 bg-slate-50/80">
            <div className="px-5 py-4 border-b border-slate-200 bg-white">
              <div className="flex items-center justify-between mb-3">
                <h1 className="text-base font-semibold text-slate-900 tracking-tight">
                  Mesaje
                </h1>
                <button
                  onClick={() => setIsNewChatOpen(true)}
                  className="text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg transition"
                >
                  + Mesaj nou
                </button>
              </div>

              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                  />
                </svg>
                <input
                  type="text"
                  placeholder="Caută conversații…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-100 border-0 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:bg-white transition"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {filteredRooms.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <p className="text-sm font-medium text-slate-600">
                    {searchQuery ? 'Nicio conversație găsită' : 'Nicio conversație activă'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Apasă pe „Mesaj nou” ca să începi o discuție
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {filteredRooms.map((room) => {
                    const isSelected = selectedRoom?.id === room.id;
                    return (
                      <li key={room.id}>
                        <button
                          onClick={() => setSelectedRoom(room)}
                          className={`w-full text-left px-5 py-3.5 flex gap-3 transition-colors ${
                            isSelected
                              ? 'bg-indigo-50 border-l-[3px] border-indigo-600'
                              : 'hover:bg-slate-100/80 border-l-[3px] border-transparent'
                          }`}
                        >
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${
                              isSelected
                                ? 'bg-indigo-100 text-indigo-700'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {room.partner_email.charAt(0).toUpperCase()}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <span
                                className={`text-sm font-medium truncate ${
                                  isSelected ? 'text-indigo-900' : 'text-slate-800'
                                }`}
                              >
                                {room.partner_email}
                              </span>
                              <span className="text-[11px] text-slate-400 shrink-0">
                                {new Date(room.created_at).toLocaleDateString('ro-RO', {
                                  day: 'numeric',
                                  month: 'short',
                                })}
                              </span>
                            </div>
                            <p
                              className={`text-xs mt-0.5 truncate ${
                                isSelected ? 'text-indigo-600' : 'text-slate-500'
                              }`}
                            >
                              {room.listing_title}
                            </p>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>

          {/* CHAT AREA */}
          <main className="flex-1 flex flex-col bg-white min-w-0">
            {selectedRoom && currentUserId ? (
              <div className="h-full w-full">
                <ChatWindow
                  roomId={selectedRoom.id}
                  currentUserId={currentUserId}
                  listingTitle={selectedRoom.listing_title}
                  sellerName={selectedRoom.partner_email}
                />
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
                <h2 className="text-lg font-semibold text-slate-800 mb-1">
                  Selectează o conversație
                </h2>
                <p className="text-sm text-slate-500 max-w-xs">
                  Alege o discuție din listă sau începe una nouă.
                </p>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* MODAL - MESAJ NOU */}
      {isNewChatOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              setIsNewChatOpen(false);
              setListingSearch('');
              setListingResults([]);
            }}
          />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Mesaj nou</h2>
              <button
                onClick={() => {
                  setIsNewChatOpen(false);
                  setListingSearch('');
                  setListingResults([]);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="p-5">
              <input
                type="text"
                placeholder="Caută un anunț..."
                value={listingSearch}
                onChange={(e) => setListingSearch(e.target.value)}
                autoFocus
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
              />

              <div className="mt-3 max-h-64 overflow-y-auto">
                {searchingListings && (
                  <p className="text-sm text-slate-400 py-4 text-center">Se caută...</p>
                )}

                {!searchingListings && listingSearch && listingResults.length === 0 && (
                  <p className="text-sm text-slate-400 py-4 text-center">Niciun anunț găsit</p>
                )}

                {listingResults.map((listing) => (
                  <button
                    key={listing.id}
                    onClick={() => startChatWithListing(listing)}
                    className="w-full text-left px-3 py-3 rounded-lg hover:bg-slate-50 transition flex flex-col gap-0.5"
                  >
                    <span className="text-sm font-medium text-slate-800">{listing.title}</span>
                    <span className="text-xs text-slate-400">Apasă ca să începi conversația</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}