/**
 * Web Audio capture and playback utilities for Gemini Live calls.
 *
 * - Capture: Downsamples microphone input to 16 kHz 16-bit linear PCM in 40 ms chunks (640 samples).
 * - Playback: Queues 24 kHz linear PCM audio buffers seamlessly; clears active buffers on interruption.
 * - iPhone Safari: AudioContext is only created or resumed upon explicit user interaction.
 */

let globalAudioCtx: AudioContext | null = null

/**
 * Returns or initializes the shared AudioContext.
 * Must be called in direct response to a user tap/click.
 */
export function getOrCreateAudioContext(): AudioContext {
  if (typeof window === 'undefined') {
    throw new Error('Web Audio is only available in browser environments')
  }

  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext

  if (!globalAudioCtx || globalAudioCtx.state === 'closed') {
    globalAudioCtx = new AudioCtx()
  }

  if (globalAudioCtx.state === 'suspended') {
    void globalAudioCtx.resume()
  }

  return globalAudioCtx
}

/**
 * Converts an ArrayBuffer to a base64 encoded string.
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return window.btoa(binary)
}

/**
 * Playback queue for 24 kHz 16-bit linear PCM audio sent from Gemini Live.
 */
export class PcmPlaybackQueue {
  private ctx: AudioContext
  private nextPlayTime: number = 0
  private activeSources: AudioBufferSourceNode[] = []

  constructor(ctx: AudioContext) {
    this.ctx = ctx
  }

  enqueue(pcm24kBase64: string): void {
    if (!pcm24kBase64 || this.ctx.state === 'closed') return

    try {
      const raw = window.atob(pcm24kBase64)
      const bytes = new Uint8Array(raw.length)
      for (let i = 0; i < raw.length; i++) {
        bytes[i] = raw.charCodeAt(i)
      }
      const int16 = new Int16Array(bytes.buffer)
      const float32 = new Float32Array(int16.length)
      for (let i = 0; i < int16.length; i++) {
        const s = int16[i]
        float32[i] = s < 0 ? s / 32768 : s / 32767
      }

      const audioBuffer = this.ctx.createBuffer(1, float32.length, 24000)
      audioBuffer.getChannelData(0).set(float32)

      const now = this.ctx.currentTime
      if (this.nextPlayTime < now) {
        this.nextPlayTime = now + 0.03
      }

      const source = this.ctx.createBufferSource()
      source.buffer = audioBuffer
      source.connect(this.ctx.destination)
      source.start(this.nextPlayTime)
      this.nextPlayTime += audioBuffer.duration

      this.activeSources.push(source)
      source.onended = () => {
        const idx = this.activeSources.indexOf(source)
        if (idx !== -1) {
          this.activeSources.splice(idx, 1)
        }
      }
    } catch (err) {
      console.warn('Failed to enqueue PCM 24k audio chunk:', err)
    }
  }

  clear(): void {
    for (const src of this.activeSources) {
      try {
        src.stop()
        src.disconnect()
      } catch {
        // Source might already have ended
      }
    }
    this.activeSources = []
    this.nextPlayTime = this.ctx.currentTime
  }

  destroy(): void {
    this.clear()
  }
}

/**
 * Microphone capture handle with cleanup.
 */
export interface MicCaptureHandle {
  stop: () => void
}

/**
 * Initializes microphone capture, downsampling audio to 16 kHz 16-bit linear PCM
 * and sending 40 ms chunks (640 samples) as base64 to onChunk.
 */
export async function startMicrophoneCapture(
  audioCtx: AudioContext,
  onChunk: (base64Chunk: string) => void,
): Promise<MicCaptureHandle> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: false,
  })

  const sourceNode = audioCtx.createMediaStreamSource(stream)

  // Target: 40 ms of 16 kHz mono = 640 samples
  const TARGET_CHUNK_SAMPLES = 640
  let pcmBuffer: number[] = []

  // Check if AudioWorklet is supported
  let workletNode: AudioWorkletNode | null = null
  let scriptNode: ScriptProcessorNode | null = null

  const processSamples = (channelData: Float32Array, inputRate: number) => {
    const ratio = inputRate / 16000
    for (let i = 0; i < channelData.length; i += ratio) {
      const idx = Math.floor(i)
      const frac = i - idx
      const s0 = channelData[idx] || 0
      const s1 = channelData[idx + 1] !== undefined ? channelData[idx + 1] : s0
      const sample = s0 + frac * (s1 - s0)

      const clamped = Math.max(-1, Math.min(1, sample))
      const int16 = clamped < 0 ? clamped * 32768 : clamped * 32767
      pcmBuffer.push(Math.round(int16))

      if (pcmBuffer.length >= TARGET_CHUNK_SAMPLES) {
        const chunk = new Int16Array(pcmBuffer.splice(0, TARGET_CHUNK_SAMPLES))
        const base64 = arrayBufferToBase64(chunk.buffer)
        onChunk(base64)
      }
    }
  }

  const workletCode = `
class Pcm16kDownsamplerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = [];
    this.targetChunk = 640;
  }
  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    const channelData = input[0];
    const ratio = sampleRate / 16000;
    for (let i = 0; i < channelData.length; i += ratio) {
      const idx = Math.floor(i);
      const frac = i - idx;
      const s0 = channelData[idx] || 0;
      const s1 = channelData[idx + 1] !== undefined ? channelData[idx + 1] : s0;
      const sample = s0 + frac * (s1 - s0);
      const clamped = Math.max(-1, Math.min(1, sample));
      const int16 = clamped < 0 ? clamped * 32768 : clamped * 32767;
      this.buffer.push(Math.round(int16));
      if (this.buffer.length >= this.targetChunk) {
        const chunk = new Int16Array(this.buffer.splice(0, this.targetChunk));
        this.port.postMessage(chunk.buffer, [chunk.buffer]);
      }
    }
    return true;
  }
}
registerProcessor('pcm-16k-downsampler', Pcm16kDownsamplerProcessor);
`

  try {
    if (audioCtx.audioWorklet) {
      const blob = new Blob([workletCode], { type: 'application/javascript' })
      const workletUrl = URL.createObjectURL(blob)
      await audioCtx.audioWorklet.addModule(workletUrl)
      URL.revokeObjectURL(workletUrl)

      workletNode = new AudioWorkletNode(audioCtx, 'pcm-16k-downsampler')
      workletNode.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
        const base64 = arrayBufferToBase64(event.data)
        onChunk(base64)
      }
      sourceNode.connect(workletNode)
      workletNode.connect(audioCtx.destination)
    } else {
      throw new Error('audioWorklet unavailable')
    }
  } catch {
    // Fallback using ScriptProcessorNode for older Web Audio engines
    scriptNode = audioCtx.createScriptProcessor(2048, 1, 1)
    scriptNode.onaudioprocess = (e) => {
      const channelData = e.inputBuffer.getChannelData(0)
      processSamples(channelData, audioCtx.sampleRate)
    }
    sourceNode.connect(scriptNode)
    scriptNode.connect(audioCtx.destination)
  }

  return {
    stop: () => {
      try {
        sourceNode.disconnect()
        if (workletNode) {
          workletNode.disconnect()
        }
        if (scriptNode) {
          scriptNode.disconnect()
        }
      } catch {
        // Nodes already disconnected
      }
      for (const track of stream.getTracks()) {
        track.stop()
      }
    },
  }
}
