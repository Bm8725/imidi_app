/** Minimal MIDI message parser for the Play tab. */

export type MidiEvent =
  | { type: 'noteOn'; channel: number; note: number; velocity: number }
  | { type: 'noteOff'; channel: number; note: number; velocity: number }
  | { type: 'cc'; channel: number; controller: number; value: number }
  | { type: 'bend'; channel: number; value: number } // -1 .. 1
  | { type: 'program'; channel: number; program: number };

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const midiNoteName = (n: number) => `${NAMES[n % 12]}${Math.floor(n / 12) - 1}`;

export function parseMidi(data: Uint8Array | null | undefined): MidiEvent | null {
  if (!data || data.length < 2) return null;
  const status = data[0];
  if (status < 0x80 || status >= 0xf0) return null; // system messages and clock are ignored
  const channel = (status & 0x0f) + 1;
  const a = data[1] & 0x7f;
  const b = (data[2] ?? 0) & 0x7f;
  switch (status & 0xf0) {
    case 0x90:
      return b > 0 ? { type: 'noteOn', channel, note: a, velocity: b } : { type: 'noteOff', channel, note: a, velocity: 0 };
    case 0x80:
      return { type: 'noteOff', channel, note: a, velocity: b };
    case 0xb0:
      return { type: 'cc', channel, controller: a, value: b };
    case 0xe0:
      return { type: 'bend', channel, value: Math.max(-1, Math.min(1, (((b << 7) | a) - 8192) / 8192)) };
    case 0xc0:
      return { type: 'program', channel, program: a };
    default:
      return null;
  }
}

const CC_NAMES: Record<number, string> = {
  1: 'Mod wheel',
  7: 'Volume',
  11: 'Expression',
  64: 'Sustain pedal',
  120: 'All sound off',
  121: 'Reset controllers',
  123: 'All notes off',
};

export function describeMidi(e: MidiEvent): string {
  switch (e.type) {
    case 'noteOn':
      return `Ch ${e.channel}  Note on ${midiNoteName(e.note)} (${e.note}), velocity ${e.velocity}`;
    case 'noteOff':
      return `Ch ${e.channel}  Note off ${midiNoteName(e.note)} (${e.note})`;
    case 'cc':
      return `Ch ${e.channel}  CC${e.controller} ${CC_NAMES[e.controller] ?? 'Controller'} = ${e.value}`;
    case 'bend':
      return `Ch ${e.channel}  Pitch bend ${(e.value * 2).toFixed(2)} semitones`;
    case 'program':
      return `Ch ${e.channel}  Program change ${String(e.program).padStart(3, '0')}`;
  }
}