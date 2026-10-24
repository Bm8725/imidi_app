import { MetadataRoute } from 'next';
import { supabase } from '@/lib/supabase';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const SITE_URL = 'https://imidi.co.uk';

  // 1. Luăm toate ID-urile active din tabela listings (E-Market)
  const { data: listings } = await supabase
    .from('listings')
    .select('id')
    .order('created_at', { ascending: false });

  // 2. Luăm toate ID-urile active din tabela forum_posts (Știri)
  const { data: stiri } = await supabase
    .from('forum_posts')
    .select('id')
    .order('created_at', { ascending: false });

  // Generăm link-urile pentru E-Market
  const listingUrls = (listings || []).map((listing) => ({
    url: `${SITE_URL}/e-market/listing/${listing.id}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }));

  // Generăm link-urile individuale pentru Știri (?post=id)
  const stiriUrls = (stiri || []).map((stire) => ({
    url: `${SITE_URL}/stiri?post=${stire.id}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }));

  // 3. Returnăm tot setul completat
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
    ...stiriUrls, // 
  ];
}
