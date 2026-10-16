// lib/AirMidiLink.ts v1
/**
 * 
 * authorȘ BM8725 2026
 */
import { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'

export type AirMidiRole = 'sender' | 'receiver'
export type AirMidiStatus =
  | 'idle'
  | 'initializing'
  | 'waiting'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
export type AirMidiLogLevel = 'info' | 'success' | 'warn' | 'error'
export type MidiDirection = 'in' | 'out'
export type VideoQuality = '360p' | '720p'
export type NetPath = 'direct' | 'relay'

// Continuous controllers can ride the fast lane (a newer value replaces an older one).
// Everything in this set is discrete (switches, bank select, RPN/NRPN, channel mode) and must be reliable.
const DISCRETE_CC = new Set([
  0, 6, 32, 38, 64, 65, 66, 67, 68, 69, 96, 97, 98, 99, 100, 101, 120, 121, 122, 123, 124, 125, 126, 127,
])

// Low-hours warning thresholds in seconds (10 min, 1 h, 4 h). Edit the list to change when users are warned.
const LOW_HOURS_THRESHOLDS = [600, 3600, 4 * 3600]

// Auto-reconnect: a short network blip is ignored, then the link is repaired for up to a minute
const DISCONNECT_GRACE_MS = 4000
const RECONNECT_TIMEOUT_MS = 60000

// Public identity shown to the other side (email is masked on purpose)
export type AirMidiPeer = {
  name: string
  email: string
  avatar?: string
  role: AirMidiRole
}

export function peerFromUser(user: any, role: AirMidiRole): AirMidiPeer {
  const meta = user?.user_metadata || {}
  const email: string = user?.email || ''
  const [local = '', domain = ''] = email.split('@')
  const masked = email ? `${local.slice(0, 2)}***@${domain}` : ''
  const name = String(meta.full_name || meta.name || meta.user_name || local || 'User')
  const avatar =
    typeof meta.avatar_url === 'string' ? meta.avatar_url : typeof meta.picture === 'string' ? meta.picture : undefined
  return { name, email: masked, avatar, role }
}

export class AirMidiLink {
  private supabase: SupabaseClient
  private peerConnection: RTCPeerConnection | null = null
  private channel: RealtimeChannel | null = null
  private dataChannel: RTCDataChannel | null = null
  private midiAccess: MIDIAccess | null = null
  private pendingIce: { from?: string; ice: RTCIceCandidateInit }[] = []

  // identity of this browser tab in the signaling channel + join approval state
  private clientId = Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
  private peerId: string | null = null
  private pendingOffer: RTCSessionDescriptionInit | null = null
  private approved = false
  private waitingApproval = false

  // video (optional, bidirectional, no audio)
  private videoTransceiver: RTCRtpTransceiver | null = null
  private localStream: MediaStream | null = null
  private remoteStream: MediaStream | null = null

  // microphone (optional, bidirectional)
  private audioTransceiver: RTCRtpTransceiver | null = null
  private micStream: MediaStream | null = null
  private remoteAudioStream: MediaStream | null = null
  private hasRemoteDescription = false
  private connectTimer: ReturnType<typeof setTimeout> | null = null
  private hasTurn = false
  private relaySeen = false

  // MIDI priority: a reliable lane for notes/SysEx and a fast, loss-tolerant lane for controllers
  private fastChannel: RTCDataChannel | null = null
  private settle = new Map<number, { data: Uint8Array; at: number }>()
  private midiTimers: ReturnType<typeof setInterval>[] = []

  // latency probe + "video yields to MIDI"
  private rttEma = 0
  private rttSamples: number[] = []
  private congestionHits = 0
  private calmHits = 0
  private throttled = false
  private videoBitrate = 500_000

  // billing: hours are spent by the sender; the database clock is the source of truth
  private billingActive = false
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private pageHideHandler: (() => void) | null = null
  private lowAnnounced = Infinity
  private freeTimer: ReturnType<typeof setTimeout> | null = null
  private freeWarned = false
  private freeLimit = 300

  // auto-reconnect
  private graceTimer: ReturnType<typeof setTimeout> | null = null
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectDeadline = 0
  private reconnectAttempts = 0
  private onlineHandler: (() => void) | null = null
  private rebuilding = false

  public role: AirMidiRole | null = null
  public roomCode: string | null = null
  public status: AirMidiStatus = 'idle'

  public onStatusChange: (status: AirMidiStatus) => void = () => {}
  public onMidiMessageReceived: (data: Uint8Array) => void = () => {}
  public onMidiActivity: (data: Uint8Array, direction: MidiDirection) => void = () => {}
  public onDevicesChange: (names: string[]) => void = () => {}
  public onError: (message: string) => void = () => {}
  public onLog: (level: AirMidiLogLevel, message: string) => void = () => {}
  public onSysexState: (enabled: boolean) => void = () => {}
  public onLatency: (rttMs: number) => void = () => {}
  public onPathInfo: (path: NetPath) => void = () => {}
  public onVideoThrottle: (on: boolean) => void = () => {}
  public onBalance: (seconds: number) => void = () => {}
  public onLowHours: (seconds: number) => void = () => {}
  // seconds left in a free session (null when the session is not free)
  public onFreeTime: (remaining: number | null, limit: number) => void = () => {}
  public sysexEnabled = false
  private outputErrorLogged = false
  public onPeerInfo: (peer: AirMidiPeer) => void = () => {}
  public onJoinRequest: (peer: AirMidiPeer) => void = () => {}
  public onWaitingApproval: () => void = () => {}
  public onLocalVideo: (stream: MediaStream | null) => void = () => {}
  public onRemoteStream: (stream: MediaStream | null) => void = () => {}
  public onRemoteVideoState: (on: boolean) => void = () => {}
  public onLocalAudio: (stream: MediaStream | null) => void = () => {}
  public onRemoteAudioStream: (stream: MediaStream | null) => void = () => {}
  public onRemoteAudioState: (on: boolean) => void = () => {}
  private localPeer: AirMidiPeer | null = null

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient
  }

  private log(level: AirMidiLogLevel, message: string) {
    this.onLog(level, message)
  }

  private updateStatus(newStatus: AirMidiStatus) {
    this.status = newStatus
    this.log(newStatus === 'connected' ? 'success' : 'info', `Status changed: ${newStatus}`)
    if (newStatus === 'connected') void this.billingStart()
    else if (newStatus === 'disconnected' || newStatus === 'idle') this.billingStop()
    this.onStatusChange(newStatus)
  }

  /* ------------------------------------------------------------------ */
  /* BILLING (sender only: the hours wallet)                             */
  /* ------------------------------------------------------------------ */
  // result of the start / heartbeat / end functions: { free, balance, limit?, remaining? }
  private handleBilling(r: any) {
    if (typeof r === 'number') {
      this.handleBalance(r)
      return
    }
    if (!r || typeof r !== 'object') return

    if (r.free) {
      const limit = Number(r.limit) || this.freeLimit
      const remaining = Math.max(0, Number(r.remaining) || 0)
      this.freeLimit = limit
      this.onBalance(0)
      this.onFreeTime(remaining, limit)
      this.armFreeTimer(remaining)
      if (remaining <= 60 && !this.freeWarned) {
        this.freeWarned = true
        this.log('warn', `Free session: ${remaining} seconds left.`)
        this.onLowHours(remaining)
      }
      return
    }

    this.clearFreeTimer()
    this.onFreeTime(null, 0)
    this.handleBalance(Number(r.balance))
  }

  // the server counts every 30 s; this timer ends the free session exactly on time
  private armFreeTimer(remaining: number) {
    this.clearFreeTimer()
    this.freeTimer = setTimeout(() => {
      if (this.status === 'connected' || this.status === 'reconnecting') {
        const mins = Math.max(1, Math.round(this.freeLimit / 60))
        this.log('warn', 'Free session limit reached. The session was closed.')
        this.disconnect()
        this.onError(`Your free ${mins}-minute session has ended. Buy hours to stream without a limit.`)
      }
    }, Math.max(0, remaining) * 1000)
  }

  private clearFreeTimer() {
    if (this.freeTimer) clearTimeout(this.freeTimer)
    this.freeTimer = null
  }

  private handleBalance(sec: number) {
    this.onBalance(sec)
    // smallest threshold the balance has fallen under; announce each one only once per session
    const th = LOW_HOURS_THRESHOLDS.filter((t) => sec <= t).sort((a, b) => a - b)[0]
    if (th !== undefined && th < this.lowAnnounced) {
      this.lowAnnounced = th
      this.log('warn', `Low hours: ${Math.floor(sec / 60)} minutes of streaming left.`)
      this.onLowHours(sec)
    }
    if (sec <= 0 && (this.status === 'connected' || this.status === 'reconnecting')) {
      this.log('error', 'No hours left. The session was closed.')
      this.disconnect()
      this.onError('Your hours have run out. Buy a plan to continue streaming.')
    }
  }

  private async billingTick(code: string) {
    const { data, error } = await this.supabase.rpc('airmidi_heartbeat', { p_room_code: code })
    if (error) {
      this.log('warn', `Hours heartbeat failed: ${error.message}`)
      return
    }
    this.handleBilling(data)
  }

  private async billingStart() {
    if (this.role !== 'sender' || !this.roomCode || this.billingActive) return
    this.billingActive = true
    this.lowAnnounced = Infinity
    this.freeWarned = false
    const code = this.roomCode

    const { data, error } = await this.supabase.rpc('airmidi_mark_connected', { p_room_code: code })
    if (error) {
      this.billingActive = false
      const msg = error.message || ''
      if (msg.includes('FREE_LIMIT')) {
        this.log('error', 'Free sessions for today are used up.')
        this.disconnect()
        this.onError('You have used all free sessions for today. Buy hours to keep streaming.')
      } else if (msg.includes('NO_HOURS')) {
        this.log('error', 'No hours left.')
        this.disconnect()
        this.onError('You have no hours left. Buy a plan to start streaming.')
      } else {
        this.log('warn', `Hours counter could not start: ${msg}`)
      }
      return
    }
    if (!this.billingActive) {
      // the session ended while the request was in flight
      void this.supabase.rpc('airmidi_end_session', { p_room_code: code })
      return
    }

    this.log('info', 'Hours counter started.')
    this.handleBilling(data)
    if (!this.billingActive) return // handleBilling may have closed the session
    this.heartbeatTimer = setInterval(() => void this.billingTick(code), 30000)

    if (typeof window !== 'undefined') {
      this.pageHideHandler = () => this.billingStop()
      window.addEventListener('pagehide', this.pageHideHandler)
    }
  }

  private billingStop() {
    this.clearFreeTimer()
    if (!this.billingActive) return
    this.billingActive = false
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
    this.heartbeatTimer = null
    if (this.pageHideHandler && typeof window !== 'undefined') {
      window.removeEventListener('pagehide', this.pageHideHandler)
    }
    this.pageHideHandler = null
    this.onFreeTime(null, 0)

    const code = this.roomCode
    if (!code) return
    void this.supabase.rpc('airmidi_end_session', { p_room_code: code }).then(({ data, error }) => {
      if (error) this.log('warn', `Hours counter could not be closed: ${error.message}`)
      else if (data && typeof data === 'object' && !data.free) this.onBalance(Number(data.balance))
    })
  }

  /* ------------------------------------------------------------------ */
  /* MIDI PANIC                                                          */
  /* ------------------------------------------------------------------ */
  // All Notes Off + All Sound Off + Sustain Off on all 16 channels, sent to the other side
  // and to every local MIDI output, so stuck notes stop on both ends.
  public panic() {
    const rel = this.dataChannel
    const open = !!rel && rel.readyState === 'open'
    for (let ch = 0; ch < 16; ch++) {
      for (const cc of [123, 120, 64]) {
        const msg = new Uint8Array([0xb0 | ch, cc, 0])
        this.forwardToMidiOutput(msg)
        if (open) {
          try {
            rel!.send(msg as any)
          } catch {
            /* ignore */
          }
        }
      }
    }
    // lets the UI release its keys and the sustain pedal
    this.onMidiActivity(new Uint8Array([0xb0, 123, 0]), 'out')
    this.onMidiActivity(new Uint8Array([0xb0, 64, 0]), 'out')
    this.log('warn', open ? 'MIDI panic: all notes off sent on all channels.' : 'MIDI panic: local outputs silenced (link is not open).')
  }

  /* ------------------------------------------------------------------ */
  /* AUTO-RECONNECT                                                      */
  /* ------------------------------------------------------------------ */
  // Receiver = the side that makes offers, so it drives the repair:
  //   attempts 1-2: ICE restart (fixes Wi-Fi <-> 4G switches), then a full rebuild of the connection.
  // The sender just waits and answers. Gives up after RECONNECT_TIMEOUT_MS.
  private onLinkTrouble(reason: string) {
    if (this.status === 'idle' || this.status === 'disconnected') return
    if (this.status !== 'connected' && this.status !== 'reconnecting') {
      // never got connected: same behaviour as before
      this.updateStatus('disconnected')
      return
    }
    if (this.status === 'connected') {
      this.reconnectDeadline = Date.now() + RECONNECT_TIMEOUT_MS
      this.reconnectAttempts = 0
      this.log('warn', `Link lost (${reason}). Reconnecting...`)
      this.stopMidiTimers()
      this.updateStatus('reconnecting')
      if (typeof window !== 'undefined' && !this.onlineHandler) {
        this.onlineHandler = () => {
          this.log('info', 'Network is back.')
          this.scheduleReconnect(0)
        }
        window.addEventListener('online', this.onlineHandler)
      }
    }
    this.scheduleReconnect(this.reconnectAttempts === 0 ? 500 : 6000)
  }

  private scheduleReconnect(delay: number) {
    if (this.status !== 'reconnecting') return
    if (this.retryTimer) {
      if (delay > 0) return // a retry is already queued
      clearTimeout(this.retryTimer)
    }
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null
      void this.reconnectStep()
    }, delay)
  }

  private async reconnectStep() {
    if (this.status !== 'reconnecting') return
    if (Date.now() > this.reconnectDeadline) {
      this.log('error', 'Could not restore the connection.')
      this.resetReconnectState()
      this.updateStatus('disconnected')
      return
    }
    this.reconnectAttempts++
    if (this.role === 'receiver') {
      try {
        if (this.reconnectAttempts <= 2) await this.restartIce()
        else await this.rebuildAsReceiver()
      } catch (err: any) {
        this.log('warn', `Reconnect attempt ${this.reconnectAttempts} failed: ${err?.message || err}`)
      }
    } else if (this.reconnectAttempts === 1) {
      this.log('info', 'Waiting for the other side to reconnect...')
    }
    this.scheduleReconnect(this.reconnectAttempts < 2 ? 6000 : 12000)
  }

  private async restartIce() {
    const pc = this.peerConnection
    if (!pc || (pc.signalingState !== 'stable' && pc.signalingState !== 'have-local-offer')) {
      throw new Error('connection is not ready for an ICE restart')
    }
    this.log('info', 'Restarting ICE...')
    pc.restartIce()
    const offer = await pc.createOffer({ iceRestart: true })
    await pc.setLocalDescription(offer)
    this.sendSignal({ sdp: pc.localDescription, peer: this.localPeer, restart: true })
  }

  private async rebuildAsReceiver() {
    this.log('info', 'Rebuilding the connection...')
    this.teardownPeer()
    await this.initPeerConnection()
    this.createReceiverChannels()
    const offer = await this.peerConnection!.createOffer()
    await this.peerConnection!.setLocalDescription(offer)
    this.sendSignal({ sdp: this.peerConnection!.localDescription, peer: this.localPeer, rebuild: true })
  }

  private async rebuildAsSender() {
    this.rebuilding = true
    this.log('info', 'The other side is rebuilding the connection...')
    try {
      this.teardownPeer()
      await this.initPeerConnection()
      this.attachSenderChannelHandler()
    } finally {
      this.rebuilding = false
    }
  }

  // closes the peer connection and its channels without touching the signaling channel or the status
  private teardownPeer() {
    this.stopMidiTimers()
    for (const ch of [this.dataChannel, this.fastChannel]) {
      if (!ch) continue
      ch.onopen = null
      ch.onclose = null
      ch.onmessage = null
      try {
        ch.close()
      } catch {
        /* ignore */
      }
    }
    const pc = this.peerConnection
    if (pc) {
      pc.onconnectionstatechange = null
      pc.oniceconnectionstatechange = null
      pc.onicecandidate = null
      pc.onicegatheringstatechange = null
      pc.ontrack = null
      pc.ondatachannel = null
      try {
        pc.close()
      } catch {
        /* ignore */
      }
    }
    this.dataChannel = null
    this.fastChannel = null
    this.peerConnection = null
    this.videoTransceiver = null
    this.audioTransceiver = null
    this.hasRemoteDescription = false
    this.settle.clear()
  }

  // sender: the receiver creates the data channels, the sender receives them
  private attachSenderChannelHandler() {
    this.peerConnection!.ondatachannel = (event) => {
      const ch = event.channel
      this.log('info', `Data channel received from peer (${ch.label}).`)
      if (ch.label === 'midi-fast') {
        this.fastChannel = ch
        this.setupDataChannelHandlers(ch, 'fast')
      } else {
        this.dataChannel = ch
        this.setupDataChannelHandlers(ch, 'reliable')
      }
    }
  }

  // receiver: data channels + the media lines negotiated up front
  private createReceiverChannels() {
    // Reliable and ordered channel: no lost note-off messages
    // (priority is a hint that not every browser supports; unknown fields are ignored)
    this.dataChannel = this.peerConnection!.createDataChannel('midi-data', {
      ordered: true,
      priority: 'high',
    } as RTCDataChannelInit)
    this.setupDataChannelHandlers(this.dataChannel, 'reliable')

    // Fast lane: unordered, no retransmits. Stale controller values are never worth waiting for.
    this.fastChannel = this.peerConnection!.createDataChannel('midi-fast', {
      ordered: false,
      maxRetransmits: 0,
      priority: 'high',
    } as RTCDataChannelInit)
    this.setupDataChannelHandlers(this.fastChannel, 'fast')

    // Video + audio m-lines negotiated once. Camera / mic are attached later with replaceTrack().
    this.videoTransceiver = this.peerConnection!.addTransceiver('video', { direction: 'sendrecv' })
    this.audioTransceiver = this.peerConnection!.addTransceiver('audio', { direction: 'sendrecv' })
  }

  private onTransportRecovered() {
    if (this.graceTimer) clearTimeout(this.graceTimer)
    this.graceTimer = null
    if (this.status !== 'reconnecting') return
    const ch = this.dataChannel
    if (ch && ch.readyState === 'open') {
      this.log('success', 'Connection restored.')
      this.resetReconnectState()
      this.updateStatus('connected')
      this.startMidiTimers()
      void this.restoreMedia()
    }
  }

  private resetReconnectState() {
    if (this.graceTimer) clearTimeout(this.graceTimer)
    if (this.retryTimer) clearTimeout(this.retryTimer)
    this.graceTimer = null
    this.retryTimer = null
    this.reconnectAttempts = 0
    this.reconnectDeadline = 0
    if (this.onlineHandler && typeof window !== 'undefined') {
      window.removeEventListener('online', this.onlineHandler)
    }
    this.onlineHandler = null
  }

  // the other side ended the session on purpose: no reconnect attempts
  private onPeerBye() {
    if (this.status === 'idle' || this.status === 'disconnected') return
    this.log('warn', 'The other side ended the session.')
    this.resetReconnectState()
    this.stopMidiTimers()
    this.updateStatus('disconnected')
  }

  // after a rebuilt connection the camera / microphone tracks are attached again
  private async restoreMedia() {
    try {
      if (this.localStream && this.videoTransceiver) {
        const track = this.localStream.getVideoTracks()[0]
        if (track && track.readyState === 'live') {
          await this.videoTransceiver.sender.replaceTrack(track)
          await this.applyVideoParams(this.videoBitrate)
          this.sendControl({ video: true })
        }
      }
      if (this.micStream && this.audioTransceiver) {
        const track = this.micStream.getAudioTracks()[0]
        if (track && track.readyState === 'live') {
          await this.audioTransceiver.sender.replaceTrack(track)
          this.sendControl({ audio: true })
        }
      }
    } catch {
      this.log('warn', 'Could not restore the camera / microphone after reconnecting.')
    }
  }

  /* ------------------------------------------------------------------ */
  /* AUTH                                                                */
  /* ------------------------------------------------------------------ */
  // Blocks every action if the user is not signed in
  private async requireUser() {
    const {
      data: { user },
      error,
    } = await this.supabase.auth.getUser()
    if (error || !user) {
      throw new Error('You must be signed in to use AirMIDI Link.')
    }
    return user
  }

  /* ------------------------------------------------------------------ */
  /* CONNECT TIMEOUT                                                     */
  /* ------------------------------------------------------------------ */
  private startConnectTimer(ms = 15000) {
    this.clearConnectTimer()
    this.connectTimer = setTimeout(() => {
      if (this.status !== 'connected' && this.status !== 'idle') {
        const hasTurn = this.hasTurn
        this.log('error', `Connection timed out after ${Math.round(ms / 1000)} seconds.`)
        const waiting = this.waitingApproval
        this.disconnect()
        this.onError(
          waiting
            ? 'The sender did not respond to your join request.'
            : hasTurn
            ? 'Could not establish the connection. Check the code and make sure the sender is still active.'
            : 'Direct connection failed (mobile network or strict NAT). A TURN server is required.'
        )
      }
    }, ms)
  }

  private clearConnectTimer() {
    if (this.connectTimer) clearTimeout(this.connectTimer)
    this.connectTimer = null
  }

  /* ------------------------------------------------------------------ */
  /* HARDWARE MIDI                                                       */
  /* ------------------------------------------------------------------ */
  private async ensureMidiAccess(): Promise<MIDIAccess> {
    if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) {
      throw new Error('This browser does not support Web MIDI. Use Chrome, Edge or Opera.')
    }
    if (!this.midiAccess) {
      try {
        this.midiAccess = await navigator.requestMIDIAccess({ sysex: true })
        this.sysexEnabled = true
        this.log('success', 'MIDI access granted (SysEx enabled).')
      } catch {
        // SysEx prompt refused: fall back to normal MIDI so notes and controllers still pass
        this.midiAccess = await navigator.requestMIDIAccess()
        this.sysexEnabled = false
        this.log('warn', 'SysEx permission was not granted. Notes and controllers still pass, but SysEx messages are blocked.')
      }
      this.onSysexState(this.sysexEnabled)
      // React live to adapters being plugged in / removed
      this.midiAccess.onstatechange = () => {
        if (this.status === 'connected') this.bindMidiPorts()
        else this.onDevicesChange(this.getInputNames())
      }
    }
    return this.midiAccess
  }

  private getInputNames(): string[] {
    const names: string[] = []
    this.midiAccess?.inputs.forEach((input) => {
      names.push(input.name || 'Unknown MIDI device')
    })
    return names
  }

  private getOutputNames(): string[] {
    const names: string[] = []
    this.midiAccess?.outputs.forEach((output) => {
      names.push(output.name || 'Unknown MIDI output')
    })
    return names
  }

  private bindMidiPorts() {
    if (!this.midiAccess) return

    if (this.role === 'sender') {
      this.midiAccess.inputs.forEach((input) => {
        input.onmidimessage = (event: MIDIMessageEvent) => {
          if (event.data) {
            this.sendMidi(event.data)
            this.onMidiActivity(event.data, 'out')
          }
        }
      })
      const names = this.getInputNames()
      this.log(names.length ? 'info' : 'warn', names.length ? `Input devices: ${names.join(', ')}` : 'No MIDI input devices found.')
      this.onDevicesChange(names)
    } else {
      const names = this.getOutputNames()
      this.log(names.length ? 'info' : 'warn', names.length ? `Output devices: ${names.join(', ')}` : 'No MIDI output devices found. Incoming MIDI cannot be played on this device.')
      this.onDevicesChange(names)
    }
  }

  private async initHardwareMidi() {
    try {
      await this.ensureMidiAccess()
      this.bindMidiPorts()
    } catch (err: any) {
      this.log('warn', err?.message || 'Could not access MIDI hardware.')
    }
  }

  // Receiver: forward incoming messages to every available MIDI output
  private forwardToMidiOutput(data: Uint8Array) {
    if (!this.midiAccess) return
    this.midiAccess.outputs.forEach((o) => {
      try {
        o.send(data)
      } catch (err: any) {
        if (!this.outputErrorLogged) {
          this.outputErrorLogged = true
          this.log('warn', `Could not send to MIDI output "${o.name}": ${err?.message || err}`)
        }
      }
    })
  }

  /**
   * STEP 2 (after sign-in): look for connected USB MIDI adapters.
   */
  public async scanInputs(): Promise<string[]> {
    await this.requireUser()
    this.log('info', 'Scanning for USB MIDI adapters...')
    await this.ensureMidiAccess()
    const names = this.getInputNames()
    this.log(
      names.length ? 'success' : 'warn',
      names.length ? `Found ${names.length} adapter(s): ${names.join(', ')}` : 'No adapters found.'
    )
    return names
  }

  /* ------------------------------------------------------------------ */
  /* WEBRTC                                                              */
  /* ------------------------------------------------------------------ */
  // Loads STUN + short-lived TURN credentials from our own /api/turn route
  private async loadIceServers(): Promise<RTCIceServer[]> {
    const servers: RTCIceServer[] = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ]
    this.hasTurn = false

    const isTurn = (s: RTCIceServer) =>
      (Array.isArray(s.urls) ? s.urls : [s.urls]).some((u) => String(u).startsWith('turn'))

    // 1) credentials minted by the server (Cloudflare Realtime TURN)
    try {
      const {
        data: { session },
      } = await this.supabase.auth.getSession()
      const res = await fetch('/api/turn', {
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
        cache: 'no-store',
      })
      const json = await res.json().catch(() => ({}))
      const list: RTCIceServer[] = Array.isArray(json.iceServers) ? json.iceServers : []
      if (res.ok && list.length > 0) {
        servers.push(...list)
        this.hasTurn = list.some(isTurn)
        this.log(this.hasTurn ? 'success' : 'warn', this.hasTurn ? 'TURN relay credentials loaded.' : 'Server returned no TURN servers.')
      } else {
        this.log('warn', json.message || 'Could not load TURN credentials from the server.')
      }
    } catch {
      this.log('warn', 'TURN credentials request failed.')
    }

    // 2) optional static fallback from env
    const turnUrls = process.env.NEXT_PUBLIC_TURN_URLS
    if (!this.hasTurn && turnUrls) {
      servers.push({
        urls: turnUrls.split(',').map((u) => u.trim()),
        username: process.env.NEXT_PUBLIC_TURN_USERNAME,
        credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
      })
      this.hasTurn = true
      this.log('info', 'Using static TURN relay from environment.')
    }

    if (!this.hasTurn) {
      this.log('warn', 'No TURN relay available. Connections across mobile networks (4G/5G) will fail.')
    }
    return servers
  }

  private async initPeerConnection() {
    this.pendingIce = []
    this.hasRemoteDescription = false
    this.relaySeen = false

    const iceServers = await this.loadIceServers()
    this.peerConnection = new RTCPeerConnection({ iceServers })

    // Remote video track (the track stays silent until the other side starts a camera)
    this.peerConnection.ontrack = (event) => {
      if (event.track.kind === 'video') {
        this.remoteStream = new MediaStream([event.track])
        this.log('info', 'Remote video channel ready.')
        this.onRemoteStream(this.remoteStream)
      } else if (event.track.kind === 'audio') {
        this.remoteAudioStream = new MediaStream([event.track])
        this.log('info', 'Remote audio channel ready.')
        this.onRemoteAudioStream(this.remoteAudioStream)
      }
    }

    this.peerConnection.onicegatheringstatechange = () => {
      const st = this.peerConnection?.iceGatheringState
      this.log('info', `ICE gathering: ${st}`)
      if (st === 'complete' && this.hasTurn && !this.relaySeen) {
        this.log('error', 'No relay candidate was gathered. TURN credentials may be invalid or blocked by the network.')
      }
    }

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate?.type === 'relay' && !this.relaySeen) {
        this.relaySeen = true
        this.log('success', 'TURN relay candidate gathered.')
      }
      if (event.candidate && this.channel) {
        this.channel.send({
          type: 'broadcast',
          event: 'airmidi-signal',
          payload: {
            ice: event.candidate.toJSON(),
            from: this.clientId,
            ...(this.peerId ? { to: this.peerId } : {}),
          },
        })
      }
    }

    this.peerConnection.oniceconnectionstatechange = () => {
      this.log('info', `ICE state: ${this.peerConnection?.iceConnectionState}`)
    }

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState
      this.log('info', `Peer connection state: ${state}`)
      if (state === 'connected') {
        this.onTransportRecovered()
        return
      }
      if (state === 'failed') {
        this.log('error', 'Peer connection failed. A TURN server is probably required for this network.')
        this.onLinkTrouble('connection failed')
      } else if (state === 'disconnected') {
        // often a short blip (Wi-Fi roaming): give it a moment before acting
        if (this.graceTimer) clearTimeout(this.graceTimer)
        this.graceTimer = setTimeout(() => {
          if (this.peerConnection?.connectionState === 'disconnected') this.onLinkTrouble('connection lost')
        }, DISCONNECT_GRACE_MS)
      } else if (state === 'closed') {
        this.onLinkTrouble('connection closed')
      }
    }
  }

  private setupDataChannelHandlers(ch: RTCDataChannel, kind: 'reliable' | 'fast') {
    ch.binaryType = 'arraybuffer'

    ch.onopen = () => {
      if (kind === 'fast') {
        this.log('success', 'Fast MIDI lane open (controllers, pitch bend, clock).')
        return
      }
      this.clearConnectTimer()
      this.log('success', 'Data channel open. MIDI link established.')
      this.resetReconnectState()
      this.updateStatus('connected')
      this.initHardwareMidi()
      this.startMidiTimers()
      void this.restoreMedia()
      setTimeout(() => this.detectPath(), 800)
    }
    ch.onclose = () => {
      if (kind === 'fast') {
        this.log('warn', 'Fast MIDI lane closed.')
        return
      }
      this.log('warn', 'Data channel closed.')
      this.stopMidiTimers()
      this.onLinkTrouble('data channel closed')
    }
    ch.onmessage = (event) => this.handleIncoming(event.data)
  }

  // Incoming: MIDI goes to the output first, everything else (UI, callbacks) comes after
  private handleIncoming(raw: unknown) {
    if (typeof raw === 'string') {
      this.handleText(raw)
      return
    }
    const data = new Uint8Array(raw as ArrayBuffer)
    this.forwardToMidiOutput(data)
    this.onMidiActivity(data, 'in')
    this.onMidiMessageReceived(data)
  }

  /* ------------------------------------------------------------------ */
  /* MIDI PRIORITY: fast lane, settle, latency probe, path               */
  /* ------------------------------------------------------------------ */
  private isFastMessage(d: Uint8Array): boolean {
    const s = d[0]
    if (s === 0xf8 || s === 0xfe) return true // clock, active sensing
    if (s >= 0xf0) return false // SysEx, transport, system common: always reliable
    const type = s & 0xf0
    if (type === 0xe0 || type === 0xd0 || type === 0xa0) return true // pitch bend, pressure, poly aftertouch
    if (type === 0xb0) return !DISCRETE_CC.has(d[1]) // continuous controllers only
    return false // notes, program change: always reliable
  }

  // The last value of a fast-lane message is re-sent reliably once the movement stops,
  // so a dropped packet can never leave a controller at the wrong value.
  private scheduleSettle(d: Uint8Array) {
    const s = d[0]
    if (s >= 0xf0) return
    const type = s & 0xf0
    const key = type === 0xb0 || type === 0xa0 ? (s << 8) | d[1] : s << 8
    this.settle.set(key, { data: d.slice(), at: performance.now() })
  }

  private flushSettle() {
    const rel = this.dataChannel
    if (!rel || rel.readyState !== 'open' || this.settle.size === 0) return
    const now = performance.now()
    this.settle.forEach((v, key) => {
      if (now - v.at >= 80) {
        this.settle.delete(key)
        try {
          rel.send(v.data as any)
        } catch {
          /* ignore */
        }
      }
    })
  }

  private startMidiTimers() {
    this.stopMidiTimers()
    this.midiTimers.push(setInterval(() => this.flushSettle(), 40))
    this.midiTimers.push(setInterval(() => this.sendText(JSON.stringify({ t: 'ping', ts: performance.now() })), 1000))
  }

  private stopMidiTimers() {
    this.midiTimers.forEach(clearInterval)
    this.midiTimers = []
  }

  private sendText(str: string) {
    const ch = this.fastChannel && this.fastChannel.readyState === 'open' ? this.fastChannel : this.dataChannel
    if (ch && ch.readyState === 'open') {
      try {
        ch.send(str)
      } catch {
        /* ignore */
      }
    }
  }

  private handleText(raw: string) {
    let msg: any
    try {
      msg = JSON.parse(raw)
    } catch {
      return
    }
    if (msg?.t === 'ping' && typeof msg.ts === 'number') {
      this.sendText(JSON.stringify({ t: 'pong', ts: msg.ts }))
    } else if (msg?.t === 'pong' && typeof msg.ts === 'number') {
      const rtt = performance.now() - msg.ts
      if (rtt >= 0 && rtt < 5000) this.updateLatency(rtt)
    } else if (msg?.t === 'bye') {
      this.onPeerBye()
    }
  }

  private updateLatency(rtt: number) {
    this.rttEma = this.rttEma ? this.rttEma * 0.7 + rtt * 0.3 : rtt
    this.rttSamples.push(rtt)
    if (this.rttSamples.length > 120) this.rttSamples.shift()
    const base = Math.min(...this.rttSamples)
    this.onLatency(Math.round(this.rttEma))
    this.protectMidi(this.rttEma - base)
  }

  // If the extra delay (above the best RTT seen) grows while the camera is on,
  // the video is what is filling the line: shrink it so MIDI keeps its low latency.
  private protectMidi(queueDelay: number) {
    if (!this.localStream) {
      this.congestionHits = 0
      this.calmHits = 0
      return
    }
    if (!this.throttled) {
      if (queueDelay > 60) {
        if (++this.congestionHits >= 3) void this.setThrottle(true)
      } else this.congestionHits = 0
    } else if (queueDelay < 25) {
      if (++this.calmHits >= 10) void this.setThrottle(false)
    } else this.calmHits = 0
  }

  private async setThrottle(on: boolean) {
    this.throttled = on
    this.congestionHits = 0
    this.calmHits = 0
    await this.applyVideoParams(this.videoBitrate)
    this.log(
      on ? 'warn' : 'info',
      on ? 'Network is congested: video was reduced to protect MIDI latency.' : 'Network is calm again: video quality restored.'
    )
    this.onVideoThrottle(on)
  }

  private async applyVideoParams(bitrate: number) {
    this.videoBitrate = bitrate
    const sender = this.videoTransceiver?.sender
    if (!sender) return
    try {
      const params = sender.getParameters()
      if (!params.encodings || params.encodings.length === 0) params.encodings = [{}]
      const enc: any = params.encodings[0]
      enc.maxBitrate = this.throttled ? Math.min(bitrate, 150_000) : bitrate
      enc.scaleResolutionDownBy = this.throttled ? 2 : 1
      await sender.setParameters(params)
    } catch {
      this.log('warn', 'Could not apply the video bitrate limit.')
    }
    // video yields to MIDI: lowest network priority (a hint, not every browser honours it)
    try {
      const params = sender.getParameters()
      if (params.encodings?.length) {
        const enc: any = params.encodings[0]
        enc.networkPriority = 'low'
        enc.priority = 'low'
        await sender.setParameters(params)
      }
    } catch {
      /* unsupported */
    }
  }

  private async detectPath() {
    const pc = this.peerConnection
    if (!pc) return
    try {
      const stats = await pc.getStats()
      let pairId: string | undefined
      stats.forEach((r: any) => {
        if (r.type === 'transport' && r.selectedCandidatePairId) pairId = r.selectedCandidatePairId
      })
      let pair: any
      stats.forEach((r: any) => {
        if (r.type === 'candidate-pair' && (r.id === pairId || (!pairId && r.nominated && r.state === 'succeeded'))) pair = r
      })
      if (!pair) return
      const local: any = stats.get(pair.localCandidateId)
      const remote: any = stats.get(pair.remoteCandidateId)
      const relay = local?.candidateType === 'relay' || remote?.candidateType === 'relay'
      this.log('info', `Network path: ${relay ? 'relayed through TURN (adds latency)' : 'direct peer-to-peer'}`)
      this.onPathInfo(relay ? 'relay' : 'direct')
    } catch {
      /* stats unavailable */
    }
  }

  // Data from the other user is untrusted: validate and trim it
  private handlePeerInfo(raw: any): AirMidiPeer | null {
    if (!raw || typeof raw !== 'object') return null
    const avatar =
      typeof raw.avatar === 'string' && raw.avatar.startsWith('https://') && raw.avatar.length < 500
        ? raw.avatar
        : undefined
    const peer: AirMidiPeer = {
      name: String(raw.name ?? 'User').slice(0, 60),
      email: String(raw.email ?? '').slice(0, 80),
      avatar,
      role: raw.role === 'sender' ? 'sender' : 'receiver',
    }
    this.log('info', `Peer identified: ${peer.name}`)
    this.onPeerInfo(peer)
    return peer
  }

  private async flushPendingIce() {
    if (!this.peerConnection) return
    const list =
      this.role === 'sender' && this.peerId ? this.pendingIce.filter((c) => c.from === this.peerId) : this.pendingIce
    for (const c of list) {
      try {
        await this.peerConnection.addIceCandidate(c.ice)
      } catch (e) {
        this.log('warn', 'An ICE candidate was ignored.')
      }
    }
    this.pendingIce = []
  }

  private setupSignalingChannel(code: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.channel = this.supabase.channel(`airmidi:${code}`, {
        config: { broadcast: { self: false } },
      })

      this.channel
        .on('broadcast', { event: 'airmidi-signal' }, async ({ payload }) => {
          if (!payload) return
          // addressed to another client? ignore
          if (payload.to && payload.to !== this.clientId) return
          const from = String(payload.from || 'unknown')
          if (!this.peerConnection) {
            // while the sender rebuilds its connection, early ICE candidates are kept
            if (this.rebuilding && payload.ice) this.pendingIce.push({ from, ice: payload.ice })
            return
          }

          try {
            // ---- receiver: answers to its join request ----
            if (this.role === 'receiver') {
              if (payload.reject) {
                this.log('warn', 'The sender declined the join request.')
                this.disconnect()
                this.onError('The sender declined your request to join.')
                return
              }
              if (payload.pending) {
                this.waitingApproval = true
                this.log('info', 'Waiting for the sender to approve...')
                this.onWaitingApproval()
                this.startConnectTimer(60000)
                return
              }
            }

            // ---- sender: only talk to the first client that asks to join ----
            if (this.role === 'sender') {
              if (payload.sdp?.type === 'offer') {
                if (this.peerId && from !== this.peerId) {
                  this.log('warn', 'Ignored a join request from another client.')
                  return
                }
                if (!this.peerId) this.peerId = from
              } else if (this.peerId && from !== this.peerId) {
                return
              }
            }

            const peer = payload.peer ? this.handlePeerInfo(payload.peer) : null

            if (payload.sdp) {
              this.log('info', `Received ${payload.sdp.type} from peer.`)

              // sender: hold the offer until the user accepts
              if (payload.sdp.type === 'offer' && this.role === 'sender' && !this.approved) {
                this.pendingOffer = payload.sdp
                this.sendSignal({ pending: true })
                this.log('warn', `Join request from ${peer?.name || 'an unknown user'}. Waiting for approval.`)
                this.onJoinRequest(peer || { name: 'Unknown user', email: '', role: 'receiver' })
                return
              }
              if (payload.sdp.type === 'offer' && this.role === 'sender' && payload.rebuild) {
                await this.rebuildAsSender()
              }
              await this.applyRemoteSdp(payload.sdp)
            } else if (payload.ice) {
              if (this.hasRemoteDescription) {
                await this.peerConnection.addIceCandidate(payload.ice)
              } else {
                this.pendingIce.push({ from, ice: payload.ice })
              }
            }
          } catch (err: any) {
            this.log('error', `Signaling error: ${err?.message || err}`)
          }
        })
        .on('broadcast', { event: 'airmidi-control' }, ({ payload }) => {
          if (!payload) return
          if (payload.to && payload.to !== this.clientId) return
          if (this.role === 'sender' && this.peerId && payload.from !== this.peerId) return
          if (payload.bye === true) {
            this.onPeerBye()
            return
          }
          if (this.status !== 'connected') return
          if (typeof payload.video === 'boolean') {
            this.log('info', `Remote camera ${payload.video ? 'on' : 'off'}.`)
            this.onRemoteVideoState(payload.video)
          }
          if (typeof payload.audio === 'boolean') {
            this.log('info', `Remote microphone ${payload.audio ? 'on' : 'off'}.`)
            this.onRemoteAudioState(payload.audio)
          }
        })
        .subscribe((s) => {
          if (s === 'SUBSCRIBED') {
            this.log('info', 'Signaling channel ready.')
            resolve()
          }
          if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') {
            this.log('error', `Signaling channel error: ${s}`)
            reject(new Error('Could not connect to the signaling channel.'))
          }
        })
    })
  }

  /* ------------------------------------------------------------------ */
  /* SENDER                                                              */
  /* ------------------------------------------------------------------ */
  async startBroadcasting(deviceInfo: any = {}): Promise<string> {
    // 1) signed in?  2) hours left?  3) USB MIDI adapter connected?  4) only then generate the code
    const user = await this.requireUser()

    // hours or a free session available? (if the billing functions are not installed, streaming stays open)
    const { data: acct, error: acctErr } = await this.supabase.rpc('airmidi_account_status')
    if (!acctErr && acct) {
      const bal = Number(acct.balance)
      this.onBalance(bal)
      if (bal <= 0) {
        const perDay = Number(acct.free_per_day)
        if (perDay <= 0) {
          throw new Error('You have no hours left. Buy a plan to start streaming.')
        }
        if (Number(acct.free_used_today) >= perDay) {
          throw new Error('You have used all free sessions for today. Buy hours to keep streaming.')
        }
      }
    }

    const inputs = await this.scanInputs()
    if (inputs.length === 0) {
      throw new Error('No USB MIDI adapter detected. Connect one and try again.')
    }

    this.role = 'sender'
    this.localPeer = peerFromUser(user, 'sender')
    this.updateStatus('initializing')

    const code = Math.floor(100000 + Math.random() * 900000).toString()
    this.roomCode = code

    const { error } = await this.supabase.from('airmidi_links').insert([
      {
        room_code: code,
        created_by: user.id,
        sender_device_info: deviceInfo,
        status: 'waiting',
      },
    ])
    if (error) throw new Error(error.message)
    this.log('success', `Room ${code} created (valid for 15 minutes).`)

    await this.initPeerConnection()

    // The receiver creates the data channel, the sender receives it
    this.attachSenderChannelHandler()

    await this.setupSignalingChannel(code)

    this.updateStatus('waiting')
    return code
  }

  /* ------------------------------------------------------------------ */
  /* RECEIVER                                                            */
  /* ------------------------------------------------------------------ */
  async connect(code: string, deviceInfo: any = {}): Promise<void> {
    const user = await this.requireUser()

    this.role = 'receiver'
    this.localPeer = peerFromUser(user, 'receiver')
    this.roomCode = code
    this.updateStatus('connecting')
    this.log('info', `Looking up room ${code}...`)

    const { data: session, error } = await this.supabase
      .from('airmidi_links')
      .select('*')
      .eq('room_code', code)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (error || !session) throw new Error('Invalid or expired AirMIDI Link code.')
    this.log('success', 'Room found.')

    await this.supabase
      .from('airmidi_links')
      .update({ status: 'connected', receiver_device_info: deviceInfo })
      .eq('room_code', code)

    await this.initPeerConnection()

    this.createReceiverChannels()

    await this.setupSignalingChannel(code)

    const offer = await this.peerConnection!.createOffer()
    await this.peerConnection!.setLocalDescription(offer)
    this.sendSignal({ sdp: this.peerConnection!.localDescription, peer: this.localPeer })
    this.log('info', 'Offer sent. Waiting for the sender to answer...')
    this.startConnectTimer()
  }

  /* ------------------------------------------------------------------ */
  /* SIGNALING HELPERS + JOIN APPROVAL                                   */
  /* ------------------------------------------------------------------ */
  private sendSignal(extra: Record<string, unknown>) {
    this.channel?.send({
      type: 'broadcast',
      event: 'airmidi-signal',
      payload: { from: this.clientId, ...(this.peerId ? { to: this.peerId } : {}), ...extra },
    })
  }

  private sendControl(extra: Record<string, unknown>) {
    this.channel?.send({
      type: 'broadcast',
      event: 'airmidi-control',
      payload: { from: this.clientId, ...(this.peerId ? { to: this.peerId } : {}), ...extra },
    })
  }

  private async applyRemoteSdp(sdp: RTCSessionDescriptionInit) {
    const pc = this.peerConnection
    if (!pc) return
    await pc.setRemoteDescription(sdp)
    this.hasRemoteDescription = true
    await this.flushPendingIce()

    if (sdp.type === 'offer' && this.role === 'sender') {
      // Make the negotiated video m-line send + receive, so our camera can start later without renegotiating
      for (const t of pc.getTransceivers()) {
        const kind = t.receiver.track?.kind
        if (kind === 'video') {
          t.direction = 'sendrecv'
          this.videoTransceiver = t
        } else if (kind === 'audio') {
          t.direction = 'sendrecv'
          this.audioTransceiver = t
        }
      }
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      this.sendSignal({ sdp: pc.localDescription, peer: this.localPeer })
      this.log('info', 'Answer sent to peer.')
    }
  }

  // Sender: accept the pending join request
  public async approveJoin() {
    if (this.role !== 'sender' || !this.pendingOffer) return
    const sdp = this.pendingOffer
    this.pendingOffer = null
    this.approved = true
    this.log('success', 'Join request accepted.')
    try {
      await this.applyRemoteSdp(sdp)
    } catch (err: any) {
      this.log('error', `Could not accept the request: ${err?.message || err}`)
    }
  }

  // Sender: decline the pending join request
  public rejectJoin() {
    if (this.role !== 'sender' || !this.pendingOffer) return
    this.sendSignal({ reject: true })
    this.pendingOffer = null
    const declined = this.peerId
    this.pendingIce = this.pendingIce.filter((c) => c.from !== declined)
    this.peerId = null
    this.log('warn', 'Join request declined.')
  }

  /* ------------------------------------------------------------------ */
  /* OPTIONAL VIDEO (bidirectional, no audio)                            */
  /* ------------------------------------------------------------------ */
  public get videoActive(): boolean {
    return !!this.localStream
  }

  private stopLocalTracks() {
    this.localStream?.getTracks().forEach((t) => {
      t.onended = null
      t.stop()
    })
    this.localStream = null
  }

  public async startVideo(quality: VideoQuality = '360p') {
    if (this.status !== 'connected' || !this.videoTransceiver) {
      throw new Error('Connect first, then start the camera.')
    }
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('This browser does not support camera access.')
    }

    const q =
      quality === '720p'
        ? { w: 1280, h: 720, bitrate: 1_500_000 }
        : { w: 640, h: 360, bitrate: 500_000 }

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: q.w },
          height: { ideal: q.h },
          frameRate: { ideal: 24, max: 30 },
          facingMode: 'user',
        },
        audio: false,
      })
    } catch (err: any) {
      const name = err?.name
      throw new Error(
        name === 'NotAllowedError' || name === 'SecurityError'
          ? 'Camera permission was denied.'
          : name === 'NotFoundError'
          ? 'No camera found on this device.'
          : 'Could not start the camera.'
      )
    }

    this.stopLocalTracks() // switching quality: release the previous camera stream
    this.localStream = stream
    const track = stream.getVideoTracks()[0]
    track.onended = () => {
      this.log('warn', 'Camera stopped by the system.')
      this.stopVideo()
    }

    await this.videoTransceiver.sender.replaceTrack(track)

    // cap the bitrate (and give video the lowest priority) so MIDI always wins
    await this.applyVideoParams(q.bitrate)

    this.sendControl({ video: true })
    this.log('success', `Camera started (${quality}).`)
    this.onLocalVideo(stream)
  }

  public async stopVideo() {
    if (!this.localStream) return
    this.stopLocalTracks()
    try {
      await this.videoTransceiver?.sender.replaceTrack(null)
    } catch {
      /* ignore */
    }
    this.sendControl({ video: false })
    this.log('info', 'Camera stopped.')
    this.onLocalVideo(null)
  }

  /* ------------------------------------------------------------------ */
  /* OPTIONAL MICROPHONE (bidirectional)                                 */
  /* ------------------------------------------------------------------ */
  public get audioActive(): boolean {
    return !!this.micStream
  }

  private stopMicTracks() {
    this.micStream?.getTracks().forEach((t) => {
      t.onended = null
      t.stop()
    })
    this.micStream = null
  }

  public async startAudio() {
    if (this.status !== 'connected' || !this.audioTransceiver) {
      throw new Error('Connect first, then start the microphone.')
    }
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('This browser does not support microphone access.')
    }

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
        video: false,
      })
    } catch (err: any) {
      const name = err?.name
      throw new Error(
        name === 'NotAllowedError' || name === 'SecurityError'
          ? 'Microphone permission was denied.'
          : name === 'NotFoundError'
          ? 'No microphone found on this device.'
          : 'Could not start the microphone.'
      )
    }

    this.stopMicTracks()
    this.micStream = stream
    const track = stream.getAudioTracks()[0]
    track.onended = () => {
      this.log('warn', 'Microphone stopped by the system.')
      this.stopAudio()
    }

    await this.audioTransceiver.sender.replaceTrack(track)

    try {
      const sender = this.audioTransceiver.sender
      const params = sender.getParameters()
      if (!params.encodings || params.encodings.length === 0) params.encodings = [{}]
      params.encodings[0].maxBitrate = 40_000 // voice-quality Opus, very cheap
      await sender.setParameters(params)
    } catch {
      this.log('warn', 'Could not apply the audio bitrate limit.')
    }
    try {
      const sender = this.audioTransceiver.sender
      const params = sender.getParameters()
      if (params.encodings?.length) {
        const enc: any = params.encodings[0]
        enc.networkPriority = 'medium'
        enc.priority = 'medium'
        await sender.setParameters(params)
      }
    } catch {
      /* unsupported */
    }

    this.sendControl({ audio: true })
    this.log('success', 'Microphone started.')
    this.onLocalAudio(stream)
  }

  public async stopAudio() {
    if (!this.micStream) return
    this.stopMicTracks()
    try {
      await this.audioTransceiver?.sender.replaceTrack(null)
    } catch {
      /* ignore */
    }
    this.sendControl({ audio: false })
    this.log('info', 'Microphone stopped.')
    this.onLocalAudio(null)
  }

  /* ------------------------------------------------------------------ */
  public sendMidi(midiMessage: Uint8Array) {
    const rel = this.dataChannel
    if (!rel || rel.readyState !== 'open') return

    // fast lane: controllers, pitch bend, clock. Under congestion, stale values are dropped
    // instead of queued, so they can never add latency to the notes.
    const fast = this.fastChannel
    if (fast && fast.readyState === 'open' && this.isFastMessage(midiMessage)) {
      if (fast.bufferedAmount < 2048) fast.send(midiMessage as any)
      this.scheduleSettle(midiMessage)
      return
    }

    // reliable lane: notes, program change, SysEx, transport
    if (midiMessage.length > 1024) {
      const max = this.peerConnection?.sctp?.maxMessageSize
      if (max && midiMessage.length > max) {
        this.log('error', `MIDI message too large to send (${midiMessage.length} bytes, limit ${max}).`)
        return
      }
    }
    rel.send(midiMessage as any)
  }

  public disconnect() {
    // tell the other side this is on purpose, so it does not try to reconnect
    if (this.status === 'connected' || this.status === 'reconnecting') {
      this.sendText(JSON.stringify({ t: 'bye' }))
      this.sendControl({ bye: true })
    }
    this.billingStop() // before anything else is cleared: it needs the room code
    this.resetReconnectState()
    this.rebuilding = false
    this.clearConnectTimer()

    // Remove handlers so a voluntary reset does not trigger "disconnected"
    if (this.dataChannel) {
      this.dataChannel.onopen = null
      this.dataChannel.onclose = null
      this.dataChannel.onmessage = null
      this.dataChannel.close()
    }
    this.stopMidiTimers()
    if (this.fastChannel) {
      this.fastChannel.onopen = null
      this.fastChannel.onclose = null
      this.fastChannel.onmessage = null
      this.fastChannel.close()
    }
    if (this.peerConnection) {
      this.peerConnection.onconnectionstatechange = null
      this.peerConnection.oniceconnectionstatechange = null
      this.peerConnection.onicecandidate = null
      this.peerConnection.close()
    }
    if (this.channel) this.supabase.removeChannel(this.channel)

    if (this.midiAccess) {
      this.midiAccess.inputs.forEach((i) => (i.onmidimessage = null))
      this.midiAccess.onstatechange = null
    }

    this.dataChannel = null
    this.fastChannel = null
    this.peerConnection = null
    this.channel = null
    this.midiAccess = null
    this.localPeer = null
    this.pendingIce = []
    this.hasRemoteDescription = false
    this.outputErrorLogged = false
    this.settle.clear()
    this.rttEma = 0
    this.rttSamples = []
    this.congestionHits = 0
    this.calmHits = 0
    this.throttled = false

    // video + join approval state
    this.stopLocalTracks()
    this.stopMicTracks()
    this.videoTransceiver = null
    this.audioTransceiver = null
    this.remoteAudioStream = null
    this.remoteStream = null
    this.peerId = null
    this.pendingOffer = null
    this.approved = false
    this.waitingApproval = false
    this.onLocalVideo(null)
    this.onRemoteStream(null)
    this.onRemoteVideoState(false)
    this.onLocalAudio(null)
    this.onRemoteAudioStream(null)
    this.onRemoteAudioState(false)

    this.updateStatus('idle')
  }
}