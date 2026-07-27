import { supabase } from "@/lib/supabase";

interface NewListingPayload {
  id: string;
  title: string;
  price: number;
  image: string | null;
  category: string;
}

export function listenToNewListings() {
  if (typeof window === "undefined") return null;

  const channel = supabase
    .channel("postgres-notifications")
    .on(
      "broadcast",
      { event: "new_listing_channel" },
      (response) => {
        if (response.payload) {
          const data = response.payload as NewListingPayload;
          
          // Trimitem un eveniment global în browser cu datele anunțului
          const event = new CustomEvent("imidi-new-listing", { detail: data });
          window.dispatchEvent(event);
        }
      }
    )
    .subscribe();

  return channel;
}
