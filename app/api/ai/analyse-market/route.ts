import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Groq from "groq-sdk";

export async function GET() {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!apiKey || !supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: "Configurare server incompleta." }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // toate anunturile active de pe intreaga platforma (imidi.co.uk/e-market)
    const { data: listings, error } = await supabase
      .from("listings")
      .select("category, price, views_count, country, created_at, expires_at")
      .gt("expires_at", new Date().toISOString());

    if (error) throw error;

    if (!listings || listings.length === 0) {
      return NextResponse.json(
        { error: "Nu exista anunturi active momentan pe piata." },
        { status: 400 }
      );
    }

    // agregam pe categorie
    const categoryStats: Record<string, { count: number; totalPrice: number; totalViews: number }> = {};
    for (const l of listings) {
      if (!categoryStats[l.category]) {
        categoryStats[l.category] = { count: 0, totalPrice: 0, totalViews: 0 };
      }
      categoryStats[l.category].count += 1;
      categoryStats[l.category].totalPrice += Number(l.price) || 0;
      categoryStats[l.category].totalViews += Number(l.views_count) || 0;
    }

    const categoryBreakdown = Object.entries(categoryStats).map(([category, s]) => ({
      category,
      total_listings: s.count,
      avg_price: +(s.totalPrice / s.count).toFixed(2),
      avg_views: +(s.totalViews / s.count).toFixed(1),
    }));

    const totalListings = listings.length;
    const totalViews = listings.reduce((sum, l) => sum + (Number(l.views_count) || 0), 0);
    const avgPriceOverall = +(
      listings.reduce((sum, l) => sum + (Number(l.price) || 0), 0) / totalListings
    ).toFixed(2);

    // anunturi noi in ultimele 7 zile
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const newThisWeek = listings.filter((l) => new Date(l.created_at) > sevenDaysAgo).length;

    // anunturi ce expira in urmatoarele 3 zile
    const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const expiringSoon = listings.filter((l) => new Date(l.expires_at) < threeDaysFromNow).length;

    // top 5 tari (daca exista date de tara completate)
    const countryCounts: Record<string, number> = {};
    for (const l of listings) {
      if (l.country) countryCounts[l.country] = (countryCounts[l.country] || 0) + 1;
    }
    const topCountries = Object.entries(countryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([country, count]) => ({ country, count }));

    const groq = new Groq({ apiKey });

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `Esti un analist care descrie starea generala a pietei de pe iMIDI e-Market (imidi.co.uk/e-market), o platforma de anunturi pentru instrumente muzicale si preseturi.

Primesti date agregate, calculate strict din anunturile active de pe platforma (nu inventa nimic in afara lor):
- total anunturi active, total vizualizari, pret mediu general
- distributia pe categorii (instrument vs preset): numar anunturi, pret mediu, vizualizari medii
- cate anunturi noi au aparut in ultimele 7 zile
- cate anunturi expira in urmatoarele 3 zile
- top tari dupa numar de anunturi (daca exista date)

REGULI:
- Raspunde in limba romana, ton de raport clar si scurt, NU conversational, NU pune intrebari.
- 4-6 propozitii: starea generala a pietei (cate anunturi, ce categorie domina), pretul mediu pe categorie, activitate recenta (anunturi noi, anunturi care expira), si o observatie utila daca reiese ceva clar din date.
- Nu inventa cifre care nu apar in date primite.
- Text simplu, fara markdown, fara liste cu bullet-uri.`,
        },
        {
          role: "user",
          content: `Total anunturi active: ${totalListings}
Total vizualizari: ${totalViews}
Pret mediu general: ${avgPriceOverall} EUR
Distributie pe categorii: ${JSON.stringify(categoryBreakdown)}
Anunturi noi in ultimele 7 zile: ${newThisWeek}
Anunturi ce expira in urmatoarele 3 zile: ${expiringSoon}
Top tari: ${JSON.stringify(topCountries)}`,
        },
      ],
      max_tokens: 400,
      temperature: 0.4,
    });

    const analysis = response.choices?.[0]?.message?.content || "Nu am putut genera analiza.";

    return NextResponse.json({
      analysis,
      totalListings,
      totalViews,
      avgPriceOverall,
      categoryBreakdown,
      newThisWeek,
      expiringSoon,
      topCountries,
    });
  } catch (error: any) {
    console.error("analyze-market error:", error);
    return NextResponse.json({ error: error?.message || "Eroare interna." }, { status: 500 });
  }
}