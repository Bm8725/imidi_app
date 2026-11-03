'use client';

import React, { useMemo } from 'react';
import type { BankSample, BankZone } from '@/lib/wbnk-compiler';

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const BLACK = new Set([1, 3, 6, 8, 10]);
const LANE = 28;

export const noteName = (n: number) => `${NOTES[((n % 12) + 12) % 12]}${Math.floor(n / 12) - 1}`;

interface Props {
  zones: BankZone[];
  samples: BankSample[];
  selectedZoneId: string | null;
  onSelect: (zoneId: string) => void;
}

export default function KeyMap({ zones, samples, selectedZoneId, onSelect }: Props) {
  const { laneOf, laneCount } = useMemo(() => {
    const order = [...zones].sort((a, b) => a.keyLo - b.keyLo || a.velLo - b.velLo);
    const lanes: BankZone[][] = [];
    const laneOf = new Map<string, number>();
    for (const z of order) {
      let i = lanes.findIndex((l) => l.every((o) => o.keyHi < z.keyLo || o.keyLo > z.keyHi));
      if (i < 0) {
        i = lanes.length;
        lanes.push([]);
      }
      lanes[i].push(z);
      laneOf.set(z.id, i);
    }
    return { laneOf, laneCount: Math.max(1, lanes.length) };
  }, [zones]);

  const sampleName = (id: string | null) => samples.find((s) => s.id === id)?.name ?? null;
  const pct = (n: number) => `${(n / 128) * 100}%`;
  const octaves = Array.from({ length: 11 }, (_, i) => i * 12).filter((n) => n < 128);

  return (
    <div className="select-none">
      <div className="relative" style={{ height: laneCount * LANE + 4 }}>
        {octaves.map((n) => (
          <div key={n} className="absolute inset-y-0 border-l border-[#D7DAE0]" style={{ left: pct(n) }} />
        ))}
        {zones.map((z) => {
          const selected = z.id === selectedZoneId;
          const name = sampleName(z.sampleId);
          const fullVel = z.velLo === 0 && z.velHi === 127;
          const label = `${name ?? 'No sample'}${fullVel ? '' : `  v${z.velLo}–${z.velHi}`}`;
          return (
            <button
              key={z.id}
              type="button"
              onClick={() => onSelect(z.id)}
              title={`${label}\n${noteName(z.keyLo)} to ${noteName(z.keyHi)}, velocity ${z.velLo}–${z.velHi}`}
              aria-pressed={selected}
              className={[
                'absolute overflow-hidden whitespace-nowrap rounded-sm px-1.5 text-left text-[11px] font-medium leading-6',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#A61E2B]',
                selected
                  ? 'z-10 bg-[#A61E2B] text-white'
                  : name
                  ? 'border border-[#9C7A3C]/70 bg-[#9C7A3C]/20 text-[#4A3A18] hover:bg-[#9C7A3C]/30'
                  : 'border border-dashed border-[#5A6270]/70 bg-white text-[#5A6270] hover:bg-[#F2F3F5]',
              ].join(' ')}
              style={{
                left: pct(z.keyLo),
                width: `calc(${pct(z.keyHi - z.keyLo + 1)} - 1px)`,
                top: (laneOf.get(z.id) ?? 0) * LANE + 2,
                height: LANE - 4,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="flex h-7 overflow-hidden rounded-b-sm border border-[#15181D]/80" aria-hidden="true">
        {Array.from({ length: 128 }, (_, n) => {
          const inZone = zones.some((z) => n >= z.keyLo && n <= z.keyHi);
          const black = BLACK.has(n % 12);
          return (
            <div
              key={n}
              className={[
                'flex-1 border-r last:border-r-0',
                black ? 'border-[#15181D]/30 bg-[#15181D]' : 'border-[#15181D]/15 bg-white',
                inZone ? '' : 'opacity-35',
              ].join(' ')}
            />
          );
        })}
      </div>

      <div className="relative mt-1 h-4 text-[10px] text-[#5A6270]" aria-hidden="true">
        {octaves.map((n) => (
          <span key={n} className="absolute" style={{ left: pct(n) }}>
            {noteName(n)}
          </span>
        ))}
      </div>
    </div>
  );
}