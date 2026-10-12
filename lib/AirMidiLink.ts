// lib/AirMidiLink.ts
import { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'

export type AirMidiRole = 'sender' | 'receiver'
export type AirMidiStatus =
  | 'idle'
  | 'initializing'
  | 'waiting'
  | 'connecting'
  | 'connected'
  | 'disconnected'
export type AirMidiLogLevel = 'info' | 'success' | 'warn' | 'error'
export type MidiDirection = 'in' | 'out'

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
  private pendingIce: RTCIceCandidateInit[] = []
  private hasRemoteDescription = false
  private connectTimer: ReturnType<typeof setTimeout> | null = null
  private hasTurn = false
  private relaySeen = false

  public role: AirMidiRole | null = null
  public roomCode: string | null = null
  public status: AirMidiStatus = 'idle'

  public onStatusChange: (status: AirMidiStatus) => void = () => {}
  public onMidiMessageReceived: (data: Uint8Array) => void = () => {}
  public onMidiActivity: (data: Uint8Array, direction: MidiDirection) => void = () => {}
  public onDevicesChange: (names: string[]) => void = () => {}
  public onError: (message: string) => void = () => {}
  public onLog: (level: AirMidiLogLevel, message: string) => void = () => {}
  public onPeerInfo: (peer: AirMidiPeer) => void = () => {}
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
    this.onStatusChange(newStatus)
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
  private startConnectTimer() {
    this.clearConnectTimer()
    this.connectTimer = setTimeout(() => {
      if (this.status !== 'connected' && this.status !== 'idle') {
        const hasTurn = this.hasTurn
        this.log('error', 'Connection timed out after 15 seconds.')
        this.disconnect()
        this.onError(
          hasTurn
            ? 'Could not establish the connection. Check the code and make sure the sender is still active.'
            : 'Direct connection failed (mobile network or strict NAT). A TURN server is required.'
        )
      }
    }, 15000)
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
      this.midiAccess = await navigator.requestMIDIAccess()
      this.log('info', 'MIDI access granted.')
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
    this.midiAccess.outputs.forEach((o) => o.send(data))
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
          payload: { ice: event.candidate.toJSON() },
        })
      }
    }

    this.peerConnection.oniceconnectionstatechange = () => {
      this.log('info', `ICE state: ${this.peerConnection?.iceConnectionState}`)
    }

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState
      this.log('info', `Peer connection state: ${state}`)
      if (state === 'failed') {
        this.log('error', 'Peer connection failed. A TURN server is probably required for this network.')
      }
      if (state === 'failed' || state === 'disconnected' || state === 'closed') {
        if (this.status !== 'idle') this.updateStatus('disconnected')
      }
    }
  }

  private setupDataChannelHandlers() {
    if (!this.dataChannel) return
    this.dataChannel.binaryType = 'arraybuffer'

    this.dataChannel.onopen = () => {
      this.clearConnectTimer()
      this.log('success', 'Data channel open. MIDI link established.')
      this.updateStatus('connected')
      this.initHardwareMidi()
    }
    this.dataChannel.onclose = () => {
      this.log('warn', 'Data channel closed.')
      if (this.status !== 'idle') this.updateStatus('disconnected')
    }
    this.dataChannel.onmessage = (event) => {
      const data = new Uint8Array(event.data as ArrayBuffer)
      this.forwardToMidiOutput(data)
      this.onMidiActivity(data, 'in')
      this.onMidiMessageReceived(data)
    }
  }

  // Data from the other user is untrusted: validate and trim it
  private handlePeerInfo(raw: any) {
    if (!raw || typeof raw !== 'object') return
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
  }

  private async flushPendingIce() {
    if (!this.peerConnection) return
    for (const c of this.pendingIce) {
      try {
        await this.peerConnection.addIceCandidate(c)
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
          if (!this.peerConnection) return
          try {
            if (payload.peer) this.handlePeerInfo(payload.peer)
            if (payload.sdp) {
              this.log('info', `Received ${payload.sdp.type} from peer.`)
              await this.peerConnection.setRemoteDescription(payload.sdp)
              this.hasRemoteDescription = true
              await this.flushPendingIce()

              if (payload.sdp.type === 'offer' && this.role === 'sender') {
                const answer = await this.peerConnection.createAnswer()
                await this.peerConnection.setLocalDescription(answer)
                this.channel?.send({
                  type: 'broadcast',
                  event: 'airmidi-signal',
                  payload: { sdp: this.peerConnection.localDescription, peer: this.localPeer },
                })
                this.log('info', 'Answer sent to peer.')
              }
            } else if (payload.ice) {
              if (this.hasRemoteDescription) {
                await this.peerConnection.addIceCandidate(payload.ice)
              } else {
                this.pendingIce.push(payload.ice)
              }
            }
          } catch (err: any) {
            this.log('error', `Signaling error: ${err?.message || err}`)
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
    // 1) signed in?  2) USB MIDI adapter connected?  3) only then generate the code
    const user = await this.requireUser()

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
    this.peerConnection!.ondatachannel = (event) => {
      this.log('info', 'Data channel received from peer.')
      this.dataChannel = event.channel
      this.setupDataChannelHandlers()
    }

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

    // Reliable and ordered channel: no lost note-off messages
    this.dataChannel = this.peerConnection!.createDataChannel('midi-data', { ordered: true })
    this.setupDataChannelHandlers()

    await this.setupSignalingChannel(code)

    const offer = await this.peerConnection!.createOffer()
    await this.peerConnection!.setLocalDescription(offer)
    this.channel?.send({
      type: 'broadcast',
      event: 'airmidi-signal',
      payload: { sdp: this.peerConnection!.localDescription, peer: this.localPeer },
    })
    this.log('info', 'Offer sent. Waiting for the sender to answer...')
    this.startConnectTimer()
  }

  /* ------------------------------------------------------------------ */
  public sendMidi(midiMessage: Uint8Array) {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(midiMessage as any)
    }
  }

  public disconnect() {
    this.clearConnectTimer()

    // Remove handlers so a voluntary reset does not trigger "disconnected"
    if (this.dataChannel) {
      this.dataChannel.onopen = null
      this.dataChannel.onclose = null
      this.dataChannel.onmessage = null
      this.dataChannel.close()
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
    this.peerConnection = null
    this.channel = null
    this.midiAccess = null
    this.localPeer = null
    this.pendingIce = []
    this.hasRemoteDescription = false
    this.updateStatus('idle')
  }
}