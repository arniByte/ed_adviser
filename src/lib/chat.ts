import type { Found } from './api'
import { isSaved } from './mine'
import { createStore } from './store'

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

/** Ключ прежней версии: тогда разговор был один. */
const LEGACY = 'chernovik:chat:v1'
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

/**
 * История разговоров: каждый чат — отдельная запись с заголовком по первому вопросу.
 * Храним последние CHATS, самый свежий — первым.
 */
export interface Chat {
  id: string
  title: string
  updatedAt: number
  exchanges: Exchange[]
}

const CHATS = 30

export const newChatId = () =>
  `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

function titleOf(exchanges: Exchange[]) {
  const first = exchanges[0]?.question.trim().replace(/\s+/g, ' ') ?? ''
  return first.length > 80 ? `${first.slice(0, 78).trimEnd()}…` : first
}

function cleanChats(value: unknown): Chat[] | null {
  if (!Array.isArray(value)) return null
  const ids = new Set<string>()
  return value
    .flatMap((item): Chat[] => {
      const chat = item as Chat | null
      if (typeof chat?.id !== 'string' || ids.has(chat.id) || !Number.isFinite(chat.updatedAt))
        return []
      const exchanges = cleanChat(chat.exchanges)
      if (!exchanges.length) return []
      ids.add(chat.id)
      return [{ id: chat.id, title: titleOf(exchanges), updatedAt: chat.updatedAt, exchanges }]
    })
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, CHATS)
}

const chats = createStore<Chat[]>('chernovik:chats:v1', [], cleanChats)
/** Какой разговор открыт: после перезагрузки возвращаемся в него. */
const open = createStore<string | null>('chernovik:chat-open:v1', null, (value) =>
  typeof value === 'string' ? value : null,
)

// Разговор из прежней версии, где чат был один, становится первым в истории.
try {
  const legacy = cleanChat(JSON.parse(localStorage.getItem(LEGACY) ?? 'null'))
  if (legacy.length && !chats.get().length) {
    const id = newChatId()
    chats.set([{ id, title: titleOf(legacy), updatedAt: Date.now(), exchanges: legacy }])
    open.set(id)
  }
  localStorage.removeItem(LEGACY)
} catch {
  // Хранилище закрыто — переносить нечего.
}

export const getChats = chats.get
export const useChats = chats.use
export const findChat = (id: string) => chats.get().find((chat) => chat.id === id)
export const openChatId = () => open.get()

/** Сохраняет разговор и делает его открытым. Пустой разговор в историю не попадает. */
export function saveChat(id: string, exchanges: Exchange[]) {
  if (open.get() !== id) open.set(id)
  const clean = cleanChat(exchanges)
  const list = chats.get()
  const before = list.find((chat) => chat.id === id)
  if (!clean.length) {
    if (before) chats.set(list.filter((chat) => chat !== before))
    return
  }
  if (before && JSON.stringify(before.exchanges) === JSON.stringify(clean)) return
  const chat = { id, title: titleOf(clean), updatedAt: Date.now(), exchanges: clean }
  chats.set([chat, ...list.filter((item) => item !== before)].slice(0, CHATS))
}

/** Дописывает готовый ответ в разговор, который уже не открыт. */
export function appendToChat(id: string, exchange: Exchange) {
  const before = findChat(id)?.exchanges ?? []
  const rest = before.filter((item) => item.id !== exchange.id)
  const list = chats.get()
  const chat = { id, title: '', updatedAt: Date.now(), exchanges: cleanChat([...rest, exchange]) }
  chat.title = titleOf(chat.exchanges)
  if (chat.exchanges.length)
    chats.set([chat, ...list.filter((item) => item.id !== id)].slice(0, CHATS))
}

export function deleteChat(id: string) {
  chats.set(chats.get().filter((chat) => chat.id !== id))
}

/** Следующий номер ответа — сквозной по всем разговорам, чтобы ответы не путались. */
export function nextExchangeId(): number {
  return Math.max(0, ...chats.get().flatMap((chat) => chat.exchanges.map((e) => e.id))) + 1
}
