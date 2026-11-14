import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startRecording } from './voice'

describe('очистка голосовой записи', () => {
  const track = { stop: vi.fn() }
  const stream = { getTracks: () => [track] }
  const getUserMedia = vi.fn()
  const contexts: { close: ReturnType<typeof vi.fn> }[] = []
  const recorders: {
    state: string
    onstop: (() => void) | null
    ondataavailable: unknown
    onerror: unknown
    mimeType: string
    start: ReturnType<typeof vi.fn>
    stop: ReturnType<typeof vi.fn>
  }[] = []
  let recorderFails = false

  beforeEach(() => {
    track.stop.mockClear()
    getUserMedia.mockReset().mockResolvedValue(stream)
    contexts.length = 0
    recorders.length = 0
    recorderFails = false
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } })
    vi.stubGlobal(
      'AudioContext',
      class {
        close = vi.fn(async () => {})
        resume = async () => {}
        createAnalyser = () => ({ fftSize: 512, getFloatTimeDomainData: () => {} })
        createMediaStreamSource = () => ({ connect: () => {} })
        decodeAudioData = async () => {
          throw new Error('Некорректная запись')
        }
        constructor() {
          contexts.push(this)
        }
      },
    )
    vi.stubGlobal(
      'MediaRecorder',
      class {
        state = 'inactive'
        onstop: (() => void) | null = null
        ondataavailable = null
        onerror = null
        mimeType = 'audio/webm'
        start = vi.fn(() => {
          this.state = 'recording'
        })
        stop = vi.fn(() => {
          this.state = 'inactive'
        })
        constructor() {
          if (recorderFails) throw new Error('Нет кодека')
          recorders.push(this)
        }
      },
    )
  })

  afterEach(() => vi.unstubAllGlobals())

  it('не запрашивает микрофон для уже отменённого действия', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(startRecording(controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
    expect(getUserMedia).not.toHaveBeenCalled()
  })

  it('освобождает микрофон, если разрешение пришло после отмены', async () => {
    let allow: (value: unknown) => void = () => {}
    getUserMedia.mockReturnValue(new Promise((resolve) => (allow = resolve)))
    const controller = new AbortController()
    const pending = startRecording(controller.signal)
    controller.abort()
    allow(stream)
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(track.stop).toHaveBeenCalledOnce()
    expect(contexts).toHaveLength(0)
  })

  it('освобождает поток и контекст при ошибке создания рекордера', async () => {
    recorderFails = true
    await expect(startRecording()).rejects.toThrow('Нет кодека')
    expect(track.stop).toHaveBeenCalledOnce()
    expect(contexts[0].close).toHaveBeenCalledOnce()
  })

  it('отмена сигнала выключает активный микрофон и безопасна повторно', async () => {
    const controller = new AbortController()
    const recording = await startRecording(controller.signal)
    controller.abort()
    recording.cancel()
    expect(track.stop).toHaveBeenCalledOnce()
    expect(contexts[0].close).toHaveBeenCalledOnce()
    expect(recorders[0].stop).toHaveBeenCalledOnce()
    expect(recording.level()).toBe(0)
  })

  it('отмена во время остановки завершает ожидающий промис', async () => {
    const recording = await startRecording()
    const pending = recording.stop()
    recording.cancel()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(track.stop).toHaveBeenCalledOnce()
    expect(contexts[0].close).toHaveBeenCalledOnce()
  })

  it('не останавливает запись дважды и закрывает декодер при повреждённом аудио', async () => {
    const recording = await startRecording()
    const pending = recording.stop()
    expect(recording.stop()).toBe(pending)
    recorders[0].onstop?.()
    await expect(pending).rejects.toThrow('Некорректная запись')
    expect(recorders[0].stop).toHaveBeenCalledOnce()
    expect(contexts).toHaveLength(2)
    expect(contexts.every((context) => context.close.mock.calls.length === 1)).toBe(true)
    expect(track.stop).toHaveBeenCalledOnce()
  })
})
