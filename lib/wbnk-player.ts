import { BankInstrument, BankSample, BankZone } from './wbnk-compiler';
import { decodeRegion } from './wbnk-audio';

/**
 * Sample player for auditioning a bank in the browser (Web Audio).
 *
 * Preview rules: the zone's key and velocity ranges pick the samples, pitch follows the root key and
 * fine tune, loops play when the sample has one, attack and release come from the zone, attenuation
 * and pan are applied. Decay and sustain are not applied: the .wbnk spec stores sustain in
 * milliseconds, which has no single standard meaning for a preview.
 */

interface Voice {
  note: number;
  src: AudioBufferSourceNode;
  env: GainNode;
  zone: BankZone;
  released: boolean;
}

export interface PlayerEvents {
  onActive?: (notes: Set<number>) => void;
  onVoices?: (count: number) => void;
  onError?: (message: string) => void;
}

const MAX_VOICES = 64;
const CACHE_LIMIT_BYTES = 512 * 1024 * 1024;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export class WbnkPlayer {
  ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private expr: GainNode | null = null;
  private instrument: BankInstrument | undefined;
  private samples = new Map<string, BankSample>();
  private cache = new Map<Blob, Promise<AudioBuffer>>();
  private sizes = new Map<Blob, number>();
  private cachedBytes = 0;
  private voices: Voice[] = [];
  private down = new Set<number>();
  private sustained = new Set<number>();
  private tokens = new Map<number, number>();
  private pedal = false;
  private bend = 0; // semitones
  private volume = 100; // CC7
  private expression = 127; // CC11

  constructor(private events: PlayerEvents = {}) {}

  get running(): boolean {
    return this.ctx?.state === 'running';
  }

  async start(): Promise<void> {
    if (!this.ctx) {
      const AC: typeof AudioContext | undefined = window.AudioContext ?? (window as any).webkitAudioContext;
      if (!AC) throw new Error('Web Audio is not available in this browser');
      this.ctx = new AC({ latencyHint: 'interactive' });
      this.expr = this.ctx.createGain();
      this.master = this.ctx.createGain();
      this.expr.connect(this.master).connect(this.ctx.destination);
      this.applyLevels(true);
    }
    await this.ctx.resume();
  }

  setSource(instrument: BankInstrument | undefined, samples: BankSample[]) {
    this.instrument = instrument;
    this.samples = new Map(samples.map((s) => [s.id, s]));
  }

  /** Decodes every sample the current instrument uses, so the first notes do not stutter. */
  async preload(onProgress?: (done: number, total: number) => void): Promise<{ failed: string[] }> {
    const failed: string[] = [];
    if (!this.ctx || !this.instrument) return { failed };
    const ids = new Set(this.instrument.zones.map((z) => z.sampleId).filter((id): id is string => !!id));
    const wanted = [...ids].map((id) => this.samples.get(id)).filter((s): s is BankSample => !!s);
    let done = 0;
    onProgress?.(0, wanted.length);
    for (const s of wanted) {
      try {
        await this.buffer(s);
      } catch {
        failed.push(s.name);
      }
      onProgress?.(++done, wanted.length);
    }
    return { failed };
  }

  private buffer(sample: BankSample): Promise<AudioBuffer> {
    let p = this.cache.get(sample.blob);
    if (!p) {
      p = this.decode(sample);
      this.cache.set(sample.blob, p);
      p.catch(() => this.cache.delete(sample.blob));
    }
    return p;
  }

  private async decode(sample: BankSample): Promise<AudioBuffer> {
    const ctx = this.ctx!;
    const data = await decodeRegion(sample, 0, sample.frames);
    const buf = ctx.createBuffer(sample.channels, Math.max(1, sample.frames), sample.sampleRate);
    data.forEach((ch, i) => buf.getChannelData(i).set(ch));
    const bytes = sample.frames * sample.channels * 4;
    this.sizes.set(sample.blob, bytes);
    this.cachedBytes += bytes;
    for (const key of this.cache.keys()) {
      if (this.cachedBytes <= CACHE_LIMIT_BYTES || this.cache.size <= 1) break;
      if (key === sample.blob) continue;
      this.cache.delete(key);
      this.cachedBytes -= this.sizes.get(key) ?? 0;
      this.sizes.delete(key);
    }
    return buf;
  }

  async noteOn(note: number, velocity: number): Promise<void> {
    if (!this.ctx || !this.running || !this.instrument) return;
    if (velocity <= 0) return this.noteOff(note);
    const token = (this.tokens.get(note) ?? 0) + 1;
    this.tokens.set(note, token);
    this.down.add(note);
    this.sustained.delete(note);
    this.events.onActive?.(new Set(this.down));

    const zones = this.instrument.zones.filter(
      (z) => z.sampleId && note >= z.keyLo && note <= z.keyHi && velocity >= z.velLo && velocity <= z.velHi
    );
    await Promise.all(
      zones.map(async (zone) => {
        const sample = this.samples.get(zone.sampleId!);
        if (!sample) return;
        let buffer: AudioBuffer;
        try {
          buffer = await this.buffer(sample);
        } catch (e: any) {
          this.events.onError?.(`Could not decode “${sample.name}”: ${e?.message ?? e}`);
          return;
        }
        if (this.tokens.get(note) !== token) return; // played again meanwhile
        if (!this.down.has(note) && !this.sustained.has(note)) return; // released while loading
        this.startVoice(note, velocity, zone, sample, buffer);
      })
    );
  }

  private startVoice(note: number, velocity: number, zone: BankZone, sample: BankSample, buffer: AudioBuffer) {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = clamp(2 ** ((note - sample.rootKey) / 12 + sample.fineTune / 1200), 0.03, 32);
    src.detune.value = this.bend * 100;
    if (sample.loopMode && sample.loopEnd > sample.loopStart) {
      src.loop = true;
      src.loopStart = sample.loopStart / sample.sampleRate;
      src.loopEnd = Math.min(sample.loopEnd, sample.frames) / sample.sampleRate;
    }

    const env = ctx.createGain();
    const peak = Math.pow(velocity / 127, 1.5) * Math.pow(10, -zone.attenuation / 20);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(peak, t + Math.max(zone.attack, 2) / 1000);
    src.connect(env);

    let out: AudioNode = env;
    if (zone.pan !== 0 && typeof (ctx as any).createStereoPanner === 'function') {
      const panner = ctx.createStereoPanner();
      panner.pan.value = clamp(zone.pan / 100, -1, 1);
      env.connect(panner);
      out = panner;
    }
    out.connect(this.expr!);

    const voice: Voice = { note, src, env, zone, released: false };
    src.onended = () => {
      try {
        out.disconnect();
        env.disconnect();
      } catch {
        /* already disconnected */
      }
      this.voices = this.voices.filter((v) => v !== voice);
      this.events.onVoices?.(this.voices.length);
    };
    src.start(t);
    this.voices.push(voice);

    const live = this.voices.filter((v) => !v.released);
    if (live.length > MAX_VOICES) this.releaseVoice(live[0], 0.03);
    this.events.onVoices?.(this.voices.length);
  }

  noteOff(note: number): void {
    this.down.delete(note);
    this.events.onActive?.(new Set(this.down));
    if (this.pedal) this.sustained.add(note);
    else this.releaseNote(note);
  }

  private releaseNote(note: number) {
    for (const v of this.voices) if (v.note === note && !v.released) this.releaseVoice(v);
  }

  private releaseVoice(v: Voice, overrideSeconds?: number) {
    if (!this.ctx || v.released) return;
    v.released = true;
    const now = this.ctx.currentTime;
    const seconds = overrideSeconds ?? Math.max(v.zone.release, 10) / 1000;
    const g = v.env.gain as any;
    if (typeof g.cancelAndHoldAtTime === 'function') g.cancelAndHoldAtTime(now);
    else {
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
    }
    g.linearRampToValueAtTime(0, now + seconds);
    try {
      v.src.stop(now + seconds + 0.02);
    } catch {
      /* already stopped */
    }
  }

  setPedal(on: boolean) {
    this.pedal = on;
    if (!on) {
      for (const n of this.sustained) if (!this.down.has(n)) this.releaseNote(n);
      this.sustained.clear();
    }
  }

  setBend(semitones: number) {
    this.bend = semitones;
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const v of this.voices) v.src.detune.setTargetAtTime(semitones * 100, now, 0.01);
  }

  setExpression(cc: number) {
    this.expression = clamp(cc, 0, 127);
    this.applyLevels();
  }

  setVolume(cc: number) {
    this.volume = clamp(cc, 0, 127);
    this.applyLevels();
  }

  private applyLevels(immediate = false) {
    if (!this.ctx || !this.expr || !this.master) return;
    const now = this.ctx.currentTime;
    const e = this.expression / 127;
    const m = 0.8 * (this.volume / 127);
    if (immediate) {
      this.expr.gain.value = e;
      this.master.gain.value = m;
    } else {
      this.expr.gain.setTargetAtTime(e, now, 0.02);
      this.master.gain.setTargetAtTime(m, now, 0.02);
    }
  }

  resetControllers() {
    this.setPedal(false);
    this.setBend(0);
    this.setExpression(127);
  }

  allNotesOff() {
    this.down.clear();
    this.sustained.clear();
    this.events.onActive?.(new Set());
    for (const v of this.voices) this.releaseVoice(v, 0.03);
  }

  dispose() {
    this.allNotesOff();
    this.ctx?.close().catch(() => undefined);
    this.ctx = null;
  }
}