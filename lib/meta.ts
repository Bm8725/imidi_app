/**
 * lib/meta.ts
 * Funcții pentru publicare pe Facebook Page prin Meta Graph API.
 *
 * IMPORTANT: pageId + pageAccessToken se dau ca parametri, NU mai vin
 * din .env — fiecare user are propria pagină Facebook conectată automat
 * la login (vezi meta_connections + /api/meta/connect).
 */

const GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION || "v21.0";
const BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

type MetaApiResponse = Record<string, any>;

export class MetaApiError extends Error {
  raw: any;
  constructor(raw: any) {
    super(raw?.error?.message || "Meta API error necunoscută");
    this.raw = raw;
  }
}

async function callGraphApi(
  path: string,
  method: "GET" | "POST" = "POST",
  params: Record<string, string> = {}
): Promise<MetaApiResponse> {
  const url = new URL(`${BASE_URL}${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.append(key, value));

  const res = await fetch(url.toString(), { method });
  const data = await res.json();
  if (!res.ok) throw new MetaApiError(data);
  return data;
}

/* ------------------------------------------------------------------ */
/* FACEBOOK              /meta                                         */
/* ------------------------------------------------------------------ */

interface PublishFacebookPostParams {
  pageId: string;
  pageAccessToken: string;
  message: string;
  imageUrl?: string;
  scheduledPublishTime?: number; // unix timestamp (secunde), min. 10 min în viitor
}

/**
 * Publică (sau programează) o postare text/imagine pe pagina de Facebook.
 * - Fără imageUrl -> postare text simplă pe /feed
 * - Cu imageUrl   -> postare cu imagine pe /photos (caption = message)
 * - Cu scheduledPublishTime -> Facebook programează nativ postarea
 */
export async function publishFacebookPost({
  pageId,
  pageAccessToken,
  message,
  imageUrl,
  scheduledPublishTime,
}: PublishFacebookPostParams): Promise<MetaApiResponse> {
  const endpoint = imageUrl ? `/${pageId}/photos` : `/${pageId}/feed`;

  const params: Record<string, string> = {
    access_token: pageAccessToken,
  };

  if (imageUrl) {
    params.url = imageUrl;
    params.caption = message;
  } else {
    params.message = message;
  }

  if (scheduledPublishTime) {
    params.published = "false";
    params.scheduled_publish_time = String(scheduledPublishTime);
  }

  return callGraphApi(endpoint, "POST", params);
}

/**
 * Șterge o postare programată sau publicată de pe pagină.
 */
export async function deleteFacebookPost(
  postId: string,
  pageAccessToken: string
): Promise<MetaApiResponse> {
  return callGraphApi(`/${postId}`, "POST", {
    access_token: pageAccessToken,
    method: "delete",
  });
}

/**
 * Listează postările programate (nepublicate încă) ale paginii.
 */
export async function getScheduledFacebookPosts(
  pageId: string,
  pageAccessToken: string
): Promise<MetaApiResponse> {
  return callGraphApi(`/${pageId}/scheduled_posts`, "GET", {
    access_token: pageAccessToken,
    fields: "id,message,scheduled_publish_time,created_time",
  });
}