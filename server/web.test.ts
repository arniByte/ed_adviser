import { describe, expect, it } from 'vitest'
import { parseCandidates } from './web.js'

describe('parseCandidates', () => {
  it('достаёт источники из оборванного массива и пропускает неполные', () => {
    const text = `Вот что нашлось:
[{"url": "https://example.ru/abitur", "title": "Сроки приёма", "publisher": "Институт", "year": 2026,
  "quote": "Приём документов начинается 20 июня 2026 года.", "fact": "Подавать с 20 июня.", "scenario": "admission"},
 {"url": "ftp://bad", "title": "x", "quote": "раз два три четыре пять шесть", "fact": "y"},
 {"url": "https://example.ru/short", "title": "Коротко", "quote": "Две фразы", "fact": "z"},
 {"url": "https://example.ru/cut", "title": "Оборвано", "quote": "Ответ модели закончи`
    const found = parseCandidates(text)
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({
      url: 'https://example.ru/abitur',
      year: 2026,
      scenario: 'admission',
    })
  })

  it('подставляет домен, если издатель не указан', () => {
    const [item] = parseCandidates(
      '[{"url": "https://hh.ru/article/1", "title": "Т", "quote": "Одна две три четыре пять шесть семь", "fact": "Ф"}]',
    )
    expect(item.publisher).toBe('hh.ru')
  })
})
