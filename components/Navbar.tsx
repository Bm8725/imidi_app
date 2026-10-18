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
    icon: "M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z",
  },
];

/* ------------------------------------------------------------------ */
/*  Shared styles (animations)                                        */
/* ------------------------------------------------------------------ */

const NavStyles = () => (
  <style>{`
    .aw-nav-scrim {
      background: linear-gradient(to bottom, rgba(0,0,0,0.38) 0%, rgba(0,0,0,0.16) 60%, rgba(0,0,0,0) 100%);
    }
    @keyframes nv-sonar {
      0% { transform: scale(.85); opacity: .55; }
      100% { transform: scale(1.9); opacity: 0; }
    }
    .nv-sonar { animation: nv-sonar 2.4s ease-out infinite; }
    @keyframes nv-eq {
      0%, 100% { transform: scaleY(.3); }
      50% { transform: scaleY(1); }
    }
    .nv-eq { animation: nv-eq .9s ease-in-out infinite; transform-origin: bottom; }
    @media (prefers-reduced-motion: reduce) {
      .nv-sonar, .nv-eq { animation: none !important; }
    }
  `}</style>
);

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
      {isMobile && (
        <div
          className="fixed inset-0 bg-transparent z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <div
        className={
          isMobile
            ? "fixed top-16 left-4 right-4 w-[calc(100vw-2rem)] max-h-80 overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-xl py-2 z-50"
            : "absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-xl py-2 z-50"
        }
      >
        {notifications.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-slate-400">
            No notifications yet.
          </p>
        ) : (
          notifications.map((n) => (
            <Link
              key={n.id + n.createdAt}
              href={n.href || "#"}
              onClick={onClose}
              className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
            >
              {n.image ? (
                <img
                  src={n.image}
                  alt=""
                  className="w-9 h-9 rounded-lg object-cover shrink-0"
                />
              ) : (
                <div className="w-9 h-9 rounded-lg bg-slate-100 shrink-0 flex items-center justify-center text-[10px] text-slate-400 font-bold">
                  iM
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-800 truncate">
                  {n.title}
                </p>
                <p className="text-[11px] text-slate-500 truncate">
                  {n.message}
                </p>
              </div>
            </Link>
          ))
        )}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  AirMIDI Link (desktop)                                            */
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
      className={`group relative flex items-center gap-2 text-xs font-semibold uppercase tracking-wider py-1.5 pl-1.5 pr-4 rounded-full ring-1 transition-all duration-200 ${
        active
          ? scrolled
            ? "text-blue-600 bg-blue-50 ring-blue-200"
            : "text-white bg-white/15 backdrop-blur-sm ring-white/30"
          : scrolled
          ? "text-slate-600 hover:text-slate-950 hover:bg-slate-100 ring-indigo-200"
          : "text-white/90 hover:text-white hover:bg-white/10 ring-white/25"
      }`}
    >
      <span className="relative flex h-6 w-6 shrink-0">
        <span
          aria-hidden
          className="nv-sonar absolute inset-0 rounded-full bg-indigo-400/50"
        />
        <img
          src="/airlink-icon.png"
          alt=""
          className="relative h-6 w-6 rounded-full"
          draggable={false}
        />
      </span>
      <span className="relative z-10">{label}</span>
      <span aria-hidden className="flex h-3 items-end gap-[2px]">
        {[0, 0.2, 0.1].map((d, i) => (
          <span
            key={i}
            className={`nv-eq h-full w-[2px] rounded-full ${
              scrolled ? "bg-indigo-500" : "bg-white/80"
            }`}
            style={{ animationDelay: `${d}s` }}
          />
        ))}
      </span>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/*  Desktop Navigation                                                */
/* ------------------------------------------------------------------ */

function DesktopNav({
  scrolled,
  user,
  notifications,
  isNotifOpen,
  unreadCount,
  onToggleNotif,
  onLogout,
}: {
  scrolled: boolean;
  user: { name?: string; email?: string } | null;
  notifications: AppNotification[];
  isNotifOpen: boolean;
  unreadCount: number;
  onToggleNotif: () => void;
  onLogout: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 hidden md:block ${
        scrolled
          ? "bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm h-16"
          : "bg-transparent border-b border-transparent h-20"
      }`}
    >
      <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center group relative py-1">
          <img
            src="/iiimidi.png"
            alt="iMIDI Logo"
            className={`w-auto object-contain transition-all duration-300 ${
              scrolled
                ? "h-[5.25rem]"
                : "h-24 drop-shadow-[0_1px_6px_rgba(0,0,0,0.45)]"
            }`}
          />
          <span
            className={`ml-0.5 inline-block group-hover:scale-125 transition-transform duration-200 font-black text-xl ${
              scrolled ? "text-blue-600" : "text-[#FF5CA1]"
            }`}
          >
            .
          </span>
        </Link>

        {/* Links */}
        <div className="flex items-center space-x-2">
          {links.slice(1).map((l) => {
            if (l.isAirMidi) {
              return (
                <AirMidiDesktopLink
                  key={l.href}
                  href={l.href}
                  label={l.label}
                  active={!!pathname?.startsWith("/airmidi-link")}
                  scrolled={scrolled}
                />
              );
            }

            const active = pathname === l.href;
            const activeClass = scrolled
              ? "text-blue-600 bg-blue-50"
              : "text-white bg-white/15 backdrop-blur-sm";
            const idleClass = scrolled
              ? "text-slate-500 hover:text-slate-950 hover:bg-slate-100"
              : "text-white/80 hover:text-white hover:bg-white/10";

            const className = `text-xs font-semibold uppercase tracking-wider transition-all duration-200 relative py-2 px-4 rounded-full ${
              active ? activeClass : idleClass
            }`;

            if (l.external) {
              return (
                <a
                  key={l.href}
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={className}
                >
                  <span className="relative z-10">{l.label}</span>
                  {l.isNew && (
                    <span className="ml-1.5 px-1.5 py-0.5 text-[8px] font-bold bg-emerald-100 text-emerald-700 rounded-md">
                      NEW
                    </span>
                  )}
                </a>
              );
            }

            return (
              <Link key={l.href} href={l.href} className={className}>
                <span className="relative z-10">{l.label}</span>
                {l.isNew && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-[8px] font-bold bg-emerald-100 text-emerald-700 rounded-md">
                    NEW
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Right side: notifications + auth */}
        <div className="flex items-center space-x-4">
          {user && (
            <div className="relative">
              <button
                onClick={onToggleNotif}
                aria-label="Notificări"
                className={`relative p-2 rounded-full transition-colors ${
                  scrolled
                    ? "text-slate-500 hover:text-slate-950 hover:bg-slate-100"
                    : "text-white/80 hover:text-white hover:bg-white/10"
                }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  strokeWidth="1.8"
                  stroke="currentColor"
                  fill="none"
                  className="w-5 h-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
                  />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#FF5CA1]" />
                )}
              </button>

              <NotificationDropdown
                notifications={notifications}
                isOpen={isNotifOpen}
                onClose={onToggleNotif}
              />
            </div>
          )}

          {user ? (
            <div className="flex items-center space-x-3">
              <Link
                href="/dashboard/cloud-db"
                className="flex items-center space-x-2 group"
              >
                <div
                  className={`w-8 h-8 rounded-full text-white flex items-center justify-center text-xs font-bold uppercase ${
                    scrolled
                      ? "bg-blue-600"
                      : "bg-white/20 backdrop-blur-sm border border-white/30"
                  }`}
                >
                  {(user.name || user.email || "U").charAt(0)}
                </div>
                <span
                  className={`text-xs font-semibold transition-colors max-w-[120px] truncate ${
                    scrolled
                      ? "text-slate-700 group-hover:text-slate-950"
                      : "text-white/90 group-hover:text-white"
                  }`}
                >
                  {user.name || user.email}
                </span>
              </Link>
              <button
                onClick={onLogout}
                className={`text-xs font-semibold uppercase tracking-wider transition-colors ${
                  scrolled
                    ? "text-slate-500 hover:text-slate-950"
                    : "text-white/70 hover:text-white"
                }`}
              >
                Sign Out
              </button>
            </div>
          ) : (
            <>
              <Link
                href="/login"
                className={`text-xs font-semibold uppercase tracking-wider transition-colors ${
                  scrolled
                    ? "text-slate-500 hover:text-slate-950"
                    : "text-white/80 hover:text-white"
                }`}
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className={`text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded-full transition-all transform active:scale-95 shadow-sm ${
                  scrolled
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-white text-[#131316] hover:bg-white/90"
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
      className={`md:hidden fixed top-0 left-0 right-0 w-full h-14 z-50 flex items-center px-5 justify-between transition-all duration-300 transform-gpu [webkit-backdrop-filter:blur(12px)] ${
        scrolled
          ? "bg-white/75 backdrop-blur-md border-b border-slate-200 shadow-sm"
          : "bg-transparent border-b border-transparent"
      }`}
    >
      <Link
        href="/"
        onClick={() => setIsMenuOpen(false)}
        className="flex items-center py-1"
      >
        <img
          src="/iiimidi.png"
          alt="iMIDI Logo"
          className="h-[4.25rem] w-auto object-contain"
        />
        <span className="text-blue-600 ml-0.5 font-black text-lg">.</span>
      </Link>

      <div className="flex items-center gap-2">
        {user && (
          <div className="relative">
            <button
              onClick={onToggleNotif}
              aria-label="Notificări"
              className="relative p-2 text-slate-600 hover:text-slate-900 transition-colors"
            >
              <svg
                viewBox="0 0 24 24"
                strokeWidth="1.8"
                stroke="currentColor"
                fill="none"
                className="w-5 h-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
                />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#FF5CA1]" />
              )}
            </button>

            <NotificationDropdown
              notifications={notifications}
              isOpen={isNotifOpen}
              onClose={onToggleNotif}
              isMobile
            />
          </div>
        )}

        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="p-2 text-slate-600 hover:text-slate-900 focus:outline-none transition-colors"
          aria-label="Toggle Account Menu"
        >
          {user ? (
            <div className="flex items-center gap-1.5">
              <div className="relative w-6 h-6 shrink-0">
                <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center text-[10px] font-bold uppercase">
                  {(user.name || user.email || "U").charAt(0)}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-white" />
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
      className={`md:hidden fixed inset-0 bg-white/98 backdrop-blur-2xl z-40 px-6 flex flex-col justify-center transition-all duration-500 ease-in-out transform ${
        isOpen
          ? "opacity-100 translate-y-0"
          : "opacity-0 -translate-y-4 pointer-events-none"
      }`}
    >
      <div className="absolute top-24 left-6 right-6 border-b border-slate-100 pb-2">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          iMIDI
        </p>
      </div>

      <div className="flex flex-col space-y-6 w-full max-w-sm mx-auto">
        {user ? (
          <>
            <div className="flex flex-col items-center space-y-3 text-center">
              <div className="w-14 h-14 rounded-full bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center text-lg font-bold uppercase">
                {(user.name || user.email || "U").charAt(0)}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {user.name || user.email}
                </p>
                {user.name && (
                  <p className="text-[11px] text-slate-400">{user.email}</p>
                )}
              </div>
            </div>

            <div className="flex flex-col space-y-3">
              <Link
                href="/dashboard/cloud-db"
                onClick={onClose}
                className="w-full text-center py-3.5 rounded-full text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-[0.98] transition-all"
              >
                mySpace
              </Link>
              <button
                onClick={() => {
                  onLogout();
                  onClose();
                }}
                className="w-full text-center py-3 rounded-full text-xs font-medium text-slate-400 hover:text-slate-700 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="text-center space-y-1">
              <h2 className="text-2xl font-black tracking-tight text-slate-950">
                Welcome Back<span className="text-blue-600">.</span>
              </h2>
              <p className="text-xs font-medium text-slate-500">
                Access your cloud space
              </p>
            </div>

            <div className="flex flex-col space-y-3">
              <Link
                href="/login"
                onClick={onClose}
                className="w-full text-center py-3.5 rounded-full text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 active:scale-[0.98] transition-all"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                onClick={onClose}
                className="w-full text-center py-3.5 rounded-full text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98] transition-all shadow-sm"
              >
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
/*  Mobile Bottom Navigation                                          */
/* ------------------------------------------------------------------ */

function MobileBottomNav({
  isVisible,
  onNavigate,
}: {
  isVisible: boolean;
  onNavigate: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav
      className={`md:hidden fixed bottom-5 inset-x-4 z-50 transition-all duration-300 ${
        isVisible
          ? "translate-y-0 opacity-100"
          : "translate-y-28 opacity-0 pointer-events-none"
      }`}
    >
      <div className="bg-white/95 border border-slate-300 backdrop-blur-xl rounded-2xl p-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-between relative">
          {links.map((l) => {
            if (l.isAirMidi) {
              const on = !!pathname?.startsWith("/airmidi-link");
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-label="AirMIDI Link"
                  className="flex flex-col items-center justify-center py-1.5 flex-1 relative group active:scale-95 transition-transform"
                  onClick={onNavigate}
                >
                  <div
                    className={`p-1.5 rounded-xl transition-all duration-200 ${
                      on ? "bg-blue-50/60 scale-105" : ""
                    }`}
                  >
                    <span className="relative block h-5 w-5">
                      <img
                        src="/airlink-icon.png"
                        alt=""
                        draggable={false}
                        className={`h-5 w-5 rounded-full object-cover ${
                          on ? "ring-2 ring-blue-500" : ""
                        }`}
                      />
                      {!on && (
                        <span
                          aria-hidden
                          className="absolute -right-0.5 -top-0.5 flex h-2 w-2"
                        >
                          <span className="nv-sonar absolute inline-flex h-full w-full rounded-full bg-indigo-400" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-500 ring-1 ring-white" />
                        </span>
                      )}
                    </span>
                  </div>
                  <span
                    className={`text-[8px] font-semibold uppercase tracking-wider mt-1 transition-colors duration-200 ${
                      on ? "text-blue-600 font-bold" : "text-slate-600"
                    }`}
                  >
                    AirMIDI
                  </span>
                </Link>
              );
            }

            const cur = pathname === l.href;

            const content = (
              <>
                <div
                  className={`p-2 rounded-xl transition-all duration-200 ${
                    cur
                      ? "text-blue-600 bg-blue-50/60 scale-105"
                      : "text-slate-700 hover:text-slate-950"
                  }`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    strokeWidth={cur ? "1.5" : "2.5"}
                    stroke="currentColor"
                    fill={cur ? "currentColor" : "none"}
                    className="w-4 h-4"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d={l.icon}
                    />
                  </svg>
                </div>
                <span
                  className={`text-[8px] font-semibold uppercase tracking-wider mt-1 transition-colors duration-200 ${
                    cur ? "text-blue-600 font-bold" : "text-slate-600"
                  }`}
                >
                  {l.label}
                </span>
                {l.isNew && !cur && (
                  <span className="absolute top-1.5 right-4 px-1.5 py-0.5 text-[6px] font-bold bg-emerald-100 text-emerald-700 rounded-md scale-90">
                    NEW
                  </span>
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
                  className="flex flex-col items-center justify-center py-1.5 flex-1 relative group active:scale-95 transition-transform"
                  onClick={onNavigate}
                >
                  {content}
                </a>
              );
            }

            return (
              <Link
                key={l.href}
                href={l.href}
                className="flex flex-col items-center justify-center py-1.5 flex-1 relative group active:scale-95 transition-transform"
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
/*  Main Navbar                                                       */
/* ------------------------------------------------------------------ */

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);

  const [user, setUser] = useState<{ name?: string; email?: string } | null>(
    null
  );
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const unreadCount = notifications.filter((n) => !n.read).length;

  // Notifications
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

  // Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({
          name:
            session.user.user_metadata?.full_name ||
            session.user.user_metadata?.name,
          email: session.user.email,
        });
      } else {
        setUser(null);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          setUser({
            name:
              session.user.user_metadata?.full_name ||
              session.user.user_metadata?.name,
            email: session.user.email,
          });
        } else {
          setUser(null);
        }
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  // Scroll (optimizat cu useRef)
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setScrolled(currentScrollY > 15);

      if (currentScrollY > lastScrollY.current && currentScrollY > 60) {
        setIsVisible(false);
        setIsMenuOpen(false);
      } else {
        setIsVisible(true);
      }
      lastScrollY.current = currentScrollY;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsMenuOpen(false);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Body overflow
  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? "hidden" : "unset";
  }, [isMenuOpen]);

  return (
    <>
      <NavStyles />

      {/* Scrim (doar desktop, doar când nu e scrolled) */}
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

      <MobileBottomNav
        isVisible={isVisible}
        onNavigate={() => setIsMenuOpen(false)}
      />
    </>
  );
}