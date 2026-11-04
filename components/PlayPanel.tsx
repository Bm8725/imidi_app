'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BankInstrument, BankSample } from '@/lib/wbnk-compiler';
import { WbnkPlayer } from '@/lib/wbnk-player';
import { describeMidi, parseMidi } from '@/lib/wbnk-midi';
import type { Capabilities } from '@/lib/wbnk-browser';
import PianoKeys from './PianoKeys';
import { fieldClass, focusRing } from './ZoneTable';

type AudioState = 'off' | 'starting' | 'loading' | 'ready' | 'error';
type MidiState = 'idle' | 'connecting' | 'ready' | 'denied' | 'unsupported';

interface Ui {
  volume: number;
  expression: number;
  bend: number; // semitones
  pedal: boolean;
  voices: number;
  lastVelocity: number;
}

interface Device {
  id: string;
  name: string;
  connected: boolean;
}

interface Props {
  instruments: BankInstrument[];
  samples: BankSample[];
  instrument?: BankInstrument;
  caps: Capabilities | null;
  onSelectInstrument: (id: string) => void;
  onLog: (message: string, level?: 'info' | 'ok' | 'error') => void;
}

const slot = (i: number) => String(i).padStart(3, '0');

const card = 'rounded-sm border border-[color:var(--line)] bg-[color:var(--surface)]';
const cardHead = 'border-b border-[color:var(--line-soft)] px-4 py-3 text-sm font-semibold';
const btn = `rounded-sm border border-[color:var(--field-line)] bg-[color:var(--surface)] px-3 py-2 text-sm font-medium text-[color:var(--ink)] transition-colors hover:border-[color:var(--ink)] disabled:cursor-not-allowed disabled:text-[color:var(--muted)] ${focusRing}`;
const btnPrimary = `rounded-sm bg-[color:var(--accent-fill)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[color:var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`;

function Chip({ tone, children }: { tone: 'ok' | 'warn' | 'off'; children: React.ReactNode }) {
  const style =
    tone === 'ok'
      ? 'bg-[color:rgb(var(--brass-rgb)/0.2)] text-[color:var(--brass-ink)]'
      : tone === 'warn'
      ? 'bg-[color:rgb(var(--accent-rgb)/0.1)] text-[color:var(--accent)]'
      : 'bg-[color:var(--line-soft)] text-[color:var(--muted)]';
  return <span className={`inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-xs font-semibold ${style}`}>{children}</span>;
}

function Tile({ label, value, children }: { label: string; value: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="rounded-sm border border-[color:var(--line-soft)] p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold text-[color:var(--muted)]">{label}</span>
        <span className="text-lg font-bold tabular-nums">{value}</span>
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Bar({ value, max, label }: { value: number; max: number; label: string }) {
  return (
    <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} className="h-2 overflow-hidden rounded-full bg-[color:var(--line-soft)]">
      <div className="h-full rounded-full bg-[color:var(--accent-fill)] transition-[width] duration-100 motion-reduce:transition-none" style={{ width: `${(value / max) * 100}%` }} />
    </div>
  );
}

export default function PlayPanel({ instruments, samples, instrument, caps, onSelectInstrument, onLog }: Props) {
  const playerRef = useRef<WbnkPlayer | null>(null);
  const accessRef = useRef<any>(null);

  const [audio, setAudio] = useState<AudioState>('off');
  const [loadInfo, setLoadInfo] = useState<{ done: number; total: number } | null>(null);
  const [audioNote, setAudioNote] = useState('');
  const [midi, setMidi] = useState<MidiState>('idle');
  const [devices, setDevices] = useState<Device[]>([]);
  const [inputId, setInputId] = useState('all');
  const [channel, setChannel] = useState(0);
  const [programChange, setProgramChange] = useState(true);
  const [keyVelocity, setKeyVelocity] = useState(100);
  const [active, setActive] = useState<Set<number>>(new Set());
  const [ui, setUi] = useState<Ui>({ volume: 100, expression: 127, bend: 0, pedal: false, voices: 0, lastVelocity: 0 });
  const [monitor, setMonitor] = useState<string[]>([]);

  // values the MIDI handler needs without being re-created
  const chanRef = useRef(0);
  const progRef = useRef(true);
  const instrumentsRef = useRef(instruments);
  const selectRef = useRef(onSelectInstrument);
  const logRef = useRef(onLog);
  chanRef.current = channel;
  progRef.current = programChange;
  instrumentsRef.current = instruments;
  selectRef.current = onSelectInstrument;
  logRef.current = onLog;

  // controller messages arrive faster than the screen refreshes, so UI updates are batched per frame
  const pending = useRef<Partial<Ui>>({});
  const monitorBuf = useRef<string[]>([]);
  const raf = useRef(0);
  const flush = useCallback(() => {
    raf.current = 0;
    const p = pending.current;
    pending.current = {};
    if (Object.keys(p).length) setUi((u) => ({ ...u, ...p }));
    setMonitor([...monitorBuf.current]);
  }, []);
  const schedule = useCallback(() => {
    if (!raf.current) raf.current = requestAnimationFrame(flush);
  }, [flush]);
  const queue = useCallback(
    (patch: Partial<Ui>) => {
      Object.assign(pending.current, patch);
      schedule();
    },
    [schedule]
  );
  const note = useCallback(
    (text: string) => {
      monitorBuf.current = [text, ...monitorBuf.current].slice(0, 12);
      schedule();
    },
    [schedule]
  );

  /* player lifetime */
  useEffect(() => {
    const p = new WbnkPlayer({
      onActive: (n) => setActive(n),
      onVoices: (n) => queue({ voices: n }),
      onError: (m) => setAudioNote(m),
    });
    playerRef.current = p;
    return () => {
      cancelAnimationFrame(raf.current);
      p.dispose();
      playerRef.current = null;
    };
  }, [queue]);

  useEffect(() => {
    playerRef.current?.setSource(instrument, samples);
  }, [instrument, samples]);

  /* audio engine */
  const loadToken = useRef(0);
  const preload = useCallback(async () => {
    const p = playerRef.current;
    if (!p) return;
    const token = ++loadToken.current;
    setAudio('loading');
    setAudioNote('');
    const result = await p.preload((done, total) => {
      if (token === loadToken.current) setLoadInfo({ done, total });
    });
    if (token !== loadToken.current) return;
    setLoadInfo(null);
    setAudio('ready');
    if (result.failed.length) setAudioNote(`Could not decode: ${result.failed.join(', ')}`);
  }, []);

  const startAudio = async () => {
    const p = playerRef.current;
    if (!p) return;
    setAudio('starting');
    try {
      await p.start();
      setAudio('loading');
    } catch (e: any) {
      setAudio('error');
      setAudioNote(e?.message ?? String(e));
    }
  };

  const started = audio === 'loading' || audio === 'ready';
  useEffect(() => {
    if (started) void preload();
  }, [instrument?.id, started, preload]);

  /* MIDI */
  const refreshDevices = useCallback((access: any) => {
    const list: Device[] = [];
    access.inputs.forEach((inp: any) => list.push({ id: inp.id, name: inp.name || 'MIDI input', connected: inp.state === 'connected' }));
    setDevices(list);
  }, []);

  const connectMidi = useCallback(async () => {
    const nav = navigator as any;
    if (typeof nav.requestMIDIAccess !== 'function') {
      setMidi('unsupported');
      return;
    }
    setMidi('connecting');
    try {
      const access = await nav.requestMIDIAccess({ sysex: false });
      accessRef.current = access;
      access.onstatechange = () => refreshDevices(access);
      refreshDevices(access);
      setMidi('ready');
      logRef.current('MIDI access granted. Plug in a controller and it appears in the list.', 'ok');
    } catch {
      setMidi('denied');
      logRef.current('MIDI access was not granted.', 'error');
    }
  }, [refreshDevices]);

  useEffect(() => {
    const nav = navigator as any;
    if (typeof nav.requestMIDIAccess !== 'function') {
      setMidi('unsupported');
      return;
    }
    nav.permissions
      ?.query?.({ name: 'midi' })
      .then((r: any) => {
        if (r.state === 'granted') void connectMidi();
      })
      .catch(() => undefined);
  }, [connectMidi]);

  const onMessage = useCallback(
    (ev: any) => {
      const e = parseMidi(ev.data);
      const p = playerRef.current;
      if (!e || !p) return;
      if (chanRef.current !== 0 && e.channel !== chanRef.current) return;
      note(describeMidi(e));
      switch (e.type) {
        case 'noteOn':
          queue({ lastVelocity: e.velocity });
          void p.noteOn(e.note, e.velocity);
          break;
        case 'noteOff':
          p.noteOff(e.note);
          break;
        case 'bend':
          p.setBend(e.value * 2);
          queue({ bend: e.value * 2 });
          break;
        case 'program':
          if (progRef.current) {
            const target = instrumentsRef.current[e.program];
            if (target) selectRef.current(target.id);
          }
          break;
        case 'cc':
          if (e.controller === 11) {
            p.setExpression(e.value);
            queue({ expression: e.value });
          } else if (e.controller === 7) {
            p.setVolume(e.value);
            queue({ volume: e.value });
          } else if (e.controller === 64) {
            p.setPedal(e.value >= 64);
            queue({ pedal: e.value >= 64 });
          } else if (e.controller === 120 || e.controller === 123) {
            p.allNotesOff();
          } else if (e.controller === 121) {
            p.resetControllers();
            queue({ bend: 0, pedal: false, expression: 127 });
          }
          break;
      }
    },
    [note, queue]
  );

  useEffect(() => {
    const access = accessRef.current;
    if (!access || midi !== 'ready') return;
    access.inputs.forEach((inp: any) => {
      inp.onmidimessage = inputId === 'all' || inp.id === inputId ? onMessage : null;
    });
    return () => access.inputs.forEach((inp: any) => (inp.onmidimessage = null));
  }, [midi, inputId, devices, onMessage]);

  /* on-screen controls */
  const keyDown = async (n: number) => {
    if (audio === 'off' || audio === 'error') await startAudio();
    queue({ lastVelocity: keyVelocity });
    void playerRef.current?.noteOn(n, keyVelocity);
  };
  const keyUp = (n: number) => playerRef.current?.noteOff(n);

  const setVolume = (v: number) => {
    playerRef.current?.setVolume(v);
    setUi((u) => ({ ...u, volume: v }));
  };
  const setExpression = (v: number) => {
    playerRef.current?.setExpression(v);
    setUi((u) => ({ ...u, expression: v }));
  };
  const togglePedal = () => {
    const on = !ui.pedal;
    playerRef.current?.setPedal(on);
    setUi((u) => ({ ...u, pedal: on }));
  };
  const panic = () => {
    playerRef.current?.allNotesOff();
    playerRef.current?.resetControllers();
    setUi((u) => ({ ...u, pedal: false, bend: 0, expression: 127 }));
  };

  const covered = useMemo(() => {
    const s = new Set<number>();
    for (const z of instrument?.zones ?? []) if (z.sampleId) for (let k = z.keyLo; k <= z.keyHi; k++) s.add(k);
    return s;
  }, [instrument]);

  const [lo, hi] = useMemo(() => {
    const zones = instrument?.zones ?? [];
    if (zones.length === 0) return [36, 96];
    let a = Math.min(...zones.map((z) => z.keyLo));
    let b = Math.max(...zones.map((z) => z.keyHi));
    while (b - a < 23 && (a > 0 || b < 127)) {
      a = Math.max(0, a - 1);
      b = Math.min(127, b + 1);
    }
    return [a, b];
  }, [instrument]);

  const audioChip =
    audio === 'ready' ? <Chip tone="ok">Audio running</Chip> :
    audio === 'loading' ? <Chip tone="off">Loading samples {loadInfo ? `${loadInfo.done} of ${loadInfo.total}` : ''}</Chip> :
    audio === 'starting' ? <Chip tone="off">Starting…</Chip> :
    audio === 'error' ? <Chip tone="warn">Audio error</Chip> :
    <Chip tone="off">Audio stopped</Chip>;

  const midiChip =
    midi === 'ready' ? <Chip tone={devices.some((d) => d.connected) ? 'ok' : 'off'}>{devices.some((d) => d.connected) ? `${devices.filter((d) => d.connected).length} input(s)` : 'No controller found'}</Chip> :
    midi === 'connecting' ? <Chip tone="off">Waiting for permission…</Chip> :
    midi === 'denied' ? <Chip tone="warn">Permission denied</Chip> :
    midi === 'unsupported' ? <Chip tone="warn">Not supported here</Chip> :
    <Chip tone="off">Not connected</Chip>;

  const hasSound = covered.size > 0;

  return (
    <div className="space-y-5">
      {/* Setup */}
      <section aria-labelledby="play-setup" className={card}>
        <h2 id="play-setup" className={cardHead}>Engine and controller</h2>
        <div className="grid gap-5 p-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[color:var(--muted)]">Audio engine</span>
              {audioChip}
            </div>
            <button type="button" onClick={startAudio} disabled={audio === 'starting' || started} className={btnPrimary}>
              {started ? 'Audio engine started' : 'Start audio engine'}
            </button>
            {audio === 'off' && <p className="text-xs text-[color:var(--muted)]">Browsers only allow sound after a click, so start the engine once. MIDI notes are silent until then.</p>}
            {audioNote && <p className="text-xs font-medium text-[color:var(--accent)]" role="alert">{audioNote}</p>}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[color:var(--muted)]">MIDI controller</span>
              {midiChip}
            </div>
            {midi === 'ready' ? (
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <label className="block">
                  <span className="sr-only">MIDI input</span>
                  <select value={inputId} onChange={(e) => setInputId(e.target.value)} className={`${fieldClass} w-full`}>
                    <option value="all">All inputs</option>
                    {devices.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}{d.connected ? '' : ' (disconnected)'}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="sr-only">MIDI channel</span>
                  <select value={channel} onChange={(e) => setChannel(Number(e.target.value))} className={fieldClass}>
                    <option value={0}>All channels</option>
                    {Array.from({ length: 16 }, (_, i) => (
                      <option key={i} value={i + 1}>Channel {i + 1}</option>
                    ))}
                  </select>
                </label>
              </div>
            ) : (
              <button type="button" onClick={connectMidi} disabled={midi === 'connecting' || midi === 'unsupported'} className={btn}>
                Connect MIDI controller
              </button>
            )}
            {midi === 'ready' && devices.length === 0 && <p className="text-xs text-[color:var(--muted)]">No MIDI input yet. Plug in a keyboard and it appears here by itself.</p>}
            {midi === 'unsupported' && <p className="text-xs text-[color:var(--muted)]">This browser has no Web MIDI. Use Chrome, Edge or Opera, or play with the on-screen keyboard below.</p>}
            {midi === 'denied' && <p className="text-xs text-[color:var(--muted)]">Allow MIDI for this site in the browser’s site settings, then try again.</p>}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={programChange} onChange={(e) => setProgramChange(e.target.checked)} className={focusRing} />
              Program change selects the instrument slot
            </label>
          </div>

          <div className="space-y-3 md:col-span-2 xl:col-span-1">
            <label className="block">
              <span className="text-xs font-semibold text-[color:var(--muted)]">Instrument to play</span>
              <select value={instrument?.id ?? ''} onChange={(e) => onSelectInstrument(e.target.value)} className={`${fieldClass} mt-1 w-full`} disabled={instruments.length === 0}>
                {instruments.map((ins, i) => (
                  <option key={ins.id} value={ins.id}>{slot(i)}  {ins.name || 'Unnamed'}</option>
                ))}
              </select>
            </label>
            <button type="button" onClick={panic} className={btn}>All notes off</button>
          </div>
        </div>
      </section>

      {/* Controllers */}
      <section aria-labelledby="play-ctl" className={card}>
        <h2 id="play-ctl" className={cardHead}>Controllers</h2>
        <div className="grid grid-cols-2 gap-3 p-4 lg:grid-cols-3 xl:grid-cols-6">
          <Tile label="Velocity" value={ui.lastVelocity || '–'}>
            <Bar value={ui.lastVelocity} max={127} label="Last velocity" />
          </Tile>
          <Tile label="Expression CC11" value={ui.expression}>
            <input type="range" min={0} max={127} value={ui.expression} onChange={(e) => setExpression(Number(e.target.value))} aria-label="Expression" className="w-full" style={{ accentColor: 'var(--accent)' }} />
          </Tile>
          <Tile label="Volume CC7" value={ui.volume}>
            <input type="range" min={0} max={127} value={ui.volume} onChange={(e) => setVolume(Number(e.target.value))} aria-label="Volume" className="w-full" style={{ accentColor: 'var(--accent)' }} />
          </Tile>
          <Tile label="Pitch bend" value={`${ui.bend >= 0 ? '+' : ''}${ui.bend.toFixed(2)}`}>
            <div className="relative h-2 rounded-full bg-[color:var(--line-soft)]" role="meter" aria-label="Pitch bend in semitones" aria-valuemin={-2} aria-valuemax={2} aria-valuenow={ui.bend}>
              <div className="absolute inset-y-0 left-1/2 w-px bg-[color:var(--muted)]" />
              <div className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[color:var(--accent-fill)] transition-[left] duration-75 motion-reduce:transition-none" style={{ left: `${((ui.bend + 2) / 4) * 100}%` }} />
            </div>
          </Tile>
          <Tile label="Sustain CC64" value={ui.pedal ? 'On' : 'Off'}>
            <button type="button" aria-pressed={ui.pedal} onClick={togglePedal} className={`w-full rounded-sm border px-2 py-1 text-xs font-semibold transition-colors ${ui.pedal ? 'border-[color:var(--accent)] bg-[color:var(--accent-fill)] text-white' : 'border-[color:var(--field-line)] hover:border-[color:var(--ink)]'} ${focusRing}`}>
              {ui.pedal ? 'Release pedal' : 'Hold pedal'}
            </button>
          </Tile>
          <Tile label="Voices" value={ui.voices}>
            <Bar value={Math.min(ui.voices, 64)} max={64} label="Active voices" />
          </Tile>
        </div>
      </section>

      {/* Keyboard */}
      <section aria-labelledby="play-kb" className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--line-soft)] px-4 py-3">
          <h2 id="play-kb" className="text-sm font-semibold">Keyboard{instrument ? `: ${instrument.name}` : ''}</h2>
          <label className="flex items-center gap-3 text-sm">
            <span className="text-xs font-semibold text-[color:var(--muted)]">Key velocity</span>
            <input type="range" min={1} max={127} value={keyVelocity} onChange={(e) => setKeyVelocity(Number(e.target.value))} aria-label="Velocity of the on-screen keys" style={{ accentColor: 'var(--accent)' }} />
            <span className="w-8 text-right font-semibold tabular-nums">{keyVelocity}</span>
          </label>
        </div>
        <div className="p-4">
          {!instrument ? (
            <p className="text-sm text-[color:var(--muted)]">Add an instrument first.</p>
          ) : !hasSound ? (
            <p className="mb-3 text-sm text-[color:var(--muted)]">This instrument has no zone with a sample yet, so the keys are silent. Map samples in the Instruments or Sample library tab.</p>
          ) : null}
          <PianoKeys lo={lo} hi={hi} active={active} covered={covered} onDown={keyDown} onUp={keyUp} />
          <p className="mt-2 text-xs text-[color:var(--muted)]">Dimmed keys have no sample. Preview plays pitch, loop, attack, release, attenuation and pan from each zone. Decay and sustain are not applied because the format stores sustain in milliseconds.</p>
        </div>
      </section>

      {/* Monitor */}
      <section aria-labelledby="play-mon" className={card}>
        <h2 id="play-mon" className={cardHead}>MIDI monitor</h2>
        {monitor.length === 0 ? (
          <p className="px-4 py-5 text-sm text-[color:var(--muted)]">Play a key on your controller. The last messages appear here.</p>
        ) : (
          <ol className="divide-y divide-[color:var(--line-soft)] text-sm tabular-nums">
            {monitor.map((m, i) => (
              <li key={`${i}-${m}`} className="px-4 py-1.5" style={{ opacity: 1 - i * 0.06 }}>{m}</li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}