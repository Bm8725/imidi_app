import { supabase } from "./supabase";

// Definirea structurii unei notificări din aplicație
export interface AppNotification {
  id: string;
  title: string;
  message: string;
  href?: string;
  image?: string;
  read: boolean;
  createdAt: string;
}

// O stare locală globală pentru a păstra notificările în memorie la mutări de pagini
let globalNotifications: AppNotification[] = [];

/**
 * Inițializează ascultarea notificărilor și încarcă datele inițiale.
 * @param setNotifications Callback-ul React din componentă pentru actualizarea stării interne.
 */
export function initNotifications(setNotifications: (notifs: AppNotification[]) => void) {
  // Funcție locală pentru a prelua datele din Supabase
  const fetchNotifications = async () => {
    const { data, error } = await supabase
      .from("notifications") // Numele tabelei din baza ta de date Supabase
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      // Mapăm câmpurile din baza de date la interfața AppNotification
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

  // Ascultare în timp real prin Supabase Realtime pentru inserări sau modificări noi
  const channel = supabase
    .channel("realtime-notifications")
    .on(
      "postgres_changes",
      { event: "*", scheme: "public", table: "notifications" },
      () => {
        // Când se schimbă ceva în baza de date, refacem fetch-ul
        fetchNotifications();
      }
    )
    .subscribe();

  // Returnăm o funcție de cleanup pe care useEffect-ul din Navbar o va executa la demontare
  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Marchează instantaneu toate notificările curente ca fiind citite.
 * @returns Lista actualizată de notificări marcată local ca citită.
 */
export function markAllNotificationsRead(): AppNotification[] {
  // Actualizăm starea în memorie instant pentru un feedback UI rapid
  globalNotifications = globalNotifications.map((n) => ({ ...n, read: true }));

  // Trimitem asincron cererea de update în Supabase
  supabase
    .from("notifications")
    .update({ read: true })
    .eq("read", false) // Doar cele necitite
    .then(({ error }) => {
      if (error) console.error("Eroare la marcarea notificărilor ca citite:", error);
    });

  return globalNotifications;
}
