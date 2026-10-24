'use client';

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  initNotifications,
  markAllNotificationsRead,
  type AppNotification,
} from "@/lib/notifications";

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
  { href: "/airmidi-link", label: "AirMIDI Link", isAirMidi: true },
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
    icon: "M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z",
  },
];

const BELL =
  "M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B1528]";

/* ------------------------------------------------------------------ */
/*  Styles                                                            */
/* ------------------------------------------------------------------ */

const NavStyles = () => (
  <style>{`
    @keyframes nv-sonar { 0% { transform: scale(0.85); opacity: 0.6; } 100% { transform: scale(2.1); opacity: 0; } }
    .nv-sonar { animation: nv-sonar 2.2s ease-out infinite; }

    @keyframes nv-eq { 0%, 100% { transform: scaleY(0.25); } 50% { transform: scaleY(1); } }
    .nv-eq { animation: nv-eq 0.85s ease-in-out infinite; transform-origin: bottom; }

    @keyframes nv-shine { 0% { transform: translateX(-120%) skewX(-20deg); } 60%, 100% { transform: translateX(260%) skewX(-20deg); } }
    .nv-shine { animation: nv-shine 3.6s ease-in-out infinite; }

    .logo-dot { transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1); }
    .group:hover .logo-dot { transform: scale(1.35) rotate(8deg); }

    @media (prefers-reduced-motion: reduce) {
      .nv-sonar, .nv-eq, .nv-shine { animation: none !important; }
    }
  `}</style>
);

/* ------------------------------------------------------------------ */
/*  Small pieces                                                      */
/* ------------------------------------------------------------------ */

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" fill="none" className="h-5 w-5" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d={BELL} />
    </svg>
  );
}

function Badge({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#FF5CA1] px-1 text-[9px] font-bold text-white shadow-[0_0_10px_rgba(255,92,161,0.8)]">
      {n > 9 ? "9+" : n}
    </span>
  );
}

function NewPill() {
  return (
    <span className="ml-1.5 rounded-full bg-pink-300 px-1.5 py-0.5 text-[8px] font-bold text-[#0B1528]">NEW</span>
  );
}

function Avatar({ user, size }: { user: { name?: string; email?: string }; size: string }) {
  return (
    <div className={`${size} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-300 to-indigo-400 text-xs font-bold uppercase text-[#0B1528]`}>
      {(user.name || user.email || "U").charAt(0)}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Notification Dropdown                                             */
/* ------------------------------------------------------------------ */

function NotificationDropdown({
  notifications,
  isOpen,
  onClose,
  isMobile = false,
}: {
  notifications: AppNotification[];
  isOpen: boolean;
  onClose: () => void;
  isMobile?: boolean;
}) {
  if (!isOpen) return null;

  return (
    <>
      {isMobile && <div className="fixed inset-0 z-40 bg-transparent md:hidden" onClick={onClose} />}
      <div
        className={`z-50 overflow-y-auto rounded-2xl border py-2 backdrop-blur-xl ${
          isMobile
            ? "fixed left-4 right-4 top-16 max-h-80 border-slate-200 bg-white/95 shadow-[0_20px_50px_-12px_rgba(15,23,42,0.25)]"
            : "absolute right-0 mt-4 max-h-96 w-80 border-white/10 bg-[#0F1D36]/95 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.6)]"
        }`}
      >
        {notifications.length === 0 ? (
          <p className={`px-4 py-6 text-center text-xs ${isMobile ? "text-slate-400" : "text-[#7E8FAD]"}`}>No notifications yet.</p>
        ) : (
          notifications.map((n) => (
            <Link
              key={n.id + n.createdAt}
              href={n.href || "#"}
              onClick={onClose}
              className={`flex items-start gap-3 px-4 py-3 transition-colors ${isMobile ? "hover:bg-slate-50" : "hover:bg-white/[0.06]"}`}
            >
              {n.image ? (
                <img src={n.image} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
              ) : (
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${isMobile ? "bg-pink-50 text-pink-500" : "bg-white/10 text-pink-300"}`}>
                  iM
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className={`truncate text-xs font-semibold ${isMobile ? "text-slate-800" : "text-white"}`}>{n.title}</p>
                <p className={`truncate text-[11px] ${isMobile ? "text-slate-500" : "text-[#9AA9C4]"}`}>{n.message}</p>
              </div>
            </Link>
          ))
        )}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Desktop Nav                                                       */
/* ------------------------------------------------------------------ */

type Hl = { left: number; width: number } | null;

function DesktopNav({
  scrolled,
  progress,
  user,
  notifications,
  isNotifOpen,
  unreadCount,
  onToggleNotif,
  onLogout,
}: {
  scrolled: boolean;
  progress: number;
  user: { name?: string; email?: string } | null;
  notifications: AppNotification[];
  isNotifOpen: boolean;
  unreadCount: number;
  onToggleNotif: () => void;
  onLogout: () => void;
}) {
  const pathname = usePathname();
  const [hl, setHl] = useState<Hl>(null);
  const track = (e: React.MouseEvent<HTMLElement> | React.FocusEvent<HTMLElement>) =>
    setHl({ left: e.currentTarget.offsetLeft, width: e.currentTarget.offsetWidth });

  return (
    <div
      className={`pointer-events-none fixed inset-x-0 top-0 z-50 hidden justify-center px-6 transition-all duration-500 md:flex ${
        scrolled ? "pt-3" : "pt-5"
      }`}
    >
      <nav
        className={`pointer-events-auto relative flex h-14 w-full items-center justify-between rounded-full border border-white/10 pl-5 pr-2.5 backdrop-blur-xl transition-all duration-500 ${
          scrolled
            ? "max-w-5xl bg-[#0B1528]/85 shadow-[0_10px_40px_-8px_rgba(0,0,0,0.6),0_0_0_1px_rgba(249,168,212,0.12)]"
            : "max-w-6xl bg-[#0B1528]/45 shadow-[0_10px_40px_-12px_rgba(0,0,0,0.4)]"
        }`}
      >
        {/* Logo */}
        <Link href="/" className={`group flex items-center rounded-full ${FOCUS}`}>
          <img src="/iiimidi.png" alt="iMIDI Logo" className="h-14 w-auto object-contain" />
          <span className="logo-dot ml-0.5 inline-block text-xl font-black text-[#FF5CA1]">.</span>
        </Link>

        {/* Links with magnetic highlight */}
        <div className="relative flex items-center" onMouseLeave={() => setHl(null)}>
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 rounded-full bg-white/10 ring-1 ring-white/10 transition-all duration-300 ease-out"
            style={{ left: hl?.left ?? 0, width: hl?.width ?? 0, opacity: hl ? 1 : 0 }}
          />
          {links.slice(1).map((l) => {
            if (l.isAirMidi) {
              const active = !!pathname?.startsWith("/airmidi-link");
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  onMouseEnter={track}
                  onFocus={track}
                  className={`relative z-10 flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-4 text-xs font-semibold uppercase tracking-wider transition-colors ${FOCUS} ${
                    active ? "text-pink-300" : "text-white/80 hover:text-white"
                  }`}
                >
                  <span className="relative flex h-6 w-6 shrink-0 rounded-full">
                    <span aria-hidden className="nv-sonar absolute inset-0 rounded-full bg-indigo-400/50" />
                    <img src="/airlink-icon.png" alt="" className="relative h-6 w-6 rounded-full" draggable={false} />
                  </span>
                  {l.label}
                  <span aria-hidden className="flex h-3 items-end gap-[2px]">
                    {[0, 0.18, 0.08].map((d, i) => (
                      <span
                        key={i}
                        className="nv-eq h-full w-[2.5px] rounded-full bg-pink-300/90"
                        style={{ animationDelay: `${d}s` }}
                      />
                    ))}
                  </span>
                </Link>
              );
            }

            const active = pathname === l.href;
            const cls = `relative z-10 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${FOCUS} ${
              active ? "text-pink-300" : "text-white/80 hover:text-white"
            }`;
            const inner = (
              <>
                {l.label}
                {l.isNew && <NewPill />}
                {active && (
                  <span
                    aria-hidden
                    className="absolute -bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-pink-300 shadow-[0_0_8px_rgba(249,168,212,1)]"
                  />
                )}
              </>
            );

            return l.external ? (
              <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" onMouseEnter={track} onFocus={track} className={cls}>
                {inner}
              </a>
            ) : (
              <Link key={l.href} href={l.href} onMouseEnter={track} onFocus={track} className={cls}>
                {inner}
              </Link>
            );
          })}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {user && (
            <div className="relative">
              <button
                onClick={onToggleNotif}
                aria-label="Notificări"
                className={`relative rounded-full p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white ${FOCUS}`}
              >
                <BellIcon />
                <Badge n={unreadCount} />
              </button>
              <NotificationDropdown notifications={notifications} isOpen={isNotifOpen} onClose={onToggleNotif} />
            </div>
          )}

          {user ? (
            <>
              <Link
                href="/dashboard/cloud-db"
                className={`group flex items-center gap-2 rounded-full py-1 pl-1 pr-3 transition-colors hover:bg-white/10 ${FOCUS}`}
              >
                <Avatar user={user} size="h-8 w-8" />
                <span className="max-w-[120px] truncate text-xs font-semibold text-white/90">{user.name || user.email}</span>
              </Link>
              <button
                onClick={onLogout}
                className={`rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-wider text-white/60 transition-colors hover:text-white ${FOCUS}`}
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className={`rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-wider text-white/80 transition-colors hover:text-white ${FOCUS}`}
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className={`relative overflow-hidden rounded-full bg-gradient-to-r from-pink-300 to-[#FF5CA1] px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-[#0B1528] shadow-[0_0_24px_rgba(255,92,161,0.4)] transition-transform active:scale-95 hover:shadow-[0_0_32px_rgba(255,92,161,0.65)] ${FOCUS}`}
              >
                <span aria-hidden className="nv-shine absolute inset-y-0 left-0 w-1/3 bg-white/50 blur-sm" />
                <span className="relative">Get Started</span>
              </Link>
            </>
          )}
        </div>

        {/* scroll progress */}
        <div aria-hidden className="pointer-events-none absolute inset-x-10 -bottom-px h-px">
          <div
            className="h-full origin-left bg-gradient-to-r from-pink-300 via-[#FF5CA1] to-indigo-400 shadow-[0_0_10px_rgba(249,168,212,0.9)]"
            style={{ transform: `scaleX(${progress})` }}
          />
        </div>
      </nav>
    </div>
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
  isNotifOpen,
  unreadCount,
  onToggleNotif,
}: {
  scrolled: boolean;
  user: { name?: string; email?: string } | null;
  isMenuOpen: boolean;
  setIsMenuOpen: (v: boolean) => void;
  notifications: AppNotification[];
  isNotifOpen: boolean;
  unreadCount: number;
  onToggleNotif: () => void;
}) {
  return (
    <div
      className={`fixed inset-x-0 top-0 z-50 flex h-14 w-full items-center justify-between px-5 transition-all duration-300 md:hidden ${
        scrolled
          ? "border-b border-slate-200/80 bg-white/80 shadow-sm backdrop-blur-xl"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <Link href="/" onClick={() => setIsMenuOpen(false)} className="group flex items-center py-1">
        <img src="/iiimidi.png" alt="iMIDI Logo" className="h-[4.25rem] w-auto object-contain" />
        <span className="logo-dot ml-0.5 text-lg font-black text-[#FF5CA1]">.</span>
      </Link>

      <div className="flex items-center gap-1 text-slate-600">
        {user && (
          <div className="relative">
            <button onClick={onToggleNotif} aria-label="Notificări" className="relative p-2 transition-colors hover:text-slate-900">
              <BellIcon />
              <Badge n={unreadCount} />
            </button>
            <NotificationDropdown notifications={notifications} isOpen={isNotifOpen} onClose={onToggleNotif} isMobile />
          </div>
        )}

        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="p-2 transition-colors hover:text-slate-900 focus:outline-none"
          aria-label="Toggle Account Menu"
          aria-expanded={isMenuOpen}
        >
          {user ? (
            <div className="flex items-center gap-1.5">
              <div className="relative shrink-0">
                <Avatar user={user} size="h-7 w-7" />
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
              </div>
              <span className="max-w-[80px] truncate text-[11px] font-semibold text-slate-700">{user.name || user.email}</span>
            </div>
          ) : (
            <div className="relative flex h-4 w-5 flex-col items-center justify-between">
              <span className={`h-0.5 w-5 origin-left rounded-full bg-current transition-all duration-300 ${isMenuOpen ? "translate-x-0.5 rotate-45" : ""}`} />
              <span className={`h-0.5 w-5 rounded-full bg-current transition-all duration-200 ${isMenuOpen ? "opacity-0" : ""}`} />
              <span className={`h-0.5 w-5 origin-left rounded-full bg-current transition-all duration-300 ${isMenuOpen ? "-rotate-45 translate-x-0.5" : ""}`} />
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
  const ghost =
    "w-full rounded-full border border-slate-200 bg-white py-3.5 text-center text-sm font-semibold text-slate-700 shadow-sm transition-all hover:border-pink-300 hover:text-slate-900 active:scale-[0.98]";
  const solid =
    "w-full rounded-full bg-gradient-to-r from-pink-300 to-[#FF5CA1] py-3.5 text-center text-sm font-bold text-[#0B1528] shadow-[0_8px_24px_rgba(255,92,161,0.35)] transition-all active:scale-[0.98]";

  return (
    <div
      className={`fixed inset-0 z-40 flex flex-col justify-center bg-white/95 px-6 backdrop-blur-2xl transition-all duration-500 ease-out md:hidden ${
        isOpen ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-6 opacity-0"
      }`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[30rem] max-w-full -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(249,168,212,0.40),transparent)]"
      />
      <div className="absolute left-6 right-6 top-24 border-b border-slate-100 pb-2">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-pink-500">iMIDI</p>
      </div>

      <div className="relative mx-auto flex w-full max-w-sm flex-col space-y-6">
        {user ? (
          <>
            <div className="flex flex-col items-center space-y-3 text-center">
              <Avatar user={user} size="h-16 w-16 text-xl shadow-[0_8px_30px_rgba(249,168,212,0.55)]" />
              <div>
                <p className="text-sm font-semibold text-slate-800">{user.name || user.email}</p>
                {user.name && <p className="text-[11px] text-slate-400">{user.email}</p>}
              </div>
            </div>
            <div className="flex flex-col space-y-3">
              <Link href="/dashboard/cloud-db" onClick={onClose} className={ghost}>
                mySpace
              </Link>
              <button
                onClick={() => {
                  onLogout();
                  onClose();
                }}
                className="w-full rounded-full py-3 text-center text-xs font-medium text-slate-400 transition-colors hover:text-slate-700"
              >
                Sign Out
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-1 text-center">
              <h2 className="bg-gradient-to-b from-slate-950 to-slate-600 bg-clip-text text-3xl font-black tracking-tight text-transparent">
                Welcome Back<span className="text-[#FF5CA1]">.</span>
              </h2>
              <p className="text-xs font-medium text-slate-500">Access your cloud space</p>
            </div>
            <div className="flex flex-col space-y-3">
              <Link href="/login" onClick={onClose} className={ghost}>
                Sign In
              </Link>
              <Link href="/register" onClick={onClose} className={solid}>
                Get Started
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Mobile Bottom Nav (dock with sliding indicator)                   */
/* ------------------------------------------------------------------ */

function MobileBottomNav({ isVisible, onNavigate }: { isVisible: boolean; onNavigate: () => void }) {
  const pathname = usePathname();

  const activeIdx = links.findIndex((l) =>
    l.external ? false : l.isAirMidi ? !!pathname?.startsWith("/airmidi-link") : pathname === l.href
  );

  const wrapper = "relative z-10 flex flex-1 flex-col items-center justify-center py-1.5 transition-transform active:scale-95";

  return (
    <nav
      className={`fixed inset-x-4 bottom-5 z-50 transition-all duration-300 md:hidden ${
        isVisible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-28 opacity-0"
      }`}
    >
      <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-1.5 shadow-[0_8px_30px_rgba(15,23,42,0.10)] backdrop-blur-xl">
        <div className="relative flex items-center justify-between">
          {/* sliding indicator */}
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 rounded-xl bg-gradient-to-b from-pink-100 to-pink-50 ring-1 ring-pink-200 transition-all duration-300 ease-out"
            style={{
              width: `${100 / links.length}%`,
              transform: `translateX(${Math.max(activeIdx, 0) * 100}%)`,
              opacity: activeIdx >= 0 ? 1 : 0,
            }}
          />

          {links.map((l, i) => {
            const cur = i === activeIdx;
            const color = cur ? "text-pink-600" : "text-slate-500";

            const label = (
              <span className={`mt-0.5 text-[8px] font-semibold uppercase tracking-wider transition-colors ${color} ${cur ? "font-bold" : ""}`}>
                {l.isAirMidi ? "AirMIDI" : l.label}
              </span>
            );

            if (l.isAirMidi) {
              return (
                <Link key={l.href} href={l.href} aria-label="AirMIDI Link" className={wrapper} onClick={onNavigate}>
                  <div className="p-2">
                    <span className="relative block h-4 w-4">
                      <img
                        src="/airlink-icon.png"
                        alt=""
                        draggable={false}
                        className={`h-4 w-4 rounded-full object-cover ${cur ? "ring-2 ring-pink-400 ring-offset-1 ring-offset-white" : ""}`}
                      />
                      {!cur && (
                        <span aria-hidden className="absolute -right-0.5 -top-0.5 flex h-2 w-2">
                          <span className="nv-sonar absolute inline-flex h-full w-full rounded-full bg-indigo-400" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-500 ring-1 ring-white" />
                        </span>
                      )}
                    </span>
                  </div>
                  {label}
                </Link>
              );
            }

            const content = (
              <>
                <div className={`p-2 transition-colors ${color}`}>
                  <svg
                    viewBox="0 0 24 24"
                    strokeWidth={cur ? "1.5" : "2"}
                    stroke="currentColor"
                    fill={cur ? "currentColor" : "none"}
                    className="h-4 w-4"
                    aria-hidden
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d={l.icon} />
                  </svg>
                </div>
                {label}
                {l.isNew && !cur && (
                  <span className="absolute right-2 top-1 h-1.5 w-1.5 rounded-full bg-pink-400 shadow-[0_0_6px_rgba(244,114,182,0.8)]">
                    <span className="sr-only">New</span>
                  </span>
                )}
              </>
            );

            return l.external ? (
              <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className={wrapper} onClick={onNavigate}>
                {content}
              </a>
            ) : (
              <Link key={l.href} href={l.href} className={wrapper} onClick={onNavigate}>
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
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);

  const [user, setUser] = useState<{ name?: string; email?: string } | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const cleanup = initNotifications(setNotifications);
    return cleanup;
  }, []);

  const handleOpenNotifications = () => {
    const next = !isNotifOpen;
    setIsNotifOpen(next);
    if (next && unreadCount > 0) {
      setNotifications(markAllNotificationsRead());
    }
  };

  useEffect(() => {
    const apply = (session: { user?: { user_metadata?: Record<string, string>; email?: string } } | null) => {
      if (session?.user) {
        setUser({
          name: session.user.user_metadata?.full_name || session.user.user_metadata?.name,
          email: session.user.email,
        });
      } else {
        setUser(null);
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => apply(session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => apply(session));
    return () => listener.subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  useEffect(() => {
    const handleScroll = () => {
      const current = window.scrollY;
      setScrolled(current > 15);

      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(1, Math.max(0, current / max)) : 0);

      if (current > lastScrollY.current && current > 60) {
        setIsVisible(false);
        setIsMenuOpen(false);
      } else {
        setIsVisible(true);
      }
      lastScrollY.current = current;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsMenuOpen(false);
        setIsNotifOpen(false);
      }
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? "hidden" : "unset";
  }, [isMenuOpen]);

  return (
    <>
      <NavStyles />

      <DesktopNav
        scrolled={scrolled}
        progress={progress}
        user={user}
        notifications={notifications}
        isNotifOpen={isNotifOpen}
        unreadCount={unreadCount}
        onToggleNotif={handleOpenNotifications}
        onLogout={handleLogout}
      />

      <MobileHeader
        scrolled={scrolled}
        user={user}
        isMenuOpen={isMenuOpen}
        setIsMenuOpen={setIsMenuOpen}
        notifications={notifications}
        isNotifOpen={isNotifOpen}
        unreadCount={unreadCount}
        onToggleNotif={handleOpenNotifications}
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