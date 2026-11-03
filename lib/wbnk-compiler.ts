/**
 * iMIDI .wbnk v1.0 — bank model, validator, streaming writer and reader.
 *
 * Binary layouts that the written spec leaves open are fixed here (all Little-Endian):
 *
 * SMPL  : u32 count, then `count` records of 64 bytes:
 *           0  char[32] name (zero padded)
 *           32 u64 data_offset   (relative to the start of the DATA chunk body)
 *           40 u32 frames
 *           44 u32 sample_rate
 *           48 u16 channels
 *           50 u16 format        (0 = Pcm16, 1 = Pcm24, 2 = F32)
 *           52 u32 loop_start    (frames)
 *           56 u32 loop_end      (frames)
 *           60 u8  root_key
 *           61 i8  fine_tune     (cents)
 *           62 u8  loop_mode    (0 = off, 1 = forward loop between loop_start and loop_end)
 *           63 u8  reserved
 *
 * INST  : u32 ni, u32 nz, ni × 40-byte instrument, nz × 32-byte zone.
 *         Instrument: char[32] name, u32 first_zone, u32 zone_count.
 *         Zone:  0 u8 key_lo, 1 u8 key_hi, 2 u8 vel_lo, 3 u8 vel_hi,
 *                4 u32 sample_index (0xFFFFFFFF = none),
 *                8 i16 pan (-100..100), 10 u16 attenuation (centibels),
 *                12 u32 attack_ms, 16 u32 decay_ms, 20 u32 sustain_ms, 24 u32 release_ms,
 *                28 u32 reserved
 *
 * DATA  : raw sample bytes, each sample padded to 16 bytes.
 *
 * Nothing is concatenated in memory: audio is streamed in 4 MB slices straight
 * to the output while the CRC32 is computed incrementally.
 */
import crc32 from 'crc-32';

export const HEADER_SIZE = 64;
export const ENTRY_SIZE = 32;
export const ALIGNMENT = 64;
export const DATA_ALIGNMENT = 16;

const SMPL_RECORD = 64;
const INST_RECORD = 40;
const ZONE_RECORD = 32;
const NAME_BYTES = 32;
const NO_SAMPLE = 0xffffffff;
const SLICE = 4 * 1024 * 1024;

/* ───────────────────────────── model ───────────────────────────── */

export type SampleFormat = 'Pcm16' | 'Pcm24' | 'F32';

const FORMAT_CODE: Record<SampleFormat, number> = { Pcm16: 0, Pcm24: 1, F32: 2 };
const FORMAT_BY_CODE: SampleFormat[] = ['Pcm16', 'Pcm24', 'F32'];
export const BYTES_PER_SAMPLE: Record<SampleFormat, number> = { Pcm16: 2, Pcm24: 3, F32: 4 };

export interface BankSample {
  id: string;
  name: string;
  blob: Blob;
  frames: number;
  sampleRate: number;
  channels: number;
  format: SampleFormat;
  rootKey: number;
  fineTune: number;
  loopStart: number;
  loopEnd: number;
  /** 0 = no loop, 1 = forward loop between loopStart and loopEnd (frames). */
  loopMode: 0 | 1;
  /** Set after trimming, so the editor can restore the untouched recording. */
  origin?: { blob: Blob; frames: number; offset: number };
  /** Root note stored inside the WAV file itself (sampler chunk), when present. */
  wavRoot?: number | null;
}

export interface BankZone {
  id: string;
  keyLo: number;
  keyHi: number;
  velLo: number;
  velHi: number;
  sampleId: string | null;
  pan: number; // -100..100
  attenuation: number; // dB, stored as centibels
  attack: number; // ms
  decay: number; // ms
  sustain: number; // ms
  release: number; // ms
}

export interface BankInstrument {
  id: string;
  name: string;
  zones: BankZone[];
}

export interface BankModel {
  meta: Record<string, unknown>;
  syntText: string;
  instruments: BankInstrument[];
  samples: BankSample[];
}

let counter = 0;
export const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now().toString(36)}-${(counter++).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function createZone(partial: Partial<BankZone> = {}): BankZone {
  return {
    id: uid(),
    keyLo: 36,
    keyHi: 96,
    velLo: 0,
    velHi: 127,
    sampleId: null,
    pan: 0,
    attenuation: 0,
    attack: 0,
    decay: 250,
    sustain: 1000,
    release: 50,
    ...partial,
  };
}

export function createDefaultBank(): BankModel {
  return {
    meta: {
      title: 'iMIDI Accordion Bank',
      author: 'iMIDI',
      copyright_holder: 'iMIDI',
      year: '2026',
      copyright: '© 2026 iMIDI.co.uk. All rights reserved.',
      license: 'TS4X Core DSP Standard v1.0',
      website: 'https://imidi.co.uk',
      contact: '',
      producer: '',
      credits: '',
      notes: '',
      rights_confirmed: false,
    },
    syntText: '{}',
    instruments: [{ id: uid(), name: 'iMIDI Accordion Solo', zones: [createZone()] }],
    samples: [],
  };
}

/* ───────────────────────────── helpers ───────────────────────────── */

const padTo = (size: number, align: number) => (size % align === 0 ? size : size + align - (size % align));

const utf8 = new TextEncoder();

export const nameBytes = (name: string): Uint8Array => {
  let bytes = utf8.encode(name);
  if (bytes.length <= NAME_BYTES) return bytes;
  // cut on a character boundary
  let out = '';
  for (const ch of name) {
    if (utf8.encode(out + ch).length > NAME_BYTES) break;
    out += ch;
  }
  return utf8.encode(out);
};

const writeName = (buf: Uint8Array, offset: number, name: string) => buf.set(nameBytes(name), offset);

const readName = (buf: Uint8Array, offset: number): string => {
  let end = offset;
  while (end < offset + NAME_BYTES && buf[end] !== 0) end++;
  return new TextDecoder().decode(buf.subarray(offset, end));
};

const ascii = (buf: Uint8Array, offset: number, len: number) =>
  String.fromCharCode(...Array.from(buf.subarray(offset, offset + len)));

async function* pieces(source: Uint8Array | Blob): AsyncGenerator<Uint8Array> {
  if (source instanceof Uint8Array) {
    if (source.length) yield source;
    return;
  }
  for (let o = 0; o < source.size; o += SLICE) {
    yield new Uint8Array(await source.slice(o, Math.min(o + SLICE, source.size)).arrayBuffer());
  }
}

function parseSynt(text: string): unknown {
  const trimmed = text.trim();
  return trimmed === '' ? {} : JSON.parse(trimmed);
}

/* ───────────────────────────── validation ───────────────────────────── */

export interface Issue {
  level: 'error' | 'warn';
  message: string;
  instrumentId?: string;
  zoneId?: string;
  tab?: 'instruments' | 'samples' | 'rights';
}

export function validateBank(bank: BankModel): Issue[] {
  const issues: Issue[] = [];
  const err = (message: string, instrumentId?: string, zoneId?: string) =>
    issues.push({ level: 'error', message, instrumentId, zoneId });
  const warn = (message: string, instrumentId?: string, zoneId?: string) =>
    issues.push({ level: 'warn', message, instrumentId, zoneId });

  try {
    parseSynt(bank.syntText);
  } catch {
    err('Synth presets are not valid JSON.');
  }

  if (bank.instruments.length === 0) err('The bank has no instruments. Add at least one.');
  if (bank.instruments.length > 128)
    warn('The bank has more than 128 instruments. Slots above 127 cannot be selected with a standard MIDI program change.');
  if (bank.samples.length === 0) warn('The bank has no samples, so it will play silence.');

  const sampleIds = new Set(bank.samples.map((s) => s.id));
  const used = new Set<string>();
  const seenNames = new Set<string>();
  let overlapReports = 0;

  for (const ins of bank.instruments) {
    const label = `“${ins.name || 'Unnamed'}”`;
    if (!ins.name.trim()) err('An instrument has no name.', ins.id);
    if (utf8.encode(ins.name).length > NAME_BYTES)
      warn(`${label} is longer than 32 bytes and will be shortened.`, ins.id);
    if (seenNames.has(ins.name)) warn(`Two instruments are named ${label}.`, ins.id);
    seenNames.add(ins.name);
    if (ins.zones.length === 0) warn(`${label} has no zones and will not sound.`, ins.id);

    ins.zones.forEach((z, i) => {
      const n = i + 1;
      const range = (v: number) => Number.isInteger(v) && v >= 0 && v <= 127;
      if (![z.keyLo, z.keyHi, z.velLo, z.velHi].every(range))
        err(`${label}, zone ${n}: keys and velocities must be whole numbers from 0 to 127.`, ins.id, z.id);
      if (z.keyLo > z.keyHi) err(`${label}, zone ${n}: the low key is above the high key.`, ins.id, z.id);
      if (z.velLo > z.velHi) err(`${label}, zone ${n}: the low velocity is above the high velocity.`, ins.id, z.id);
      if (z.sampleId === null) warn(`${label}, zone ${n}: no sample assigned.`, ins.id, z.id);
      else if (!sampleIds.has(z.sampleId)) err(`${label}, zone ${n}: its sample no longer exists.`, ins.id, z.id);
      else used.add(z.sampleId);
    });

    for (let a = 0; a < ins.zones.length && overlapReports < 20; a++) {
      for (let b = a + 1; b < ins.zones.length && overlapReports < 20; b++) {
        const x = ins.zones[a];
        const y = ins.zones[b];
        if (x.keyLo <= y.keyHi && y.keyLo <= x.keyHi && x.velLo <= y.velHi && y.velLo <= x.velHi) {
          warn(`${label}: zones ${a + 1} and ${b + 1} overlap in both keys and velocity.`, ins.id, y.id);
          overlapReports++;
        }
      }
    }
  }

  const unused = bank.samples.filter((s) => !used.has(s.id));
  if (unused.length > 0) {
    const bytes = unused.reduce((n, s) => n + s.blob.size, 0);
    issues.push({
      level: 'warn',
      tab: 'samples',
      message: `${unused.length} sample(s) are not used by any zone and will be left out of the file (${formatBytes(bytes)} saved). Map them to a zone if you want them included.`,
    });
  }
  const longNames = bank.samples.filter((s) => utf8.encode(s.name).length > NAME_BYTES).length;
  if (longNames > 0)
    issues.push({ level: 'warn', tab: 'samples', message: `${longNames} sample name(s) are longer than 32 bytes and will be shortened.` });

  for (const smp of bank.samples) {
    if (used.has(smp.id) && smp.loopMode === 1 && !(smp.loopStart >= 0 && smp.loopStart < smp.loopEnd && smp.loopEnd <= smp.frames))
      issues.push({
        level: 'error',
        tab: 'samples',
        message: `Sample “${smp.name}” has loop points outside the sample. Open it in the editor and set the loop again.`,
      });
  }

  const meta = bank.meta as Record<string, unknown>;
  const text = (k: string) => String(meta[k] ?? '').trim();
  const rights = (message: string) => issues.push({ level: 'warn', tab: 'rights', message });
  if (!text('copyright')) rights('No copyright notice. Add one in the Copyright tab.');
  if (!text('license')) rights('No licence is set. Choose one in the Copyright tab.');
  if (meta.rights_confirmed !== true)
    rights('The rights declaration is not confirmed. Confirm that you own or may distribute every sample.');

  return issues;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/* ───────────────────────────── chunk building ───────────────────────────── */

interface Chunk {
  id: string;
  size: number;
  parts: (Uint8Array | Blob)[];
}

/** Samples that at least one zone plays. Only these are written to the file. */
export function usedSamples(bank: BankModel): BankSample[] {
  const ids = new Set<string>();
  for (const ins of bank.instruments) for (const z of ins.zones) if (z.sampleId) ids.add(z.sampleId);
  return bank.samples.filter((s) => ids.has(s.id));
}

function buildChunks(bank: BankModel): Chunk[] {
  const samples = usedSamples(bank);
  const meta = utf8.encode(JSON.stringify(bank.meta ?? {}));
  const synt = utf8.encode(JSON.stringify(parseSynt(bank.syntText)));

  // SMPL + DATA
  const smpl = new Uint8Array(4 + SMPL_RECORD * samples.length);
  const sv = new DataView(smpl.buffer);
  sv.setUint32(0, samples.length, true);
  const dataParts: (Uint8Array | Blob)[] = [];
  let dataOffset = 0;
  samples.forEach((s, i) => {
    const b = 4 + i * SMPL_RECORD;
    writeName(smpl, b, s.name);
    sv.setBigUint64(b + 32, BigInt(dataOffset), true);
    sv.setUint32(b + 40, s.frames, true);
    sv.setUint32(b + 44, s.sampleRate, true);
    sv.setUint16(b + 48, s.channels, true);
    sv.setUint16(b + 50, FORMAT_CODE[s.format], true);
    sv.setUint32(b + 52, s.loopStart, true);
    sv.setUint32(b + 56, s.loopEnd, true);
    sv.setUint8(b + 60, s.rootKey);
    sv.setInt8(b + 61, s.fineTune);
    sv.setUint8(b + 62, s.loopMode);
    dataParts.push(s.blob);
    const padded = padTo(s.blob.size, DATA_ALIGNMENT);
    if (padded > s.blob.size) dataParts.push(new Uint8Array(padded - s.blob.size));
    dataOffset += padded;
  });

  // INST
  const sampleIndex = new Map(samples.map((s, i) => [s.id, i]));
  const zoneCount = bank.instruments.reduce((n, i) => n + i.zones.length, 0);
  const inst = new Uint8Array(8 + INST_RECORD * bank.instruments.length + ZONE_RECORD * zoneCount);
  const iv = new DataView(inst.buffer);
  iv.setUint32(0, bank.instruments.length, true);
  iv.setUint32(4, zoneCount, true);
  const zoneBase = 8 + INST_RECORD * bank.instruments.length;
  let firstZone = 0;
  bank.instruments.forEach((ins, i) => {
    const b = 8 + i * INST_RECORD;
    writeName(inst, b, ins.name);
    iv.setUint32(b + 32, firstZone, true);
    iv.setUint32(b + 36, ins.zones.length, true);
    ins.zones.forEach((z, j) => {
      const zb = zoneBase + (firstZone + j) * ZONE_RECORD;
      iv.setUint8(zb, z.keyLo);
      iv.setUint8(zb + 1, z.keyHi);
      iv.setUint8(zb + 2, z.velLo);
      iv.setUint8(zb + 3, z.velHi);
      iv.setUint32(zb + 4, z.sampleId !== null && sampleIndex.has(z.sampleId) ? sampleIndex.get(z.sampleId)! : NO_SAMPLE, true);
      iv.setInt16(zb + 8, Math.max(-100, Math.min(100, Math.round(z.pan))), true);
      iv.setUint16(zb + 10, Math.max(0, Math.min(65535, Math.round(z.attenuation * 10))), true);
      iv.setUint32(zb + 12, z.attack, true);
      iv.setUint32(zb + 16, z.decay, true);
      iv.setUint32(zb + 20, z.sustain, true);
      iv.setUint32(zb + 24, z.release, true);
    });
    firstZone += ins.zones.length;
  });

  return [
    { id: 'META', size: meta.length, parts: [meta] },
    { id: 'SMPL', size: smpl.length, parts: [smpl] },
    { id: 'INST', size: inst.length, parts: [inst] },
    { id: 'DATA', size: dataOffset, parts: dataParts },
    { id: 'SYNT', size: synt.length, parts: [synt] },
  ];
}

function layout(chunks: Chunk[]) {
  let offset = HEADER_SIZE;
  const starts = chunks.map((c) => {
    const start = offset;
    offset += padTo(c.size, ALIGNMENT);
    return start;
  });
  return { starts, tableOffset: offset, total: offset + chunks.length * ENTRY_SIZE };
}

export function estimateSize(bank: BankModel): number {
  try {
    return layout(buildChunks(bank)).total;
  } catch {
    return 0;
  }
}

/* ───────────────────────────── sinks ───────────────────────────── */

export interface WbnkSink {
  /** Append bytes sequentially. The first append is always the 64-byte header placeholder. */
  append(data: Uint8Array): Promise<void>;
  /** Replace the header placeholder and finalise the output. */
  finish(header: Uint8Array): Promise<void>;
  abort?(): Promise<void>;
}

/** Writes straight to disk through the File System Access API (Chromium browsers). */
export async function createFileSink(handle: any): Promise<WbnkSink> {
  const writable = await handle.createWritable();
  return {
    append: (data) => writable.write(data),
    finish: async (header) => {
      await writable.write({ type: 'write', position: 0, data: header });
      await writable.close();
    },
    abort: () => writable.abort(),
  };
}

/** Fallback for Firefox and Safari: collects parts in a Blob and triggers a download. */
export function createDownloadSink(fileName: string): WbnkSink {
  const parts: BlobPart[] = [];
  return {
    append: async (data) => {
      parts.push(data as BlobPart);
    },
    finish: async (header) => {
      parts[0] = header as BlobPart;
      const url = URL.createObjectURL(new Blob(parts, { type: 'application/octet-stream' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    },
  };
}

/* ───────────────────────────── writer ───────────────────────────── */

export interface Progress {
  message: string;
  written: number;
  total: number;
}

function antiTamper(dataCrc: number): Uint8Array {
  // Deterministic pseudo-random signature derived from the DATA CRC32 (mulberry32).
  const out = new Uint8Array(16);
  const v = new DataView(out.buffer);
  let s = (dataCrc ^ 0xdeadbeef) >>> 0;
  for (let i = 0; i < 4; i++) {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    v.setUint32(i * 4, (t ^ (t >>> 14)) >>> 0, true);
  }
  return out;
}

export async function compileWbnk(
  bank: BankModel,
  sink: WbnkSink,
  onProgress?: (p: Progress) => void,
  signal?: AbortSignal
): Promise<number> {
  const chunks = buildChunks(bank);
  const { starts, tableOffset, total } = layout(chunks);
  let written = 0;
  const report = (message: string) => onProgress?.({ message, written, total });
  const append = async (data: Uint8Array) => {
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    await sink.append(data);
    written += data.length;
  };

  try {
    await append(new Uint8Array(HEADER_SIZE));

    const crcs: number[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      report(`Writing ${chunk.id}`);
      let crc = 0;
      for (const part of chunk.parts) {
        for await (const piece of pieces(part)) {
          crc = crc32.buf(piece, crc);
          await append(piece);
          report(`Writing ${chunk.id}`);
        }
      }
      const pad = padTo(chunk.size, ALIGNMENT) - chunk.size;
      if (pad) await append(new Uint8Array(pad));
      crcs.push(crc >>> 0);
    }

    report('Writing chunk table');
    const table = new Uint8Array(chunks.length * ENTRY_SIZE);
    const tv = new DataView(table.buffer);
    chunks.forEach((c, i) => {
      const b = i * ENTRY_SIZE;
      for (let j = 0; j < 4; j++) table[b + j] = c.id.charCodeAt(j);
      tv.setBigUint64(b + 8, BigInt(starts[i]), true);
      tv.setBigUint64(b + 16, BigInt(c.size), true);
      tv.setUint32(b + 24, crcs[i], true);
    });
    await append(table);

    report('Sealing header');
    const header = new Uint8Array(HEADER_SIZE);
    const hv = new DataView(header.buffer);
    header.set([0x57, 0x42, 0x4e, 0x4b], 0); // "WBNK"
    hv.setUint16(4, 1, true);
    hv.setUint16(6, 0, true);
    hv.setUint32(8, 0, true);
    hv.setUint32(12, chunks.length, true);
    hv.setBigUint64(16, BigInt(tableOffset), true);
    hv.setBigUint64(24, BigInt(total), true);
    header.set(antiTamper(crcs[chunks.findIndex((c) => c.id === 'DATA')]), 32);
    hv.setUint32(60, crc32.buf(header.subarray(0, 48)) >>> 0, true);

    await sink.finish(header);
    report('Done');
    return total;
  } catch (e) {
    await sink.abort?.().catch(() => undefined);
    throw e;
  }
}

/* ───────────────────────────── reader ───────────────────────────── */

async function crcOfBlob(blob: Blob): Promise<number> {
  let crc = 0;
  for await (const p of pieces(blob)) crc = crc32.buf(p, crc);
  return crc >>> 0;
}

/** Opens a .wbnk, runs the three mandatory checks from the spec, and returns an editable bank. */
export async function parseWbnk(file: File, onCheck?: (msg: string) => void): Promise<BankModel> {
  const ok = (m: string) => onCheck?.(m);
  if (file.size < HEADER_SIZE) throw new Error('the file is smaller than the 64-byte header');

  const hb = new Uint8Array(await file.slice(0, HEADER_SIZE).arrayBuffer());
  const hv = new DataView(hb.buffer);
  if (ascii(hb, 0, 4) !== 'WBNK') throw new Error('this is not a .wbnk file (wrong magic)');
  const major = hv.getUint16(4, true);
  const minor = hv.getUint16(6, true);
  if (major !== 1) throw new Error(`unsupported version ${major}.${minor}`);

  const declared = Number(hv.getBigUint64(24, true));
  if (declared !== file.size) throw new Error(`size mismatch: header says ${declared} bytes, the file has ${file.size}`);
  ok(`File size matches header (${formatBytes(file.size)})`);

  if ((crc32.buf(hb.subarray(0, 48)) >>> 0) !== hv.getUint32(60, true)) throw new Error('header checksum mismatch');
  ok(`Header checksum valid (version ${major}.${minor})`);

  const count = hv.getUint32(12, true);
  const tableOffset = Number(hv.getBigUint64(16, true));
  if (count > 256 || tableOffset < HEADER_SIZE || tableOffset + count * ENTRY_SIZE > file.size)
    throw new Error('the chunk table points outside the file');

  const tb = new Uint8Array(await file.slice(tableOffset, tableOffset + count * ENTRY_SIZE).arrayBuffer());
  const tv = new DataView(tb.buffer);
  const chunks = new Map<string, { offset: number; size: number }>();
  for (let i = 0; i < count; i++) {
    const b = i * ENTRY_SIZE;
    const id = ascii(tb, b, 4);
    const offset = Number(tv.getBigUint64(b + 8, true));
    const size = Number(tv.getBigUint64(b + 16, true));
    if (offset < HEADER_SIZE || offset + size > tableOffset) throw new Error(`chunk ${id} points outside the file`);
    if ((await crcOfBlob(file.slice(offset, offset + size))) !== tv.getUint32(b + 24, true))
      throw new Error(`chunk ${id} is damaged (CRC32 mismatch). The download may be incomplete`);
    chunks.set(id, { offset, size });
    ok(`${id} chunk valid (${formatBytes(size)})`);
  }

  const read = async (id: string) => {
    const c = chunks.get(id);
    if (!c) throw new Error(`the ${id} chunk is missing`);
    return new Uint8Array(await file.slice(c.offset, c.offset + c.size).arrayBuffer());
  };

  const dataChunk = chunks.get('DATA');
  if (!dataChunk) throw new Error('the DATA chunk is missing');

  // SMPL
  const smpl = await read('SMPL');
  const sv = new DataView(smpl.buffer);
  const ns = sv.getUint32(0, true);
  if (4 + ns * SMPL_RECORD > smpl.length) throw new Error('the SMPL chunk is truncated');
  const samples: BankSample[] = [];
  for (let i = 0; i < ns; i++) {
    const b = 4 + i * SMPL_RECORD;
    const format = FORMAT_BY_CODE[sv.getUint16(b + 50, true)];
    if (!format) throw new Error(`sample ${i + 1} uses an unknown format`);
    const frames = sv.getUint32(b + 40, true);
    const channels = sv.getUint16(b + 48, true);
    const rel = Number(sv.getBigUint64(b + 32, true));
    const bytes = frames * channels * BYTES_PER_SAMPLE[format];
    if (rel + bytes > dataChunk.size) throw new Error(`sample ${i + 1} points outside the DATA chunk`);
    samples.push({
      id: uid(),
      name: readName(smpl, b),
      blob: file.slice(dataChunk.offset + rel, dataChunk.offset + rel + bytes),
      frames,
      sampleRate: sv.getUint32(b + 44, true),
      channels,
      format,
      loopStart: sv.getUint32(b + 52, true),
      loopEnd: sv.getUint32(b + 56, true),
      loopMode: (sv.getUint8(b + 62) & 1) as 0 | 1,
      rootKey: sv.getUint8(b + 60),
      fineTune: sv.getInt8(b + 61),
    });
  }

  // INST
  const inst = await read('INST');
  const iv = new DataView(inst.buffer);
  const ni = iv.getUint32(0, true);
  const nz = iv.getUint32(4, true);
  if (8 + ni * INST_RECORD + nz * ZONE_RECORD > inst.length) throw new Error('the INST chunk is truncated');
  const zoneBase = 8 + ni * INST_RECORD;
  const instruments: BankInstrument[] = [];
  for (let i = 0; i < ni; i++) {
    const b = 8 + i * INST_RECORD;
    const first = iv.getUint32(b + 32, true);
    const n = iv.getUint32(b + 36, true);
    if (first + n > nz) throw new Error(`instrument ${i + 1} references zones that do not exist`);
    const zones: BankZone[] = [];
    for (let j = 0; j < n; j++) {
      const zb = zoneBase + (first + j) * ZONE_RECORD;
      const idx = iv.getUint32(zb + 4, true);
      zones.push({
        id: uid(),
        keyLo: iv.getUint8(zb),
        keyHi: iv.getUint8(zb + 1),
        velLo: iv.getUint8(zb + 2),
        velHi: iv.getUint8(zb + 3),
        sampleId: idx < samples.length ? samples[idx].id : null,
        pan: iv.getInt16(zb + 8, true),
        attenuation: iv.getUint16(zb + 10, true) / 10,
        attack: iv.getUint32(zb + 12, true),
        decay: iv.getUint32(zb + 16, true),
        sustain: iv.getUint32(zb + 20, true),
        release: iv.getUint32(zb + 24, true),
      });
    }
    instruments.push({ id: uid(), name: readName(inst, b), zones });
  }

  const json = async (id: string): Promise<any> => {
    if (!chunks.has(id)) return {};
    try {
      return JSON.parse(new TextDecoder().decode(await read(id)));
    } catch {
      ok(`${id} chunk is not valid JSON and was skipped`);
      return {};
    }
  };
  const meta = await json('META');
  const synt = await json('SYNT');

  return {
    meta: typeof meta === 'object' && meta !== null ? meta : {},
    syntText: JSON.stringify(synt, null, 2),
    instruments,
    samples,
  };
}

/* ───────────────────────────── WAV import ───────────────────────────── */

const tag = (v: DataView, o: number) =>
  String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));

export async function readWav(file: File): Promise<BankSample> {
  const head = new DataView(await file.slice(0, 12).arrayBuffer());
  if (head.byteLength < 12 || tag(head, 0) !== 'RIFF' || tag(head, 8) !== 'WAVE')
    throw new Error(`${file.name} is not a WAV file`);

  let pos = 12;
  let fmt: { code: number; channels: number; rate: number; bits: number } | null = null;
  let data: { offset: number; size: number } | null = null;
  let smpl: { unity: number; start: number; end: number; loops: number } | null = null;

  while (pos + 8 <= file.size) {
    const h = new DataView(await file.slice(pos, pos + 8).arrayBuffer());
    const id = tag(h, 0);
    const size = h.getUint32(4, true);
    const body = pos + 8;
    if (id === 'fmt ' && size >= 16) {
      const f = new DataView(await file.slice(body, body + Math.min(size, 40)).arrayBuffer());
      let code = f.getUint16(0, true);
      if (code === 0xfffe && f.byteLength >= 26) code = f.getUint16(24, true);
      fmt = { code, channels: f.getUint16(2, true), rate: f.getUint32(4, true), bits: f.getUint16(14, true) };
    } else if (id === 'data') {
      data = { offset: body, size: Math.min(size, file.size - body) };
    } else if (id === 'smpl' && size >= 36) {
      const f = new DataView(await file.slice(body, body + Math.min(size, 60)).arrayBuffer());
      const loops = f.getUint32(28, true);
      smpl = {
        unity: f.getUint32(12, true),
        loops,
        start: loops > 0 && f.byteLength >= 52 ? f.getUint32(44, true) : 0,
        end: loops > 0 && f.byteLength >= 52 ? f.getUint32(48, true) : 0,
      };
    }
    pos = body + size + (size & 1);
  }
  if (!fmt || !data) throw new Error(`${file.name} has no readable audio data`);

  let format: SampleFormat;
  if (fmt.code === 1 && fmt.bits === 16) format = 'Pcm16';
  else if (fmt.code === 1 && fmt.bits === 24) format = 'Pcm24';
  else if (fmt.code === 3 && fmt.bits === 32) format = 'F32';
  else throw new Error(`${file.name} uses an unsupported encoding. Use 16-bit, 24-bit or 32-bit float WAV`);
  if (fmt.channels < 1) throw new Error(`${file.name} has no channels`);

  const blockAlign = fmt.channels * BYTES_PER_SAMPLE[format];
  const frames = Math.floor(data.size / blockAlign);
  // The WAV "smpl" chunk is how most sample editors store root note and loop points.
  const wavRoot = smpl && smpl.unity >= 1 && smpl.unity <= 127 ? smpl.unity : null;
  const wavLoopEnd = smpl && smpl.loops > 0 ? Math.min(frames, smpl.end + 1) : 0;
  const hasLoop = !!smpl && smpl.loops > 0 && smpl.start < wavLoopEnd;
  return {
    id: uid(),
    name: file.name.replace(/\.wav$/i, ''),
    blob: file.slice(data.offset, data.offset + frames * blockAlign),
    frames,
    sampleRate: fmt.rate,
    channels: fmt.channels,
    format,
    rootKey: wavRoot ?? 60,
    wavRoot,
    fineTune: 0,
    loopStart: hasLoop ? smpl!.start : 0,
    loopEnd: hasLoop ? wavLoopEnd : frames,
    loopMode: hasLoop ? 1 : 0,
  };
}