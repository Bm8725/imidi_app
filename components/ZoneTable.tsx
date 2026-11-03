'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { BankSample, BankZone } from '@/lib/wbnk-compiler';
import { noteName } from './KeyMap';

export const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#A61E2B]';
export const fieldClass = `rounded-sm border border-[#C5C9D1] bg-white px-2 py-1 text-sm tabular-nums text-[#15181D] disabled:bg-[#F2F3F5] disabled:text-[#5A6270] ${focusRing}`;

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
}

/** Text input that accepts free typing and commits a clamped number on blur or Enter. */
export function NumberCell({ value, onCommit, min, max, step = 1, label, hint, disabled, className = 'w-16' }: NumberCellProps) {
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
      <span className="sr-only">{label}</span>
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
      {hint && <span className="mt-0.5 block text-[10px] leading-none text-[#5A6270]">{hint}</span>}
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
  const th = 'px-2 pb-2 text-left text-xs font-semibold text-[#5A6270]';
  const group = 'border-b border-[#D7DAE0] px-2 pb-1 pt-2 text-left text-xs font-semibold text-[#15181D]';

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] border-collapse text-sm">
          <thead>
            <tr>
              <th className={group} rowSpan={2} scope="col">
                Sample
              </th>
              <th className={group} colSpan={2} scope="colgroup">
                Key range
              </th>
              <th className={group} colSpan={2} scope="colgroup">
                Velocity range
              </th>
              <th className={group} colSpan={2} scope="colgroup">
                Level
              </th>
              <th className={group} colSpan={4} scope="colgroup">
                Envelope (ms)
              </th>
              <th className={group} rowSpan={2} scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
            <tr>
              {['Low', 'High', 'Low', 'High', 'Pan', 'Atten. (dB)', 'Attack', 'Decay', 'Sustain', 'Release'].map((h, i) => (
                <th key={i} className={th} scope="col">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {zones.map((z) => {
              const selected = z.id === selectedZoneId;
              const n = (field: keyof BankZone, label: string, min: number, max: number, extra?: Partial<NumberCellProps>) => (
                <NumberCell
                  label={`${label}`}
                  value={z[field] as number}
                  min={min}
                  max={max}
                  disabled={disabled}
                  onCommit={(v) => onPatch(z.id, { [field]: v } as Partial<BankZone>)}
                  {...extra}
                />
              );
              return (
                <tr
                  key={z.id}
                  aria-selected={selected}
                  onClick={() => onSelect(z.id)}
                  className={`border-b border-[#E4E6EB] align-top ${selected ? 'bg-[#A61E2B]/[0.06] shadow-[inset_3px_0_0_#A61E2B]' : 'hover:bg-[#F7F8F9]'}`}
                >
                  <td className="px-2 py-2">
                    <label>
                      <span className="sr-only">Sample</span>
                      <select
                        value={z.sampleId ?? ''}
                        disabled={disabled}
                        onChange={(e) => onPatch(z.id, { sampleId: e.target.value || null })}
                        className={`${fieldClass} w-44`}
                      >
                        <option value="">None</option>
                        {samples.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </td>
                  <td className="px-2 py-2">{n('keyLo', 'Low key', 0, 127, { hint: noteName(z.keyLo), className: 'w-14' })}</td>
                  <td className="px-2 py-2">{n('keyHi', 'High key', 0, 127, { hint: noteName(z.keyHi), className: 'w-14' })}</td>
                  <td className="px-2 py-2">{n('velLo', 'Low velocity', 0, 127, { className: 'w-14' })}</td>
                  <td className="px-2 py-2">{n('velHi', 'High velocity', 0, 127, { className: 'w-14' })}</td>
                  <td className="px-2 py-2">{n('pan', 'Pan', -100, 100, { hint: z.pan === 0 ? 'centre' : z.pan < 0 ? 'left' : 'right', className: 'w-14' })}</td>
                  <td className="px-2 py-2">{n('attenuation', 'Attenuation in decibels', 0, 96, { step: 0.1, className: 'w-16' })}</td>
                  <td className="px-2 py-2">{n('attack', 'Attack in milliseconds', 0, 600000, { className: 'w-[4.5rem]' })}</td>
                  <td className="px-2 py-2">{n('decay', 'Decay in milliseconds', 0, 600000, { className: 'w-[4.5rem]' })}</td>
                  <td className="px-2 py-2">{n('sustain', 'Sustain in milliseconds', 0, 600000, { className: 'w-[4.5rem]' })}</td>
                  <td className="px-2 py-2">{n('release', 'Release in milliseconds', 0, 600000, { className: 'w-[4.5rem]' })}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-right">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDuplicate(z.id);
                      }}
                      className={`rounded-sm px-2 py-1 text-xs font-medium text-[#15181D] hover:bg-[#E4E6EB] ${focusRing}`}
                    >
                      Duplicate
                    </button>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove(z.id);
                      }}
                      className={`rounded-sm px-2 py-1 text-xs font-medium text-[#A61E2B] hover:bg-[#A61E2B]/10 ${focusRing}`}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {zones.length === 0 && (
        <p className="py-6 text-sm text-[#5A6270]">This instrument has no zones yet. Add a zone to map a range of keys to a sample.</p>
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={onAdd}
        className={`mt-3 rounded-sm border border-[#15181D] px-3 py-1.5 text-sm font-medium text-[#15181D] hover:bg-[#15181D] hover:text-white ${focusRing}`}
      >
        Add zone
      </button>
    </div>
  );
}