import { MetadataRoute } from 'next';
import { supabase } from '@/lib/supabase';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const SITE_URL = 'https://imidi.co.uk';

  // 1. SOLUȚIA: Executăm interogările în PARALEL cu Promise.all și limităm la top 5000 pentru performanță
  const [listingsResult, stiriResult] = await Promise.all([
    supabase
      .from('listings')
      .select('id, created_at')
      .order('created_at', { ascending: false })
      .range(0, 4999),
    supabase
      .from('forum_posts')
      .select('id, created_at')
      .order('created_at', { ascending: false })
      .range(0, 4999)
  ]);

  const listings = listingsResult.data || [];
  const stiri = stiriResult.data || [];

  // 2. Generăm link-urile pentru E-Market folosind data reală
  const listingUrls = listings.map((listing) => ({
    url: `${SITE_URL}/e-market/listing/${listing.id}`,
    lastModified: listing.created_at ? new Date(listing.created_at) : new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }));

  // 3. Generăm link-urile pentru Știri folosind data reală
  const stiriUrls = stiri.map((stire) => ({
    url: `${SITE_URL}/stiri?post=${stire.id}`,
    lastModified: stire.created_at ? new Date(stire.created_at) : new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }));

  // 4. Returnăm setul complet (Rutele Statice + Rutele Dinamice)
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/products`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/e-market`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/stiri`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/hub-services`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/airmidi-link`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/sd-writer`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    ...listingUrls,
    ...stiriUrls,
  ];
}
