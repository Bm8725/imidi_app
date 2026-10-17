// components/AirMidiPricing.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/* ---------------------------------------------------------------------- */
/* >>> REVOLUT LINK (or set NEXT_PUBLIC_REVOLUT_URL)                       */
/*     e.g.  https://revolut.me/yourtag                                    */
/* ---------------------------------------------------------------------- */
export const REVOLUT_URL =
  process.env.NEXT_PUBLIC_REVOLUT_URL || "https://revolut.me/mariusvalentin_b";

/**
 * How the amount is put in the Revolut link. If the amount does NOT arrive
 * pre-filled when you test the link on your phone, change this one value:
 *   "query-cents" -> https://revolut.me/tag?currency=EUR&amount=4900   (default)
 *   "query-units" -> https://revolut.me/tag?currency=EUR&amount=49
 *   "path"        -> https://revolut.me/tag/49
 */
export type RevolutAmountMode = "query-cents" | "query-units" | "path";
export const REVOLUT_AMOUNT_MODE: RevolutAmountMode = "query-cents";

export const getRevolutPaymentUrl = (
  baseUrl: string,
  amount: number,
  currency = "EUR",
  mode: RevolutAmountMode = REVOLUT_AMOUNT_MODE
) => {
  const base = baseUrl.replace(/\/+$/, ""); // avoid a double slash
  if (mode === "path") return `${base}/${amount}`;
  const value = mode === "query-cents" ? Math.round(amount * 100) : amount;
  return `${base}?currency=${encodeURIComponent(currency)}&amount=${value}`;
};

const SELLER_WHATSAPP = "40729411747";

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

const HISTORY_COLS = "reference,plan_id,amount,currency,status,created_at";

async function fetchHistory(): Promise<HistoryRow[] | null> {
  const { data, error } = await supabase
    .from("airmidi_payment_requests")
    .select(HISTORY_COLS)
    .order("created_at", { ascending: false })
    .limit(5);
  return !error && data ? (data as HistoryRow[]) : null;
}

function explain(msg?: string) {
  const m = msg || "";
  if (m.includes("TOO_MANY_PENDING")) return "You already have 3 payments waiting for confirmation. Wait until one is confirmed first.";
  if (m.includes("UNKNOWN_PLAN")) return "This plan is not available right now.";
  if (m.includes("NOT_AUTHENTICATED")) return "Please sign in again.";
  if (m.includes("airmidi_request_payment") || m.includes("schema cache")) return "Payments are not set up yet.";
  return "Could not start the payment. Please try again.";
}

/* ───────────────────────── small UI pieces ───────────────────────── */

const Tick = ({ light }: { light?: boolean }) => (
  <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${light ? "bg-white/15 text-white" : "bg-emerald-50 text-emerald-600"}`}>
    <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 13l4 4L19 7" />
    </svg>
  </span>
);

const Spinner = ({ dark }: { dark?: boolean }) => (
  <span className={`inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 ${dark ? "border-slate-300 border-t-slate-700" : "border-white/30 border-t-white"}`} />
);

function Stepper({ step }: { step: 1 | 2 | 3 }) {
  const items = ["Choose plan", "Pay & confirm", "Hours added"];
  return (
    <ol className="flex items-center gap-2 text-[11px] font-semibold">
      {items.map((label, i) => {
        const n = i + 1;
        const done = n < step;
        const active = n === step;
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold transition-colors ${
                done ? "bg-emerald-500 text-white" : active ? "bg-white text-[#0B1220]" : "bg-white/15 text-white/60"
              }`}
            >
              {done ? "✓" : n}
            </span>
            <span className={`hidden sm:inline ${active ? "text-white" : "text-white/55"}`}>{label}</span>
            {n < 3 && <span className="h-px w-4 bg-white/20 sm:w-8" />}
          </li>
        );
      })}
    </ol>
  );
}

/* ───────────────────────── component ───────────────────────── */

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
  const [copied, setCopied] = useState<"ref" | "amount" | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);

  // load plans + history whenever the modal opens
  useEffect(() => {
    if (!open) return;
    setError("");
    setReq(null);
    setCopied(null);
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
    fetchHistory().then((rows) => rows && setHistory(rows));
  }, [open]);

  // close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // while a payment is waiting for confirmation, check its status every 8s
  const hasPending = history.some((h) => h.status === "pending");
  useEffect(() => {
    if (!open || !hasPending) return;
    const id = setInterval(() => {
      fetchHistory().then((rows) => rows && setHistory(rows));
    }, 8000);
    return () => clearInterval(id);
  }, [open, hasPending]);

  if (!open) return null;

  const freeMin = Math.max(1, Math.round((account?.free_seconds ?? 300) / 60));
  const freePerDay = account?.free_per_day ?? 6;
  const onFree = hoursLeft !== null && hoursLeft <= 0;
  const perHour = (p: Plan) => p.price / p.hours;
  const sortedByValue = [...plans].sort((a, b) => perHour(a) - perHour(b));
  const bestId = plans.length > 1 ? sortedByValue[0].id : null;
  const worstPerHour = plans.length > 1 ? perHour(sortedByValue[sortedByValue.length - 1]) : null;

  const reqStatus = req ? history.find((h) => h.reference === req.reference)?.status ?? "pending" : null;
  const step: 1 | 2 | 3 = !req ? 1 : reqStatus === "approved" ? 3 : 2;

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
    fetchHistory().then((rows) => rows && setHistory(rows));
  };

  const copyText = (text: string, key: "ref" | "amount") => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(key);
        setTimeout(() => setCopied(null), 1600);
      })
      .catch((err) => console.error("Clipboard error:", err));
  };

  // opens WhatsApp with the payment details pre-written (and copies the reference too)
  const notifySeller = () => {
    if (!req) return;
    const message =
      `Hi! I have sent the payment via Revolut.\n\n` +
      `Plan: ${req.plan} (${req.hours} hours)\n` +
      `Amount: ${money(req.amount, req.currency)}\n` +
      `Reference: ${req.reference}`;
    window.open(`https://wa.me/${SELLER_WHATSAPP}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
    copyText(req.reference, "ref");
  };

  const payUrl = req ? getRevolutPaymentUrl(REVOLUT_URL, req.amount, req.currency) : REVOLUT_URL;

  return (
    <div
      className="am-fade-up fixed inset-0 z-[75] flex items-end justify-center bg-slate-950/60 backdrop-blur-md sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Get streaming hours"
      onClick={onClose}
    >
      <div
        className="am-scroll max-h-[94dvh] w-full overflow-y-auto rounded-t-[28px] bg-white shadow-[0_30px_80px_-20px_rgba(2,6,23,0.6)] sm:max-w-4xl sm:rounded-[28px]"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ───────── header ───────── */}
        <div className="sticky top-0 z-10 overflow-hidden rounded-t-[28px] bg-[#0B1220] px-5 py-5 sm:px-8 sm:py-6">
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-indigo-500/30 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -left-10 -bottom-24 h-48 w-48 rounded-full bg-cyan-400/20 blur-3xl" />

          <div className="relative flex items-start justify-between gap-4">
            <div className="min-w-0 space-y-3">
              <Stepper step={step} />
              <div>
                <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">Get streaming hours</h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-300">
                  Only the sender spends hours. Receivers always join for free.
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-start gap-3">
              {hoursLeft !== null && (
                <div className="hidden rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-right sm:block">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Balance</p>
                  <p className="mt-0.5 text-lg font-bold tabular-nums text-white">
                    {hoursLeft > 0 ? fmtHours(hoursLeft) : "Free plan"}
                  </p>
                </div>
              )}
              <button
                onClick={onClose}
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition-colors hover:bg-white/20"
              >
                ✕
              </button>
            </div>
          </div>

          {hoursLeft !== null && (
            <p className="relative mt-3 text-xs font-semibold text-white sm:hidden">
              {hoursLeft > 0 ? `You have ${fmtHours(hoursLeft)} left.` : "You are on the free plan."}
            </p>
          )}
        </div>

        <div className="space-y-6 p-5 sm:p-8">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-medium text-red-700">{error}</div>
          )}

          {req ? (
            /* ═════════════ STEP 2/3: pay on Revolut + confirm ═════════════ */
            <div className="am-fade-up mx-auto max-w-xl space-y-5">
              <button
                onClick={() => setReq(null)}
                className="py-1 text-xs font-semibold text-slate-500 transition-colors hover:text-slate-900"
              >
                ← Back to plans
              </button>

              {/* order summary */}
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0B1220] via-[#14213D] to-[#1E3A8A] p-6 text-center text-white shadow-lg">
                <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-cyan-400/20 blur-2xl" />
                <p className="relative text-[11px] font-bold uppercase tracking-widest text-slate-300">
                  {req.plan} plan · {req.hours} hours
                </p>
                <p className="relative mt-2 text-5xl font-extrabold tracking-tight tabular-nums">
                  {money(req.amount, req.currency)}
                </p>
                <p className="relative mt-1 text-xs text-slate-300">Pay on Revolut, then confirm below</p>
              </div>

              {step === 3 ? (
                /* approved */
                <div className="am-fade-up rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white">
                    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="mt-3 text-base font-bold text-emerald-800">Payment confirmed</p>
                  <p className="mt-1 text-sm text-emerald-700">{req.hours} hours were added to your account. Enjoy the jam 🎹</p>
                  <button
                    onClick={onClose}
                    className="mt-4 h-11 rounded-xl bg-emerald-600 px-6 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-emerald-500"
                  >
                    Start streaming
                  </button>
                </div>
              ) : (
                <>
                  {/* 1. pay */}
                  <section className="rounded-2xl border border-slate-200 p-4 sm:p-5">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0B1220] text-[11px] font-bold text-white">1</span>
                      <p className="text-sm font-bold text-slate-900">Pay on Revolut</p>
                    </div>
                    <a
                      href={payUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0075eb] text-sm font-bold text-white shadow-md shadow-blue-500/25 transition-all hover:-translate-y-0.5 hover:bg-[#0066cc] active:translate-y-0"
                    >
                      Pay {money(req.amount, req.currency)} with Revolut
                      <span aria-hidden>↗</span>
                    </a>
                    <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3.5 py-2.5">
                      <p className="text-[11px] leading-snug text-slate-500">
                        Amount is pre-filled. If you see an empty amount, enter{" "}
                        <span className="font-bold text-slate-800">{req.amount.toFixed(2)} {req.currency}</span>.
                      </p>
                      <button
                        onClick={() => copyText(req.amount.toFixed(2), "amount")}
                        className="shrink-0 rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 transition-colors hover:bg-slate-100"
                      >
                        {copied === "amount" ? "✓ Copied" : "Copy amount"}
                      </button>
                    </div>
                  </section>

                  {/* 2. reference */}
                  <section className="rounded-2xl border border-slate-200 p-4 sm:p-5">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0B1220] text-[11px] font-bold text-white">2</span>
                      <p className="text-sm font-bold text-slate-900">Put this reference in the payment note</p>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3">
                      <code className="text-lg font-mono font-bold tracking-wider text-slate-900">{req.reference}</code>
                      <button
                        onClick={() => copyText(req.reference, "ref")}
                        className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-slate-700"
                      >
                        {copied === "ref" ? "✓ Copied" : "Copy code"}
                      </button>
                    </div>
                  </section>

                  {/* 3. notify */}
                  <section className="rounded-2xl border border-slate-200 p-4 sm:p-5">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0B1220] text-[11px] font-bold text-white">3</span>
                      <p className="text-sm font-bold text-slate-900">Tell us you paid</p>
                    </div>
                    <button
                      onClick={notifySeller}
                      className="mt-4 flex h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-emerald-600 text-sm font-bold text-white shadow-md shadow-emerald-600/25 transition-all hover:-translate-y-0.5 hover:bg-emerald-500 active:translate-y-0"
                    >
                      <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24" aria-hidden>
                        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397 0 11.973 0c3.184.001 6.177 1.242 8.426 3.496 2.249 2.254 3.487 5.251 3.486 8.442-.005 6.623-5.34 11.971-11.918 11.971-2.007-.001-3.98-.51-5.725-1.479L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.742.002-2.602-1.01-5.05-2.85-6.89C16.586 2.13 14.143 1.128 11.98 1.128c-5.444 0-9.866 4.372-9.87 9.747-.002 1.702.459 3.361 1.336 4.81l-1.015 3.703 3.829-.989zm13.411-6.195c-.277-.139-1.64-.809-1.894-.9-.253-.093-.438-.139-.623.139-.184.279-.714.9-.874 1.084-.16.185-.32.208-.597.069-.277-.139-1.169-.43-2.227-1.374-.823-.734-1.379-1.641-1.54-1.92-.16-.279-.017-.43.122-.568.125-.124.277-.323.416-.483.139-.16.185-.274.277-.457.092-.183.046-.347-.023-.486-.069-.139-.623-1.501-.853-2.053-.224-.539-.452-.465-.623-.474-.16-.008-.345-.01-.53-.01-.185 0-.486.07-.741.347-.255.279-.972.951-.972 2.32 0 1.369.996 2.69 1.135 2.875.139.185 1.96 2.994 4.748 4.199.663.288 1.18.46 1.583.589.666.212 1.272.182 1.751.11.534-.08 1.64-.67 1.872-1.318.23-.647.23-1.203.16-1.318-.069-.115-.25-.185-.527-.324z" />
                      </svg>
                      Notify seller on WhatsApp
                    </button>
                    <p className="mt-3 flex items-center justify-center gap-2 text-center text-[11px] text-slate-500">
                      <Spinner dark />
                      Waiting for confirmation. This screen updates by itself once your payment is approved.
                    </p>
                  </section>
                </>
              )}
            </div>
          ) : (
            /* ═════════════ STEP 1: plans ═════════════ */
            <>
              <div className="grid grid-cols-1 gap-4 pt-3 sm:gap-5 md:grid-cols-3">
                {/* free */}
                <div className="relative flex flex-col rounded-3xl border border-slate-200 bg-slate-50/60 p-6">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Free</p>
                  <p className="mt-3 flex items-baseline gap-1.5">
                    <span className="text-4xl font-extrabold tracking-tight text-slate-900">{money(0, "EUR", 0)}</span>
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{freeMin}-minute sessions</p>
                  <ul className="mt-5 space-y-3 text-sm text-slate-600">
                    {[`Sessions end after ${freeMin} minutes`, `Up to ${freePerDay} free sessions per day`, "MIDI, video, voice, keyboard and controls"].map((t) => (
                      <li key={t} className="flex gap-2.5">
                        <Tick />
                        {t}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto pt-6">
                    <span className="block h-11 rounded-xl bg-slate-200/70 text-center text-xs font-bold leading-[2.75rem] text-slate-500">
                      {onFree ? "Your current plan" : "Always available"}
                    </span>
                  </div>
                </div>

                {/* paid */}
                {plans.map((p) => {
                  const best = p.id === bestId;
                  const saving =
                    best && worstPerHour ? Math.max(0, Math.round((1 - perHour(p) / worstPerHour) * 100)) : 0;
                  return (
                    <div
                      key={p.id}
                      className={`relative flex flex-col rounded-3xl p-6 transition-transform duration-200 hover:-translate-y-1 ${
                        best
                          ? "bg-gradient-to-br from-[#0B1220] via-[#14213D] to-[#1E3A8A] text-white shadow-[0_24px_50px_-20px_rgba(30,58,138,0.7)]"
                          : "border border-slate-200 bg-white"
                      }`}
                    >
                      {best && (
                        <span className="absolute -top-3 left-6 rounded-full bg-gradient-to-r from-amber-300 to-amber-400 px-3 py-1 text-[10px] font-extrabold tracking-wider text-amber-950 shadow">
                          BEST VALUE{saving > 0 ? ` · SAVE ${saving}%` : ""}
                        </span>
                      )}
                      <p className={`text-[11px] font-bold uppercase tracking-widest ${best ? "text-slate-300" : "text-slate-500"}`}>{p.name}</p>
                      <p className="mt-3 flex items-baseline gap-1.5">
                        <span className={`text-4xl font-extrabold tracking-tight ${best ? "text-white" : "text-slate-900"}`}>
                          {money(p.price, p.currency, 0)}
                        </span>
                        <span className={`text-sm font-semibold ${best ? "text-slate-300" : "text-slate-500"}`}>/ {p.hours} h</span>
                      </p>
                      <p className={`mt-1 text-xs ${best ? "text-slate-300" : "text-slate-500"}`}>{money(perHour(p), p.currency)} per hour</p>
                      <ul className={`mt-5 space-y-3 text-sm ${best ? "text-slate-100" : "text-slate-600"}`}>
                        {[`${p.hours} hours of streaming`, "No limit on session length", "Receivers always join free", "Hours add up when you top up"].map((t) => (
                          <li key={t} className="flex gap-2.5">
                            <Tick light={best} />
                            {t}
                          </li>
                        ))}
                      </ul>
                      <div className="mt-auto pt-6">
                        <button
                          onClick={() => choose(p)}
                          disabled={busy !== null}
                          className={`flex h-11 w-full items-center justify-center gap-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all active:scale-[0.99] disabled:opacity-60 ${
                            best ? "bg-white text-[#0B1220] hover:bg-slate-100" : "bg-[#0B1220] text-white hover:bg-[#1E3050]"
                          }`}
                        >
                          {busy === p.id ? <Spinner dark={best} /> : <>Pay {money(p.price, p.currency, 0)} with Revolut</>}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="mx-auto max-w-xl text-center text-[11px] leading-relaxed text-slate-400">
                Payments are made on Revolut and confirmed by hand. You get a short reference to put in the payment note, and your hours are added once it is confirmed.
              </p>

              {history.length > 0 && (
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <p className="border-b border-slate-100 bg-slate-50 px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-slate-500">
                    Your payments
                  </p>
                  <ul className="divide-y divide-slate-100">
                    {history.map((h) => (
                      <li key={h.reference} className="flex items-center justify-between gap-3 px-4 py-3 text-xs">
                        <span className="corp-mono font-semibold text-slate-800">{h.reference}</span>
                        <span className="truncate text-slate-500">
                          {h.plan_id} · {money(Number(h.amount), h.currency)}
                        </span>
                        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${STATUS_CHIP[h.status] || STATUS_CHIP.pending}`}>
                          {h.status === "pending" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />}
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