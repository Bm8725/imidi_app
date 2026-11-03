'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { BankSample, formatBytes } from '@/lib/wbnk-compiler';
import { ROOT_MODES, RootMode } from '@/lib/wbnk-presets';
import { NumberCell, fieldClass, focusRing } from './ZoneTable';
import { noteName } from './KeyMap';

const PAGE_SIZE = 50;

type SortKey = 'name' | 'root' | 'size' | 'length';

interface Props {
  samples: BankSample[];
  usage: Map<string, number>;
  busy: boolean;
  importing: { done: number; total: number } | null;
  instrumentName?: string;
  rootMode: RootMode;
  onRootMode: (mode: RootMode) => void;
  onPickFiles: () => void;
  onDropFiles: (files: File[]) => void;
  onPatch: (id: string, patch: Partial<BankSample>) => void;
  onRemove: (ids: string[]) => void;
  onEdit: (id: string) => void;
  onDetectRoots: (ids: string[]) => void;
  onMapToInstrument: (ids: string[], lo: number, hi: number) => void;
  onCreateInstrument: (ids: string[], lo: number, hi: number) => void;
}

const btn = `rounded-sm border border-[color:var(--field-line)] bg-[color:var(--surface)] px-3 py-1.5 text-sm font-medium text-[color:var(--ink)] hover:border-[color:var(--ink)] disabled:cursor-not-allowed disabled:text-[color:var(--muted)] disabled:hover:border-[color:var(--field-line)] ${focusRing}`;

export default function SampleLibrary(p: Props) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('name');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dragging, setDragging] = useState(false);
  const [lo, setLo] = useState(0);
  const [hi, setHi] = useState(127);

  useEffect(() => {
    const ids = new Set(p.samples.map((s) => s.id));
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => ids.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [p.samples]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = p.samples.filter((s) => !q || s.name.toLowerCase().includes(q));
    const byName = (a: BankSample, b: BankSample) => a.name.localeCompare(b.name, undefined, { numeric: true });
    const cmp: Record<SortKey, (a: BankSample, b: BankSample) => number> = {
      name: byName,
      root: (a, b) => a.rootKey - b.rootKey || byName(a, b),
      size: (a, b) => b.blob.size - a.blob.size,
      length: (a, b) => b.frames / b.sampleRate - a.frames / a.sampleRate,
    };
    return list.sort(cmp[sort]);
  }, [p.samples, query, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const visible = rows.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);
  const allVisibleSelected = visible.length > 0 && visible.every((s) => selected.has(s.id));
  const unused = p.samples.filter((s) => !p.usage.get(s.id));
  const chosen = [...selected];
  const totalBytes = p.samples.reduce((n, s) => n + s.blob.size, 0);
  const modeHint = ROOT_MODES.find((m) => m.id === p.rootMode)?.hint;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleVisible = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      visible.forEach((s) => (allVisibleSelected ? next.delete(s.id) : next.add(s.id)));
      return next;
    });

  const confirmRemove = (ids: string[], what: string) => {
    if (ids.length > 0 && window.confirm(`Remove ${what}? Zones that use them will lose their sample.`)) p.onRemove(ids);
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          p.onDropFiles(Array.from(e.dataTransfer.files));
        }}
        className={`flex flex-wrap items-center justify-between gap-3 rounded-sm border-2 border-dashed px-5 py-4 ${dragging ? 'border-[color:var(--accent)] bg-[color:rgb(var(--accent-rgb)/0.05)]' : 'border-[color:var(--field-line)] bg-[color:var(--surface)]'}`}
      >
        <div>
          <p className="text-sm font-semibold">Drop WAV files here</p>
          <p className="text-xs text-[color:var(--muted)]">16-bit, 24-bit or 32-bit float. Root key and loop points are read automatically (see “Root key from” below).</p>
        </div>
        <button type="button" onClick={p.onPickFiles} disabled={p.busy} className={btn}>
          Choose files
        </button>
        {p.importing && (
          <div className="basis-full" role="status">
            <div className="mb-1 text-xs text-[color:var(--muted)]">
              Importing {p.importing.done} of {p.importing.total}
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[color:var(--line-soft)]">
              <div className="h-full bg-[color:var(--accent-fill)]" style={{ width: `${(p.importing.done / p.importing.total) * 100}%` }} />
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[200px] flex-1">
          <span className="text-xs font-semibold text-[color:var(--muted)]">Search samples</span>
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            placeholder="Type part of a name"
            className={`${fieldClass} mt-1 w-full`}
          />
        </label>
        <label>
          <span className="text-xs font-semibold text-[color:var(--muted)]">Root key from</span>
          <select value={p.rootMode} onChange={(e) => p.onRootMode(e.target.value as RootMode)} className={`${fieldClass} mt-1 block`} aria-describedby="root-hint">
            {ROOT_MODES.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="text-xs font-semibold text-[color:var(--muted)]">Sort by</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className={`${fieldClass} mt-1 block`}>
            <option value="name">Name</option>
            <option value="root">Root key</option>
            <option value="length">Length, longest first</option>
            <option value="size">Size, largest first</option>
          </select>
        </label>
        <button type="button" disabled={p.busy || unused.length === 0} onClick={() => confirmRemove(unused.map((s) => s.id), `${unused.length} unused sample(s)`)} className={btn}>
          Remove unused ({unused.length})
        </button>
      </div>
      <p id="root-hint" className="-mt-2 text-xs text-[color:var(--muted)]">{modeHint}</p>

      <p className="text-sm text-[color:var(--muted)]" aria-live="polite">
        {p.samples.length} sample(s), {formatBytes(totalBytes)}. {rows.length !== p.samples.length && `${rows.length} match the search. `}
        {chosen.length > 0 && `${chosen.length} selected.`}
      </p>

      {chosen.length > 0 && (
        <div className="flex flex-wrap items-end gap-3 rounded-sm border border-[color:var(--ink)] bg-[color:var(--surface)] px-4 py-3" role="region" aria-label="Actions for selected samples">
          <span className="self-center text-sm font-semibold">{chosen.length} selected</span>
          <button type="button" disabled={p.busy} onClick={() => p.onDetectRoots(chosen)} className={btn}>
            Detect root key
          </button>
          <div className="flex items-end gap-2">
            <NumberCell label="Map from key" value={lo} min={0} max={127} hint={noteName(lo)} className="w-14" onCommit={(v) => setLo(Math.min(v, hi))} />
            <NumberCell label="Map to key" value={hi} min={0} max={127} hint={noteName(hi)} className="w-14" onCommit={(v) => setHi(Math.max(v, lo))} />
          </div>
          <button type="button" disabled={p.busy || !p.instrumentName} onClick={() => p.onMapToInstrument(chosen, lo, hi)} className={btn}>
            Map into {p.instrumentName ? `“${p.instrumentName}”` : 'instrument'}
          </button>
          <button type="button" disabled={p.busy} onClick={() => p.onCreateInstrument(chosen, lo, hi)} className={btn}>
            Create new instrument
          </button>
          <button type="button" disabled={p.busy} onClick={() => confirmRemove(chosen, `${chosen.length} selected sample(s)`)} className={`${btn} !text-[color:var(--accent)]`}>
            Remove selected
          </button>
          <button type="button" onClick={() => setSelected(new Set())} className={`rounded-sm px-2 py-1.5 text-sm text-[color:var(--muted)] underline ${focusRing}`}>
            Clear selection
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-sm border border-[color:var(--line)] bg-[color:var(--surface)]">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[color:var(--line)] text-left text-xs font-semibold text-[color:var(--muted)]">
              <th className="w-10 px-3 py-2" scope="col">
                <input type="checkbox" checked={allVisibleSelected} onChange={toggleVisible} aria-label="Select all samples on this page" className={focusRing} />
              </th>
              <th className="px-2 py-2" scope="col">Name</th>
              <th className="px-2 py-2" scope="col">Root key</th>
              <th className="px-2 py-2" scope="col">Format</th>
              <th className="px-2 py-2" scope="col">Length</th>
              <th className="px-2 py-2" scope="col">Size</th>
              <th className="px-2 py-2" scope="col">Loop</th>
              <th className="px-2 py-2" scope="col">Zones</th>
              <th className="px-2 py-2" scope="col"><span className="sr-only">Edit</span></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((s) => {
              const uses = p.usage.get(s.id) ?? 0;
              return (
                <tr key={s.id} className={`border-b border-[color:var(--line-soft)] ${selected.has(s.id) ? 'bg-[color:rgb(var(--accent-rgb)/0.05)]' : ''}`}>
                  <td className="px-3 py-1.5">
                    <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} aria-label={`Select ${s.name}`} className={focusRing} />
                  </td>
                  <td className="px-2 py-1.5">
                    <label>
                      <span className="sr-only">Sample name</span>
                      <input value={s.name} disabled={p.busy} onChange={(e) => p.onPatch(s.id, { name: e.target.value })} className={`${fieldClass} w-full min-w-[200px]`} />
                    </label>
                  </td>
                  <td className="px-2 py-1.5">
                    <NumberCell label={`Root key of ${s.name}`} value={s.rootKey} min={0} max={127} hint={noteName(s.rootKey)} disabled={p.busy} className="w-14" onCommit={(v) => p.onPatch(s.id, { rootKey: v })} />
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-[color:var(--ink-2)]">
                    {s.channels === 1 ? 'Mono' : s.channels === 2 ? 'Stereo' : `${s.channels} ch`}, {(s.sampleRate / 1000).toFixed(1)} kHz, {s.format}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 tabular-nums">{(s.frames / s.sampleRate).toFixed(2)} s</td>
                  <td className="whitespace-nowrap px-2 py-1.5 tabular-nums">{formatBytes(s.blob.size)}</td>
                  <td className="whitespace-nowrap px-2 py-1.5">
                    {s.loopMode ? <span className="rounded-sm bg-[color:rgb(var(--brass-rgb)/0.2)] px-1.5 py-px text-xs font-semibold text-[color:var(--brass-ink)]">Loop</span> : <span className="text-[color:var(--muted)]">Off</span>}
                    {s.origin && <span className="ml-1.5 text-xs text-[color:var(--muted)]">trimmed</span>}
                  </td>
                  <td className="px-2 py-1.5 tabular-nums">
                    {uses > 0 ? uses : <span className="rounded-sm bg-[color:rgb(var(--brass-rgb)/0.2)] px-1.5 py-px text-xs font-semibold text-[color:var(--brass-ink)]">unused</span>}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <button type="button" disabled={p.busy} onClick={() => p.onEdit(s.id)} className={`rounded-sm border border-[color:var(--field-line)] px-2.5 py-1 text-xs font-semibold hover:border-[color:var(--ink)] disabled:cursor-not-allowed disabled:text-[color:var(--muted)] ${focusRing}`} aria-label={`Edit ${s.name}: trim and loop`}>
                      Trim and loop
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {p.samples.length === 0 && <p className="px-5 py-8 text-sm text-[color:var(--muted)]">The library is empty. Drop WAV files above to start.</p>}
        {p.samples.length > 0 && rows.length === 0 && <p className="px-5 py-8 text-sm text-[color:var(--muted)]">No sample matches “{query}”.</p>}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <button type="button" disabled={current === 0} onClick={() => setPage(current - 1)} className={btn}>
            Previous
          </button>
          <span className="tabular-nums text-[color:var(--muted)]">
            Page {current + 1} of {pages}
          </span>
          <button type="button" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} className={btn}>
            Next
          </button>
        </div>
      )}
    </div>
  );
}