/**
 * Договор между клиентом и сервером: формат запроса, события потока
 * и разметка, которой модель делит ответ на блоки.
 */
import type { ScenarioId } from './types'

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface AskRequest {
  mode: 'ask'
  scenario?: ScenarioId
  turns: ChatTurn[]
}

export interface ReviewRequest {
  mode: 'review'
  /** Кейс из базы или контрольный вопрос по прошлой ошибке — одно из двух. */
  caseId?: string
  probeOf?: string
  answer: string
  /** Предыдущая попытка на этот же кейс. */
  previous?: { answer: string; score: number }
  /** Ошибки, которые уже встречались у пользователя в прошлых сессиях. */
  knownMistakes?: string[]
}

export interface DebriefRequest {
  mode: 'debrief'
  scenario: ScenarioId
  results: { title: string; zone: string; score: number; mistakes: string[] }[]
}

export type MentorRequest = AskRequest | ReviewRequest | DebriefRequest

export type StreamEvent =
  | { type: 'cards'; ids: string[] }
  | { type: 'text'; value: string }
  | { type: 'error'; message: string }

export const LIMITS = {
  messageChars: 2000,
  turns: 12,
  bodyBytes: 32_000,
  audioBytes: 3_500_000,
} as const

export type SectionName =
  'right' | 'improve' | 'example' | 'meta' | 'followups' | 'summary' | 'plan'

const MARKER = /^@@([a-z]+)[ \t]*$/

export interface Parsed {
  /** Текст до первой метки. */
  lead: string
  sections: Partial<Record<SectionName, string>>
}

/**
 * Делит ответ модели на блоки по строкам-меткам вида `@@right`.
 * Работает и на незавершённом тексте: недописанная метка в хвосте не показывается.
 */
export function parseSections(raw: string): Parsed {
  const lines = raw.split('\n')
  const last = lines[lines.length - 1]
  if (last.startsWith('@') && !MARKER.test(last)) lines.pop()

  const result: Parsed = { lead: '', sections: {} }
  let current: SectionName | null = null
  const buffer: string[] = []
  const flush = () => {
    const text = buffer.join('\n').trim()
    if (current) result.sections[current] = text
    else result.lead = text
    buffer.length = 0
  }

  for (const line of lines) {
    const match = MARKER.exec(line)
    if (match) {
      flush()
      current = match[1] as SectionName
    } else {
      buffer.push(line)
    }
  }
  flush()
  return result
}

export interface ReviewMeta {
  score: number
  mistakes: string[]
  next: string
}

export function parseMeta(text: string | undefined): ReviewMeta | null {
  if (!text) return null
  const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
  try {
    const data = JSON.parse(json) as Partial<ReviewMeta>
    const score = Math.min(3, Math.max(0, Math.round(Number(data.score))))
    if (Number.isNaN(score)) return null
    return {
      score,
      mistakes: Array.isArray(data.mistakes)
        ? data.mistakes.filter((m) => typeof m === 'string')
        : [],
      next: typeof data.next === 'string' ? data.next.trim() : '',
    }
  } catch {
    return null
  }
}

const CITATION = /\[((?:adm|job|onb)-[a-z0-9-]+)\]/g

/** Метки карточек в порядке первого упоминания. */
export function citedIds(text: string): string[] {
  return [...new Set([...text.matchAll(CITATION)].map((match) => match[1]))]
}

export { CITATION }
