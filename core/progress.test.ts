import { describe, expect, it } from 'vitest'
import { getCase } from './knowledge.js'
import {
  emptyMemory,
  mastery,
  openMistakes,
  planSession,
  recordReview,
  zoneLevel,
  type Memory,
  type ReviewRecord,
} from './progress.js'

function review(caseId: string, score: number, mistakes: string[] = []): ReviewRecord {
  const item = getCase(caseId)!
  return {
    kind: 'case',
    refId: caseId,
    scenario: item.scenario,
    zone: item.zone,
    title: item.title,
    question: item.question,
    answer: 'ответ',
    score,
    mistakes,
    right: '',
    improve: '',
    example: '',
    cards: [],
    attempts: 1,
  }
}

const after = (...records: ReviewRecord[]): Memory =>
  records.reduce((memory, record) => recordReview(memory, record), emptyMemory())

const noJitter = () => 0

describe('recordReview', () => {
  it('копит баллы по зоне', () => {
    const memory = after(review('job-c-weakness', 1), review('job-c-why-you', 3))
    expect(mastery(memory, 'job', 'interview')).toBeCloseTo(4 / 6)
    expect(mastery(memory, 'job', 'resume')).toBeNull()
  })

  it('запоминает ошибку и считает повторы', () => {
    const memory = after(
      review('job-c-weakness', 1, ['job-m-no-weakness']),
      review('job-c-weakness', 1, ['job-m-no-weakness']),
    )
    expect(openMistakes(memory, 'job')).toMatchObject([{ open: 2, times: 2 }])
  })

  it('закрывает ошибку после хорошего ответа без неё', () => {
    const memory = after(
      review('job-c-weakness', 1, ['job-m-no-weakness']),
      review('job-c-weakness', 3),
    )
    expect(openMistakes(memory)).toEqual([])
  })

  it('не закрывает ошибку слабым ответом', () => {
    const memory = after(
      review('job-c-weakness', 1, ['job-m-no-weakness']),
      review('job-c-weakness', 1),
    )
    expect(openMistakes(memory)).toHaveLength(1)
  })

  it('закрывает ошибку удачным ответом на контрольный вопрос', () => {
    const first = after(review('job-c-weakness', 0, ['job-m-no-weakness']))
    const probe: ReviewRecord = {
      ...review('job-c-weakness', 2),
      kind: 'probe',
      refId: 'job-m-no-weakness',
    }
    expect(openMistakes(recordReview(first, probe))).toEqual([])
  })

  it('не меняет исходный объект памяти', () => {
    const memory = emptyMemory()
    recordReview(memory, review('job-c-weakness', 2))
    expect(memory).toEqual(emptyMemory())
  })
})

describe('zoneLevel', () => {
  it('переводит долю баллов в уровень', () => {
    expect(zoneLevel(null)).toBe('unknown')
    expect(zoneLevel(0.3)).toBe('weak')
    expect(zoneLevel(0.67)).toBe('growing')
    expect(zoneLevel(1)).toBe('solid')
  })
})

describe('planSession', () => {
  it('для новичка собирает четыре кейса из разных зон', () => {
    const plan = planSession('job', emptyMemory(), 4, noJitter)
    expect(plan).toHaveLength(4)
    expect(plan.every((item) => item.kind === 'case')).toBe(true)
    const zones = plan.map((item) => (item.kind === 'case' ? item.case.zone : ''))
    expect(new Set(zones).size).toBe(4)
  })

  it('начинает с возврата к незакрытой ошибке', () => {
    const memory = after(review('job-c-weakness', 1, ['job-m-no-weakness']))
    const [first, ...rest] = planSession('job', memory, 4, noJitter)
    expect(first).toMatchObject({ kind: 'probe', mistake: { id: 'job-m-no-weakness' } })
    expect(rest).toHaveLength(3)
  })

  it('не тянет ошибки из чужого сценария', () => {
    const memory = after(review('job-c-weakness', 1, ['job-m-no-weakness']))
    expect(
      planSession('admission', memory, 4, noJitter).every((item) => item.kind === 'case'),
    ).toBe(true)
  })

  it('отдаёт приоритет слабой зоне перед сильной', () => {
    const memory = after(
      review('onb-c-stuck', 0),
      review('onb-c-first-meeting', 3),
      review('onb-c-overload', 3),
    )
    const zones = planSession('onboarding', memory, 2, noJitter).map((item) =>
      item.kind === 'case' ? item.case.zone : '',
    )
    expect(zones).not.toContain('expectations')
  })

  it('возвращает проваленный кейс раньше пройденного', () => {
    const memory = after(review('adm-c-priorities', 0), review('adm-c-list-position', 3))
    const picked = planSession('admission', memory, 7, noJitter).map((item) =>
      item.kind === 'case' ? item.case.id : '',
    )
    expect(picked.indexOf('adm-c-priorities')).toBeLessThan(picked.indexOf('adm-c-list-position'))
  })
})
