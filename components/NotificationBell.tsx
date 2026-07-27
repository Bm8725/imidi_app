"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  created_at: string;
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setUserId(session.user.id);

      // Încărcăm notificările existente (ultimele 20)
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (data) setNotifications(data);

      // Abonare live: orice notificare nouă pentru acest user apare instant
      channel = supabase
        .channel("notifications-changes")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${session.user.id}`,
          },
          (payload) => {
            setNotifications((prev) => [payload.new as Notification, ...prev]);
          }
        )
        .subscribe();
    })();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const markAllRead = async () => {
    if (!userId) return;
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;

    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await supabase.from("notifications").update({ read: true }).in("id", unreadIds);
  };

  const toggleOpen = () => {
    setOpen((prev) => {
      if (!prev) markAllRead(); // la deschidere, marcăm tot ca citit
      return !prev;
    });
  };

  return (
    <div className="relative">
      <button
        onClick={toggleOpen}
        className="relative w-9 h-9 rounded-lg border border-zinc-200 bg-white flex items-center justify-center hover:bg-zinc-50 transition-colors"
      >
        <svg className="w-4 h-4 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white border border-zinc-200 rounded-xl shadow-lg z-50 max-h-96 overflow-y-auto">
          <div className="p-3 border-b border-zinc-100">
            <p className="text-xs font-bold text-zinc-900">Notificări</p>
          </div>

          {notifications.length === 0 ? (
            <p className="p-4 text-xs text-zinc-400 text-center">Nicio notificare încă.</p>
          ) : (
            <div className="divide-y divide-zinc-100">
              {notifications.map((n) => (
                <div key={n.id} className="p-3 hover:bg-zinc-50">
                  <p className="text-xs font-semibold text-zinc-900">{n.title}</p>
                  {n.body && <p className="text-[11px] text-zinc-500 mt-0.5">{n.body}</p>}
                  <p className="text-[10px] text-zinc-400 mt-1">
                    {new Date(n.created_at).toLocaleString("ro-RO")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}