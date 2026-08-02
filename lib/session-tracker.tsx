"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

const SESSION_STORAGE_KEY = "imidi_session_id";

function getOrCreateSessionId(): string {
  let id = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_STORAGE_KEY, id);
  }
  return id;
}

function getDevice() {
  return /Mobi|Android/i.test(navigator.userAgent)
    ? "mobile"
    : /Tablet|iPad/i.test(navigator.userAgent)
    ? "tablet"
    : "desktop";
}

async function postEvent(payload: Record<string, unknown>) {
  // luăm access_token-ul curent din clientul Supabase (localStorage) —
  // dacă userul e logat (inclusiv prin Facebook/Spotify OAuth), serverul
  // îl poate verifica și lega evenimentul de user_id real.
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const body = JSON.stringify(payload);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  // sendBeacon nu suportă header-e custom, deci pentru evenimente cu user
  // logat folosim fetch+keepalive; pentru cele fără (rare) putem folosi beacon.
  if (token || !navigator.sendBeacon) {
    fetch("/api/events", { method: "POST", headers, body, keepalive: true }).catch(() => {});
  } else {
    navigator.sendBeacon("/api/events", new Blob([body], { type: "application/json" }));
  }
}

/** Apelabilă din orice componentă client: trackEvent("nume", { detalii }) */
export function trackEvent(eventName: string, properties?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "production") return;
  postEvent({
    session_id: getOrCreateSessionId(),
    event_name: eventName,
    path: window.location.pathname,
    properties: properties ?? null,
  });
}

export function SessionTracker() {
  const pathname = usePathname();
  const pageEnteredAt = useRef<number>(Date.now());
  const lastPath = useRef<string>(pathname);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;

    const sessionId = getOrCreateSessionId();
    const isFirstLoad = !sessionStorage.getItem("imidi_session_started");

    if (isFirstLoad) {
      sessionStorage.setItem("imidi_session_started", "1");
      postEvent({
        session_id: sessionId,
        create_session: true,
        first_path: pathname,
        referrer: document.referrer || null,
        device: getDevice(),
      });
    }

    const timeOnPrevious = isFirstLoad ? null : Date.now() - pageEnteredAt.current;

    postEvent({
      session_id: sessionId,
      event_name: "pageview",
      path: pathname,
      time_on_previous_page_ms: timeOnPrevious,
    });

    pageEnteredAt.current = Date.now();
    lastPath.current = pathname;

    const handleUnload = () => {
      postEvent({
        session_id: sessionId,
        event_name: "page_exit",
        path: lastPath.current,
        time_on_previous_page_ms: Date.now() - pageEnteredAt.current,
      });
    };

    const visHandler = () => {
      if (document.visibilityState === "hidden") handleUnload();
    };
    document.addEventListener("visibilitychange", visHandler);
    window.addEventListener("pagehide", handleUnload);

    return () => {
      document.removeEventListener("visibilitychange", visHandler);
      window.removeEventListener("pagehide", handleUnload);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return null;
}