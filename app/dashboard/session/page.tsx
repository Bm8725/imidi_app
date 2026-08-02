import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

/**
 * app/dashboard/session/page.tsx
 * Folosește session_summaries (deja există în DB-ul tău).
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

function formatDuration(seconds: number) {
  if (!seconds || seconds < 60) return `${Math.round(seconds || 0)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "acum";
  if (mins < 60) return `acum ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `acum ${hrs}h`;
  return `acum ${Math.floor(hrs / 24)}z`;
}

function deviceIcon(device: string | null) {
  if (device === "mobile") return "📱";
  if (device === "tablet") return "💻";
  return "🖥️";
}

export default async function SessionsPage() {
  const supabase = getSupabase();

  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { data, error } = await supabase
    .from("session_summaries")
    .select("*")
    .gte("started_at", since.toISOString())
    .order("started_at", { ascending: false })
    .limit(100);

  if (error) console.error("Eroare la citirea sesiunilor:", error);

  const sessions = (data as SessionSummary[]) ?? [];
  const total = sessions.length;
  const loggedIn = sessions.filter((s) => s.user_id).length;
  const anonymous = total - loggedIn;
  const avgDuration = total > 0 ? sessions.reduce((s, r) => s + (r.duration_seconds || 0), 0) / total : 0;

  const countryMap = new Map<string, number>();
  for (const s of sessions) {
    const c = s.country ?? "necunoscut";
    countryMap.set(c, (countryMap.get(c) ?? 0) + 1);
  }
  const topCountries = Array.from(countryMap.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6);
  const maxCountry = Math.max(1, ...topCountries.map(([, v]) => v));

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 font-sans text-zinc-900">
      <div className="max-w-5xl mx-auto px-5 sm:px-6 py-8 sm:py-12">
        {/* Back button */}
        <Link
          href="/dashboard/cloud-db"
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-zinc-400 hover:text-zinc-900 uppercase tracking-widest mb-6 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Înapoi la MyCloud
        </Link>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-8">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-zinc-900">
              Sesiuni <span className="bg-gradient-to-r from-[#FF7A1A] to-[#ff9f54] bg-clip-text text-transparent">Live</span>
            </h1>
            <p className="text-sm text-zinc-500 mt-1">Ultimele 30 zile · {total} sesiuni</p>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { label: "Total sesiuni", value: total },
            { label: "Logați", value: loggedIn },
            { label: "Anonimi", value: anonymous },
            { label: "Durată medie", value: formatDuration(avgDuration) },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-white border border-zinc-200/70 rounded-2xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-md hover:border-[#FF7A1A]/30 transition-all"
            >
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                {stat.label}
              </div>
              <div className="text-2xl font-black text-zinc-900 mt-1">{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Countries */}
        {topCountries.length > 0 && (
          <div className="bg-white border border-zinc-200/70 rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] mb-8">
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-4">
              Top țări
            </h2>
            <div className="space-y-2.5">
              {topCountries.map(([country, count]) => (
                <div key={country} className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-zinc-700 w-10 shrink-0">{country}</span>
                  <div className="flex-1 h-2 bg-zinc-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#FF7A1A] to-[#ff9f54] rounded-full"
                      style={{ width: `${(count / maxCountry) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-zinc-400 tabular-nums w-6 text-right">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sessions — desktop table */}
        <div className="hidden sm:block bg-white border border-zinc-200/70 rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50/80 text-[10px] uppercase tracking-wider text-zinc-400 border-b border-zinc-100">
              <tr>
                <th className="text-left px-5 py-3 font-bold">Vizitator</th>
                <th className="text-left px-5 py-3 font-bold">Intrare</th>
                <th className="text-left px-5 py-3 font-bold">Țară</th>
                <th className="text-left px-5 py-3 font-bold">Device</th>
                <th className="text-right px-5 py-3 font-bold">Durată</th>
                <th className="text-right px-5 py-3 font-bold">Pagini</th>
                <th className="text-right px-5 py-3 font-bold">Când</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {sessions.map((s) => (
                <tr key={s.session_id} className="hover:bg-zinc-50/60 transition-colors">
                  <td className="px-5 py-3.5 font-semibold text-zinc-800">
                    {s.user_email ?? (
                      <span className="text-zinc-400 font-normal">
                        Anonim · {s.session_id.slice(0, 8)}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-zinc-500 truncate max-w-[180px]">{s.first_path}</td>
                  <td className="px-5 py-3.5 text-zinc-500">{s.country ?? "—"}</td>
                  <td className="px-5 py-3.5 text-zinc-500">{deviceIcon(s.device)} {s.device ?? "—"}</td>
                  <td className="px-5 py-3.5 text-right text-zinc-700 font-medium">{formatDuration(s.duration_seconds)}</td>
                  <td className="px-5 py-3.5 text-right text-zinc-700">{s.pageview_count}</td>
                  <td className="px-5 py-3.5 text-right text-zinc-400 text-xs">{timeAgo(s.started_at)}</td>
                </tr>
              ))}
              {sessions.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-14 text-center text-zinc-400 text-sm">
                    Fără sesiuni încă.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Sessions — mobile cards */}
        <div className="sm:hidden space-y-3">
          {sessions.map((s) => (
            <div
              key={s.session_id}
              className="bg-white border border-zinc-200/70 rounded-2xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="text-sm font-semibold text-zinc-800 truncate">
                  {s.user_email ?? (
                    <span className="text-zinc-400 font-normal">
                      Anonim · {s.session_id.slice(0, 8)}
                    </span>
                  )}
                </span>
                <span className="text-[10px] text-zinc-400 shrink-0">{timeAgo(s.started_at)}</span>
              </div>
              <p className="text-xs text-zinc-500 truncate mb-3">{s.first_path}</p>
              <div className="flex items-center gap-4 text-[11px] text-zinc-500">
                <span>{deviceIcon(s.device)} {s.device ?? "—"}</span>
                <span>{s.country ?? "—"}</span>
                <span>{formatDuration(s.duration_seconds)}</span>
                <span>{s.pageview_count} pag.</span>
              </div>
            </div>
          ))}
          {sessions.length === 0 && (
            <div className="text-center py-14 text-zinc-400 text-sm bg-white border border-dashed border-zinc-200 rounded-2xl">
              Fără sesiuni încă.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}