import { describe, expect, it } from 'vitest'
import { citedIds, cleanCitations, parseMeta, parseSections } from './protocol.js'

describe('parseSections', () => {
  it('делит ответ на блоки по меткам', () => {
    const parsed = parseSections('@@right\nВерно.\n\n@@improve\nУлучшить.\n@@meta\n{"score":2}')
    expect(parsed.sections).toEqual({ right: 'Верно.', improve: 'Улучшить.', meta: '{"score":2}' })
    expect(parsed.lead).toBe('')
  })

  it('текст до первой метки кладёт в lead', () => {
    const parsed = parseSections('Ответ на вопрос.\n@@followups\nПервый?\nВторой?')
    expect(parsed.lead).toBe('Ответ на вопрос.')
    expect(parsed.sections.followups).toBe('Первый?\nВторой?')
  })

  it('прячет недописанную метку в хвосте потока', () => {
    expect(parseSections('@@right\nВерно.\n@@imp').sections).toEqual({ right: 'Верно.' })
    expect(parseSections('Ответ.\n@').lead).toBe('Ответ.')
  })

  it('не принимает за метку почту или упоминание в середине строки', () => {
    expect(parseSections('Пиши на hr@@company').lead).toBe('Пиши на hr@@company')
  })
})

describe('parseMeta', () => {
  it('читает оценку, ошибки и уточняющий вопрос', () => {
    expect(parseMeta('{"score": 2, "mistakes": ["job-m-nothing"], "next": " А пример? "}')).toEqual(
      {
        score: 2,
        mistakes: ['job-m-nothing'],
        next: 'А пример?',
      },
    )
  })

  it('держит оценку в диапазоне от 0 до 3', () => {
    expect(parseMeta('{"score": 9}')?.score).toBe(3)
    expect(parseMeta('{"score": -1}')?.score).toBe(0)
  })

  it('достаёт JSON из обёртки и переживает мусор', () => {
    expect(parseMeta('```json\n{"score":1,"mistakes":[],"next":""}\n```')?.score).toBe(1)
    expect(parseMeta('не json')).toBeNull()
    expect(parseMeta(undefined)).toBeNull()
  })
})

describe('citedIds', () => {
  it('возвращает метки карточек без повторов, в порядке упоминания', () => {
    expect(citedIds('Факт [job-star]. Ещё [adm-ovp-vpp] и снова [job-star].')).toEqual([
      'job-star',
      'adm-ovp-vpp',
    ])
  })

  it('не считает меткой обычные скобки', () => {
    expect(citedIds('Смотри [1] и [пример].')).toEqual([])
  })
})

describe('cleanCitations', () => {
  it('убирает id типовых ошибок вместе с припиской', () => {
    expect(
      cleanCitations('Ответ не закрывает вопрос [job-m-no-weakness не применяй к тексту]. Дальше.'),
    ).toBe('Ответ не закрывает вопрос. Дальше.')
  })

  it('оставляет от метки с припиской только саму карточку', () => {
    expect(cleanCitations('Факт [job-star, см. ниже].')).toBe('Факт [job-star].')
  })

  it('снимает круглые скобки вокруг метки', () => {
    expect(cleanCitations('Факт ([job-star]).')).toBe('Факт [job-star].')
  })

  it('не трогает обычные метки и карточку job-minors', () => {
    expect(cleanCitations('Норма [job-minors] и [onb-probation-law].')).toBe(
      'Норма [job-minors] и [onb-probation-law].',
    )
  })
})
