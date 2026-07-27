/**
 * 
 * SEO GOOGLE, bots, automated, advanced SEO systems
 *  */ 


import { MetadataRoute } from 'next';
import { supabase } from '@/lib/supabase';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const SITE_URL = 'https://imidi.co.uk';

  // 1. Luăm toate ID-urile active din tabela listings din Supabase
  const { data: listings } = await supabase
    .from('listings')
    .select('id')
    .order('created_at', { ascending: false });

  // 2. Generăm link-urile de share pentru fiecare anunț
  const listingUrls = (listings || []).map((listing) => ({
    url: `${SITE_URL}/e-market/listing/${listing.id}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }));

  // 3. 
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
    ...listingUrls, // 
  ];
}
