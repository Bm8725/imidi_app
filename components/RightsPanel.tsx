'use client';

import React from 'react';
import { fieldClass, focusRing } from './ZoneTable';

export const LICENCES = [
  'TS4X Core DSP Standard v1.0',
  'Proprietary, all rights reserved',
  'Commercial licence, single user',
  'Commercial licence, multi-user',
  'CC BY 4.0',
  'CC BY-NC 4.0',
  'CC0 1.0 (public domain)',
];
const CUSTOM = '__custom';

interface Props {
  meta: Record<string, unknown>;
  onMeta: (key: string, value: unknown) => void;
  syntText: string;
  onSynt: (text: string) => void;
  syntError: boolean;
  disabled?: boolean;
}

export default function RightsPanel({ meta, onMeta, syntText, onSynt, syntError, disabled }: Props) {
  const str = (k: string) => String(meta[k] ?? '');
  const licence = str('license');
  const isCustom = !LICENCES.includes(licence);
  const holder = str('copyright_holder');
  const year = str('year');

  const generate = () => onMeta('copyright', `© ${year || new Date().getFullYear()} ${holder || 'iMIDI.co.uk'}. All rights reserved.`);

  const field = (key: string, label: string, opts: { type?: string; placeholder?: string; className?: string } = {}) => (
    <label className={`block ${opts.className ?? ''}`}>
      <span className="text-xs font-semibold text-[#5A6270]">{label}</span>
      <input
        type={opts.type ?? 'text'}
        value={str(key)}
        placeholder={opts.placeholder}
        disabled={disabled}
        onChange={(e) => onMeta(key, e.target.value)}
        className={`${fieldClass} mt-1 w-full`}
      />
    </label>
  );

  const card = 'rounded-sm border border-[#D7DAE0] bg-white';
  const cardHead = 'border-b border-[#E4E6EB] px-5 py-3 text-sm font-semibold';

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-6">
        <section className={card} aria-labelledby="cp-h">
          <h2 id="cp-h" className={cardHead}>Copyright</h2>
          <div className="grid gap-4 p-5 md:grid-cols-[1fr_120px]">
            {field('copyright_holder', 'Copyright holder', { placeholder: 'Company or person who owns the recordings' })}
            {field('year', 'Year', { placeholder: '2026' })}
            <label className="block md:col-span-2">
              <span className="text-xs font-semibold text-[#5A6270]">Copyright notice (stored in the file)</span>
              <div className="mt-1 flex gap-2">
                <input value={str('copyright')} disabled={disabled} onChange={(e) => onMeta('copyright', e.target.value)} className={`${fieldClass} w-full`} />
                <button type="button" onClick={generate} disabled={disabled} className={`shrink-0 rounded-sm border border-[#C5C9D1] bg-white px-3 text-sm font-medium hover:border-[#15181D] ${focusRing}`}>
                  Generate
                </button>
              </div>
            </label>
          </div>
        </section>

        <section className={card} aria-labelledby="lic-h">
          <h2 id="lic-h" className={cardHead}>Licence</h2>
          <div className="grid gap-4 p-5 md:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-[#5A6270]">Licence type</span>
              <select
                value={isCustom ? CUSTOM : licence}
                disabled={disabled}
                onChange={(e) => onMeta('license', e.target.value === CUSTOM ? '' : e.target.value)}
                className={`${fieldClass} mt-1 w-full`}
              >
                {LICENCES.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
                <option value={CUSTOM}>Custom</option>
              </select>
            </label>
            {isCustom ? (
              <label className="block">
                <span className="text-xs font-semibold text-[#5A6270]">Custom licence text</span>
                <input value={licence} disabled={disabled} onChange={(e) => onMeta('license', e.target.value)} className={`${fieldClass} mt-1 w-full`} />
              </label>
            ) : (
              <div />
            )}
            <label className="flex items-start gap-3 md:col-span-2">
              <input
                type="checkbox"
                checked={meta.rights_confirmed === true}
                disabled={disabled}
                onChange={(e) => onMeta('rights_confirmed', e.target.checked)}
                className={`mt-1 ${focusRing}`}
              />
              <span className="text-sm">
                I confirm that I own, or have permission to distribute, every recording and sample in this bank.
              </span>
            </label>
          </div>
        </section>

        <section className={card} aria-labelledby="cr-h">
          <h2 id="cr-h" className={cardHead}>Credits and contact</h2>
          <div className="grid gap-4 p-5 md:grid-cols-2">
            {field('author', 'Author')}
            {field('producer', 'Recorded and produced by')}
            {field('website', 'Website', { type: 'url', placeholder: 'https://imidi.co.uk' })}
            {field('contact', 'Contact email', { type: 'email', placeholder: 'support@imidi.co.uk' })}
            <label className="block md:col-span-2">
              <span className="text-xs font-semibold text-[#5A6270]">Credits (instrument source, performers, third-party material)</span>
              <textarea value={str('credits')} disabled={disabled} rows={3} onChange={(e) => onMeta('credits', e.target.value)} className={`${fieldClass} mt-1 w-full`} />
            </label>
            <label className="block md:col-span-2">
              <span className="text-xs font-semibold text-[#5A6270]">Internal notes</span>
              <textarea value={str('notes')} disabled={disabled} rows={2} onChange={(e) => onMeta('notes', e.target.value)} className={`${fieldClass} mt-1 w-full`} />
            </label>
          </div>
        </section>

        <section className={card} aria-labelledby="syn-h">
          <h2 id="syn-h" className={cardHead}>Synth presets (SYNT chunk)</h2>
          <div className="p-5">
            <label className="block">
              <span className="sr-only">Synth presets as JSON</span>
              <textarea
                value={syntText}
                disabled={disabled}
                rows={6}
                spellCheck={false}
                aria-invalid={syntError}
                onChange={(e) => onSynt(e.target.value)}
                className={`${fieldClass} w-full font-[ui-monospace,monospace] text-xs ${syntError ? 'border-[#A61E2B]' : ''}`}
              />
            </label>
            {syntError && <p className="mt-1 text-xs text-[#A61E2B]">This is not valid JSON yet. The bank cannot be built until it is.</p>}
          </div>
        </section>
      </div>

      {/* Preview */}
      <aside aria-label="Notice preview" className="h-fit rounded-sm border border-[#15181D] bg-white p-5 lg:sticky lg:top-4">
        <p className="text-xs font-semibold text-[#5A6270]">As stored in the file</p>
        <p className="mt-3 text-lg font-bold tracking-tight">{str('title') || 'Untitled bank'}</p>
        <p className="mt-1 text-sm">{str('copyright') || <span className="text-[#A61E2B]">No copyright notice</span>}</p>
        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="text-xs font-semibold text-[#5A6270]">Licence</dt>
            <dd>{licence || <span className="text-[#A61E2B]">Not set</span>}</dd>
          </div>
          {str('author') && (
            <div>
              <dt className="text-xs font-semibold text-[#5A6270]">Author</dt>
              <dd>{str('author')}</dd>
            </div>
          )}
          {str('producer') && (
            <div>
              <dt className="text-xs font-semibold text-[#5A6270]">Recorded by</dt>
              <dd>{str('producer')}</dd>
            </div>
          )}
          {(str('website') || str('contact')) && (
            <div>
              <dt className="text-xs font-semibold text-[#5A6270]">Contact</dt>
              <dd className="break-words">{[str('website'), str('contact')].filter(Boolean).join(', ')}</dd>
            </div>
          )}
          {str('credits') && (
            <div>
              <dt className="text-xs font-semibold text-[#5A6270]">Credits</dt>
              <dd className="whitespace-pre-line">{str('credits')}</dd>
            </div>
          )}
        </dl>
        <p className={`mt-4 border-t border-[#E4E6EB] pt-3 text-xs ${meta.rights_confirmed === true ? 'text-[#3A404A]' : 'font-semibold text-[#A61E2B]'}`}>
          {meta.rights_confirmed === true ? 'Rights declaration confirmed.' : 'Rights declaration not confirmed.'}
        </p>
      </aside>
    </div>
  );
}