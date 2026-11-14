import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Card } from '../../core/types'

const card: Card = {
  id: 'web-0123456789',
  scenario: 'job',
  zone: 'web',
  kind: 'web',
  title: 'Собеседование',
  text: 'Как подготовиться к собеседованию.',
  source: { title: 'Советы', publisher: 'Источник', url: 'https://example.org/interview' },
}
const check = { hash: 'a'.repeat(64), checkedAt: '2026-11-14T00:00:00Z' }

async function open(value: unknown) {
  vi.resetModules()
  const values = new Map([['chernovik:mine:v1', JSON.stringify(value)]])
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, next: string) => values.set(key, next),
  })
  return import('./mine')
}

afterEach(() => vi.unstubAllGlobals())

describe('личная база в браузере', () => {
  it('восстанавливает только полные карточки с пруфом и безопасной ссылкой', async () => {
    const mine = await open([
      { card, check },
      { card: { id: 'web-missing' }, check: { hash: 'x' } },
      { card: { ...card, source: null }, check },
      { card: { ...card, source: { ...card.source, url: 'javascript:alert(1)' } }, check },
      { card, check: { ...check, checkedAt: 'не дата' } },
    ])
    expect(mine.getMine()).toEqual([{ card, check }])
  })

  it('не дублирует карточку, удаляет её и сохраняет изменение в хранилище', async () => {
    const mine = await open([])
    mine.saveToMine(card, check)
    mine.saveToMine(card, check)
    expect(mine.getMine()).toEqual([{ card, check }])
    expect(JSON.parse(localStorage.getItem('chernovik:mine:v1')!)).toEqual([{ card, check }])
    mine.removeFromMine(card.id)
    expect(mine.getMine()).toEqual([])
  })

  it('не сохраняет найденную карточку без пруфа', async () => {
    const mine = await open([])
    mine.saveToMine(card, undefined as never)
    expect(mine.getMine()).toEqual([])
  })

  it('держит базу в памяти, когда браузер запрещает запись', async () => {
    const mine = await open([])
    vi.stubGlobal('localStorage', {
      setItem: () => {
        throw new Error('Denied')
      },
    })
    expect(() => mine.saveToMine(card, check)).not.toThrow()
    expect(mine.getMine()).toEqual([{ card, check }])
  })
})
