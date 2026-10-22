'use client';

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  initNotifications,
  markAllNotificationsRead,
  type AppNotification,
} from "@/lib/notifications";
import { openCookieSettings } from "@/components/CookieBanner";

/* ------------------------------------------------------------------ */
/*  Config                                                            */
/* ------------------------------------------------------------------ */

type NavLink = {
  href: string;
  label: string;
  icon?: string;
  isAirMidi?: boolean;
  isNew?: boolean;
  external?: boolean;
  /** Path prefix that keeps this item highlighted (defaults to href) */
  match?: string;
};

const links: NavLink[] = [
  {
    href: "/",
    label: "Home",
    icon: "M2.25 12 11.204 3.045a1.125 1.125 0 0 1 1.592 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21.75h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21.75h2.25",
  },
  {
    href: "/products",
    label: "i-volution",
    icon: "M7 5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H7zM3 9h2v2H3V9zm0 4h2v2H3v-2zm16-4h2v2h-2V9zm0 4h2v2h-2v-2zM9 3h2v2H9V3zm4 0h2v2h-2V3zm-4 16h2v2H9v-2zm4 0h2v2h-2v-2z",
  },
  {
    href: "/airmidi-link",
    label: "AirMIDI Link",
    isAirMidi: true,
  },
  {
    href: "/e-market",
    label: "Market",
    icon: "M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z",
    isNew: true,
  },
  {
    href: "https://docs.imidi.co.uk",
    label: "DOCS",
    icon: "M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3",
    isNew: true,
    external: true,
  },
  {
    href: "/dashboard/cloud-db",
    label: "mySpace",
    match: "/dashboard",
    icon: "M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z",
  },
];

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2";

const BELL_PATH =
  "M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0";

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function isActive(pathname: string | null, l: NavLink) {
  if (!pathname || l.external) return false;
  const base = l.match ?? l.href;
  if (base === "/") return pathname === "/";
  return pathname === base || pathname.startsWith(base + "/");
}

function timeAgo(value: unknown): string {
  const t = new Date(value as string | number).getTime();
  if (!isFinite(t)) return "";
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return "now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

const nKey = (n: AppNotification) => `${n.id}-${n.createdAt}`;

function useOutsideClose<T extends HTMLElement>(open: boolean, onClose: () => void) {
  const ref = useRef<T>(null);
  const cb = useRef(onClose);
  cb.current = onClose;
  useEffect(() => {
    if (!open) return;
    const handler = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) cb.current();
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [open]);
  return ref;
}

/* ------------------------------------------------------------------ */
/*  Styles                                                            */
/* ------------------------------------------------------------------ */

const NavStyles = () => (
  <style>{`
    .aw-nav-scrim {
      background: linear-gradient(to bottom, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.18) 55%, rgba(0,0,0,0) 100%);
    }

    /* AirMIDI */
    @keyframes nv-sonar {
      0% { transform: scale(0.85); opacity: 0.6; }
      100% { transform: scale(2.1); opacity: 0; }
    }
    .nv-sonar { animation: nv-sonar 2.2s ease-out infinite; }

    @keyframes nv-eq {
      0%, 100% { transform: scaleY(0.25); }
      50% { transform: scaleY(1); }
    }
    .nv-eq { animation: nv-eq 0.85s ease-in-out infinite; transform-origin: bottom; }

    @keyframes nv-glow {
      0%, 100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.35); }
      50% { box-shadow: 0 0 12px 2px rgba(99, 102, 241, 0.45); }
    }
    .nv-glow { animation: nv-glow 2.8s ease-in-out infinite; }

    /* Active underline */
    @keyframes nv-underline {
      from { transform: scaleX(0); }
      to { transform: scaleX(1); }
    }
    .nv-underline {
      transform-origin: left;
      animation: nv-underline 0.25s ease-out forwards;
    }

    /* Dropdowns */
    @keyframes nv-pop {
      from { opacity: 0; transform: translateY(-6px) scale(0.98); }
      to { opacity: 1; transform: none; }
    }
    .nv-pop { animation: nv-pop 0.18s cubic-bezier(0.2, 0.8, 0.2, 1) both; transform-origin: top right; }

    /* Logo hover */
    .logo-dot {
      transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .group:hover .logo-dot {
      transform: scale(1.35) rotate(8deg);
    }

    @media (prefers-reduced-motion: reduce) {
      .nv-sonar, .nv-eq, .nv-glow, .nv-underline, .nv-pop { animation: none !important; }
    }
  `}</style>
);

/* ------------------------------------------------------------------ */
/*  Notifications                                                     */
/* ------------------------------------------------------------------ */

function NotificationPanel({
  notifications,
  fresh,
  onClose,
  isMobile,
}: {
  notifications: AppNotification[];
  fresh: Set<string>;
  onClose: () => void;
  isMobile: boolean;
}) {
  const freshCount = notifications.filter((n) => fresh.has(nKey(n))).length;

  return (
    <div
      role="dialog"
      aria-label="Notifications"
      className={`nv-pop z-50 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_50px_-12px_rgba(15,23,42,0.28)] ${
        isMobile ? "fixed inset-x-3 top-[3.75rem]" : "absolute right-0 mt-3 w-[22rem]"
      }`}
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">Notifications</h2>
        {freshCount > 0 && (
          <span className="rounded-full bg-[#FF5CA1]/10 px-2 py-0.5 text-[11px] font-semibold text-[#D6277A]">
            {freshCount} new
          </span>
        )}
      </div>

      <div className="max-h-[min(24rem,60vh)] overflow-y-auto overscroll-contain">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <svg viewBox="0 0 24 24" strokeWidth="1.6" stroke="currentColor" fill="none" className="h-5 w-5" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d={BELL_PATH} />
              </svg>
            </span>
            <p className="text-sm font-semibold text-slate-700">All caught up</p>
            <p className="text-xs text-slate-400">New activity will show up here.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {notifications.map((n) => {
              const isFresh = fresh.has(nKey(n));
              const when = timeAgo(n.createdAt);
              return (
                <li key={nKey(n)}>
                  <Link
                    href={n.href || "#"}
                    onClick={onClose}
                    className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none ${
                      isFresh ? "bg-blue-50/50" : ""
                    }`}
                  >
                    {n.image ? (
                      <img src={n.image} alt="" className="h-10 w-10 shrink-0 rounded-xl object-cover" />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-[11px] font-bold text-slate-400">
                        iM
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-[13px] font-semibold text-slate-900">{n.title}</p>
                        {when && <span className="shrink-0 text-[11px] text-slate-400">{when}</span>}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-slate-500">{n.message}</p>
                    </div>
                    {isFresh && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#FF5CA1]" aria-label="New" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function NotificationBell({
  variant,
  scrolled = true,
  notifications,
  fresh,
  isOpen,
  unreadCount,
  onToggle,
  onClose,
}: {
  variant: "desktop" | "mobile";
  scrolled?: boolean;
  notifications: AppNotification[];
  fresh: Set<string>;
  isOpen: boolean;
  unreadCount: number;
  onToggle: () => void;
  onClose: () => void;
}) {
  const ref = useOutsideClose<HTMLDivElement>(isOpen, onClose);
  const isMobile = variant === "mobile";
  const tone = isMobile
    ? "text-slate-600 hover:text-slate-900"
    : scrolled
    ? "text-slate-500 hover:bg-slate-100 hover:text-slate-950"
    : "text-white/80 hover:bg-white/10 hover:text-white";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className={`relative flex h-11 w-11 items-center justify-center rounded-full transition-colors md:h-10 md:w-10 ${tone} ${FOCUS}`}
      >
        <svg viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" fill="none" className="h-5 w-5" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d={BELL_PATH} />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#FF5CA1] px-1 text-[9px] font-bold text-white shadow-sm ring-2 ring-white/90">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && <NotificationPanel notifications={notifications} fresh={fresh} onClose={onClose} isMobile={isMobile} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  User menu (desktop)                                               */
/* ------------------------------------------------------------------ */

function UserMenu({
  user,
  scrolled,
  onLogout,
}: {
  user: { name?: string; email?: string };
  scrolled: boolean;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useOutsideClose<HTMLDivElement>(open, close);
  const btnRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const label = user.name || user.email || "User";

  return (
    <div ref={ref} className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${label}`}
        className={`flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition-colors xl:pr-3 ${
          scrolled ? "hover:bg-slate-100" : "hover:bg-white/10"
        } ${FOCUS}`}
      >
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold uppercase text-white ${
            scrolled ? "bg-blue-600" : "border border-white/30 bg-white/20 backdrop-blur-sm"
          }`}
        >
          {label.charAt(0)}
        </span>
        <span
          className={`hidden max-w-[120px] truncate text-xs font-semibold xl:inline ${
            scrolled ? "text-slate-700" : "text-white/90"
          }`}
        >
          {label}
        </span>
        <svg
          viewBox="0 0 24 24"
          strokeWidth="2"
          stroke="currentColor"
          fill="none"
          className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""} ${
            scrolled ? "text-slate-400" : "text-white/70"
          }`}
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Account"
          className="nv-pop absolute right-0 z-50 mt-3 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white py-1.5 shadow-[0_20px_50px_-12px_rgba(15,23,42,0.28)]"
        >
          <div className="border-b border-slate-100 px-4 pb-3 pt-2">
            <p className="truncate text-sm font-semibold text-slate-900">{label}</p>
            {user.name && user.email && <p className="truncate text-xs text-slate-400">{user.email}</p>}
          </div>
          <Link
            href="/dashboard/cloud-db"
            role="menuitem"
            className="block px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"
          >
            mySpace
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            className="block w-full px-4 py-2.5 text-left text-sm font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:bg-slate-50 focus-visible:outline-none"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  AirMIDI Desktop                                                   */
/* ------------------------------------------------------------------ */

function AirMidiDesktopLink({
  href,
  label,
  active,
  scrolled,
}: {
  href: string;
  label: string;
  active: boolean;
  scrolled: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`group relative flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3 text-xs font-semibold uppercase tracking-wider ring-1 transition-all duration-300 lg:pr-4 ${FOCUS} ${
        active
          ? scrolled
            ? "text-blue-600 bg-blue-50 ring-blue-200 shadow-sm"
            : "text-white bg-white/20 backdrop-blur-sm ring-white/40 shadow-[0_0_20px_rgba(255,255,255,0.15)]"
          : scrolled
          ? "text-slate-600 hover:text-slate-950 hover:bg-slate-100 ring-indigo-200 hover:ring-indigo-300"
          : "text-white/90 hover:text-white hover:bg-white/15 ring-white/25 hover:ring-white/40"
      }`}
    >
      <span className={`relative flex h-6 w-6 shrink-0 rounded-full ${active ? "nv-glow" : ""}`}>
        <span aria-hidden className="nv-sonar absolute inset-0 rounded-full bg-indigo-400/50" />
        <img src="/airlink-icon.png" alt="" className="relative h-6 w-6 rounded-full" draggable={false} />
      </span>
      <span className="relative z-10">{label}</span>
      <span aria-hidden className="flex h-3 items-end gap-[2px]">
        {[0, 0.18, 0.08].map((d, i) => (
          <span
            key={i}
            className={`nv-eq h-full w-[2.5px] rounded-full ${scrolled ? "bg-indigo-500" : "bg-white/85"}`}
            style={{ animationDelay: `${d}s` }}
          />
        ))}
      </span>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/*  Desktop Nav                                                       */
/* ------------------------------------------------------------------ */

function DesktopNav({
  scrolled,
  user,
  notifications,
  fresh,
  isNotifOpen,
  unreadCount,
  onToggleNotif,
  onCloseNotif,
  onLogout,
}: {
  scrolled: boolean;
  user: { name?: string; email?: string } | null;
  notifications: AppNotification[];
  fresh: Set<string>;
  isNotifOpen: boolean;
  unreadCount: number;
  onToggleNotif: () => void;
  onCloseNotif: () => void;
  onLogout: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 hidden md:block ${
        scrolled
          ? "bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-sm h-16"
          : "bg-transparent border-b border-transparent h-20"
      }`}
    >
      <div className="max-w-7xl mx-auto h-full px-4 lg:px-6 flex items-center justify-between gap-2">
        {/* Logo */}
        <Link href="/" aria-label="iMIDI home" className="flex items-center group relative py-1 shrink-0">
          <img
            src="/iiimidi.png"
            alt="iMIDI Logo"
            className={`w-auto object-contain transition-all duration-300 ${
              scrolled ? "h-[5.25rem]" : "h-24 drop-shadow-[0_1px_8px_rgba(0,0,0,0.4)]"
            }`}
          />
          <span
            className={`logo-dot ml-0.5 inline-block font-black text-xl ${
              scrolled ? "text-blue-600" : "text-[#FF5CA1]"
            }`}
          >
            .
          </span>
        </Link>

        {/* Links */}
        <div className="flex items-center gap-0.5 lg:gap-1">
          {links.slice(1).map((l) => {
            const active = isActive(pathname, l);

            if (l.isAirMidi) {
              return (
                <AirMidiDesktopLink key={l.href} href={l.href} label={l.label} active={active} scrolled={scrolled} />
              );
            }

            const base = `relative text-xs font-semibold uppercase tracking-wider transition-all duration-200 py-2 px-3 lg:px-4 rounded-full ${FOCUS}`;
            const activeClass = scrolled ? "text-blue-600 bg-blue-50" : "text-white bg-white/15 backdrop-blur-sm";
            const idleClass = scrolled
              ? "text-slate-500 hover:text-slate-950 hover:bg-slate-100"
              : "text-white/80 hover:text-white hover:bg-white/10";
            const className = `${base} ${active ? activeClass : idleClass}`;

            const inner = (
              <>
                <span className="relative z-10">{l.label}</span>
                {l.isNew && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-[8px] font-bold bg-emerald-100 text-emerald-700 rounded-md">
                    NEW
                  </span>
                )}
                {active && (
                  <span
                    className={`nv-underline absolute bottom-1 left-3 right-3 h-[2px] rounded-full lg:left-4 lg:right-4 ${
                      scrolled ? "bg-blue-500" : "bg-white"
                    }`}
                  />
                )}
              </>
            );

            if (l.external) {
              return (
                <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className={className}>
                  {inner}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              );
            }

            return (
              <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined} className={className}>
                {inner}
              </Link>
            );
          })}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-1.5 lg:gap-3 shrink-0">
          {user && (
            <NotificationBell
              variant="desktop"
              scrolled={scrolled}
              notifications={notifications}
              fresh={fresh}
              isOpen={isNotifOpen}
              unreadCount={unreadCount}
              onToggle={onToggleNotif}
              onClose={onCloseNotif}
            />
          )}

          {user ? (
            <UserMenu user={user} scrolled={scrolled} onLogout={onLogout} />
          ) : (
            <>
              <Link
                href="/login"
                className={`rounded-full px-2 py-1 text-xs font-semibold uppercase tracking-wider transition-colors ${FOCUS} ${
                  scrolled ? "text-slate-500 hover:text-slate-950" : "text-white/80 hover:text-white"
                }`}
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className={`text-xs font-bold uppercase tracking-wider px-4 lg:px-5 py-2.5 rounded-full transition-all duration-200 transform active:scale-95 shadow-sm hover:shadow-md ${FOCUS} ${
                  scrolled ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-white text-[#131316] hover:bg-white/90"
                }`}
              >
                Get Started
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/*  Mobile Header                                                     */
/* ------------------------------------------------------------------ */

function MobileHeader({
  scrolled,
  user,
  isMenuOpen,
  setIsMenuOpen,
  notifications,
  fresh,
  isNotifOpen,
  unreadCount,
  onToggleNotif,
  onCloseNotif,
}: {
  scrolled: boolean;
  user: { name?: string; email?: string } | null;
  isMenuOpen: boolean;
  setIsMenuOpen: (v: boolean) => void;
  notifications: AppNotification[];
  fresh: Set<string>;
  isNotifOpen: boolean;
  unreadCount: number;
  onToggleNotif: () => void;
  onCloseNotif: () => void;
}) {
  return (
    <div
      className={`md:hidden fixed top-0 left-0 right-0 w-full h-14 z-50 flex items-center px-4 justify-between transition-all duration-300 ${
        scrolled
          ? "bg-white/80 backdrop-blur-md border-b border-slate-200/80 shadow-sm"
          : "bg-transparent border-b border-transparent"
      }`}
    >
      <Link
        href="/"
        aria-label="iMIDI home"
        onClick={() => setIsMenuOpen(false)}
        className="flex items-center py-1 group"
      >
        <img src="/iiimidi.png" alt="iMIDI Logo" className="h-[4.25rem] w-auto object-contain" />
        <span className="logo-dot text-blue-600 ml-0.5 font-black text-lg">.</span>
      </Link>

      <div className="flex items-center">
        {user && (
          <NotificationBell
            variant="mobile"
            notifications={notifications}
            fresh={fresh}
            isOpen={isNotifOpen}
            unreadCount={unreadCount}
            onToggle={onToggleNotif}
            onClose={onCloseNotif}
          />
        )}

        <button
          type="button"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className={`flex h-11 items-center justify-center rounded-full px-2 text-slate-600 transition-colors hover:text-slate-900 ${FOCUS}`}
          aria-label={isMenuOpen ? "Close account menu" : "Open account menu"}
          aria-expanded={isMenuOpen}
          aria-controls="mobile-account-menu"
        >
          {user ? (
            <div className="flex items-center gap-1.5">
              <div className="relative w-7 h-7 shrink-0">
                <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center text-[11px] font-bold uppercase">
                  {(user.name || user.email || "U").charAt(0)}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white" />
              </div>
              <span className="text-[11px] font-semibold text-slate-700 max-w-[80px] truncate">
                {user.name || user.email}
              </span>
            </div>
          ) : (
            <div className="w-5 h-4 flex flex-col justify-between items-center relative">
              <span
                className={`w-5 h-0.5 bg-current rounded-full transition-all duration-300 origin-left ${
                  isMenuOpen ? "rotate-45 translate-x-0.5" : ""
                }`}
              />
              <span
                className={`w-5 h-0.5 bg-current rounded-full transition-all duration-200 ${
                  isMenuOpen ? "opacity-0" : ""
                }`}
              />
              <span
                className={`w-5 h-0.5 bg-current rounded-full transition-all duration-300 origin-left ${
                  isMenuOpen ? "-rotate-45 translate-x-0.5" : ""
                }`}
              />
            </div>
          )}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Mobile Account Overlay                                            */
/* ------------------------------------------------------------------ */

function MobileAccountOverlay({
  isOpen,
  user,
  onClose,
  onLogout,
}: {
  isOpen: boolean;
  user: { name?: string; email?: string } | null;
  onClose: () => void;
  onLogout: () => void;
}) {
  return (
    <div
      id="mobile-account-menu"
      role="dialog"
      aria-modal="true"
      aria-label="Account menu"
      aria-hidden={!isOpen}
      className={`md:hidden fixed inset-0 bg-white/98 backdrop-blur-2xl z-40 px-6 flex flex-col justify-center transition-all duration-500 ease-out ${
        isOpen ? "visible opacity-100 translate-y-0" : "invisible opacity-0 -translate-y-6 pointer-events-none"
      }`}
    >
      <div className="absolute top-24 left-6 right-6 border-b border-slate-100 pb-2">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">iMIDI</p>
      </div>

      <div className="flex flex-col space-y-6 w-full max-w-sm mx-auto">
        {user ? (
          <>
            <div className="flex flex-col items-center space-y-3 text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-xl font-bold uppercase shadow-lg">
                {(user.name || user.email || "U").charAt(0)}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">{user.name || user.email}</p>
                {user.name && <p className="text-[11px] text-slate-400">{user.email}</p>}
              </div>
            </div>

            <div className="flex flex-col space-y-3">
              <Link
                href="/dashboard/cloud-db"
                onClick={onClose}
                className={`w-full text-center py-3.5 rounded-full text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-[0.98] transition-all ${FOCUS}`}
              >
                mySpace
              </Link>
              <button
                type="button"
                onClick={() => {
                  onLogout();
                  onClose();
                }}
                className={`w-full text-center py-3 rounded-full text-xs font-medium text-slate-400 hover:text-slate-700 transition-colors ${FOCUS}`}
              >
                Sign out
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="text-center space-y-1">
              <h2 className="text-2xl font-black tracking-tight text-slate-950">
                Welcome back<span className="text-blue-600">.</span>
              </h2>
              <p className="text-xs font-medium text-slate-500">Access your cloud space</p>
            </div>

            <div className="flex flex-col space-y-3">
              <Link
                href="/login"
                onClick={onClose}
                className={`w-full text-center py-3.5 rounded-full text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 active:scale-[0.98] transition-all ${FOCUS}`}
              >
                Sign In
              </Link>
              <Link
                href="/register"
                onClick={onClose}
                className={`w-full text-center py-3.5 rounded-full text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98] transition-all shadow-md ${FOCUS}`}
              >
                Get Started
              </Link>
            </div>
          </>
        )}

        <div className="flex items-center justify-center gap-4 border-t border-slate-100 pt-5 text-xs text-slate-400">
          <button
            type="button"
            onClick={() => {
              onClose();
              openCookieSettings();
            }}
            className={`rounded-md px-1 py-1 font-medium hover:text-slate-700 ${FOCUS}`}
          >
            Cookie settings
          </button>
          <span aria-hidden>·</span>
          <Link href="/privacy" onClick={onClose} className={`rounded-md px-1 py-1 font-medium hover:text-slate-700 ${FOCUS}`}>
            Privacy
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Mobile Bottom Nav                                                 */
/* ------------------------------------------------------------------ */

function MobileBottomNav({
  isVisible,
  onNavigate,
}: {
  isVisible: boolean;
  onNavigate: () => void;
}) {
  const pathname = usePathname();
  const wrapperClass =
    "flex flex-col items-center justify-center py-1.5 flex-1 min-w-0 relative active:scale-95 transition-transform rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";

  return (
    <nav
      aria-label="Main"
      className={`md:hidden fixed inset-x-3 z-50 transition-all duration-300 ${
        isVisible ? "translate-y-0 opacity-100" : "translate-y-28 opacity-0 pointer-events-none"
      }`}
      style={{ bottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
    >
      <div className="bg-white/95 border border-slate-200/80 backdrop-blur-xl rounded-2xl p-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.08)]">
        <div className="flex items-center justify-between">
          {links.map((l) => {
            const cur = isActive(pathname, l);

            if (l.isAirMidi) {
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-label="AirMIDI Link"
                  aria-current={cur ? "page" : undefined}
                  className={wrapperClass}
                  onClick={onNavigate}
                >
                  <div className={`p-1.5 rounded-xl transition-all duration-200 ${cur ? "bg-blue-50 scale-110" : ""}`}>
                    <span className="relative block h-5 w-5">
                      <img
                        src="/airlink-icon.png"
                        alt=""
                        draggable={false}
                        className={`h-5 w-5 rounded-full object-cover transition-all ${
                          cur ? "ring-2 ring-blue-500 ring-offset-1" : ""
                        }`}
                      />
                      {!cur && (
                        <span aria-hidden className="absolute -right-0.5 -top-0.5 flex h-2 w-2">
                          <span className="nv-sonar absolute inline-flex h-full w-full rounded-full bg-indigo-400" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-500 ring-1 ring-white" />
                        </span>
                      )}
                    </span>
                  </div>
                  <span
                    className={`mt-0.5 text-[10px] leading-tight font-semibold transition-colors ${
                      cur ? "text-blue-600 font-bold" : "text-slate-500"
                    }`}
                  >
                    AirMIDI
                  </span>
                </Link>
              );
            }

            const content = (
              <>
                <div
                  className={`relative p-2 rounded-xl transition-all duration-200 ${
                    cur ? "text-blue-600 bg-blue-50 scale-110" : "text-slate-600"
                  }`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    strokeWidth={cur ? "1.5" : "2"}
                    stroke="currentColor"
                    fill={cur ? "currentColor" : "none"}
                    className="w-4 h-4"
                    aria-hidden
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d={l.icon} />
                  </svg>
                </div>
                <span
                  className={`mt-0.5 max-w-full truncate text-[10px] leading-tight font-semibold transition-colors ${
                    cur ? "text-blue-600 font-bold" : "text-slate-500"
                  }`}
                >
                  {l.label}
                </span>
                {l.isNew && !cur && (
                  <>
                    <span
                      aria-hidden
                      className="absolute right-[22%] top-1.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white"
                    />
                    <span className="sr-only">New</span>
                  </>
                )}
              </>
            );

            if (l.external) {
              return (
                <a
                  key={l.href}
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={wrapperClass}
                  onClick={onNavigate}
                >
                  {content}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              );
            }

            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={cur ? "page" : undefined}
                className={wrapperClass}
                onClick={onNavigate}
              >
                {content}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/*  Main                                                              */
/* ------------------------------------------------------------------ */

export default function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);

  const [user, setUser] = useState<{ name?: string; email?: string } | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  // ids that were unread when the panel opened: they stay highlighted while it is open
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const cleanup = initNotifications(setNotifications);
    return cleanup;
  }, []);

  const closeNotifications = useCallback(() => setIsNotifOpen(false), []);

  const toggleNotifications = () => {
    if (isNotifOpen) {
      setIsNotifOpen(false);
      return;
    }
    setFresh(new Set(notifications.filter((n) => !n.read).map(nKey)));
    setIsNotifOpen(true);
    if (unreadCount > 0) {
      setNotifications(markAllNotificationsRead());
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({
          name: session.user.user_metadata?.full_name || session.user.user_metadata?.name,
          email: session.user.email,
        });
      } else {
        setUser(null);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          name: session.user.user_metadata?.full_name || session.user.user_metadata?.name,
          email: session.user.email,
        });
      } else {
        setUser(null);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  // close everything on navigation
  useEffect(() => {
    setIsMenuOpen(false);
    setIsNotifOpen(false);
  }, [pathname]);

  useEffect(() => {
    let ticking = false;

    const update = () => {
      const y = window.scrollY;
      setScrolled(y > 15);

      const delta = y - lastScrollY.current;
      // ignore tiny movements (iOS rubber-banding, trackpad jitter)
      if (Math.abs(delta) > 8) {
        if (delta > 0 && y > 60) {
          setIsVisible(false);
          setIsMenuOpen(false);
        } else {
          setIsVisible(true);
        }
        lastScrollY.current = y;
      }
      ticking = false;
    };

    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsMenuOpen(false);
        setIsNotifOpen(false);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // scroll lock only while the mobile menu is open, restoring whatever was there before
  useEffect(() => {
    if (!isMenuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isMenuOpen]);

  return (
    <>
      <NavStyles />

      {/* give id="main-content" to the <main> element of your pages */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[120] focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-black focus:shadow-lg"
      >
        Skip to content
      </a>

      <div
        aria-hidden
        className={`fixed top-0 inset-x-0 h-36 pointer-events-none z-40 hidden md:block transition-opacity duration-300 aw-nav-scrim ${
          scrolled ? "opacity-0" : "opacity-100"
        }`}
      />

      <DesktopNav
        scrolled={scrolled}
        user={user}
        notifications={notifications}
        fresh={fresh}
        isNotifOpen={isNotifOpen}
        unreadCount={unreadCount}
        onToggleNotif={toggleNotifications}
        onCloseNotif={closeNotifications}
        onLogout={handleLogout}
      />

      <MobileHeader
        scrolled={scrolled}
        user={user}
        isMenuOpen={isMenuOpen}
        setIsMenuOpen={setIsMenuOpen}
        notifications={notifications}
        fresh={fresh}
        isNotifOpen={isNotifOpen}
        unreadCount={unreadCount}
        onToggleNotif={toggleNotifications}
        onCloseNotif={closeNotifications}
      />

      <MobileAccountOverlay
        isOpen={isMenuOpen}
        user={user}
        onClose={() => setIsMenuOpen(false)}
        onLogout={handleLogout}
      />

      <MobileBottomNav isVisible={isVisible} onNavigate={() => setIsMenuOpen(false)} />
    </>
  );
}