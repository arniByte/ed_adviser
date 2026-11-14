import { useSyncExternalStore } from 'react'
import { isScenarioId } from '../../core/knowledge'
import {
  emptyMemory,
  type Memory,
  type ReviewRecord,
  type SessionRecord,
} from '../../core/progress'

/** Всё хранится только в браузере пользователя: на сервер память не уходит. */
const KEY = 'chernovik:memory:v1'

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
const count = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
const date = (value: unknown): value is string =>
  typeof value === 'string' && Number.isFinite(Date.parse(value))
const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []

function review(value: unknown): ReviewRecord | null {
  if (
    !object(value) ||
    (value.kind !== 'case' && value.kind !== 'probe') ||
    !isScenarioId(value.scenario) ||
    !count(value.score) ||
    value.score > 3 ||
    !count(value.attempts) ||
    value.attempts < 1 ||
    !['refId', 'zone', 'title', 'question', 'answer', 'right', 'improve', 'example'].every(
      (field) => typeof value[field] === 'string',
    ) ||
    !Array.isArray(value.mistakes) ||
    !Array.isArray(value.cards) ||
    (value.situation !== undefined && typeof value.situation !== 'string')
  )
    return null
  return {
    ...(value as unknown as ReviewRecord),
    mistakes: strings(value.mistakes),
    cards: strings(value.cards),
  }
}

function session(value: unknown): SessionRecord | null {
  if (
    !object(value) ||
    typeof value.id !== 'string' ||
    !/^[a-z0-9-]+$/i.test(value.id) ||
    !isScenarioId(value.scenario) ||
    !date(value.date) ||
    typeof value.summary !== 'string' ||
    !Array.isArray(value.items)
  )
    return null
  const items = value.items.flatMap((item) => {
    const valid = review(item)
    return valid ? [valid] : []
  })
  if (items.length === 0) return null
  return {
    id: value.id,
    scenario: value.scenario,
    date: value.date,
    items,
    summary: value.summary,
    plan: strings(value.plan),
  }
}

function record<T>(value: unknown, valid: (item: unknown) => item is T): Record<string, T> {
  return Object.fromEntries(
    (object(value) ? Object.entries(value) : []).filter((entry): entry is [string, T] =>
      valid(entry[1]),
    ),
  )
}

function read(): Memory {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (!object(stored) || stored.version !== 1) return emptyMemory()
    // Повреждённая запись не должна скрывать остальные тренировки и валидные баллы.
    return {
      version: 1,
      sessions: Array.isArray(stored.sessions)
        ? stored.sessions
            .flatMap((item) => {
              const valid = session(item)
              return valid ? [valid] : []
            })
            .slice(0, 20)
        : [],
      mistakes: record(
        stored.mistakes,
        (item): item is Memory['mistakes'][string] =>
          object(item) &&
          count(item.times) &&
          count(item.fixed) &&
          item.fixed <= item.times &&
          date(item.last),
      ),
      zones: record(
        stored.zones,
        (item): item is Memory['zones'][string] =>
          object(item) &&
          count(item.attempts) &&
          count(item.points) &&
          item.points <= item.attempts * 3 &&
          date(item.last),
      ),
      cases: record(
        stored.cases,
        (item): item is Memory['cases'][string] =>
          object(item) && count(item.best) && item.best <= 3 && date(item.last),
      ),
    }
  } catch {
    // Повреждённые данные или закрытое хранилище — начинаем с чистого листа.
  }
  return emptyMemory()
}

let current = read()
const listeners = new Set<() => void>()

export function updateMemory(change: (memory: Memory) => Memory) {
  current = change(current)
  try {
    localStorage.setItem(KEY, JSON.stringify(current))
  } catch {
    // В приватном режиме запись может быть запрещена: память живёт до закрытия вкладки.
  }
  listeners.forEach((notify) => notify())
}

export const getMemory = () => current

export const clearMemory = () => updateMemory(emptyMemory)

export function useMemory(): Memory {
  return useSyncExternalStore((notify) => {
    listeners.add(notify)
    return () => listeners.delete(notify)
  }, getMemory)
}
