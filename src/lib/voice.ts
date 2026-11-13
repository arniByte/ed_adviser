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

export async function startRecording(): Promise<Recording> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
  })
  const context = new AudioContext()
  // Safari создаёт контекст приостановленным, если между нажатием и созданием была пауза.
  void context.resume()
  const analyser = context.createAnalyser()
  analyser.fftSize = 512
  context.createMediaStreamSource(stream).connect(analyser)
  const samples = new Float32Array(analyser.fftSize)

  const recorder = new MediaRecorder(stream)
  const chunks: Blob[] = []
  recorder.ondataavailable = (event) => chunks.push(event.data)
  recorder.start()

  const release = () => {
    stream.getTracks().forEach((track) => track.stop())
    void context.close()
  }

  return {
    level() {
      analyser.getFloatTimeDomainData(samples)
      let sum = 0
      for (const sample of samples) sum += sample * sample
      // Обычная речь даёт среднеквадратичное около 0,05–0,2 — растягиваем на всю шкалу.
      return Math.min(1, Math.sqrt(sum / samples.length) * 5)
    },
    stop: () =>
      new Promise((resolve, reject) => {
        recorder.onstop = async () => {
          release()
          try {
            resolve(await toWavBase64(new Blob(chunks, { type: recorder.mimeType })))
          } catch (error) {
            reject(error)
          }
        }
        recorder.stop()
      }),
    cancel() {
      recorder.onstop = null
      if (recorder.state !== 'inactive') recorder.stop()
      release()
    },
  }
}

async function toWavBase64(blob: Blob): Promise<string> {
  const decoder = new AudioContext()
  const decoded = await decoder.decodeAudioData(await blob.arrayBuffer())
  void decoder.close()

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
