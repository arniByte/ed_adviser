import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Exchange } from './chat'

const CHATS = 'chernovik:chats:v1'
const LEGACY = 'chernovik:chat:v1'
const done = (id: number, question = 'Вопрос?'): Exchange => ({
  id,
  question,
  raw: 'Ответ.',
  status: 'done',
})

/** Подменяет localStorage и заново загружает модуль: хранилище читается при импорте. */
async function load(initial: Record<string, unknown> = {}) {
  const values = new Map(Object.entries(initial).map(([k, v]) => [k, JSON.stringify(v)]))
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, next: string) => values.set(key, next),
    removeItem: (key: string) => values.delete(key),
  })
  vi.resetModules()
  return { chat: await import('./chat'), values }
}

afterEach(() => vi.unstubAllGlobals())

describe('история разговоров', () => {
  it('сохраняет последние завершённые ответы без промежуточного статуса', async () => {
    const { chat } = await load()
    const history = Array.from({ length: 25 }, (_, index) => done(index + 1))
    chat.saveChat('a', [
      ...history,
      { ...done(26), progress: 'Ищу', status: 'streaming' },
      { ...done(27), progress: 'Пишу ответ' },
    ])
    expect(chat.findChat('a')?.exchanges).toEqual([...history.slice(-19), done(27)])
    expect(chat.openChatId()).toBe('a')
  })

  it('держит свежий разговор первым и не хранит пустые', async () => {
    const { chat } = await load()
    chat.saveChat('a', [done(1, 'Как поступить в МГУ?')])
    chat.saveChat('b', [done(2, 'Что такое БВИ?')])
    chat.saveChat('a', [done(1, 'Как поступить в МГУ?'), done(3)])
    expect(chat.getChats().map((c) => [c.id, c.title])).toEqual([
      ['a', 'Как поступить в МГУ?'],
      ['b', 'Что такое БВИ?'],
    ])
    chat.saveChat('c', [])
    chat.deleteChat('b')
    expect(chat.getChats().map((c) => c.id)).toEqual(['a'])
    expect(chat.nextExchangeId()).toBe(4)
  })

  it('дописывает поздний ответ в разговор, из которого ушли', async () => {
    const { chat } = await load()
    chat.saveChat('a', [done(1)])
    chat.saveChat('b', [done(2)])
    chat.appendToChat('a', done(3))
    expect(chat.findChat('a')?.exchanges).toEqual([done(1), done(3)])
    expect(chat.getChats()[0].id).toBe('a')
  })

  it('переносит разговор из прежней версии', async () => {
    const { chat, values } = await load({ [LEGACY]: [done(5)] })
    expect(chat.getChats()).toHaveLength(1)
    expect(chat.getChats()[0].exchanges).toEqual([done(5)])
    expect(chat.openChatId()).toBe(chat.getChats()[0].id)
    expect(values.has(LEGACY)).toBe(false)
  })

  it('отбрасывает повреждённые записи и повторяющиеся id', async () => {
    const { chat } = await load({
      [CHATS]: [
        null,
        { id: 'x', updatedAt: 1, exchanges: [] },
        {
          id: 'a',
          updatedAt: 2,
          exchanges: [
            null,
            { raw: 'Ответ', status: 'done' },
            { ...done(2), question: null },
            { ...done(3), id: '3' },
            { ...done(4), id: 1.5 },
            { ...done(5), status: 'failed' },
            done(6),
            done(6),
            { ...done(7), found: { cards: [null], checks: {}, looked: 1 } },
          ],
        },
        { id: 'a', updatedAt: 3, exchanges: [done(9)] },
      ],
    })
    expect(chat.getChats()).toHaveLength(1)
    expect(chat.findChat('a')?.exchanges).toEqual([done(6), done(7)])
  })

  it('переживает запрет localStorage и повреждённый JSON', async () => {
    const { values } = await load()
    values.set(CHATS, '{broken')
    vi.resetModules()
    expect((await import('./chat')).getChats()).toEqual([])
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('Denied')
      },
      setItem: () => {
        throw new Error('Denied')
      },
      removeItem: () => {
        throw new Error('Denied')
      },
    })
    vi.resetModules()
    const chat = await import('./chat')
    expect(chat.getChats()).toEqual([])
    expect(() => chat.saveChat('a', [done(1)])).not.toThrow()
    expect(chat.findChat('a')?.exchanges).toEqual([done(1)])
  })
})
