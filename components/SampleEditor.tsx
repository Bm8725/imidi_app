'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BYTES_PER_SAMPLE, BankSample, formatBytes } from '@/lib/wbnk-compiler';
import { decodeRegion, readPeaks, snapToZeroCrossing } from '@/lib/wbnk-audio';
import { NumberCell, focusRing } from './ZoneTable';
import { useModal } from './useModal';

interface Props {
  sample: BankSample;
  onApply: (patch: Partial<BankSample>) => void;
  onClose: () => void;
}

interface Draft {
  trimStart: number;
  trimEnd: number;
  loopStart: number;
  loopEnd: number;
  loopMode: 0 | 1;
}

type Handle = 'trimStart' | 'trimEnd' | 'loopStart' | 'loopEnd';

const HEIGHT = 220;
const BUCKETS = 2400;
const MAX_PREVIEW_SECONDS = 180;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function normalise(d: Draft, frames: number): Draft {
  const trimStart = clamp(Math.round(d.trimStart), 0, frames - 1);
  const trimEnd = clamp(Math.round(d.trimEnd), trimStart + 1, frames);
  const loopStart = clamp(Math.round(d.loopStart), trimStart, Math.max(trimStart, trimEnd - 1));
  const loopEnd = clamp(Math.round(d.loopEnd), Math.min(loopStart + 1, trimEnd), trimEnd);
  return { trimStart, trimEnd, loopStart, loopEnd, loopMode: d.loopMode };
}

const btn = `rounded-sm border border-[color:var(--field-line)] bg-[color:var(--surface)] px-3 py-1.5 text-sm font-medium text-[color:var(--ink)] hover:border-[color:var(--ink)] disabled:cursor-not-allowed disabled:text-[color:var(--muted)] disabled:hover:border-[color:var(--field-line)] ${focusRing}`;

export default function SampleEditor({ sample, onApply, onClose }: Props) {
  const { frames, sampleRate, channels, format } = sample;
  const dialogRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  useModal(dialogRef, onClose);

  const [draft, setDraft] = useState<Draft>(() =>
    normalise(
      {
        trimStart: 0,
        trimEnd: frames,
        loopStart: sample.loopEnd > sample.loopStart && sample.loopEnd <= frames ? sample.loopStart : 0,
        loopEnd: sample.loopEnd > sample.loopStart && sample.loopEnd <= frames ? sample.loopEnd : frames,
        loopMode: sample.loopMode,
      },
      frames
    )
  );
  const [peaks, setPeaks] = useState<{ min: Float32Array; max: Float32Array } | null>(null);
  const [width, setWidth] = useState(720);
  const [playing, setPlaying] = useState(false);
  const [playPos, setPlayPos] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const dragRef = useRef<Handle | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const srcRef = useRef<AudioBufferSourceNode | null>(null);
  const rafRef = useRef<number>(0);

  const set = (patch: Partial<Draft>) => setDraft((d) => normalise({ ...d, ...patch }, frames));
  const seconds = (f: number) => f / sampleRate;
  const ms = (f: number) => `${((f / sampleRate) * 1000).toFixed(1)} ms`;

  /* waveform */
  useEffect(() => {
    const token = { cancelled: false };
    setPeaks(null);
    readPeaks(sample, BUCKETS, token).then((r) => {
      if (r && !token.cancelled) setPeaks(r);
    });
    return () => {
      token.cancelled = true;
    };
  }, [sample]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(Math.max(320, Math.floor(el.clientWidth))));
    ro.observe(el);
    setWidth(Math.max(320, Math.floor(el.clientWidth)));
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(HEIGHT * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const css = getComputedStyle(canvas);
    const v = (name: string) => css.getPropertyValue(name).trim() || '#888';
    const x = (f: number) => (f / frames) * width;

    ctx.fillStyle = v('--surface');
    ctx.fillRect(0, 0, width, HEIGHT);

    if (draft.loopMode) {
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = v('--brass');
      ctx.fillRect(x(draft.loopStart), 0, x(draft.loopEnd) - x(draft.loopStart), HEIGHT);
      ctx.globalAlpha = 1;
    }

    ctx.strokeStyle = v('--line');
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, HEIGHT / 2 + 0.5);
    ctx.lineTo(width, HEIGHT / 2 + 0.5);
    ctx.stroke();

    if (peaks) {
      ctx.fillStyle = v('--ink');
      for (let px = 0; px < width; px++) {
        const b0 = Math.floor((px * BUCKETS) / width);
        const b1 = Math.max(b0 + 1, Math.floor(((px + 1) * BUCKETS) / width));
        let mn = 1;
        let mx = -1;
        for (let b = b0; b < b1 && b < BUCKETS; b++) {
          if (peaks.min[b] < mn) mn = peaks.min[b];
          if (peaks.max[b] > mx) mx = peaks.max[b];
        }
        if (mn > mx) continue;
        const y1 = HEIGHT / 2 - mx * (HEIGHT / 2) * 0.92;
        const y2 = HEIGHT / 2 - mn * (HEIGHT / 2) * 0.92;
        ctx.fillRect(px, y1, 1, Math.max(1, y2 - y1));
      }
    }

    // dim what will be cut away
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = v('--bg');
    ctx.fillRect(0, 0, x(draft.trimStart), HEIGHT);
    ctx.fillRect(x(draft.trimEnd), 0, width - x(draft.trimEnd), HEIGHT);
    ctx.globalAlpha = 1;

    const marker = (frame: number, color: string, label: string, top: boolean, alignRight: boolean) => {
      const px = Math.round(x(frame));
      ctx.fillStyle = color;
      ctx.fillRect(px - 1, 0, 2, HEIGHT);
      ctx.font = '600 11px system-ui, sans-serif';
      const w = ctx.measureText(label).width + 8;
      const left = alignRight ? px - w : px;
      const y = top ? 0 : HEIGHT - 18;
      ctx.fillRect(left, y, w, 18);
      ctx.fillStyle = v('--surface');
      ctx.fillText(label, left + 4, y + 13);
    };
    marker(draft.trimStart, v('--ink'), 'Start', true, false);
    marker(draft.trimEnd, v('--ink'), 'End', true, true);
    if (draft.loopMode) {
      marker(draft.loopStart, v('--accent'), 'Loop in', false, false);
      marker(draft.loopEnd, v('--accent'), 'Loop out', false, true);
    }

    if (playPos !== null) {
      ctx.fillStyle = v('--accent');
      ctx.fillRect(Math.round(x(playPos)), 0, 1, HEIGHT);
    }
  }, [peaks, draft, width, playPos, frames]);

  /* dragging markers */
  const handles = (): Handle[] => (draft.loopMode ? ['loopStart', 'loopEnd', 'trimStart', 'trimEnd'] : ['trimStart', 'trimEnd']);

  const nearest = (clientX: number): Handle | null => {
    const r = canvasRef.current!.getBoundingClientRect();
    const px = clientX - r.left;
    let best: Handle | null = null;
    let bestDist = Infinity;
    for (const h of handles()) {
      const dist = Math.abs((draft[h] / frames) * r.width - px);
      if (dist < bestDist) {
        bestDist = dist;
        best = h;
      }
    }
    return bestDist <= 12 ? best : null;
  };

  const frameAt = (clientX: number) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return Math.round(clamp((clientX - r.left) / r.width, 0, 1) * frames);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const h = nearest(e.clientX);
    if (!h) return;
    dragRef.current = h;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current) {
      set({ [dragRef.current]: frameAt(e.clientX) } as Partial<Draft>);
    } else {
      e.currentTarget.style.cursor = nearest(e.clientX) ? 'ew-resize' : 'default';
    }
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  /* preview */
  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    try {
      srcRef.current?.stop();
    } catch {
      /* already stopped */
    }
    srcRef.current = null;
    setPlaying(false);
    setPlayPos(null);
  }, []);

  useEffect(() => {
    stop();
  }, [draft.trimStart, draft.trimEnd, draft.loopStart, draft.loopEnd, draft.loopMode, stop]);

  useEffect(
    () => () => {
      stop();
      ctxRef.current?.close().catch(() => undefined);
    },
    [stop]
  );

  const play = async () => {
    stop();
    setNote('');
    const len = draft.trimEnd - draft.trimStart;
    if (seconds(len) > MAX_PREVIEW_SECONDS) {
      setNote(`Preview is limited to ${MAX_PREVIEW_SECONDS / 60} minutes. Shorten the selection to listen to it.`);
      return;
    }
    try {
      const data = await decodeRegion(sample, draft.trimStart, draft.trimEnd);
      const AC = window.AudioContext ?? (window as any).webkitAudioContext;
      const ctx = (ctxRef.current ??= new AC());
      await ctx.resume();
      const buffer = ctx.createBuffer(channels, len, sampleRate);
      data.forEach((ch, i) => buffer.getChannelData(i).set(ch));
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = 0.8;
      if (draft.loopMode) {
        src.loop = true;
        src.loopStart = seconds(draft.loopStart - draft.trimStart);
        src.loopEnd = seconds(draft.loopEnd - draft.trimStart);
      }
      src.connect(gain).connect(ctx.destination);
      src.onended = () => {
        if (srcRef.current === src) stop();
      };
      src.start();
      srcRef.current = src;
      setPlaying(true);

      const t0 = ctx.currentTime;
      const tick = () => {
        let t = (ctx.currentTime - t0) * sampleRate;
        if (draft.loopMode) {
          const ls = draft.loopStart - draft.trimStart;
          const le = draft.loopEnd - draft.trimStart;
          if (t >= le) t = ls + ((t - ls) % (le - ls));
        }
        setPlayPos(draft.trimStart + Math.min(t, len));
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (e: any) {
      setNote(`This browser cannot play the sample: ${e?.message ?? e}`);
      stop();
    }
  };

  /* actions */
  const toggleLoop = (on: boolean) => {
    if (on) {
      const len = draft.trimEnd - draft.trimStart;
      const full = draft.loopStart <= draft.trimStart && draft.loopEnd >= draft.trimEnd;
      set(
        full
          ? { loopMode: 1, loopStart: draft.trimStart + Math.floor(len * 0.25), loopEnd: draft.trimStart + Math.floor(len * 0.75) }
          : { loopMode: 1 }
      );
    } else {
      set({ loopMode: 0 });
    }
  };

  const snap = async () => {
    setNote('');
    const [a, b] = await Promise.all([snapToZeroCrossing(sample, draft.loopStart), snapToZeroCrossing(sample, draft.loopEnd)]);
    set({ loopStart: a, loopEnd: b });
  };

  const apply = () => {
    const trimmed = draft.trimStart > 0 || draft.trimEnd < frames;
    const patch: Partial<BankSample> = {
      loopMode: draft.loopMode,
      loopStart: draft.loopStart - draft.trimStart,
      loopEnd: draft.loopEnd - draft.trimStart,
    };
    if (trimmed) {
      const ba = channels * BYTES_PER_SAMPLE[format];
      patch.blob = sample.blob.slice(draft.trimStart * ba, draft.trimEnd * ba);
      patch.frames = draft.trimEnd - draft.trimStart;
      patch.origin = sample.origin
        ? { ...sample.origin, offset: sample.origin.offset + draft.trimStart }
        : { blob: sample.blob, frames, offset: draft.trimStart };
    }
    onApply(patch);
  };

  const restore = () => {
    if (!sample.origin) return;
    onApply({
      blob: sample.origin.blob,
      frames: sample.origin.frames,
      loopStart: sample.loopStart + sample.origin.offset,
      loopEnd: sample.loopEnd + sample.origin.offset,
      origin: undefined,
    });
  };

  const selected = draft.trimEnd - draft.trimStart;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-h"
        tabIndex={-1}
        className="max-h-[95vh] w-full max-w-4xl overflow-y-auto rounded-sm border border-[color:var(--line)] bg-[color:var(--surface)] shadow-2xl"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[color:var(--line-soft)] px-6 py-4">
          <div>
            <h2 id="edit-h" className="text-lg font-bold tracking-tight">Edit sample: {sample.name}</h2>
            <p className="text-sm text-[color:var(--muted)]">
              {channels === 1 ? 'Mono' : channels === 2 ? 'Stereo' : `${channels} channels`}, {(sampleRate / 1000).toFixed(1)} kHz, {format}, {seconds(frames).toFixed(3)} s, {formatBytes(sample.blob.size)}
            </p>
          </div>
          <button type="button" onClick={onClose} className={btn}>Close without saving</button>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div ref={wrapRef}>
            <canvas
              ref={canvasRef}
              role="img"
              aria-label={`Waveform of ${sample.name}. Drag the markers to trim the sample or move the loop. The fields below set exact values.`}
              style={{ width: '100%', height: HEIGHT, touchAction: 'none' }}
              className="block rounded-sm border border-[color:var(--field-line)]"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            />
            <p className="mt-1.5 text-xs text-[color:var(--muted)]" aria-live="polite">
              {peaks ? 'Drag the Start and End markers to cut. Turn on the loop to move the Loop in and Loop out markers.' : 'Reading the waveform…'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={playing ? stop : play} className={btn}>
              {playing ? 'Stop' : draft.loopMode ? 'Play with loop' : 'Play selection'}
            </button>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={draft.loopMode === 1} onChange={(e) => toggleLoop(e.target.checked)} className={focusRing} />
              Loop
            </label>
            <button type="button" onClick={snap} disabled={!draft.loopMode} className={btn}>Snap loop to zero crossings</button>
            <button type="button" onClick={() => set({ trimStart: 0, trimEnd: frames })} className={btn}>Select all</button>
            {sample.origin && (
              <button type="button" onClick={restore} className={btn}>Restore original recording</button>
            )}
          </div>
          {note && <p className="text-sm text-[color:var(--accent)]" role="alert">{note}</p>}

          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-semibold">Cut (frames)</legend>
              <div className="flex flex-wrap gap-4">
                <div>
                  <span className="text-xs font-semibold text-[color:var(--muted)]">Start</span>
                  <NumberCell label="Start frame" value={draft.trimStart} min={0} max={frames - 1} hint={ms(draft.trimStart)} className="mt-1 w-28" onCommit={(v) => set({ trimStart: v })} />
                </div>
                <div>
                  <span className="text-xs font-semibold text-[color:var(--muted)]">End</span>
                  <NumberCell label="End frame" value={draft.trimEnd} min={1} max={frames} hint={ms(draft.trimEnd)} className="mt-1 w-28" onCommit={(v) => set({ trimEnd: v })} />
                </div>
              </div>
              <p className="text-xs text-[color:var(--muted)]">
                Keeps {seconds(selected).toFixed(3)} s of {seconds(frames).toFixed(3)} s ({formatBytes(selected * channels * BYTES_PER_SAMPLE[format])}). The cut is applied to the bank only. Your WAV file on disk is not changed.
              </p>
            </fieldset>

            <fieldset className="space-y-2" disabled={!draft.loopMode}>
              <legend className="mb-1 text-sm font-semibold">Loop (frames)</legend>
              <div className="flex flex-wrap gap-4">
                <div>
                  <span className="text-xs font-semibold text-[color:var(--muted)]">Loop in</span>
                  <NumberCell label="Loop start frame" value={draft.loopStart} min={0} max={frames - 1} disabled={!draft.loopMode} hint={ms(draft.loopStart)} className="mt-1 w-28" onCommit={(v) => set({ loopStart: v })} />
                </div>
                <div>
                  <span className="text-xs font-semibold text-[color:var(--muted)]">Loop out</span>
                  <NumberCell label="Loop end frame" value={draft.loopEnd} min={1} max={frames} disabled={!draft.loopMode} hint={ms(draft.loopEnd)} className="mt-1 w-28" onCommit={(v) => set({ loopEnd: v })} />
                </div>
              </div>
              <p className="text-xs text-[color:var(--muted)]">
                {draft.loopMode ? `Loop length ${seconds(draft.loopEnd - draft.loopStart).toFixed(3)} s. Playback sustains inside the loop until the note is released.` : 'The loop is off. The sample plays once.'}
              </p>
            </fieldset>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-3 border-t border-[color:var(--line-soft)] px-6 py-4">
          <button type="button" onClick={onClose} className={btn}>Cancel</button>
          <button type="button" data-autofocus onClick={apply} className={`rounded-sm bg-[color:var(--accent-fill)] px-5 py-2 text-sm font-semibold text-white hover:bg-[color:var(--accent-hover)] ${focusRing}`}>
            Apply to bank
          </button>
        </div>
      </div>
    </div>
  );
}