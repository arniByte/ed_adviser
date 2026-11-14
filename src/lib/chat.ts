import type { Found } from './api'
import { isSaved } from './mine'

export interface Exchange {
  id: number
  question: string
  /** Сырой ответ модели вместе с разметкой. */
  raw: string
  status: 'waiting' | 'streaming' | 'done' | 'failed'
  error?: string
  /** Пользователь сам попросил поискать в интернете. */
  web?: boolean
  /** Что наставник делает до ответа. */
  progress?: string
  found?: Found
}

export type AskHandler = (question: string, options?: { web?: boolean }) => void

/** Разговор переживает перезагрузку: последние ответы лежат в браузере. */
const KEY = 'chernovik:chat:v1'
const KEEP = 20

function cleanChat(value: unknown): Exchange[] {
  if (!Array.isArray(value)) return []
  const ids = new Set<number>()
  return value
    .flatMap((item): Exchange[] => {
      const exchange = item as Exchange | null
      if (
        exchange?.status !== 'done' ||
        !Number.isSafeInteger(exchange.id) ||
        exchange.id < 1 ||
        ids.has(exchange.id) ||
        typeof exchange.question !== 'string' ||
        typeof exchange.raw !== 'string'
      )
        return []
      ids.add(exchange.id)
      const found = exchange.found
      const validFound =
        found &&
        Array.isArray(found.cards) &&
        found.checks &&
        Number.isSafeInteger(found.looked) &&
        found.looked >= 0 &&
        found.cards.every((card) => isSaved({ card, check: found.checks[card?.id] }))
      return [
        {
          id: exchange.id,
          question: exchange.question,
          raw: exchange.raw,
          status: 'done',
          ...(exchange.web === true ? { web: true } : {}),
          ...(validFound ? { found } : {}),
        },
      ]
    })
    .slice(-KEEP)
}

export function loadChat(): Exchange[] {
  try {
    return cleanChat(JSON.parse(localStorage.getItem(KEY) ?? '[]'))
  } catch {
    return []
  }
}

export function saveChat(exchanges: Exchange[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(cleanChat(exchanges)))
  } catch {
    // Приватный режим: разговор живёт до закрытия вкладки.
  }
}
