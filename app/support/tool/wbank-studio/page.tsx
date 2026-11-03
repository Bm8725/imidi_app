'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import KeyMap from '@/components/KeyMap';
import ZoneTable, { fieldClass, focusRing } from '@/components/ZoneTable';
import SampleLibrary from '@/components/SampleLibrary';
import SampleEditor from '@/components/SampleEditor';
import RightsPanel from '@/components/RightsPanel';
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

type Tab = 'instruments' | 'samples' | 'rights';

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

const btnPrimary = `rounded-sm bg-[color:var(--accent-fill)] px-4 py-2 text-sm font-semibold text-white hover:bg-[color:var(--accent-hover)] disabled:cursor-not-allowed disabled:bg-[color:var(--field-line)] disabled:text-[color:var(--muted)] ${focusRing}`;
const btnPlain = `rounded-sm border border-[color:var(--field-line)] bg-[color:var(--surface)] px-3 py-2 text-sm font-medium text-[color:var(--ink)] hover:border-[color:var(--ink)] disabled:cursor-not-allowed disabled:text-[color:var(--muted)] ${focusRing}`;

const LIGHT_VARS = `
  color-scheme: light;
  --bg: #F2F3F5; --surface: #FFFFFF; --ink: #15181D; --ink-2: #3A404A; --muted: #5A6270;
  --line: #D7DAE0; --line-soft: #E4E6EB; --field-line: #C5C9D1; --hover: #F7F8F9;
  --accent: #A61E2B; --accent-fill: #A61E2B; --accent-hover: #8E1823;
  --brass: #9C7A3C; --brass-ink: #4A3A18;
  --accent-rgb: 166 30 43; --brass-rgb: 156 122 60; --muted-rgb: 90 98 112; --ink-rgb: 21 24 29;
  --key-white: #FFFFFF; --key-black: #15181D; --key-line: rgb(21 24 29 / 0.2); --key-edge: #15181D;
`;
const DARK_VARS = `
  color-scheme: dark;
  --bg: #0F1114; --surface: #171A1F; --ink: #E8EAED; --ink-2: #C3C8D0; --muted: #9AA3B0;
  --line: #2C323B; --line-soft: #232830; --field-line: #3A414C; --hover: #1D2128;
  --accent: #E5606C; --accent-fill: #B3222F; --accent-hover: #C42A38;
  --brass: #C9A25A; --brass-ink: #EAD7A8;
  --accent-rgb: 229 96 108; --brass-rgb: 201 162 90; --muted-rgb: 154 163 176; --ink-rgb: 232 234 237;
  --key-white: #D9DCE2; --key-black: #0B0C0E; --key-line: rgb(0 0 0 / 0.45); --key-edge: #3A414C;
`;
const THEME_CSS = `
.wbnk-root { ${LIGHT_VARS} }
.wbnk-root[data-theme='light'] { ${LIGHT_VARS} }
.wbnk-root[data-theme='dark'] { ${DARK_VARS} }
@media (prefers-color-scheme: dark) { .wbnk-root[data-theme='auto'] { ${DARK_VARS} } }
`;
type Theme = 'auto' | 'light' | 'dark';
const THEME_KEY = 'imidi-wbnk-theme';
const WELCOME_KEY = 'imidi-wbnk-welcome';

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
  const [logs, setLogs] = useState<LogEntry[]>([
    { time: new Date().toLocaleTimeString('en-GB'), message: 'Ready. Edit the bank, or open an existing .wbnk file.', level: 'info' },
  ]);
  const logRef = useRef<HTMLOListElement>(null);
  const openRef = useRef<HTMLInputElement>(null);
  const wavRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastPaint = useRef({ time: 0, message: '' });

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
    { id: 'rights', label: 'Copyright and properties' },
  ];

  const panelHead = 'flex items-center justify-between border-b border-[color:var(--line-soft)] px-4 py-3';

  return (
    <div data-theme={theme} className="wbnk-root min-h-screen bg-[color:var(--bg)] text-[color:var(--ink)]" style={{ fontFamily: "'Instrument Sans', system-ui, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&display=swap');`}</style>
      <style>{THEME_CSS}</style>

      <header className="sticky top-0 z-30 border-b border-[color:var(--line)] bg-[color:var(--surface)]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3">
          <a href="https://imidi.co.uk" className={`flex items-center gap-2.5 ${focusRing}`} aria-label="iMIDI home">
            <svg width="30" height="20" viewBox="0 0 30 20" aria-hidden="true">
              <polyline points="1,2 6,18 11,2 16,18 21,2 26,18 29,10" fill="none" style={{ stroke: 'var(--accent)' }} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
            </svg>
            <span className="text-lg font-bold tracking-tight">iMIDI</span>
            <span className="text-lg font-medium tracking-tight text-[color:var(--muted)]">Bank Manager</span>
          </a>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Colour theme" className="mr-2 flex overflow-hidden rounded-sm border border-[color:var(--field-line)]">
              {(['light', 'dark', 'auto'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={theme === t}
                  onClick={() => changeTheme(t)}
                  className={`px-3 py-2 text-sm font-medium capitalize ${theme === t ? 'bg-[color:var(--ink)] text-[color:var(--bg)]' : 'bg-[color:var(--surface)] text-[color:var(--ink)] hover:bg-[color:var(--hover)]'} ${focusRing}`}
                >
                  {t}
                </button>
              ))}
            </div>
            <input ref={openRef} type="file" accept=".wbnk" className="sr-only" tabIndex={-1} onChange={(e) => { openBank(e.target.files?.[0]); e.target.value = ''; }} />
            <input ref={wavRef} type="file" accept=".wav,audio/wav" multiple className="sr-only" tabIndex={-1} onChange={(e) => { importWavs(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
            <button type="button" className={btnPlain} onClick={() => setWelcome(true)}>Help</button>
            <button type="button" className={btnPlain} disabled={busy} onClick={newBank}>New bank</button>
            <button type="button" className={btnPlain} disabled={busy} onClick={() => openRef.current?.click()}>Open bank</button>
            <button type="button" className={btnPlain} disabled={busy} onClick={() => wavRef.current?.click()}>Import WAV samples</button>
            <button type="button" className={btnPrimary} disabled={!canBuild} onClick={startBuild} title={errors.length ? 'Fix the errors below before building' : undefined}>
              Build .wbnk
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-6">
        <section aria-label="Bank summary" className="mb-6 flex flex-wrap items-end gap-x-10 gap-y-4">
          <div className="min-w-[260px] flex-1">
            <label className="block">
              <span className="text-xs font-semibold text-[color:var(--muted)]">Bank name</span>
              <input
                value={String(bank.meta.title ?? '')}
                onChange={(e) => setMeta('title', e.target.value)}
                disabled={busy}
                className={`mt-1 block w-full rounded-sm border border-transparent bg-transparent px-0 py-1 text-3xl font-bold tracking-tight hover:border-[color:var(--field-line)] focus:bg-[color:var(--surface)] focus:px-2 ${focusRing}`}
              />
            </label>
          </div>
          <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
            {[
              ['Instruments', bank.instruments.length],
              ['Zones', zoneTotal],
              ['Samples in file', writtenSamples === bank.samples.length ? writtenSamples : `${writtenSamples} of ${bank.samples.length}`],
              ['File size', formatBytes(size)],
            ].map(([k, v]) => (
              <div key={k as string}>
                <dt className="text-xs font-semibold text-[color:var(--muted)]">{k}</dt>
                <dd className="text-xl font-semibold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div role="tablist" aria-label="Bank sections" className="mb-5 flex gap-1 overflow-x-auto border-b border-[color:var(--line)]">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              type="button"
              onClick={() => setTab(t.id)}
              className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold ${tab === t.id ? 'border-[color:var(--accent)] text-[color:var(--ink)]' : 'border-transparent text-[color:var(--muted)] hover:text-[color:var(--ink)]'} ${focusRing}`}
            >
              {t.label}
              {t.count !== undefined && <span className="ml-2 rounded-sm bg-[color:var(--line-soft)] px-1.5 py-px text-xs tabular-nums">{t.count}</span>}
            </button>
          ))}
        </div>

        {/* Instruments */}
        <div role="tabpanel" id="panel-instruments" aria-labelledby="tab-instruments" hidden={tab !== 'instruments'}>
          <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
            <section aria-labelledby="inst-h" className="h-fit rounded-sm border border-[color:var(--line)] bg-[color:var(--surface)]">
              <div className={panelHead}>
                <h2 id="inst-h" className="text-sm font-semibold">Instruments</h2>
                <span className="text-xs text-[color:var(--muted)]">Slot numbers, 000 to 127</span>
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
                <ul className="max-h-[60vh] overflow-y-auto">
                  {bank.instruments.map((ins, idx) => {
                    const active = ins.id === instrument?.id;
                    return (
                      <li key={ins.id}>
                        <button
                          type="button"
                          onClick={() => selectInstrument(ins.id)}
                          aria-current={active}
                          className={`flex w-full items-baseline gap-3 px-4 py-2.5 text-left text-sm ${active ? 'bg-[color:rgb(var(--accent-rgb)/0.07)] font-semibold shadow-[inset_3px_0_0_var(--accent)]' : 'hover:bg-[color:var(--hover)]'} ${focusRing}`}
                        >
                          <span className="shrink-0 font-semibold tabular-nums text-[color:var(--muted)]" aria-label={`Slot ${idx}`}>{slot(idx)}</span>
                          <span className="min-w-0 flex-1 truncate">{ins.name || 'Unnamed'}</span>
                          <span className="shrink-0 text-xs font-normal tabular-nums text-[color:var(--muted)]">{ins.zones.length} zones</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section aria-label="Instrument editor" className="min-w-0 rounded-sm border border-[color:var(--line)] bg-[color:var(--surface)]">
              {instrument ? (
                <>
                  <div className="flex flex-wrap items-end gap-3 border-b border-[color:var(--line-soft)] px-5 py-4">
                    <div>
                      <span className="text-xs font-semibold text-[color:var(--muted)]">Slot</span>
                      <p className="mt-1 rounded-sm bg-[color:var(--ink)] px-3 py-1.5 text-base font-bold tabular-nums text-[color:var(--bg)]" title="Instruments are stored in this order. The slot is the position in the file.">
                        {slot(instrumentIndex)}
                      </p>
                    </div>
                    <label className="min-w-[200px] flex-1">
                      <span className="text-xs font-semibold text-[color:var(--muted)]">Instrument name</span>
                      <input
                        value={instrument.name}
                        onChange={(e) => patchInstrument(instrument.id, (i) => ({ ...i, name: e.target.value }))}
                        disabled={busy}
                        className={`${fieldClass} mt-1 w-full text-base font-semibold`}
                      />
                    </label>
                    <label>
                      <span className="text-xs font-semibold text-[color:var(--muted)]">Apply envelope to all zones</span>
                      <select value="" disabled={busy || instrument.zones.length === 0} onChange={(e) => e.target.value && applyEnvelope(e.target.value)} className={`${fieldClass} mt-1 block`}>
                        <option value="">Choose…</option>
                        {ENVELOPE_PRESETS.map((e) => (
                          <option key={e.id} value={e.id}>{e.label}</option>
                        ))}
                      </select>
                    </label>
                    <div className="flex gap-2">
                      <button type="button" className={btnPlain} disabled={busy || instrumentIndex === 0} onClick={() => moveInstrument(-1)} aria-label="Move to the previous slot">Up</button>
                      <button type="button" className={btnPlain} disabled={busy || instrumentIndex === bank.instruments.length - 1} onClick={() => moveInstrument(1)} aria-label="Move to the next slot">Down</button>
                      <button type="button" className={btnPlain} disabled={busy} onClick={duplicateInstrument}>Duplicate</button>
                      <button type="button" className={`${btnPlain} !text-[color:var(--accent)]`} disabled={busy} onClick={removeInstrument}>Remove</button>
                    </div>
                  </div>

                  <div className="px-5 pb-2 pt-4">
                    <h2 className="mb-2 text-sm font-semibold">Key map</h2>
                    <KeyMap zones={instrument.zones} samples={bank.samples} selectedZoneId={selZone} onSelect={setSelZone} />
                  </div>

                  <div className="px-5 pb-5 pt-4">
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
                <p className="px-5 py-10 text-sm text-[color:var(--muted)]">Select an instrument on the left, or add one from a preset.</p>
              )}
            </section>
          </div>
        </div>

        {/* Sample library */}
        <div role="tabpanel" id="panel-samples" aria-labelledby="tab-samples" hidden={tab !== 'samples'}>
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

        {/* Copyright */}
        <div role="tabpanel" id="panel-rights" aria-labelledby="tab-rights" hidden={tab !== 'rights'}>
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
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section aria-labelledby="chk-h" className="rounded-sm border border-[color:var(--line)] bg-[color:var(--surface)]">
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
                        }}
                        className={`flex w-full items-start gap-3 px-4 py-2.5 text-left text-sm enabled:hover:bg-[color:var(--hover)] ${focusRing}`}
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

          <section aria-labelledby="act-h" className="rounded-sm border border-[color:var(--line)] bg-[color:var(--surface)]">
            <div className="border-b border-[color:var(--line-soft)] px-4 py-3">
              <h2 id="act-h" className="text-sm font-semibold">Activity</h2>
            </div>
            <ol ref={logRef} className="max-h-64 overflow-y-auto px-4 py-3 text-sm" aria-live="polite">
              {logs.map((l, i) => (
                <li key={i} className="flex gap-3 py-0.5">
                  <time className="shrink-0 tabular-nums text-[color:var(--muted)]">{l.time}</time>
                  <span className={l.level === 'error' ? 'font-medium text-[color:var(--accent)]' : 'text-[color:var(--ink)]'}>{l.message}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </main>

      <footer className="mx-auto max-w-7xl px-5 pb-10 pt-4 text-xs text-[color:var(--muted)]">
        © 2026 iMIDI.co.uk. Writes .wbnk v1.0 for the TS4X Core DSP engine.
      </footer>

      {welcome && <WelcomeDialog caps={caps} initialHidden={welcomeHidden} onClose={closeWelcome} />}
      {editing && <SampleEditor key={editing.id} sample={editing} onApply={applySampleEdit} onClose={() => setEditingId(null)} />}
      {build && <BuildOverlay state={build} onCancel={() => abortRef.current?.abort()} onClose={() => setBuild(null)} />}
    </div>
  );
}