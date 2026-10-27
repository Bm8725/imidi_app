// app/admin/page.tsx  ·  superadmin console, wired to the real iMIDI / AirMIDI schema
'use client';

import { Children, cloneElement, isValidElement, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// BUSINESS CONSOLE: only users listed in airmidi_admins (owner / manager) get in.
// Every action runs through a database function that re-checks the caller, so the buttons can't be bypassed.

const T = {
  wallets: "airmidi_wallets", ledger: "airmidi_ledger", sessions: "airmidi_links", pays: "airmidi_payment_requests",
  plans: "airmidi_plans", settings: "airmidi_settings", links: "cloud_share_links", dl: "cloud_download_log",
  banks: "cloud_banks", users: "profiles", forum: "forum_posts", devices: "airmidi_iot_devices", rooms: "chat_rooms", audit: "airmidi_admin_log",
};
const KNOWN = ["airmidi_iot_devices", "airmidi_ledger", "airmidi_links", "airmidi_payment_requests", "airmidi_plans", "airmidi_settings", "airmidi_wallets", "chat_messages", "chat_rooms", "cloud_banks", "cloud_download_log", "cloud_share_links", "forum_posts", "profiles"];
const SENSITIVE = /(api_key|token|code_hash|password|secret)/i;
const ROLES = ["user", "seller", "admin", "superadmin"];

type Row = Record<string, any>;
type Res = { rows: Row[]; error: string };
type Mod = "overview" | "explorer" | "banks" | "devices" | "audit" | "invoices" | "users" | "sellers" | "revenue" | "sessions";
const NAV: { id: Mod; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "M3 13h8V3H3zm10 8h8V11h-8zM3 21h8v-6H3zm10-12h8V3h-8z" },
  { id: "explorer", label: "All data", icon: "M4 6h16M4 12h16M4 18h16" },
  { id: "users", label: "Users", icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" },
  { id: "sellers", label: "Sellers & links", icon: "M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" },
  { id: "revenue", label: "Revenue", icon: "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" },
  { id: "banks", label: "Banks & downloads", icon: "M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8" },
  { id: "devices", label: "Devices", icon: "M5 2h14v20H5zM12 18h.01" },
  { id: "sessions", label: "AirMIDI sessions", icon: "M22 12h-4l-3 9L9 3l-3 9H2" },
  { id: "invoices", label: "Invoices", icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5" },
  { id: "audit", label: "Audit log", icon: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" },
];

const money = (v: number, cur = "GBP") => {
  try { return new Intl.NumberFormat("en-GB", { style: "currency", currency: (cur || "GBP").trim() }).format(Number(v) || 0); }
  catch { return `${(Number(v) || 0).toFixed(2)} ${cur}`; }
};
const dt = (v?: string | null) => (v ? new Date(v).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "—");
const dur = (s: number) => (!s ? "—" : s >= 3600 ? `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}m` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`);
const hrs = (s: number) => (s / 3600).toFixed(1);
const day = (v: string) => v.slice(0, 10);

async function load(table: string, order: string | null, cols = "*"): Promise<Res> {
  let q = supabase.from(table).select(cols).limit(1000);
  if (order) q = q.order(order, { ascending: false });
  const { data, error } = await q;
  return { rows: ((data as unknown) as Row[]) ?? [], error: error?.message ?? "" };
}

const RCSS = `
@media (max-width:767px){
  .rtable,.rtable tbody{display:block;width:100%}
  .rtable thead{display:none}
  .rtable tr{display:block;margin:10px 12px;padding:6px 0;border:1px solid #E2E8F0;border-radius:12px;background:#fff}
  .rtable tbody{border:0!important}
  .rtable td{display:flex;justify-content:space-between;align-items:center;gap:14px;padding:6px 14px;max-width:none!important;white-space:normal!important;text-align:right!important}
  .rtable td::before{content:attr(data-l);flex:none;color:#64748B;font-size:11px;font-weight:600;text-align:left}
  .rtable td[data-l=""]::before{content:none}
  .rtable td[data-l=""]{justify-content:flex-end}
}`;

type Prefs = { theme: "system" | "light" | "dark"; accent: string; dense: boolean; size: number; title: string };
const DEF: Prefs = { theme: "system", accent: "blue", dense: false, size: 12, title: "iMIDI Console" };
const ACCENTS: Record<string, [string, string, string]> = {
  blue: ["#2563EB", "#1D4ED8", "#60A5FA"], teal: ["#0D9488", "#0F766E", "#2DD4BF"], violet: ["#7C3AED", "#6D28D9", "#A78BFA"],
  rose: ["#E11D48", "#BE123C", "#FB7185"], amber: ["#D97706", "#B45309", "#FBBF24"],
};

// the accent colour replaces the blue used across the page
const ACSS = String.raw`
.adm-root .bg-blue-600{background-color:var(--ac)}
.adm-root .hover\:bg-blue-700:hover{background-color:var(--ac2)}
.adm-root .text-blue-700{color:var(--ac2)}
.adm-root .border-blue-600{border-color:var(--ac)}
.adm-root .hover\:border-blue-400:hover,.adm-root .focus\:border-blue-500:focus{border-color:var(--ac)}
.adm-root .bg-blue-50{background-color:color-mix(in srgb,var(--ac) 10%,transparent)}
.adm-root .border-blue-200{border-color:color-mix(in srgb,var(--ac) 35%,transparent)}
.adm-root .from-blue-600,.adm-root .from-blue-500{--tw-gradient-from:var(--ac);--tw-gradient-to:transparent;--tw-gradient-stops:var(--tw-gradient-from),var(--tw-gradient-to)}
.adm-root .from-blue-700{--tw-gradient-from:var(--ac2);--tw-gradient-to:transparent;--tw-gradient-stops:var(--tw-gradient-from),var(--tw-gradient-to)}
.adm-root .to-blue-800,.adm-root .to-blue-700{--tw-gradient-to:var(--ac2)}
.adm-root .to-blue-400{--tw-gradient-to:var(--ac)}
.adm-root .accent-blue-600{accent-color:var(--ac)}
@media (min-width:768px){.adm-compact .rtable td{padding-top:5px;padding-bottom:5px}.adm-compact .rtable th{padding-top:7px;padding-bottom:7px}}
`;

const ADARK = String.raw`
.adm-dark.adm-root{background-color:#0B1220;color:#E6EDF7;color-scheme:dark}
.adm-dark .bg-white{background-color:#111A2B}
.adm-dark .bg-white\/95{background-color:rgba(11,18,32,.92)}
.adm-dark .bg-\[\#F4F6FA\],.adm-dark .bg-\[\#E9EDF3\]{background-color:#0B1220}
.adm-dark .bg-slate-50{background-color:#0E1626}
.adm-dark .bg-slate-100{background-color:#1A2740}
.adm-dark .hover\:bg-slate-50\/70:hover{background-color:rgba(26,39,64,.7)}
.adm-dark .bg-amber-50{background-color:rgba(245,158,11,.13)}
.adm-dark .bg-emerald-50{background-color:rgba(16,185,129,.13)}
.adm-dark .bg-red-50{background-color:rgba(239,68,68,.13)}
.adm-dark .hover\:bg-red-50:hover{background-color:rgba(239,68,68,.14)}
.adm-dark .hover\:bg-emerald-50:hover{background-color:rgba(16,185,129,.14)}
.adm-dark .border-slate-100{border-color:#1B2840}
.adm-dark .border-slate-200{border-color:#22304A}
.adm-dark .border-amber-200{border-color:rgba(245,158,11,.38)}
.adm-dark .border-red-200,.adm-dark .border-red-300{border-color:rgba(239,68,68,.4)}
.adm-dark .border-emerald-300{border-color:rgba(16,185,129,.4)}
.adm-dark .divide-slate-100 > :not([hidden]) ~ :not([hidden]){border-color:#1B2840}
.adm-dark .text-slate-900{color:#E6EDF7}
.adm-dark .text-slate-800{color:#D5DEEC}
.adm-dark .text-slate-700{color:#BFCCE0}
.adm-dark .text-slate-600{color:#A9B8CF}
.adm-dark .text-slate-500{color:#8EA0BC}
.adm-dark .text-slate-400{color:#7387A6}
.adm-dark .hover\:text-slate-800:hover{color:#D5DEEC}
.adm-dark .text-blue-700{color:var(--ac3)}
.adm-dark .text-emerald-700{color:#6EE7B7}
.adm-dark .text-amber-600,.adm-dark .text-amber-800{color:#FCD34D}
.adm-dark .text-red-600,.adm-dark .text-red-700{color:#FCA5A5}
.adm-dark select,.adm-dark input:not([type=checkbox]){background-color:#0E1626;color:#E6EDF7;border-color:#22304A}
.adm-dark .rtable tr{background:#111A2B;border-color:#22304A}
.adm-dark .shadow-xl{box-shadow:0 20px 40px -12px rgba(0,0,0,.6)}
`;

const Ico = ({ d }: { d: string }) => (
  <svg className="h-[18px] w-[18px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);
function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3.5" style={{ borderTop: `3px solid ${tone}` }}>
      <p className="text-[11px] font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 truncate text-[11px] text-slate-400">{sub}</p>}
    </div>
  );
}
function Card({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-bold text-slate-800">{title}</h2>{right}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}
const TH = "px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 whitespace-nowrap";
const TD = "px-4 py-2.5 text-[13px] text-slate-700 whitespace-nowrap";
function Pill({ t, tone }: { t: string; tone: "ok" | "warn" | "bad" | "mute" }) {
  const c = { ok: "bg-emerald-50 text-emerald-700", warn: "bg-amber-50 text-amber-700", bad: "bg-red-50 text-red-700", mute: "bg-slate-100 text-slate-600" }[tone];
  return <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${c}`}>{t}</span>;
}
const Search = ({ v, on }: { v: string; on: (s: string) => void }) => (
  <input value={v} onChange={(e) => on(e.target.value)} placeholder="Search…" className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-[13px] outline-none focus:border-blue-500 sm:w-64" />
);
const Empty = ({ err, table }: { err: string; table: string }) => (
  <p className="px-4 py-8 text-center text-[13px] text-slate-400">
    {err ? <>Could not read <span className="font-mono">{table}</span>: {err}</> : "Nothing visible here. If you expect data, your account may not have read access (RLS) on this table."}
  </p>
);
function Tbl({ head, pager, children }: { head: React.ReactNode; pager?: React.ReactNode; children: React.ReactNode }) {
  const labels = Children.toArray((head as any)?.props?.children).map((h: any) => (isValidElement(h) ? String((h.props as any).children ?? "") : ""));
  const rows = Children.toArray(children).map((r: any) =>
    isValidElement(r)
      ? cloneElement(r as any, {}, Children.toArray((r.props as any).children).map((td: any, i: number) => (isValidElement(td) ? cloneElement(td as any, { "data-l": labels[i] ?? "" }) : td)))
      : r
  );
  return (
    <>
      <table className="rtable w-full"><thead className="bg-slate-50"><tr>{head}</tr></thead><tbody className="divide-y divide-slate-100">{rows}</tbody></table>
      {pager}
    </>
  );
}

/* ───────────────────────── invoices ───────────────────────── */
type Line = { desc: string; qty: number; price: number; vat: number };
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const esc = (v: any) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
const invNo = (i: Row) => `${i.series}-${String(i.number).padStart(5, "0")}`;
const SELLER0: Row = {
  name: "", cui: "", reg: "", address: "", city: "", county: "", country: "RO", iban: "", bank: "", email: "", phone: "", vat_payer: true, series: "IMD",
  footer: "Factura circulă fără semnătură și ștampilă conform art. 319 alin. (29) din Legea nr. 227/2015 privind Codul fiscal.",
};
const EF: Record<string, [string, "ok" | "warn" | "bad" | "mute"]> = {
  not_sent: ["Not sent", "mute"], uploaded: ["Uploaded", "warn"], accepted: ["Accepted", "ok"], rejected: ["Rejected", "bad"], error: ["Error", "bad"],
};

function calc(lines: Line[], gross: boolean) {
  const rows = lines.map((l) => {
    const unit = gross ? Math.round((l.price / (1 + l.vat / 100)) * 1e4) / 1e4 : l.price;
    const net = r2(l.qty * unit);
    return { ...l, unit, net, vatAmt: r2((net * l.vat) / 100) };
  });
  const sub = r2(rows.reduce((a, x) => a + x.net, 0));
  const vat = r2(rows.reduce((a, x) => a + x.vatAmt, 0));
  return { rows, sub, vat, total: r2(sub + vat) };
}

function printInvoice(v: { no: string; issue: string; due?: string | null; currency: string; seller: Row; customer: Row; lines: { desc: string; qty: number; unit: number; vat: number; net: number; vatAmt: number }[]; sub: number; vat: number; total: number; notes?: string }) {
  const w = window.open("", "_blank");
  if (!w) return;
  const m = (n: number) => money(n, v.currency);
  const groups: Record<string, { net: number; vat: number }> = {};
  v.lines.forEach((l) => { const g = (groups[l.vat] ??= { net: 0, vat: 0 }); g.net += l.net; g.vat += l.vatAmt; });
  const S = v.seller, C = v.customer;
  const party = (x: Row, mine: boolean) =>
    `<b>${esc(x.name) || "—"}</b><br>${x.cui ? `CUI/CIF: ${esc(x.cui)}${mine && S.vat_payer === false ? " (neplătitor TVA)" : ""}<br>` : ""}${x.reg ? `Reg. Com.: ${esc(x.reg)}<br>` : ""}${esc(x.address)}${x.city ? `, ${esc(x.city)}` : ""}${x.county ? `, ${esc(x.county)}` : ""}${x.country ? `, ${esc(x.country)}` : ""}<br>${x.email ? esc(x.email) : ""}${mine && S.iban ? `<br>IBAN: ${esc(S.iban)}${S.bank ? ` · ${esc(S.bank)}` : ""}` : ""}`;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Factura ${esc(v.no)}</title><style>
  *{box-sizing:border-box}body{font:13px/1.45 Arial,Helvetica,sans-serif;color:#0F172A;margin:0;padding:36px}
  h1{font-size:26px;margin:0;letter-spacing:-.02em}.top{display:flex;justify-content:space-between;gap:24px;border-bottom:3px solid #2563EB;padding-bottom:16px}
  .meta{text-align:right}.meta b{font-size:15px}.cols{display:flex;gap:32px;margin:22px 0}.cols>div{flex:1}.lbl{font-size:10px;color:#64748B;font-weight:700;margin-bottom:4px}
  table{width:100%;border-collapse:collapse;margin-top:6px}th{background:#F1F5F9;text-align:left;font-size:11px;padding:8px}td{padding:8px;border-bottom:1px solid #E2E8F0;vertical-align:top}
  .r{text-align:right}.tot{margin-left:auto;width:320px;margin-top:16px}.tot div{display:flex;justify-content:space-between;padding:4px 0}.tot .g{font-size:16px;font-weight:700;border-top:2px solid #0F172A;margin-top:6px;padding-top:8px}
  .foot{margin-top:34px;color:#64748B;font-size:11px;border-top:1px solid #E2E8F0;padding-top:10px}@media print{body{padding:14mm}}</style></head><body>
  <div class="top"><div><h1>FACTURĂ</h1><div style="color:#64748B">Invoice</div></div><div class="meta"><b>${esc(v.no)}</b><br>Data emiterii: ${esc(v.issue)}${v.due ? `<br>Scadență: ${esc(v.due)}` : ""}<br>Moneda: ${esc(v.currency)}</div></div>
  <div class="cols"><div><div class="lbl">FURNIZOR</div>${party(S, true)}</div><div><div class="lbl">CLIENT</div>${party(C, false)}</div></div>
  <table><thead><tr><th>#</th><th>Denumire</th><th class="r">Cant.</th><th class="r">Preț unitar</th><th class="r">Valoare</th><th class="r">TVA %</th><th class="r">TVA</th></tr></thead><tbody>
  ${v.lines.map((l, i) => `<tr><td>${i + 1}</td><td>${esc(l.desc)}</td><td class="r">${l.qty}</td><td class="r">${m(l.unit)}</td><td class="r">${m(l.net)}</td><td class="r">${l.vat}%</td><td class="r">${m(l.vatAmt)}</td></tr>`).join("")}
  </tbody></table>
  <div class="tot"><div><span>Total fără TVA</span><span>${m(v.sub)}</span></div>
  ${Object.entries(groups).map(([r, g]) => `<div><span>TVA ${r}% (baza ${m(g.net)})</span><span>${m(g.vat)}</span></div>`).join("")}
  <div class="g"><span>Total de plată</span><span>${m(v.total)}</span></div></div>
  ${v.notes ? `<p style="margin-top:20px"><b>Mențiuni:</b> ${esc(v.notes)}</p>` : ""}
  <div class="foot">${esc(S.footer)}</div></body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 300);
}

function InvoicesModule({ rows, settingsRow, users, who, cur, size, setup, owner, busy, draft, clearDraft, act, refresh, say }: {
  rows: Row[]; settingsRow?: Row; users: Row[]; who: Record<string, string>; cur: string; size: number; setup: boolean; owner: boolean; busy: boolean;
  draft: Row | null; clearDraft: () => void;
  act: (msg: string, fn: string, args: Record<string, any>, ok: string) => Promise<any>; refresh: () => Promise<void>; say: (m: string) => void;
}) {
  const [seller, setSeller] = useState<Row>(SELLER0);
  const [showCo, setShowCo] = useState(false);
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState(false);
  const blank = { type: "company", name: "", cui: "", reg: "", address: "", city: "", county: "", country: "RO", email: "" };
  const [cust, setCust] = useState<Row>(blank);
  const [lines, setLines] = useState<Line[]>([{ desc: "", qty: 1, price: 0, vat: 21 }]);
  const [gross, setGross] = useState(false);
  const [currency, setCurrency] = useState(cur);
  const [issue, setIssue] = useState(new Date().toISOString().slice(0, 10));
  const [due, setDue] = useState("");
  const [notes, setNotes] = useState("");
  const [uid, setUid] = useState("");
  const [payId, setPayId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try { const v = JSON.parse(localStorage.getItem("adm-seller") || "null"); if (v) setSeller({ ...SELLER0, ...v }); } catch {}
  }, []);
  useEffect(() => { if (settingsRow && settingsRow.name != null) setSeller((x) => ({ ...x, ...Object.fromEntries(Object.entries(settingsRow).filter(([, v]) => v !== null)) })); }, [settingsRow]);

  const pickUser = (id: string) => {
    setUid(id);
    if (id) setCust((c) => ({ ...c, name: c.name || who[id] || "", email: who[id] || c.email }));
  };
  useEffect(() => {
    if (!draft) return;
    setCust(blank); setUid(""); setDue(""); setNotes("");
    setLines([draft.line ?? { desc: "", qty: 1, price: 0, vat: 21 }]);
    setGross(!!draft.gross); setCurrency((draft.currency || cur).trim()); setPayId(draft.payment || "");
    if (draft.user_id) { setUid(draft.user_id); setCust({ ...blank, name: who[draft.user_id] || "", email: who[draft.user_id] || "" }); }
    setOpen(true);
    clearDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const t = calc(lines, gross);
  const setLine = (i: number, p: Partial<Line>) => setLines((ls) => ls.map((l, k) => (k === i ? { ...l, ...p } : l)));
  const saveSeller = async () => {
    try { localStorage.setItem("adm-seller", JSON.stringify(seller)); } catch {}
    if (setup) return say("Saved on this device. Install invoices.sql to store it in the database.");
    const { error } = await supabase.rpc("admin_save_invoice_settings", { p: seller });
    say(error ? error.message : "Company details saved.");
    if (!error) refresh();
  };
  const previewDraft = () => printInvoice({ no: "PROFORMĂ / PREVIEW", issue, due, currency, seller, customer: cust, lines: t.rows.map((l) => ({ desc: l.desc, qty: l.qty, unit: l.unit, vat: l.vat, net: l.net, vatAmt: l.vatAmt })), sub: t.sub, vat: t.vat, total: t.total, notes });
  const issueNow = async () => {
    if (setup) return say("Issuing is off until invoices.sql is installed. You can still preview and print.");
    if (!cust.name.trim()) return say("Customer name is required.");
    if (t.rows.some((l) => !l.desc.trim() || !l.qty)) return say("Every line needs a description and a quantity.");
    if (!seller.name?.trim() || !seller.cui?.trim()) return say("Fill in your company details first (name and CUI).");
    if (!window.confirm(`Issue this invoice for ${money(t.total, currency)}? Numbers cannot be reused or edited afterwards (use storno).`)) return;
    setSaving(true);
    const { data, error } = await supabase.rpc("admin_create_invoice", {
      p_customer: cust, p_lines: t.rows.map((l) => ({ desc: l.desc, qty: l.qty, unit_price: l.unit, vat_rate: l.vat })),
      p_currency: currency, p_issue: issue || null, p_due: due || null, p_notes: notes || null, p_user: uid || null, p_payment: payId || null,
    });
    setSaving(false);
    if (error) return say(error.message);
    say(`Invoice ${(data as any)?.series}-${String((data as any)?.number).padStart(5, "0")} issued.`);
    setOpen(false); setPayId("");
    await refresh();
  };
  const printSaved = (i: Row) =>
    printInvoice({
      no: invNo(i), issue: i.issue_date, due: i.due_date, currency: i.currency, seller, customer: i.customer || {},
      lines: (i.lines || []).map((l: Row) => ({ desc: l.desc, qty: l.qty, unit: l.unit_price, vat: l.vat_rate, net: l.net, vatAmt: l.vat })),
      sub: i.subtotal, vat: i.vat_total, total: i.total, notes: i.notes,
    });

  const month = new Date().toISOString().slice(0, 7);
  const monthRows = rows.filter((r) => String(r.issue_date).startsWith(month) && r.status === "issued");
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const cur0 = Math.min(page, pages - 1);
  const slice = rows.slice(cur0 * size, cur0 * size + size);
  const inp = "mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] outline-none focus:border-blue-500";
  const F = ({ l, k, ph }: { l: string; k: string; ph?: string }) => (
    <label className="block text-[11px] font-semibold text-slate-500">{l}<input value={cust[k] ?? ""} placeholder={ph} onChange={(e) => setCust((c) => ({ ...c, [k]: e.target.value }))} className={inp} /></label>
  );
  const SF = ({ l, k, ph }: { l: string; k: string; ph?: string }) => (
    <label className="block text-[11px] font-semibold text-slate-500">{l}<input value={seller[k] ?? ""} placeholder={ph} onChange={(e) => setSeller((c) => ({ ...c, [k]: e.target.value }))} className={inp} /></label>
  );

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Invoices" value={String(rows.length)} sub={`${monthRows.length} this month`} tone="#2563EB" />
        <Kpi label="Invoiced this month" value={money(monthRows.reduce((a, r) => a + Number(r.total), 0), cur)} tone="#0D9488" />
        <Kpi label="VAT this month" value={money(monthRows.reduce((a, r) => a + Number(r.vat_total), 0), cur)} tone="#F59E0B" />
        <Kpi label="Not sent to e-Factura" value={String(rows.filter((r) => r.efactura_status === "not_sent" && r.status === "issued").length)} sub="SPV not connected yet" tone="#64748B" />
      </div>

      <Card title="Company details on invoices" right={<button onClick={() => setShowCo((v) => !v)} className="text-xs font-semibold text-blue-700 hover:underline">{showCo ? "Hide" : seller.name ? "Edit" : "Fill in"}</button>}>
        {showCo ? (
          <div className="space-y-3 p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <SF l="Company name" k="name" /><SF l="CUI / CIF" k="cui" ph="RO12345678" /><SF l="Reg. Com." k="reg" ph="J00/000/2020" />
              <SF l="Address" k="address" /><SF l="City" k="city" /><SF l="County code" k="county" ph="RO-B, RO-DB…" />
              <SF l="IBAN" k="iban" /><SF l="Bank" k="bank" /><SF l="Email" k="email" />
              <SF l="Phone" k="phone" /><SF l="Country" k="country" />
              <label className="flex items-center gap-2 pt-5 text-[13px] font-semibold text-slate-700"><input type="checkbox" checked={seller.vat_payer !== false} onChange={(e) => setSeller((c) => ({ ...c, vat_payer: e.target.checked }))} className="h-4 w-4 accent-blue-600" /> VAT payer</label>
            </div>
            <label className="block text-[11px] font-semibold text-slate-500">Footer text<textarea value={seller.footer ?? ""} onChange={(e) => setSeller((c) => ({ ...c, footer: e.target.value }))} rows={2} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] outline-none focus:border-blue-500" /></label>
            <p className="text-[11px] text-slate-400">Series: <b>{seller.series}</b> · next number is assigned by the system, in order, without gaps. {owner || setup ? "" : "Only the owner can save these details."}</p>
            <button onClick={saveSeller} disabled={!owner && !setup} className="h-9 rounded-lg bg-blue-600 px-4 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-40">Save company details</button>
          </div>
        ) : (
          <p className="px-4 py-3 text-[13px] text-slate-500">{seller.name ? <><b className="text-slate-800">{seller.name}</b> · CUI {seller.cui || "—"} · series {seller.series}</> : "Add your company name and CUI so they appear on every invoice."}</p>
        )}
      </Card>

      <Card title={`Invoices (${rows.length})`} right={<button onClick={() => { setCust(blank); setUid(""); setLines([{ desc: "", qty: 1, price: 0, vat: 21 }]); setGross(false); setPayId(""); setOpen(true); }} className="h-9 rounded-lg bg-blue-600 px-4 text-xs font-bold text-white hover:bg-blue-700">+ New invoice</button>}>
        {rows.length === 0 ? <p className="px-4 py-8 text-center text-[13px] text-slate-400">No invoices yet. Issue the first one with “New invoice”, or press “Invoice” on a paid request in Revenue.</p> : (
          <Tbl head={<><th className={TH}>Number</th><th className={TH}>Date</th><th className={TH}>Customer</th><th className={TH}>Total</th><th className={TH}>Status</th><th className={TH}>e-Factura</th><th className={TH} /></>}
            pager={rows.length > size ? (
              <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
                <span>{cur0 * size + 1}–{Math.min(rows.length, cur0 * size + size)} of {rows.length}</span>
                <span className="flex items-center gap-2">
                  <button onClick={() => setPage(cur0 - 1)} disabled={cur0 === 0} className="h-8 rounded-md border border-slate-200 px-3 font-semibold disabled:opacity-40">Prev</button>
                  <button onClick={() => setPage(cur0 + 1)} disabled={cur0 >= pages - 1} className="h-8 rounded-md border border-slate-200 px-3 font-semibold disabled:opacity-40">Next</button>
                </span>
              </div>
            ) : null}>
            {slice.map((i) => (
              <tr key={i.id}>
                <td className={`${TD} font-mono text-xs font-semibold text-slate-900`}>{invNo(i)}{i.storno_of && <span className="ml-1 text-red-600">storno</span>}</td>
                <td className={TD}>{i.issue_date}</td>
                <td className={`${TD} max-w-[16rem] truncate`}>{i.customer?.name || "—"}</td>
                <td className={`${TD} tabular-nums ${Number(i.total) < 0 ? "text-red-600" : ""}`}>{money(i.total, i.currency)}</td>
                <td className={TD}>{i.status === "cancelled" ? <Pill t="Cancelled" tone="bad" /> : <Pill t="Issued" tone="ok" />}</td>
                <td className={TD}><Pill t={(EF[i.efactura_status] ?? EF.not_sent)[0]} tone={(EF[i.efactura_status] ?? EF.not_sent)[1]} /></td>
                <td className={`${TD} text-right`}>
                  <span className="inline-flex gap-2">
                    <button onClick={() => printSaved(i)} className="h-8 rounded-md border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:border-blue-400">Print / PDF</button>
                    <button disabled title="Available after the ANAF SPV connection is added" className="h-8 cursor-not-allowed rounded-md border border-slate-200 px-3 text-xs font-bold text-slate-300">Send to SPV</button>
                    {i.status === "issued" && !i.storno_of && <button onClick={() => act(`Cancel invoice ${invNo(i)}? A storno invoice with negative values is issued.`, "admin_cancel_invoice", { p_id: i.id }, "Storno issued.")} disabled={busy} className="h-8 rounded-md border border-red-200 px-3 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50">Storno</button>}
                  </span>
                </td>
              </tr>
            ))}
          </Tbl>
        )}
      </Card>
      <p className="text-[11px] text-slate-400">Invoices are stored with every field RO e-Factura needs (CUI, address, county code, VAT per line), so the ANAF SPV upload can be added without changing them. Check VAT treatment and legal wording with your accountant.</p>

      {open && (
        <>
          <div className="fixed inset-0 z-[55] bg-black/50" onClick={() => setOpen(false)} />
          <section className="fixed inset-y-0 right-0 z-[60] flex w-full max-w-3xl flex-col bg-[#F4F6FA] shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6" style={{ borderTop: "3px solid var(--ac)" }}>
              <h2 className="text-base font-bold text-slate-900">New invoice</h2>
              <button onClick={() => setOpen(false)} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">✕</button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
              <Card title="Customer">
                <div className="space-y-3 p-4">
                  <label className="block text-[11px] font-semibold text-slate-500">Link to an account (optional)
                    <select value={uid} onChange={(e) => pickUser(e.target.value)} className={inp}>
                      <option value="">— none —</option>
                      {users.map((u) => <option key={u.id} value={u.id}>{who[u.id] || u.id.slice(0, 8)}</option>)}
                    </select>
                  </label>
                  <div className="flex gap-2">
                    {["company", "person"].map((k) => <button key={k} onClick={() => setCust((c) => ({ ...c, type: k }))} className={`h-8 rounded-full border px-4 text-xs font-semibold ${cust.type === k ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600"}`}>{k === "company" ? "Company" : "Individual"}</button>)}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <F l={cust.type === "company" ? "Company name" : "Full name"} k="name" />
                    {cust.type === "company" && <F l="CUI / VAT ID" k="cui" />}
                    {cust.type === "company" && <F l="Reg. Com." k="reg" />}
                    <F l="Email" k="email" /><F l="Address" k="address" /><F l="City" k="city" /><F l="County code" k="county" ph="RO-B, RO-DB…" /><F l="Country" k="country" />
                  </div>
                </div>
              </Card>
              <Card title="Lines" right={<label className="flex items-center gap-2 text-xs font-semibold text-slate-600"><input type="checkbox" checked={gross} onChange={(e) => setGross(e.target.checked)} className="h-4 w-4 accent-blue-600" /> Prices include VAT</label>}>
                <div className="space-y-3 p-4">
                  {lines.map((l, i) => (
                    <div key={i} className="grid grid-cols-12 items-end gap-2 rounded-lg border border-slate-200 bg-white p-3">
                      <label className="col-span-12 text-[11px] font-semibold text-slate-500 sm:col-span-5">Description<input value={l.desc} onChange={(e) => setLine(i, { desc: e.target.value })} className={inp} /></label>
                      <label className="col-span-3 text-[11px] font-semibold text-slate-500 sm:col-span-2">Qty<input type="number" step="any" value={l.qty} onChange={(e) => setLine(i, { qty: Number(e.target.value) })} className={inp} /></label>
                      <label className="col-span-5 text-[11px] font-semibold text-slate-500 sm:col-span-2">Price<input type="number" step="any" value={l.price} onChange={(e) => setLine(i, { price: Number(e.target.value) })} className={inp} /></label>
                      <label className="col-span-4 text-[11px] font-semibold text-slate-500 sm:col-span-2">VAT
                        <select value={l.vat} onChange={(e) => setLine(i, { vat: Number(e.target.value) })} className={inp}><option value={21}>21%</option><option value={11}>11%</option><option value={0}>0%</option></select>
                      </label>
                      <button onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((_, k) => k !== i) : ls))} aria-label="Remove line" className="col-span-12 h-9 rounded-lg border border-slate-200 text-xs font-bold text-slate-500 hover:text-red-600 sm:col-span-1">✕</button>
                    </div>
                  ))}
                  <button onClick={() => setLines((ls) => [...ls, { desc: "", qty: 1, price: 0, vat: 21 }])} className="text-xs font-semibold text-blue-700 hover:underline">+ Add line</button>
                </div>
              </Card>
              <Card title="Details">
                <div className="grid gap-3 p-4 sm:grid-cols-3">
                  <label className="block text-[11px] font-semibold text-slate-500">Issue date<input type="date" value={issue} onChange={(e) => setIssue(e.target.value)} className={inp} /></label>
                  <label className="block text-[11px] font-semibold text-slate-500">Due date<input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={inp} /></label>
                  <label className="block text-[11px] font-semibold text-slate-500">Currency<select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inp}>{Array.from(new Set([cur, "RON", "EUR", "GBP", "USD"])).map((c) => <option key={c}>{c}</option>)}</select></label>
                  <label className="block text-[11px] font-semibold text-slate-500 sm:col-span-3">Notes<input value={notes} onChange={(e) => setNotes(e.target.value)} className={inp} /></label>
                </div>
              </Card>
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-[13px]">
                <div className="flex justify-between py-1"><span className="text-slate-500">Subtotal</span><b className="tabular-nums">{money(t.sub, currency)}</b></div>
                <div className="flex justify-between py-1"><span className="text-slate-500">VAT</span><b className="tabular-nums">{money(t.vat, currency)}</b></div>
                <div className="mt-1 flex justify-between border-t border-slate-200 pt-2 text-base"><span className="font-bold">Total</span><b className="tabular-nums">{money(t.total, currency)}</b></div>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
              <button onClick={previewDraft} className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 hover:border-blue-400">Preview / Print</button>
              <button onClick={issueNow} disabled={saving} className="h-10 rounded-lg bg-blue-600 px-5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50">{saving ? "Issuing…" : "Issue invoice"}</button>
            </div>
          </section>
        </>
      )}
    </>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [gate, setGate] = useState<"checking" | "ok" | "denied">("checking");
  const [meId, setMeId] = useState("");
  const [myRole, setMyRole] = useState("");
  const [setup, setSetup] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [acct, setAcct] = useState<string | null>(null);
  const [atab, setAtab] = useState("summary");
  const [ufilter, setUfilter] = useState("all");
  const [sel, setSel] = useState<string[]>([]);
  const [myEmail, setMyEmail] = useState("");
  const [prefs, setPrefs] = useState<Prefs>(DEF);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [sysDark, setSysDark] = useState(false);
  const [invDraft, setInvDraft] = useState<Row | null>(null);
  const [updated, setUpdated] = useState<Date | null>(null);
  const [gateMsg, setGateMsg] = useState("");
  const [mod, setMod] = useState<Mod>("overview");
  const [q, setQ] = useState("");
  const [exTable, setExTable] = useState("airmidi_ledger");
  const [exCustom, setExCustom] = useState("");
  const [ex, setEx] = useState<Res>({ rows: [], error: "" });
  const [counts, setCounts] = useState<Record<string, number | null>>({});
  const [pg, setPg] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [d, setD] = useState<Record<string, Res>>({});

  const refresh = useCallback(async () => {
    setBusy(true);
    const keys = ["wallets", "ledger", "sessions", "pays", "plans", "settings", "links", "dl", "banks", "users", "forum", "devices", "rooms", "auth", "audit", "inv", "invset"] as const;
    const res = await Promise.all([
      load(T.wallets, "updated_at"), load(T.ledger, "created_at"), load(T.sessions, "created_at"), load(T.pays, "created_at"),
      load(T.plans, "sort_order"), load(T.settings, null), load(T.links, "created_at"), load(T.dl, "downloaded_at"),
      load(T.banks, "created_at"), load(T.users, null), load(T.forum, null), load(T.devices, "created_at"), load(T.rooms, "created_at"),
      (async () => {
        const { data, error } = await supabase.rpc("admin_list_users");
        return { rows: ((data as Row[]) ?? []), error: error?.message ?? "" } as Res;
      })(),
      load(T.audit, "created_at"),
      load("airmidi_invoices", "created_at"),
      load("airmidi_invoice_settings", null),
    ]);
    setD(Object.fromEntries(keys.map((k, i) => [k, res[i]])));
    setUpdated(new Date());
    setBusy(false);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.replace("/login?next=/admin");
      const { data: role, error: rerr } = await supabase.rpc("airmidi_my_role");
      const missing = !!rerr && /could not find|does not exist|schema cache/i.test(rerr.message);
      if (missing) {
        setSetup(true);
        setMyRole("viewer");
      } else if (rerr || !role) {
        setGateMsg(rerr?.message ?? "");
        return setGate("denied");
      } else setMyRole(String(role));
      setMeId(user.id);
      setMyEmail(user.email ?? "");
      setGate("ok");
      refresh();
    })();
  }, [router, refresh]);

  useEffect(() => {
    if (gate !== "ok" || mod !== "explorer") return;
    let on = true;
    setEx({ rows: [], error: "" });
    load(exTable, null).then((r) => on && setEx(r));
    return () => { on = false; };
  }, [gate, mod, exTable]);

  useEffect(() => {
    if (gate !== "ok" || mod !== "explorer") return;
    let on = true;
    Promise.all(
      KNOWN.map(async (t) => {
        const { count, error } = await supabase.from(t).select("*", { count: "exact", head: true });
        return [t, error ? null : count ?? 0] as const;
      })
    ).then((r) => on && setCounts(Object.fromEntries(r)));
    return () => { on = false; };
  }, [gate, mod]);

  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem("adm-prefs") || "null");
      if (v) setPrefs({ ...DEF, ...v });
    } catch {}
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    setSysDark(!!mq?.matches);
    const h = (e: MediaQueryListEvent) => setSysDark(e.matches);
    mq?.addEventListener?.("change", h);
    return () => mq?.removeEventListener?.("change", h);
  }, []);
  const setPref = (p: Partial<Prefs>) =>
    setPrefs((st) => {
      const n = { ...st, ...p };
      try { localStorage.setItem("adm-prefs", JSON.stringify(n)); } catch {}
      return n;
    });

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && (setNavOpen(false), setAcct(null), setPrefsOpen(false));
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const say = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2500); };
  const g = (k: string) => d[k]?.rows ?? [];
  const err = (k: string) => d[k]?.error ?? "";
  const wallets = g("wallets"), ledger = g("ledger"), sessions = g("sessions"), pays = g("pays");
  const links = g("links"), dl = g("dl"), banks = g("banks"), profiles = g("users"), plans = g("plans");
  const settings = g("settings")[0];

  const who = useMemo(() => {
    const m: Record<string, string> = {};
    g("auth").forEach((r) => { if (r.id && r.email) m[r.id] = r.email; });
    g("forum").forEach((r) => { if (r.user_id && r.user_email) m[r.user_id] = r.user_email; });
    profiles.forEach((r) => { if (r.id && (r.email || r.full_name)) m[r.id] = r.email || r.full_name; });
    return m;
  }, [d]); // eslint-disable-line react-hooks/exhaustive-deps
  const name = (id?: string) => (id ? who[id] || id.slice(0, 8) : "—");
  const cell = (c: string, v: any): React.ReactNode => {
    if (v === null || v === undefined) return "—";
    if (SENSITIVE.test(c)) return "••••••";
    if (typeof v === "boolean") return v ? "✓" : "—";
    if (typeof v === "object") { const t = JSON.stringify(v); return t.length > 60 ? t.slice(0, 60) + "…" : t; }
    const t = String(v);
    if (/^\d{4}-\d{2}-\d{2}T/.test(t)) return dt(t);
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-/.test(t)) return <span className="font-mono text-xs" title={t}>{who[t] || t.slice(0, 8)}</span>;
    return t.length > 80 ? t.slice(0, 80) + "…" : t;
  };
  const bankName = useMemo(() => Object.fromEntries(banks.map((b) => [b.id, b.name])), [banks]);

  const bought = ledger.filter((l) => Number(l.amount_paid) > 0);
  const since30 = Date.now() - 30 * 864e5;
  const rev30 = bought.filter((l) => new Date(l.created_at).getTime() > since30).reduce((a, l) => a + Number(l.amount_paid), 0);
  const revAll = bought.reduce((a, l) => a + Number(l.amount_paid), 0);
  const cur = bought[0]?.currency || "GBP";
  const live = sessions.filter((s) => s.connected_at && !s.ended_at).length;
  const pending = pays.filter((p) => String(p.status).toLowerCase() === "pending").length;

  const bars = useMemo(() => {
    const out: { k: string; v: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const k = day(new Date(Date.now() - i * 864e5).toISOString());
      out.push({ k, v: bought.filter((l) => day(l.created_at) === k).reduce((a, l) => a + Number(l.amount_paid), 0) });
    }
    return out;
  }, [ledger]); // eslint-disable-line react-hooks/exhaustive-deps
  const maxBar = Math.max(0.01, ...bars.map((b) => b.v));

  const userRows = useMemo(() => {
    const m: Record<string, Row> = {};
    const u = (id: string) => (m[id] ??= { id, balance: 0, spent: 0, sessions: 0, last: "" });
    const seen = (id: string, t?: string) => { if (t && t > u(id).last) m[id].last = t; };
    g("auth").forEach((a) => { u(a.id).banned = a.banned; u(a.id).joined = a.created_at; seen(a.id, a.last_sign_in_at); });
    dl.forEach((x) => { if (x.seller_id) { const y = u(x.seller_id); y.sales = (y.sales || 0) + 1; } });
    g("banks").forEach((b) => { if (b.user_id) { const x = u(b.user_id); x.banks = (x.banks || 0) + 1; seen(b.user_id, b.created_at); } });
    g("devices").forEach((v) => { if (v.user_id) { const x = u(v.user_id); x.devices = (x.devices || 0) + 1; seen(v.user_id, v.last_seen || v.created_at); } });
    g("forum").forEach((f) => { if (f.user_id) { const x = u(f.user_id); x.posts = (x.posts || 0) + 1; } });
    g("rooms").forEach((c) => [c.buyer_id, c.seller_id].forEach((id) => { if (id) { const x = u(id); x.chats = (x.chats || 0) + 1; seen(id, c.created_at); } }));
    wallets.forEach((w) => { u(w.user_id).balance = Number(w.seconds_balance) || 0; seen(w.user_id, w.updated_at); });
    bought.forEach((l) => { u(l.user_id).spent += Number(l.amount_paid); seen(l.user_id, l.created_at); });
    sessions.forEach((s) => { if (s.created_by) { u(s.created_by).sessions++; seen(s.created_by, s.created_at); } });
    profiles.forEach((p) => { if (p.id) u(p.id).role = p.role; });
    return Object.values(m).sort((a, b) => (a.last < b.last ? 1 : -1));
  }, [d]); // eslint-disable-line react-hooks/exhaustive-deps
  const canRoles = profiles.some((p) => "role" in p);

  const sellers = useMemo(() => {
    const m: Record<string, Row> = {};
    dl.forEach((r) => {
      const s = (m[r.seller_id] ??= { id: r.seller_id, n: 0, gross: 0, fee: 0, pay: 0, last: "" });
      s.n++; s.gross += Number(r.price) || 0; s.fee += Number(r.commission_amount) || 0; s.pay += Number(r.seller_receives) || 0;
      if (r.downloaded_at > s.last) s.last = r.downloaded_at;
    });
    return Object.values(m).sort((a, b) => b.gross - a.gross);
  }, [dl]);

  const match = (r: Row) => !q || JSON.stringify(r).toLowerCase().includes(q.toLowerCase());
  const nav = (m: Mod) => { setMod(m); setQ(""); setPg({}); setNavOpen(false); };
  const onSearch = (v: string) => { setQ(v); setPg({}); };
  const SIZE = prefs.size;
  const paged = (key: string, rows: Row[]): [Row[], React.ReactNode] => {
    const pages = Math.max(1, Math.ceil(rows.length / SIZE));
    const cur = Math.min(pg[key] ?? 0, pages - 1);
    const slice = rows.slice(cur * SIZE, cur * SIZE + SIZE);
    const go = (n: number) => setPg((s) => ({ ...s, [key]: Math.max(0, Math.min(pages - 1, n)) }));
    const node =
      rows.length > SIZE ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
          <span>{cur * SIZE + 1}–{Math.min(rows.length, cur * SIZE + SIZE)} of {rows.length}</span>
          <span className="flex items-center gap-2">
            <button onClick={() => go(cur - 1)} disabled={cur === 0} className="h-8 rounded-md border border-slate-200 px-3 font-semibold text-slate-700 disabled:opacity-40">Prev</button>
            <span className="tabular-nums">{cur + 1} / {pages}</span>
            <button onClick={() => go(cur + 1)} disabled={cur >= pages - 1} className="h-8 rounded-md border border-slate-200 px-3 font-semibold text-slate-700 disabled:opacity-40">Next</button>
          </span>
        </div>
      ) : null;
    return [slice, node];
  };
  const UF: Record<string, (r: Row) => boolean> = {
    all: () => true,
    paying: (r) => r.spent > 0,
    balance: (r) => r.balance > 0,
    suspended: (r) => !!r.banned,
    sellers: (r) => (r.sales || 0) > 0 || (r.banks || 0) > 0,
    devices: (r) => (r.devices || 0) > 0,
    inactive: (r) => !r.sessions && !r.spent && !r.banks && !r.devices && !r.posts && !r.chats,
  };
  const uAll = userRows.filter((r) => UF[ufilter](r) && match({ ...r, n: name(r.id) }));
  const [uRows, uPg] = paged("users", uAll);
  const bulkBar = (
    <div className={`flex flex-wrap items-center gap-2 rounded-xl border px-4 py-3 text-[13px] ${sel.length ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white"}`}>
      <span className="font-semibold text-slate-800"><span className="tabular-nums">{sel.length}</span> selected</span>
      <button onClick={() => setSel(uAll.map((r) => r.id))} className="font-semibold text-blue-700 hover:underline">Select all {uAll.length} in this filter</button>
      {sel.length > 0 && <button onClick={() => setSel([])} className="font-semibold text-slate-500 hover:underline">Clear</button>}
      <span className="flex-1" />
      <button onClick={() => bulk("hours")} disabled={!sel.length || busy} className="h-9 rounded-lg bg-blue-600 px-3.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-40">+ Hours to selected</button>
      {myRole === "owner" && (
        <>
          <button onClick={() => bulk("ban")} disabled={!sel.length || busy} className="h-9 rounded-lg border border-red-300 bg-white px-3.5 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-40">Suspend selected</button>
          <button onClick={() => bulk("unban")} disabled={!sel.length || busy} className="h-9 rounded-lg border border-emerald-300 bg-white px-3.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-40">Re-enable selected</button>
        </>
      )}
    </div>
  );
  const [sellRows, sellPg] = paged("sellers", sellers);
  const lAll = links.filter(match);
  const [lRows, lPg] = paged("links", lAll);
  const pAll = pays.filter(match);
  const [pRows, pPg] = paged("pays", pAll);
  const [gRows, gPg] = paged("ledger", ledger);
  const sAll = sessions.filter(match);
  const [sRows, sPg] = paged("sessions", sAll);
  const [bkRows, bkPg] = paged("banks", banks.filter(match));
  const [dlRows, dlPg] = paged("dl", dl.filter(match));
  const devs = g("devices");
  const [dvRows, dvPg] = paged("devs", devs.filter(match));
  const [auRows, auPg] = paged("audit", g("audit").filter(match));
  const A = acct
    ? (() => {
        const by = (rows: Row[], k: string) => rows.filter((r) => r[k] === acct);
        return {
          u: userRows.find((x) => x.id === acct) || ({ id: acct } as Row),
          pays: by(pays, "user_id"), ledger: by(ledger, "user_id"), sessions: by(sessions, "created_by"),
          banks: by(banks, "user_id"), devices: by(g("devices"), "user_id"), links: by(links, "user_id"),
          sales: by(dl, "seller_id"), posts: by(g("forum"), "user_id"),
          rooms: g("rooms").filter((r) => r.buyer_id === acct || r.seller_id === acct),
        };
      })()
    : null;
  const exCols = Object.keys(ex.rows[0] ?? {});
  const exAll = ex.rows.filter(match);
  const [exRows, exPg] = paged("ex", exAll);

  const act = async (confirmMsg: string, fn: string, args: Record<string, any>, ok: string) => {
    if (setup) return say("Actions are off until the admin functions are installed (business_admin.sql).");
    if (!window.confirm(confirmMsg)) return;
    setBusy(true);
    const { error } = await supabase.rpc(fn, args);
    if (error) {
      setBusy(false);
      return say(error.message);
    }
    say(ok);
    await refresh();
  };
  const resolvePay = (p: Row, accept: boolean) =>
    act(
      accept ? `Accept ${money(p.amount, p.currency)} from ${name(p.user_id)}?\nThis adds the hours of plan "${p.plan_id}" to their wallet.` : `Reject the request from ${name(p.user_id)}?`,
      "admin_resolve_payment", { p_id: p.id, p_accept: accept }, accept ? "Accepted: hours added." : "Request rejected."
    );
  const grantHours = (id: string) => {
    const v = window.prompt(`Add hours to ${name(id)} (negative removes):`, "1");
    if (v === null) return;
    const h = Number(v.replace(",", "."));
    if (!isFinite(h) || h === 0) return say("Enter a number of hours.");
    act(`Add ${h} h to ${name(id)}?`, "admin_grant_hours", { p_user: id, p_hours: h, p_note: "admin grant" }, `${h} h added.`);
  };
  const setBan = (id: string, ban: boolean) =>
    act(ban ? `Suspend ${name(id)}? They won't be able to sign in.` : `Re-enable ${name(id)}?`, "admin_set_banned", { p_user: id, p_banned: ban }, ban ? "Account suspended." : "Account re-enabled.");
  const revoke = (l: Row) => act("Revoke this link? It stops working immediately.", "admin_revoke_link", { p_id: l.id }, "Link revoked.");
  const startInvoice = (p: Row) => {
    setInvDraft({ user_id: p.user_id, gross: true, currency: p.currency, payment: p.id, line: { desc: `AirMIDI Link: plan ${p.plan_id} (ref. ${p.reference})`, qty: 1, price: Number(p.amount), vat: 21 } });
    nav("invoices");
  };
  const PayBtns = ({ p }: { p: Row }) =>
    String(p.status).toLowerCase() === "pending" ? (
      <span className="inline-flex gap-2">
        <button onClick={() => resolvePay(p, true)} disabled={busy} className="h-8 rounded-md bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50">Accept</button>
        <button onClick={() => resolvePay(p, false)} disabled={busy} className="h-8 rounded-md border border-red-200 px-3 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50">Reject</button>
      </span>
    ) : (
      <button onClick={() => startInvoice(p)} className="h-8 rounded-md border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:border-blue-400">Invoice</button>
    );
  const bulk = async (kind: "hours" | "ban" | "unban") => {
    if (setup) return say("Actions are off until the admin functions are installed (business_admin.sql).");
    const ids = sel.filter((id) => id !== meId || kind === "hours");
    if (!ids.length) return;
    let h = 0;
    if (kind === "hours") {
      const v = window.prompt(`Add hours to each of ${ids.length} accounts (negative removes):`, "1");
      if (v === null) return;
      h = Number(v.replace(",", "."));
      if (!isFinite(h) || h === 0) return say("Enter a number of hours.");
    }
    const msg = kind === "hours" ? `Add ${h} h to ${ids.length} accounts?` : `${kind === "ban" ? "Suspend" : "Re-enable"} ${ids.length} accounts?`;
    if (!window.confirm(msg)) return;
    setBusy(true);
    let failed = 0, lastErr = "";
    for (const id of ids) {
      const { error } = kind === "hours"
        ? await supabase.rpc("admin_grant_hours", { p_user: id, p_hours: h, p_note: "bulk grant" })
        : await supabase.rpc("admin_set_banned", { p_user: id, p_banned: kind === "ban" });
      if (error) { failed++; lastErr = error.message; }
    }
    say(failed ? `${ids.length - failed} done, ${failed} failed: ${lastErr}` : `Done for ${ids.length} accounts.`);
    setSel([]);
    await refresh();
  };
  const pendingRows = pays.filter((p) => String(p.status).toLowerCase() === "pending");


  if (gate !== "ok") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#E9EDF3] p-6 text-center">
        {gate === "checking" ? <span className="h-6 w-6 animate-spin rounded-full border-2 border-blue-200 border-t-blue-700" /> : (
          <div className="max-w-sm rounded-2xl border border-slate-200 bg-white p-8">
            <p className="text-lg font-bold text-slate-900">Restricted access</p>
            <p className="mt-2 text-sm text-slate-500">This console is restricted to the business owner and managers.</p>
            {gateMsg && <p className="mt-2 text-[11px] text-slate-400">{gateMsg}</p>}
            <button onClick={() => router.replace("/")} className="mt-5 h-10 rounded-lg bg-[#0A1220] px-5 text-xs font-bold text-white">Back to site</button>
          </div>
        )}
      </div>
    );
  }

  const SessionsTable = ({ rows, pager }: { rows: Row[]; pager?: React.ReactNode }) =>
    !rows.length ? <Empty err={err("sessions")} table={T.sessions} /> : (
      <Tbl pager={pager} head={<><th className={TH}>Created</th><th className={TH}>Owner</th><th className={TH}>Room</th><th className={TH}>Duration</th><th className={TH}>Billed</th><th className={TH}>Plan</th><th className={TH}>Status</th></>}>
        {rows.map((s) => (
          <tr key={s.id}>
            <td className={TD}>{dt(s.created_at)}</td>
            <td className={`${TD} font-medium text-slate-900`}>{name(s.created_by)}</td>
            <td className={`${TD} font-mono text-xs`}>{s.room_code}</td>
            <td className={`${TD} tabular-nums`}>{dur(Number(s.duration_seconds) || 0)}</td>
            <td className={`${TD} tabular-nums`}>{dur(Number(s.seconds_billed) || 0)}</td>
            <td className={TD}>{s.is_free ? <Pill t="Free" tone="mute" /> : <Pill t="Paid" tone="ok" />}</td>
            <td className={TD}>{s.connected_at && !s.ended_at ? <Pill t="Live" tone="ok" /> : <Pill t={s.status || "ended"} tone={s.status === "error" ? "bad" : "mute"} />}</td>
          </tr>
        ))}
      </Tbl>
    );

  const title = NAV.find((n) => n.id === mod)!.label;
  const dark = prefs.theme === "dark" || (prefs.theme === "system" && sysDark);
  const ac = ACCENTS[prefs.accent] ?? ACCENTS.blue;
  const mark = prefs.title.replace(/[^A-Za-z0-9]/g, "").slice(0, 2) || "iM";
  return (
    <div className={`adm-root min-h-screen bg-[#E9EDF3] text-slate-900 lg:pl-64 ${dark ? "adm-dark" : ""} ${prefs.dense ? "adm-compact" : ""}`} style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", ["--ac" as any]: ac[0], ["--ac2" as any]: ac[1], ["--ac3" as any]: ac[2] }}>
      <style>{RCSS + ACSS + ADARK}</style>
      {navOpen && <div className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[2px] lg:hidden" onClick={() => setNavOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-[17rem] max-w-[85vw] flex-col overflow-y-auto bg-gradient-to-b from-[#0C1730] to-[#0A1220] px-4 py-5 shadow-2xl transition-transform duration-200 lg:w-64 lg:translate-x-0 lg:shadow-none ${navOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="mb-5 flex items-center gap-3 border-b border-white/10 px-2 pb-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-sm font-extrabold text-white shadow-lg">{mark}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-bold tracking-tight text-white">{prefs.title}</p>
            <p className="mt-0.5 text-[11px] text-slate-400">Business administration</p>
          </div>
          <button onClick={() => setNavOpen(false)} aria-label="Close menu" className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white lg:hidden">✕</button>
        </div>
        <nav className="space-y-1">
          {NAV.map((n) => (
            <button key={n.id} onClick={() => nav(n.id)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] font-semibold transition-colors ${mod === n.id ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}>
              <Ico d={n.icon} />{n.label}
              {n.id === "revenue" && pending > 0 && <span className="ml-auto rounded-full bg-amber-400 px-1.5 text-[10px] font-bold text-black">{pending}</span>}
            </button>
          ))}
        </nav>
        <button onClick={() => router.push("/")} className="mt-auto rounded-lg px-3 py-2 text-left text-[12px] font-semibold text-slate-500 hover:text-white">← Back to site</button>
      </aside>

      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur" style={{ borderTop: "3px solid var(--ac)" }}>
        <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-3 px-4 sm:px-6 lg:px-8">
          <button onClick={() => setNavOpen(true)} aria-label="Open menu" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:border-blue-400 lg:hidden">
            <Ico d="M4 6h16M4 12h16M4 18h16" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="hidden truncate text-[11px] font-medium text-slate-400 sm:block">{prefs.title} <span className="mx-1">/</span> {title}</p>
            <h1 className="truncate text-[17px] font-bold leading-tight tracking-tight text-slate-900">{title}</h1>
          </div>
          <div className="hidden items-center gap-4 text-[11px] text-slate-500 xl:flex">
            <span><b className="tabular-nums text-slate-800">{userRows.length}</b> accounts</span>
            <span><b className="tabular-nums text-slate-800">{live}</b> live</span>
            <span><b className={`tabular-nums ${pending ? "text-amber-600" : "text-slate-800"}`}>{pending}</b> pending</span>
          </div>
          <span className="hidden text-[11px] text-slate-400 md:block">Updated {updated ? updated.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "—"}</span>
          <button onClick={refresh} disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-700 hover:border-blue-400 disabled:opacity-50 sm:px-4">
            <svg className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5" /></svg>
            <span className="hidden sm:inline">{busy ? "Refreshing" : "Refresh"}</span>
          </button>
          <button onClick={() => setPref({ theme: dark ? "light" : "dark" })} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"} title={dark ? "Light theme" : "Dark theme"} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-blue-400">
            <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {dark ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></> : <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />}
            </svg>
          </button>
          <div className="relative">
            <button onClick={() => setPrefsOpen((v) => !v)} aria-label="Personalize" aria-expanded={prefsOpen} title="Personalize" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-blue-400">
              <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
            </button>
            {prefsOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setPrefsOpen(false)} />
                <div className="absolute right-0 top-12 z-50 w-72 max-w-[calc(100vw-2rem)] space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
                  <div>
                    <p className="mb-2 text-[11px] font-semibold text-slate-500">Theme</p>
                    <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
                      {(["light", "dark", "system"] as const).map((t) => (
                        <button key={t} onClick={() => setPref({ theme: t })} className={`h-8 rounded-md text-xs font-semibold capitalize ${prefs.theme === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>{t}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-[11px] font-semibold text-slate-500">Accent colour</p>
                    <div className="flex gap-2">
                      {Object.entries(ACCENTS).map(([k, v]) => (
                        <button key={k} onClick={() => setPref({ accent: k })} aria-label={k} title={k} className={`h-8 w-8 rounded-full border-2 ${prefs.accent === k ? "border-slate-900" : "border-transparent"}`} style={{ background: v[0] }} />
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[13px] font-semibold text-slate-700">Compact tables</p>
                    <button role="switch" aria-checked={prefs.dense} onClick={() => setPref({ dense: !prefs.dense })} className={`relative h-6 w-11 rounded-full transition-colors ${prefs.dense ? "bg-blue-600" : "bg-slate-300"}`}>
                      <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${prefs.dense ? "translate-x-5" : ""}`} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[13px] font-semibold text-slate-700">Rows per page</p>
                    <select value={prefs.size} onChange={(e) => { setPref({ size: Number(e.target.value) }); setPg({}); }} className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold">
                      {[12, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div>
                    <p className="mb-2 text-[11px] font-semibold text-slate-500">Console name</p>
                    <input value={prefs.title} maxLength={28} onChange={(e) => setPref({ title: e.target.value || "iMIDI Console" })} className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-[13px] outline-none focus:border-blue-500" />
                  </div>
                  <button onClick={() => setPref(DEF)} className="text-xs font-semibold text-slate-500 hover:underline">Reset to defaults</button>
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-2.5 border-l border-slate-200 pl-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-blue-800 text-sm font-bold text-white">{(myEmail[0] || "?").toUpperCase()}</span>
            <div className="hidden leading-tight lg:block">
              <p className="max-w-[170px] truncate text-[12px] font-semibold text-slate-800">{myEmail || "—"}</p>
              <p className="text-[11px] text-slate-400">{myRole === "viewer" ? "View-only" : myRole === "owner" ? "Owner" : "Manager"}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1600px] space-y-5 px-4 py-5 sm:px-6 lg:px-8">
        {setup && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
            <b>View-only mode.</b> You can see everything your account is allowed to read. Actions (accept payments, hours, suspend, revoke) turn on once <span className="font-mono">business_admin.sql</span> is installed, and access will then be limited to owner and managers.
          </p>
        )}
        {mod === "overview" && (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Kpi label="Users" value={String(userRows.length)} sub={`${wallets.length} with a wallet`} tone="#2563EB" />
              <Kpi label="Live sessions" value={String(live)} sub={`${sessions.length} total`} tone="#0D9488" />
              <Kpi label="Revenue, 30 days" value={money(rev30, cur)} sub={`${money(revAll, cur)} all time`} tone="#F59E0B" />
              <Kpi label="Pending payments" value={String(pending)} sub={`${pays.length} requests`} tone="#64748B" />
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Kpi label="Banks" value={String(banks.length)} sub={`${Math.round(banks.reduce((a, b) => a + (Number(b.size_mb) || 0), 0))} MB stored`} tone="#2563EB" />
              <Kpi label="Devices online" value={`${g("devices").filter((v) => v.is_online).length}/${g("devices").length}`} sub="IoT" tone="#0D9488" />
              <Kpi label="Marketplace sales" value={String(dl.length)} sub={money(dl.reduce((a, r) => a + (Number(r.price) || 0), 0), cur)} tone="#F59E0B" />
              <Kpi label="Our commission" value={money(dl.reduce((a, r) => a + (Number(r.commission_amount) || 0), 0), cur)} sub={`${new Set(dl.map((r) => r.seller_id)).size} sellers`} tone="#64748B" />
            </div>
            {pendingRows.length > 0 && (
              <Card title={`Needs action: ${pendingRows.length} payment${pendingRows.length > 1 ? "s" : ""} to confirm`}>
                <Tbl head={<><th className={TH}>Created</th><th className={TH}>User</th><th className={TH}>Plan</th><th className={TH}>Amount</th><th className={TH}>Reference</th><th className={TH} /></>}>
                  {pendingRows.slice(0, 8).map((p) => (
                    <tr key={p.id}>
                      <td className={TD}>{dt(p.created_at)}</td>
                      <td className={`${TD} font-medium text-slate-900`}>{name(p.user_id)}</td>
                      <td className={TD}>{p.plan_id}</td>
                      <td className={`${TD} tabular-nums`}>{money(p.amount, p.currency)}</td>
                      <td className={`${TD} font-mono text-xs`}>{p.reference}</td>
                      <td className={`${TD} text-right`}><PayBtns p={p} /></td>
                    </tr>
                  ))}
                </Tbl>
              </Card>
            )}
            <Card title="Revenue, last 14 days">
              <div className="flex h-44 items-end gap-1.5 px-4 pt-6">
                {bars.map((b) => (
                  <div key={b.k} className="flex h-full flex-1 items-end" title={`${b.k}: ${money(b.v, cur)}`}>
                    <div className="w-full rounded-t bg-gradient-to-t from-blue-700 to-blue-400" style={{ height: `${Math.max(3, (b.v / maxBar) * 100)}%` }} />
                  </div>
                ))}
              </div>
              <div className="flex gap-1.5 px-4 pb-3 pt-1">{bars.map((b) => <span key={b.k} className="flex-1 text-center text-[9px] text-slate-400">{b.k.slice(8)}</span>)}</div>
            </Card>
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
              <Card title="Latest sessions"><SessionsTable rows={sessions.slice(0, 6)} /></Card>
              <Card title="Free tier">
                <dl className="space-y-3 p-4 text-[13px]">
                  <div className="flex justify-between"><dt className="text-slate-500">Free session</dt><dd className="font-semibold">{settings ? `${Math.round(settings.free_session_seconds / 60)} min` : "—"}</dd></div>
                  <div className="flex justify-between"><dt className="text-slate-500">Free per day</dt><dd className="font-semibold">{settings?.free_sessions_per_day ?? "—"}</dd></div>
                  <div className="flex justify-between"><dt className="text-slate-500">Free sessions</dt><dd className="font-semibold">{sessions.filter((s) => s.is_free).length}</dd></div>
                  <div className="flex justify-between"><dt className="text-slate-500">Hours in wallets</dt><dd className="font-semibold">{hrs(wallets.reduce((a, w) => a + (Number(w.seconds_balance) || 0), 0))} h</dd></div>
                </dl>
              </Card>
            </div>
          </>
        )}

        {mod === "users" && (
          <>
          {bulkBar}
          <Card
            title={`Accounts (${uAll.length} of ${userRows.length})`}
            right={
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                <select value={ufilter} onChange={(e) => { setUfilter(e.target.value); setPg({}); }} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-[13px] font-semibold text-slate-700">
                  <option value="all">All accounts</option>
                  <option value="paying">Paying customers</option>
                  <option value="balance">With hours left</option>
                  <option value="sellers">Sellers / bank owners</option>
                  <option value="devices">With devices</option>
                  <option value="suspended">Suspended</option>
                  <option value="inactive">No activity</option>
                </select>
                <Search v={q} on={onSearch} />
              </div>
            }
          >
            {userRows.length === 0 ? <Empty err={err("wallets")} table={T.wallets} /> : (
              <Tbl pager={uPg} head={<><th className={TH} /><th className={TH}>User</th><th className={TH}>Hours left</th><th className={TH}>Spent</th><th className={TH}>Sessions</th><th className={TH}>Banks</th><th className={TH}>Devices</th><th className={TH}>Posts</th><th className={TH}>Chats</th><th className={TH}>Last activity</th><th className={TH}>Joined</th><th className={TH}>Account</th><th className={TH} />{canRoles && <th className={TH}>Role</th>}</>}>
                {uRows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70">
                    <td className={TD}><input type="checkbox" aria-label="Select account" checked={sel.includes(r.id)} onChange={() => setSel((x) => (x.includes(r.id) ? x.filter((i) => i !== r.id) : [...x, r.id]))} className="h-4 w-4 accent-blue-600" /></td>
                    <td className={TD}><button onClick={() => { setAcct(r.id); setAtab("summary"); }} className="font-semibold text-blue-700 hover:underline">{name(r.id)}</button></td>
                    <td className={`${TD} tabular-nums`}>{hrs(r.balance)} h</td>
                    <td className={`${TD} tabular-nums`}>{money(r.spent, cur)}</td>
                    <td className={`${TD} tabular-nums`}>{r.sessions}</td>
                    <td className={`${TD} tabular-nums`}>{r.banks || 0}</td>
                    <td className={`${TD} tabular-nums`}>{r.devices || 0}</td>
                    <td className={`${TD} tabular-nums`}>{r.posts || 0}</td>
                    <td className={`${TD} tabular-nums`}>{r.chats || 0}</td>
                    <td className={TD}>{dt(r.last)}</td>
                    <td className={TD}>{dt(r.joined)}</td>
                    <td className={TD}>{r.banned ? <Pill t="Suspended" tone="bad" /> : <Pill t="Active" tone="ok" />}</td>
                    <td className={`${TD} text-right`}>
                      <span className="inline-flex gap-2">
                        <button onClick={() => { setAcct(r.id); setAtab("summary"); }} className="h-8 rounded-md bg-[#0A1220] px-3 text-xs font-bold text-white hover:bg-blue-700">Open</button>
                        <button onClick={() => grantHours(r.id)} disabled={busy} className="h-8 rounded-md border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:border-blue-400 disabled:opacity-50">+ Hours</button>
                        {myRole === "owner" && r.id !== meId && (
                          <button onClick={() => setBan(r.id, !r.banned)} disabled={busy} className={`h-8 rounded-md border px-3 text-xs font-bold disabled:opacity-50 ${r.banned ? "border-emerald-200 text-emerald-700 hover:bg-emerald-50" : "border-red-200 text-red-600 hover:bg-red-50"}`}>
                            {r.banned ? "Enable" : "Suspend"}
                          </button>
                        )}
                      </span>
                    </td>
                    {canRoles && (
                      <td className={TD}>
                        <Pill t={r.role || "user"} tone={r.role === "superadmin" ? "ok" : "mute"} />
                      </td>
                    )}
                  </tr>
                ))}
              </Tbl>
            )}
          </Card>
          </>
        )}

        {mod === "sellers" && (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Kpi label="Sellers" value={String(sellers.length)} tone="#2563EB" />
              <Kpi label="Downloads" value={String(dl.length)} tone="#0D9488" />
              <Kpi label="Gross sales" value={money(sellers.reduce((a, s) => a + s.gross, 0), cur)} tone="#F59E0B" />
              <Kpi label="Our commission" value={money(sellers.reduce((a, s) => a + s.fee, 0), cur)} tone="#64748B" />
            </div>
            <Card title="Sellers">
              {sellers.length === 0 ? <Empty err={err("dl")} table={T.dl} /> : (
                <Tbl pager={sellPg} head={<><th className={TH}>Seller</th><th className={TH}>Downloads</th><th className={TH}>Gross</th><th className={TH}>Commission</th><th className={TH}>Payout owed</th><th className={TH}>Last sale</th></>}>
                  {sellRows.map((s) => (
                    <tr key={s.id}>
                      <td className={`${TD} font-medium text-slate-900`}>{name(s.id)}</td>
                      <td className={`${TD} tabular-nums`}>{s.n}</td>
                      <td className={`${TD} tabular-nums`}>{money(s.gross, cur)}</td>
                      <td className={`${TD} tabular-nums`}>{money(s.fee, cur)}</td>
                      <td className={`${TD} tabular-nums`}>{money(s.pay, cur)}</td>
                      <td className={TD}>{dt(s.last)}</td>
                    </tr>
                  ))}
                </Tbl>
              )}
            </Card>
            <Card title={`Share links (${lAll.length})`} right={<Search v={q} on={onSearch} />}>
              {links.length === 0 ? <Empty err={err("links")} table={T.links} /> : (
                <Tbl pager={lPg} head={<><th className={TH}>Bank</th><th className={TH}>Seller</th><th className={TH}>Created</th><th className={TH}>Expires</th><th className={TH}>Status</th><th className={TH} /></>}>
                  {lRows.map((l) => {
                    const expired = l.expires_at && new Date(l.expires_at).getTime() < Date.now();
                    return (
                      <tr key={l.id}>
                        <td className={`${TD} max-w-[16rem] truncate font-medium text-slate-900`}>{bankName[l.bank_id] || `#${l.bank_id}`}</td>
                        <td className={TD}>{name(l.user_id)}</td>
                        <td className={TD}>{dt(l.created_at)}</td>
                        <td className={TD}>{dt(l.expires_at)}</td>
                        <td className={TD}>{l.used ? <Pill t="Redeemed" tone="ok" /> : expired ? <Pill t="Expired" tone="mute" /> : <Pill t="Open" tone="warn" />}</td>
                        <td className={`${TD} text-right`}>{!l.used && !expired && <button onClick={() => revoke(l)} disabled={busy} className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50">Revoke</button>}</td>
                      </tr>
                    );
                  })}
                </Tbl>
              )}
            </Card>
          </>
        )}

        {mod === "revenue" && (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Kpi label="All time" value={money(revAll, cur)} tone="#2563EB" />
              <Kpi label="Last 30 days" value={money(rev30, cur)} tone="#0D9488" />
              <Kpi label="Purchases" value={String(bought.length)} tone="#F59E0B" />
              <Kpi label="Hours sold" value={hrs(bought.reduce((a, l) => a + (Number(l.seconds) || 0), 0))} sub={`${pending} payments pending`} tone="#64748B" />
            </div>
            <Card title={`Payment requests (${pAll.length})`} right={<Search v={q} on={onSearch} />}>
              {pays.length === 0 ? <Empty err={err("pays")} table={T.pays} /> : (
                <Tbl pager={pPg} head={<><th className={TH}>Created</th><th className={TH}>User</th><th className={TH}>Plan</th><th className={TH}>Amount</th><th className={TH}>Reference</th><th className={TH}>Status</th><th className={TH}>Resolved</th><th className={TH} /></>}>
                  {pRows.map((p) => {
                    const st = String(p.status).toLowerCase();
                    return (
                      <tr key={p.id}>
                        <td className={TD}>{dt(p.created_at)}</td>
                        <td className={`${TD} font-medium text-slate-900`}>{name(p.user_id)}</td>
                        <td className={TD}>{p.plan_id}</td>
                        <td className={`${TD} tabular-nums`}>{money(p.amount, p.currency)}</td>
                        <td className={`${TD} font-mono text-xs`}>{p.reference}</td>
                        <td className={TD}><Pill t={p.status} tone={st === "pending" ? "warn" : ["failed", "cancelled", "expired"].includes(st) ? "bad" : "ok"} /></td>
                        <td className={TD}>{dt(p.resolved_at)}</td>
                        <td className={`${TD} text-right`}><PayBtns p={p} /></td>
                      </tr>
                    );
                  })}
                </Tbl>
              )}
            </Card>
            <div className="grid gap-5 xl:grid-cols-2">
              <Card title="Ledger">
                {ledger.length === 0 ? <Empty err={err("ledger")} table={T.ledger} /> : (
                  <Tbl pager={gPg} head={<><th className={TH}>Date</th><th className={TH}>User</th><th className={TH}>Kind</th><th className={TH}>Hours</th><th className={TH}>Paid</th></>}>
                    {gRows.map((l) => (
                      <tr key={l.id}>
                        <td className={TD}>{dt(l.created_at)}</td><td className={`${TD} font-medium text-slate-900`}>{name(l.user_id)}</td>
                        <td className={TD}><Pill t={l.kind} tone="mute" /></td>
                        <td className={`${TD} tabular-nums`}>{hrs(Number(l.seconds) || 0)}</td>
                        <td className={`${TD} tabular-nums`}>{Number(l.amount_paid) > 0 ? money(l.amount_paid, l.currency) : "—"}</td>
                      </tr>
                    ))}
                  </Tbl>
                )}
              </Card>
              <Card title="Plans">
                {plans.length === 0 ? <Empty err={err("plans")} table={T.plans} /> : (
                  <Tbl head={<><th className={TH}>Plan</th><th className={TH}>Price</th><th className={TH}>Hours</th><th className={TH}>Per hour</th><th className={TH}>Active</th></>}>
                    {plans.map((p) => (
                      <tr key={p.id}>
                        <td className={`${TD} font-medium text-slate-900`}>{p.name}</td>
                        <td className={`${TD} tabular-nums`}>{money(p.price, p.currency)}</td>
                        <td className={`${TD} tabular-nums`}>{p.hours}</td>
                        <td className={`${TD} tabular-nums`}>{money(p.price_per_hour, p.currency)}</td>
                        <td className={TD}>{p.is_active ? <Pill t="Active" tone="ok" /> : <Pill t="Off" tone="mute" />}</td>
                      </tr>
                    ))}
                  </Tbl>
                )}
              </Card>
            </div>
          </>
        )}

        {mod === "explorer" && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {KNOWN.map((t) => (
                <button key={t} onClick={() => { setExTable(t); setPg({}); setQ(""); }} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${exTable === t ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-blue-400"}`}>
                  {t} <span className="tabular-nums opacity-60">{counts[t] === undefined ? "…" : counts[t] === null ? "×" : counts[t]}</span>
                </button>
              ))}
              <form onSubmit={(e) => { e.preventDefault(); const t = exCustom.trim(); if (t) { setExTable(t); setPg({}); setQ(""); } }} className="flex gap-2">
                <input value={exCustom} onChange={(e) => setExCustom(e.target.value)} placeholder="other table…" className="h-8 w-40 rounded-full border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-500" />
                <button className="h-8 rounded-full bg-[#0A1220] px-4 text-xs font-bold text-white">Open</button>
              </form>
            </div>
            <Card title={`${exTable} (${exAll.length}${ex.rows.length >= 1000 ? "+" : ""})`} right={<Search v={q} on={onSearch} />}>
              {ex.rows.length === 0 ? <Empty err={ex.error} table={exTable} /> : (
                <Tbl pager={exPg} head={<>{exCols.map((c) => <th key={c} className={TH}>{c}</th>)}</>}>
                  {exRows.map((r, i) => (
                    <tr key={i}>{exCols.map((c) => <td key={c} className={TD}>{cell(c, r[c])}</td>)}</tr>
                  ))}
                </Tbl>
              )}
            </Card>
            <p className="text-[11px] text-slate-400">Shows the first 1000 rows of each table. Keys, tokens and code hashes are hidden. “×” = no read access to that table.</p>
          </>
        )}

        {mod === "banks" && (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Kpi label="Banks" value={String(banks.length)} tone="#2563EB" />
              <Kpi label="Storage" value={`${Math.round(banks.reduce((a, b) => a + (Number(b.size_mb) || 0), 0))} MB`} tone="#0D9488" />
              <Kpi label="Downloads" value={String(banks.reduce((a, b) => a + (Number(b.download_count) || 0), 0))} tone="#F59E0B" />
              <Kpi label="Owners" value={String(new Set(banks.map((b) => b.user_id)).size)} tone="#64748B" />
            </div>
            <Card title={`Banks (${banks.filter(match).length})`} right={<Search v={q} on={onSearch} />}>
              {banks.length === 0 ? <Empty err={err("banks")} table={T.banks} /> : (
                <Tbl pager={bkPg} head={<><th className={TH}>Name</th><th className={TH}>Type</th><th className={TH}>Owner</th><th className={TH}>Items</th><th className={TH}>Size</th><th className={TH}>Downloads</th><th className={TH}>Status</th><th className={TH}>Created</th></>}>
                  {bkRows.map((b) => (
                    <tr key={b.id}>
                      <td className={`${TD} max-w-[16rem] truncate font-medium text-slate-900`}>{b.name}</td>
                      <td className={TD}>{b.type || "—"}</td>
                      <td className={TD}>{name(b.user_id)}</td>
                      <td className={`${TD} tabular-nums`}>{b.items_count ?? "—"}</td>
                      <td className={`${TD} tabular-nums`}>{b.size_mb != null ? `${Math.round(Number(b.size_mb))} MB` : "—"}</td>
                      <td className={`${TD} tabular-nums`}>{b.download_count ?? 0}</td>
                      <td className={TD}><Pill t={b.status || "—"} tone={b.status === "active" || b.status === "ready" ? "ok" : "mute"} /></td>
                      <td className={TD}>{dt(b.created_at)}</td>
                    </tr>
                  ))}
                </Tbl>
              )}
            </Card>
            <Card title="Download & sales log">
              {dl.length === 0 ? <Empty err={err("dl")} table={T.dl} /> : (
                <Tbl pager={dlPg} head={<><th className={TH}>Date</th><th className={TH}>Bank</th><th className={TH}>Seller</th><th className={TH}>Price</th><th className={TH}>Commission</th><th className={TH}>Seller gets</th></>}>
                  {dlRows.map((r) => (
                    <tr key={r.id}>
                      <td className={TD}>{dt(r.downloaded_at)}</td>
                      <td className={`${TD} font-medium text-slate-900`}>{r.bank_name || "—"}</td>
                      <td className={TD}>{name(r.seller_id)}</td>
                      <td className={`${TD} tabular-nums`}>{money(r.price, cur)}</td>
                      <td className={`${TD} tabular-nums`}>{money(r.commission_amount, cur)}</td>
                      <td className={`${TD} tabular-nums`}>{money(r.seller_receives, cur)}</td>
                    </tr>
                  ))}
                </Tbl>
              )}
            </Card>
          </>
        )}

        {mod === "devices" && (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Kpi label="Devices" value={String(devs.length)} tone="#2563EB" />
              <Kpi label="Online" value={String(devs.filter((v) => v.is_online).length)} tone="#0D9488" />
              <Kpi label="Offline" value={String(devs.filter((v) => !v.is_online).length)} tone="#64748B" />
              <Kpi label="Owners" value={String(new Set(devs.map((v) => v.user_id)).size)} tone="#F59E0B" />
            </div>
            <Card title={`IoT devices (${devs.filter(match).length})`} right={<Search v={q} on={onSearch} />}>
              {devs.length === 0 ? <Empty err={err("devices")} table={T.devices} /> : (
                <Tbl pager={dvPg} head={<><th className={TH}>Device</th><th className={TH}>Owner</th><th className={TH}>Status</th><th className={TH}>Last seen</th><th className={TH}>Added</th></>}>
                  {dvRows.map((v) => (
                    <tr key={v.id}>
                      <td className={`${TD} font-medium text-slate-900`}>{v.device_name}</td>
                      <td className={TD}>{name(v.user_id)}</td>
                      <td className={TD}>{v.is_online ? <Pill t="Online" tone="ok" /> : <Pill t="Offline" tone="mute" />}</td>
                      <td className={TD}>{dt(v.last_seen)}</td>
                      <td className={TD}>{dt(v.created_at)}</td>
                    </tr>
                  ))}
                </Tbl>
              )}
            </Card>
          </>
        )}

        {mod === "audit" && (
          <Card title={`Audit log (${g("audit").filter(match).length})`} right={<Search v={q} on={onSearch} />}>
            {g("audit").length === 0 ? <Empty err={err("audit")} table={T.audit} /> : (
              <Tbl pager={auPg} head={<><th className={TH}>When</th><th className={TH}>Admin</th><th className={TH}>Action</th><th className={TH}>Target</th><th className={TH}>Details</th></>}>
                {auRows.map((a) => (
                  <tr key={a.id}>
                    <td className={TD}>{dt(a.created_at)}</td>
                    <td className={`${TD} font-medium text-slate-900`}>{name(a.admin_id)}</td>
                    <td className={TD}><Pill t={a.action} tone={String(a.action).includes("reject") || String(a.action).includes("suspend") || String(a.action).includes("revoke") ? "bad" : "ok"} /></td>
                    <td className={TD}>{cell("target", a.target)}</td>
                    <td className={`${TD} font-mono text-xs`}>{cell("details", a.details)}</td>
                  </tr>
                ))}
              </Tbl>
            )}
          </Card>
        )}

{mod === "invoices" && (
  <div key="force-static-invoice-container" className="w-full">
    <InvoicesModule 
      key="immutable-invoice-view"
      rows={g("inv")} 
      settingsRow={g("invset")[0]} 
      users={userRows} 
      who={who} 
      cur={cur} 
      size={prefs.size} 
      setup={setup} 
      owner={myRole === "owner"} 
      busy={false} // 
      draft={invDraft} 
      clearDraft={() => setInvDraft(null)} 
      act={act} 
      refresh={refresh} 
      say={say} 
    />
  </div>
)}




        {mod === "sessions" && (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Kpi label="Live now" value={String(live)} tone="#0D9488" />
              <Kpi label="Sessions" value={String(sessions.length)} sub={`${sessions.filter((s) => s.is_free).length} free`} tone="#2563EB" />
              <Kpi label="Total time" value={dur(sessions.reduce((a, s) => a + (Number(s.duration_seconds) || 0), 0))} tone="#F59E0B" />
              <Kpi label="Billed time" value={dur(sessions.reduce((a, s) => a + (Number(s.seconds_billed) || 0), 0))} tone="#64748B" />
            </div>
            <Card title={`Sessions (${sAll.length})`} right={<Search v={q} on={onSearch} />}>
              <SessionsTable rows={sRows} pager={sPg} />
            </Card>
          </>
        )}
      </main>

      {A && (() => {
        const TABS = [
          { id: "summary", l: "Summary" },
          { id: "money", l: `Money (${A.pays.length + A.ledger.length})` },
          { id: "sessions", l: `Sessions (${A.sessions.length})` },
          { id: "content", l: `Content (${A.banks.length + A.links.length + A.sales.length})` },
          { id: "devices", l: `Devices (${A.devices.length})` },
          { id: "community", l: `Community (${A.posts.length + A.rooms.length})` },
        ];
        const None = () => <p className="px-4 py-6 text-center text-[13px] text-slate-400">Nothing on this account.</p>;
        const Box = ({ t, n, children }: { t: string; n: number; children: React.ReactNode }) => (
          <Card title={`${t} (${n})`}>{n === 0 ? <None /> : children}</Card>
        );
        const u = A.u;
        const info: [string, React.ReactNode][] = [
          ["Email", who[u.id] || "—"], ["User ID", <span key="i" className="font-mono text-xs">{u.id}</span>],
          ["Joined", dt(u.joined)], ["Last activity", dt(u.last)], ["Role", u.role || "user"],
          ["Hours left", `${hrs(u.balance || 0)} h`], ["Total spent", money(u.spent || 0, cur)],
          ["Marketplace sales", String(u.sales || 0)], ["Forum posts", String(u.posts || 0)], ["Chats", String(u.chats || 0)],
        ];
        return (
          <>
            <div className="fixed inset-0 z-[55] bg-black/50" onClick={() => setAcct(null)} />
            <section className="fixed inset-y-0 right-0 z-[60] flex w-full max-w-3xl flex-col bg-[#F4F6FA] shadow-2xl">
              <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6" style={{ borderTop: "3px solid var(--ac)" }}>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-blue-800 text-base font-bold text-white">{(who[u.id]?.[0] || "?").toUpperCase()}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-bold text-slate-900">{name(u.id)}</p>
                  <p className="truncate font-mono text-[11px] text-slate-400">{u.id}</p>
                </div>
                {(() => {
                  const i = uAll.findIndex((x) => x.id === acct);
                  return (
                    <span className="hidden items-center gap-1 sm:flex">
                      <button onClick={() => setAcct(uAll[i - 1].id)} disabled={i <= 0} aria-label="Previous account" className="h-8 w-8 rounded-md border border-slate-200 text-slate-600 hover:border-blue-400 disabled:opacity-30">‹</button>
                      <span className="w-14 text-center text-[11px] tabular-nums text-slate-400">{i >= 0 ? `${i + 1} / ${uAll.length}` : "—"}</span>
                      <button onClick={() => setAcct(uAll[i + 1].id)} disabled={i < 0 || i >= uAll.length - 1} aria-label="Next account" className="h-8 w-8 rounded-md border border-slate-200 text-slate-600 hover:border-blue-400 disabled:opacity-30">›</button>
                    </span>
                  );
                })()}
                {u.banned ? <Pill t="Suspended" tone="bad" /> : <Pill t="Active" tone="ok" />}
                <button onClick={() => setAcct(null)} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">✕</button>
              </div>
              <div className="no-scrollbar flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-3">
                {TABS.map((t) => (
                  <button key={t.id} onClick={() => setAtab(t.id)} className={`shrink-0 border-b-2 px-3 py-3 text-xs font-semibold ${atab === t.id ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>{t.l}</button>
                ))}
              </div>
              <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
                {atab === "summary" && (
                  <>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      <Kpi label="Hours left" value={hrs(u.balance || 0)} tone="#2563EB" />
                      <Kpi label="Spent" value={money(u.spent || 0, cur)} tone="#F59E0B" />
                      <Kpi label="Sessions" value={String(A.sessions.length)} tone="#0D9488" />
                      <Kpi label="Banks" value={String(A.banks.length)} tone="#64748B" />
                    </div>
                    <Card title="Account">
                      <dl className="divide-y divide-slate-100">
                        {info.map(([k, v]) => (
                          <div key={k} className="flex items-center justify-between gap-4 px-4 py-2.5 text-[13px]"><dt className="text-slate-500">{k}</dt><dd className="min-w-0 truncate text-right font-medium text-slate-900">{v}</dd></div>
                        ))}
                      </dl>
                    </Card>
                    <Card title="Controls">
                      <div className="flex flex-wrap gap-2 p-4">
                        <button onClick={() => grantHours(u.id)} disabled={busy} className="h-10 rounded-lg bg-blue-600 px-4 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50">+ Add / remove hours</button>
                        {myRole === "owner" && u.id !== meId && (
                          <button onClick={() => setBan(u.id, !u.banned)} disabled={busy} className={`h-10 rounded-lg border px-4 text-xs font-bold disabled:opacity-50 ${u.banned ? "border-emerald-300 text-emerald-700 hover:bg-emerald-50" : "border-red-300 text-red-600 hover:bg-red-50"}`}>{u.banned ? "Re-enable account" : "Suspend account"}</button>
                        )}
                        <button onClick={() => { setAcct(null); setInvDraft({ user_id: u.id }); nav("invoices"); }} className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 hover:border-blue-400">Create invoice</button>
                        <button onClick={() => { navigator.clipboard?.writeText(u.id); say("User ID copied."); }} className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 hover:border-blue-400">Copy user ID</button>
                      </div>
                    </Card>
                  </>
                )}
                {atab === "money" && (
                  <>
                    <Box t="Payment requests" n={A.pays.length}>
                      <Tbl head={<><th className={TH}>Date</th><th className={TH}>Plan</th><th className={TH}>Amount</th><th className={TH}>Reference</th><th className={TH}>Status</th><th className={TH} /></>}>
                        {A.pays.slice(0, 30).map((p) => (
                          <tr key={p.id}>
                            <td className={TD}>{dt(p.created_at)}</td><td className={TD}>{p.plan_id}</td>
                            <td className={`${TD} tabular-nums`}>{money(p.amount, p.currency)}</td>
                            <td className={`${TD} font-mono text-xs`}>{p.reference}</td>
                            <td className={TD}><Pill t={p.status} tone={String(p.status).toLowerCase() === "pending" ? "warn" : "ok"} /></td>
                            <td className={`${TD} text-right`}><PayBtns p={p} /></td>
                          </tr>
                        ))}
                      </Tbl>
                    </Box>
                    <Box t="Ledger" n={A.ledger.length}>
                      <Tbl head={<><th className={TH}>Date</th><th className={TH}>Kind</th><th className={TH}>Hours</th><th className={TH}>Paid</th><th className={TH}>Reference</th></>}>
                        {A.ledger.slice(0, 30).map((l) => (
                          <tr key={l.id}>
                            <td className={TD}>{dt(l.created_at)}</td><td className={TD}><Pill t={l.kind} tone="mute" /></td>
                            <td className={`${TD} tabular-nums`}>{hrs(Number(l.seconds) || 0)}</td>
                            <td className={`${TD} tabular-nums`}>{Number(l.amount_paid) > 0 ? money(l.amount_paid, l.currency) : "—"}</td>
                            <td className={`${TD} font-mono text-xs`}>{l.payment_reference || "—"}</td>
                          </tr>
                        ))}
                      </Tbl>
                    </Box>
                  </>
                )}
                {atab === "sessions" && (
                  <Box t="AirMIDI sessions" n={A.sessions.length}>
                    <Tbl head={<><th className={TH}>Created</th><th className={TH}>Room</th><th className={TH}>Duration</th><th className={TH}>Billed</th><th className={TH}>Plan</th><th className={TH}>Status</th></>}>
                      {A.sessions.slice(0, 30).map((x) => (
                        <tr key={x.id}>
                          <td className={TD}>{dt(x.created_at)}</td><td className={`${TD} font-mono text-xs`}>{x.room_code}</td>
                          <td className={`${TD} tabular-nums`}>{dur(Number(x.duration_seconds) || 0)}</td>
                          <td className={`${TD} tabular-nums`}>{dur(Number(x.seconds_billed) || 0)}</td>
                          <td className={TD}>{x.is_free ? <Pill t="Free" tone="mute" /> : <Pill t="Paid" tone="ok" />}</td>
                          <td className={TD}><Pill t={x.status || "—"} tone="mute" /></td>
                        </tr>
                      ))}
                    </Tbl>
                  </Box>
                )}
                {atab === "content" && (
                  <>
                    <Box t="Banks" n={A.banks.length}>
                      <Tbl head={<><th className={TH}>Name</th><th className={TH}>Type</th><th className={TH}>Items</th><th className={TH}>Size</th><th className={TH}>Downloads</th><th className={TH}>Status</th></>}>
                        {A.banks.slice(0, 30).map((b) => (
                          <tr key={b.id}>
                            <td className={`${TD} font-medium text-slate-900`}>{b.name}</td><td className={TD}>{b.type || "—"}</td>
                            <td className={`${TD} tabular-nums`}>{b.items_count ?? "—"}</td>
                            <td className={`${TD} tabular-nums`}>{b.size_mb != null ? `${Math.round(Number(b.size_mb))} MB` : "—"}</td>
                            <td className={`${TD} tabular-nums`}>{b.download_count ?? 0}</td><td className={TD}><Pill t={b.status || "—"} tone="mute" /></td>
                          </tr>
                        ))}
                      </Tbl>
                    </Box>
                    <Box t="Share links" n={A.links.length}>
                      <Tbl head={<><th className={TH}>Bank</th><th className={TH}>Created</th><th className={TH}>Expires</th><th className={TH}>Status</th><th className={TH} /></>}>
                        {A.links.slice(0, 30).map((l) => {
                          const expired = l.expires_at && new Date(l.expires_at).getTime() < Date.now();
                          return (
                            <tr key={l.id}>
                              <td className={`${TD} font-medium text-slate-900`}>{bankName[l.bank_id] || `#${l.bank_id}`}</td>
                              <td className={TD}>{dt(l.created_at)}</td><td className={TD}>{dt(l.expires_at)}</td>
                              <td className={TD}>{l.used ? <Pill t="Redeemed" tone="ok" /> : expired ? <Pill t="Expired" tone="mute" /> : <Pill t="Open" tone="warn" />}</td>
                              <td className={`${TD} text-right`}>{!l.used && !expired && <button onClick={() => revoke(l)} disabled={busy} className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50">Revoke</button>}</td>
                            </tr>
                          );
                        })}
                      </Tbl>
                    </Box>
                    <Box t="Marketplace sales" n={A.sales.length}>
                      <Tbl head={<><th className={TH}>Date</th><th className={TH}>Bank</th><th className={TH}>Price</th><th className={TH}>Commission</th><th className={TH}>Receives</th></>}>
                        {A.sales.slice(0, 30).map((r) => (
                          <tr key={r.id}>
                            <td className={TD}>{dt(r.downloaded_at)}</td><td className={`${TD} font-medium text-slate-900`}>{r.bank_name || "—"}</td>
                            <td className={`${TD} tabular-nums`}>{money(r.price, cur)}</td><td className={`${TD} tabular-nums`}>{money(r.commission_amount, cur)}</td>
                            <td className={`${TD} tabular-nums`}>{money(r.seller_receives, cur)}</td>
                          </tr>
                        ))}
                      </Tbl>
                    </Box>
                  </>
                )}
                {atab === "devices" && (
                  <Box t="IoT devices" n={A.devices.length}>
                    <Tbl head={<><th className={TH}>Device</th><th className={TH}>Status</th><th className={TH}>Last seen</th><th className={TH}>Added</th></>}>
                      {A.devices.map((v) => (
                        <tr key={v.id}>
                          <td className={`${TD} font-medium text-slate-900`}>{v.device_name}</td>
                          <td className={TD}>{v.is_online ? <Pill t="Online" tone="ok" /> : <Pill t="Offline" tone="mute" />}</td>
                          <td className={TD}>{dt(v.last_seen)}</td><td className={TD}>{dt(v.created_at)}</td>
                        </tr>
                      ))}
                    </Tbl>
                  </Box>
                )}
                {atab === "community" && (
                  <>
                    <Box t="Forum posts" n={A.posts.length}>
                      {(() => {
                        const cols = Object.keys(A.posts[0] ?? {}).filter((c) => !["user_id", "user_email"].includes(c)).slice(0, 5);
                        return (
                          <Tbl head={<>{cols.map((c) => <th key={c} className={TH}>{c}</th>)}</>}>
                            {A.posts.slice(0, 30).map((r, i) => <tr key={i}>{cols.map((c) => <td key={c} className={TD}>{cell(c, r[c])}</td>)}</tr>)}
                          </Tbl>
                        );
                      })()}
                    </Box>
                    <Box t="Chat rooms" n={A.rooms.length}>
                      <Tbl head={<><th className={TH}>Role</th><th className={TH}>Other party</th><th className={TH}>Created</th><th className={TH}>Updated</th></>}>
                        {A.rooms.slice(0, 30).map((r) => (
                          <tr key={r.id}>
                            <td className={TD}>{r.buyer_id === acct ? "Buyer" : "Seller"}</td>
                            <td className={TD}>{name(r.buyer_id === acct ? r.seller_id : r.buyer_id)}</td>
                            <td className={TD}>{dt(r.created_at)}</td><td className={TD}>{dt(r.updated_at)}</td>
                          </tr>
                        ))}
                      </Tbl>
                    </Box>
                    <p className="text-[11px] text-slate-400">Private chat messages are not shown here.</p>
                  </>
                )}
              </div>
            </section>
          </>
        );
      })()}

      {toast && <div role="status" className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-[#0A1220] px-4 py-2.5 text-xs font-semibold text-white shadow-xl">{toast}</div>}
    </div>
  );
}