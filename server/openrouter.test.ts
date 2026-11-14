import { afterEach, describe, expect, it, vi } from 'vitest'
import { streamChat, UpstreamError } from './openrouter.js'

const options = { messages: [], maxTokens: 100 }

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

function mockStream(events: string[]) {
  vi.stubEnv('OPENROUTER_API_KEY', 'test-key')
  const cancel = vi.fn()
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      for (const event of events) controller.enqueue(encoder.encode(event))
    },
    cancel,
  })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(stream)))
  return cancel
}

describe('streamChat', () => {
  it('собирает текст из разорванных событий и пропускает служебные строки', async () => {
    mockStream([
      ': heartbeat\n\ndata: null\n\ndata: {"choices":[{"del',
      'ta":{"content":"Привет"}}]}\n\ndata: {"choices":[{"delta":{"content":"!"}}]}\n\n',
      'data: [DONE]\n\n',
    ])
    const text: string[] = []
    for await (const chunk of streamChat(options)) text.push(chunk)
    expect(text).toEqual(['Привет', '!'])
  })

  it('не выдаёт оборванный ответ за завершённый, если провайдер прислал ошибку в HTTP 200', async () => {
    mockStream([
      'data: {"choices":[{"delta":{"content":"Начало ответа"}}]}\n\n',
      'data: {"error":{"message":"Provider failed","code":502}}\n\n',
      'data: [DONE]\n\n',
    ])
    const chunks = streamChat(options)
    await expect(chunks.next()).resolves.toEqual({ value: 'Начало ответа', done: false })
    await expect(chunks.next()).rejects.toMatchObject({
      message: 'Provider failed',
      status: 502,
    })
  })

  it('сохраняет код ошибки до первого слова', async () => {
    mockStream(['data: {"error":{"message":"Rate limited","code":429}}\n\n'])
    const first = streamChat(options).next()
    await expect(first).rejects.toBeInstanceOf(UpstreamError)
    await expect(first).rejects.toMatchObject({ status: 429 })
  })

  it('закрывает поток провайдера, если ответ больше не нужен', async () => {
    const cancel = mockStream(['data: {"choices":[{"delta":{"content":"Ответ"}}]}\n\n'])
    const chunks = streamChat(options)
    await chunks.next()
    await chunks.return(undefined)
    expect(cancel).toHaveBeenCalledOnce()
  })
})
