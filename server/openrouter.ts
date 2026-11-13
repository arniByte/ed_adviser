const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'

export const MODELS = {
  mentor: process.env.MENTOR_MODEL || 'anthropic/claude-haiku-5.5',
  fallback: 'google/gemini-3.1-flash-lite',
  transcribe: process.env.TRANSCRIBE_MODEL || 'google/gemini-3.1-flash-lite',
}

export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

type Content =
  | string
  | (
      | { type: 'text'; text: string }
      | { type: 'input_audio'; input_audio: { data: string; format: string } }
    )[]

export interface Message {
  role: 'system' | 'user' | 'assistant'
  content: Content
}

interface Options {
  messages: Message[]
  maxTokens: number
  temperature?: number
  model?: string
  stream?: boolean
}

async function request({ messages, maxTokens, temperature = 0.5, model, stream = false }: Options) {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) throw new UpstreamError('Не задан OPENROUTER_API_KEY', 500)

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
      'x-title': 'Chernovik',
    },
    body: JSON.stringify({
      // Второй моделью OpenRouter отвечает сам, если первая недоступна.
      models: model ? [model] : [MODELS.mentor, MODELS.fallback],
      messages,
      max_tokens: maxTokens,
      temperature,
      stream,
      // Скрытое размышление удваивает время до первого слова и цену, а разбору кейса не нужно.
      reasoning: { enabled: false },
      // Из нескольких площадок, где запущена модель, берём ту, что отвечает быстрее.
      provider: { sort: 'latency' },
    }),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new UpstreamError(
      `OpenRouter ответил ${response.status}: ${detail.slice(0, 200)}`,
      response.status,
    )
  }
  return response
}

/** Отдаёт ответ модели по кускам, по мере генерации. */
export async function* streamChat(options: Omit<Options, 'stream'>): AsyncGenerator<string> {
  const response = await request({ ...options, stream: true })
  const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) return
    buffer += value
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const payload = line.slice(6).trim()
      if (payload === '[DONE]') return
      try {
        const delta = JSON.parse(payload).choices?.[0]?.delta?.content
        if (typeof delta === 'string' && delta) yield delta
      } catch {
        // Служебные строки потока, которые не являются JSON, пропускаем.
      }
    }
  }
}

export async function complete(options: Omit<Options, 'stream'>): Promise<string> {
  const response = await request(options)
  const data = await response.json()
  return String(data.choices?.[0]?.message?.content ?? '').trim()
}
