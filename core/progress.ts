/**
 * Память тренажёра и адаптивный подбор заданий. Чистые функции:
 * хранение и интерфейс живут отдельно, поэтому логику легко проверить тестами.
 */
import { cases, getCase, getMistake, mistakes } from './knowledge'
import type { Case, Mistake, ScenarioId } from './types'

export interface ReviewRecord {
  kind: 'case' | 'probe'
  /** id кейса или id ошибки, к которой возвращаемся. */
  refId: string
  scenario: ScenarioId
  zone: string
  title: string
  situation?: string
  question: string
  answer: string
  score: number
  mistakes: string[]
  right: string
  improve: string
  example: string
  cards: string[]
  attempts: number
}

export interface SessionRecord {
  id: string
  scenario: ScenarioId
  date: string
  items: ReviewRecord[]
  summary: string
  plan: string[]
}

interface MistakeStat {
  times: number
  /** Сколько повторов уже закрыто удачным ответом. */
  fixed: number
  last: string
}

interface ZoneStat {
  attempts: number
  points: number
  last: string
}

export interface Memory {
  version: 1
  sessions: SessionRecord[]
  mistakes: Record<string, MistakeStat>
  zones: Record<string, ZoneStat>
  cases: Record<string, { best: number; last: string }>
}

export const emptyMemory = (): Memory => ({
  version: 1,
  sessions: [],
  mistakes: {},
  zones: {},
  cases: {},
})

const MAX_SCORE = 3
const GOOD_SCORE = 2
const KEPT_SESSIONS = 20

export const zoneKey = (scenario: ScenarioId, zone: string) => `${scenario}/${zone}`

/** Учитывает разобранный ответ: баллы по зоне, новые ошибки и закрытые старые. */
export function recordReview(memory: Memory, record: ReviewRecord, now = new Date()): Memory {
  const date = now.toISOString()
  const next: Memory = {
    ...memory,
    zones: { ...memory.zones },
    mistakes: { ...memory.mistakes },
    cases: { ...memory.cases },
  }

  const key = zoneKey(record.scenario, record.zone)
  const zone = next.zones[key] ?? { attempts: 0, points: 0, last: date }
  next.zones[key] = { attempts: zone.attempts + 1, points: zone.points + record.score, last: date }

  for (const id of record.mistakes) {
    const stat = next.mistakes[id] ?? { times: 0, fixed: 0, last: date }
    next.mistakes[id] = { ...stat, times: stat.times + 1, last: date }
  }

  // Ошибка считается закрытой, когда в задании, где она возможна, ответ хороший и без неё.
  const possible =
    record.kind === 'probe' ? [record.refId] : (getCase(record.refId)?.mistakes ?? [])
  if (record.score >= GOOD_SCORE) {
    for (const id of possible) {
      const stat = next.mistakes[id]
      if (stat && !record.mistakes.includes(id)) next.mistakes[id] = { ...stat, fixed: stat.times }
    }
  }

  if (record.kind === 'case') {
    const best = Math.max(next.cases[record.refId]?.best ?? 0, record.score)
    next.cases[record.refId] = { best, last: date }
  }
  return next
}

export function saveSession(memory: Memory, session: SessionRecord): Memory {
  return { ...memory, sessions: [session, ...memory.sessions].slice(0, KEPT_SESSIONS) }
}

export type ZoneLevel = 'unknown' | 'weak' | 'growing' | 'solid'

/** Доля набранных баллов в зоне: от 0 до 1, либо null, если попыток не было. */
export function mastery(memory: Memory, scenario: ScenarioId, zone: string): number | null {
  const stat = memory.zones[zoneKey(scenario, zone)]
  return stat && stat.attempts > 0 ? stat.points / (stat.attempts * MAX_SCORE) : null
}

export function zoneLevel(value: number | null): ZoneLevel {
  if (value === null) return 'unknown'
  if (value < 0.5) return 'weak'
  if (value < 0.84) return 'growing'
  return 'solid'
}

export interface OpenMistake {
  mistake: Mistake
  /** Сколько раз ошибка встретилась после последнего удачного ответа. */
  open: number
  times: number
}

/** Незакрытые ошибки: сначала самые частые, при равенстве — самые свежие. */
export function openMistakes(memory: Memory, scenario?: ScenarioId): OpenMistake[] {
  return mistakes
    .filter((mistake) => !scenario || mistake.scenario === scenario)
    .map((mistake) => {
      const stat = memory.mistakes[mistake.id]
      return {
        mistake,
        open: stat ? stat.times - stat.fixed : 0,
        times: stat?.times ?? 0,
        last: stat?.last ?? '',
      }
    })
    .filter((entry) => entry.open > 0)
    .sort((a, b) => b.open - a.open || b.last.localeCompare(a.last))
}

export type SessionItem = { kind: 'probe'; mistake: Mistake } | { kind: 'case'; case: Case }

const UNKNOWN_ZONE_NEED = 0.55
const SAME_ZONE_PENALTY = 0.45

/**
 * Собирает тренировку. Первым идёт возврат к незакрытой ошибке, если она есть,
 * дальше кейсы: чем слабее зона и чем хуже прошлый результат, тем выше приоритет.
 */
export function planSession(
  scenario: ScenarioId,
  memory: Memory,
  size = 4,
  random: () => number = Math.random,
): SessionItem[] {
  const open = openMistakes(memory, scenario)
  const probes = open.slice(0, open.length >= 3 ? 2 : 1).map((entry) => entry.mistake)

  const pool = cases
    .filter((item) => item.scenario === scenario)
    .map((item) => {
      const value = mastery(memory, scenario, item.zone)
      const need = value === null ? UNKNOWN_ZONE_NEED : 1 - value
      const seen = memory.cases[item.id]
      const novelty = !seen ? 0.5 : seen.best < GOOD_SCORE ? 0.35 : -0.4
      return { item, priority: need + novelty + random() * 0.15 }
    })

  const picked: Case[] = []
  const perZone = new Map<string, number>()
  while (picked.length < size - probes.length && pool.length > 0) {
    pool.sort(
      (a, b) =>
        b.priority -
        (perZone.get(b.item.zone) ?? 0) * SAME_ZONE_PENALTY -
        (a.priority - (perZone.get(a.item.zone) ?? 0) * SAME_ZONE_PENALTY),
    )
    const { item } = pool.shift()!
    picked.push(item)
    perZone.set(item.zone, (perZone.get(item.zone) ?? 0) + 1)
  }

  return [
    ...probes.map((mistake): SessionItem => ({ kind: 'probe', mistake })),
    ...picked.map((item): SessionItem => ({ kind: 'case', case: item })),
  ]
}

/** Ошибки, о которых стоит напомнить модели при разборе. */
export function knownMistakeIds(memory: Memory): string[] {
  return Object.keys(memory.mistakes).filter((id) => getMistake(id))
}
