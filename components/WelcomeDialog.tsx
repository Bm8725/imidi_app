'use client';

import React, { useRef, useState } from 'react';
import type { Capabilities } from '@/lib/wbnk-browser';
import { useModal } from './useModal';
import { focusRing } from './ZoneTable';

interface Props {
  caps: Capabilities | null;
  initialHidden: boolean;
  onClose: (hideNextTime: boolean) => void;
}

function Badge({ ok, yes, no }: { ok: boolean; yes: string; no: string }) {
  return (
    <span className={`rounded-sm px-2 py-0.5 text-xs font-semibold ${ok ? 'bg-[color:rgb(var(--brass-rgb)/0.2)] text-[color:var(--brass-ink)]' : 'bg-[color:rgb(var(--accent-rgb)/0.1)] text-[color:var(--accent)]'}`}>
      {ok ? yes : no}
    </span>
  );
}

export default function WelcomeDialog({ caps, initialHidden, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [hide, setHide] = useState(initialHidden);
  useModal(ref, () => onClose(hide));

  const steps = [
    ['Import samples', 'Drop WAV files into the Sample library. The root key is read from the name (Bassoon 044, Accordion_C4) or from the WAV file.'],
    ['Build instruments', 'Use a preset, or select samples and map them across the keyboard in one click. Trim and loop any sample in the editor.'],
    ['Play it', 'Open the Play tab, connect a MIDI keyboard and test notes, velocity and expression before you build. Or use the on-screen keyboard.'],
    ['Add copyright', 'Fill in the holder, licence and rights declaration in the Copyright tab.'],
    ['Build the .wbnk', 'The file is written in one pass with checksums, ready for the TS4X Core DSP engine.'],
  ];

  return (
    <div className="wbnk-fade fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-h"
        tabIndex={-1}
        className="wbnk-in max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-sm border border-[color:var(--line)] bg-[color:var(--surface)] shadow-2xl"
      >
        <div className="border-b border-[color:var(--line-soft)] px-6 py-5">
          <h2 id="welcome-h" className="text-xl font-bold tracking-tight">Welcome to .WBNK Bank Manager</h2>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            Create and edit .wbnk audio banks for the TS4X Core DSP engine. Everything runs in your browser. Your samples are never uploaded. Tne .WBNK is an binary format special for
            the ts4x ecosystem, the latest model and native for cloud transfer. 
          </p>
        </div>

        <div className="space-y-6 px-6 py-5">
          <section aria-labelledby="how-h">
            <h3 id="how-h" className="mb-2 text-sm font-semibold">How it works</h3>
            <ol className="space-y-2">
              {steps.map(([title, text], i) => (
                <li key={title} className="flex gap-3 text-sm">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[color:var(--ink)] text-xs font-semibold tabular-nums text-[color:var(--bg)]">{i + 1}</span>
                  <span>
                    <span className="font-semibold">{title}. </span>
                    <span className="text-[color:var(--ink-2)]">{text}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="br-h">
            <h3 id="br-h" className="mb-2 text-sm font-semibold">Your browser{caps ? `: ${caps.browser}` : ''}</h3>
            {caps ? (
              <ul className="divide-y divide-[color:var(--line-soft)] rounded-sm border border-[color:var(--line)] text-sm">
                <li className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span>Save straight to your disk</span>
                  <Badge ok={caps.directSave} yes="Available" no="Download instead" />
                </li>
                <li className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span>Listen to samples in the editor</span>
                  <Badge ok={caps.audio} yes="Available" no="Not available" />
                </li>
                <li className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span>Play with a MIDI controller</span>
                  <Badge ok={caps.midi} yes="Available" no="Not available" />
                </li>
                <li className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span>Secure connection (HTTPS)</span>
                  <Badge ok={caps.secure} yes="Yes" no="No" />
                </li>
              </ul>
            ) : (
              <p className="text-sm text-[color:var(--muted)]">Checking your browser…</p>
            )}
            {caps && !caps.directSave && (
              <p className="mt-2 text-sm text-[color:var(--ink-2)]">
                This browser cannot write to a chosen file, so the finished bank will download like any other file. Chrome, Edge or Opera on a computer give the smoothest result for very large banks.
              </p>
            )}
            {caps && caps.directSave && !caps.secure && (
              <p className="mt-2 text-sm text-[color:var(--accent)]">Direct saving needs HTTPS. Open the page over a secure connection.</p>
            )}
            {caps?.mobile && (
              <p className="mt-2 text-sm text-[color:var(--ink-2)]">On a phone or tablet you can edit a bank, but building large banks is slow. A computer is recommended.</p>
            )}
          </section>

          <section aria-labelledby="sup-h">
            <h3 id="sup-h" className="mb-2 text-sm font-semibold">Supported browsers</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[460px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[color:var(--line)] text-left text-xs font-semibold text-[color:var(--muted)]">
                    <th className="py-1.5 pr-3" scope="col">Browser</th>
                    <th className="py-1.5 pr-3" scope="col">Editing and preview</th>
                    <th className="py-1.5" scope="col">Saving</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-[color:var(--line-soft)]"><th className="py-1.5 pr-3 text-left font-medium" scope="row">Chrome, Edge, Opera (computer)</th><td className="pr-3">Full</td><td>Straight to disk</td></tr>
                  <tr className="border-b border-[color:var(--line-soft)]"><th className="py-1.5 pr-3 text-left font-medium" scope="row">Firefox, Safari (computer)</th><td className="pr-3">Full</td><td>Downloaded file</td></tr>
                  <tr><th className="py-1.5 pr-3 text-left font-medium" scope="row">Phones and tablets</th><td className="pr-3">Basic</td><td>Downloaded file, slow for big banks</td></tr>
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-[color:var(--muted)]">MIDI controllers need Web MIDI: Chrome, Edge and Opera support it. Firefox may ask for permission. Safari does not support Web MIDI, so use the on-screen keyboard there.</p>
          </section>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--line-soft)] px-6 py-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={hide} onChange={(e) => setHide(e.target.checked)} className={focusRing} />
            Do not show this at start
          </label>
          <button
            type="button"
            data-autofocus
            onClick={() => onClose(hide)}
            className={`rounded-sm bg-[color:var(--accent-fill)] px-5 py-2 text-sm font-semibold text-white hover:bg-[color:var(--accent-hover)] ${focusRing}`}
          >
            Start
          </button>
        </div>
      </div>
    </div>
  );
}