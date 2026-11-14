import { describe, expect, it } from 'vitest'
import { search, stem, tokenize } from './search.js'

const ids = (query: string, scenario?: Parameters<typeof search>[1]) =>
  search(query, scenario).map((hit) => hit.card.id)

describe('stem', () => {
  it('сводит формы слова к одной основе', () => {
    expect(stem('приоритеты')).toBe(stem('приоритет'))
    expect(stem('собеседовании')).toBe(stem('собеседование'))
  })

  it('не обрезает короткие слова до бессмыслицы', () => {
    expect(stem('вуз')).toBe('вуз')
  })
})

describe('tokenize', () => {
  it('отбрасывает служебные слова', () => {
    expect(tokenize('что делать если я не')).toEqual([])
  })

  it('раскрывает разговорные формы', () => {
    expect(tokenize('собес')).toContain(stem('собеседование'))
  })
})

describe('search', () => {
  it('находит карточку по прямому вопросу', () => {
    expect(ids('как расставить приоритеты при поступлении').slice(0, 2)).toContain(
      'adm-priority-order',
    )
    expect(ids('мне 16 лет можно ли работать')[0]).toBe('job-minors')
  })

  it('понимает сленг и другие формы слова', () => {
    expect(ids('меня спросили про слабые стороны на собесе')[0]).toBe('job-weaknesses-why')
    expect(ids('могут ли уволить на испыталке')).toContain('onb-probation-exit')
  })

  it('ничего не возвращает на вопрос не по теме', () => {
    expect(ids('как приготовить борщ')).toEqual([])
    expect(ids('')).toEqual([])
  })

  it('поднимает карточки выбранного сценария', () => {
    const [first] = search('договор', { scenario: 'admission' })
    expect(first.card.scenario).toBe('admission')
  })

  it('соблюдает лимит', () => {
    expect(search('работа', { limit: 3 }).length).toBeLessThanOrEqual(3)
  })
})
