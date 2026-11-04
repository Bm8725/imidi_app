'use client';

import React, { useRef } from 'react';
import { midiNoteName } from '@/lib/wbnk-midi';

const BLACK = new Set([1, 3, 6, 8, 10]);
const WHITE_W = 36;
const BLACK_W = 22;
const HEIGHT = 168;

interface Props {
  lo: number;
  hi: number;
  active: Set<number>;
  covered: Set<number>;
  onDown: (note: number) => void;
  onUp: (note: number) => void;
}

/** Clickable on-screen keyboard. Keys without a sample are dimmed. */
export default function PianoKeys({ lo, hi, active, covered, onDown, onUp }: Props) {
  const held = useRef(new Map<number, number>()); // pointerId -> note

  const keys: { note: number; black: boolean; left: number }[] = [];
  let whites = 0;
  for (let n = lo; n <= hi; n++) {
    const black = BLACK.has(n % 12);
    keys.push({ note: n, black, left: black ? whites * WHITE_W - BLACK_W / 2 : whites * WHITE_W });
    if (!black) whites++;
  }

  const press = (e: React.PointerEvent<HTMLButtonElement>, note: number) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    held.current.set(e.pointerId, note);
    onDown(note);
  };
  const release = (e: React.PointerEvent<HTMLButtonElement>) => {
    const note = held.current.get(e.pointerId);
    if (note === undefined) return;
    held.current.delete(e.pointerId);
    onUp(note);
  };

  const render = ({ note, black, left }: (typeof keys)[number]) => {
    const on = active.has(note);
    const dim = !covered.has(note);
    return (
      <button
        key={note}
        type="button"
        aria-label={`${midiNoteName(note)}, MIDI ${note}${dim ? ', no sample' : ''}`}
        aria-pressed={on}
        onPointerDown={(e) => press(e, note)}
        onPointerUp={release}
        onPointerCancel={release}
        onKeyDown={(e) => {
          if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
            e.preventDefault();
            onDown(note);
          }
        }}
        onKeyUp={(e) => {
          if (e.key === ' ' || e.key === 'Enter') onUp(note);
        }}
        style={{ left, width: black ? BLACK_W : WHITE_W, height: black ? HEIGHT * 0.6 : HEIGHT, touchAction: 'none' }}
        className={[
          'absolute top-0 select-none rounded-b-sm border transition-[background-color,transform] duration-75',
          'focus-visible:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[color:var(--accent)]',
          black ? 'z-10 border-[color:var(--key-edge)]' : 'border-[color:var(--key-line)]',
          black
            ? on
              ? 'bg-[color:var(--accent-fill)]'
              : 'bg-[color:var(--key-black)]'
            : on
            ? 'bg-[color:rgb(var(--accent-rgb)/0.55)]'
            : 'bg-[color:var(--key-white)]',
          on ? 'translate-y-px' : '',
          dim ? 'opacity-40' : '',
        ].join(' ')}
      >
        {!black && note % 12 === 0 && (
          <span className="pointer-events-none absolute inset-x-0 bottom-1.5 text-center text-[10px] font-semibold text-[color:var(--muted)]">{midiNoteName(note)}</span>
        )}
      </button>
    );
  };

  return (
    <div className="overflow-x-auto pb-2">
      <div role="group" aria-label="On-screen keyboard" className="relative mx-auto" style={{ width: whites * WHITE_W, height: HEIGHT }}>
        {keys.filter((k) => !k.black).map(render)}
        {keys.filter((k) => k.black).map(render)}
      </div>
    </div>
  );
}