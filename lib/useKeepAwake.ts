// lib/useKeepAwake.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type AwakeMode = "off" | "wakelock" | "video";

/**
 * Keeps the device from going to sleep while `active` is true.
 *
 * Layers, from best to last resort:
 *  1. Screen Wake Lock API (Chrome, Edge, Safari 16.4+, Firefox 126+).
 *     Re-requested whenever the system releases it, when the tab becomes visible again,
 *     on focus / pageshow, and by a 15 s watchdog.
 *  2. Fallback for browsers or states where the Wake Lock is refused (battery saver, old iOS):
 *     a tiny silent video generated from a canvas is kept playing, which also stops the screen
 *     from sleeping. Browsers want a user gesture for this, so it is retried on every tap / key press.
 *  3. A Web Lock held for the whole session, which tells Chrome not to freeze the tab.
 *
 * Nothing here can stop the user from locking the phone by hand or switching to another app.
 */
export function useKeepAwake(active: boolean, enabled: boolean = true) {
  const [mode, setMode] = useState<AwakeMode>("off");
  const [supported, setSupported] = useState(false);
  const ensureRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    setSupported(typeof navigator !== "undefined" && !!(navigator as any).wakeLock);
  }, []);

  useEffect(() => {
    if (!active || !enabled || typeof window === "undefined") {
      setMode("off");
      ensureRef.current = async () => {};
      return;
    }

    const nav: any = navigator;
    let cancelled = false;
    let lock: any = null;
    let video: HTMLVideoElement | null = null;
    let canvasTimer: ReturnType<typeof setInterval> | null = null;
    let releaseWebLock: (() => void) | null = null;

    /* ---- 1) Screen Wake Lock ---- */
    const acquireWakeLock = async (): Promise<boolean> => {
      if (!nav.wakeLock) return false;
      if (lock && !lock.released) return true;
      if (document.visibilityState !== "visible") return false;
      try {
        const sentinel = await nav.wakeLock.request("screen");
        if (cancelled) {
          Promise.resolve(sentinel.release()).catch(() => {});
          return false;
        }
        lock = sentinel;
        sentinel.addEventListener("release", () => {
          if (lock === sentinel) lock = null;
          if (!cancelled) void ensure();
        });
        return true;
      } catch {
        return false; // refused (battery saver, permissions policy...): the fallback takes over
      }
    };

    /* ---- 2) Silent video fallback ---- */
    const startVideo = async (): Promise<boolean> => {
      let v = video;
      if (v && !v.paused) return true;
      if (!v) {
        const canvas = document.createElement("canvas");
        canvas.width = 16;
        canvas.height = 16;
        const ctx = canvas.getContext("2d");
        const capture = (canvas as any).captureStream;
        if (!ctx || typeof capture !== "function") return false;
        let n = 0;
        const draw = () => {
          ctx.fillStyle = n++ % 2 ? "#000000" : "#020202"; // the frame must change, or the stream goes idle
          ctx.fillRect(0, 0, 16, 16);
        };
        draw();
        canvasTimer = setInterval(draw, 1000);
        v = document.createElement("video");
        v.setAttribute("playsinline", "");
        v.setAttribute("muted", "");
        v.muted = true;
        v.loop = true;
        v.srcObject = capture.call(canvas, 5);
        video = v;
      }
      try {
        await v.play();
        return true;
      } catch {
        return false; // needs a user gesture: retried on the next tap
      }
    };

    const stopVideo = () => {
      if (canvasTimer) clearInterval(canvasTimer);
      canvasTimer = null;
      if (video) {
        try {
          video.pause();
        } catch {
          /* ignore */
        }
        video.srcObject = null;
        video = null;
      }
    };

    /* ---- put it together ---- */
    const ensure = async () => {
      if (cancelled) return;
      if (document.visibilityState !== "visible") return; // neither API works while hidden
      if (await acquireWakeLock()) {
        stopVideo();
        if (!cancelled) setMode("wakelock");
        return;
      }
      const ok = await startVideo();
      if (!cancelled) setMode(ok ? "video" : "off");
    };
    ensureRef.current = ensure;

    /* ---- 3) Web Lock: keeps Chrome from freezing the tab ---- */
    if (nav.locks?.request) {
      nav.locks
        .request(
          "airmidi-keepalive",
          () =>
            new Promise<void>((resolve) => {
              releaseWebLock = resolve;
            })
        )
        .catch(() => {});
    }

    const onVisible = () => {
      if (document.visibilityState === "visible") void ensure();
    };
    const onGesture = () => {
      if (!lock) void ensure(); // a tap is the moment browsers allow the fallback video to start
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onVisible);
    window.addEventListener("focus", onVisible);
    const gestures = ["pointerdown", "touchend", "keydown"] as const;
    gestures.forEach((e) => window.addEventListener(e, onGesture, { passive: true }));
    const watchdog = setInterval(() => void ensure(), 15000);

    void ensure();

    return () => {
      cancelled = true;
      clearInterval(watchdog);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onVisible);
      window.removeEventListener("focus", onVisible);
      gestures.forEach((e) => window.removeEventListener(e, onGesture));
      try {
        Promise.resolve(lock?.release?.()).catch(() => {});
      } catch {
        /* ignore */
      }
      lock = null;
      stopVideo();
      if (releaseWebLock) (releaseWebLock as () => void)();
    };
  }, [active, enabled]);

  const retry = useCallback(() => {
    void ensureRef.current();
  }, []);

  return { mode, supported, retry };
}