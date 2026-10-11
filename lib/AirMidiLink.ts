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

export class AirMidiLink {
  private supabase: SupabaseClient
  private peerConnection: RTCPeerConnection | null = null
  private channel: RealtimeChannel | null = null
  private dataChannel: RTCDataChannel | null = null
  private midiAccess: MIDIAccess | null = null
  private pendingIce: RTCIceCandidateInit[] = []
  private hasRemoteDescription = false
  private connectTimer: ReturnType<typeof setTimeout> | null = null

  public role: AirMidiRole | null = null
  public roomCode: string | null = null
  public status: AirMidiStatus = 'idle'

  public onStatusChange: (status: AirMidiStatus) => void = () => {}
  public onMidiMessageReceived: (data: Uint8Array) => void = () => {}
  public onMidiActivity: (data: Uint8Array, direction: MidiDirection) => void = () => {}
  public onDevicesChange: (names: string[]) => void = () => {}
  public onError: (message: string) => void = () => {}
  public onLog: (level: AirMidiLogLevel, message: string) => void = () => {}

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

  private startConnectTimer() {
    this.clearConnectTimer()
    this.connectTimer = setTimeout(() => {
      if (this.status !== 'connected' && this.status !== 'idle') {
        const hasTurn = !!process.env.NEXT_PUBLIC_TURN_URLS
        this.log('error', 'Connection timed out after 35 seconds.') // Transmitem timpul real în log
        this.disconnect()
        this.onError(
          hasTurn
            ? 'Could not establish the connection. Check the code and make sure the sender is still active.'
            : 'Direct connection failed (mobile network or strict NAT). A TURN server is required.'
        )
      }
    }, 35000)
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
  private initPeerConnection() {
    this.pendingIce = []
    this.hasRemoteDescription = false

    const iceServers: RTCIceServer[] = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ]

    // TURN: required for mobile data / different networks / strict NAT
    const turnUrls = process.env.NEXT_PUBLIC_TURN_URLS
    if (turnUrls) {
      iceServers.push({
        urls: turnUrls.split(',').map((u) => u.trim()),
        username: process.env.NEXT_PUBLIC_TURN_USERNAME,
        credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
      })
      this.log('info', 'TURN relay configured.')
    } else {
      this.log('warn', 'No TURN relay configured. Connections across mobile networks may fail.')
    }

    this.peerConnection = new RTCPeerConnection({ iceServers })

    this.peerConnection.onicecandidate = (event) => {
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
                  payload: { sdp: this.peerConnection.localDescription },
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

    this.initPeerConnection()

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
    await this.requireUser()

    this.role = 'receiver'
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

    this.initPeerConnection()

    // Reliable and ordered channel: no lost note-off messages
    this.dataChannel = this.peerConnection!.createDataChannel('midi-data', { ordered: true })
    this.setupDataChannelHandlers()

    await this.setupSignalingChannel(code)

    const offer = await this.peerConnection!.createOffer()
    await this.peerConnection!.setLocalDescription(offer)
    this.channel?.send({
      type: 'broadcast',
      event: 'airmidi-signal',
      payload: { sdp: this.peerConnection!.localDescription },
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
    this.pendingIce = []
    this.hasRemoteDescription = false
    this.updateStatus('idle')
  }
}