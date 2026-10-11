// lib/AirMidiLink.ts
import { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'

export type AirMidiRole = 'sender' | 'receiver'
export type AirMidiStatus = 'idle' | 'initializing' | 'waiting' | 'connecting' | 'connected' | 'disconnected'

export class AirMidiLink {
  private supabase: SupabaseClient
  private peerConnection: RTCPeerConnection | null = null
  private channel: RealtimeChannel | null = null
  private dataChannel: RTCDataChannel | null = null
  private midiAccess: MIDIAccess | null = null
  private pendingIce: RTCIceCandidateInit[] = []
  private hasRemoteDescription = false

  public role: AirMidiRole | null = null
  public roomCode: string | null = null
  public status: AirMidiStatus = 'idle'

  public onStatusChange: (status: AirMidiStatus) => void = () => {}
  public onMidiMessageReceived: (data: Uint8Array) => void = () => {}
  public onMidiActivity: () => void = () => {}
  public onDevicesChange: (names: string[]) => void = () => {}

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient
  }

  private updateStatus(newStatus: AirMidiStatus) {
    this.status = newStatus
    this.onStatusChange(newStatus)
  }

  // Blochează orice acțiune dacă utilizatorul nu e autentificat
  private async requireUser() {
    const {
      data: { user },
      error,
    } = await this.supabase.auth.getUser()
    if (error || !user) {
      throw new Error('Trebuie să fii autentificat pentru a folosi AirMIDI Link.')
    }
    return user
  }

  private async ensureMidiAccess(): Promise<MIDIAccess> {
    if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) {
      throw new Error('Browserul nu suportă Web MIDI. Folosește Chrome, Edge sau Opera.')
    }
    if (!this.midiAccess) {
      this.midiAccess = await navigator.requestMIDIAccess()
      // reacționează live la adaptoare conectate / deconectate
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
      names.push(input.name || 'Adaptor MIDI necunoscut')
    })
    return names
  }

  /**
   * PAS 2 (după login): caută adaptoarele USB MIDI conectate.
   */
  public async scanInputs(): Promise<string[]> {
    await this.requireUser()
    await this.ensureMidiAccess()
    return this.getInputNames()
  }

  /* ------------------------------------------------------------------ */
  /* HARDWARE MIDI                                                       */
  /* ------------------------------------------------------------------ */
  private bindMidiPorts() {
    if (!this.midiAccess) return

    if (this.role === 'sender') {
      const names: string[] = []
      this.midiAccess.inputs.forEach((input) => {
        names.push(input.name || 'Adaptor MIDI necunoscut')
        input.onmidimessage = (event: MIDIMessageEvent) => {
          if (event.data) {
            this.sendMidi(event.data)
            this.onMidiActivity()
          }
        }
      })
      this.onDevicesChange(names)
    } else {
      const names: string[] = []
      this.midiAccess.outputs.forEach((output) => {
        names.push(output.name || 'Ieșire MIDI necunoscută')
      })
      this.onDevicesChange(names)
    }
  }

  private async initHardwareMidi() {
    if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) {
      console.warn('Browserul nu suportă Web MIDI (folosește Chrome / Edge / Opera).')
      return
    }
    try {
      await this.ensureMidiAccess()
      this.bindMidiPorts()
    } catch (err) {
      console.error('Eroare acces MIDI hardware:', err)
    }
  }

  // Receiver: trimite mesajele primite la prima ieșire MIDI disponibilă
  private forwardToMidiOutput(data: Uint8Array) {
    if (!this.midiAccess) return
    const outputs = Array.from(this.midiAccess.outputs.values())
    if (outputs.length > 0) {
      outputs.forEach((o) => o.send(data))
    }
  }

  /* ------------------------------------------------------------------ */
  /* WEBRTC                                                              */
  /* ------------------------------------------------------------------ */
  private initPeerConnection() {
    this.pendingIce = []
    this.hasRemoteDescription = false

    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
      ],
    })

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.channel) {
        this.channel.send({
          type: 'broadcast',
          event: 'airmidi-signal',
          payload: { ice: event.candidate.toJSON() },
        })
      }
    }

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState
      if (state === 'failed' || state === 'disconnected' || state === 'closed') {
        if (this.status !== 'idle') this.updateStatus('disconnected')
      }
    }
  }

  private setupDataChannelHandlers() {
    if (!this.dataChannel) return
    this.dataChannel.binaryType = 'arraybuffer'

    this.dataChannel.onopen = () => {
      this.updateStatus('connected')
      this.initHardwareMidi()
    }
    this.dataChannel.onclose = () => {
      if (this.status !== 'idle') this.updateStatus('disconnected')
    }
    this.dataChannel.onmessage = (event) => {
      const data = new Uint8Array(event.data as ArrayBuffer)
      this.forwardToMidiOutput(data)
      this.onMidiActivity()
      this.onMidiMessageReceived(data)
    }
  }

  private async flushPendingIce() {
    if (!this.peerConnection) return
    for (const c of this.pendingIce) {
      try {
        await this.peerConnection.addIceCandidate(c)
      } catch (e) {
        console.warn('ICE candidate ignorat:', e)
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
              }
            } else if (payload.ice) {
              if (this.hasRemoteDescription) {
                await this.peerConnection.addIceCandidate(payload.ice)
              } else {
                this.pendingIce.push(payload.ice)
              }
            }
          } catch (err) {
            console.error('Eroare semnalizare AirMIDI:', err)
          }
        })
        .subscribe((s) => {
          if (s === 'SUBSCRIBED') resolve()
          if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') {
            reject(new Error('Nu m-am putut conecta la canalul de semnalizare.'))
          }
        })
    })
  }

  /* ------------------------------------------------------------------ */
  /* SENDER                                                              */
  /* ------------------------------------------------------------------ */
  async startBroadcasting(deviceInfo: any = {}): Promise<string> {
    // 1) logat?  2) adaptor USB MIDI conectat?  3) abia apoi se generează codul
    const user = await this.requireUser()

    const inputs = await this.scanInputs()
    if (inputs.length === 0) {
      throw new Error('Niciun adaptor USB MIDI detectat. Conectează-l și încearcă din nou.')
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

    this.initPeerConnection()

    // Receiver-ul creează data channel-ul, sender-ul îl primește
    this.peerConnection!.ondatachannel = (event) => {
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

    const { data: session, error } = await this.supabase
      .from('airmidi_links')
      .select('*')
      .eq('room_code', code)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (error || !session) throw new Error('Cod AirMIDI Link invalid sau expirat.')

    await this.supabase
      .from('airmidi_links')
      .update({ status: 'connected', receiver_device_info: deviceInfo })
      .eq('room_code', code)

    this.initPeerConnection()

    // canal fiabil și ordonat: nu se pierd note-off
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
  }

  /* ------------------------------------------------------------------ */
  public sendMidi(midiMessage: Uint8Array) {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(midiMessage as any)
    }
  }

  public disconnect() {
    // scoatem handlerele ca să nu declanșăm "disconnected" la reset voluntar
    if (this.dataChannel) {
      this.dataChannel.onopen = null
      this.dataChannel.onclose = null
      this.dataChannel.onmessage = null
      this.dataChannel.close()
    }
    if (this.peerConnection) {
      this.peerConnection.onconnectionstatechange = null
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