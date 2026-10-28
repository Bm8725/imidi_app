// app/api/anaf/[action]/route.ts — server routes: connect · callback · send · status
import { NextResponse } from "next/server";
import * as A from "@/lib/anaf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

// ANAF redirects here after the certificate login
export async function GET(req: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  if (action !== "callback") return fail("Not found", 404);
  const u = new URL(req.url);
  const back = (v: string) => NextResponse.redirect(new URL(`/admin?anaf=${v}`, req.url));
  try {
    const code = u.searchParams.get("code");
    if (!code || !A.verifyState(u.searchParams.get("state"))) return back("error");
    await A.exchangeCode(code);
    return back("connected");
  } catch {
    return back("error");
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  const me = await A.caller(req);
  if (!me) return fail("Not allowed.", 403);
  const body = await req.json().catch(() => ({}));

  try {
    if (action === "connect") {
      const isConnected = await A.connected();
      if (body.check) return NextResponse.json({ connected: isConnected });
      if (me.role !== "owner") return fail("Only the owner can connect ANAF.", 403);
      return NextResponse.json({ connected: isConnected, url: A.authorizeUrl(A.signState(me.id)) });
    }

    const sb = A.db();
    const { data: inv } = await sb.from("airmidi_invoices").select("*").eq("id", body.invoice_id).maybeSingle();
    if (!inv) return fail("Invoice not found.", 404);

    if (action === "send") {
      if (["uploaded", "accepted"].includes(inv.efactura_status)) return fail("This invoice was already sent.");
      const { data: s } = await sb.from("airmidi_invoice_settings").select("*").eq("id", 1).maybeSingle();
      if (!s?.cui) return fail("Fill in your company CUI in the invoice settings first.");
      const xml = A.buildUbl(inv, s);
      const uploadId = await A.upload(xml, A.sellerCif(s));
      await sb.from("airmidi_invoices").update({ efactura_status: "uploaded", efactura_upload_id: uploadId, efactura_xml: xml, efactura_sent_at: new Date().toISOString(), efactura_message: null }).eq("id", inv.id);
      return NextResponse.json({ message: `Sent to ANAF (upload ${uploadId}). Check the status in a minute.` });
    }

    if (action === "status") {
      if (!inv.efactura_upload_id) return fail("This invoice was not sent yet.");
      const r = await A.status(inv.efactura_upload_id);
      const st = r.stare === "ok" ? "accepted" : r.stare === "nok" ? "rejected" : r.stare ? "uploaded" : "error";
      await sb.from("airmidi_invoices").update({ efactura_status: st, efactura_download_id: r.download, efactura_message: r.message }).eq("id", inv.id);
      return NextResponse.json({ message: r.stare === "ok" ? "Accepted by ANAF." : r.stare === "nok" ? "Rejected by ANAF (download the answer in SPV to see why)." : "Still processing at ANAF." });
    }
    return fail("Unknown action.", 404);
  } catch (e: any) {
    return fail(e?.message || "ANAF request failed.", 502);
  }
}