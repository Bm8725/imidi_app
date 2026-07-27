/**
 * lib/postMessageBuilder.ts
 * Construiește automat textul postării pe baza unei listări (listings).
 */

export interface Listing {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  images: string[];
  digital_link: string | null;
  expires_at: string;
  bank_id: number | null;
}

/**
 * Generează mesajul standard pentru postare, incluzând automat
 * linkul de promovare (digital_link) dacă listarea îl are.
 */
export function buildPostMessage(listing: Listing): string {
  const parts = [listing.title, "", listing.description, "", `Preț: ${listing.price} €`];

  if (listing.digital_link) {
    parts.push("", `🔗 ${listing.digital_link}`);
  }

  return parts.join("\n");
}

/**
 * Returnează prima imagine disponibilă din listare, pentru postarea pe FB.
 */
export function getListingImage(listing: Listing): string | undefined {
  return listing.images?.[0];
}