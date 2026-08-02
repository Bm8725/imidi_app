import { createClient } from "@supabase/supabase-js";

/**
 * app/admin/analytics/page.tsx
 * Folosește DOAR tabelele din sessions-schema.sql (pe care le ai deja):
 * sessions, session_events, session_summaries. Nu depinde de web_vitals
 * sau page_views — acelea erau dintr-un fișier separat, nefolosit de tine.
 */

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

type SessionSummary = {
  session_id: string;
  user_id: string | null;
  user_email: string | null;
  first_path: string | null;
  referrer: string | null;
  device: string | null;
  country: string | null;
  started_at: string;
  last_seen_at: string;
  duration_seconds: number;
  event_count: number;
  pageview_count: number;
};

type PageviewEvent = { path: string | null; created_at: string };

function dayKey(iso: string) {
  return iso.slice(0, 10); // YYYY-MM-DD
}

export default async function AnalyticsPage() {
  const supabase = getSupabase();

  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [{ data: summaries, error: summariesError }, { data: pageviews, error: pvError }] =
    await Promise.all([
      supabase
        .from("session_summaries")
        .select("*")
        .gte("started_at", since.toISOString())
        .order("started_at", { ascending: false })
        .limit(200) as unknown as Promise<{ data: SessionSummary[] | null; error: unknown }>,

      supabase
        .from("session_events")
        .select("path, created_at")
        .eq("event_name", "pageview")
        .gte("created_at", since.toISOString()) as unknown as Promise<{
        data: PageviewEvent[] | null;
        error: unknown;
      }>,
    ]);

  if (summariesError) console.error("Eroare session_summaries:", summariesError);
  if (pvError) console.error("Eroare session_events:", pvError);

  // trafic zilnic, agregat aici (30 zile, volum mic, nu justifică încă un RPC)
  const dailyCounts = new Map<string, number>();
  for (const ev of pageviews ?? []) {
    const key = dayKey(ev.created_at);
    dailyCounts.set(key, (dailyCounts.get(key) ?? 0) + 1);
  }
  const dailyEntries = Array.from(dailyCounts.entries()).sort(([a], [b]) => a.localeCompare(b));
  const maxDaily = Math.max(1, ...dailyEntries.map(([, v]) => v));
  const totalViews30d = (pageviews ?? []).length;

  // top pagini după nr. de vizualizări
  const pathCounts = new Map<string, number>();
  for (const ev of pageviews ?? []) {
    if (!ev.path) continue;
    pathCounts.set(ev.path, (pathCounts.get(ev.path) ?? 0) + 1);
  }
  const topPaths = Array.from(pathCounts.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8);

  function formatDuration(seconds: number) {
    if (!seconds || seconds < 60) return `${Math.round(seconds || 0)}s`;
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}m ${s}s`;
  }

  const totalSessions = summaries?.length ?? 0;
  const avgDuration =
    totalSessions > 0
      ? (summaries ?? []).reduce((sum, s) => sum + (s.duration_seconds || 0), 0) / totalSessions
      : 0;
  const loggedInSessions = (summaries ?? []).filter((s) => s.user_id).length;
  const anonymousSessions = totalSessions - loggedInSessions;

  // agregare pe țară — country e null pe localhost (header-ul vine doar din Vercel edge)
  const countryMap = new Map<string, number>();
  for (const s of summaries ?? []) {
    const c = s.country ?? "necunoscut";
    countryMap.set(c, (countryMap.get(c) ?? 0) + 1);
  }
  const countryCounts = Array.from(countryMap.entries()).sort(([, a], [, b]) => b - a);
  const maxCountry = Math.max(1, ...countryCounts.map(([, v]) => v));

  return (
    <div className="min-h-screen bg-white px-6 py-12 md:py-16 font-sans text-zinc-900">
      <div className="max-w-4xl mx-auto space-y-12">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="text-sm text-zinc-500 mt-1">Ultimele 30 zile, din sessions + session_events.</p>
        </header>

        {/* --- Sumar rapid --- */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="border border-zinc-100 rounded-xl p-4">
            <div className="text-[10px] uppercase tracking-wider text-zinc-400">Pageviews</div>
            <div className="text-xl font-semibold mt-1">{totalViews30d.toLocaleString()}</div>
          </div>
          <div className="border border-zinc-100 rounded-xl p-4">
            <div className="text-[10px] uppercase tracking-wider text-zinc-400">Sesiuni</div>
            <div className="text-xl font-semibold mt-1">{totalSessions.toLocaleString()}</div>
          </div>
          <div className="border border-zinc-100 rounded-xl p-4">
            <div className="text-[10px] uppercase tracking-wider text-zinc-400">Durată medie</div>
            <div className="text-xl font-semibold mt-1">{formatDuration(avgDuration)}</div>
          </div>
          <div className="border border-zinc-100 rounded-xl p-4">
            <div className="text-[10px] uppercase tracking-wider text-zinc-400">Logați / Anonimi</div>
            <div className="text-xl font-semibold mt-1">
              {loggedInSessions} <span className="text-zinc-300">/</span> {anonymousSessions}
            </div>
          </div>
        </section>

        {/* --- Trafic zilnic --- */}
        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">
            Pageviews / zi
          </h2>
          <div className="flex items-end gap-1 h-24 border-b border-zinc-100 pb-1">
            {dailyEntries.map(([day, count]) => (
              <div
                key={day}
                title={`${day}: ${count} vizualizări`}
                className="flex-1 bg-zinc-900 rounded-t-sm hover:bg-zinc-700 transition-colors"
                style={{ height: `${(count / maxDaily) * 100}%` }}
              />
            ))}
            {dailyEntries.length === 0 && (
              <p className="text-xs text-zinc-400">
                Fără date încă — verifică dacă SessionTracker e activ în producție.
              </p>
            )}
          </div>
        </section>

        {/* --- Top pagini --- */}
        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">
            Pagini cele mai vizitate
          </h2>
          <div className="space-y-1.5">
            {topPaths.map(([path, count]) => (
              <div key={path} className="flex items-center justify-between text-sm">
                <span className="text-zinc-700 truncate max-w-[300px]">{path}</span>
                <span className="text-zinc-400 tabular-nums">{count}</span>
              </div>
            ))}
            {topPaths.length === 0 && <p className="text-xs text-zinc-400">Fără date încă.</p>}
          </div>
        </section>

        {/* --- Țări --- */}
        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">
            Sesiuni după țară
          </h2>
          <div className="space-y-1.5">
            {countryCounts.map(([country, count]) => (
              <div key={country} className="flex items-center gap-3">
                <span className="text-sm text-zinc-700 w-10 shrink-0">{country}</span>
                <div className="flex-1 h-2 bg-zinc-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-zinc-900"
                    style={{ width: `${(count / maxCountry) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-zinc-400 tabular-nums w-8 text-right">{count}</span>
              </div>
            ))}
            {countryCounts.length === 0 && (
              <p className="text-xs text-zinc-400">
                Fără date de țară încă — pe localhost header-ul x-vercel-ip-country lipsește,
                apare doar în producție pe Vercel.
              </p>
            )}
          </div>
        </section>

        {/* --- Sesiuni recente --- */}
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">
              Sesiuni recente
            </h2>
            <a href="/dashboard/sessions" className="text-xs text-zinc-500 underline">
              vezi toate →
            </a>
          </div>
          <div className="border border-zinc-100 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-[11px] uppercase tracking-wider text-zinc-400">
                <tr>
                  <th className="text-left px-4 py-2">Vizitator</th>
                  <th className="text-left px-4 py-2">Intrare</th>
                  <th className="text-left px-4 py-2">Țară</th>
                  <th className="text-right px-4 py-2">Durată</th>
                  <th className="text-right px-4 py-2">Pagini</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {(summaries ?? []).slice(0, 10).map((s) => (
                  <tr key={s.session_id} className="hover:bg-zinc-50/50">
                    <td className="px-4 py-2.5 font-medium">
                      {s.user_email ?? (
                        <span className="text-zinc-400 font-normal">
                          Anonim · {s.session_id.slice(0, 8)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-zinc-600 truncate max-w-[200px]">
                      {s.first_path}
                    </td>
                    <td className="px-4 py-2.5 text-zinc-500">{s.country ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right">{formatDuration(s.duration_seconds)}</td>
                    <td className="px-4 py-2.5 text-right">{s.pageview_count}</td>
                  </tr>
                ))}
                {(!summaries || summaries.length === 0) && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-zinc-400 text-xs">
                      Fără sesiuni încă.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}