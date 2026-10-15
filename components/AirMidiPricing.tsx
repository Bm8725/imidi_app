// components/AirMidiPricing.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/* ---------------------------------------------------------------------- */
/* >>> PUT YOUR REVOLUT LINK HERE (or set NEXT_PUBLIC_REVOLUT_URL)          */
/*     e.g.  https://revolut.me/yourtag                                    */
/* ---------------------------------------------------------------------- */
export const REVOLUT_URL = process.env.NEXT_PUBLIC_REVOLUT_URL || "https://revolut.me/mariusvalentin_b";

type Plan = { id: string; name: string; price: number; currency: string; hours: number };
type Account = { balance: number; free_seconds: number; free_per_day: number; free_used_today: number } | null;
type PayReq = { reference: string; amount: number; currency: string; hours: number; plan: string };
type HistoryRow = { reference: string; plan_id: string; amount: number; currency: string; status: string; created_at: string };

// shown until the plans table answers (same numbers as the SQL seed)
const DEFAULT_PLANS: Plan[] = [
  { id: "starter", name: "Starter", price: 19, currency: "EUR", hours: 30 },
  { id: "pro", name: "Pro", price: 49, currency: "EUR", hours: 80 },
];

const money = (n: number, cur: string, digits = 2) => {
  try {
    return new Intl.NumberFormat("en-IE", { style: "currency", currency: cur, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
  } catch {
    return `${n.toFixed(digits)} ${cur}`;
  }
};

const fmtHours = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
};

const STATUS_CHIP: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
};

const Tick = () => (
  <svg className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 13l4 4L19 7" />
  </svg>
);

function explain(msg?: string) {
  const m = msg || "";
  if (m.includes("TOO_MANY_PENDING")) return "You already have 3 payments waiting for confirmation. Wait until one is confirmed first.";
  if (m.includes("UNKNOWN_PLAN")) return "This plan is not available right now.";
  if (m.includes("NOT_AUTHENTICATED")) return "Please sign in again.";
  if (m.includes("airmidi_request_payment") || m.includes("schema cache")) return "Payments are not set up yet.";
  return "Could not start the payment. Please try again.";
}

export default function AirMidiPricing({
  open,
  onClose,
  hoursLeft,
  account,
}: {
  open: boolean;
  onClose: () => void;
  hoursLeft: number | null;
  account: Account;
}) {
  const [plans, setPlans] = useState<Plan[]>(DEFAULT_PLANS);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [req, setReq] = useState<PayReq | null>(null);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<HistoryRow[]>([]);

  useEffect(() => {
    if (!open) return;
    setError("");
    setReq(null);
    setCopied(false);
    supabase
      .from("airmidi_plans")
      .select("id,name,price,currency,hours")
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data, error: e }) => {
        if (!e && data && data.length) {
          setPlans(data.map((p: any) => ({ id: p.id, name: p.name, price: Number(p.price), currency: p.currency, hours: Number(p.hours) })));
        }
      });
    supabase
      .from("airmidi_payment_requests")
      .select("reference,plan_id,amount,currency,status,created_at")
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data, error: e }) => {
        if (!e && data) setHistory(data as HistoryRow[]);
      });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const freeMin = Math.max(1, Math.round((account?.free_seconds ?? 300) / 60));
  const freePerDay = account?.free_per_day ?? 6;
  const onFree = hoursLeft !== null && hoursLeft <= 0;
  const perHour = (p: Plan) => p.price / p.hours;
  const bestId = plans.length > 1 ? [...plans].sort((a, b) => perHour(a) - perHour(b))[0].id : null;

  const choose = async (plan: Plan) => {
    setError("");
    setBusy(plan.id);
    const { data, error: e } = await supabase.rpc("airmidi_request_payment", { p_plan: plan.id });
    setBusy(null);
    if (e || !data) {
      setError(explain(e?.message));
      return;
    }
    setReq({ reference: data.reference, amount: Number(data.amount), currency: data.currency, hours: Number(data.hours), plan: plan.name });
    supabase
      .from("airmidi_payment_requests")
      .select("reference,plan_id,amount,currency,status,created_at")
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data: rows, error: e2 }) => {
        if (!e2 && rows) setHistory(rows as HistoryRow[]);
      });
  };


  const SELLER_WHATSAPP = "40729411747"; 

  const copyRef = () => {
    if (!req) return;
    try {
      // 1. Pregătim mesajul corect text
      const message = `Salut! Am trimis plata prin Revolut.\n\n` +
                      `*Plan:* req.plan ({req.hours} ore)\n` +
                      `*Sumă:* \${money(req.amount, req.currency)}\n` +
                      `*Referință:* \`${req.reference}\``;

      // 2. Generăm link-ul oficial wa.me
      const whatsappUrl = `https://wa.me{SELLER_WHATSAPP}?text=${encodeURIComponent(message)}`;
      
      // 3. DESCHIDEM INSTANT fereastra (fără await înainte), ca browserul să nu o blocheze
      window.open(whatsappUrl, "_blank", "noopener,noreferrer");

      // 4. Copiem codul în clipboard imediat după în fundal
      navigator.clipboard.writeText(req.reference).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }).catch(err => console.error("Eroare clipboard:", err));

    } catch (error) {
      console.error("Eroare generală:", error);
    }
  };



  return (
    <div
      className="am-fade-up fixed inset-0 z-[75] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Get streaming hours"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-4xl max-h-[94dvh] overflow-y-auto am-scroll rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 bg-[#0F1B2D] px-5 sm:px-7 py-5 rounded-t-3xl">
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white">Get streaming hours</h2>
            <p className="text-xs text-slate-300 mt-1">
              Only the sender spends hours. Receivers always join for free.
              {hoursLeft !== null && (
                <>
                  {" "}
                  <span className="font-semibold text-white">
                    {hoursLeft > 0 ? `You have ${fmtHours(hoursLeft)} left.` : "You are on the free plan."}
                  </span>
                </>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 w-9 h-9 rounded-full border border-white/20 bg-white/10 text-white hover:bg-white/20 transition-colors flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        <div className="p-5 sm:p-7 space-y-6">
          {error && (
            <div className="text-xs bg-red-50 border border-red-200 p-3.5 rounded-xl text-red-700 font-medium">{error}</div>
          )}

           {/* STEP 2: pay on Revolut */}
          {req ? (
            <div className="am-fade-up max-w-xl mx-auto space-y-6">
              <button onClick={() => setReq(null)} className="text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors py-1">
                ← Back to plans
              </button>
              
              <div className="text-center space-y-1">
                <p className="text-[11px] uppercase tracking-wider font-bold text-slate-500">{req.plan} plan · {req.hours} hours</p>
                <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Send {money(req.amount, req.currency)} on Revolut</h3>
              </div>

              {/* PASUL 1: Butonul de plată Revolut */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-700">Step 1: Make the payment</p>
                <a
                  href={REVOLUT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 text-[14px] font-bold px-6 py-3.5 rounded-xl bg-[#0075eb] text-white shadow-md shadow-blue-500/20 hover:bg-[#0066cc] transition-all text-center"
                >
                  Pay with Revolut
                </a>
              </div>

              {/* Caseta cu codul de referință */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center space-y-2">
                <p className="text-xs text-slate-500 font-medium">Your Payment Reference ID:</p>
                <div className="flex items-center justify-center gap-2">
                  <code className="text-base font-mono font-bold text-slate-800 bg-white border border-slate-200 px-3 py-1 rounded-lg">
                    {req.reference}
                  </code>
                  <button
                    onClick={copyRef}
                    className="text-xs font-semibold px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors"
                  >
                    {copied ? "✓ Copied" : "Copy Code"}
                  </button>
                </div>
              </div>

              {/* PASUL 2: Butonul de WhatsApp */}
              <div className="space-y-2 text-center">
                <p className="text-xs font-semibold text-slate-700 text-left">Step 2: Confirm your payment</p>
                <button
                  onClick={copyRef}
                  className="w-full inline-flex items-center justify-center gap-2.5 text-[14px] font-bold px-6 py-3.5 rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-500 hover:shadow-lg hover:shadow-emerald-600/30 hover:-translate-y-0.5 active:translate-y-0 active:scale-98 transition-all duration-200 border border-white/10"
                >
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397 0 11.973 0c3.184.001 6.177 1.242 8.426 3.496 2.249 2.254 3.487 5.251 3.486 8.442-.005 6.623-5.34 11.971-11.918 11.971-2.007-.001-3.98-.51-5.725-1.479L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.742.002-2.602-1.01-5.05-2.85-6.89C16.586 2.13 14.143 1.128 11.98 1.128c-5.444 0-9.866 4.372-9.87 9.747-.002 1.702.459 3.361 1.336 4.81l-1.015 3.703 3.829-.989zm13.411-6.195c-.277-.139-1.64-.809-1.894-.9-.253-.093-.438-.139-.623.139-.184.279-.714.9-.874 1.084-.16.185-.32.208-.597.069-.277-.139-1.169-.43-2.227-1.374-.823-.734-1.379-1.641-1.54-1.92-.16-.279-.017-.43.122-.568.125-.124.277-.323.416-.483.139-.16.185-.274.277-.457.092-.183.046-.347-.023-.486-.069-.139-.623-1.501-.853-2.053-.224-.539-.452-.465-.623-.474-.16-.008-.345-.01-.53-.01-.185 0-.486.07-.741.347-.255.279-.972.951-.972 2.32 0 1.369.996 2.69 1.135 2.875.139.185 1.96 2.994 4.748 4.199.663.288 1.18.46 1.583.589.666.212 1.272.182 1.751.11.534-.08 1.64-.67 1.872-1.318.23-.647.23-1.203.16-1.318-.069-.115-.25-.185-.527-.324z"/>
                  </svg>
                  Notify Seller on WhatsApp
                </button>
              </div>

            </div>
          ) : (

            <>
              {/* STEP 1: plans */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 pt-3">
                {/* free */}
                <div className="relative rounded-2xl border border-slate-200 bg-white p-5 flex flex-col">
                  <p className="text-[11px] uppercase tracking-wider font-bold text-slate-500">Free</p>
                  <p className="mt-3 flex items-baseline gap-1.5">
                    <span className="text-4xl font-bold tracking-tight text-slate-900">{money(0, "EUR", 0)}</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-1">{freeMin}-minute sessions</p>
                  <ul className="mt-5 space-y-2.5 text-sm text-slate-600">
                    {[`Sessions end after ${freeMin} minutes`, `Up to ${freePerDay} free sessions per day`, "MIDI, video, voice, keyboard and controls"].map((t) => (
                      <li key={t} className="flex gap-2.5">
                        <Tick />
                        {t}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto pt-6">
                    <span className="block text-center h-11 leading-[2.75rem] rounded-xl bg-slate-100 text-slate-500 text-xs font-bold">
                      {onFree ? "Your current plan" : "Always available"}
                    </span>
                  </div>
                </div>

                {/* paid */}
                {plans.map((p) => {
                  const best = p.id === bestId;
                  return (
                    <div
                      key={p.id}
                      className={`relative rounded-2xl bg-white p-5 flex flex-col ${
                        best ? "border-2 border-blue-700 shadow-[0_18px_40px_-18px_rgba(29,78,216,0.45)]" : "border border-slate-200"
                      }`}
                    >
                      {best && (
                        <span className="absolute -top-3 left-5 bg-blue-700 text-white text-[10px] font-bold tracking-wider px-2.5 py-1 rounded-full">
                          BEST VALUE
                        </span>
                      )}
                      <p className="text-[11px] uppercase tracking-wider font-bold text-slate-500">{p.name}</p>
                      <p className="mt-3 flex items-baseline gap-1.5">
                        <span className="text-4xl font-bold tracking-tight text-slate-900">{money(p.price, p.currency, 0)}</span>
                        <span className="text-sm font-semibold text-slate-500">/ {p.hours} h</span>
                      </p>
                      <p className="text-xs text-slate-500 mt-1">{money(perHour(p), p.currency)} per hour</p>
                      <ul className="mt-5 space-y-2.5 text-sm text-slate-600">
                        {[`${p.hours} hours of streaming`, "No limit on session length", "Receivers always join free", "Hours add up when you top up"].map((t) => (
                          <li key={t} className="flex gap-2.5">
                            <Tick />
                            {t}
                          </li>
                        ))}
                      </ul>
                      <div className="mt-auto pt-6">
                        <button
                          onClick={() => choose(p)}
                          disabled={busy !== null}
                          className={`w-full h-11 rounded-xl text-xs font-bold uppercase tracking-widest active:scale-[0.99] transition-all disabled:opacity-60 flex items-center justify-center gap-2 ${
                            best ? "bg-blue-700 text-white hover:bg-blue-800" : "bg-[#0F1B2D] text-white hover:bg-[#1E3050]"
                          }`}
                        >
                          {busy === p.id ? (
                            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <>Pay {money(p.price, p.currency, 0)} with Revolut</>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="text-[11px] text-slate-400 text-center leading-relaxed">
                Payments are made on Revolut and confirmed by hand. You get a short reference to put in the payment note, and your hours are added once it is confirmed.
              </p>

              {history.length > 0 && (
                <div className="rounded-2xl border border-slate-200 overflow-hidden">
                  <p className="px-4 py-3 text-[11px] uppercase tracking-wider font-bold text-slate-500 bg-slate-50 border-b border-slate-100">Your payments</p>
                  <ul className="divide-y divide-slate-100">
                    {history.map((h) => (
                      <li key={h.reference} className="flex items-center justify-between gap-3 px-4 py-3 text-xs">
                        <span className="corp-mono font-semibold text-slate-800">{h.reference}</span>
                        <span className="text-slate-500 truncate">
                          {h.plan_id} · {money(Number(h.amount), h.currency)}
                        </span>
                        <span className={`shrink-0 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider ${STATUS_CHIP[h.status] || STATUS_CHIP.pending}`}>
                          {h.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}