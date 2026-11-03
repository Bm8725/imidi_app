import { BYTES_PER_SAMPLE, BankSample, SampleFormat } from './wbnk-compiler';

type Pcm = Pick<BankSample, 'blob' | 'frames' | 'channels' | 'format'>;

const READ_BYTES = 4 * 1024 * 1024;

function reader(format: SampleFormat): (dv: DataView, offset: number) => number {
  if (format === 'Pcm16') return (dv, o) => dv.getInt16(o, true) / 32768;
  if (format === 'F32') return (dv, o) => dv.getFloat32(o, true);
  return (dv, o) => {
    let v = dv.getUint8(o) | (dv.getUint8(o + 1) << 8) | (dv.getUint8(o + 2) << 16);
    if (v & 0x800000) v -= 0x1000000;
    return v / 8388608;
  };
}

/** Min/max envelope for drawing the waveform. Reads the sample in 4 MB slices. */
export async function readPeaks(
  s: Pcm,
  buckets: number,
  token: { cancelled: boolean }
): Promise<{ min: Float32Array; max: Float32Array } | null> {
  const bps = BYTES_PER_SAMPLE[s.format];
  const ba = s.channels * bps;
  const read = reader(s.format);
  const min = new Float32Array(buckets).fill(1);
  const max = new Float32Array(buckets).fill(-1);
  const per = Math.max(1, Math.floor(READ_BYTES / ba));

  for (let start = 0; start < s.frames; start += per) {
    if (token.cancelled) return null;
    const n = Math.min(per, s.frames - start);
    const dv = new DataView(await s.blob.slice(start * ba, (start + n) * ba).arrayBuffer());
    for (let f = 0; f < n; f++) {
      const b = Math.min(buckets - 1, Math.floor(((start + f) * buckets) / s.frames));
      for (let c = 0; c < s.channels; c++) {
        const v = read(dv, f * ba + c * bps);
        if (v < min[b]) min[b] = v;
        if (v > max[b]) max[b] = v;
      }
    }
  }
  for (let i = 0; i < buckets; i++) {
    if (min[i] > max[i]) {
      min[i] = 0;
      max[i] = 0;
    }
  }
  return { min, max };
}

/** Decodes a frame range into one Float32Array per channel (for preview playback). */
export async function decodeRegion(s: Pcm, startFrame: number, endFrame: number): Promise<Float32Array[]> {
  const bps = BYTES_PER_SAMPLE[s.format];
  const ba = s.channels * bps;
  const read = reader(s.format);
  const len = Math.max(0, endFrame - startFrame);
  const out = Array.from({ length: s.channels }, () => new Float32Array(len));
  const per = Math.max(1, Math.floor(READ_BYTES / ba));
  for (let o = 0; o < len; o += per) {
    const n = Math.min(per, len - o);
    const dv = new DataView(await s.blob.slice((startFrame + o) * ba, (startFrame + o + n) * ba).arrayBuffer());
    for (let f = 0; f < n; f++) for (let c = 0; c < s.channels; c++) out[c][o + f] = read(dv, f * ba + c * bps);
  }
  return out;
}

/** Nearest rising zero crossing, so a loop point does not click. */
export async function snapToZeroCrossing(s: Pcm, frame: number, radius = 2048): Promise<number> {
  const lo = Math.max(0, frame - radius);
  const hi = Math.min(s.frames, frame + radius + 1);
  if (hi - lo < 2) return frame;
  const ch = (await decodeRegion(s, lo, hi))[0];
  let best = frame;
  let bestDist = Infinity;
  for (let i = 1; i < ch.length; i++) {
    if (ch[i - 1] <= 0 && ch[i] > 0) {
      const dist = Math.abs(lo + i - frame);
      if (dist < bestDist) {
        bestDist = dist;
        best = lo + i;
      }
    }
  }
  return best;
}