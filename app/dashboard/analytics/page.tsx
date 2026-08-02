import { createClient } from "@supabase/supabase-js";

/**
 * app/admin/analytics/page.tsx
 * Folosește DOAR tabelele din sessions-schema.sql 
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
        .limit(1000) as unknown as Promise<{ data: SessionSummary[] | null; error: unknown }>,

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


//***************** flags country ************* */
function getCountryCode(countryName: string): string | null {
  if (!countryName || countryName === "necunoscut" || countryName === "—") return null;
  
  const name = countryName.trim().toLowerCase();

  const countryMap: Record<string, string> = {
    "romania": "ro",
    "românia": "ro",
    "ro": "ro",
    "united states": "us",
    "united states of america": "us",
    "usa": "us",
    "us": "us",
    "moldova": "md",
    "md": "md",
    "united kingdom": "gb",
    "uk": "gb",
    "gb": "gb",
    "germany": "de",
    "germania": "de",
    "de": "de",
    "france": "fr",
    "franța": "fr",
    "fr": "fr",
    "italy": "it",
    "italia": "it",
    "it": "it",
    "spain": "es",
    "spania": "es",
    "es": "es",
    "netherlands": "nl",
    "olanda": "nl",
    "nl": "nl",
    "austria": "at",
    "at": "at",
    "belgium": "be",
    "belgia": "be",
    "be": "be"
  };

  return countryMap[name] || null;
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
          <p className="text-sm text-zinc-500 mt-1">Last 30 days, from sessions and session_events.</p>
        </header>

        {/* --- Sumar rapid --- */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="border border-zinc-100 rounded-xl p-4">
            <div className="text-[10px] uppercase tracking-wider text-zinc-400">Pageviews</div>
            <div className="text-xl font-semibold mt-1">{totalViews30d.toLocaleString()}</div>
          </div>
          <div className="border border-zinc-100 rounded-xl p-4">
            <div className="text-[10px] uppercase tracking-wider text-zinc-400">Sessions</div>
            <div className="text-xl font-semibold mt-1">{totalSessions.toLocaleString()}</div>
          </div>
          <div className="border border-zinc-100 rounded-xl p-4">
            <div className="text-[10px] uppercase tracking-wider text-zinc-400">Average duration</div>
            <div className="text-xl font-semibold mt-1">{formatDuration(avgDuration)}</div>
          </div>
          <div className="border border-zinc-100 rounded-xl p-4">
            <div className="text-[10px] uppercase tracking-wider text-zinc-400">Logged in / Anonymous</div>
            <div className="text-xl font-semibold mt-1">
              {loggedInSessions} <span className="text-zinc-300">/</span> {anonymousSessions}
            </div>
          </div>
        </section>

        {/* --- Trafic zilnic (Stripe Indigo-Purple Style) --- */}
        <section className="bg-white border border-zinc-200/70 rounded-2xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.01)] space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Pageviews / Day
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">Traffic evolution within 30 days</p>
            </div>
            {/* Badge în stil Stripe */}
            <div className="flex items-center gap-1.5 text-xs text-zinc-600 font-semibold bg-indigo-50/50 border border-indigo-100/60 px-2.5 py-1 rounded-lg">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />
              Peak: <span className="font-bold text-indigo-950">{maxDaily.toLocaleString()}</span>
            </div>
          </div>

          <div className="relative pt-4">
            {/* Linii de ghidaj orizontale specifice dashboard-urilor financiare */}
            <div className="absolute inset-x-0 top-4 border-t border-dashed border-zinc-100 pointer-events-none" />
            <div className="absolute inset-x-0 bottom-7 border-t border-zinc-100 pointer-events-none" />

            {/* Containerul graficului cu bare */}
            <div className="flex items-end gap-1 sm:gap-1.5 h-28 pb-7">
              {dailyEntries.map(([day, count]) => {
                const heightPercent = maxDaily > 0 ? (count / maxDaily) * 100 : 0;
                const [, month, dateStr] = day.split("-");
                const shortDate = `${dateStr}/${month}`;

                return (
                  <div key={day} className="flex-1 flex flex-col items-center group h-full justify-end relative">
                    
                    {/* Tooltip Premium Floating (Stripe Dark Theme) */}
                    <div className="absolute bottom-full mb-2 bg-zinc-900 text-white text-[10px] font-medium px-2.5 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 transform translate-y-1 group-hover:translate-y-0 shadow-[0_4px_12px_rgba(0,0,0,0.15)] z-30 whitespace-nowrap border border-zinc-800">
                      <span className="text-indigo-400 font-bold">{count}</span> vizualizări
                      <div className="text-[9px] text-zinc-400 font-normal mt-0.5">{day}</div>
                      {/* Săgeata tooltip-ului */}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-900" />
                    </div>

                    {/* Bara graficului cu Gradient Stripe Indigo -> Violet */}
                    <div
                      style={{ height: `${Math.max(4, heightPercent)}%` }} // Minim 4% pentru design continuu
                      className={`w-full rounded-t-[3px] transition-all duration-300 relative overflow-hidden ${
                        count > 0 
                          ? "bg-gradient-to-t from-indigo-600 via-indigo-500 to-purple-500 group-hover:from-indigo-700 group-hover:to-purple-600 group-hover:shadow-[0_0_12px_rgba(99,102,241,0.4)]" 
                          : "bg-zinc-100 group-hover:bg-zinc-200"
                      }`}
                    />

                    {/* Axa X: Data sub bară */}
                    <span className="absolute bottom-0 text-[8px] font-semibold text-zinc-400 opacity-0 group-hover:opacity-100 sm:opacity-100 tracking-tighter mt-1 transition-opacity whitespace-nowrap group-hover:text-indigo-600">
                      {shortDate}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {dailyEntries.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 border border-dashed border-zinc-200 rounded-xl bg-zinc-50/50">
              <p className="text-xs text-zinc-400 font-medium">No data yet.</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">Baza de date este goală sau tracker-ul nu a trimis evenimente în ultimele 30 de zile.</p>
            </div>
          )}
        </section>


        {/* --- Top pagini (Design UX îmbunătățit cu Linkuri) --- */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              Most pages visited
            </h2>
            <span className="text-[10px] font-medium text-zinc-400">Views</span>
          </div>

          <div className="space-y-2">
            {topPaths.map(([path, count]) => {
              // Calculăm procentul relativ față de cea mai vizitată pagină din listă
              const maxViews = topPaths[0]?.[1] || 1;
              const percentage = (count / maxViews) * 100;

              return (
                <div 
                  key={path} 
                  className="group relative flex items-center justify-between p-2.5 rounded-xl border border-zinc-100 bg-white hover:border-[#FF7A1A]/20 hover:shadow-xs transition-all duration-200 overflow-hidden"
                >
                  {/* Bară de progres fină pe fundal */}
                  <div 
                    className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-[#FF7A1A]/4 to-[#ff9f54]/2 pointer-events-none transition-all duration-300"
                    style={{ width: `${percentage}%` }}
                  />

                  {/* Linkul către pagină */}
                  <div className="flex items-center gap-2 z-10 min-w-0 flex-1">
                    <span className="text-xs text-zinc-300 group-hover:text-[#FF7A1A] transition-colors shrink-0">🔗</span>
                    <a 
                      href={path} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-xs font-medium text-zinc-700 hover:text-zinc-950 group-hover:text-[#FF7A1A] transition-colors truncate max-w-[85%] md:max-w-[90%]"
                    >
                      {path}
                    </a>
                  </div>

                  {/* Numărul de vizualizări */}
                  <span className="text-xs font-semibold text-zinc-500 group-hover:text-zinc-900 tabular-nums z-10 shrink-0 ml-3 bg-zinc-50 px-2 py-0.5 rounded-md border border-zinc-100 group-hover:border-[#FF7A1A]/10 transition-colors">
                    {count.toLocaleString()}
                  </span>
                </div>
              );
            })}

            {topPaths.length === 0 && (
              <p className="text-xs text-zinc-400 py-4 text-center border border-dashed border-zinc-200 rounded-xl">
                No data yet.
              </p>
            )}
          </div>
        </section>


        {/* --- Țări (Design UX Premium cu imagini de steaguri HD) --- */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              Sessions by country
            </h2>
            <span className="text-[10px] font-medium text-zinc-400">Sessions</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {countryCounts.map(([country, count]) => {
              const percentage = (count / maxCountry) * 100;
              const isoCode = getCountryCode(country);
              const isUnknown = !isoCode;

              return (
                <div 
                  key={country} 
                  className="group relative flex items-center justify-between p-3 rounded-xl border border-zinc-100 bg-white hover:border-indigo-500/20 hover:shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition-all duration-200 overflow-hidden"
                >
                  {/* Bară de progres discretă în stil Stripe */}
                  <div 
                    className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-zinc-100/50 to-zinc-50/20 pointer-events-none transition-all duration-300 group-hover:from-indigo-500/5"
                    style={{ width: `${percentage}%` }}
                  />

                  {/* Numele țării și Drapelul HD */}
                  <div className="flex items-center gap-3 z-10 min-w-0">
                    {!isUnknown ? (
                      /* Randeri steag HD din CDN */
                      <img
                        src={`https://flagcdn.com{isoCode}.png`}
                        srcSet={`https://flagcdn.com{isoCode}.png 2x`}
                        width="20"
                        alt={country}
                        className="rounded-sm shadow-xs border border-zinc-200/60 object-cover aspect-[4/3] shrink-0"
                      />
                    ) : (
                      /* Iconiță de fallback dacă e localhost */
                      <span className="text-sm shrink-0">🌐</span>
                    )}
                    <span className="text-xs font-semibold uppercase text-zinc-700 tracking-wider truncate">
                      {isUnknown ? "Localhost / Unknown" : country}
                    </span>
                  </div>

                  {/* Numărul de sesiuni + Procentaj */}
                  <div className="flex items-center gap-2 z-10 shrink-0">
                    <span className="text-[10px] text-zinc-400 font-medium bg-zinc-50 border border-zinc-100 group-hover:border-indigo-500/10 px-1.5 py-0.5 rounded-md transition-colors">
                      {Math.round(percentage)}%
                    </span>
                    <span className="text-xs font-bold text-zinc-800 tabular-nums bg-zinc-950 text-white px-2 py-0.5 rounded-md group-hover:bg-indigo-600 transition-colors">
                      {count}
                    </span>
                  </div>
                </div>
              );
            })}

            {countryCounts.length === 0 && (
              <div className="col-span-full p-6 text-center border border-dashed border-zinc-200 rounded-xl bg-zinc-50/30">
                <p className="text-xs text-zinc-400 font-medium">No country data yet.</p>
              </div>
            )}
          </div>
        </section>



        {/* --- Sesiuni recente --- */}
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">
              Recent Sessions
            </h2>
            <a href="/dashboard/session" className="text-xs text-blue-500 underline">
              → SEE ALL →
            </a>
          </div>
          <div className="border border-zinc-100 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-[11px] uppercase tracking-wider text-zinc-400">
                <tr>
                  <th className="text-left px-4 py-2">Visitor</th>
                  <th className="text-left px-4 py-2">Entry</th>
                  <th className="text-left px-4 py-2">Country</th>
                  <th className="text-right px-4 py-2">Duration</th>
                  <th className="text-right px-4 py-2">Pages</th>
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
                            <td className="px-5 py-3.5 text-zinc-500 truncate max-w-[180px]">
                            {s.first_path ? (
                                <a 
                                href={s.first_path} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-[#FF7A1A] hover:underline font-medium"
                                >
                                {s.first_path}
                                </a>
                            ) : (
                                "—"
                            )}
                            </td>

                    <td className="px-4 py-2.5 text-zinc-500">{s.country ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right">{formatDuration(s.duration_seconds)}</td>
                    <td className="px-4 py-2.5 text-right">{s.pageview_count}</td>
                  </tr>
                ))}
                {(!summaries || summaries.length === 0) && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-zinc-400 text-xs">
                      No sessions yet.
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