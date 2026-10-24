/**
 * Site-wide search index for imidi.co.uk + docs.imidi.co.uk.
 * Put this file at: lib/search-index.ts
 *
 * Content was taken from the live pages. When you add pages or change prices,
 * edit the entries below (one object per result).
 */

export type SearchGroup = "Pages" | "Answers" | "Docs" | "Listings";

export type SearchEntry = {
  title: string;
  desc: string;
  href: string;
  group: SearchGroup;
  /** extra words people may type (Romanian + English), not shown in the UI */
  keywords?: string;
  external?: boolean;
};

const D = "https://docs.imidi.co.uk";

export const SEARCH_INDEX: SearchEntry[] = [
  /* ---------------------------- Pages ---------------------------- */
  { group: "Pages", title: "Home", href: "/", desc: "iMIDI: premium audio samples, presets and content delivered through the cloud, powered by AI.", keywords: "acasa start platform" },
  { group: "Pages", title: "i-volution Controller", href: "/products", desc: "Universal MIDI controller for accordion with velocity-sensitive SOLO and BASS mapping on any MIDI channel.", keywords: "acordeon accordion hardware controller midi pret price comanda order solo bass" },
  { group: "Pages", title: "AirMIDI Link", href: "/airmidi-link", desc: "Private video calls and live MIDI sessions in the browser. Low-latency, play together in real time.", keywords: "video call apel sesiune live latency licenta license jam" },
  { group: "Pages", title: "E-Market", href: "/e-market", desc: "Buy and sell presets, sound banks, scripts and instruments. Free to list for 14 days.", keywords: "market marketplace cumpara vinde buy sell preset sound bank script korg genos ai smith anunt listing" },
  { group: "Pages", title: "SD Writer", href: "/sd-writer", desc: "Paste a seller link and code, plug in the card and write the package to the SD card with checksum verification. Chrome & Edge.", keywords: "sd card cartela writer scriere checksum link cod" },
  { group: "Pages", title: "MyCloud Storage", href: "/mycloud", desc: "Secure 30 GB container for presets, performance maps and synth patches. €49.90 / year.", keywords: "cloud stocare storage backup sync sincronizare 30gb pret price upgrade" },
  { group: "Pages", title: "mySpace", href: "/dashboard/cloud-db", desc: "Your cloud space: files, presets and device templates.", keywords: "dashboard cont account fisiere files" },
  { group: "Pages", title: "HUB development", href: "/hub-services", desc: "iMIDI HUB development services.", keywords: "dezvoltare services servicii" },
  { group: "Pages", title: "Forum", href: "/stiri", desc: "News and community discussions.", keywords: "stiri news comunitate community discutii" },
  { group: "Pages", title: "Support & Contact", href: "/support", desc: "Get help or contact the iMIDI team.", keywords: "contact ajutor help suport email whatsapp problema" },
  { group: "Pages", title: "Sign In", href: "/login", desc: "Access your cloud space.", keywords: "login autentificare conectare cont" },
  { group: "Pages", title: "Create free account", href: "/register", desc: "One account for TS4X, E-Market, i-volution and MyCloud.", keywords: "register inregistrare sign up cont nou gratuit get started" },
  { group: "Pages", title: "Privacy", href: "/privacy", desc: "Privacy policy.", keywords: "confidentialitate gdpr date cookies" },
  { group: "Pages", title: "Terms", href: "/terms", desc: "Terms of service.", keywords: "termeni conditii legal" },

  /* --------------------------- Answers --------------------------- */
  { group: "Answers", title: "What is TS4X and how is it different from a VST synth?", href: `${D}/ts4x/`, external: true, desc: "A live-performance-first synth engine built around sub-1.8ms latency and .wav sample playback, tuned for stage use.", keywords: "vst plugin difference diferenta" },
  { group: "Answers", title: "Do I need special hardware to use TS4X?", href: `${D}/ts4x/`, external: true, desc: "No. TS4X runs standalone on desktop and mobile. i-volution is optional; any MIDI controller works.", keywords: "hardware necesar requirements" },
  { group: "Answers", title: "How does selling on E-Market work?", href: "/e-market", desc: "Listing is free for the first 14 days, then you can promote it for a small fee. Buyers find you by search or AI Smith and message you directly.", keywords: "vanzare sell listing promovare comision fee" },
  { group: "Answers", title: "How does MyCloud sync work across devices?", href: "/mycloud", desc: "Sound banks, presets and custom maps (including KORG/Genos formats) are backed up to 30 GB and synced to every signed-in device.", keywords: "sincronizare sync backup korg genos" },
  { group: "Answers", title: "Which accordions work with i-volution?", href: "/products", desc: "Any accordion with standard MIDI channels, with velocity mapping across both SOLO and BASS.", keywords: "compatibil compatible acordeon" },
  { group: "Answers", title: "Which synths is i-volution compatible with?", href: `${D}/i-volution/`, external: true, desc: "KORG PA series and TS4X. Uses SysEx for transpose and standard CC07 (volume) and CC11 (bellows expression).", keywords: "korg pa compatibil cc07 cc11 sysex" },
  { group: "Answers", title: "How much does i-volution cost?", href: "/products", desc: "SOLO $949.9 and R + L (SOLO + BASS) $1299.9. Order by email or WhatsApp. 2-year warranty.", keywords: "pret price cost cumpar order garantie warranty comanda" },
  { group: "Answers", title: "Do I need to update the i-volution firmware?", href: `${D}/i-volution/firmware.html`, external: true, desc: "No. The system works out of the box.", keywords: "firmware update actualizare" },
  { group: "Answers", title: "How much is an AirMIDI Link license?", href: "/airmidi-link", desc: "€19.0 for 30 hours.", keywords: "pret price licenta license 19 euro" },
  { group: "Answers", title: "System requirements", href: D, external: true, desc: "Apple Silicon, Intel x86_64 or ARM Cortex-A72; 8GB RAM minimum; 24-bit / 192kHz stereo DAC.", keywords: "cerinte specs procesor ram memorie specificatii" },

  /* ----------------------------- Docs ----------------------------- */
  { group: "Docs", title: "Documentation home", href: `${D}/`, external: true, desc: "Official guides, manuals and specifications for iMIDI.", keywords: "docs manual ghid guide" },
  { group: "Docs", title: "About TS4X Core DSP", href: `${D}/ts4x/`, external: true, desc: "Synth engine with sub-1.8 ms latency, polyphonic synth, 4x16 step sampler, looper and cloud sync.", keywords: "ts4x synth dsp rust tauri looper sampler" },
  { group: "Docs", title: "Desktop & Mobile Installation", href: `${D}/ts4x/instalare.html`, external: true, desc: "Install TS4X on Windows, macOS, Linux and Android.", keywords: "instalare install download windows macos linux android" },
  { group: "Docs", title: "Latency Optimization (<1.8ms)", href: `${D}/ts4x/latenta.html`, external: true, desc: "Get the lowest latency out of TS4X.", keywords: "latenta optimizare buffer audio driver" },
  { group: "Docs", title: "Pro License Management", href: `${D}/ts4x/licentiere.html`, external: true, desc: "Manage your TS4X Pro licenses.", keywords: "licenta licente pro activare license" },
  { group: "Docs", title: "Import Audio Samplers (.wav)", href: `${D}/ts4x/samplers.html`, external: true, desc: "Load .wav files into TS4X tracks.", keywords: "wav sample import sampler" },
  { group: "Docs", title: "Loopers & Step Samplers", href: `${D}/ts4x/loopers.html`, external: true, desc: "Record, play and overdub with the looper; program 16 steps on 4 tracks.", keywords: "looper step sampler overdub" },
  { group: "Docs", title: "i-VOLUTION User Manual", href: `${D}/i-volution/`, external: true, desc: "Official guide for the i-VOLUTION MIDI system for accordion: features, MIDI mapping, versions and ordering.", keywords: "manual acordeon accordion" },
  { group: "Docs", title: "OLED Display Configuration", href: `${D}/i-volution/configurare.html`, external: true, desc: "Configure the 1.8\" OLED display and the multifunction encoder.", keywords: "oled display ecran encoder configurare" },
  { group: "Docs", title: "Mapping SOLO/BASS Accordion", href: `${D}/i-volution/mapping.html`, external: true, desc: "Velocity-sensitive MIDI mapping for the SOLO and BASS sections.", keywords: "mapping solo bass banks bank select" },
  { group: "Docs", title: "Technical Specifications (i-volution)", href: `${D}/i-volution/specificatii.html`, external: true, desc: "Display, power, latency and compatibility details.", keywords: "specificatii specs tehnice" },
  { group: "Docs", title: "MIDI 3.0 Connection Guide", href: `${D}/i-volution/midi-interconnection.html`, external: true, desc: "MIDI controller → TS4X Core DSP → Cloud platform.", keywords: "midi 3.0 conectare interconnection" },
  { group: "Docs", title: "Update Firmware", href: `${D}/i-volution/firmware.html`, external: true, desc: "Firmware information for i-volution.", keywords: "firmware actualizare update" },
  { group: "Docs", title: "Troubleshooting (FAQ)", href: `${D}/i-volution/faq.html`, external: true, desc: "Common questions and fixes for i-volution.", keywords: "probleme erori depanare troubleshooting faq" },
  { group: "Docs", title: "E-Market docs", href: `${D}/e-market/`, external: true, desc: "Guides for buying and selling on E-Market.", keywords: "market ghid vanzare cumparare" },
  { group: "Docs", title: "Cloud & mySpace docs", href: `${D}/cloud/`, external: true, desc: "Guides for MyCloud storage and your mySpace.", keywords: "cloud myspace stocare sync" },
];

/** Shown when the search box is empty. Titles must match entries above. */
export const POPULAR: SearchEntry[] = [
  "i-volution Controller",
  "E-Market",
  "Desktop & Mobile Installation",
  "Latency Optimization (<1.8ms)",
  "MyCloud Storage",
  "Support & Contact",
]
  .map((t) => SEARCH_INDEX.find((e) => e.title === t))
  .filter((e): e is SearchEntry => Boolean(e));

/* --------------------------- search logic --------------------------- */

/** lowercase, strip diacritics (ă→a, ț→t), keep letters/digits only */
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

const PREPARED = SEARCH_INDEX.map((e) => ({
  e,
  t: norm(e.title),
  d: norm(e.desc),
  k: norm(e.keywords ?? ""),
}));

/** Every word typed must appear somewhere; title matches rank highest. */
export function searchSite(query: string, limit = 8): SearchEntry[] {
  const tokens = norm(query).split(" ").filter(Boolean);
  if (tokens.length === 0) return [];

  const scored: { e: SearchEntry; s: number }[] = [];
  for (const p of PREPARED) {
    let total = 0;
    let ok = true;
    for (const tok of tokens) {
      let s = 0;
      if (p.t.startsWith(tok)) s += 8;
      else if (p.t.split(" ").some((w) => w.startsWith(tok))) s += 6;
      else if (p.t.includes(tok)) s += 4;
      if (p.k.split(" ").some((w) => w.startsWith(tok))) s += 3;
      else if (p.k.includes(tok)) s += 2;
      if (p.d.includes(tok)) s += 1;
      if (s === 0) {
        ok = false;
        break;
      }
      total += s;
    }
    if (ok) scored.push({ e: p.e, s: total });
  }
  return scored.sort((a, b) => b.s - a.s).slice(0, limit).map((x) => x.e);
}