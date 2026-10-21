"use client";

import React, { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
// adjust the path if CookieBanner lives elsewhere
import { openCookieSettings, CONSENT_CATEGORIES, SESSION_FIELDS } from "@/components/CookieBanner";

const LAST_UPDATED = "July 2026";
const CONTACT_EMAIL = "contact@imidi.ro";
const LICENSING_EMAIL = "licensing@imidi.ro";
// Legal name and registered address of the data controller. Empty string hides the line.
const CONTROLLER = "";

/* ───────────── small pieces ───────────── */
function CookieIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5z" />
      <path d="M8.5 8.5v.01M16 15.5v.01M12 12v.01M11 17v.01M7 13v.01" />
    </svg>
  );
}

function SettingsButton({ children, variant = "solid" }: { children: React.ReactNode; variant?: "solid" | "outline" }) {
  return (
    <button
      type="button"
      onClick={openCookieSettings}
      className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0070F3] focus-visible:ring-offset-2 ${
        variant === "solid" ? "bg-black text-white hover:bg-[#333]" : "border border-[#D4D4D4] bg-white text-black hover:bg-[#F2F2F2]"
      }`}
    >
      <CookieIcon />
      {children}
    </button>
  );
}

const P = ({ children }: { children: React.ReactNode }) => <p className="max-w-[68ch] text-sm leading-relaxed text-[#555]">{children}</p>;

const UL = ({ items }: { items: React.ReactNode[] }) => (
  <ul className="max-w-[68ch] list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-[#555] marker:text-[#BDBDBD]">
    {items.map((it, i) => (
      <li key={i}>{it}</li>
    ))}
  </ul>
);

const Mail = ({ to }: { to: string }) => (
  <a href={`mailto:${to}`} className="font-medium text-[#0070F3] underline-offset-2 hover:underline">
    {to}
  </a>
);

/* ───────────── cookie table, built from the same data as the panel ───────────── */
function StorageTable() {
  const rows = [
    {
      name: "Required storage",
      text: "Sign-in session, account security, the 6-digit pairing code and your consent record.",
      kept: "Session, and until you clear site data",
      state: "Always on",
    },
    ...CONSENT_CATEGORIES.map((c) => ({ name: c.title, text: c.text, kept: c.kept, state: "Off until you allow it" })),
  ];
  return (
    <div className="overflow-x-auto rounded-xl border border-[#EAEAEA]">
      <table className="w-full min-w-[640px] text-left text-[13px]">
        <thead className="bg-[#FAFAFA] text-xs text-[#666]">
          <tr>
            <th className="px-4 py-3 font-medium">Purpose</th>
            <th className="px-4 py-3 font-medium">What it does</th>
            <th className="px-4 py-3 font-medium">Kept</th>
            <th className="px-4 py-3 font-medium">Default</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#EAEAEA] bg-white align-top">
          {rows.map((r) => (
            <tr key={r.name}>
              <td className="px-4 py-3 font-semibold text-black">{r.name}</td>
              <td className="px-4 py-3 leading-relaxed text-[#555]">{r.text}</td>
              <td className="px-4 py-3 text-[#555]">{r.kept}</td>
              <td className="px-4 py-3 text-[#555]">{r.state}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ───────────── sections ───────────── */
const SECTIONS: { id: string; title: string; body: React.ReactNode }[] = [
  {
    id: "who-we-are",
    title: "Who we are",
    body: (
      <>
        <P>
          This policy covers the iMIDI services: TS4X, i-volution, MyCloud and AirMIDI Link, including private video calls and live MIDI sessions on
          imidi.co.uk.
        </P>
        {CONTROLLER && <P>Data controller: {CONTROLLER}</P>}
        <P>
          For any question about your data, write to <Mail to={CONTACT_EMAIL} />.
        </P>
      </>
    ),
  },
  {
    id: "data-collection",
    title: "Data we collect",
    body: (
      <>
        <P>We collect only what a service needs to work:</P>
        <UL
          items={[
            <>
              <strong className="font-semibold text-black">Account data.</strong> Your email and sign-in details when you create an account.
            </>,
            <>
              <strong className="font-semibold text-black">Support messages.</strong> The email address and message you send to{" "}
              <Mail to={CONTACT_EMAIL} />.
            </>,
            <>
              <strong className="font-semibold text-black">Billing details.</strong> What licensing and bulk hardware orders require, handled via{" "}
              <Mail to={LICENSING_EMAIL} />.
            </>,
            <>
              <strong className="font-semibold text-black">AirMIDI Link session details.</strong> For each session:{" "}
              {SESSION_FIELDS.map(([k]) => k.toLowerCase()).join(", ")}, linked to your account.
            </>,
            <>
              <strong className="font-semibold text-black">Artwork you upload.</strong> Pack covers and artwork you choose to publish.
            </>,
          ]}
        />
      </>
    ),
  },
  {
    id: "airmidi-link",
    title: "AirMIDI Link: calls, MIDI and photos",
    body: (
      <>
        <P>
          Camera, microphone and MIDI access are not cookies. They stay off until you press the matching button, and your browser asks for permission
          separately. You can revoke each one at any time in your browser&apos;s site settings.
        </P>
        <UL
          items={[
            "Video and voice travel directly between the people in the session, encrypted.",
            "iMIDI does not record or store video or voice, and does not use face or voice recognition.",
            "MIDI messages, including SysEx if you allow it, reach the other person only while the session is live.",
            "The Photo button saves a picture on your device. It is uploaded to a public link only if you press Share with a live picture.",
          ]}
        />
      </>
    ),
  },
  {
    id: "cookies",
    title: "Cookies and local storage",
    body: (
      <>
        <P>
          Required storage is always on because the site cannot work without it. Everything else is off until you choose it, and choosing is never
          required to use the site. Your consent is stored on your device and we ask again whenever the purposes below change.
        </P>
        <StorageTable />
        <div className="flex flex-col gap-3 rounded-xl border border-[#EAEAEA] bg-[#FAFAFA] p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-[52ch] text-[13px] leading-relaxed text-[#555]">
            You can review, change or withdraw your choices at any time, here or with the cookie icon at the bottom left of every page.
          </p>
          <SettingsButton>Manage cookie settings</SettingsButton>
        </div>
      </>
    ),
  },
  {
    id: "data-usage",
    title: "How we use your information",
    body: (
      <P>
        The data we collect is used to deliver the services you request, process bulk orders, provide technical support, count your AirMIDI Link
        hours, and improve our hardware products and cloud infrastructure. Anonymous analytics are used only if you allow them.
      </P>
    ),
  },
  {
    id: "data-sharing",
    title: "Third-party sharing",
    body: (
      <P>
        We do not sell, trade or otherwise transfer your personal data to outside parties. This does not include trusted third parties who help us run
        the website or serve you, as long as they agree to keep the information confidential.
      </P>
    ),
  },
  {
    id: "data-security",
    title: "Information security",
    body: (
      <P>
        We use industry-standard measures to protect your personal information. Connections are encrypted, and databases are accessible only to a
        limited number of people with special access rights.
      </P>
    ),
  },
  {
    id: "user-rights",
    title: "Your rights",
    body: (
      <>
        <P>You can ask us at any time to:</P>
        <UL
          items={[
            "give you access to your personal data,",
            "correct it, or delete it permanently from our systems,",
            "restrict or object to how it is used, and receive a copy of it,",
            "stop optional storage by withdrawing your consent in the cookie settings.",
          ]}
        />
        <P>
          Write to <Mail to={CONTACT_EMAIL} />. You also have the right to complain to your data protection authority (in Romania: ANSPDCP).
        </P>
      </>
    ),
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: (
      <P>
        When we change what we collect or why, we update this page and the date above. If the purposes of optional storage change, the cookie panel opens
        again so you can choose again.
      </P>
    ),
  },
];

/* ───────────── page ───────────── */
export default function PrivacyPolicyPage() {
  const [active, setActive] = useState(SECTIONS[0].id);

  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.id);
      },
      { rootMargin: "-20% 0px -65% 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-[#FAFAFA] text-[#111] antialiased selection:bg-[#0070F3]/10 selection:text-[#0070F3]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap');
        .corp-sans { font-family: 'Inter', sans-serif; }
        .corp-mono { font-family: 'JetBrains Mono', monospace; }
        html { scroll-behavior: smooth; }
        @media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }
      `}</style>

      <Navbar />

      {/* header */}
      <div className="corp-sans border-b border-[#EAEAEA] bg-white pb-10 pt-28 sm:pt-32">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-5 sm:px-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-black sm:text-3xl">Privacy Policy</h1>
            <p className="text-sm leading-relaxed text-[#666]">
              Last updated: {LAST_UPDATED}. How iMIDI handles your information across TS4X, i-volution, MyCloud and AirMIDI Link.
            </p>
          </div>
          <SettingsButton>Cookie settings</SettingsButton>
        </div>
      </div>

      {/* content */}
      <div className="corp-sans mx-auto flex w-full max-w-5xl flex-1 gap-10 px-5 py-8 sm:px-6 sm:py-10">
        {/* table of contents, desktop */}
        <aside className="hidden w-56 shrink-0 lg:block">
          <nav aria-label="On this page" className="sticky top-28">
            <p className="mb-3 text-xs font-semibold text-black">On this page</p>
            <ul className="space-y-0.5 border-l border-[#EAEAEA]">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    aria-current={active === s.id ? "true" : undefined}
                    className={`-ml-px block border-l py-1.5 pl-4 text-[13px] transition-colors ${
                      active === s.id ? "border-[#0070F3] font-semibold text-black" : "border-transparent text-[#666] hover:text-black"
                    }`}
                  >
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <main className="min-w-0 flex-1 space-y-6">
          <div className="space-y-9 rounded-xl border border-[#EAEAEA] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] sm:p-8">
            {SECTIONS.map((s, i) => (
              <section
                key={s.id}
                id={s.id}
                className="scroll-mt-28 space-y-3 border-b border-[#EAEAEA] pb-9 last:border-0 last:pb-0"
              >
                <h2 className="text-base font-semibold tracking-tight text-black">
                  {i + 1}. {s.title}
                </h2>
                {s.body}
              </section>
            ))}
          </div>

          <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-dashed border-[#D4D4D4] bg-[#FAFAFA] p-5 sm:flex-row sm:items-center">
            <div className="space-y-1">
              <h3 className="text-xs font-semibold text-black">Questions about this policy?</h3>
              <p className="text-xs text-[#666]">Our data protection team is here to clarify any concern.</p>
            </div>
            <a href={`mailto:${CONTACT_EMAIL}`} className="corp-mono shrink-0 text-xs font-semibold text-[#0070F3] hover:underline">
              {CONTACT_EMAIL}
            </a>
          </div>
        </main>
      </div>

      <Footer />
    </div>
  );
}