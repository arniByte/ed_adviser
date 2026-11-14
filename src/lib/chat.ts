import type { Found } from './api'

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

export function loadChat(): Exchange[] {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? '[]') as Exchange[]
    return Array.isArray(stored)
      ? stored.filter((e) => e?.status === 'done' && typeof e.raw === 'string')
      : []
  } catch {
    return []
  }
}

export function saveChat(exchanges: Exchange[]) {
  try {
    const done = exchanges.filter((e) => e.status === 'done').slice(-KEEP)
    localStorage.setItem(KEY, JSON.stringify(done.map(({ progress: _, ...rest }) => rest)))
  } catch {
    // Приватный режим: разговор живёт до закрытия вкладки.
  }
}
