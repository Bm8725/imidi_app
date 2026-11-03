'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import KeyMap from '@/components/KeyMap';
import ZoneTable, { fieldClass, focusRing } from '@/components/ZoneTable';
import SampleLibrary from '@/components/SampleLibrary';
import RightsPanel from '@/components/RightsPanel';
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
import { ENVELOPE_PRESETS, INSTRUMENT_PRESETS, autoMapZones, commonName, detectRootKey } from '@/lib/wbnk-presets';

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

const btnPrimary = `rounded-sm bg-[#A61E2B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#8E1823] disabled:cursor-not-allowed disabled:bg-[#C5C9D1] disabled:text-[#5A6270] ${focusRing}`;
const btnPlain = `rounded-sm border border-[#C5C9D1] bg-white px-3 py-2 text-sm font-medium text-[#15181D] hover:border-[#15181D] disabled:cursor-not-allowed disabled:text-[#5A6270] ${focusRing}`;

export default function WbnkBankManagerPage() {
  const [bank, setBank] = useState<BankModel>(() => createDefaultBank());
  const [tab, setTab] = useState<Tab>('instruments');
  const [selInst, setSelInst] = useState<string | null>(null);
  const [selZone, setSelZone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [importing, setImporting] = useState<{ done: number; total: number } | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([
    { time: new Date().toLocaleTimeString('en-GB'), message: 'Ready. Edit the bank, or open an existing .wbnk file.', level: 'info' },
  ]);
  const logRef = useRef<HTMLOListElement>(null);
  const openRef = useRef<HTMLInputElement>(null);
  const wavRef = useRef<HTMLInputElement>(null);

  const instrument: BankInstrument | undefined = bank.instruments.find((i) => i.id === selInst) ?? bank.instruments[0];
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
    log(`Added “${preset.name}” from preset.`, 'ok');
  };

  const duplicateInstrument = () => {
    if (!instrument) return;
    const copy: BankInstrument = { id: uid(), name: `${instrument.name} copy`, zones: instrument.zones.map((z) => ({ ...z, id: uid() })) };
    setBank((b) => ({ ...b, instruments: [...b.instruments, copy] }));
    selectInstrument(copy.id);
  };

  const removeInstrument = () => {
    if (!instrument) return;
    if (!window.confirm(`Remove “${instrument.name}” and its ${instrument.zones.length} zone(s)?`)) return;
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
    let detected = 0;
    for (let i = 0; i < files.length; i++) {
      setImporting({ done: i, total: files.length });
      try {
        const s = await readWav(files[i]);
        const key = detectRootKey(s.name);
        if (key !== null) {
          s.rootKey = key;
          detected++;
        }
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
    log(`Imported ${added.length} sample(s). Root key found in the name for ${detected}; the rest default to C4.`, 'ok');
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
    const count = bank.samples.filter((s) => want.has(s.id) && detectRootKey(s.name) !== null).length;
    setBank((b) => ({
      ...b,
      samples: b.samples.map((s) => {
        const key = want.has(s.id) ? detectRootKey(s.name) : null;
        return key === null ? s : { ...s, rootKey: key };
      }),
    }));
    log(`Root key detected from the name for ${count} of ${ids.length} sample(s).`, count ? 'ok' : 'info');
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
    log(`Created “${name}” with ${zones.length} zone(s) from ${chosen.length} sample(s).`, 'ok');
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

  const build = async () => {
    const fileName = `${slug(String(bank.meta.title ?? ''))}.wbnk`;
    setBusy(true);
    setProgress(0);
    try {
      let sink;
      const picker = (window as any).showSaveFilePicker;
      if (typeof picker === 'function') {
        const handle = await picker.call(window, {
          suggestedName: fileName,
          types: [{ description: 'iMIDI audio bank (.wbnk)', accept: { 'application/octet-stream': ['.wbnk'] } }],
        });
        sink = await createFileSink(handle);
      } else {
        log('This browser cannot write directly to disk. The bank will be downloaded instead.');
        sink = createDownloadSink(fileName);
      }
      log(`Building ${fileName}`);
      let last = '';
      const total = await compileWbnk(bank, sink, (p) => {
        setProgress(p.total ? (p.written / p.total) * 100 : 0);
        if (p.message !== last) {
          last = p.message;
          log(p.message);
        }
      });
      setProgress(100);
      log(`Saved ${fileName} (${formatBytes(total)}). All chunks 64-byte aligned, checksums written.`, 'ok');
    } catch (e: any) {
      setProgress(null);
      if (e?.name === 'AbortError') log('Save cancelled.');
      else log(`Build failed: ${e.message ?? e}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const canBuild = !busy && errors.length === 0;

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'instruments', label: 'Instruments', count: bank.instruments.length },
    { id: 'samples', label: 'Sample library', count: bank.samples.length },
    { id: 'rights', label: 'Copyright and properties' },
  ];

  const panelHead = 'flex items-center justify-between border-b border-[#E4E6EB] px-4 py-3';

  return (
    <div className="min-h-screen bg-[#F2F3F5] text-[#15181D]" style={{ fontFamily: "'Instrument Sans', system-ui, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&display=swap');`}</style>

      <header className="border-b border-[#D7DAE0] bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3">
          <a href="https://imidi.co.uk" className={`flex items-center gap-2.5 ${focusRing}`} aria-label="iMIDI home">
            <svg width="30" height="20" viewBox="0 0 30 20" aria-hidden="true">
              <polyline points="1,2 6,18 11,2 16,18 21,2 26,18 29,10" fill="none" stroke="#A61E2B" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
            </svg>
            <span className="text-lg font-bold tracking-tight">iMIDI</span>
            <span className="text-lg font-medium tracking-tight text-[#5A6270]">Bank Manager</span>
          </a>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <input ref={openRef} type="file" accept=".wbnk" className="sr-only" tabIndex={-1} onChange={(e) => { openBank(e.target.files?.[0]); e.target.value = ''; }} />
            <input ref={wavRef} type="file" accept=".wav,audio/wav" multiple className="sr-only" tabIndex={-1} onChange={(e) => { importWavs(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
            <button type="button" className={btnPlain} disabled={busy} onClick={newBank}>New bank</button>
            <button type="button" className={btnPlain} disabled={busy} onClick={() => openRef.current?.click()}>Open bank</button>
            <button type="button" className={btnPlain} disabled={busy} onClick={() => wavRef.current?.click()}>Import WAV samples</button>
            <button type="button" className={btnPrimary} disabled={!canBuild} onClick={build} title={errors.length ? 'Fix the errors below before building' : undefined}>
              {busy && progress !== null ? 'Writing…' : 'Build .wbnk'}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-6">
        <section aria-label="Bank summary" className="mb-6 flex flex-wrap items-end gap-x-10 gap-y-4">
          <div className="min-w-[260px] flex-1">
            <label className="block">
              <span className="text-xs font-semibold text-[#5A6270]">Bank name</span>
              <input
                value={String(bank.meta.title ?? '')}
                onChange={(e) => setMeta('title', e.target.value)}
                disabled={busy}
                className={`mt-1 block w-full rounded-sm border border-transparent bg-transparent px-0 py-1 text-3xl font-bold tracking-tight hover:border-[#C5C9D1] focus:bg-white focus:px-2 ${focusRing}`}
              />
            </label>
          </div>
          <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
            {[
              ['Instruments', bank.instruments.length],
              ['Zones', zoneTotal],
              ['Samples', bank.samples.length],
              ['File size', formatBytes(size)],
            ].map(([k, v]) => (
              <div key={k as string}>
                <dt className="text-xs font-semibold text-[#5A6270]">{k}</dt>
                <dd className="text-xl font-semibold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Tabs */}
        <div role="tablist" aria-label="Bank sections" className="mb-5 flex gap-1 border-b border-[#D7DAE0]">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              type="button"
              onClick={() => setTab(t.id)}
              className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold ${tab === t.id ? 'border-[#A61E2B] text-[#15181D]' : 'border-transparent text-[#5A6270] hover:text-[#15181D]'} ${focusRing}`}
            >
              {t.label}
              {t.count !== undefined && <span className="ml-2 rounded-sm bg-[#E4E6EB] px-1.5 py-px text-xs tabular-nums">{t.count}</span>}
            </button>
          ))}
        </div>

        {/* Instruments */}
        <div role="tabpanel" id="panel-instruments" aria-labelledby="tab-instruments" hidden={tab !== 'instruments'}>
          <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
            <section aria-labelledby="inst-h" className="h-fit rounded-sm border border-[#D7DAE0] bg-white">
              <div className={panelHead}>
                <h2 id="inst-h" className="text-sm font-semibold">Instruments</h2>
              </div>
              <div className="border-b border-[#E4E6EB] px-4 py-3">
                <label className="block">
                  <span className="text-xs font-semibold text-[#5A6270]">Add from preset</span>
                  <select
                    value=""
                    disabled={busy}
                    onChange={(e) => e.target.value && addFromPreset(e.target.value)}
                    className={`${fieldClass} mt-1 w-full`}
                  >
                    <option value="">Choose a preset…</option>
                    {INSTRUMENT_PRESETS.map((p) => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </select>
                </label>
              </div>
              {bank.instruments.length === 0 ? (
                <p className="px-4 py-6 text-sm text-[#5A6270]">No instruments yet. Add one from a preset, or create one from samples in the Sample library.</p>
              ) : (
                <ul>
                  {bank.instruments.map((ins) => {
                    const active = ins.id === instrument?.id;
                    return (
                      <li key={ins.id}>
                        <button
                          type="button"
                          onClick={() => selectInstrument(ins.id)}
                          aria-current={active}
                          className={`flex w-full items-baseline justify-between gap-3 px-4 py-2.5 text-left text-sm ${active ? 'bg-[#A61E2B]/[0.07] font-semibold shadow-[inset_3px_0_0_#A61E2B]' : 'hover:bg-[#F7F8F9]'} ${focusRing}`}
                        >
                          <span className="truncate">{ins.name || 'Unnamed'}</span>
                          <span className="shrink-0 text-xs font-normal tabular-nums text-[#5A6270]">{ins.zones.length} zones</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section aria-label="Instrument editor" className="min-w-0 rounded-sm border border-[#D7DAE0] bg-white">
              {instrument ? (
                <>
                  <div className="flex flex-wrap items-end gap-3 border-b border-[#E4E6EB] px-5 py-4">
                    <label className="min-w-[220px] flex-1">
                      <span className="text-xs font-semibold text-[#5A6270]">Instrument name</span>
                      <input
                        value={instrument.name}
                        onChange={(e) => patchInstrument(instrument.id, (i) => ({ ...i, name: e.target.value }))}
                        disabled={busy}
                        className={`${fieldClass} mt-1 w-full text-base font-semibold`}
                      />
                    </label>
                    <label>
                      <span className="text-xs font-semibold text-[#5A6270]">Apply envelope to all zones</span>
                      <select value="" disabled={busy || instrument.zones.length === 0} onChange={(e) => e.target.value && applyEnvelope(e.target.value)} className={`${fieldClass} mt-1 block`}>
                        <option value="">Choose…</option>
                        {ENVELOPE_PRESETS.map((e) => (
                          <option key={e.id} value={e.id}>{e.label}</option>
                        ))}
                      </select>
                    </label>
                    <div className="flex gap-2">
                      <button type="button" className={btnPlain} disabled={busy} onClick={() => moveInstrument(-1)} aria-label="Move instrument up">Up</button>
                      <button type="button" className={btnPlain} disabled={busy} onClick={() => moveInstrument(1)} aria-label="Move instrument down">Down</button>
                      <button type="button" className={btnPlain} disabled={busy} onClick={duplicateInstrument}>Duplicate</button>
                      <button type="button" className={`${btnPlain} !text-[#A61E2B]`} disabled={busy} onClick={removeInstrument}>Remove</button>
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
                <p className="px-5 py-10 text-sm text-[#5A6270]">Select an instrument on the left, or add one from a preset.</p>
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
            onPickFiles={() => wavRef.current?.click()}
            onDropFiles={importWavs}
            onPatch={patchSample}
            onRemove={removeSamples}
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
          <section aria-labelledby="chk-h" className="rounded-sm border border-[#D7DAE0] bg-white">
            <div className="flex items-baseline justify-between border-b border-[#E4E6EB] px-4 py-3">
              <h2 id="chk-h" className="text-sm font-semibold">Bank checks</h2>
              <span className="text-xs tabular-nums text-[#5A6270]">
                {errors.length} error{errors.length === 1 ? '' : 's'}, {warnings.length} warning{warnings.length === 1 ? '' : 's'}
              </span>
            </div>
            {issues.length === 0 ? (
              <p className="px-4 py-6 text-sm">No problems found. The bank is ready to build.</p>
            ) : (
              <ul className="max-h-64 divide-y divide-[#E4E6EB] overflow-y-auto">
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
                        className={`flex w-full items-start gap-3 px-4 py-2.5 text-left text-sm enabled:hover:bg-[#F7F8F9] ${focusRing}`}
                      >
                        <span className={`mt-0.5 shrink-0 rounded-sm px-1.5 py-px text-[11px] font-semibold ${it.level === 'error' ? 'bg-[#A61E2B] text-white' : 'bg-[#9C7A3C]/20 text-[#4A3A18]'}`}>
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

          <section aria-labelledby="act-h" className="rounded-sm border border-[#D7DAE0] bg-white">
            <div className="border-b border-[#E4E6EB] px-4 py-3">
              <h2 id="act-h" className="text-sm font-semibold">Activity</h2>
            </div>
            {progress !== null && (
              <div className="border-b border-[#E4E6EB] px-4 py-3" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)} aria-label="Write progress">
                <div className="mb-1 flex justify-between text-xs text-[#5A6270]">
                  <span>Write progress</span>
                  <span className="tabular-nums">{Math.round(progress)}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[#E4E6EB]">
                  <div className="h-full bg-[#A61E2B] transition-[width] duration-150 motion-reduce:transition-none" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}
            <ol ref={logRef} className="max-h-64 overflow-y-auto px-4 py-3 text-sm" aria-live="polite">
              {logs.map((l, i) => (
                <li key={i} className="flex gap-3 py-0.5">
                  <time className="shrink-0 tabular-nums text-[#5A6270]">{l.time}</time>
                  <span className={l.level === 'error' ? 'font-medium text-[#A61E2B]' : 'text-[#15181D]'}>{l.message}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </main>

      <footer className="mx-auto max-w-7xl px-5 pb-10 pt-4 text-xs text-[#5A6270]">
        © 2026 iMIDI.co.uk. Writes .wbnk v1.0 for the TS4X Core DSP engine.
      </footer>
    </div>
  );
}