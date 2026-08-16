"use client";
import WhatsAppWidget from "@/components/WhatsAppWidget";
import { useEffect, useState } from "react";
import Image from "next/image";
import {
  Globe,
  Boxes,
  Plug,
  PenTool,
  LifeBuoy,
  Cpu,
  Sparkles,
  LayoutDashboard,
  ShoppingCart,
  Blocks,
  ArrowUpRight,
  Plus,
  ArrowRight,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const SERVICES = [
  { tag: "01", name: "Web apps", icon: Globe, detail: "MVP to production-scale platforms. We work with the latest frameworks like next.js, Vite and more", stack: ["Next.js", "Edge", "CDN"] },
  { tag: "02", name: "Mobile apps", icon: Globe, detail: "MVP to production-scale platforms for mobile app ios/android. Also, use the latest technologies combine react native with native app like c++/rust", stack: ["React Native ", "Edge", "CDN"] },
  { tag: "03", name: "Custom software", icon: Boxes, detail: "Internal tools built around your workflow. We can use taur, capacitor or electron frmaework to build your professional app.", stack: ["Node", "Postgres", "Queues"] },
  { tag: "04", name: "Integrations", icon: Plug, detail: "Your systems, talking to each other.", stack: ["REST", "Webhooks", "OAuth"] },
  { tag: "05", name: "Hardware-aware", icon: Cpu, detail: "Software built for the physical layer. CAD soft programs.", stack: ["TS4X", "i-volution", "MyCloud"] },
  { tag: "06", name: "AI & automation", icon: Sparkles, detail: "LLM features and workflows that save time. Automation tasks using AI.  AI Smith it s an example of our platform", stack: ["LLMs", "RAG", "Agents"] },
] as const;

const PORTFOLIO: { name: string; image?: string }[] = [
  { name: "Web Applications" },
  { name: "Dashboards & Internal Tools" },
  { name: "E-commerce" },
  { name: "APIs & Integrations" },
  { name: "Design industrial Systems. Industrial dashboards" },
  { name: "Hardware-aware Software" },
];

const PROCESS = ["Discovery", "Design", "Build", "Ship"];

// TEAM — fill this in. name + role + skills only.
// photo: optional path under /public (e.g. "/team/ana.jpg"). Leave undefined for a monogram.
const TEAM: { name: string; role: string; skills: string[]; photo?: string }[] = [
  { name: "BM ", role: "Lead Engineer, full stack dev", skills: ["React", "Node.js", "PostgreSQL"] },

];

const CODE_LINES = [
  "// hub/services.ts",
  "export const services: Service[] = [",
  '  { id: "web", name: "Web apps", stack: ["Next.js", "Edge"] },',
  '  { id: "app", name: "Custom software", stack: ["Node", "Postgres"] },',
  '  { id: "api", name: "Integrations", stack: ["REST", "Webhooks"] },',
  "];",
  "",
  "export async function createProject(input: ProjectInput) {",
  "  return db.project.create({ data: input });",
  "}",
];

function CodeEditor() {
  const [visibleLines, setVisibleLines] = useState(0);
  const [charCount, setCharCount] = useState(0);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setVisibleLines(CODE_LINES.length);
      return;
    }
    let line = 0;
    let char = 0;
    const interval = setInterval(() => {
      const current = CODE_LINES[line];
      if (current === undefined) {
        clearInterval(interval);
        return;
      }
      if (char < current.length) {
        char += 1;
        setCharCount(char);
      } else {
        line += 1;
        char = 0;
        setVisibleLines(line);
        setCharCount(0);
        if (line >= CODE_LINES.length) clearInterval(interval);
      }
    }, 22);
    return () => clearInterval(interval);
  }, []);

  const highlight = (line: string) => {
    if (line.startsWith("//"))
      return <span className="text-gray-500">{line}</span>;
    return (
      <>
        {line.split(/("(?:[^"\\]|\\.)*"|\b(?:export|const|async|function|return|await)\b)/g).map((part, i) => {
          if (/^".*"$/.test(part)) return <span key={i} className="text-[#E4002B]">{part}</span>;
          if (["export", "const", "async", "function", "return", "await"].includes(part))
            return <span key={i} className="text-[#60A5FA]">{part}</span>;
          return <span key={i}>{part}</span>;
        })}
      </>
    );
  };

  return (
    <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-[#0B0B0B] shadow-2xl">
      <div className="flex items-center gap-2 border-b border-white/10 bg-white/[0.02] px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F56]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#FFBD2E]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#27C93F]" />
        <span className="ml-3 font-mono text-xs text-gray-500">hub/services.ts</span>
      </div>
      <pre className="overflow-x-auto px-5 py-6 font-mono text-[13px] leading-7 text-gray-300 sm:text-sm">
        {CODE_LINES.slice(0, visibleLines).map((l, i) => (
          <div key={i}>{l ? highlight(l) : "\u00A0"}</div>
        ))}
        {visibleLines < CODE_LINES.length && (
          <div>
            {highlight(CODE_LINES[visibleLines]?.slice(0, charCount) ?? "")}
            <span className="text-[#E4002B] motion-safe:animate-pulse">▌</span>
          </div>
        )}
      </pre>
    </div>
  );
}

export default function CreatorHubPage() {
  const [openTag, setOpenTag] = useState<string | null>(null);

  const globeNodes = [
    { cx: 150, cy: 58 },
    { cx: 236, cy: 150 },
    { cx: 92, cy: 206 },
  ];

  return (
    <div className="relative min-h-screen bg-[#060606] text-white font-sans antialiased overflow-x-hidden selection:bg-[#E4002B]/20">
      <style>{`
        @keyframes globe-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .globe-spin { animation: globe-spin 50s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .globe-spin { animation: none; } }
      `}</style>
      {/* Animated subtle grid background — sits behind the dark hero only */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[85vh] bg-[linear-gradient(to_right,#1f1f1f_1px,transparent_1px),linear-gradient(to_bottom,#1f1f1f_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-20 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] motion-safe:animate-[pulse_8s_ease-in-out_infinite]" />

      <Navbar />

      {/* HERO */}
      <section className="relative flex min-h-[85vh] w-full flex-col justify-center px-6 pt-24 sm:px-8">
        {/* Rotating wireframe globe — top right, decorative */}
        <div
          aria-hidden
          className="pointer-events-none absolute right-4 top-4 h-36 w-36 sm:right-8 sm:top-16 sm:h-64 sm:w-64 lg:right-12 lg:top-20 lg:h-80 lg:w-80"
        >
          <div className="globe-spin h-full w-full">
            <svg viewBox="0 0 300 300" className="h-full w-full">
              <circle cx="150" cy="150" r="148" fill="none" stroke="#E4002B" strokeOpacity="0.3" strokeWidth="1.5" />
              <ellipse cx="150" cy="150" rx="148" ry="52" fill="none" stroke="#E4002B" strokeOpacity="0.5" strokeWidth="1.5" />
              <ellipse cx="150" cy="150" rx="148" ry="52" fill="none" stroke="#E4002B" strokeOpacity="0.28" strokeWidth="1.5" transform="rotate(60 150 150)" />
              <ellipse cx="150" cy="150" rx="148" ry="52" fill="none" stroke="#E4002B" strokeOpacity="0.38" strokeWidth="1.5" transform="rotate(120 150 150)" />
              <ellipse cx="150" cy="150" rx="52" ry="148" fill="none" stroke="#E4002B" strokeOpacity="0.28" strokeWidth="1.5" />
              {globeNodes.map((n, i) => (
                <circle
                  key={i}
                  cx={n.cx}
                  cy={n.cy}
                  r="5"
                  fill="#E4002B"
                  className="motion-safe:animate-pulse"
                  style={{ animationDelay: `${i * 0.6}s` }}
                />
              ))}
            </svg>
          </div>
        </div>

        <div className="mx-auto w-full max-w-6xl">

          <h1 className="mb-6 max-w-4xl font-serif text-4xl leading-tight tracking-tight transition-all duration-500 hover:tracking-wide sm:text-6xl md:text-7xl">
            Building{" "}
            <span className="after:content-[''] relative inline-block italic text-[#E4002B] after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-full after:origin-bottom-right after:scale-x-0 after:bg-[#E4002B] after:transition-transform after:duration-300 hover:after:origin-bottom-left hover:after:scale-x-100">
             Reactiq 
            </span>{" "}
            software systems.
          </h1>
          <p className="mb-8 max-w-xl font-light text-lg text-gray-400 transition-colors duration-300 hover:text-gray-300">
            From first idea to production — by the team behind imidi app,
            i-volution, and MyCloud.
          </p>
          <div className="flex gap-4">
            <a
              href="#contact"
              className="group flex transform items-center gap-2 rounded-full bg-white px-6 py-3 font-medium text-black shadow-lg transition-all duration-300 hover:-translate-y-1 hover:bg-[#E4002B] hover:text-white hover:shadow-[#E4002B]/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              Let&apos;s talk
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </a>
          </div>
        </div>
      </section>

      {/* CAPABILITIES — white panel sliding over the dark hero */}
      <section className="relative z-10 rounded-t-[2.5rem] bg-white py-20 text-black shadow-2xl transition-all duration-500 sm:py-24">
        <div className="mx-auto max-w-6xl px-6 sm:px-8">
          <h2 className="mb-10 border-b border-black/10 pb-4 font-serif text-2xl sm:text-3xl">
            Capabilities
          </h2>
          <div className="flex flex-col">
            {SERVICES.map((s) => {
              const Icon = s.icon;
              const isOpen = openTag === s.tag;
              return (
                <div
                  key={s.tag}
                  className="border-b border-black/5 transition-colors duration-300 hover:bg-black/[0.01]"
                >
                  <button
                    onClick={() => setOpenTag(isOpen ? null : s.tag)}
                    aria-expanded={isOpen}
                    className="group flex w-full items-center justify-between py-6 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#E4002B]"
                  >
                    <div className="flex items-center gap-4 sm:gap-6">
                      <span className="font-mono text-xs text-[#E4002B] transition-transform group-hover:scale-110">
                        {s.tag}
                      </span>
                      <span className="transform font-serif text-lg transition-all duration-300 group-hover:translate-x-3 group-hover:text-[#E4002B] sm:text-xl md:text-2xl">
                        {s.name}
                      </span>
                    </div>
                    <div
                      className={`rounded-full border border-black/5 p-2 transition-all duration-300 ${
                        isOpen ? "rotate-45 border-[#E4002B] bg-[#E4002B] text-white" : "bg-black/5"
                      }`}
                    >
                      <Plus className="h-4 w-4" />
                    </div>
                  </button>
                  <div
                    className={`grid transition-all duration-500 ease-in-out ${
                      isOpen ? "grid-rows-[1fr] pb-8 opacity-100" : "grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <div className="flex flex-col gap-3 overflow-hidden pl-9 pb-1 sm:pl-12">
                      <p className="max-w-md text-sm text-gray-500">{s.detail}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Icon className="mr-1 h-5 w-5 text-gray-400 motion-safe:animate-pulse" />
                        {s.stack.map((t) => (
                          <span
                            key={t}
                            className="rounded bg-black/5 px-3 py-1 font-mono text-xs text-gray-600 transition-colors duration-200 hover:bg-black/10"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CODE — dark band between Capabilities and Portfolio */}
      <section className="bg-[#0F0F0F] py-20 sm:py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 sm:px-8 lg:grid-cols-2 lg:gap-16">
          <div>
            <span className="mb-4 inline-block font-mono text-xs uppercase tracking-widest text-[#E4002B]">
              How it&apos;s built
            </span>
            <h2 className="mb-4 font-serif text-3xl leading-tight tracking-tight sm:text-4xl">
              Real code,
              <br />
              <span className="italic text-[#E4002B]">not slideware.</span>
            </h2>
            <p className="max-w-sm font-light text-gray-400">
              Typed, tested, and shipped — every project starts as code you
              can actually read.
            </p>
          </div>
          <div className="flex justify-center lg:justify-end">
            <CodeEditor />
          </div>
        </div>
      </section>

      {/* PORTFOLIO — pop-out cards */}
      <section className="border-t border-black/5 bg-white py-20 text-black">
        <div className="mx-auto max-w-6xl px-6 sm:px-8">
          <h2 className="mb-10 font-serif text-2xl sm:text-3xl">Selected Work</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PORTFOLIO.map((item) => (
              <div
                key={item.name}
                className="group relative flex h-44 transform cursor-pointer flex-col justify-between overflow-hidden rounded-2xl border border-black/5 bg-black/[0.02] p-6 transition-all duration-300 hover:-translate-y-2 hover:border-black/10 hover:bg-black/[0.05] hover:shadow-xl hover:shadow-black/5"
              >
                {item.image && (
                  <>
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      className="object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  </>
                )}
                <ArrowUpRight className="relative z-10 h-5 w-5 translate-y-2 self-end text-[#E4002B] opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100" />
                <div className="relative z-10">
                  <h3 className="font-serif text-lg text-black transition-colors duration-300 group-hover:text-white">
                    {item.name}
                  </h3>
                  <div className="mt-2 h-[2px] w-0 bg-[#E4002B] transition-all duration-300 group-hover:w-8" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROCESS — back to dark */}
      <section className="bg-[#0F0F0F] py-24">
        <div className="mx-auto max-w-6xl px-6 sm:px-8">
          <h2 className="mb-16 text-center font-serif text-2xl sm:text-3xl">Workflow</h2>
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {PROCESS.map((p, i) => (
              <div
                key={p}
                className="group transform border-t border-white/10 pt-6 transition-all duration-500 hover:-translate-y-1 hover:border-[#E4002B]"
              >
                <span className="mb-2 block font-mono text-xs text-white/30 transition-colors group-hover:text-[#E4002B]">
                  0{i + 1}
                </span>
                <h3 className="font-serif text-lg tracking-wide text-gray-300 transition-colors group-hover:text-white">
                  {p}
                </h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TEAM — white */}
      <section className="bg-white py-24 text-black">
        <div className="mx-auto max-w-6xl px-6 sm:px-8">
          <h2 className="mb-12 font-serif text-2xl sm:text-3xl">The Team</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {TEAM.map((t) => (
              <div
                key={t.name}
                className="group flex transform items-center gap-5 rounded-2xl border border-black/5 bg-black/[0.02] p-5 transition-all duration-300 hover:scale-[1.01] hover:border-black/10 hover:bg-black/[0.04]"
              >
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-black/5 transition-all duration-300 group-hover:bg-[#E4002B]/10">
                  {t.photo ? (
                    <Image src={t.photo} alt={t.name} fill className="object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center font-mono font-bold text-gray-500 transition-colors duration-300 group-hover:text-[#E4002B]">
                      {t.name
                        .split(" ")
                        .map((p) => p[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <h4 className="font-serif text-lg font-medium transition-colors group-hover:text-[#E4002B]">
                    {t.name}
                  </h4>
                  <p className="mt-0.5 font-mono text-xs uppercase tracking-wider text-[#E4002B]">
                    {t.role}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                    {t.skills.map((s) => (
                      <span key={s} className="font-mono text-[11px] text-gray-500">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT — dark */}
      <section
        id="contact"
        className="relative overflow-hidden bg-[#060606] py-24 text-center"
      >
        <h2 className="mb-8 font-serif text-4xl tracking-tight sm:text-5xl md:text-7xl">
          Let&apos;s{" "}
          <span className="italic text-[#E4002B] motion-safe:animate-pulse">
            build
          </span>{" "}
          together.
        </h2>
        <a
          href="mailto:marius_service@yahoo.com"
          className="group inline-flex items-center gap-3 border-b border-white/10 pb-2 text-lg text-gray-400 transition-all duration-300 hover:border-[#E4002B] hover:text-white sm:text-xl md:text-2xl"
        >
          e-mailing
          <ArrowUpRight className="h-5 w-5 transform text-[#E4002B] transition-transform duration-300 group-hover:-translate-y-1 group-hover:translate-x-1" />
        </a>
      </section>
     <WhatsAppWidget />
      <Footer />
    </div>
  );
}