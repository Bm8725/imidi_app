// -----------------------------------------------------------------------------
// PRICING — sursa unica de adevar pentru planuri, comision si promovare.
// Modifica doar aici daca schimbi preturi/procente — restul aplicatiei citeste
// de aici, nu are numere hardcodate.
// -----------------------------------------------------------------------------

export interface CloudPlan {
  id: "free" | "pro" | "enterprise";
  name: string;
  tagline: string;
  price: number; // in USD, /an. 0 = gratuit
  storageGb: number;
  features: string[];
  highlighted?: boolean; // planul recomandat, evidentiat in popup
  ctaLabel: string;
}

export const CLOUD_PLANS: CloudPlan[] = [
  {
    id: "free",
    name: "Free",
    tagline: "Pentru inceput, fara costuri",
    price: 0,
    storageGb: 2,
    features: [
      "2 GB memorie cloud",
      "Sync manual, o singura setare activa",
      "Suport prin comunitate",
    ],
    ctaLabel: "Planul curent",
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "Pentru artisti activi pe scena",
    price: 49.9,
    storageGb: 30,
    features: [
      "30 GB memorie cloud",
      "Sync hardware binaries & script parameters",
      "Acces hot-reload zero-latenta pe scena",
      "Suport prioritar prin email",
    ],
    highlighted: true,
    ctaLabel: "Treci la Pro",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    tagline: "Pentru studiouri si echipe",
    price: 149.9,
    storageGb: 250,
    features: [
      "250 GB memorie cloud",
      "Toate beneficiile Pro",
      "Acces API pentru automatizari",
      "Manager de cont dedicat",
    ],
    ctaLabel: "Contacteaza-ne",
  },
];

// -----------------------------------------------------------------------------
// COMISION — platforma retine acest procent din fiecare vanzare de produs digital
// (presets, soundbank-uri, script-uri etc.)
// -----------------------------------------------------------------------------

export const PLATFORM_COMMISSION_RATE = 0.2; // 20%

/** Calculeaza cat primeste vanzatorul si cat retine platforma dintr-un pret brut. */
export function calculateSellerPayout(grossPrice: number) {
  const commission = Math.round(grossPrice * PLATFORM_COMMISSION_RATE * 100) / 100;
  const sellerReceives = Math.round((grossPrice - commission) * 100) / 100;
  return { grossPrice, commission, sellerReceives, rate: PLATFORM_COMMISSION_RATE };
}

// -----------------------------------------------------------------------------
// PROMOVARE — vanzatorul plateste ca sa apara mai sus in listari, pe o durata aleasa
// -----------------------------------------------------------------------------

export interface PromotionTier {
  days: 15 | 30 | 45;
  price: number; // in USD
  label: string;
}

export const PROMOTION_TIERS: PromotionTier[] = [
  { days: 15, price: 9.9, label: "15 zile" },
  { days: 30, price: 17.9, label: "30 zile" },
  { days: 45, price: 24.9, label: "45 zile" },
];