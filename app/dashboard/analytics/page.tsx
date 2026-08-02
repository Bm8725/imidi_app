import { createClient } from "@supabase/supabase-js";

/**
 * app/admin/analytics/page.tsx
 * Server Component — citește direct din Supabase via RPC-urile din
 * analytics-schema.sql. Pune-o în spatele autentificării de admin
 * pe care o ai deja (nu am adăugat auth aici, presupun că ruta e
 * deja protejată de un layout/middleware de admin).
 */

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

type VitalsRow = { path: string; metric: string; p75_value: number; sample_count: number };
type TrafficRow = { day: string; views: number };

// Praguri oficiale Core Web Vitals (pentru "good"), în aceleași unități ca metric.value
const THRESHOLDS: Record<string, { good: number; unit: string }> = {
  LCP: { good: 2500, unit: "ms" },
  CLS: { good: 0.1, unit: "" },
  INP: { good: 200, unit: "ms" },
  FCP: { good: 1800, unit: "ms" },
  TTFB: { good: 800, unit: "ms" },
};

function formatValue(metric: string, value: number) {
  const unit = THRESHOLDS[metric]?.unit ?? "";
  if (metric === "CLS") return value.toFixed(3);
  return `${Math.round(value)}${unit}`;
}

function statusColor(metric: string, value: number) {
  const t = THRESHOLDS[metric];
  if (!t) return "text-zinc-500";
  if (value <= t.good) return "text-emerald-600";
  if (value <= t.good * 2.5) return "text-amber-600"; // aproximare pt "needs improvement"
  return "text-red-600";
}

export default async function AnalyticsPage() {
  const supabase = getSupabase();

  const [{ data: vitals, error: vitalsError }, { data: traffic, error: trafficError }] =
    await Promise.all([
      supabase.rpc("web_vitals_p75", { days_back: 7 }) as unknown as Promise<{
        data: VitalsRow[] | null;
        error: unknown;
      }>,
      supabase.rpc("daily_pageviews", { days_back: 30 }) as unknown as Promise<{
        data: TrafficRow[] | null;
        error: unknown;
      }>,
    ]);

  if (vitalsError) console.error("Eroare vitals:", vitalsError);
  if (trafficError) console.error("Eroare trafic:", trafficError);

  const totalViews30d = (traffic ?? []).reduce((sum, r) => sum + Number(r.views), 0);
  const maxDailyViews = Math.max(1, ...(traffic ?? []).map((r) => Number(r.views)));

  // grupăm vitals pe path pentru afișare tabelară
  const byPath = new Map<string, VitalsRow[]>();
  for (const row of vitals ?? []) {
    const list = byPath.get(row.path) ?? [];
    list.push(row);
    byPath.set(row.path, list);
  }

  return (
    <div className="min-h-screen bg-white px-6 py-12 md:py-16 font-sans text-zinc-900">
      <div className="max-w-4xl mx-auto space-y-12">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Core Web Vitals (p75, ultimele 7 zile) și trafic (ultimele 30 zile).
          </p>
        </header>

        {/* --- Trafic --- */}
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">
              Pageviews (30 zile)
            </h2>
            <span className="text-lg font-semibold">{totalViews30d.toLocaleString()}</span>
          </div>

          <div className="flex items-end gap-1 h-24 border-b border-zinc-100 pb-1">
            {(traffic ?? []).map((r) => (
              <div
                key={r.day}
                title={`${r.day}: ${r.views} vizualizări`}
                className="flex-1 bg-zinc-900 rounded-t-sm hover:bg-zinc-700 transition-colors"
                style={{ height: `${(Number(r.views) / maxDailyViews) * 100}%` }}
              />
            ))}
            {(!traffic || traffic.length === 0) && (
              <p className="text-xs text-zinc-400">Fără date încă.</p>
            )}
          </div>
        </section>

        {/* --- Core Web Vitals per pagină --- */}
        <section className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">
            Core Web Vitals per pagină
          </h2>

          {byPath.size === 0 && (
            <p className="text-xs text-zinc-400">
              Fără date încă — verifică dacă VitalsReporter e activ în producție.
            </p>
          )}

          <div className="space-y-2">
            {Array.from(byPath.entries()).map(([path, rows]) => (
              <div
                key={path}
                className="border border-zinc-100 rounded-xl p-4 flex items-center justify-between flex-wrap gap-3"
              >
                <span className="text-sm font-medium text-zinc-800 truncate max-w-[240px]">
                  {path}
                </span>
                <div className="flex gap-4">
                  {rows
                    .sort((a, b) => a.metric.localeCompare(b.metric))
                    .map((r) => (
                      <div key={r.metric} className="text-right">
                        <div className="text-[10px] text-zinc-400 uppercase tracking-wide">
                          {r.metric}
                        </div>
                        <div className={`text-sm font-semibold ${statusColor(r.metric, r.p75_value)}`}>
                          {formatValue(r.metric, r.p75_value)}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}