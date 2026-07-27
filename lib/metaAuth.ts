/**
 * lib/metaAuth.ts
 * Funcții pentru schimbul tokenului Facebook (de la login) în
 * Page Access Token long-lived, folosit apoi pentru publicare.
 *
 * Env vars necesare:
 * META_APP_ID=...
 * META_APP_SECRET=...
 */

const GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION || "v21.0";
const APP_ID = process.env.META_APP_ID!;
const APP_SECRET = process.env.META_APP_SECRET!;

/**
 * Extinde un User Access Token scurt (obținut la login, valabil ~1-2h)
 * într-unul long-lived (valabil ~60 zile).
 */
export async function exchangeForLongLivedUserToken(shortLivedToken: string): Promise<string> {
  const url = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", APP_ID);
  url.searchParams.set("client_secret", APP_SECRET);
  url.searchParams.set("fb_exchange_token", shortLivedToken);

  const res = await fetch(url.toString());
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || "Nu am putut extinde tokenul Facebook.");
  return data.access_token;
}

export interface FacebookPage {
  id: string;
  name: string;
  access_token: string;
}

/**
 * Ia lista paginilor administrate de user, fiecare cu propriul
 * Page Access Token (long-lived automat, dacă user tokenul e long-lived).
 */
export async function fetchUserPages(longLivedUserToken: string): Promise<FacebookPage[]> {
  const url = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/me/accounts`);
  url.searchParams.set("access_token", longLivedUserToken);
  url.searchParams.set("fields", "id,name,access_token");

  const res = await fetch(url.toString());
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || "Nu am putut obține paginile Facebook.");
  return data.data || [];
}