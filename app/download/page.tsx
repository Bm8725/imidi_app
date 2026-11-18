'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import {
  Monitor, Laptop, Cpu, Download, Copy, Check, ShieldCheck,
  HardDrive, Loader2, X, Sparkles,
} from 'lucide-react'

import { supabase } from '@/lib/supabase'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

/* ============================================================
   TYPES & DATA
============================================================ */
type OSId = 'windows' | 'macos' | 'embedded'

interface ReleaseRow {
  id: string
  version: string
  platform: OSId
  channel: 'stable' | 'beta'
  file_name: string
  size_bytes: number | null
  sha256: string | null
  notes: string[] | null
  released_at: string
}

interface Platform {
  id: OSId
  name: string
  tag: string
  icon: LucideIcon
  format: string
  arch: string
  blurb: string
  steps: string[]
  verify: string
}

const PLATFORMS: Platform[] = [
  {
    id: 'windows',
    name: 'Windows',
    tag: 'Windows 10 / 11 · 64-bit',
    icon: Monitor,
    format: '.exe',
    arch: 'x86_64',
    blurb: 'Standalone desktop build with native audio and MIDI selection.',
    steps: [
      'Run the installer.',
      'Open TS4X Native and choose your audio device.',
      'Connect your MIDI controller and play.',
    ],
    verify: 'Get-FileHash .\\TS4X-Native-Setup.exe -Algorithm SHA256',
  },
  {
    id: 'macos',
    name: 'macOS / iPad',
    tag: 'Apple Silicon · Intel · iPadOS',
    icon: Laptop,
    format: '.dmg',
    arch: 'arm64 · x86_64',
    blurb: 'Optimised for Apple Silicon. Runs on Intel Macs and supported iPad models.',
    steps: [
      'Open the .dmg and drag TS4X Native to Applications.',
      'If blocked: System Settings → Privacy & Security → Open Anyway.',
      'Pick your audio device and MIDI input.',
    ],
    verify: 'shasum -a 256 ~/Downloads/TS4X-Native.dmg',
  },
  {
    id: 'embedded',
    name: 'Embedded',
    tag: 'ARM Cortex-A72',
    icon: Cpu,
    format: '.img.xz',
    arch: 'ARM Cortex-A72',
    blurb: 'Linux image for stage rigs and instruments — no computer on stage.',
    steps: [
      'Write the image to an SD card with iMIDI SD Writer or any imaging tool.',
      'Insert the card into your board and power it on.',
      'Plug in your MIDI controller and audio output.',
    ],
    verify: 'sha256sum ts4x-embedded.img.xz',
  },
]

/* ============================================================
   HELPERS
============================================================ */
function detectOS(): OSId | null {
  if (typeof navigator === 'undefined') return null
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } }
  const ua = nav.userAgent.toLowerCase()
  const p = (nav.userAgentData?.platform || nav.platform || '').toLowerCase()
  if (p.includes('mac') || ua.includes('mac os') || ua.includes('ipad')) return 'macos'
  if (p.includes('win') || ua.includes('windows')) return 'windows'
  return null
}

function fmtBytes(n: number | null) {
  if (!n) return ''
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(0)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/* ============================================================
   PAGE
============================================================ */
export default function DownloadClient() {
  const [rows, setRows] = useState<ReleaseRow[]>([])
  const [rowsLoading, setRowsLoading] = useState(true)
  const [rowsError, setRowsError] = useState(false)
  const [showBeta, setShowBeta] = useState(false)

  const [os, setOs] = useState<OSId | null>(null)
  const [stepsFor, setStepsFor] = useState<OSId>('windows')
  const [copied, setCopied] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [dlError, setDlError] = useState<string | null>(null)
  const [started, setStarted] = useState<ReleaseRow | null>(null)

  useEffect(() => {
    let active = true
    supabase
      .from('ts4x_releases')
      .select('id,version,platform,channel,file_name,size_bytes,sha256,notes,released_at')
      .eq('published', true)
      .order('released_at', { ascending: false })
      .then(({ data, error }) => {
        if (!active) return
        if (error) setRowsError(true)
        setRows((data as ReleaseRow[]) || [])
        setRowsLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const d = detectOS()
    setOs(d)
    if (d) setStepsFor(d)
  }, [])

  const hasBeta = rows.some((r) => r.channel === 'beta')
  const visible = useMemo(
    () => rows.filter((r) => showBeta || r.channel === 'stable'),
    [rows, showBeta]
  )
  const latest = useMemo(() => {
    const m: Partial<Record<OSId, ReleaseRow>> = {}
    for (const r of visible) {
      if (!m[r.platform]) m[r.platform] = r
    }
    return m
  }, [visible])
  const older = useMemo(
    () => visible.filter((r) => latest[r.platform]?.id !== r.id),
    [visible, latest]
  )

  const download = async (rel: ReleaseRow) => {
    setDlError(null)
    setBusy(rel.id)
    try {
      const res = await fetch('/api/ts4x/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ releaseId: rel.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.url) {
        setDlError(data.error || 'Download unavailable. Please try again.')
        return
      }
      setStarted(rel)
      window.location.href = data.url
    } catch {
      setDlError('Network error. Please check your connection and try again.')
    } finally {
      setBusy(null)
    }
  }

  const copyHash = async (id: string, hash: string) => {
    try {
      await navigator.clipboard.writeText(hash)
      setCopied(id)
      setTimeout(() => setCopied(null), 1600)
    } catch {
      /* ignore */
    }
  }

  const action = (rel: ReleaseRow | undefined, label: string, big = false) => {
    const cls = `btn${big ? ' big' : ''}`
    if (rowsLoading) {
      return (
        <button className={cls} disabled>
          <Loader2 size={15} className="spin" /> Loading…
        </button>
      )
    }
    if (!rel) {
      return (
        <button className={cls} disabled>
          Coming soon
        </button>
      )
    }
    if (busy === rel.id) {
      return (
        <button className={cls} disabled>
          <Loader2 size={15} className="spin" /> Preparing…
        </button>
      )
    }
    return (
      <button className={`${cls} primary`} onClick={() => download(rel)}>
        <Download size={big ? 17 : 15} /> Download {label}
      </button>
    )
  }

  const recPlatform = PLATFORMS.find((p) => p.id === os) ?? null
  const recRelease = recPlatform ? latest[recPlatform.id] : undefined
  const stepsPlatform = PLATFORMS.find((p) => p.id === stepsFor) ?? PLATFORMS[0]
  const stepsRelease = latest[stepsPlatform.id]
  const desktop = PLATFORMS.filter((p) => p.id !== 'embedded')
  const embedded = PLATFORMS.find((p) => p.id === 'embedded')!

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

        .ts {
          --bg: #efefef;
          --surface: #ffffff;
          --surface2: #f7f7f8;
          --line: #e2e2e5;
          --text: #111111;
          --muted: #666666;
          --accent: #0070f3;
          --accent2: #8b5cf6;
          font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
          -webkit-font-smoothing: antialiased;
          min-height: 100vh;
          background: var(--bg);
          color: var(--text);
        }
        .ts *, .ts *::before, .ts *::after { box-sizing: border-box; }
        .ts a { color: inherit; text-decoration: none; }
        .wrap { max-width: 720px; margin: 0 auto; padding: 0 24px; }
        .mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }

        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        @keyframes fade-up {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-up {
          opacity: 0;
          animation: fade-up 0.55s ease-out forwards;
        }

        /* header band */
        .band {
          background: rgba(255,255,255,0.85);
          backdrop-filter: blur(8px);
          border-bottom: 1px solid var(--line);
          padding: 112px 0 40px;
        }
        .band h1 {
          font-size: clamp(22px, 4vw, 28px);
          font-weight: 700;
          letter-spacing: -0.02em;
          margin: 0 0 8px;
        }
        .band p {
          margin: 0;
          font-size: 14px;
          color: var(--muted);
          line-height: 1.55;
          max-width: 480px;
        }

        /* main card shell */
        .shell {
          margin: 40px 0 24px;
          border-radius: 16px;
          padding: 1.5px;
          background: linear-gradient(135deg, rgba(0,112,243,0.45), rgba(139,92,246,0.3), rgba(0,112,243,0.45));
          box-shadow: 0 8px 30px -12px rgba(0,112,243,0.22);
        }
        .shell-inner {
          background: var(--surface);
          border-radius: 15px;
          padding: 24px;
        }

        .meta-row {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
          margin-bottom: 16px;
        }
        .badge-os {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          padding: 3px 8px;
          border-radius: 6px;
          background: #0b1220;
          color: #fff;
        }
        .badge-ver {
          font-size: 11px;
          font-weight: 600;
          padding: 3px 8px;
          border-radius: 6px;
          background: rgba(0,112,243,0.1);
          color: var(--accent);
        }
        .badge-muted {
          font-size: 11px;
          color: #999;
        }

        .hint {
          display: flex;
          flex-wrap: wrap;
          gap: 8px 14px;
          font-size: 12.5px;
          color: var(--muted);
          margin-bottom: 20px;
        }
        .hint span {
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }
        .hint b { color: var(--text); font-weight: 600; }

        /* platform cards */
        .cards {
          display: grid;
          gap: 12px;
        }
        .card {
          border: 1px solid var(--line);
          border-radius: 14px;
          padding: 18px;
          background: var(--surface);
          display: flex;
          flex-direction: column;
          gap: 12px;
          transition: border-color 0.15s, box-shadow 0.15s;
          position: relative;
        }
        .card:hover {
          border-color: #c8c8ce;
          box-shadow: 0 6px 20px rgba(0,0,0,0.04);
        }
        .card.rec {
          border-color: #93c5fd;
          box-shadow: 0 0 0 1px #bfdbfe, 0 6px 20px rgba(0,112,243,0.08);
        }
        .badge-you {
          position: absolute;
          top: 12px;
          right: 12px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          padding: 3px 8px;
          border-radius: 99px;
          background: rgba(0,112,243,0.1);
          color: var(--accent);
          border: 1px solid #bfdbfe;
        }
        .card-hd {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .ic {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          background: linear-gradient(135deg, var(--accent), var(--accent2));
          flex: none;
          box-shadow: 0 4px 12px -4px rgba(0,112,243,0.45);
        }
        .card h3 {
          margin: 0;
          font-size: 15px;
          font-weight: 650;
        }
        .tag {
          font-size: 12px;
          color: var(--muted);
        }
        .blurb {
          margin: 0;
          font-size: 13px;
          line-height: 1.5;
          color: #555;
        }
        .chips {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
        }
        .chip {
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 99px;
          border: 1px solid var(--line);
          color: var(--muted);
          background: var(--surface2);
          font-family: 'JetBrains Mono', ui-monospace, monospace;
        }
        .chip.v {
          color: var(--accent);
          border-color: #bfdbfe;
          background: rgba(0,112,243,0.08);
        }
        .hash {
          display: flex;
          align-items: center;
          gap: 6px;
          font: 11px 'JetBrains Mono', ui-monospace, monospace;
          color: var(--muted);
        }
        .hash span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          flex: 1;
        }
        .hash button {
          background: none;
          border: 1px solid var(--line);
          color: var(--muted);
          border-radius: 6px;
          padding: 3px 6px;
          cursor: pointer;
          display: inline-flex;
        }
        .hash button:hover {
          color: var(--text);
          border-color: #c4c4cc;
        }
        .card details {
          font-size: 13px;
          color: #555;
        }
        .card summary {
          cursor: pointer;
          color: var(--muted);
          font-size: 12.5px;
        }
        .card details ul {
          margin: 6px 0 0;
          padding-left: 16px;
          line-height: 1.5;
        }

        /* buttons */
        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          padding: 10px 16px;
          border-radius: 10px;
          border: 1px solid var(--line);
          background: var(--surface);
          color: var(--text);
          font: 600 13px/1 'Inter', sans-serif;
          cursor: pointer;
          transition: border-color 0.15s, background 0.15s, box-shadow 0.15s, transform 0.15s;
          white-space: nowrap;
        }
        .btn:hover:not(:disabled) {
          border-color: #c4c4cc;
          background: var(--surface2);
        }
        .btn.primary {
          background: linear-gradient(90deg, var(--accent), var(--accent2));
          border-color: transparent;
          color: #fff;
          box-shadow: 0 6px 18px -6px rgba(0,112,243,0.45);
        }
        .btn.primary:hover:not(:disabled) {
          box-shadow: 0 8px 24px -4px rgba(139,92,246,0.5);
          transform: translateY(-1px);
        }
        .btn.big {
          padding: 12px 20px;
          font-size: 14px;
          border-radius: 12px;
        }
        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .btn:focus-visible, .tab:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
        }
        .card .btn { width: 100%; }

        /* embedded block */
        .emb {
          margin-top: 12px;
          border: 1px solid #ddd6fe;
          border-radius: 14px;
          padding: 20px;
          background: linear-gradient(120deg, #f5f3ff 0%, #eff6ff 100%);
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .emb h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 650;
        }
        .emb p {
          margin: 0;
          font-size: 13px;
          line-height: 1.5;
          color: #555;
        }
        .emb .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        /* install */
        .sec {
          margin: 40px 0 56px;
        }
        .sec h2 {
          font-size: 18px;
          font-weight: 700;
          letter-spacing: -0.015em;
          margin: 0 0 6px;
        }
        .lead {
          margin: 0 0 18px;
          font-size: 13.5px;
          color: var(--muted);
          line-height: 1.5;
        }
        .tabs {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 14px;
        }
        .tab {
          padding: 7px 14px;
          border-radius: 99px;
          border: 1px solid var(--line);
          background: var(--surface);
          color: var(--muted);
          cursor: pointer;
          font: 600 12.5px/1 'Inter', sans-serif;
          transition: border-color 0.15s, background 0.15s, color 0.15s;
        }
        .tab:hover {
          color: var(--text);
          border-color: #c4c4cc;
        }
        .tab.on {
          background: rgba(0,112,243,0.1);
          border-color: #93c5fd;
          color: var(--accent);
        }
        .steps {
          counter-reset: s;
          list-style: none;
          margin: 0 0 14px;
          padding: 0;
          display: grid;
          gap: 8px;
        }
        .steps li {
          counter-increment: s;
          display: flex;
          gap: 12px;
          align-items: flex-start;
          padding: 12px 14px;
          border: 1px solid var(--line);
          border-radius: 10px;
          background: var(--surface);
          line-height: 1.5;
          color: #333;
          font-size: 13.5px;
        }
        .steps li::before {
          content: counter(s);
          flex: none;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--accent), var(--accent2));
          color: #fff;
          font-weight: 700;
          font-size: 11px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .verify {
          padding: 12px 14px;
          border-radius: 10px;
          border: 1px dashed var(--line);
          background: var(--surface);
          font-size: 12.5px;
          color: var(--muted);
        }
        .verify code {
          display: block;
          margin-top: 8px;
          padding: 10px 12px;
          border-radius: 8px;
          background: var(--surface2);
          color: #1e3a8a;
          font: 12px 'JetBrains Mono', ui-monospace, monospace;
          overflow-x: auto;
          white-space: nowrap;
        }

        .meta {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 10px 16px;
          font-size: 12.5px;
          color: var(--muted);
          margin-bottom: 14px;
        }
        .meta label {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
        }
        .meta input { accent-color: var(--accent); }

        .errbar {
          margin-bottom: 12px;
          padding: 11px 13px;
          border-radius: 10px;
          border: 1px solid #fecaca;
          background: #fef2f2;
          color: #b91c1c;
          font-size: 13px;
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .older {
          margin-top: 16px;
        }
        .older summary {
          cursor: pointer;
          color: var(--muted);
          font-size: 13px;
        }
        .older-list {
          margin-top: 10px;
          display: grid;
          gap: 6px;
        }
        .older-row {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          padding: 10px 12px;
          border: 1px solid var(--line);
          border-radius: 10px;
          background: var(--surface);
          font-size: 13px;
        }
        .older-row .grow { flex: 1; min-width: 120px; }
        .older-row .btn { padding: 7px 11px; font-size: 12px; }

        /* toast */
        .toast {
          position: fixed;
          left: 50%;
          bottom: 20px;
          transform: translateX(-50%);
          z-index: 50;
          width: min(480px, calc(100vw - 28px));
          padding: 14px 16px;
          border-radius: 14px;
          border: 1px solid #a7f3d0;
          background: #ecfdf5;
          box-shadow: 0 12px 40px rgba(0,0,0,0.12);
          display: flex;
          gap: 12px;
          align-items: flex-start;
          font-size: 13px;
          line-height: 1.5;
          color: #065f46;
        }
        .toast b {
          color: #064e3b;
          display: block;
          font-size: 13.5px;
          margin-bottom: 1px;
        }
        .toast code {
          font: 11px 'JetBrains Mono', ui-monospace, monospace;
          color: #047857;
          word-break: break-all;
        }
        .toast button {
          margin-left: auto;
          background: none;
          border: none;
          color: #6b7280;
          cursor: pointer;
          padding: 2px;
        }

        @media (prefers-reduced-motion: reduce) {
          .ts *, .ts *::before {
            transition: none !important;
            animation: none !important;
          }
        }
      `}</style>

      <div className="ts">
        <Navbar />

        <div className="band">
          <div className="wrap fade-up" style={{ animationDelay: '0.05s' }}>
            <h1>Download TS4X Native</h1>
            <p>
              Live-performance synth engine. Sub-1.8&nbsp;ms latency and .wav sample
              playback — on desktop or dedicated hardware.
            </p>
          </div>
        </div>

        <div className="wrap">
          <div className="shell fade-up" style={{ animationDelay: '0.12s' }}>
            <div className="shell-inner">
              <div className="meta-row">
                <span className="badge-os">Desktop + Embedded</span>
                <span className="badge-ver">3 platforms</span>
                <span className="badge-muted">SHA-256 on every build</span>
              </div>

              <div className="hint">
                {recPlatform && (
                  <span>
                    <Sparkles size={13} /> Detected <b>{recPlatform.name}</b>
                    {recRelease ? ` · v${recRelease.version}` : ''}
                  </span>
                )}
                <span>
                  <ShieldCheck size={13} /> Standalone builds — no host required
                </span>
              </div>

              {recPlatform && (
                <div style={{ marginBottom: 16 }}>
                  {action(recRelease, recPlatform.name, true)}
                </div>
              )}

              <div className="meta">
                {hasBeta && (
                  <label>
                    <input
                      type="checkbox"
                      checked={showBeta}
                      onChange={(e) => setShowBeta(e.target.checked)}
                    />
                    Include beta builds
                  </label>
                )}
                {rowsError && (
                  <span style={{ color: '#b91c1c' }}>
                    Couldn&apos;t load releases. Please refresh.
                  </span>
                )}
              </div>

              {dlError && (
                <div className="errbar" role="alert">
                  <X size={15} /> {dlError}
                </div>
              )}

              <div className="cards">
                {desktop.map((p) => {
                  const Icon = p.icon
                  const rel = latest[p.id]
                  return (
                    <article
                      key={p.id}
                      className={`card${p.id === os ? ' rec' : ''}`}
                    >
                      {p.id === os && <span className="badge-you">Your system</span>}
                      <div className="card-hd">
                        <span className="ic">
                          <Icon size={18} />
                        </span>
                        <div>
                          <h3>{p.name}</h3>
                          <div className="tag">{p.tag}</div>
                        </div>
                      </div>
                      <p className="blurb">{p.blurb}</p>
                      <div className="chips">
                        {rel && (
                          <span className="chip v">
                            v{rel.version}
                            {rel.channel === 'beta' ? ' beta' : ''}
                          </span>
                        )}
                        <span className="chip">{p.format}</span>
                        <span className="chip">{p.arch}</span>
                        {rel?.size_bytes ? (
                          <span className="chip">{fmtBytes(rel.size_bytes)}</span>
                        ) : null}
                      </div>
                      {rel?.sha256 && (
                        <div className="hash" title={rel.sha256}>
                          <ShieldCheck size={13} />
                          <span>SHA-256 {rel.sha256}</span>
                          <button
                            onClick={() => copyHash(rel.id, rel.sha256 as string)}
                            aria-label="Copy SHA-256"
                          >
                            {copied === rel.id ? (
                              <Check size={12} />
                            ) : (
                              <Copy size={12} />
                            )}
                          </button>
                        </div>
                      )}
                      {rel?.notes && rel.notes.length > 0 && (
                        <details>
                          <summary>What&apos;s new in {rel.version}</summary>
                          <ul>
                            {rel.notes.map((n, i) => (
                              <li key={i}>{n}</li>
                            ))}
                          </ul>
                        </details>
                      )}
                      {action(rel, p.name)}
                    </article>
                  )
                })}
              </div>

              {/* Embedded */}
              {(() => {
                const rel = latest.embedded
                return (
                  <div className="emb">
                    <div className="card-hd">
                      <span className="ic">
                        <Cpu size={18} />
                      </span>
                      <div>
                        <h3>{embedded.name}</h3>
                        <div className="tag">{embedded.tag}</div>
                      </div>
                    </div>
                    <p>{embedded.blurb}</p>
                    <div className="chips">
                      {rel && (
                        <span className="chip v">
                          v{rel.version}
                          {rel.channel === 'beta' ? ' beta' : ''}
                        </span>
                      )}
                      <span className="chip">{embedded.format}</span>
                      {rel?.size_bytes ? (
                        <span className="chip">{fmtBytes(rel.size_bytes)}</span>
                      ) : null}
                    </div>
                    {rel?.sha256 && (
                      <div className="hash" title={rel.sha256}>
                        <ShieldCheck size={13} />
                        <span>SHA-256 {rel.sha256}</span>
                        <button
                          onClick={() => copyHash(rel.id, rel.sha256 as string)}
                          aria-label="Copy SHA-256"
                        >
                          {copied === rel.id ? (
                            <Check size={12} />
                          ) : (
                            <Copy size={12} />
                          )}
                        </button>
                      </div>
                    )}
                    <div className="actions">
                      {action(rel, 'Embedded', true)}
                      <Link href="/sd-writer" className="btn">
                        <HardDrive size={15} /> SD Writer
                      </Link>
                    </div>
                  </div>
                )
              })()}

              {older.length > 0 && (
                <details className="older">
                  <summary>Older versions ({older.length})</summary>
                  <div className="older-list">
                    {older.map((r) => {
                      const p = PLATFORMS.find((x) => x.id === r.platform)
                      return (
                        <div key={r.id} className="older-row">
                          <b className="grow">
                            {p?.name} · v{r.version}
                            {r.channel === 'beta' ? ' beta' : ''}
                          </b>
                          <span style={{ color: 'var(--muted)', fontSize: 12 }}>
                            {fmtDate(r.released_at)}
                            {r.size_bytes ? ` · ${fmtBytes(r.size_bytes)}` : ''}
                          </span>
                          {action(r, 'this version')}
                        </div>
                      )
                    })}
                  </div>
                </details>
              )}
            </div>
          </div>

          {/* Install steps */}
          <section className="sec fade-up" style={{ animationDelay: '0.2s' }}>
            <h2>Up and running in three steps</h2>
            <p className="lead">Select your platform.</p>
            <div className="tabs" role="tablist" aria-label="Install platform">
              {PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  role="tab"
                  aria-selected={stepsFor === p.id}
                  className={`tab${stepsFor === p.id ? ' on' : ''}`}
                  onClick={() => setStepsFor(p.id)}
                >
                  {p.name}
                </button>
              ))}
            </div>
            <ol className="steps" role="tabpanel">
              {stepsPlatform.steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
            <div className="verify">
              Verify your download
              {stepsRelease?.sha256
                ? ' against the checksum on the build card'
                : ''}
              :
              <code>{stepsPlatform.verify}</code>
            </div>
          </section>
        </div>

        <Footer />

        {started && (
          <div className="toast" role="status">
            <Check size={18} style={{ flex: 'none', marginTop: 2 }} />
            <div>
              <b>Download starting</b>
              TS4X Native {started.version}. If nothing happens, check your browser
              downloads.
              {started.sha256 && (
                <>
                  <br />
                  SHA-256: <code>{started.sha256}</code>
                </>
              )}
            </div>
            <button onClick={() => setStarted(null)} aria-label="Close">
              <X size={15} />
            </button>
          </div>
        )}
      </div>
    </>
  )
}