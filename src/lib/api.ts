import { LIMITS, type MentorRequest, type StreamEvent } from '../../core/protocol'
import type { WebCheck } from '../../core/proof'
import type { Card } from '../../core/types'
import { getMine } from './mine'
import { getMentor } from './mentor'
import { getProfile } from './profile'

export interface Found {
  cards: Card[]
  checks: Record<string, WebCheck>
  looked: number
}

interface Handlers {
  onCards?: (ids: string[]) => void
  /** Что наставник делает до ответа: ищет в интернете, сверяет цитаты. */
  onStatus?: (status: string) => void
  onFound?: (found: Found) => void
  /** Вызывается с полным текстом, накопленным к этому моменту. */
  onText: (text: string) => void
  signal?: AbortSignal
}

const FALLBACK_ERROR = 'Не получилось связаться с Черновиком. Попробуй ещё раз.'
const SLOW_ERROR = 'Черновик слишком долго молчит. Попробуй отправить ещё раз.'
const TIMEOUT_MS = 60_000

/** Поиск в интернете с проверкой страниц идёт дольше обычного ответа. */
const WEB_TIMEOUT_MS = 90_000

/**
 * Отправляет запрос наставнику и читает ответ по мере генерации. К запросу сами
 * добавляются профиль и личная база: они хранятся только в браузере.
 */
export async function askMentor(request: MentorRequest, handlers: Handlers): Promise<string> {
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(
    () => {
      timedOut = true
      controller.abort()
    },
    request.mode === 'ask' ? WEB_TIMEOUT_MS : TIMEOUT_MS,
  )
  const profile = getProfile() ?? undefined
  const mentor = getMentor()
  const personal: MentorRequest =
    request.mode === 'ask'
      ? {
          ...request,
          profile,
          mentor,
          mine: getMine()
            .slice(0, LIMITS.mineCards)
            .map((item) => item.card),
        }
      : { ...request, profile, mentor }
  const abort = () => controller.abort(handlers.signal?.reason)
  if (handlers.signal?.aborted) abort()
  else handlers.signal?.addEventListener('abort', abort, { once: true })
  try {
    controller.signal.throwIfAborted()
    return await read(personal, handlers, controller.signal)
  } catch (error) {
    throw timedOut ? new Error(SLOW_ERROR) : error
  } finally {
    clearTimeout(timer)
    handlers.signal?.removeEventListener('abort', abort)
  }
}

/** История сокращается так же, как на сервере; источники добавляются целиком в бюджет запроса. */
function requestBody(request: MentorRequest): string {
  if (request.mode !== 'ask') return JSON.stringify(request)
  const bounded = {
    ...request,
    turns: request.turns
      .slice(-LIMITS.turns)
      .map((turn) =>
        turn.role === 'assistant'
          ? { ...turn, content: turn.content.slice(0, LIMITS.messageChars) }
          : turn,
      ),
    mine: [] as Card[],
  }
  const encoder = new TextEncoder()
  for (const card of request.mine?.slice(0, LIMITS.mineCards) ?? []) {
    bounded.mine.push(card)
    if (encoder.encode(JSON.stringify(bounded)).byteLength > LIMITS.bodyBytes) bounded.mine.pop()
  }
  return JSON.stringify(bounded)
}

async function read(
  request: MentorRequest,
  { onCards, onStatus, onFound, onText }: Handlers,
  signal: AbortSignal,
): Promise<string> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: requestBody(request),
    signal,
  })
  if (!response.ok || !response.body) {
    const data = await response.json().catch(() => null)
    throw new Error(data?.error ?? FALLBACK_ERROR)
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  let text = ''
  let ended = false
  const consume = (line: string) => {
    if (!line.trim()) return
    let event: StreamEvent
    try {
      event = JSON.parse(line) as StreamEvent
    } catch {
      throw new Error(FALLBACK_ERROR)
    }
    if (event.type === 'cards') onCards?.(event.ids)
    if (event.type === 'status') onStatus?.(event.value)
    if (event.type === 'found') onFound?.(event)
    if (event.type === 'error') throw new Error(event.message)
    if (event.type === 'text') {
      text += event.value
      onText(text)
    }
  }
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) {
        ended = true
        consume(buffer)
        break
      }
      buffer += value
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) consume(line)
    }
    if (!text.trim()) throw new Error(FALLBACK_ERROR)
    return text
  } finally {
    if (!ended) await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

export async function transcribe(audio: string, signal?: AbortSignal): Promise<string> {
  const response = await fetch('/api/transcribe', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ audio }),
    signal,
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(data?.error ?? 'Не получилось распознать запись.')
  return String(data?.text ?? '')
}
