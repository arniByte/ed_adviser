/**
 * Договор между клиентом и сервером: формат запроса, события потока
 * и разметка, которой модель делит ответ на блоки.
 */
import type { Profile } from './profile.js'
import type { WebCheck } from './proof.js'
import type { Card, ScenarioId } from './types.js'

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

/** Общее для всех запросов: то, что пользователь рассказал о себе. */
interface Personal {
  profile?: Profile
}

export interface AskRequest extends Personal {
  mode: 'ask'
  scenario?: ScenarioId
  turns: ChatTurn[]
  /** Искать в интернете, даже если в базе что-то нашлось. */
  web?: boolean
  /** Карточки из личной базы пользователя: найденное раньше и сохранённое им. */
  mine?: Card[]
}

export interface ReviewRequest extends Personal {
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

export interface DebriefRequest extends Personal {
  mode: 'debrief'
  scenario: ScenarioId
  results: { title: string; zone: string; score: number; mistakes: string[] }[]
}

export type MentorRequest = AskRequest | ReviewRequest | DebriefRequest

export type StreamEvent =
  | { type: 'cards'; ids: string[] }
  | { type: 'text'; value: string }
  | { type: 'error'; message: string }
  /** Что наставник делает до ответа: ищет в интернете, проверяет цитаты. */
  | { type: 'status'; value: string }
  /** Карточки из интернета, чьи цитаты сервер нашёл на живых страницах. */
  | { type: 'found'; cards: Card[]; checks: Record<string, WebCheck>; looked: number }

export const LIMITS = {
  messageChars: 2000,
  turns: 12,
  bodyBytes: 64_000,
  mineCards: 24,
  aboutChars: 300,
  audioBytes: 3_500_000,
} as const

const SECTION_NAMES = [
  'right',
  'improve',
  'example',
  'meta',
  'followups',
  'summary',
  'plan',
] as const
export type SectionName = (typeof SECTION_NAMES)[number]

const MARKER = /^@@([a-z]+)[ \t]*$/

function markerOf(line: string): SectionName | null {
  const name = MARKER.exec(line)?.[1] as SectionName | undefined
  return name && SECTION_NAMES.includes(name) ? name : null
}

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
  if (last.startsWith('@') && !markerOf(last)) lines.pop()

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
    const marker = markerOf(line)
    if (marker) {
      flush()
      current = marker
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

const CITATION = /\[((?:adm|job|onb|web)-[a-z0-9-]+)\]/g
/** id типовой ошибки — у них всегда «-m-»; в тексте для пользователя им не место. */
const MISTAKE_TAG = /\s*\[(?:adm|job|onb)-m-[^\]\n]*\]/g
/** Метка карточки с припиской внутри скобок: «[job-star, см. ниже]». */
const NOISY_TAG = /\[((?:adm|job|onb|web)-[a-z0-9-]+)[^\]\na-z0-9-][^\]\n]*\]/g
/** Метка в круглых скобках: «(…[job-star])». */
const WRAPPED_TAG = /\(\s*(\[(?:adm|job|onb|web)-[a-z0-9-]+\])\s*\)/g

/**
 * Приводит служебные метки в ответе модели к одному виду: убирает id ошибок,
 * обрезает приписки внутри скобок и лишние круглые скобки вокруг меток.
 */
export function cleanCitations(text: string): string {
  return text.replace(MISTAKE_TAG, '').replace(NOISY_TAG, '[$1]').replace(WRAPPED_TAG, '$1')
}

/** Метки карточек в порядке первого упоминания. */
export function citedIds(text: string): string[] {
  return [...new Set([...text.matchAll(CITATION)].map((match) => match[1]))]
}
