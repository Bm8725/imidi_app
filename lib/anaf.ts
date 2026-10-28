// lib/anaf.ts — SERVER ONLY. Never import this from a client component.
// Env (add at the end, in .env.local and on your host):
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   ANAF_CLIENT_ID, ANAF_CLIENT_SECRET, ANAF_REDIRECT_URI  (https://YOUR-SITE/api/anaf/callback, same as registered at ANAF)
//   ANAF_ENV=test | prod   (default: test)
//   ANAF_STATE_SECRET      (any long random string)
// BIG BIG ATENTION,,,NOT KEYS ANAF..still
import "server-only";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const ENV = process.env.ANAF_ENV === "prod" ? "prod" : "test";
export const API = `https://api.anaf.ro/${ENV}/FCTEL/rest`;
const OAUTH = "https://logincert.anaf.ro/anaf-oauth2/v1";

export const db = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

/* ---- who is calling: must be in airmidi_admins ---- */
export async function caller(req: Request): Promise<{ id: string; role: string } | null> {
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!jwt) return null;
  const sb = db();
  const { data } = await sb.auth.getUser(jwt);
  if (!data.user) return null;
  const { data: a } = await sb.from("airmidi_admins").select("role").eq("user_id", data.user.id).maybeSingle();
  return a ? { id: data.user.id, role: a.role } : null;
}

/* ---- signed, expiring "state" for the OAuth round trip ---- */
const secret = () => process.env.ANAF_STATE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
export function signState(uid: string) {
  const body = Buffer.from(JSON.stringify({ uid, exp: Date.now() + 10 * 60_000 })).toString("base64url");
  return `${body}.${crypto.createHmac("sha256", secret()).update(body).digest("base64url")}`;
}
export function verifyState(state: string | null) {
  if (!state) return false;
  const [body, sig] = state.split(".");
  const ok = sig && crypto.createHmac("sha256", secret()).update(body).digest("base64url") === sig;
  try { return !!ok && JSON.parse(Buffer.from(body, "base64url").toString()).exp > Date.now(); } catch { return false; }
}

/* ---- OAuth ---- */
export const authorizeUrl = (state: string) =>
  `${OAUTH}/authorize?response_type=code&client_id=${encodeURIComponent(process.env.ANAF_CLIENT_ID!)}&redirect_uri=${encodeURIComponent(process.env.ANAF_REDIRECT_URI!)}&token_content_type=jwt&state=${encodeURIComponent(state)}`;

async function tokenCall(params: Record<string, string>) {
  const basic = Buffer.from(`${process.env.ANAF_CLIENT_ID}:${process.env.ANAF_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(`${OAUTH}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${basic}` },
    body: new URLSearchParams({ ...params, token_content_type: "jwt" }),
  });
  const j: any = await res.json().catch(() => ({}));
  if (!res.ok || !j.access_token) throw new Error(`ANAF token error: ${j.error_description || j.error || res.status}`);
  return j;
}
async function saveTokens(j: any) {
  const jwtExp = (t: string) => { try { return JSON.parse(Buffer.from(t.split(".")[1], "base64url").toString()).exp * 1000; } catch { return 0; } };
  const now = Date.now();
  await db().from("airmidi_anaf_tokens").upsert({
    id: 1, access_token: j.access_token, refresh_token: j.refresh_token,
    expires_at: new Date(jwtExp(j.access_token) || now + 80 * 864e5).toISOString(),
    refresh_expires_at: new Date(j.refresh_token ? jwtExp(j.refresh_token) || now + 360 * 864e5 : now).toISOString(),
    updated_at: new Date().toISOString(),
  });
}
export const exchangeCode = async (code: string) =>
  saveTokens(await tokenCall({ grant_type: "authorization_code", code, redirect_uri: process.env.ANAF_REDIRECT_URI! }));

export async function connected() {
  const { data } = await db().from("airmidi_anaf_tokens").select("access_token,refresh_expires_at").eq("id", 1).maybeSingle();
  return !!data?.access_token && (!data.refresh_expires_at || new Date(data.refresh_expires_at).getTime() > Date.now());
}
export async function accessToken(): Promise<string> {
  const { data } = await db().from("airmidi_anaf_tokens").select("*").eq("id", 1).maybeSingle();
  if (!data?.access_token) throw new Error("ANAF is not connected. Press “Connect ANAF” first.");
  if (new Date(data.expires_at).getTime() - Date.now() > 3 * 864e5) return data.access_token;
  const j = await tokenCall({ grant_type: "refresh_token", refresh_token: data.refresh_token });
  await saveTokens({ refresh_token: data.refresh_token, ...j });
  return j.access_token;
}

/* ---- e-Factura calls ---- */
const attr = (xml: string, name: string) => xml.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? null;
export async function upload(xml: string, cif: string) {
  const tok = await accessToken();
  const res = await fetch(`${API}/upload?standard=UBL&cif=${cif}`, { method: "POST", headers: { Authorization: `Bearer ${tok}`, "Content-Type": "text/plain" }, body: xml });
  const text = await res.text();
  const id = attr(text, "index_incarcare");
  if (!res.ok || !id) throw new Error(attr(text, "errorMessage") || `ANAF upload failed (${res.status}).`);
  return id;
}
export async function status(id: string) {
  const tok = await accessToken();
  const res = await fetch(`${API}/stareMesaj?id_incarcare=${id}`, { headers: { Authorization: `Bearer ${tok}` } });
  const text = await res.text();
  if (!res.ok) throw new Error(attr(text, "errorMessage") || `ANAF status failed (${res.status}).`);
  return { stare: attr(text, "stare") || "", download: attr(text, "id_descarcare"), message: attr(text, "errorMessage") };
}

/* ---- UBL 2.1 / CIUS-RO builder (NOT validated against ANAF yet: test it in the TEST environment first) ---- */
const x = (v: any) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c] as string));
const m2 = (n: number) => (Math.round((Number(n) + Number.EPSILON) * 100) / 100).toFixed(2);
const digits = (s: string) => String(s || "").replace(/\D/g, "");
const county = (c: string) => { const v = String(c || "").toUpperCase().trim(); return v.startsWith("RO-") ? v : v ? `RO-${v}` : ""; };

export function buildUbl(inv: any, s: any) {
  if (inv.status !== "issued" || inv.storno_of) throw new Error("Only normal issued invoices can be sent for now (storno / credit notes are not supported yet).");
  if (s.vat_payer === false) throw new Error("Sending invoices of non-VAT payers is not supported yet.");
  const c = inv.customer || {};
  const cur = inv.currency;
  const amt = (n: number) => `<cbc:__ currencyID="${x(cur)}">${m2(n)}</cbc:__>`;
  const party = (p: any, supplier: boolean) => {
    const cui = digits(p.cui);
    const vat = supplier || /^RO/i.test(String(p.cui || "")) ? `<cac:PartyTaxScheme><cbc:CompanyID>RO${cui}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>` : "";
    return `<cac:Party><cac:PostalAddress><cbc:StreetName>${x(p.address)}</cbc:StreetName><cbc:CityName>${x(p.city)}</cbc:CityName>${p.county ? `<cbc:CountrySubentity>${x(county(p.county))}</cbc:CountrySubentity>` : ""}<cac:Country><cbc:IdentificationCode>${x(p.country || "RO")}</cbc:IdentificationCode></cac:Country></cac:PostalAddress>${vat}<cac:PartyLegalEntity><cbc:RegistrationName>${x(p.name)}</cbc:RegistrationName>${cui ? `<cbc:CompanyID>${cui}</cbc:CompanyID>` : ""}</cac:PartyLegalEntity></cac:Party>`;
  };
  const cat = (r: number) => (r > 0 ? "S" : "Z");
  const groups: Record<string, { net: number; vat: number; rate: number }> = {};
  for (const l of inv.lines) { const g = (groups[l.vat_rate] ??= { net: 0, vat: 0, rate: Number(l.vat_rate) }); g.net += Number(l.net); g.vat += Number(l.vat); }
  const subs = Object.values(groups).map((g) => `<cac:TaxSubtotal>${amt(g.net).replace(/__/g, "TaxableAmount")}${amt(g.vat).replace(/__/g, "TaxAmount")}<cac:TaxCategory><cbc:ID>${cat(g.rate)}</cbc:ID><cbc:Percent>${g.rate}</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal>`).join("");
  const lines = inv.lines.map((l: any, i: number) =>
    `<cac:InvoiceLine><cbc:ID>${i + 1}</cbc:ID><cbc:InvoicedQuantity unitCode="C62">${l.qty}</cbc:InvoicedQuantity>${amt(l.net).replace(/__/g, "LineExtensionAmount")}<cac:Item><cbc:Name>${x(l.desc)}</cbc:Name><cac:ClassifiedTaxCategory><cbc:ID>${cat(Number(l.vat_rate))}</cbc:ID><cbc:Percent>${l.vat_rate}</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:ClassifiedTaxCategory></cac:Item><cac:Price><cbc:PriceAmount currencyID="${x(cur)}">${Number(l.unit_price).toFixed(4)}</cbc:PriceAmount></cac:Price></cac:InvoiceLine>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"><cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:efactura.mfinante.ro:CIUS-RO:1.0.1</cbc:CustomizationID><cbc:ID>${x(inv.series)}-${String(inv.number).padStart(5, "0")}</cbc:ID><cbc:IssueDate>${inv.issue_date}</cbc:IssueDate>${inv.due_date ? `<cbc:DueDate>${inv.due_date}</cbc:DueDate>` : ""}<cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>${inv.notes ? `<cbc:Note>${x(inv.notes)}</cbc:Note>` : ""}<cbc:DocumentCurrencyCode>${x(cur)}</cbc:DocumentCurrencyCode><cac:AccountingSupplierParty>${party(s, true)}</cac:AccountingSupplierParty><cac:AccountingCustomerParty>${party(c, false)}</cac:AccountingCustomerParty>${s.iban ? `<cac:PaymentMeans><cbc:PaymentMeansCode>30</cbc:PaymentMeansCode><cac:PayeeFinancialAccount><cbc:ID>${x(s.iban)}</cbc:ID></cac:PayeeFinancialAccount></cac:PaymentMeans>` : ""}<cac:TaxTotal>${amt(inv.vat_total).replace(/__/g, "TaxAmount")}${subs}</cac:TaxTotal><cac:LegalMonetaryTotal>${amt(inv.subtotal).replace(/__/g, "LineExtensionAmount")}${amt(inv.subtotal).replace(/__/g, "TaxExclusiveAmount")}${amt(inv.total).replace(/__/g, "TaxInclusiveAmount")}${amt(inv.total).replace(/__/g, "PayableAmount")}</cac:LegalMonetaryTotal>${lines}</Invoice>`;
}
export const sellerCif = (s: any) => digits(s.cui);