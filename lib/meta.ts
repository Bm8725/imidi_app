/**
 * lib/meta.ts
 * Funcții dinamice pentru publicare pe Facebook Page prin Meta Graph API,
 * folosind credențialele extrase din Supabase.
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
/* FACEBOOK                                                            */
/* ------------------------------------------------------------------ */

interface PublishFacebookPostParams {
  pageId: string;                 // Transmis dinamic din Supabase
  pageAccessToken: string;        // Transmis dinamic din Supabase
  message: string;
  imageUrl?: string;              
  scheduledPublishTime?: number;  
}

/**
 * Publică (sau programează) o postare text/imagine pe pagina de Facebook a unui user specific.
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
 * Șterge o postare folosind token-ul utilizatorului.
 */
export async function deleteFacebookPost(postId: string, pageAccessToken: string): Promise<MetaApiResponse> {
  return callGraphApi(`/${postId}`, "POST", {
    access_token: pageAccessToken,
    method: "delete",
  });
}

/**
 * Listează postările programate pentru o pagină specifică.
 */
export async function getScheduledFacebookPosts(pageId: string, pageAccessToken: string): Promise<MetaApiResponse> {
  return callGraphApi(`/${pageId}/scheduled_posts`, "GET", {
    access_token: pageAccessToken,
    fields: "id,message,scheduled_publish_time,created_time",
  });
}
