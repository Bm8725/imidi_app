'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { BankSample, BankZone } from '@/lib/wbnk-compiler';
import { noteName } from './KeyMap';

export const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[color:var(--accent)]';
export const fieldClass = `rounded-sm border border-[color:var(--field-line)] bg-[color:var(--surface)] px-2 py-1 text-sm tabular-nums text-[color:var(--ink)] transition-colors disabled:bg-[color:var(--bg)] disabled:text-[color:var(--muted)] ${focusRing}`;

interface NumberCellProps {
  value: number;
  onCommit: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  label: string;
  hint?: string;
  disabled?: boolean;
  className?: string;
  /** Show the label above the field (used in the card layout). */
  showLabel?: boolean;
}

/** Text input that accepts free typing and commits a clamped number on blur or Enter. */
export function NumberCell({ value, onCommit, min, max, step = 1, label, hint, disabled, className = 'w-16', showLabel }: NumberCellProps) {
  const [draft, setDraft] = useState(String(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(String(value));
  }, [value]);

  const commit = () => {
    focused.current = false;
    const n = Number(draft);
    if (draft.trim() === '' || Number.isNaN(n)) {
      setDraft(String(value));
      return;
    }
    const snapped = step < 1 ? Math.round(n / step) * step : Math.round(n);
    const clamped = Math.min(max, Math.max(min, Number(snapped.toFixed(2))));
    onCommit(clamped);
    setDraft(String(clamped));
  };

  return (
    <label className="block">
      {showLabel ? <span className="mb-1 block text-xs font-semibold text-[color:var(--muted)]">{label}</span> : <span className="sr-only">{label}</span>}
      <input
        type="text"
        inputMode={step < 1 ? 'decimal' : 'numeric'}
        value={draft}
        disabled={disabled}
        onFocus={(e) => {
          focused.current = true;
          e.currentTarget.select();
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            setDraft(String(value));
            e.currentTarget.blur();
          }
        }}
        className={`${fieldClass} ${className}`}
      />
      {hint && <span className="mt-0.5 block text-[10px] leading-none text-[color:var(--muted)]">{hint}</span>}
    </label>
  );
}

interface Props {
  zones: BankZone[];
  samples: BankSample[];
  selectedZoneId: string | null;
  disabled?: boolean;
  onSelect: (id: string) => void;
  onPatch: (id: string, patch: Partial<BankZone>) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
}

export default function ZoneTable({ zones, samples, selectedZoneId, disabled, onSelect, onPatch, onDuplicate, onRemove, onAdd }: Props) {
  const th = 'px-2 pb-2 text-left text-xs font-semibold text-[color:var(--muted)]';
  const group = 'border-b border-[color:var(--line)] px-2 pb-1 pt-2 text-left text-xs font-semibold text-[color:var(--ink)]';
  const small = (extra = '') => `rounded-sm px-2 py-1 text-xs font-medium transition-colors ${extra} ${focusRing}`;

  const num = (z: BankZone, field: keyof BankZone, label: string, min: number, max: number, extra?: Partial<NumberCellProps>) => (
    <NumberCell
      label={label}
      value={z[field] as number}
      min={min}
      max={max}
      disabled={disabled}
      onCommit={(v) => onPatch(z.id, { [field]: v } as Partial<BankZone>)}
      {...extra}
    />
  );

  const sampleSelect = (z: BankZone, className: string) => (
    <label>
      <span className="sr-only">Sample</span>
      <select value={z.sampleId ?? ''} disabled={disabled} onChange={(e) => onPatch(z.id, { sampleId: e.target.value || null })} className={`${fieldClass} ${className}`}>
        <option value="">None</option>
        {samples.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
    </label>
  );

  const actions = (z: BankZone) => (
    <>
      <button type="button" disabled={disabled} onClick={(e) => { e.stopPropagation(); onDuplicate(z.id); }} className={small('text-[color:var(--ink)] hover:bg-[color:var(--line-soft)]')}>
        Duplicate
      </button>
      <button type="button" disabled={disabled} onClick={(e) => { e.stopPropagation(); onRemove(z.id); }} className={small('text-[color:var(--accent)] hover:bg-[color:rgb(var(--accent-rgb)/0.1)]')}>
        Remove
      </button>
    </>
  );

  return (
    <div>
      {/* Wide screens: one row per zone */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[920px] border-collapse text-sm">
          <thead>
            <tr>
              <th className={group} rowSpan={2} scope="col">Sample</th>
              <th className={group} colSpan={2} scope="colgroup">Key range</th>
              <th className={group} colSpan={2} scope="colgroup">Velocity range</th>
              <th className={group} colSpan={2} scope="colgroup">Level</th>
              <th className={group} colSpan={4} scope="colgroup">Envelope (ms)</th>
              <th className={group} rowSpan={2} scope="col"><span className="sr-only">Actions</span></th>
            </tr>
            <tr>
              {['Low', 'High', 'Low', 'High', 'Pan', 'Atten. (dB)', 'Attack', 'Decay', 'Sustain', 'Release'].map((h, i) => (
                <th key={i} className={th} scope="col">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {zones.map((z) => {
              const selected = z.id === selectedZoneId;
              return (
                <tr
                  key={z.id}
                  aria-selected={selected}
                  onClick={() => onSelect(z.id)}
                  className={`border-b border-[color:var(--line-soft)] align-top transition-colors ${selected ? 'bg-[color:rgb(var(--accent-rgb)/0.06)] shadow-[inset_3px_0_0_var(--accent)]' : 'hover:bg-[color:var(--hover)]'}`}
                >
                  <td className="px-2 py-2">{sampleSelect(z, 'w-44')}</td>
                  <td className="px-2 py-2">{num(z, 'keyLo', 'Low key', 0, 127, { hint: noteName(z.keyLo), className: 'w-14' })}</td>
                  <td className="px-2 py-2">{num(z, 'keyHi', 'High key', 0, 127, { hint: noteName(z.keyHi), className: 'w-14' })}</td>
                  <td className="px-2 py-2">{num(z, 'velLo', 'Low velocity', 0, 127, { className: 'w-14' })}</td>
                  <td className="px-2 py-2">{num(z, 'velHi', 'High velocity', 0, 127, { className: 'w-14' })}</td>
                  <td className="px-2 py-2">{num(z, 'pan', 'Pan', -100, 100, { hint: z.pan === 0 ? 'centre' : z.pan < 0 ? 'left' : 'right', className: 'w-14' })}</td>
                  <td className="px-2 py-2">{num(z, 'attenuation', 'Attenuation in decibels', 0, 96, { step: 0.1, className: 'w-16' })}</td>
                  <td className="px-2 py-2">{num(z, 'attack', 'Attack in milliseconds', 0, 600000, { className: 'w-[4.5rem]' })}</td>
                  <td className="px-2 py-2">{num(z, 'decay', 'Decay in milliseconds', 0, 600000, { className: 'w-[4.5rem]' })}</td>
                  <td className="px-2 py-2">{num(z, 'sustain', 'Sustain in milliseconds', 0, 600000, { className: 'w-[4.5rem]' })}</td>
                  <td className="px-2 py-2">{num(z, 'release', 'Release in milliseconds', 0, 600000, { className: 'w-[4.5rem]' })}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-right">{actions(z)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Tablets and phones: one card per zone */}
      <div className="grid gap-3 md:grid-cols-2 lg:hidden">
        {zones.map((z, i) => {
          const selected = z.id === selectedZoneId;
          const f = (field: keyof BankZone, label: string, min: number, max: number, extra?: Partial<NumberCellProps>) =>
            num(z, field, label, min, max, { showLabel: true, className: 'w-full', ...extra });
          return (
            <div
              key={z.id}
              onClick={() => onSelect(z.id)}
              className={`rounded-sm border p-3 transition-colors ${selected ? 'border-[color:var(--accent)] bg-[color:rgb(var(--accent-rgb)/0.05)]' : 'border-[color:var(--line)] bg-[color:var(--surface)]'}`}
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">
                  Zone {i + 1} <span className="font-normal text-[color:var(--muted)]">{noteName(z.keyLo)} to {noteName(z.keyHi)}</span>
                </span>
                <span className="flex">{actions(z)}</span>
              </div>
              <div className="space-y-3">
                <div>
                  <span className="mb-1 block text-xs font-semibold text-[color:var(--muted)]">Sample</span>
                  {sampleSelect(z, 'w-full')}
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {f('keyLo', 'Low key', 0, 127, { hint: noteName(z.keyLo) })}
                  {f('keyHi', 'High key', 0, 127, { hint: noteName(z.keyHi) })}
                  {f('velLo', 'Low velocity', 0, 127)}
                  {f('velHi', 'High velocity', 0, 127)}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {f('pan', 'Pan', -100, 100, { hint: z.pan === 0 ? 'centre' : z.pan < 0 ? 'left' : 'right' })}
                  {f('attenuation', 'Attenuation (dB)', 0, 96, { step: 0.1 })}
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {f('attack', 'Attack (ms)', 0, 600000)}
                  {f('decay', 'Decay (ms)', 0, 600000)}
                  {f('sustain', 'Sustain (ms)', 0, 600000)}
                  {f('release', 'Release (ms)', 0, 600000)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {zones.length === 0 && (
        <p className="py-6 text-sm text-[color:var(--muted)]">This instrument has no zones yet. Add a zone to map a range of keys to a sample.</p>
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={onAdd}
        className={`mt-3 rounded-sm border border-[color:var(--ink)] px-3 py-1.5 text-sm font-medium text-[color:var(--ink)] transition-colors hover:bg-[color:var(--ink)] hover:text-[color:var(--bg)] ${focusRing}`}
      >
        Add zone
      </button>
    </div>
  );
}