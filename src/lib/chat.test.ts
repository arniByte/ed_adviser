import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadChat, saveChat, type Exchange } from './chat'

const KEY = 'chernovik:chat:v1'
const done = (id: number): Exchange => ({ id, question: 'Вопрос?', raw: 'Ответ.', status: 'done' })

function storage(value: unknown) {
  const values = new Map([[KEY, JSON.stringify(value)]])
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, next: string) => values.set(key, next),
  })
  return values
}

afterEach(() => vi.unstubAllGlobals())

describe('разговор в браузере', () => {
  it('сохраняет последние завершённые ответы без промежуточного статуса', () => {
    storage([])
    const history = Array.from({ length: 25 }, (_, index) => done(index + 1))
    saveChat([
      ...history,
      { ...done(26), progress: 'Ищу', status: 'streaming' },
      { ...done(27), progress: 'Пишу ответ' },
    ])
    expect(loadChat()).toEqual([...history.slice(-19), done(27)])
  })

  it('отбрасывает повреждённые записи и повторяющиеся id до расчёта следующего id', () => {
    storage([
      null,
      { raw: 'Ответ', status: 'done' },
      { ...done(2), question: null },
      { ...done(3), id: '3' },
      { ...done(4), id: 1.5 },
      { ...done(5), status: 'failed' },
      done(6),
      done(6),
    ])
    expect(loadChat()).toEqual([done(6)])
    expect(Math.max(0, ...loadChat().map((exchange) => exchange.id)) + 1).toBe(7)
  })

  it('сохраняет текст ответа, даже если вложенные результаты поиска повреждены', () => {
    storage([{ ...done(1), found: { cards: [null], checks: {}, looked: 1 } }])
    expect(loadChat()).toEqual([done(1)])
  })

  it('переживает запрет localStorage и повреждённый JSON', () => {
    const values = storage([])
    values.set(KEY, '{broken')
    expect(loadChat()).toEqual([])
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('Denied')
      },
      setItem: () => {
        throw new Error('Denied')
      },
    })
    expect(loadChat()).toEqual([])
    expect(() => saveChat([done(1)])).not.toThrow()
  })
})
