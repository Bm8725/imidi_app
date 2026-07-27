/**
 * lib/meta.ts
 * Funcții pentru publicare pe Facebook Page prin Meta Graph API.
 *
 * Env vars necesare (.env.local):
 * META_PAGE_ID=...
 * META_PAGE_ACCESS_TOKEN=...        (long-lived page token)
 * META_GRAPH_API_VERSION=v21.0      (sau ultima versiune stabilă)
 */

const GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION || "v21.0";
const BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

const PAGE_ID = process.env.META_PAGE_ID!;
const PAGE_ACCESS_TOKEN = process.env.META_PAGE_ACCESS_TOKEN!;

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
/* FACEBOOK                                                            */
/* ------------------------------------------------------------------ */

interface PublishFacebookPostParams {
  message: string;
  imageUrl?: string;              // opțional - postare cu imagine unică
  scheduledPublishTime?: number;  // unix timestamp (secunde), min. 10 min în viitor
}

/**
 * Publică (sau programează) o postare text/imagine pe pagina de Facebook.
 * - Fără imageUrl -> postare text simplă pe /feed
 * - Cu imageUrl   -> postare cu imagine pe /photos (caption = message)
 * - Cu scheduledPublishTime -> Facebook programează nativ postarea
 *   (published=false + scheduled_publish_time), fără să fie nevoie
 *   de cron propriu pentru Facebook.
 */
export async function publishFacebookPost({
  message,
  imageUrl,
  scheduledPublishTime,
}: PublishFacebookPostParams): Promise<MetaApiResponse> {
  const endpoint = imageUrl ? `/${PAGE_ID}/photos` : `/${PAGE_ID}/feed`;

  const params: Record<string, string> = {
    access_token: PAGE_ACCESS_TOKEN,
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
export async function deleteFacebookPost(postId: string): Promise<MetaApiResponse> {
  return callGraphApi(`/${postId}`, "POST", {
    access_token: PAGE_ACCESS_TOKEN,
    method: "delete", // Graph API acceptă override prin acest param pt DELETE via POST
  });
}

/**
 * Listează postările programate (nepublicate încă) ale paginii.
 * Util pentru a le afișa într-un calendar/dashboard.
 */
export async function getScheduledFacebookPosts(): Promise<MetaApiResponse> {
  return callGraphApi(`/${PAGE_ID}/scheduled_posts`, "GET", {
    access_token: PAGE_ACCESS_TOKEN,
    fields: "id,message,scheduled_publish_time,created_time",
  });
}