import { supabase } from "@/lib/supabase";
import { CLOUD_PLANS } from "@/lib/pricing";

// -----------------------------------------------------------------------------
// LIMITA DE STOCARE — dinamica, per user, citita din tabela user_storage_plan.
// Pas 1: Free = 50 MB (default).
// Pas 2: Pro = 30 GB, dupa prima achizitie ($50).
// Pas 3: Enterprise = 250 GB, extindere ulterioara daca 30GB nu ajunge.
// -----------------------------------------------------------------------------

export type StoragePlanId = "free" | "pro" | "enterprise";

const FREE_LIMIT_MB = 50;
const PRO_LIMIT_GB = CLOUD_PLANS.find((p) => p.id === "pro")!.storageGb; // 30
const PRO_LIMIT_MB = PRO_LIMIT_GB * 1024; // 30720

const ENTERPRISE_PLAN = CLOUD_PLANS.find((p) => p.id === "enterprise")!;
const ENTERPRISE_LIMIT_GB = ENTERPRISE_PLAN.storageGb; // 250
const ENTERPRISE_LIMIT_MB = ENTERPRISE_LIMIT_GB * 1024; // 256000
export const ENTERPRISE_PRICE_USD = ENTERPRISE_PLAN.price; // 149.9

export interface StorageCheckResult {
  allowed: boolean;
  plan: StoragePlanId;
  usedMb: number;
  limitMb: number;
  remainingMb: number;
}

/** Cati MB are userul deja folositi (suma din cloud_banks.size_mb). */
async function getUsedStorageMbFromDb(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from("cloud_banks")
    .select("size_mb")
    .eq("user_id", userId);

  if (error) throw error;
  return (data ?? []).reduce((acc, row) => acc + Number(row.size_mb), 0);
}

/**
 * Limita curenta a userului (MB), citita din user_storage_plan.
 * Daca nu exista niciun rand inca (user nou), se considera Free = 50MB.
 */
export async function getUserStorageLimitMb(userId: string): Promise<{ plan: StoragePlanId; limitMb: number }> {
  const { data, error } = await supabase
    .from("user_storage_plan")
    .select("plan, limit_mb")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return { plan: "free", limitMb: FREE_LIMIT_MB };
  return { plan: data.plan as StoragePlanId, limitMb: Number(data.limit_mb) };
}

/** Verifica spatiul folosit fata de limita curenta a userului. */
export async function checkStorageLimit(userId: string): Promise<StorageCheckResult> {
  const [usedMb, { plan, limitMb }] = await Promise.all([
    getUsedStorageMbFromDb(userId),
    getUserStorageLimitMb(userId),
  ]);

  return {
    allowed: usedMb <= limitMb,
    plan,
    usedMb,
    limitMb,
    remainingMb: Math.max(0, limitMb - usedMb),
  };
}

/** Pas 1: Upgrade la Pro (30GB) — apeleaza dupa confirmarea platii de $50. */
export async function upgradeToProPlan(userId: string) {
  const { error } = await supabase
    .from("user_storage_plan")
    .upsert({ user_id: userId, plan: "pro", limit_mb: PRO_LIMIT_MB, updated_at: new Date().toISOString() });

  if (error) throw error;
  return { plan: "pro" as const, limitMb: PRO_LIMIT_MB };
}

/** Pas 2: Upgrade la Enterprise (250GB) — apeleaza dupa confirmarea platii Enterprise. */
export async function upgradeToEnterprisePlan(userId: string) {
  const { error } = await supabase
    .from("user_storage_plan")
    .upsert({ user_id: userId, plan: "enterprise", limit_mb: ENTERPRISE_LIMIT_MB, updated_at: new Date().toISOString() });

  if (error) throw error;
  return { plan: "enterprise" as const, limitMb: ENTERPRISE_LIMIT_MB };
}