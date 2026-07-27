import { supabase } from "@/lib/supabase";

export interface NewListingPayload {
  id: string;
  title: string;
  price: number;
  category: "instrument" | "preset";
  image: string | null;
}

export function listenToNewListings() {
  if (typeof window === "undefined") return null;

  // Ne conectăm direct la canalul tău existent 'new_listing_channel'
  const channel = supabase
    .channel("supabase-custom-notifications")
    .on(
      "broadcast",
      { event: "new_listing_channel" }, // Numele exact din pg_notify-ul tău
      (response) => {
        if (response.payload) {
          const data = response.payload as NewListingPayload;
          
          // Trimitem evenimentul global în browser cu datele venite din Postgres-ul tău
          const event = new CustomEvent("imidi-new-listing", { detail: data });
          window.dispatchEvent(event);
        }
      }
    )
    .subscribe();

  return channel;
}
