import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  emptyMemory,
  openMistakes,
  planSession,
  type ReviewRecord,
  type SessionRecord,
} from '../../core/progress'
import { toMarkdown } from '../features/report/notes'

const now = '2026-11-14T00:00:00Z'
const item: ReviewRecord = {
  kind: 'case',
  refId: 'job-c-weakness',
  scenario: 'job',
  zone: 'interview',
  title: 'Слабые стороны',
  question: 'Назови слабую сторону.',
  answer: 'Мне бывает трудно выступать.',
  score: 2,
  mistakes: [],
  right: 'Есть конкретный пример.',
  improve: 'Добавь план.',
  example: 'Я тренирую выступления.',
  cards: ['job-star'],
  attempts: 1,
}
const session: SessionRecord = {
  id: 'session-1',
  scenario: 'job',
  date: now,
  items: [item],
  summary: 'Хорошее начало.',
  plan: ['Порепетировать'],
}

async function open(value: unknown) {
  vi.resetModules()
  vi.stubGlobal('localStorage', {
    getItem: () => JSON.stringify(value),
    setItem: vi.fn(),
  })
  return import('./memory')
}

afterEach(() => vi.unstubAllGlobals())

describe('память тренировок в браузере', () => {
  it('восстанавливает безопасную память вместо null в основных структурах', async () => {
    const { getMemory } = await open({
      version: 1,
      sessions: null,
      mistakes: null,
      zones: null,
      cases: null,
    })
    expect(getMemory()).toEqual(emptyMemory())
    expect(() => openMistakes(getMemory())).not.toThrow()
    expect(planSession('job', getMemory())).toHaveLength(4)
  })

  it('сохраняет валидные тренировки и статистики среди повреждённых записей', async () => {
    const validMistake = { times: 2, fixed: 1, last: now }
    const validZone = { attempts: 2, points: 4, last: now }
    const validCase = { best: 2, last: now }
    const { getMemory } = await open({
      version: 1,
      sessions: [null, { ...session, items: null }, session],
      mistakes: {
        'job-m-no-weakness': validMistake,
        broken: { times: 1, fixed: 2, last: now },
        invalidDate: { times: 1, fixed: 0, last: 10 },
      },
      zones: {
        'job/interview': validZone,
        impossible: { attempts: 1, points: 10, last: now },
        broken: null,
      },
      cases: { 'job-c-weakness': validCase, invalidScore: { best: '2', last: now } },
    })
    expect(getMemory()).toEqual({
      version: 1,
      sessions: [session],
      mistakes: { 'job-m-no-weakness': validMistake },
      zones: { 'job/interview': validZone },
      cases: { 'job-c-weakness': validCase },
    })
    expect(openMistakes(getMemory())[0].open).toBe(1)
    expect(toMarkdown(getMemory().sessions[0])).toContain(item.answer)
  })

  it('удаляет испорченный кейс внутри сессии, сохраняя остальные кейсы и строки плана', async () => {
    const { getMemory } = await open({
      ...emptyMemory(),
      sessions: [
        {
          ...session,
          items: [null, { ...item, right: {} }, { ...item, score: 8 }, item],
          plan: ['Порепетировать', {}, null],
        },
      ],
    })
    expect(getMemory().sessions).toEqual([session])
    expect(() => toMarkdown(getMemory().sessions[0])).not.toThrow()
  })

  it('переживает закрытое хранилище и сохраняет тренировку в памяти вкладки', async () => {
    vi.resetModules()
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('Denied')
      },
      setItem: () => {
        throw new Error('Denied')
      },
    })
    const { getMemory, updateMemory, clearMemory } = await import('./memory')
    expect(getMemory()).toEqual(emptyMemory())
    updateMemory((memory) => ({ ...memory, sessions: [session] }))
    expect(getMemory().sessions).toEqual([session])
    clearMemory()
    expect(getMemory()).toEqual(emptyMemory())
  })
})
