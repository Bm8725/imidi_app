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

export type RootMode = 'auto' | 'midi' | 'note' | 'wav';

export const ROOT_MODES: { id: RootMode; label: string; hint: string }[] = [
  { id: 'auto', label: 'Automatic', hint: 'MIDI number with 3 digits (Bassoon 044), then a note name (C4), then the tag inside the WAV file' },
  { id: 'midi', label: 'MIDI number in the name', hint: 'Bassoon 044, bassoon_80, bassoon44. Ignores v2, rr3, 24bit, 44k' },
  { id: 'note', label: 'Note name in the name', hint: 'Accordion_C4, Solo F#3, Bb2 (C4 = MIDI 60)' },
  { id: 'wav', label: 'WAV file tag only', hint: 'Uses the root note stored inside the WAV file by the sample editor' },
];

interface NumberToken {
  value: number;
  digits: number;
  /** Letters directly in front of the number, for example "v" in "v2". */
  prefix: string;
}

function numberTokens(base: string): NumberToken[] {
  const out: NumberToken[] = [];
  for (const m of base.matchAll(/\d+/g)) {
    const digits = m[0];
    const index = m.index ?? 0;
    if (digits.length > 3) continue; // 44100 and similar
    if (/^\s?(bit|khz|hz|k\b|ms|db|s\b|bpm)/i.test(base.slice(index + digits.length))) continue; // 24bit, 44k
    const prefix = (base.slice(0, index).match(/[A-Za-z]*$/) ?? [''])[0];
    out.push({ value: parseInt(digits, 10), digits: digits.length, prefix });
  }
  return out;
}

/**
 * Reads a MIDI note number from a name such as "Bassoon 044".
 * strict = only zero-padded 3-digit numbers; otherwise the last plain number counts too.
 */
export function detectMidiNumber(name: string, strict = false): number | null {
  const base = name.replace(/\.[A-Za-z0-9]{1,4}$/, '');
  // "v2", "rr3", "vel100" are layer numbers, not notes. A long word before the number ("bassoon44") is fine.
  const usable = numberTokens(base).filter((t) => t.value <= 127 && (t.prefix.length === 0 || t.prefix.length > 3));
  const padded = usable.find((t) => t.digits === 3);
  if (padded) return padded.value;
  if (strict || usable.length === 0) return null;
  return usable[usable.length - 1].value;
}

/** Finds a note name such as C4, F#3 or Bb2 in a file name (C4 = MIDI 60). */
export function detectNoteName(name: string): number | null {
  const m = name.match(/(?:^|[^A-Za-z])([A-Ga-g])([#b]?)(-?\d)(?!\d)/);
  if (!m) return null;
  let n = NOTE_INDEX[m[1].toUpperCase()];
  if (m[2] === '#') n += 1;
  if (m[2] === 'b') n -= 1;
  const key = (parseInt(m[3], 10) + 1) * 12 + n;
  return key >= 0 && key <= 127 ? key : null;
}

export function detectRootKey(name: string, mode: RootMode = 'auto'): number | null {
  if (mode === 'midi') return detectMidiNumber(name, false);
  if (mode === 'note') return detectNoteName(name);
  if (mode === 'wav') return null;
  return detectMidiNumber(name, true) ?? detectNoteName(name);
}

/** The root key a sample should get under the chosen mode, or null when nothing was found. */
export function resolveRootKey(sample: Pick<BankSample, 'name' | 'wavRoot'>, mode: RootMode): number | null {
  if (mode === 'wav') return sample.wavRoot ?? null;
  const byName = detectRootKey(sample.name, mode);
  if (byName !== null) return byName;
  return mode === 'auto' ? sample.wavRoot ?? null : null;
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