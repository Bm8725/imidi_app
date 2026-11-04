'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import KeyMap from '@/components/KeyMap';
import Footer from '@/components/Footer2';
import ZoneTable, { fieldClass, focusRing } from '@/components/ZoneTable';
import SampleLibrary from '@/components/SampleLibrary';
import SampleEditor from '@/components/SampleEditor';
import RightsPanel from '@/components/RightsPanel';
import PlayPanel from '@/components/PlayPanel';
import WelcomeDialog from '@/components/WelcomeDialog';
import BuildOverlay, { BuildState } from '@/components/BuildOverlay';
import {
  BankInstrument,
  BankModel,
  BankSample,
  BankZone,
  compileWbnk,
  createDefaultBank,
  createDownloadSink,
  createFileSink,
  createZone,
  estimateSize,
  formatBytes,
  parseWbnk,
  readWav,
  uid,
  validateBank,
} from '@/lib/wbnk-compiler';
import { ENVELOPE_PRESETS, INSTRUMENT_PRESETS, RootMode, autoMapZones, commonName, resolveRootKey } from '@/lib/wbnk-presets';
import { Capabilities, detectCapabilities } from '@/lib/wbnk-browser';

type Tab = 'instruments' | 'samples' | 'play' | 'rights';

interface LogEntry {
  time: string;
  message: string;
  level: 'info' | 'ok' | 'error';
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'imidi-bank';

const slot = (i: number) => String(i).padStart(3, '0');

const btnPlain = `rounded-sm border border-[color:var(--field-line)] bg-[color:var(--surface)] px-3 py-2 text-sm font-medium text-[color:var(--ink)] transition-[border-color,transform] hover:border-[color:var(--ink)] active:scale-[0.98] disabled:cursor-not-allowed disabled:text-[color:var(--muted)] disabled:active:scale-100 ${focusRing}`;
const toolBtn = `inline-flex shrink-0 items-center gap-2 rounded-sm px-3 py-1.5 text-sm font-medium text-[color:var(--ink)] transition-colors hover:bg-[color:var(--line-soft)] active:scale-[0.98] disabled:cursor-not-allowed disabled:text-[color:var(--muted)] disabled:hover:bg-transparent ${focusRing}`;

const LIGHT_VARS = `
  color-scheme: light;
  --bg: #F2F3F5; --surface: #FFFFFF; --ink: #15181D; --ink-2: #3A404A; --muted: #5A6270;
  --line: #D7DAE0; --line-soft: #E4E6EB; --field-line: #C5C9D1; --hover: #F7F8F9;
  --accent: #A61E2B; --accent-fill: #A61E2B; --accent-hover: #8E1823;
  --brass: #9C7A3C; --brass-ink: #4A3A18;
  --surface-rgb: 255 255 255; --accent-rgb: 166 30 43; --brass-rgb: 156 122 60; --muted-rgb: 90 98 112; --ink-rgb: 21 24 29;
  --key-white: #FFFFFF; --key-black: #15181D; --key-line: rgb(21 24 29 / 0.2); --key-edge: #15181D;
`;
const DARK_VARS = `
  color-scheme: dark;
  --bg: #0F1114; --surface: #171A1F; --ink: #E8EAED; --ink-2: #C3C8D0; --muted: #9AA3B0;
  --line: #2C323B; --line-soft: #232830; --field-line: #3A414C; --hover: #1D2128;
  --accent: #E5606C; --accent-fill: #B3222F; --accent-hover: #C42A38;
  --brass: #C9A25A; --brass-ink: #EAD7A8;
  --surface-rgb: 23 26 31; --accent-rgb: 229 96 108; --brass-rgb: 201 162 90; --muted-rgb: 154 163 176; --ink-rgb: 232 234 237;
  --key-white: #D9DCE2; --key-black: #0B0C0E; --key-line: rgb(0 0 0 / 0.45); --key-edge: #3A414C;
`;
const THEME_CSS = `
.wbnk-root { ${LIGHT_VARS} }
.wbnk-root[data-theme='light'] { ${LIGHT_VARS} }
.wbnk-root[data-theme='dark'] { ${DARK_VARS} }
@media (prefers-color-scheme: dark) { .wbnk-root[data-theme='auto'] { ${DARK_VARS} } }

@keyframes wbnk-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
@keyframes wbnk-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes wbnk-sweep { from { transform: translateX(-130%) skewX(-18deg); } to { transform: translateX(130%) skewX(-18deg); } }
@keyframes wbnk-glow { 0% { box-shadow: 0 0 0 0 rgb(var(--accent-rgb) / 0.4); } 70% { box-shadow: 0 0 0 10px rgb(var(--accent-rgb) / 0); } 100% { box-shadow: 0 0 0 0 rgb(var(--accent-rgb) / 0); } }

.wbnk-panel:not([hidden]) { animation: wbnk-rise 0.34s cubic-bezier(0.2, 0.7, 0.2, 1) both; }
.wbnk-in { animation: wbnk-rise 0.32s cubic-bezier(0.2, 0.7, 0.2, 1) both; }
.wbnk-fade { animation: wbnk-fade 0.2s ease both; }
.wbnk-build:not(:disabled) { animation: wbnk-glow 3s ease-out infinite; }
.wbnk-build .wbnk-shimmer { background: linear-gradient(105deg, transparent 35%, rgb(255 255 255 / 0.28) 50%, transparent 65%); transform: translateX(-130%) skewX(-18deg); }
.wbnk-build:hover:not(:disabled) .wbnk-shimmer { animation: wbnk-sweep 1.1s ease; }

@media (prefers-reduced-motion: reduce) {
  .wbnk-root *, .wbnk-root *::before, .wbnk-root *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
  }
}
`;
type Theme = 'auto' | 'light' | 'dark';
const THEME_KEY = 'imidi-wbnk-theme';
const WELCOME_KEY = 'imidi-wbnk-welcome';

function Icon({ d }: { d: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
const ICONS = {
  file: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z M14 3v5h5 M12 12v6 M9 15h6',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  wave: 'M3 12h1 M7 8v8 M11 4v16 M15 8v8 M19 10v4 M21 12h0',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M9.6 9.2a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1.1.9-1.1 1.7 M12 17h.01',
  play: 'M7 4.5v15l12-7.5z',
};

/** Counts up or down to the new number instead of jumping. */
function AnimatedNumber({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const last = useRef(value);
  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || last.current === value) {
      last.current = value;
      setShown(value);
      return;
    }
    const from = last.current;
    const t0 = performance.now();
    let id = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / 380);
      const v = Math.round(from + (value - from) * (1 - Math.pow(1 - k, 3)));
      last.current = v;
      setShown(v);
      if (k < 1) id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [value]);
  return <>{shown}</>;
}

export default function WbnkBankManagerPage() {
  const [bank, setBank] = useState<BankModel>(() => createDefaultBank());
  const [tab, setTab] = useState<Tab>('instruments');
  const [theme, setTheme] = useState<Theme>('auto');
  const [selInst, setSelInst] = useState<string | null>(null);
  const [selZone, setSelZone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [build, setBuild] = useState<BuildState | null>(null);
  const [importing, setImporting] = useState<{ done: number; total: number } | null>(null);
  const [rootMode, setRootMode] = useState<RootMode>('auto');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [welcome, setWelcome] = useState(false);
  const [welcomeHidden, setWelcomeHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });
  const [logs, setLogs] = useState<LogEntry[]>([
    { time: new Date().toLocaleTimeString('en-GB'), message: 'Ready. Edit the bank, or open an existing .wbnk file.', level: 'info' },
  ]);
  const logRef = useRef<HTMLOListElement>(null);
  const openRef = useRef<HTMLInputElement>(null);
  const wavRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastPaint = useRef({ time: 0, message: '' });
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const instrument: BankInstrument | undefined = bank.instruments.find((i) => i.id === selInst) ?? bank.instruments[0];
  const instrumentIndex = instrument ? bank.instruments.indexOf(instrument) : -1;
  const editing = bank.samples.find((s) => s.id === editingId);
  const issues = useMemo(() => validateBank(bank), [bank]);
  const errors = issues.filter((i) => i.level === 'error');
  const warnings = issues.filter((i) => i.level === 'warn');
  const size = useMemo(() => estimateSize(bank), [bank]);
  const zoneTotal = bank.instruments.reduce((n, i) => n + i.zones.length, 0);
  const syntError = issues.some((i) => i.message.startsWith('Synth presets'));
  const usage = useMemo(() => {
    const m = new Map<string, number>();
    for (const ins of bank.instruments) for (const z of ins.zones) if (z.sampleId) m.set(z.sampleId, (m.get(z.sampleId) ?? 0) + 1);
    return m;
  }, [bank.instruments]);
  const writtenSamples = bank.samples.filter((smp) => usage.has(smp.id)).length;

  /* startup: theme, browser check, welcome */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === 'light' || saved === 'dark' || saved === 'auto') setTheme(saved);
      const hidden = localStorage.getItem(WELCOME_KEY) === 'hidden';
      setWelcomeHidden(hidden);
      setWelcome(!hidden);
    } catch {
      setWelcome(true);
    }
    setCaps(detectCapabilities());
  }, []);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 4);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  // sliding underline under the active tab
  useEffect(() => {
    const measure = () => {
      const el = tabRefs.current[tab];
      if (el) setIndicator({ left: el.offsetLeft, width: el.offsetWidth });
    };
    measure();
    (document as any).fonts?.ready?.then(measure);
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [tab, bank.instruments.length, bank.samples.length]);

  const changeTheme = (t: Theme) => {
    setTheme(t);
    try {
      localStorage.setItem(THEME_KEY, t);
    } catch {
      /* storage unavailable */
    }
  };

  const closeWelcome = (hide: boolean) => {
    setWelcome(false);
    setWelcomeHidden(hide);
    try {
      if (hide) localStorage.setItem(WELCOME_KEY, 'hidden');
      else localStorage.removeItem(WELCOME_KEY);
    } catch {
      /* storage unavailable */
    }
  };

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [logs]);

  const log = (message: string, level: LogEntry['level'] = 'info') =>
    setLogs((prev) => [...prev.slice(-300), { time: new Date().toLocaleTimeString('en-GB'), message, level }]);

  /* ── bank properties ── */
  const setMeta = (key: string, value: unknown) => setBank((b) => ({ ...b, meta: { ...b.meta, [key]: value } }));

  const newBank = () => {
    if (!window.confirm('Start a new bank? Unsaved changes will be lost.')) return;
    setBank(createDefaultBank());
    setSelInst(null);
    setSelZone(null);
    log('Started a new bank.');
  };

  /* ── instruments ── */
  const patchInstrument = (id: string, fn: (i: BankInstrument) => BankInstrument) =>
    setBank((b) => ({ ...b, instruments: b.instruments.map((i) => (i.id === id ? fn(i) : i)) }));

  const selectInstrument = (id: string, zoneId: string | null = null) => {
    setSelInst(id);
    setSelZone(zoneId);
  };

  const addFromPreset = (presetId: string) => {
    const preset = INSTRUMENT_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    const ins: BankInstrument = { id: uid(), name: preset.name, zones: preset.zones() };
    setBank((b) => ({ ...b, instruments: [...b.instruments, ins] }));
    selectInstrument(ins.id);
    log(`Added “${preset.name}” from preset as instrument ${slot(bank.instruments.length)}.`, 'ok');
  };

  const duplicateInstrument = () => {
    if (!instrument) return;
    const copy: BankInstrument = { id: uid(), name: `${instrument.name} copy`, zones: instrument.zones.map((z) => ({ ...z, id: uid() })) };
    setBank((b) => ({ ...b, instruments: [...b.instruments, copy] }));
    selectInstrument(copy.id);
  };

  const removeInstrument = () => {
    if (!instrument) return;
    if (!window.confirm(`Remove “${instrument.name}” and its ${instrument.zones.length} zone(s)? Instruments after it move up one slot.`)) return;
    setBank((b) => ({ ...b, instruments: b.instruments.filter((i) => i.id !== instrument.id) }));
    setSelInst(null);
    setSelZone(null);
  };

  const moveInstrument = (dir: -1 | 1) => {
    if (!instrument) return;
    setBank((b) => {
      const list = [...b.instruments];
      const i = list.findIndex((x) => x.id === instrument.id);
      const j = i + dir;
      if (j < 0 || j >= list.length) return b;
      [list[i], list[j]] = [list[j], list[i]];
      return { ...b, instruments: list };
    });
  };

  const applyEnvelope = (presetId: string) => {
    const env = ENVELOPE_PRESETS.find((e) => e.id === presetId);
    if (!env || !instrument) return;
    patchInstrument(instrument.id, (ins) => ({
      ...ins,
      zones: ins.zones.map((z) => ({ ...z, attack: env.attack, decay: env.decay, sustain: env.sustain, release: env.release })),
    }));
    log(`Applied “${env.label}” envelope to all zones of “${instrument.name}”.`, 'ok');
  };

  /* ── zones ── */
  const patchZone = (zoneId: string, patch: Partial<BankZone>) => {
    if (!instrument) return;
    patchInstrument(instrument.id, (ins) => ({
      ...ins,
      zones: ins.zones.map((z) => {
        if (z.id !== zoneId) return z;
        const next = { ...z, ...patch };
        if ('keyLo' in patch && next.keyLo > next.keyHi) next.keyHi = next.keyLo;
        if ('keyHi' in patch && next.keyHi < next.keyLo) next.keyLo = next.keyHi;
        if ('velLo' in patch && next.velLo > next.velHi) next.velHi = next.velLo;
        if ('velHi' in patch && next.velHi < next.velLo) next.velLo = next.velHi;
        return next;
      }),
    }));
  };

  const addZone = () => {
    if (!instrument) return;
    const z = createZone();
    patchInstrument(instrument.id, (ins) => ({ ...ins, zones: [...ins.zones, z] }));
    setSelZone(z.id);
  };

  const duplicateZone = (id: string) => {
    if (!instrument) return;
    const source = instrument.zones.find((z) => z.id === id);
    if (!source) return;
    const copy = { ...source, id: uid() };
    patchInstrument(instrument.id, (ins) => {
      const zones = [...ins.zones];
      zones.splice(zones.findIndex((z) => z.id === id) + 1, 0, copy);
      return { ...ins, zones };
    });
    setSelZone(copy.id);
  };

  const removeZone = (id: string) => {
    if (!instrument) return;
    patchInstrument(instrument.id, (ins) => ({ ...ins, zones: ins.zones.filter((z) => z.id !== id) }));
    if (selZone === id) setSelZone(null);
  };

  /* ── samples ── */
  const importWavs = async (incoming: File[]) => {
    const files = incoming.filter((f) => /\.wav$/i.test(f.name));
    const skipped = incoming.length - files.length;
    if (skipped > 0) log(`Skipped ${skipped} file(s) that are not .wav.`, 'error');
    if (files.length === 0) return;

    setBusy(true);
    const added: BankSample[] = [];
    let found = 0;
    let looped = 0;
    for (let i = 0; i < files.length; i++) {
      setImporting({ done: i, total: files.length });
      try {
        const s = await readWav(files[i]);
        const key = resolveRootKey(s, rootMode);
        if (key !== null) {
          s.rootKey = key;
          found++;
        } else {
          s.rootKey = 60;
        }
        if (s.loopMode) looped++;
        added.push(s);
      } catch (e: any) {
        log(e.message ?? String(e), 'error');
      }
    }
    setImporting(null);
    setBusy(false);
    if (added.length === 0) return;

    const targetId = instrument?.id;
    setBank((b) => {
      const queue = added.length <= 64 ? [...added] : [];
      return {
        ...b,
        samples: [...b.samples, ...added],
        instruments: b.instruments.map((ins) =>
          ins.id !== targetId
            ? ins
            : { ...ins, zones: ins.zones.map((z) => (z.sampleId === null && queue.length ? { ...z, sampleId: queue.shift()!.id } : z)) }
        ),
      };
    });
    log(
      `Imported ${added.length} sample(s). Root key found for ${found}${found < added.length ? `, the other ${added.length - found} default to C4` : ''}.${looped ? ` ${looped} came with loop points.` : ''}`,
      'ok'
    );
  };

  const patchSample = (id: string, patch: Partial<BankSample>) =>
    setBank((b) => ({ ...b, samples: b.samples.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));

  const removeSamples = (ids: string[]) => {
    const drop = new Set(ids);
    setBank((b) => ({
      ...b,
      samples: b.samples.filter((s) => !drop.has(s.id)),
      instruments: b.instruments.map((ins) => ({ ...ins, zones: ins.zones.map((z) => (z.sampleId && drop.has(z.sampleId) ? { ...z, sampleId: null } : z)) })),
    }));
    log(`Removed ${ids.length} sample(s).`, 'ok');
  };

  const detectRoots = (ids: string[]) => {
    const want = new Set(ids);
    const count = bank.samples.filter((s) => want.has(s.id) && resolveRootKey(s, rootMode) !== null).length;
    setBank((b) => ({
      ...b,
      samples: b.samples.map((s) => {
        const key = want.has(s.id) ? resolveRootKey(s, rootMode) : null;
        return key === null ? s : { ...s, rootKey: key };
      }),
    }));
    log(`Root key found for ${count} of ${ids.length} sample(s).`, count ? 'ok' : 'info');
  };

  const mapToInstrument = (ids: string[], lo: number, hi: number) => {
    if (!instrument) return;
    const chosen = bank.samples.filter((s) => ids.includes(s.id));
    const zones = autoMapZones(chosen, lo, hi);
    patchInstrument(instrument.id, (ins) => ({ ...ins, zones: [...ins.zones, ...zones] }));
    selectInstrument(instrument.id);
    setTab('instruments');
    log(`Mapped ${chosen.length} sample(s) into “${instrument.name}” as ${zones.length} zone(s).`, 'ok');
  };

  const createInstrumentFromSamples = (ids: string[], lo: number, hi: number) => {
    const chosen = bank.samples.filter((s) => ids.includes(s.id));
    const zones = autoMapZones(chosen, lo, hi);
    const name = commonName(chosen) ?? `Instrument ${bank.instruments.length + 1}`;
    const ins: BankInstrument = { id: uid(), name, zones };
    setBank((b) => ({ ...b, instruments: [...b.instruments, ins] }));
    selectInstrument(ins.id);
    setTab('instruments');
    log(`Created “${name}” (slot ${slot(bank.instruments.length)}) with ${zones.length} zone(s) from ${chosen.length} sample(s).`, 'ok');
  };

  const applySampleEdit = (patch: Partial<BankSample>) => {
    if (!editing) return;
    patchSample(editing.id, patch);
    const frames = patch.frames ?? editing.frames;
    const loopOn = (patch.loopMode ?? editing.loopMode) === 1;
    log(`Updated “${editing.name}”: ${(frames / editing.sampleRate).toFixed(3)} s, loop ${loopOn ? 'on' : 'off'}.`, 'ok');
    setEditingId(null);
  };

  /* ── open / build ── */
  const openBank = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    log(`Opening ${file.name}`);
    try {
      const loaded = await parseWbnk(file, (m) => log(m, 'ok'));
      setBank(loaded);
      setSelInst(loaded.instruments[0]?.id ?? null);
      setSelZone(null);
      log(`Loaded ${loaded.instruments.length} instrument(s) and ${loaded.samples.length} sample(s) from ${file.name}`, 'ok');
    } catch (e: any) {
      log(`Could not open ${file.name}: ${e.message ?? e}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const startBuild = async () => {
    const fileName = `${slug(String(bank.meta.title ?? ''))}.wbnk`;
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    let opened = false;
    let startedAt = performance.now();
    let direct = false;
    try {
      let sink;
      const picker = (window as any).showSaveFilePicker;
      if (typeof picker === 'function') {
        const handle = await picker.call(window, {
          suggestedName: fileName,
          types: [{ description: 'iMIDI audio bank (.wbnk)', accept: { 'application/octet-stream': ['.wbnk'] } }],
        });
        sink = await createFileSink(handle);
        direct = true;
      } else {
        sink = createDownloadSink(fileName);
      }
      startedAt = performance.now();
      lastPaint.current = { time: 0, message: '' };
      setBuild({ phase: 'writing', fileName, direct, written: 0, total: estimateSize(bank), message: 'Starting', startedAt });
      opened = true;
      log(`Building ${fileName}`);

      const total = await compileWbnk(
        bank,
        sink,
        (p) => {
          const now = performance.now();
          if (now - lastPaint.current.time > 80 || p.message !== lastPaint.current.message) {
            lastPaint.current = { time: now, message: p.message };
            setBuild((b) => (b && b.phase === 'writing' ? { ...b, written: p.written, total: p.total, message: p.message } : b));
          }
        },
        controller.signal
      );

      setBuild({
        phase: 'done',
        fileName,
        direct,
        written: total,
        total,
        message: 'Done',
        startedAt,
        endedAt: performance.now(),
        summary: `${bank.instruments.length} instrument(s), ${zoneTotal} zone(s), ${writtenSamples} sample(s), ${formatBytes(total)}`,
      });
      log(`Saved ${fileName} (${formatBytes(total)}).`, 'ok');
    } catch (e: any) {
      if (!opened) {
        if (e?.name === 'AbortError') log('Save cancelled.');
        else log(`Could not start the build: ${e.message ?? e}`, 'error');
      } else if (controller.signal.aborted || e?.name === 'AbortError') {
        setBuild((b) => (b ? { ...b, phase: 'cancelled', endedAt: performance.now() } : b));
        log('Build cancelled.');
      } else {
        setBuild((b) => (b ? { ...b, phase: 'error', error: `Build failed: ${e.message ?? e}`, endedAt: performance.now() } : b));
        log(`Build failed: ${e.message ?? e}`, 'error');
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  const canBuild = !busy && errors.length === 0;

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'instruments', label: 'Instruments', count: bank.instruments.length },
    { id: 'samples', label: 'Sample library', count: bank.samples.length },
    { id: 'play', label: 'Play' },
    { id: 'rights', label: 'Copyright and properties' },
  ];

  const health =
    errors.length > 0
      ? { tone: 'bg-[color:var(--accent-fill)] text-white', text: `${errors.length} error${errors.length === 1 ? '' : 's'}` }
      : warnings.length > 0
      ? { tone: 'bg-[color:rgb(var(--brass-rgb)/0.2)] text-[color:var(--brass-ink)]', text: `${warnings.length} warning${warnings.length === 1 ? '' : 's'}` }
      : { tone: 'bg-[color:var(--line-soft)] text-[color:var(--ink)]', text: 'Ready to build' };

  const stats: [string, React.ReactNode][] = [
    ['Instruments', <AnimatedNumber key="i" value={bank.instruments.length} />],
    ['Zones', <AnimatedNumber key="z" value={zoneTotal} />],
    ['Samples in file', writtenSamples === bank.samples.length ? <AnimatedNumber key="s" value={writtenSamples} /> : `${writtenSamples} of ${bank.samples.length}`],
    ['File size', formatBytes(size)],
  ];

  const card = 'rounded-sm border border-[color:var(--line)] bg-[color:var(--surface)]';

  return (
    <div data-theme={theme} className="wbnk-root min-h-[100dvh] bg-[color:var(--bg)] text-[color:var(--ink)]" style={{ fontFamily: "'Instrument Sans', system-ui, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&display=swap');`}</style>
      <style>{THEME_CSS}</style>

      <input ref={openRef} type="file" accept=".wbnk" className="sr-only" tabIndex={-1} onChange={(e) => { openBank(e.target.files?.[0]); e.target.value = ''; }} />
      <input ref={wavRef} type="file" accept=".wav,audio/wav" multiple className="sr-only" tabIndex={-1} onChange={(e) => { importWavs(Array.from(e.target.files ?? [])); e.target.value = ''; }} />

      {/* Header: brand + primary actions, then a toolbar */}
      <header
        className={`sticky top-0 z-30 border-b border-[color:var(--line)] bg-[color:rgb(var(--surface-rgb)/0.9)] backdrop-blur-md transition-shadow duration-300 ${scrolled ? 'shadow-[0_8px_24px_-14px_rgb(0_0_0/0.45)]' : ''}`}
      >
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-3 py-2.5 sm:px-5">
          <a href="https://www.imidi.co.uk/support/tool/wbank-studio" className={`flex min-w-0 items-center gap-2.5 ${focusRing}`} aria-label="iMIDI Bank Manager">
            <svg width="30" height="20" viewBox="0 0 30 20" aria-hidden="true" className="shrink-0">
              <polyline points="1,2 6,18 11,2 16,18 21,2 26,18 29,10" fill="none" style={{ stroke: 'var(--accent)' }} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
            </svg>
            <span className="text-lg font-bold tracking-tight">iMIDI</span>
            <span className="hidden text-lg font-medium tracking-tight text-[color:var(--muted)] sm:inline">Bank Manager</span>
          </a>

          <div className="ml-auto flex items-center gap-2">
            <div role="group" aria-label="Colour theme" className="flex overflow-hidden rounded-sm border border-[color:var(--field-line)]">
              {(['light', 'dark', 'auto'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={theme === t}
                  onClick={() => changeTheme(t)}
                  className={`px-2.5 py-1.5 text-xs font-semibold capitalize transition-colors sm:px-3 sm:text-sm ${theme === t ? 'bg-[color:var(--ink)] text-[color:var(--bg)]' : 'bg-[color:var(--surface)] text-[color:var(--ink)] hover:bg-[color:var(--hover)]'} ${focusRing}`}
                >
                  {t}
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={!canBuild}
              onClick={startBuild}
              title={errors.length ? 'Fix the errors below before building' : undefined}
              className={`wbnk-build relative overflow-hidden rounded-sm px-4 py-2 text-sm font-bold tracking-wide transition-[transform,background-color] active:scale-[0.97] sm:px-6 ${
                canBuild
                  ? 'bg-[color:var(--accent-fill)] text-white hover:bg-[color:var(--accent-hover)]'
                  : 'cursor-not-allowed bg-[color:var(--line-soft)] text-[color:var(--muted)]'
              } ${focusRing}`}
            >
              {canBuild && <span aria-hidden="true" className="wbnk-shimmer pointer-events-none absolute inset-0" />}
              <span className="relative">Build .wbnk</span>
            </button>
          </div>
        </div>

        <div className="border-t border-[color:var(--line-soft)]">
          <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-2 py-1.5 sm:px-4">
            <button type="button" className={toolBtn} disabled={busy} onClick={newBank}>
              <Icon d={ICONS.file} /> New bank
            </button>
            <button type="button" className={toolBtn} disabled={busy} onClick={() => openRef.current?.click()}>
              <Icon d={ICONS.folder} /> Open bank
            </button>
            <button type="button" className={toolBtn} disabled={busy} onClick={() => wavRef.current?.click()}>
              <Icon d={ICONS.wave} /> Import WAV
            </button>
            <button type="button" className={toolBtn} onClick={() => setTab('play')}>
              <Icon d={ICONS.play} /> Play
            </button>
            <button type="button" className={toolBtn} onClick={() => setWelcome(true)}>
              <Icon d={ICONS.help} /> Help
            </button>
            <button
              type="button"
              onClick={() => document.getElementById('checks')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
              className={`ml-auto inline-flex shrink-0 items-center gap-2 rounded-sm px-2.5 py-1 text-xs font-semibold transition-colors ${health.tone} ${focusRing}`}
              aria-label={`Bank status: ${health.text}. Go to the checks.`}
            >
              <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />
              {health.text}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-3 py-5 sm:px-5 sm:py-6">
        {/* Summary */}
        <section aria-label="Bank summary" className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className={`wbnk-in ${card} p-4 sm:p-5`}>
            <label className="block">
              <span className="text-xs font-semibold text-[color:var(--muted)]">Bank name</span>
              <input
                value={String(bank.meta.title ?? '')}
                onChange={(e) => setMeta('title', e.target.value)}
                disabled={busy}
                className={`mt-1 block w-full rounded-sm border border-transparent bg-transparent px-0 py-1 text-2xl font-bold tracking-tight transition-[padding,background-color,border-color] hover:border-[color:var(--field-line)] focus:bg-[color:var(--surface)] focus:px-2 sm:text-3xl ${focusRing}`}
              />
            </label>
            <p className="mt-1 truncate text-xs text-[color:var(--muted)]">{String(bank.meta.copyright ?? '') || 'No copyright notice yet'}</p>
          </div>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
            {stats.map(([k, v], i) => (
              <div key={k} className={`wbnk-in ${card} px-4 py-3`} style={{ animationDelay: `${60 + i * 50}ms` }}>
                <dt className="text-xs font-semibold text-[color:var(--muted)]">{k}</dt>
                <dd className="text-xl font-bold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Tabs */}
        <div role="tablist" aria-label="Bank sections" className="relative mb-5 flex gap-1 overflow-x-auto border-b border-[color:var(--line)]">
          {tabs.map((t) => (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[t.id] = el;
              }}
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              type="button"
              onClick={() => setTab(t.id)}
              className={`whitespace-nowrap px-3 py-2.5 text-sm font-semibold transition-colors sm:px-4 ${tab === t.id ? 'text-[color:var(--ink)]' : 'text-[color:var(--muted)] hover:text-[color:var(--ink)]'} ${focusRing}`}
            >
              {t.label}
              {t.count !== undefined && <span className="ml-2 rounded-sm bg-[color:var(--line-soft)] px-1.5 py-px text-xs tabular-nums">{t.count}</span>}
            </button>
          ))}
          <span
            aria-hidden="true"
            className="absolute bottom-0 left-0 h-0.5 bg-[color:var(--accent)] transition-[transform,width] duration-300 ease-out"
            style={{ transform: `translateX(${indicator.left}px)`, width: indicator.width }}
          />
        </div>

        {/* Instruments */}
        <div role="tabpanel" id="panel-instruments" aria-labelledby="tab-instruments" hidden={tab !== 'instruments'} className="wbnk-panel">
          <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
            <section aria-labelledby="inst-h" className={`h-fit ${card}`}>
              <div className="flex items-center justify-between border-b border-[color:var(--line-soft)] px-4 py-3">
                <h2 id="inst-h" className="text-sm font-semibold">Instruments</h2>
                <span className="text-xs text-[color:var(--muted)]">Slots 000 to 127</span>
              </div>
              <div className="border-b border-[color:var(--line-soft)] px-4 py-3">
                <label className="block">
                  <span className="text-xs font-semibold text-[color:var(--muted)]">Add from preset</span>
                  <select value="" disabled={busy} onChange={(e) => e.target.value && addFromPreset(e.target.value)} className={`${fieldClass} mt-1 w-full`}>
                    <option value="">Choose a preset…</option>
                    {INSTRUMENT_PRESETS.map((p) => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </select>
                </label>
              </div>
              {bank.instruments.length === 0 ? (
                <p className="px-4 py-6 text-sm text-[color:var(--muted)]">No instruments yet. Add one from a preset, or create one from samples in the Sample library.</p>
              ) : (
                <ul className="flex gap-2 overflow-x-auto p-3 lg:block lg:max-h-[60vh] lg:overflow-y-auto lg:p-0">
                  {bank.instruments.map((ins, idx) => {
                    const active = ins.id === instrument?.id;
                    return (
                      <li key={ins.id} className="wbnk-in shrink-0 lg:shrink" style={{ animationDelay: `${Math.min(idx, 10) * 25}ms` }}>
                        <button
                          type="button"
                          onClick={() => selectInstrument(ins.id)}
                          aria-current={active}
                          className={`flex items-baseline gap-2 whitespace-nowrap rounded-sm border px-3 py-2 text-left text-sm transition-colors lg:w-full lg:gap-3 lg:whitespace-normal lg:rounded-none lg:border-0 lg:border-b lg:border-[color:var(--line-soft)] lg:px-4 lg:py-2.5 ${
                            active
                              ? 'border-[color:var(--accent)] bg-[color:rgb(var(--accent-rgb)/0.07)] font-semibold lg:shadow-[inset_3px_0_0_var(--accent)]'
                              : 'border-[color:var(--line)] hover:bg-[color:var(--hover)]'
                          } ${focusRing}`}
                        >
                          <span className="shrink-0 font-semibold tabular-nums text-[color:var(--muted)]" aria-label={`Slot ${idx}`}>{slot(idx)}</span>
                          <span className="min-w-0 flex-1 truncate">{ins.name || 'Unnamed'}</span>
                          <span className="hidden shrink-0 text-xs font-normal tabular-nums text-[color:var(--muted)] lg:inline">{ins.zones.length} zones</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section aria-label="Instrument editor" className={`min-w-0 ${card}`}>
              {instrument ? (
                <>
                  <div className="space-y-3 border-b border-[color:var(--line-soft)] p-4 sm:p-5">
                    <div className="flex items-end gap-3">
                      <div>
                        <span className="text-xs font-semibold text-[color:var(--muted)]">Slot</span>
                        <p className="mt-1 rounded-sm bg-[color:var(--ink)] px-3 py-1.5 text-base font-bold tabular-nums text-[color:var(--bg)]" title="Instruments are stored in this order. The slot is the position in the file.">
                          {slot(instrumentIndex)}
                        </p>
                      </div>
                      <label className="min-w-0 flex-1">
                        <span className="text-xs font-semibold text-[color:var(--muted)]">Instrument name</span>
                        <input
                          value={instrument.name}
                          onChange={(e) => patchInstrument(instrument.id, (i) => ({ ...i, name: e.target.value }))}
                          disabled={busy}
                          className={`${fieldClass} mt-1 w-full text-base font-semibold`}
                        />
                      </label>
                    </div>
                    <div className="flex flex-wrap items-end gap-2">
                      <label className="mr-auto">
                        <span className="text-xs font-semibold text-[color:var(--muted)]">Apply envelope to all zones</span>
                        <select value="" disabled={busy || instrument.zones.length === 0} onChange={(e) => e.target.value && applyEnvelope(e.target.value)} className={`${fieldClass} mt-1 block`}>
                          <option value="">Choose…</option>
                          {ENVELOPE_PRESETS.map((e) => (
                            <option key={e.id} value={e.id}>{e.label}</option>
                          ))}
                        </select>
                      </label>
                      <button type="button" className={btnPlain} onClick={() => setTab('play')}>Audition</button>
                      <button type="button" className={btnPlain} disabled={busy || instrumentIndex === 0} onClick={() => moveInstrument(-1)} aria-label="Move to the previous slot">Up</button>
                      <button type="button" className={btnPlain} disabled={busy || instrumentIndex === bank.instruments.length - 1} onClick={() => moveInstrument(1)} aria-label="Move to the next slot">Down</button>
                      <button type="button" className={btnPlain} disabled={busy} onClick={duplicateInstrument}>Duplicate</button>
                      <button type="button" className={`${btnPlain} !text-[color:var(--accent)]`} disabled={busy} onClick={removeInstrument}>Remove</button>
                    </div>
                  </div>

                  <div className="px-4 pb-2 pt-4 sm:px-5">
                    <h2 className="mb-2 text-sm font-semibold">Key map</h2>
                    <KeyMap zones={instrument.zones} samples={bank.samples} selectedZoneId={selZone} onSelect={setSelZone} />
                  </div>

                  <div className="px-4 pb-5 pt-4 sm:px-5">
                    <h2 className="mb-2 text-sm font-semibold">Zones</h2>
                    <ZoneTable
                      zones={instrument.zones}
                      samples={bank.samples}
                      selectedZoneId={selZone}
                      disabled={busy}
                      onSelect={setSelZone}
                      onPatch={patchZone}
                      onDuplicate={duplicateZone}
                      onRemove={removeZone}
                      onAdd={addZone}
                    />
                  </div>
                </>
              ) : (
                <p className="px-5 py-10 text-sm text-[color:var(--muted)]">Select an instrument, or add one from a preset.</p>
              )}
            </section>
          </div>
        </div>

        {/* Sample library */}
        <div role="tabpanel" id="panel-samples" aria-labelledby="tab-samples" hidden={tab !== 'samples'} className="wbnk-panel">
          <SampleLibrary
            samples={bank.samples}
            usage={usage}
            busy={busy}
            importing={importing}
            instrumentName={instrument?.name}
            rootMode={rootMode}
            onRootMode={setRootMode}
            onPickFiles={() => wavRef.current?.click()}
            onDropFiles={importWavs}
            onPatch={patchSample}
            onRemove={removeSamples}
            onEdit={setEditingId}
            onDetectRoots={detectRoots}
            onMapToInstrument={mapToInstrument}
            onCreateInstrument={createInstrumentFromSamples}
          />
        </div>

        {/* Play: stays mounted so a MIDI controller keeps working while you edit */}
        <div role="tabpanel" id="panel-play" aria-labelledby="tab-play" hidden={tab !== 'play'} className="wbnk-panel">
          <PlayPanel
            instruments={bank.instruments}
            samples={bank.samples}
            instrument={instrument}
            caps={caps}
            onSelectInstrument={(id) => selectInstrument(id)}
            onLog={log}
          />
        </div>

        {/* Copyright */}
        <div role="tabpanel" id="panel-rights" aria-labelledby="tab-rights" hidden={tab !== 'rights'} className="wbnk-panel">
          <RightsPanel
            meta={bank.meta}
            onMeta={setMeta}
            syntText={bank.syntText}
            onSynt={(text) => setBank((b) => ({ ...b, syntText: text }))}
            syntError={syntError}
            disabled={busy}
          />
        </div>

        {/* Checks + activity */}
        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <section id="checks" aria-labelledby="chk-h" className={`scroll-mt-40 ${card}`}>
            <div className="flex items-baseline justify-between border-b border-[color:var(--line-soft)] px-4 py-3">
              <h2 id="chk-h" className="text-sm font-semibold">Bank checks</h2>
              <span className="text-xs tabular-nums text-[color:var(--muted)]">
                {errors.length} error{errors.length === 1 ? '' : 's'}, {warnings.length} warning{warnings.length === 1 ? '' : 's'}
              </span>
            </div>
            {issues.length === 0 ? (
              <p className="px-4 py-6 text-sm">No problems found. The bank is ready to build.</p>
            ) : (
              <ul className="max-h-64 divide-y divide-[color:var(--line-soft)] overflow-y-auto">
                {[...errors, ...warnings].map((it, i) => {
                  const target = it.instrumentId ? 'instruments' : it.tab;
                  return (
                    <li key={i}>
                      <button
                        type="button"
                        disabled={!target}
                        onClick={() => {
                          if (it.instrumentId) selectInstrument(it.instrumentId, it.zoneId ?? null);
                          if (target) setTab(target);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className={`flex w-full items-start gap-3 px-4 py-2.5 text-left text-sm transition-colors enabled:hover:bg-[color:var(--hover)] ${focusRing}`}
                      >
                        <span className={`mt-0.5 shrink-0 rounded-sm px-1.5 py-px text-[11px] font-semibold ${it.level === 'error' ? 'bg-[color:var(--accent-fill)] text-white' : 'bg-[color:rgb(var(--brass-rgb)/0.2)] text-[color:var(--brass-ink)]'}`}>
                          {it.level === 'error' ? 'Error' : 'Warning'}
                        </span>
                        <span>{it.message}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section aria-labelledby="act-h" className={card}>
            <div className="border-b border-[color:var(--line-soft)] px-4 py-3">
              <h2 id="act-h" className="text-sm font-semibold">Activity</h2>
            </div>
            <ol ref={logRef} className="max-h-64 overflow-y-auto px-4 py-3 text-sm" aria-live="polite">
              {logs.map((l, i) => (
                <li key={i} className="wbnk-fade flex gap-3 py-0.5">
                  <time className="shrink-0 tabular-nums text-[color:var(--muted)]">{l.time}</time>
                  <span className={l.level === 'error' ? 'font-medium text-[color:var(--accent)]' : 'text-[color:var(--ink)]'}>{l.message}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </main>

      {welcome && <WelcomeDialog caps={caps} initialHidden={welcomeHidden} onClose={closeWelcome} />}
      {editing && <SampleEditor key={editing.id} sample={editing} onApply={applySampleEdit} onClose={() => setEditingId(null)} />}
      {build && <BuildOverlay state={build} onCancel={() => abortRef.current?.abort()} onClose={() => setBuild(null)} />}

      <Footer />
    </div>
  );
}