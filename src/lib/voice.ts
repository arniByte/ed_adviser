/**
 * Запись голоса в браузере. Звук любого формата приводится к моно WAV 16 кГц:
 * его понимают все модели распознавания, а минута речи весит меньше двух мегабайт.
 */
const SAMPLE_RATE = 16_000
export const MAX_SECONDS = 75

export interface Recording {
  /** Текущая громкость от 0 до 1 — для анимации кольца. */
  level: () => number
  /** Останавливает запись и возвращает WAV в base64. */
  stop: () => Promise<string>
  cancel: () => void
}

export const canRecord = () =>
  typeof navigator !== 'undefined' &&
  !!navigator.mediaDevices?.getUserMedia &&
  typeof MediaRecorder !== 'undefined'

export async function startRecording(signal?: AbortSignal): Promise<Recording> {
  signal?.throwIfAborted()
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
  })
  let context: AudioContext | undefined
  let recorder: MediaRecorder | undefined
  let released = false
  const release = () => {
    if (released) return
    released = true
    stream.getTracks().forEach((track) => track.stop())
    if (context) void context.close().catch(() => {})
  }

  try {
    // Разрешение может прийти уже после ухода с экрана: микрофон сразу освобождается.
    signal?.throwIfAborted()
    context = new AudioContext()
    // Safari создаёт контекст приостановленным, если между нажатием и созданием была пауза.
    void context.resume().catch(() => {})
    const analyser = context.createAnalyser()
    analyser.fftSize = 512
    context.createMediaStreamSource(stream).connect(analyser)
    const samples = new Float32Array(analyser.fftSize)
    const media = (recorder = new MediaRecorder(stream))
    const chunks: Blob[] = []
    let stopped: Promise<string> | undefined
    let rejectStop: ((reason: unknown) => void) | undefined

    const cleanup = () => {
      signal?.removeEventListener('abort', cancel)
      release()
    }
    const cancel = () => {
      media.onstop = null
      media.ondataavailable = null
      media.onerror = null
      try {
        if (media.state !== 'inactive') media.stop()
      } finally {
        cleanup()
        rejectStop?.(new DOMException('Запись отменена', 'AbortError'))
      }
    }
    media.ondataavailable = (event) => chunks.push(event.data)
    media.onerror = () => {
      cleanup()
      rejectStop?.(new Error('Запись прервалась. Попробуй ещё раз.'))
    }
    media.start()
    signal?.addEventListener('abort', cancel, { once: true })

    return {
      level() {
        if (released) return 0
        analyser.getFloatTimeDomainData(samples)
        let sum = 0
        for (const sample of samples) sum += sample * sample
        // Обычная речь даёт среднеквадратичное около 0,05–0,2 — растягиваем на всю шкалу.
        return Math.min(1, Math.sqrt(sum / samples.length) * 5)
      },
      stop() {
        if (stopped) return stopped
        if (released || media.state === 'inactive')
          return Promise.reject(new Error('Запись прервалась. Попробуй ещё раз.'))
        stopped = new Promise((resolve, reject) => {
          rejectStop = reject
          media.onstop = async () => {
            cleanup()
            try {
              resolve(await toWavBase64(new Blob(chunks, { type: media.mimeType })))
            } catch (error) {
              reject(error)
            }
          }
          try {
            media.stop()
          } catch (error) {
            cleanup()
            reject(error)
          }
        })
        return stopped
      },
      cancel,
    }
  } catch (error) {
    if (recorder?.state === 'recording') recorder.stop()
    release()
    throw error
  }
}

async function toWavBase64(blob: Blob): Promise<string> {
  const decoder = new AudioContext()
  let decoded: AudioBuffer
  try {
    decoded = await decoder.decodeAudioData(await blob.arrayBuffer())
  } finally {
    void decoder.close().catch(() => {})
  }

  const frames = Math.ceil(decoded.duration * SAMPLE_RATE)
  const offline = new OfflineAudioContext(1, frames, SAMPLE_RATE)
  const source = offline.createBufferSource()
  source.buffer = decoded
  source.connect(offline.destination)
  source.start()
  const pcm = (await offline.startRendering()).getChannelData(0)

  return bytesToBase64(encodeWav(pcm))
}

export function encodeWav(pcm: Float32Array): Uint8Array {
  const view = new DataView(new ArrayBuffer(44 + pcm.length * 2))
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
  }
  ascii(0, 'RIFF')
  view.setUint32(4, 36 + pcm.length * 2, true)
  ascii(8, 'WAVEfmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, SAMPLE_RATE, true)
  view.setUint32(28, SAMPLE_RATE * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  ascii(36, 'data')
  view.setUint32(40, pcm.length * 2, true)
  for (let i = 0; i < pcm.length; i++) {
    const sample = Math.max(-1, Math.min(1, pcm[i]))
    view.setInt16(44 + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
  }
  return new Uint8Array(view.buffer)
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const step = 0x8000
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step))
  }
  return btoa(binary)
}
