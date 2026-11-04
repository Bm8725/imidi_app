'use client';

import React, { useEffect, useRef, useState } from 'react';
import { formatBytes } from '@/lib/wbnk-compiler';
import { useModal } from './useModal';
import { focusRing } from './ZoneTable';

export interface BuildState {
  phase: 'writing' | 'done' | 'error' | 'cancelled';
  fileName: string;
  direct: boolean;
  written: number;
  total: number;
  message: string;
  startedAt: number;
  endedAt?: number;
  error?: string;
  summary?: string;
}

const STAGES = [
  { label: 'Bank properties', detail: 'META chunk' },
  { label: 'Sample directory', detail: 'SMPL chunk' },
  { label: 'Instruments and zones', detail: 'INST chunk' },
  { label: 'Audio data', detail: 'DATA chunk, streamed from your samples' },
  { label: 'Synth presets', detail: 'SYNT chunk' },
  { label: 'Chunk table', detail: 'Offsets and checksums' },
  { label: 'Header seal', detail: 'Header checksum and signature' },
];

function stageIndex(message: string): number {
  if (message === 'Done') return STAGES.length;
  if (message === 'Sealing header') return 6;
  if (message === 'Writing chunk table') return 5;
  const m = /^Writing (META|SMPL|INST|DATA|SYNT)$/.exec(message);
  return m ? ['META', 'SMPL', 'INST', 'DATA', 'SYNT'].indexOf(m[1]) : -1;
}

function duration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (ms < 1000) return 'under 1 s';
  if (s < 60) return `${s} s`;
  return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`;
}

interface Props {
  state: BuildState;
  onCancel: () => void;
  onClose: () => void;
}

export default function BuildOverlay({ state, onCancel, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const writing = state.phase === 'writing';
  useModal(ref, writing ? undefined : onClose);

  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    if (!writing) return;
    const id = setInterval(() => setNow(performance.now()), 250);
    return () => clearInterval(id);
  }, [writing]);

  // the Cancel button disappears when writing ends, so move focus to Close
  useEffect(() => {
    if (!writing) closeRef.current?.focus();
  }, [writing]);

  const elapsed = (state.endedAt ?? now) - state.startedAt;
  const pct = state.phase === 'done' ? 100 : state.total > 0 ? Math.min(99.9, (state.written / state.total) * 100) : 0;
  const speed = elapsed > 300 ? state.written / (elapsed / 1000) : 0; // bytes per second
  const remaining = writing && speed > 0 && elapsed > 600 ? ((state.total - state.written) / speed) * 1000 : null;
  const current = stageIndex(state.message);

  const title =
    state.phase === 'writing' ? 'Writing bank' : state.phase === 'done' ? 'Bank saved' : state.phase === 'cancelled' ? 'Build cancelled' : 'Build failed';

  const stageStatus = (i: number) => {
    if (state.phase === 'done' || i < current) return 'Done';
    if (i === current) return state.phase === 'writing' ? 'In progress' : 'Stopped';
    return 'Waiting';
  };

  return (
    <div className="wbnk-fade fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="build-h"
        tabIndex={-1}
        className="wbnk-in max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-sm border border-[color:var(--line)] bg-[color:var(--surface)] shadow-2xl"
      >
        <div className="border-b border-[color:var(--line-soft)] px-6 py-4">
          <h2 id="build-h" className="text-lg font-bold tracking-tight">{title}</h2>
          <p className="mt-0.5 break-all text-sm text-[color:var(--muted)]">
            {state.fileName}, {state.direct ? 'saving straight to disk' : 'will download when finished'}
          </p>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <span className={`text-4xl font-bold tabular-nums ${state.phase === 'error' ? 'text-[color:var(--accent)]' : ''}`}>{Math.floor(pct)}%</span>
              <span className="text-sm text-[color:var(--muted)]" aria-live="polite">
                {state.phase === 'writing' ? STAGES[current]?.label ?? 'Starting' : state.phase === 'done' ? 'Finished' : state.phase === 'cancelled' ? 'Stopped' : 'Stopped with an error'}
              </span>
            </div>
            <div
              className="h-2.5 overflow-hidden rounded-full bg-[color:var(--line-soft)]"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.floor(pct)}
              aria-label="Build progress"
            >
              <div
                className={`h-full ${state.phase === 'error' || state.phase === 'cancelled' ? 'bg-[color:var(--muted)]' : 'bg-[color:var(--accent-fill)]'} transition-[width] duration-200 motion-reduce:transition-none`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-xs font-semibold text-[color:var(--muted)]">Written</dt>
              <dd className="tabular-nums">{formatBytes(state.written)} of {formatBytes(state.total)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-[color:var(--muted)]">Speed</dt>
              <dd className="tabular-nums">{speed > 0 ? `${(speed / 1024 / 1024).toFixed(1)} MB/s` : 'Measuring…'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-[color:var(--muted)]">Elapsed</dt>
              <dd className="tabular-nums">{duration(elapsed)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-[color:var(--muted)]">Estimated time left</dt>
              <dd className="tabular-nums">{writing ? (remaining === null ? 'Estimating…' : duration(remaining)) : state.phase === 'done' ? 'None' : 'Not applicable'}</dd>
            </div>
          </dl>

          <ol className="divide-y divide-[color:var(--line-soft)] rounded-sm border border-[color:var(--line)] text-sm">
            {STAGES.map((st, i) => {
              const status = stageStatus(i);
              return (
                <li key={st.label} className="flex items-center justify-between gap-3 px-4 py-2">
                  <span>
                    <span className={status === 'Waiting' ? 'text-[color:var(--muted)]' : 'font-medium'}>{st.label}</span>
                    <span className="block text-xs text-[color:var(--muted)]">{st.detail}</span>
                  </span>
                  <span
                    className={`shrink-0 rounded-sm px-2 py-0.5 text-xs font-semibold ${
                      status === 'Done' ? 'bg-[color:rgb(var(--brass-rgb)/0.2)] text-[color:var(--brass-ink)]' : status === 'In progress' ? 'bg-[color:var(--accent-fill)] text-white' : status === 'Stopped' ? 'bg-[color:rgb(var(--accent-rgb)/0.1)] text-[color:var(--accent)]' : 'text-[color:var(--muted)]'
                    }`}
                  >
                    {status}
                  </span>
                </li>
              );
            })}
          </ol>

          {state.phase === 'done' && (
            <p className="text-sm">
              {state.summary}. {state.direct ? 'The file is saved at the location you chose.' : 'Your browser has started the download.'} All chunks are 64-byte aligned and every checksum is written.
            </p>
          )}
          {state.phase === 'error' && <p className="text-sm font-medium text-[color:var(--accent)]">{state.error}</p>}
          {state.phase === 'cancelled' && <p className="text-sm">Writing was stopped before the file was finished. Your bank in the editor is unchanged.</p>}
        </div>

        <div className="flex justify-end gap-3 border-t border-[color:var(--line-soft)] px-6 py-4">
          {writing ? (
            <button type="button" onClick={onCancel} className={`rounded-sm border border-[color:var(--field-line)] bg-[color:var(--surface)] px-4 py-2 text-sm font-medium hover:border-[color:var(--ink)] ${focusRing}`}>
              Cancel
            </button>
          ) : (
            <button ref={closeRef} type="button" data-autofocus onClick={onClose} className={`rounded-sm bg-[color:var(--accent-fill)] px-5 py-2 text-sm font-semibold text-white hover:bg-[color:var(--accent-hover)] ${focusRing}`}>
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}