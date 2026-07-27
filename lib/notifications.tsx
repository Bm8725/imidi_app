import { supabase } from "./supabase";

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  href?: string;
  image?: string;
  read: boolean;
  createdAt: string;
}

let globalNotifications: AppNotification[] = [];

/**
 * Inițializează ascultarea notificărilor și încarcă datele inițiale.
 */
export function initNotifications(setNotifications: (notifs: AppNotification[]) => void) {
  const fetchNotifications = async () => {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      const mapped: AppNotification[] = data.map((item: any) => ({
        id: item.id,
        title: item.title,
        message: item.message,
        href: item.href || undefined,
        image: item.image || undefined,
        read: item.read ?? false,
        createdAt: item.created_at,
      }));
      
      globalNotifications = mapped;
      setNotifications(mapped);
    }
  };

  fetchNotifications();

  // Corectat eroarea de tip: am trecut tipul generic în .on() și am schimbat "scheme" în "schema"
  const channel = supabase
    .channel("realtime-notifications")
    .on(
      "postgres_changes" as any,
      { event: "*", schema: "public", table: "notifications" },
      () => {
        fetchNotifications();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Marchează instantaneu toate notificările curente ca fiind citite.
 */
export function markAllNotificationsRead(): AppNotification[] {
  globalNotifications = globalNotifications.map((n) => ({ ...n, read: true }));

  supabase
    .from("notifications")
    .update({ read: true })
    .eq("read", false)
    .then(({ error }) => {
      if (error) console.error("Eroare la marcarea ca citite:", error);
    });

  return globalNotifications;
}

