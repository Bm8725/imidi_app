import { supabase } from "@/lib/supabase";
import { PROMOTION_TIERS, type PromotionTier } from "@/lib/pricing";

/**
 * Activeaza promovarea unui anunt pentru X zile (15/30/45), incepand de ACUM.
 * Apeleaza asta dupa ce ai confirmat plata (la fel ca upgradeToProPlan).
 */
export async function activatePromotion(listingId: string, days: PromotionTier["days"]) {
  const tier = PROMOTION_TIERS.find((t) => t.days === days);
  if (!tier) throw new Error("Durata de promovare invalida.");

  const promotedUntil = new Date();
  promotedUntil.setDate(promotedUntil.getDate() + days);

  const { error } = await supabase
    .from("listings")
    .update({ promoted_until: promotedUntil.toISOString() })
    .eq("id", listingId);

  if (error) throw error;
  return { promotedUntil };
}

/** Un anunt e promovat daca promoted_until exista si e in viitor. */
export function isPromoted(promotedUntil: string | null | undefined): boolean {
  if (!promotedUntil) return false;
  return new Date(promotedUntil).getTime() > Date.now();
}