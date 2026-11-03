import { BankSample, BankZone, createZone } from './wbnk-compiler';

/* ───────────────────────── instrument presets ───────────────────────── */

export interface InstrumentPreset {
  id: string;
  label: string;
  /** Default instrument name. */
  name: string;
  zones: () => BankZone[];
}

// MIDI numbering: C4 = 60, so C2 = 36, F3 = 53, A6 = 93, C7 = 96.
export const INSTRUMENT_PRESETS: InstrumentPreset[] = [
  { id: 'accordion-solo', label: 'Accordion solo (C2 to C7)', name: 'Accordion Solo', zones: () => [createZone({ keyLo: 36, keyHi: 96 })] },
  { id: 'accordion-treble', label: 'Accordion treble, 41 keys (F3 to A6)', name: 'Accordion Treble', zones: () => [createZone({ keyLo: 53, keyHi: 93 })] },
  {
    id: 'split',
    label: 'Bass / treble split at middle C',
    name: 'Bass and Treble',
    zones: () => [createZone({ keyLo: 36, keyHi: 59 }), createZone({ keyLo: 60, keyHi: 96 })],
  },
  {
    id: 'vel2',
    label: 'Two velocity layers',
    name: 'Two Layers',
    zones: () => [createZone({ velLo: 0, velHi: 80 }), createZone({ velLo: 81, velHi: 127 })],
  },
  {
    id: 'vel3',
    label: 'Three velocity layers',
    name: 'Three Layers',
    zones: () => [createZone({ velLo: 0, velHi: 50 }), createZone({ velLo: 51, velHi: 95 }), createZone({ velLo: 96, velHi: 127 })],
  },
  { id: 'full', label: 'Full keyboard, one zone', name: 'Full Range', zones: () => [createZone({ keyLo: 0, keyHi: 127 })] },
  { id: 'empty', label: 'Empty instrument', name: 'New Instrument', zones: () => [] },
];

/* ───────────────────────── envelope presets ───────────────────────── */

export interface EnvelopePreset {
  id: string;
  label: string;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

export const ENVELOPE_PRESETS: EnvelopePreset[] = [
  { id: 'default', label: 'Default', attack: 0, decay: 250, sustain: 1000, release: 50 },
  { id: 'soft', label: 'Soft attack', attack: 40, decay: 250, sustain: 1000, release: 120 },
  { id: 'short', label: 'Short and dry', attack: 0, decay: 80, sustain: 300, release: 30 },
  { id: 'long', label: 'Long release', attack: 0, decay: 250, sustain: 1000, release: 400 },
];

/* ───────────────────────── sample helpers ───────────────────────── */

const NOTE_INDEX: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Finds a note name such as C4, F#3 or Bb2 in a file name (C4 = MIDI 60). */
export function detectRootKey(name: string): number | null {
  const m = name.match(/(?:^|[^A-Za-z])([A-Ga-g])([#b]?)(-?\d)(?!\d)/);
  if (!m) return null;
  let n = NOTE_INDEX[m[1].toUpperCase()];
  if (m[2] === '#') n += 1;
  if (m[2] === 'b') n -= 1;
  const key = (parseInt(m[3], 10) + 1) * 12 + n;
  return key >= 0 && key <= 127 ? key : null;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * Spreads samples across the keyboard. Each zone reaches halfway to its neighbours.
 * Several samples on the same root key become velocity layers of equal width.
 */
export function autoMapZones(samples: BankSample[], lo = 0, hi = 127): BankZone[] {
  const sorted = [...samples].sort(
    (a, b) => a.rootKey - b.rootKey || a.name.localeCompare(b.name, undefined, { numeric: true })
  );
  const groups = new Map<number, BankSample[]>();
  for (const s of sorted) groups.set(s.rootKey, [...(groups.get(s.rootKey) ?? []), s]);
  const roots = [...groups.keys()];
  const zones: BankZone[] = [];

  roots.forEach((root, i) => {
    const rawLo = i === 0 ? lo : Math.floor((roots[i - 1] + root) / 2) + 1;
    const rawHi = i === roots.length - 1 ? hi : Math.floor((root + roots[i + 1]) / 2);
    const keyHi = clamp(rawHi, lo, hi);
    const keyLo = Math.min(clamp(rawLo, lo, hi), keyHi);
    const layers = groups.get(root)!;
    layers.forEach((s, j) => {
      zones.push(
        createZone({
          keyLo,
          keyHi,
          velLo: Math.round((j * 128) / layers.length),
          velHi: Math.round(((j + 1) * 128) / layers.length) - 1,
          sampleId: s.id,
        })
      );
    });
  });
  return zones;
}

/** A readable instrument name from the shared start of the sample names, or null. */
export function commonName(samples: BankSample[]): string | null {
  if (samples.length === 0) return null;
  let prefix = samples[0].name;
  for (const s of samples) {
    while (prefix && !s.name.startsWith(prefix)) prefix = prefix.slice(0, -1);
  }
  const cleaned = prefix.replace(/[\s_\-.]+[A-Ga-g][#b]?$/, '').replace(/[\s_\-.]+$/, '').replace(/[\s_\-.]+/g, ' ').trim();
  return cleaned.length >= 3 ? cleaned : null;
}